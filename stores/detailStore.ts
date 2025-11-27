import { create } from "zustand";
import { SearchResult, api, isNetworkStatusZeroError, SearchResultWithResolution } from "@/services/api";
import { getResolutionFromM3U8 } from "@/services/m3u8";
import { useSettingsStore } from "@/stores/settingsStore";
import { FavoriteManager } from "@/services/storage";
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

  init: (q: string, preferredSource?: string, id?: string) => Promise<void>;
  setDetail: (detail: SearchResultWithResolution) => Promise<void>;
  abort: () => void;
  toggleFavorite: () => Promise<void>;
  markSourceAsFailed: (source: string, reason: string) => void;
  getNextAvailableSource: (currentSource: string, episodeIndex: number) => SearchResultWithResolution | null;
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

  init: async (q, preferredSource, id) => {
    const perfStart = performance.now();
    logger.debug(`[PERF] DetailStore.init START - q: ${q}, preferredSource: ${preferredSource}, id: ${id}`);

    const { controller: oldController } = get();
    if (oldController) {
      oldController.abort();
    }
    const newController = new AbortController();
    const signal = newController.signal;

    const cacheKey = buildDetailCacheKey(q, preferredSource, id);
    lastCacheKey = cacheKey;
    const cachedEntry = getDetailCacheEntry(cacheKey);
    const cachedSearchResults = cachedEntry ? cachedEntry.searchResults.map((item) => ({ ...item })) : [];
    const cachedDetail = cachedEntry?.detail ? { ...cachedEntry.detail } : null;
    const cachedSources = cachedEntry ? cachedEntry.sources.map((item) => ({ ...item })) : [];
    const cachedAllSourcesLoaded = cachedEntry?.allSourcesLoaded ?? false;

    // 如果有有效缓存,直接使用缓存数据
    const hasValidCache = cachedEntry && cachedDetail && cachedSearchResults.length > 0;
    logger.debug(`[CACHE] Cache status for "${q}": ${hasValidCache ? 'VALID' : 'MISS'}`);

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
    });

    if (hasValidCache) {
      logger.debug(`[CACHE] Using cached data for "${q}", skipping fetch`);
      try {
        const isFavFromCache = await FavoriteManager.isFavorited(
          cachedDetail.source,
          cachedDetail.id.toString()
        );
        set({ isFavorited: isFavFromCache });
      } catch (favoriteError) {
        logger.warn("[WARN] Failed to restore favorite status from cache:", favoriteError);
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
      if (playRecords) {
        const records = Object.values(playRecords || {});
        const match = records.find(r => r.title === q);
        if (match) {
          const res = resources.find(r => r.name === match.source_name);
          if (res) historySourceKey = res.key;
        }
      }

      let validSourcesCount = 0;
      const MAX_VALID_SOURCES = 8;
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

      const remainingResources = resources.filter(r => r.key !== historySourceKey);

      // We can use a loop to fetch sequentially
      for (const res of remainingResources) {
        if (signal.aborted) break;
        if (validSourcesCount >= MAX_VALID_SOURCES) {
          logger.info(`[INFO] Reached limit of ${MAX_VALID_SOURCES} valid sources. Stopping.`);
          break;
        }

        try {
          // Fetch one by one to strictly control the order and limit
          // We could parallelize slightly (e.g. 2 at a time) if speed is too slow,
          // but user requested "sequential" and "limit 8", so strict sequential is safest for logic.
          const { results } = await api.searchVideo(q, res.key, signal);
          if (signal.aborted) break;

          if (results.length > 0) {
            addResults(results, res.key);
          }
        } catch (e) {
          logger.warn(`[WARN] Source "${res.key}" failed:`, e);
        }
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
    set({ isFavorited });

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
    const availableSources = searchResults.filter(result =>
      result.source !== currentSource &&
      !failedSources.has(result.source) &&
      result.episodes &&
      result.episodes.length > episodeIndex
    );

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
}));

export const sourcesSelector = (state: DetailState) => state.sources;
export default useDetailStore;
export const episodesSelectorBySource = (source: string) => (state: DetailState) =>
  state.searchResults.find((r) => r.source === source)?.episodes || [];
