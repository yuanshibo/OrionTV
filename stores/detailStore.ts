import { create } from "zustand";
import { SearchResult, api, isNetworkStatusZeroError, SearchResultWithResolution } from "@/services/api";
import { getResolutionFromM3U8 } from "@/services/m3u8";
import { FavoriteManager } from "@/services/storage";
import Logger from "@/utils/Logger";
import { APP_CONFIG } from "@/constants/AppConfig";

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

const resolutionCache = new Map<string, { value: string | null | undefined; timestamp: number }>();
const resolutionCachePending = new Map<string, Promise<string | null | undefined>>();

const getResolutionWithCache = async (episodeUrl: string, signal?: AbortSignal) => {
  if (!episodeUrl) return undefined;

  const cached = resolutionCache.get(episodeUrl);
  if (cached && Date.now() - cached.timestamp < APP_CONFIG.DETAIL.RESOLUTION_CACHE_TTL) {
    return cached.value;
  }

  const pending = resolutionCachePending.get(episodeUrl);
  if (pending) return pending;

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
  searchResults: SearchResultWithResolution[]; // Kept for compatibility, derived from sourceDetails
  detail: SearchResultWithResolution | null;
  error: string | null;
  controller: AbortController | null;
  isFavorited: boolean;
  failedSources: Set<string>;

  // Progressive loading state
  sourceNames: { key: string; name: string; resolution?: string | null }[];
  sourceDetails: Map<string, SearchResultWithResolution>;
  activeSourceKey: string | null;
  areSourceNamesLoading: boolean;
  isEpisodeListLoading: boolean;

  // Actions
  init: (q: string, preferredSource?: string, id?: string) => Promise<void>;
  loadSourceDetails: (sourceKey: string) => Promise<void>;
  setActiveSource: (sourceKey: string) => Promise<void>;
  abort: () => void;
  toggleFavorite: () => Promise<void>;
  markSourceAsFailed: (source: string, reason: string) => void;
  getNextAvailableSource: (currentSource: string, episodeIndex: number) => SearchResultWithResolution | null;
}

const useDetailStore = create<DetailState>((set, get) => ({
  q: null,
  searchResults: [],
  detail: null,
  error: null,
  controller: null,
  isFavorited: false,
  failedSources: new Set(),

  // Progressive loading state
  sourceNames: [],
  sourceDetails: new Map(),
  activeSourceKey: null,
  areSourceNamesLoading: true,
  isEpisodeListLoading: false,

  init: async (q, preferredSource, id) => {
    logger.debug(`[INIT] Starting detail store for q: ${q}, preferredSource: ${preferredSource}`);

    const { controller: oldController } = get();
    if (oldController) {
      oldController.abort();
    }
    const newController = new AbortController();

    // Reset state for new query
    set({
      q,
      areSourceNamesLoading: true,
      isEpisodeListLoading: false,
      error: null,
      sourceNames: [],
      sourceDetails: new Map(),
      searchResults: [],
      detail: null,
      activeSourceKey: null,
      controller: newController,
      failedSources: new Set(),
      isFavorited: false,
    });

    try {
      const { results } = await api.searchVideos(q, newController.signal);
      if (newController.signal.aborted) return;

      const filteredResults = results.filter(item => item.title === q);
      if (filteredResults.length === 0) {
        throw new Error(`未找到 "${q}" 的播放源，请检查标题拼写或稍后重试`);
      }

      const uniqueSources = new Map<string, { key: string; name: string }>();
      filteredResults.forEach(r => {
        if (!uniqueSources.has(r.source)) {
          uniqueSources.set(r.source, { key: r.source, name: r.source_name.trim() });
        }
      });

      const sourceNames = Array.from(uniqueSources.values());
      set({ sourceNames, areSourceNamesLoading: false });
      logger.debug(`[INIT] Found ${sourceNames.length} sources.`);

      // Determine which source to load details for
      const sourceToLoad = preferredSource && sourceNames.some(s => s.key === preferredSource)
        ? preferredSource
        : sourceNames[0]?.key;

      if (sourceToLoad) {
        logger.debug(`[INIT] Auto-loading details for source: ${sourceToLoad}`);
        await get().loadSourceDetails(sourceToLoad);
      } else {
        logger.warn("[INIT] No sources found to load details from.");
      }

    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        logger.error(`[INIT] Failed to initialize detail store for "${q}":`, e);
        const errorMessage = e instanceof Error ? e.message : "获取数据失败";
        const displayMessage = mapNetworkErrorMessage(e, errorMessage);
        set({ error: displayMessage, areSourceNamesLoading: false });
      } else {
        logger.info(`[INIT] Aborted for "${q}"`);
      }
    }
  },

  loadSourceDetails: async (sourceKey) => {
    const { q, sourceDetails, controller } = get();
    if (!q || sourceDetails.has(sourceKey) || !controller) return;

    logger.debug(`[LOAD_DETAILS] Loading details for source: ${sourceKey}`);
    set({ isEpisodeListLoading: true, activeSourceKey: sourceKey, detail: null });

    try {
      const { results } = await api.searchVideo(q, sourceKey, controller.signal);
      if (controller.signal.aborted) return;

      if (results.length === 0) {
        throw new Error(`源 "${sourceKey}" 未返回有效数据`);
      }

      const detail = results[0];

      // Fetch resolution for the first episode
      let resolution: string | null | undefined = undefined;
      if (detail.episodes && detail.episodes.length > 0) {
        try {
          resolution = await getResolutionWithCache(detail.episodes[0], controller.signal);
        } catch (resError) {
          logger.warn(`[RESOLUTION] Could not fetch resolution for ${sourceKey}:`, resError);
        }
      }
      const detailWithResolution: SearchResultWithResolution = { ...detail, resolution };

      // Update state
      set((state) => {
        const newSourceDetails = new Map(state.sourceDetails);
        newSourceDetails.set(sourceKey, detailWithResolution);

        // Update resolution in sourceNames list for UI
        const newSourceNames = state.sourceNames.map(sn =>
            sn.key === sourceKey ? { ...sn, resolution } : sn
        );

        return {
          sourceDetails: newSourceDetails,
          searchResults: Array.from(newSourceDetails.values()),
          detail: detailWithResolution,
          activeSourceKey: sourceKey,
          isEpisodeListLoading: false,
          sourceNames: newSourceNames,
        };
      });

      // Check favorite status
      const isFavorited = await FavoriteManager.isFavorited(sourceKey, detail.id.toString());
      set({ isFavorited });

    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        logger.error(`[LOAD_DETAILS] Failed to load details for source "${sourceKey}":`, e);
        get().markSourceAsFailed(sourceKey, (e as Error).message);
        set({ isEpisodeListLoading: false, detail: null }); // Clear detail on error
      } else {
        logger.info(`[LOAD_DETAILS] Aborted for source "${sourceKey}"`);
      }
    }
  },

  setActiveSource: async (sourceKey: string) => {
    const { sourceDetails, activeSourceKey } = get();
    if (sourceKey === activeSourceKey) return;

    logger.debug(`[SET_ACTIVE] Setting active source to: ${sourceKey}`);
    if (sourceDetails.has(sourceKey)) {
      const detail = sourceDetails.get(sourceKey)!;
      set({ activeSourceKey: sourceKey, detail });
      const isFavorited = await FavoriteManager.isFavorited(sourceKey, detail.id.toString());
      set({ isFavorited });
    } else {
      await get().loadSourceDetails(sourceKey);
    }
  },

  abort: () => {
    get().controller?.abort();
    set({ areSourceNamesLoading: false, isEpisodeListLoading: false });
  },

  toggleFavorite: async () => {
    const { detail, q } = get();
    if (!detail || !q) return;

    const { source, id, title, poster, source_name, episodes, year, desc } = detail;
    const favoriteItem = {
      cover: poster,
      title,
      poster,
      source_name,
      total_episodes: episodes.length,
      search_title: q,
      year: year || "",
      description: desc,
    };

    const newIsFavorited = await FavoriteManager.toggle(source, id.toString(), favoriteItem);
    set({ isFavorited: newIsFavorited });
  },

  markSourceAsFailed: (source: string, reason: string) => {
    set((state) => ({
      failedSources: new Set(state.failedSources).add(source),
    }));
    logger.warn(`[SOURCE_FAILED] Marking source "${source}" as failed due to: ${reason}`);
  },

  getNextAvailableSource: (currentSource: string, episodeIndex: number) => {
    const { searchResults, failedSources } = get();
    const availableSources = searchResults.filter(result =>
      result.source !== currentSource &&
      !failedSources.has(result.source) &&
      result.episodes &&
      result.episodes.length > episodeIndex
    );

    if (availableSources.length === 0) return null;

    // Simple strategy: return the first available alternative
    return availableSources[0];
  },
}));

export const sourcesSelector = (state: DetailState) =>
  state.sourceNames.map(sn => {
    const detail = state.sourceDetails.get(sn.key);
    return {
      source: sn.key,
      source_name: sn.name,
      resolution: detail?.resolution,
    };
  });

export default useDetailStore;

export const episodesSelectorBySource = (source: string) => (state: DetailState) =>
  state.sourceDetails.get(source)?.episodes || [];
