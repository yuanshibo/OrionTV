import { api, DoubanItem, DoubanRecommendationItem, PlayRecord } from "@/services/api";
import { PlayRecordManager } from "@/services/storage";
import { RowItem, Category, DoubanFilterConfig, ActiveDoubanFilters } from "./dataTypes";

const DOUBAN_RECOMMENDATION_PAGE_SIZE = 25;

export class HomeService {

  private buildDefaultFilters(config: DoubanFilterConfig): ActiveDoubanFilters {
    const defaults: ActiveDoubanFilters = {};

    config.groups.forEach((group) => {
      if (group.key === 'kind') {
        defaults[group.key] = group.defaultValue;
      } else {
        defaults[group.key] = group.defaultValue;
      }
    });

    return { ...defaults, ...(config.staticFilters ?? {}) };
  }

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
    const [source, id] = key.split("+");
    return {
      source: source || "",
      id: id || key,
    };
  }

  public transformPlayRecordsToRowItems(records: Record<string, PlayRecord>): RowItem[] {
    return Object.entries(records)
      .map(([key, record]) => {
        const { source, id } = this.parseRecordKey(key);
        const totalTime = record.total_time ?? 0;
        const hasValidDuration = totalTime > 0;

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
          progress: hasValidDuration ? record.play_time / totalTime : undefined,
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
      const activeFilters = category.activeFilters ?? this.buildDefaultFilters(category.filterConfig);

      const result = await api.getDoubanRecommendations(
        category.filterConfig.kind,
        {
          ...activeFilters,
          start: pageStart,
          limit,
        },
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

  public async fetchPlayRecords(): Promise<RowItem[]> {
    const records = await PlayRecordManager.getAllLatestByTitle();
    return this.transformPlayRecordsToRowItems(records);
  }
}

export const homeService = new HomeService();
