import { api } from "@/services/api";
import { PlayRecordManager } from "@/services/storage";
import { RowItem, Category, DoubanItem, DoubanRecommendationItem, PlayRecord } from "@/types";
import { buildDefaultFilters } from "./homeConfig";

const DOUBAN_RECOMMENDATION_PAGE_SIZE = 25;

export class HomeService {

  private mapDoubanItemsToRows(items: DoubanItem[]): RowItem[] {
    return items.map((item) => ({
      ...item,
      id: item.title,
      source: "douban",
    })) as RowItem[];
  }

  private mapDoubanRecommendationsToRows(items: DoubanRecommendationItem[]): RowItem[] {
    return items.map((item) => ({
      id: item.id || item.title,
      source: "douban",
      title: item.title,
      poster: item.poster,
      year: item.year,
      rate: item.rate,
      sourceName: "豆瓣",
    })) as RowItem[];
  }

  private parseRecordKey(key: string) {
    const firstPlusIndex = key.indexOf("+");
    return {
      source: firstPlusIndex !== -1 ? key.slice(0, firstPlusIndex) : "",
      id: firstPlusIndex !== -1 ? key.slice(firstPlusIndex + 1) : key,
    };
  }

  public transformPlayRecordsToRowItems(records: Record<string, PlayRecord>): RowItem[] {
    return Object.entries(records)
      .map(([key, record]) => {
        const { source, id } = this.parseRecordKey(key);
        const totalTime = record.total_time ?? 0;
        const playTime = record.play_time ?? 0;
        const totalEpisodes = record.total_episodes ?? 1;
        const currentEpisode = record.index ?? 1;
        const hasValidDuration = totalTime > 0;

        // Consider outroStartTime (stored in ms)
        const outroSeconds = record.outroStartTime ? record.outroStartTime / 1000 : 0;
        const effectiveEnd = outroSeconds > 0 ? Math.max(totalTime - outroSeconds, 0) : totalTime;

        // An episode is finished if playTime reached the outro boundary (with 5s buffer) or >= 95% of totalTime
        const isEpisodeFinished = hasValidDuration && (
          (outroSeconds > 0 && playTime >= effectiveEnd - 5) ||
          (playTime >= totalTime - 15) ||
          (playTime / totalTime >= 0.95)
        );

        // A whole drama/video is completely finished if it is on the last episode AND that episode is finished
        const isAllCompleted = isEpisodeFinished && (totalEpisodes <= 1 || currentEpisode >= totalEpisodes);

        const rawProgress = hasValidDuration ? playTime / totalTime : undefined;
        // If whole series is completed, progress is 1 (100%)
        const progress = isAllCompleted ? 1 : rawProgress;

        return {
          ...record,
          id,
          source,
          poster: record.cover,
          sourceName: record.source_name,
          episodeIndex: record.index,
          totalEpisodes: record.total_episodes,
          lastPlayed: record.save_time,
          play_time: record.play_time,
          progress,
          isCompleted: isAllCompleted,
          isEpisodeFinished,
        };
      })
      .sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
  }

  public async fetchDoubanCategoryContent(
    category: Category & { type: "movie" | "tv"; tag: string }, // Enforce types
    pageStart: number,
    signal?: AbortSignal
  ): Promise<{ items: RowItem[]; hasMore: boolean }> {

    // Logic for Filter Config (New API)
    if (category.filterConfig) {
      const limit = DOUBAN_RECOMMENDATION_PAGE_SIZE;
      const activeFilters = category.activeFilters ?? buildDefaultFilters(category.filterConfig);

      const result = await api.getDoubanRecommendations(
        category.filterConfig.kind,
        {
          ...activeFilters,
          start: pageStart,
          limit,
        } as any,
        signal
      );

      const items = this.mapDoubanRecommendationsToRows(result.list);
      return {
        items,
        hasMore: result.list.length > 0,
      };
    }

    // Logic for simple Tag (Old API)
    const result = await api.getDoubanData(category.type, category.tag, 20, pageStart, signal);
    const items = this.mapDoubanItemsToRows(result.list);
    return {
      items,
      hasMore: result.list.length !== 0,
    };
  }

  private lastPlayRecordsFingerprint: string = "";
  private lastPlayRecordsData: RowItem[] = [];

  public async fetchPlayRecords(): Promise<RowItem[]> {
    const records = await PlayRecordManager.getAllLatestByTitle();

    // Generate fingerprint based on keys and save_time
    // We sort keys to ensure consistent order, although getAllLatestByTitle might not guarantee it
    const keys = Object.keys(records).sort();
    const fingerprintParts = keys.map(key => `${key}:${records[key].save_time}`);
    const currentFingerprint = fingerprintParts.join('|');

    if (currentFingerprint === this.lastPlayRecordsFingerprint && this.lastPlayRecordsData.length > 0) {
      return this.lastPlayRecordsData;
    }

    const newRows = this.transformPlayRecordsToRowItems(records);

    this.lastPlayRecordsFingerprint = currentFingerprint;
    this.lastPlayRecordsData = newRows;

    return newRows;
  }
}

export const homeService = new HomeService();
