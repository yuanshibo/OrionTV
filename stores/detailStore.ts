import { create } from "zustand";
import { SearchResult, api, isNetworkStatusZeroError, SearchResultWithResolution, PlayRecord } from "@/services/api";
import { getResolutionFromM3U8 } from "@/services/m3u8";
import { useSettingsStore } from "@/stores/settingsStore";
import { FavoriteManager, PlayRecordManager } from "@/services/storage";
import Logger from "@/utils/Logger";
import { APP_CONFIG } from "@/constants/AppConfig";
import {
  normalizeIdentifier,
  normalizeSourceName,
  buildDetailCacheKey,
  buildResultDedupeKey,
  shouldPreferRawResult,
  shouldPreferEnrichedResult,
  mergeResultsByDedupeKey,
} from "@/utils/DetailUtils";
import { processNewResults } from "@/utils/DetailLogic";

const logger = Logger.withTag('DetailStore');

const NETWORK_ERROR_FRIENDLY_MESSAGE = APP_CONFIG.MESSAGES.NETWORK_ERROR_FRIENDLY;

const mapNetworkErrorMessage = (error: unknown, fallback: string): string => {
  if (isNetworkStatusZeroError(error)) {
    return NETWORK_ERROR_FRIENDLY_MESSAGE;
  }

  if (typeof fallback === "string" && fallback.trim().length > 0) {
    return fallback;
  }

  return NETWORK_ERROR_FRIENDLY_MESSAGE;
};

type DetailCacheEntry = {
  timestamp: number;
  detail: SearchResultWithResolution | null;
  searchResults: SearchResultWithResolution[];
  sources: { source: string; source_name: string; resolution: string | null | undefined }[];
  allSourcesLoaded: boolean;
};

const detailCache = new Map<string, DetailCacheEntry>();
const resolutionCache = new Map<string, { value: string | null | undefined; timestamp: number }>();
const resolutionCachePending = new Map<string, Promise<string | null | undefined>>();
let lastCacheKey: string | null = null;

const getDetailCacheEntry = (cacheKey: string): DetailCacheEntry | null => {
  const entry = detailCache.get(cacheKey);
  if (!entry) {
    return null;
  }

  if (Date.now() - entry.timestamp > APP_CONFIG.DETAIL.CACHE_TTL) {
    detailCache.delete(cacheKey);
    return null;
  }

  return entry;
};

const setDetailCacheEntry = (
  cacheKey: string,
  detail: SearchResultWithResolution | null,
  searchResults: SearchResultWithResolution[],
  sources: { source: string; source_name: string; resolution: string | null | undefined }[],
  allSourcesLoaded: boolean
) => {
  detailCache.set(cacheKey, {
    timestamp: Date.now(),
    detail: detail ? { ...detail } : null,
    searchResults: searchResults.map((item) => ({ ...item })),
    sources: sources.map((item) => ({ ...item })),
    allSourcesLoaded,
  });

  if (detailCache.size > APP_CONFIG.DETAIL.CACHE_MAX_ENTRIES) {
    let oldestKey: string | null = null;
    let oldestTimestamp = Number.POSITIVE_INFINITY;
    for (const [key, value] of Array.from(detailCache.entries())) {
      if (value.timestamp < oldestTimestamp) {
        oldestTimestamp = value.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      detailCache.delete(oldestKey);
    }
  }
};

const getResolutionWithCache = async (episodeUrl: string, signal?: AbortSignal) => {
  if (!episodeUrl) {
    return undefined;
  }

  const cached = resolutionCache.get(episodeUrl);
  if (cached && Date.now() - cached.timestamp < APP_CONFIG.DETAIL.RESOLUTION_CACHE_TTL) {
    return cached.value;
  }

  const pending = resolutionCachePending.get(episodeUrl);
  if (pending) {
    return pending;
  }

  const fetchPromise = (async () => {
    try {
      const value = await getResolutionFromM3U8(episodeUrl, signal);
      resolutionCache.set(episodeUrl, { value, timestamp: Date.now() });
      return value;
    } finally {
      resolutionCachePending.delete(episodeUrl);
    }
  })();

  resolutionCachePending.set(episodeUrl, fetchPromise);

  try {
    return await fetchPromise;
  } catch (error) {
    resolutionCache.delete(episodeUrl);
    throw error;
  }
};




interface DetailState {
  q: string | null;
  searchResults: SearchResultWithResolution[];
  sources: { source: string; source_name: string; resolution: string | null | undefined }[];
  detail: SearchResultWithResolution | null;
  loading: boolean;
  error: string | null;
  allSourcesLoaded: boolean;
  controller: AbortController | null;
  isFavorited: boolean;
  failedSources: Set<string>; // 记录失败的source列表

  resumeRecord: PlayRecord | null;

  init: (q: string, preferredSource?: string, id?: string, year?: string, type?: string) => Promise<void>;
  setDetail: (detail: SearchResultWithResolution) => Promise<void>;
  abort: () => void;
  toggleFavorite: () => Promise<void>;
  markSourceAsFailed: (source: string, reason: string) => void;
  getNextAvailableSource: (currentSource: string, episodeIndex: number) => SearchResultWithResolution | null;
  refreshResumeRecord: () => Promise<void>;
}

const useDetailStore = create<DetailState>((set, get) => ({
  q: null,
  searchResults: [],
  sources: [],
  detail: null,
  loading: true,
  error: null,
  allSourcesLoaded: false,
  controller: null,
  isFavorited: false,
  failedSources: new Set(),
  resumeRecord: null,

  init: async (q, preferredSource, id, year, type) => {
    const perfStart = performance.now();
    logger.debug(`[PERF] DetailStore.init START - q: ${q}, preferredSource: ${preferredSource}, id: ${id}`);

    const { controller: oldController } = get();
    if (oldController) {
      oldController.abort();
    }
    const newController = new AbortController();
    const signal = newController.signal;

    const cacheKey = buildDetailCacheKey(q, preferredSource, id, year, type);
    lastCacheKey = cacheKey;
    const cachedEntry = getDetailCacheEntry(cacheKey);
    const cachedSearchResults = cachedEntry ? cachedEntry.searchResults.map((item) => ({ ...item })) : [];
    const cachedDetail = cachedEntry?.detail ? { ...cachedEntry.detail } : null;
    const cachedSources = cachedEntry ? cachedEntry.sources.map((item) => ({ ...item })) : [];
    const cachedAllSourcesLoaded = cachedEntry?.allSourcesLoaded ?? false;

    // 如果有有效缓存,直接使用缓存数据
    const hasValidCache = cachedEntry && cachedDetail && cachedSearchResults.length > 0;
    logger.debug(`[CACHE] Cache status for "${q}": ${hasValidCache ? 'VALID' : 'MISS'}`);

    // --- Guard: Skip if already loaded and matches ---
    const currentState = get();
    // Check if query matches AND if we are already on the preferred source (if specified)
    const isSameQuery = currentState.q === q;
    const isSameSource = !preferredSource || (currentState.detail?.source === preferredSource);
    // Strict metadata check: if year/type provided, they MUST match
    const isSameYear = !year || (currentState.detail?.year === year);
    const isSameType = !type || (currentState.detail?.type === type);

    if (isSameQuery && currentState.detail && isSameSource && isSameYear && isSameType && !currentState.loading) {
      if (!hasValidCache) {
        logger.debug(`[INIT] Guard: Already loaded "${q}" with source "${currentState.detail.source}", skipping.`);
        // Refresh resume record just in case (silent update)
        if (currentState.detail?.title) {
          PlayRecordManager.getLatestByTitle(currentState.detail.title, currentState.detail.year, currentState.detail.type)
            .then(r => set({ resumeRecord: r }));
        }
        return;
      }
    }
    set({
      q,
      loading: !hasValidCache,
      searchResults: cachedSearchResults,
      detail: cachedDetail,
      error: null,
      allSourcesLoaded: cachedAllSourcesLoaded,
      controller: newController,
      sources: cachedSources,
      failedSources: new Set(),
      isFavorited: false,
      resumeRecord: null,
    });

    if (hasValidCache) {
      logger.debug(`[CACHE] Using cached data for "${q}", skipping fetch`);
      try {
        const isFavFromCache = await FavoriteManager.isFavorited(
          cachedDetail!.source,
          cachedDetail!.id.toString()
        );
        const resumeRecord = await PlayRecordManager.getLatestByTitle(
          cachedDetail!.title,
          cachedDetail!.year,
          cachedDetail!.type
        );
        set({ isFavorited: isFavFromCache, resumeRecord });
      } catch (e) {
        logger.warn("[WARN] Failed to restore aux data from cache:", e);
      }
      return;
    }

    // --- Progressive Loading Start ---

    try {
      // 1. Fetch Metadata (Resources & History) in parallel
      const metadataStart = performance.now();
      const [resources, playRecords] = await Promise.all([
        api.getResources(signal),
        api.getPlayRecords()
      ]);
      const metadataEnd = performance.now();
      logger.info(`[PERF] Metadata fetch took ${(metadataEnd - metadataStart).toFixed(2)}ms`);

      if (signal.aborted) return;

      // 2. No Placeholders - Start Fresh
      set({
        searchResults: [],
        sources: [],
        loading: true, // Keep loading true until first valid source
        error: null
      });

      // 3. Determine Target Source (History Priority)
      let historySourceKey: string | null = null;
      let matchedRecord: any = null;

      if (playRecords) {
        // Precise matching using metadata if available
        if (year || type) {
          const records = Object.values(playRecords || {});
          matchedRecord = records.find(r =>
            r.title === q &&
            (!year || r.year === year) &&
            (!type || r.type === type)
          );
        }

        // Fallback to title-only match if no metadata or no strict match found
        if (!matchedRecord) {
          const records = Object.values(playRecords || {});
          matchedRecord = records.find(r => r.title === q);
        }

        if (matchedRecord) {
          const res = resources.find(r => r.name === matchedRecord.source_name);
          if (res) historySourceKey = res.key;
        }
      }

      // Pre-set resume record if found in the bulk fetch (optimization)
      // We will refine this later with getLatestByTitle for metadata, but this is a good start
      if (matchedRecord) {
        set({ resumeRecord: matchedRecord });
      }

      let validSourcesCount = 0;
      const MAX_VALID_SOURCES = 7;
      const loadedSourceKeys = new Set<string>();

      // Helper to process and add results
      const addResults = (results: SearchResult[], sourceKey: string) => {
        const snapshot = get();
        const { results: newSearchResults } = processNewResults(
          snapshot.searchResults,
          results,
          true, // merge
          sourceKey
        );

        // If this is the first valid source, set it as detail and stop loading
        let updates: Partial<DetailState> = {
          searchResults: newSearchResults,
          sources: newSearchResults.map(r => ({ source: r.source, source_name: r.source_name.trim(), resolution: r.resolution })),
        };

        if (snapshot.loading) {
          const firstDetail = newSearchResults.find(r => r.source === sourceKey) || newSearchResults[0];
          if (firstDetail) {
            updates.detail = firstDetail;
            updates.loading = false;
            logger.info(`[INFO] First valid source loaded: ${sourceKey}. UI displayed.`);

            // Trigger parallel fetch for aux data (favorite & precise resume)
            Promise.all([
              FavoriteManager.isFavorited(firstDetail.source, firstDetail.id.toString()),
              PlayRecordManager.getLatestByTitle(firstDetail.title, firstDetail.year, firstDetail.type)
            ]).then(([isFav, resumeRec]) => {
              set({ isFavorited: isFav, resumeRecord: resumeRec });
            });
          }
        } else {
          // If already loaded, check if the new result has MORE episodes (e.g., Weekly update)
          const newDetail = newSearchResults.find(r => r.source === sourceKey);
          if (newDetail && snapshot.detail && newDetail.episodes.length > snapshot.detail.episodes.length) {
            // Strict check: Only auto-switch if metadata matches to avoid switching to a different show with same title
            const isSameYear = !snapshot.detail.year || !newDetail.year || snapshot.detail.year === newDetail.year;
            const isSameType = !snapshot.detail.type || !newDetail.type || snapshot.detail.type === newDetail.type;

            if (isSameYear && isSameType) {
              logger.info(`[AUTO-SWITCH] Switching to source "${newDetail.source}" because it has more episodes (${newDetail.episodes.length} > ${snapshot.detail.episodes.length})`);
              updates.detail = newDetail;
              // Also update favorited status for the new source
              Promise.all([
                FavoriteManager.isFavorited(newDetail.source, newDetail.id.toString()),
                PlayRecordManager.getLatestByTitle(newDetail.title, newDetail.year, newDetail.type)
              ]).then(([isFav, resumeRec]) => {
                set({ isFavorited: isFav, resumeRecord: resumeRec });
              });
            } else {
              logger.warn(`[AUTO-SWITCH] Skipped switching to "${newDetail.source}" despite more episodes: Metadata mismatch (Year: ${snapshot.detail.year} vs ${newDetail.year}, Type: ${snapshot.detail.type} vs ${newDetail.type})`);
            }
          }
        }

        set(updates);
        validSourcesCount++;
        loadedSourceKeys.add(sourceKey);
      };

      // 4. Load History Source First (if exists)
      if (historySourceKey) {
        logger.info(`[INFO] Loading history source first: ${historySourceKey}`);
        try {
          const { results } = await api.searchVideo(q, historySourceKey, signal);
          if (signal.aborted) return;

          if (results.length > 0) {
            addResults(results, historySourceKey);
          } else {
            logger.warn(`[WARN] History source "${historySourceKey}" returned no results.`);
          }
        } catch (e) {
          logger.error(`[ERROR] History source "${historySourceKey}" failed:`, e);
        }
      }

      // 5. Sequential Load of Remaining Sources
      // We iterate through resources and fetch them one by one (or small batches)
      // skipping the history source if it was already attempted.

      // 5. Batch Parallel Load of Remaining Sources
      const remainingResources = resources.filter(r => r.key !== historySourceKey);
      const BATCH_SIZE = APP_CONFIG.DETAIL.MAX_CONCURRENT_SOURCE_REQUESTS || 3;

      for (let i = 0; i < remainingResources.length; i += BATCH_SIZE) {
        if (signal.aborted) break;
        if (validSourcesCount >= MAX_VALID_SOURCES) break;

        const batch = remainingResources.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (res) => {
          if (signal.aborted || validSourcesCount >= MAX_VALID_SOURCES) return;
          try {
            const { results } = await api.searchVideo(q, res.key, signal);
            if (results.length > 0 && !signal.aborted) {
              addResults(results, res.key);

              // Pre-warm resolution for the primary source (Resume Play priority)
              const snapshot = get();
              if (snapshot.detail && snapshot.detail.episodes) {
                let targetIndex = 0; // Default to first episode

                // Check if we have history for this title
                if (snapshot.resumeRecord) {
                  const match = snapshot.resumeRecord;
                  if (match && match.index > 0 && match.index <= snapshot.detail.episodes.length) {
                    targetIndex = match.index - 1;
                    logger.debug(`[PREWARM] Target identified from history: Episode ${match.index}`);
                  }
                }

                const targetEpisode = snapshot.detail.episodes[targetIndex];
                if (targetEpisode) {
                  void getResolutionWithCache(targetEpisode, signal).catch(() => { });
                }
              }
            }
          } catch (e) {
            logger.warn(`[WARN] Source "${res.key}" failed:`, e);
          }
        }));
      }

      // 6. Finalize
      if (signal.aborted) return;

      const finalState = get();
      if (finalState.loading) {
        // If still loading, it means NO sources were valid
        set({ loading: false, error: "未找到相关资源" });
      } else {
        set({ allSourcesLoaded: true });
        // Update cache
        if (lastCacheKey) {
          setDetailCacheEntry(lastCacheKey, finalState.detail, finalState.searchResults, finalState.sources, true);
        }
      }

    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        logger.error(`[ERROR] DetailStore.init failed:`, e);
        set({ error: `加载失败: ${e instanceof Error ? e.message : "未知错误"}` });
      }
    }
  },

  setDetail: async (detail) => {
    set({ detail });
    const { source, id } = detail;
    const isFavorited = await FavoriteManager.isFavorited(source, id.toString());
    const resumeRecord = await PlayRecordManager.getLatestByTitle(detail.title, detail.year, detail.type);

    set({ isFavorited, resumeRecord });

    if (lastCacheKey) {
      const state = get();
      setDetailCacheEntry(
        lastCacheKey,
        state.detail,
        state.searchResults,
        state.sources,
        state.allSourcesLoaded
      );
    }

  },

  abort: () => {
    get().controller?.abort();
  },

  toggleFavorite: async () => {
    const { detail } = get();
    if (!detail) return;

    const { source, id, title, poster, source_name, episodes, year, desc } = detail;
    const favoriteItem = {
      cover: poster,
      title,
      poster,
      source_name,
      total_episodes: episodes.length,
      search_title: get().q!,
      year: year || "",
      description: desc,
    };

    const newIsFavorited = await FavoriteManager.toggle(source, id.toString(), favoriteItem);
    set({ isFavorited: newIsFavorited });

    if (lastCacheKey) {
      const state = get();
      setDetailCacheEntry(
        lastCacheKey,
        state.detail,
        state.searchResults,
        state.sources,
        state.allSourcesLoaded
      );
    }
  },

  markSourceAsFailed: (source: string, reason: string) => {
    const { failedSources } = get();
    const newFailedSources = new Set(failedSources);
    newFailedSources.add(source);

    logger.warn(`[SOURCE_FAILED] Marking source "${source}" as failed due to: ${reason}`);
    logger.info(`[SOURCE_FAILED] Total failed sources: ${newFailedSources.size}`);

    set({ failedSources: newFailedSources });
  },

  getNextAvailableSource: (currentSource: string, episodeIndex: number) => {
    const { searchResults, failedSources } = get();

    logger.info(`[SOURCE_SELECTION] Looking for alternative to "${currentSource}" for episode ${episodeIndex + 1}`);
    logger.info(`[SOURCE_SELECTION] Failed sources: [${Array.from(failedSources).join(', ')}]`);

    // 过滤掉当前source和已失败的sources
    const availableSources = searchResults.filter(result => {
      // Basic checks
      if (result.source === currentSource) return false;
      if (failedSources.has(result.source)) return false;
      if (!result.episodes || result.episodes.length <= episodeIndex) return false;

      // Strict Metadata Check (if current detail exists)
      // Use normalized comparison to tolerate minor format differences between sources
      // e.g. "2023年" vs "2023", "TV" vs "tv"
      const normalizeYear = (y?: string) => y?.replace(/[年\s]/g, '').trim() ?? '';
      const normalizeType = (t?: string) => t?.toLowerCase().trim() ?? '';

      const currentDetail = get().detail;
      if (currentDetail) {
        const currentYear = normalizeYear(currentDetail.year);
        const resultYear = normalizeYear(result.year);
        if (currentYear && resultYear && currentYear !== resultYear) return false;

        const currentType = normalizeType(currentDetail.type);
        const resultType = normalizeType(result.type);
        if (currentType && resultType && currentType !== resultType) return false;
      }

      return true;
    });

    logger.info(`[SOURCE_SELECTION] Available sources: ${availableSources.length}`);
    availableSources.forEach(source => {
      logger.info(`[SOURCE_SELECTION] - ${source.source} (${source.source_name}): ${source.episodes?.length || 0} episodes`);
    });

    if (availableSources.length === 0) {
      logger.error(`[SOURCE_SELECTION] No available sources for episode ${episodeIndex + 1}`);
      return null;
    }

    // 优先选择有高分辨率的source
    const sortedSources = availableSources.sort((a, b) => {
      const aResolution = a.resolution || '';
      const bResolution = b.resolution || '';

      // 优先级: 1080p > 720p > 其他 > 无分辨率
      const resolutionPriority = (res: string) => {
        if (res.includes('1080')) return 4;
        if (res.includes('720')) return 3;
        if (res.includes('480')) return 2;
        if (res.includes('360')) return 1;
        return 0;
      };

      return resolutionPriority(bResolution) - resolutionPriority(aResolution);
    });

    const selectedSource = sortedSources[0];
    logger.info(`[SOURCE_SELECTION] Selected fallback source: ${selectedSource.source} (${selectedSource.source_name}) with resolution: ${selectedSource.resolution || 'unknown'}`);

    return selectedSource;
  },

  refreshResumeRecord: async () => {
    const { detail } = get();
    if (!detail) return;
    try {
      const record = await PlayRecordManager.getLatestByTitle(detail.title, detail.year, detail.type);
      if (record) {
        set({ resumeRecord: record });
        logger.debug(`[REFRESH] Resume record refreshed for "${detail.title}"`);
      }
    } catch (error) {
      logger.warn("[WARN] Failed to refresh resume record:", error);
    }
  },
}));

export const sourcesSelector = (state: DetailState) => state.sources;
export default useDetailStore;
export const episodesSelectorBySource = (source: string) => (state: DetailState) =>
  state.searchResults.find((r) => r.source === source)?.episodes || [];
