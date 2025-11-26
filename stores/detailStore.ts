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

    let backgroundPromise: Promise<void> | null = null;
    let hasFinalized = false;

    const finalizeInitialization = async (reason: string) => {
      if (signal.aborted) {
        logger.debug(`[INFO] Skipping finalize for "${q}" due to abort (${reason})`);
        return;
      }

      const favoriteCheckStart = performance.now();
      const finalStateSnapshot = get();

      if (finalStateSnapshot.searchResults.length === 0 && !finalStateSnapshot.error) {
        logger.error(`[ERROR] All search attempts completed but no results found for "${q}"`);
        set({ error: `未找到 "${q}" 的播放源，请检查标题拼写或稍后重试` });
      } else if (finalStateSnapshot.searchResults.length > 0) {
        logger.debug(
          `[SUCCESS] DetailStore.init completed successfully with ${finalStateSnapshot.searchResults.length} sources`
        );
      }

      if (finalStateSnapshot.detail) {
        const { source, id } = finalStateSnapshot.detail;
        logger.debug(`[INFO] Checking favorite status for source: ${source}, id: ${id}`);
        try {
          const isFavorited = await FavoriteManager.isFavorited(source, id.toString());
          set({ isFavorited });
          logger.debug(`[INFO] Favorite status: ${isFavorited}`);
        } catch (favoriteError) {
          logger.warn(`[WARN] Failed to check favorite status:`, favoriteError);
        }
      } else {
        logger.warn(`[WARN] No detail found after all search attempts for "${q}"`);
      }

      const favoriteCheckEnd = performance.now();
      logger.debug(`[PERF] Favorite check took ${(favoriteCheckEnd - favoriteCheckStart).toFixed(2)}ms`);

      set({ loading: false, allSourcesLoaded: true });

      const persistedState = get();
      setDetailCacheEntry(
        cacheKey,
        persistedState.detail,
        persistedState.searchResults,
        persistedState.sources,
        persistedState.allSourcesLoaded
      );

      logger.debug(`[INFO] DetailStore.init cleanup completed (${reason})`);
    };

    const runFinalizeOnce = (reason: string) => {
      if (hasFinalized) {
        return null;
      }
      hasFinalized = true;
      return finalizeInitialization(reason);
    };

    // 如果有有效缓存,直接使用缓存数据,不需要加载状态
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

    // 如果有有效缓存且不是 abort 的结果,直接返回
    try {
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

        const perfEnd = performance.now();
        logger.debug(`[PERF] DetailStore.init COMPLETE (from cache) - total time: ${(perfEnd - perfStart).toFixed(2)}ms`);
        const { videoSource } = useSettingsStore.getState();
      }

      const { videoSource } = useSettingsStore.getState();

      const processAndSetResults = async (
        results: SearchResult[],
        mergeOrOptions: boolean | { merge?: boolean; sourceKey?: string } = {}
      ): Promise<number> => {
        const options = typeof mergeOrOptions === "boolean" ? { merge: mergeOrOptions } : mergeOrOptions;
        const { merge = false, sourceKey } = options;

        if (signal.aborted) {
          logger.debug(`[ABORT] processAndSetResults aborted before processing`);
          return 0;
        }

        const snapshot = get();
        const { results: newSearchResults, added, updated, reachedMax } = processNewResults(
          snapshot.searchResults,
          results,
          merge,
          sourceKey
        );

        let itemsToResolve: SearchResultWithResolution[] = [];

        set((state) => {
          itemsToResolve = newSearchResults;

          const nextDetail =
            state.detail &&
              newSearchResults.some(
                (item) => item.source === state.detail?.source && item.id === state.detail?.id
              )
              ? state.detail
              : newSearchResults[0] ?? null;

          return {
            searchResults: newSearchResults,
            sources: newSearchResults.map((r) => ({
              source: r.source,
              source_name: r.source_name.trim(),
              resolution: r.resolution,
            })),
            detail: nextDetail,
            ...(reachedMax ? { allSourcesLoaded: true } : {}),
          };
        });

        if (added.length === 0 && updated.length === 0) {
          return 0;
        }

        const candidates = itemsToResolve.filter(r => !r.resolution && r.episodes && r.episodes.length > 0);

        if (candidates.length > 0) {
          const resolutionStart = performance.now();
          Promise.all(
            candidates.map(async (item) => {
              let resolution: string | null | undefined;
              try {
                resolution = await getResolutionWithCache(item.episodes[0], signal);
              } catch (e) {
                // ignore
              }
              return { ...item, resolution };
            })
          ).then((resolvedItems) => {
            if (signal.aborted) return;

            set((state) => {
              const newSearchResults = state.searchResults.map(existing => {
                const resolved = resolvedItems.find(r =>
                  r.source === existing.source && r.id === existing.id
                );
                if (resolved && resolved.resolution) {
                  return { ...existing, resolution: resolved.resolution };
                }
                return existing;
              });

              return {
                searchResults: newSearchResults,
                sources: newSearchResults.map((r) => ({
                  source: r.source,
                  source_name: r.source_name.trim(),
                  resolution: r.resolution,
                })),
              };
            });

            const currentState = get();
            if (lastCacheKey) {
              setDetailCacheEntry(
                lastCacheKey,
                currentState.detail,
                currentState.searchResults,
                currentState.sources,
                currentState.allSourcesLoaded
              );
            }

            const resolutionEnd = performance.now();
            logger.debug(`[PERF] Resolution detection COMPLETE - took ${(resolutionEnd - resolutionStart).toFixed(2)}ms`);
          });
        }

        const addedCount = added.length;
        const totalAfterUpdate = get().searchResults.length;

        if (addedCount > 0) {
          logger.info(
            `[INFO] Added ${addedCount} new sources (merge: ${merge}). Total cached sources: ${totalAfterUpdate}`
          );
        }

        return addedCount;
      };

      if (!hasValidCache) {
        let preferredResult: SearchResult[] = [];
        let preferredSearchError: any = null;
        let preferredAddedCount = 0;

        if (preferredSource) {
          const searchPreferredStart = performance.now();
          logger.info(`[PERF] API searchVideo (preferred) START - source: ${preferredSource}, query: "${q}"`);

          try {
            const response = await api.searchVideo(q, preferredSource, signal);
            preferredResult = response.results;
          } catch (error) {
            preferredSearchError = error;
            logger.error(`[ERROR] API searchVideo (preferred) FAILED - source: ${preferredSource}, error:`, error);
          }

          const searchPreferredEnd = performance.now();
          logger.info(`[PERF] API searchVideo (preferred) END - took ${(searchPreferredEnd - searchPreferredStart).toFixed(2)}ms, results: ${preferredResult.length}, error: ${!!preferredSearchError}`);

          if (signal.aborted) return;

          // 检查preferred source结果
          if (preferredResult.length > 0) {
            logger.info(
              `[SUCCESS] Preferred source "${preferredSource}" found ${preferredResult.length} results for "${q}"`
            );
            preferredAddedCount = await processAndSetResults(preferredResult, {
              merge: false,
              sourceKey: preferredSource,
            });

            if (preferredAddedCount > 0) {
              set({ loading: false });
            } else {
              logger.warn(
                `[FALLBACK] Preferred source "${preferredSource}" returned results but none were usable, trying all sources immediately`
              );
            }
          }
        }

        const shouldFallback = preferredAddedCount <= 0;

        if (shouldFallback) {
          // 降级策略：preferred source失败时立即尝试所有源
          if (preferredResult.length === 0) {
            if (preferredSearchError) {
              logger.warn(
                `[FALLBACK] Preferred source "${preferredSource}" failed with error, trying all sources immediately`
              );
            } else {
              logger.warn(
                `[FALLBACK] Preferred source "${preferredSource}" returned 0 results for "${q}", trying all sources immediately`
              );
            }
          }

          // 立即尝试所有源，不再依赖后台搜索
          const fallbackStart = performance.now();
          logger.info(`[PERF] FALLBACK search (all sources) START - query: "${q}"`);

          try {
            const { results: allResults } = await api.searchVideos(q);
            const fallbackEnd = performance.now();
            logger.info(
              `[PERF] FALLBACK search END - took ${(fallbackEnd - fallbackStart).toFixed(2)}ms, total results: ${allResults.length}`
            );

            const filteredResults = allResults.filter((item) => item.title === q);
            logger.info(`[FALLBACK] Filtered results: ${filteredResults.length} matches for "${q}"`);

            if (filteredResults.length > 0) {
              logger.info(`[SUCCESS] FALLBACK search found results, proceeding with ${filteredResults[0].source_name}`);
              const addedFromFallback = await processAndSetResults(filteredResults, { merge: false });
              if (addedFromFallback > 0) {
                set({ loading: false });
              } else {
                logger.error(
                  `[ERROR] FALLBACK search returned results but none were usable for "${q}"`
                );
                set({
                  error: `未找到 "${q}" 的播放源，请检查标题或稍后重试`,
                  loading: false,
                });
              }
            } else {
              logger.error(`[ERROR] FALLBACK search found no matching results for "${q}"`);
              set({
                error: `未找到 "${q}" 的播放源，请检查标题或稍后重试`,
                loading: false,
              });
            }
          } catch (fallbackError) {
            if ((fallbackError as Error)?.name === "AbortError") {
              logger.info(`[INFO] FALLBACK search aborted`);
              return;
            }
            logger.error(`[ERROR] FALLBACK search FAILED:`, fallbackError);
            set({
              error: `搜索失败：${fallbackError instanceof Error ? fallbackError.message : "网络错误，请稍后重试"}`,
              loading: false,
            });
          }
        }

        // 后台搜索（如果preferred source成功的话）
        if (!shouldFallback) {
          backgroundPromise = (async () => {
            const searchAllStart = performance.now();
            logger.info(`[PERF] API searchVideos (background) START`);

            try {
              const { results: allResults } = await api.searchVideos(q);

              const searchAllEnd = performance.now();
              logger.info(
                `[PERF] API searchVideos (background) END - took ${(searchAllEnd - searchAllStart).toFixed(2)}ms, results: ${allResults.length}`
              );

              if (signal.aborted) {
                logger.info(`[INFO] Background search aborted before processing results`);
                return;
              }

              await processAndSetResults(allResults.filter((item) => item.title === q), { merge: true });
            } catch (backgroundError) {
              if (backgroundError instanceof Error && backgroundError.name === "AbortError") {
                logger.info(`[INFO] Background search aborted`);
                return;
              }
              logger.warn(`[WARN] Background search failed, but preferred source already succeeded:`, backgroundError);
            }
          })();

          logger.info(`[INFO] Preferred source ready; background enrichment scheduled asynchronously`);
        }
      }

      const favoriteCheckStart = performance.now();
      const finalState = get();

      // 最终检查：如果所有搜索都完成但仍然没有结果
      if (finalState.searchResults.length === 0 && !finalState.error) {
        logger.error(`[ERROR] All search attempts completed but no results found for "${q}"`);
        set({ error: `未找到 "${q}" 的播放源，请检查标题拼写或稍后重试` });
      } else if (finalState.searchResults.length > 0) {
        logger.info(`[SUCCESS] DetailStore.init completed successfully with ${finalState.searchResults.length} sources`);
      }

      if (finalState.detail) {
        const { source, id } = finalState.detail;
        logger.info(`[INFO] Checking favorite status for source: ${source}, id: ${id}`);
        try {
          const isFavorited = await FavoriteManager.isFavorited(source, id.toString());
          set({ isFavorited });
          logger.info(`[INFO] Favorite status: ${isFavorited}`);
        } catch (favoriteError) {
          logger.warn(`[WARN] Failed to check favorite status:`, favoriteError);
        }
      } else {
        logger.warn(`[WARN] No detail found after all search attempts for "${q}"`);
      }

      const favoriteCheckEnd = performance.now();
      logger.info(`[PERF] Favorite check took ${(favoriteCheckEnd - favoriteCheckStart).toFixed(2)}ms`);

    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        logger.error(`[ERROR] DetailStore.init caught unexpected error:`, e);
        const errorMessage = e instanceof Error ? e.message : "获取数据失败";
        const displayMessage = mapNetworkErrorMessage(e, errorMessage);
        set({ error: `搜索失败：${displayMessage}` });
      } else {
        logger.info(`[INFO] DetailStore.init aborted by user`);
      }
    } finally {
      const logCompletion = (label: string) => {
        const perfEnd = performance.now();
        logger.info(
          `[PERF] DetailStore.init COMPLETE (${label}) - total time: ${(perfEnd - perfStart).toFixed(2)}ms`
        );
      };

      const finalizeAndLog = (label: string) => {
        const result = runFinalizeOnce(label);
        if (result) {
          result.finally(() => logCompletion(label));
        } else {
          logCompletion(label);
        }
      };

      if (backgroundPromise) {
        backgroundPromise
          .catch((error) => {
            if (error instanceof Error && error.name === "AbortError") {
              logger.info(`[INFO] Background search promise aborted before completion`);
            } else if (error) {
              logger.warn(`[WARN] Background search promise rejected:`, error);
            }
          })
          .finally(() => finalizeAndLog("async"));
      } else {
        finalizeAndLog("sync");
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
