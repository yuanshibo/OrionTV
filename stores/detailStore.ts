import { create } from "zustand";
import { SearchResult, api } from "@/services/api";
import { getResolutionFromM3U8 } from "@/services/m3u8";
import { useSettingsStore } from "@/stores/settingsStore";
import { FavoriteManager } from "@/services/storage";
import Logger from "@/utils/Logger";

const logger = Logger.withTag('DetailStore');

const MAX_PLAY_SOURCES = 8;
const MAX_CONCURRENT_SOURCE_REQUESTS = 3;

const normalizeIdentifier = (value?: string | null): string => {
  if (!value) {
    return "";
  }

  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\u3000\u00A0\s]+/g, "")
    .replace(/[·•~!@#$%^&*()_+=[\]{}|\\;:'",.<>/?`！￥…（）—【】「」『』、《》？。，、丨-]/g, "");
};

const stripVariantSuffixes = (value: string): string => {
  let result = value;
  let previous: string;

  const variantPatterns = [
    /(?:第?\d{1,3}(?:线|源))$/u,
    /(?:线路?\d{1,3})$/u,
    /(?:line\d{1,3})$/u,
    /(?:主线|多线|备用)$/u,
    /(?:无广|无广告)$/u,
    /(?:超清|高清|蓝光|标清|普清)$/u,
    /(?:\d{3,4}p)$/u,
    /(?:4k|2k|uhd|fhd)$/u,
    /(?:资源|源|source)\d{1,3}$/u,
  ];

  do {
    previous = result;
    for (const pattern of variantPatterns) {
      result = result.replace(pattern, "");
    }
  } while (previous !== result);

  return result;
};

const normalizeSourceName = (sourceName?: string | null): string => {
  if (!sourceName) {
    return "";
  }

  const normalized = normalizeIdentifier(sourceName);
  return stripVariantSuffixes(normalized);
};

const buildResultDedupeKey = (
  item: Pick<SearchResult, "source" | "source_name" | "title" | "id">,
  contextSourceKey?: string
): string => {
  const contextKey = stripVariantSuffixes(normalizeIdentifier(contextSourceKey));
  const sourceKey = stripVariantSuffixes(normalizeIdentifier(item.source));
  const nameKey = normalizeSourceName(item.source_name);

  if (contextKey) {
    return contextKey;
  }

  if (sourceKey) {
    return sourceKey;
  }

  if (nameKey) {
    return nameKey;
  }

  const titleKey = normalizeIdentifier(item.title);
  return titleKey ? `${titleKey}:${item.id}` : `${item.id}`;
};

const labelPriority = (sourceName?: string | null): number => {
  if (!sourceName) {
    return 0;
  }

  const normalized = sourceName.trim().toLowerCase();
  let score = 0;

  if (normalized.includes("无广") || normalized.includes("无广告")) {
    score += 4;
  }
  if (normalized.includes("蓝光")) {
    score += 3;
  }
  if (normalized.includes("超清")) {
    score += 2;
  }
  if (normalized.includes("高清")) {
    score += 1;
  }
  if (normalized.includes("备用")) {
    score -= 3;
  }
  if (normalized.includes("线路") || normalized.includes("line")) {
    score -= 2;
  }
  if (normalized.includes("主线")) {
    score -= 1;
  }

  return score;
};

const resolutionPriority = (resolution?: string | null): number => {
  if (!resolution) {
    return 0;
  }

  const normalized = resolution.toLowerCase();

  if (/(4k|2160)/.test(normalized)) {
    return 6;
  }
  if (/(2k|1440)/.test(normalized)) {
    return 5;
  }

  const match = normalized.match(/(\d{3,4})p/);
  if (match) {
    const value = Number(match[1]);
    if (value >= 2160) {
      return 6;
    }
    if (value >= 1440) {
      return 5;
    }
    if (value >= 1080) {
      return 4;
    }
    if (value >= 720) {
      return 3;
    }
    if (value >= 540) {
      return 2;
    }
    if (value >= 480) {
      return 1;
    }
  }

  if (normalized.includes("蓝光")) {
    return 4;
  }
  if (normalized.includes("超清")) {
    return 3;
  }
  if (normalized.includes("高清")) {
    return 2;
  }
  if (normalized.includes("标清")) {
    return 1;
  }

  return 0;
};

const shouldPreferRawResult = (current: SearchResult, candidate: SearchResult): boolean => {
  const currentEpisodes = current.episodes?.length ?? 0;
  const candidateEpisodes = candidate.episodes?.length ?? 0;

  if (candidateEpisodes > currentEpisodes) {
    return true;
  }

  if (candidateEpisodes < currentEpisodes) {
    return false;
  }

  const currentLabelScore = labelPriority(current.source_name);
  const candidateLabelScore = labelPriority(candidate.source_name);

  if (candidateLabelScore > currentLabelScore) {
    return true;
  }

  if (candidateLabelScore < currentLabelScore) {
    return false;
  }

  const currentNameLength = current.source_name?.trim().length ?? 0;
  const candidateNameLength = candidate.source_name?.trim().length ?? 0;

  if (candidateNameLength && (!currentNameLength || candidateNameLength < currentNameLength)) {
    return true;
  }

  return false;
};

export type SearchResultWithResolution = SearchResult & {
  resolution?: string | null;
  dedupeKey: string;
  normalizedSourceName: string;
};

const shouldPreferEnrichedResult = (
  current: SearchResultWithResolution,
  candidate: SearchResultWithResolution
): boolean => {
  const currentEpisodes = current.episodes?.length ?? 0;
  const candidateEpisodes = candidate.episodes?.length ?? 0;

  if (candidateEpisodes > currentEpisodes) {
    return true;
  }

  if (candidateEpisodes < currentEpisodes) {
    return false;
  }

  const currentResolutionScore = resolutionPriority(current.resolution);
  const candidateResolutionScore = resolutionPriority(candidate.resolution);

  if (candidateResolutionScore > currentResolutionScore) {
    return true;
  }

  if (candidateResolutionScore < currentResolutionScore) {
    return false;
  }

  const currentLabelScore = labelPriority(current.source_name);
  const candidateLabelScore = labelPriority(candidate.source_name);

  if (candidateLabelScore > currentLabelScore) {
    return true;
  }

  if (candidateLabelScore < currentLabelScore) {
    return false;
  }

  return false;
};

const mergeResultsByDedupeKey = (
  items: SearchResultWithResolution[]
): SearchResultWithResolution[] => {
  const merged = new Map<string, SearchResultWithResolution>();

  for (const item of items) {
    const key = item.dedupeKey || buildResultDedupeKey(item);
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, item);
      continue;
    }

    if (shouldPreferEnrichedResult(existing, item)) {
      merged.set(key, item);
    }
  }

  return Array.from(merged.values());
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
    logger.info(`[PERF] DetailStore.init START - q: ${q}, preferredSource: ${preferredSource}, id: ${id}`);
    
    const { controller: oldController } = get();
    if (oldController) {
      oldController.abort();
    }
    const newController = new AbortController();
    const signal = newController.signal;

    set({
      q,
      loading: true,
      searchResults: [],
      detail: null,
      error: null,
      allSourcesLoaded: false,
      controller: newController,
    });

    const { videoSource } = useSettingsStore.getState();

    const processAndSetResults = async (
      results: SearchResult[],
      mergeOrOptions: boolean | { merge?: boolean; sourceKey?: string } = {}
    ): Promise<number> => {
      const options = typeof mergeOrOptions === "boolean" ? { merge: mergeOrOptions } : mergeOrOptions;
      const { merge = false, sourceKey } = options;
      const snapshot = get();
      const existingResults = snapshot.searchResults;
      const existingKeys = new Set(
        existingResults.map((item) => item.dedupeKey || buildResultDedupeKey(item))
      );
      const remainingCapacity = merge
        ? Math.max(0, MAX_PLAY_SOURCES - existingResults.length)
        : MAX_PLAY_SOURCES;

      if (results.length === 0) {
        if (merge && snapshot.searchResults.length >= MAX_PLAY_SOURCES) {
          set({ allSourcesLoaded: true });
        }
        logger.info(`[INFO] No new valid results to process from batch (merge: ${merge})`);
        return 0;
      }

      interface CandidateEntry {
        result: SearchResult;
        normalizedSourceName: string;
        firstSeen: number;
        isReplacement: boolean;
      }

      const candidateMap = new Map<string, CandidateEntry>();

      results.forEach((result, index) => {
        if (!result.episodes || result.episodes.length === 0) {
          return;
        }

        const dedupeKey = buildResultDedupeKey(result, sourceKey);
        const normalizedSourceName = normalizeSourceName(result.source_name);
        const isReplacement = existingKeys.has(dedupeKey);
        const currentEntry = candidateMap.get(dedupeKey);

        if (!currentEntry) {
          candidateMap.set(dedupeKey, {
            result,
            normalizedSourceName,
            firstSeen: index,
            isReplacement,
          });
          return;
        }

        const nextIsReplacement = currentEntry.isReplacement || isReplacement;
        if (shouldPreferRawResult(currentEntry.result, result)) {
          candidateMap.set(dedupeKey, {
            result,
            normalizedSourceName,
            firstSeen: currentEntry.firstSeen,
            isReplacement: nextIsReplacement,
          });
        } else if (nextIsReplacement && !currentEntry.isReplacement) {
          candidateMap.set(dedupeKey, { ...currentEntry, isReplacement: true });
        }
      });

      let candidateEntries = Array.from(candidateMap.entries()).map(([dedupeKey, value]) => ({
        dedupeKey,
        ...value,
      }));

      const replacements = candidateEntries.filter((entry) => entry.isReplacement);
      let newCandidates = candidateEntries.filter((entry) => !entry.isReplacement);

      newCandidates = newCandidates.sort((a, b) => a.firstSeen - b.firstSeen);

      if (merge) {
        newCandidates = newCandidates.slice(0, remainingCapacity);
      } else {
        newCandidates = newCandidates.slice(0, MAX_PLAY_SOURCES);
      }

      if (newCandidates.length === 0 && replacements.length === 0) {
        if (merge && snapshot.searchResults.length >= MAX_PLAY_SOURCES) {
          set({ allSourcesLoaded: true });
        }
        logger.info(`[INFO] No new valid results to process from batch (merge: ${merge})`);
        return 0;
      }

      const combinedCandidates = [...newCandidates, ...replacements].sort(
        (a, b) => a.firstSeen - b.firstSeen
      );

      const resolutionStart = performance.now();
      logger.info(
        `[PERF] Resolution detection START - processing ${combinedCandidates.length} sources (merge: ${merge})`
      );

      const resultsWithResolution = await Promise.all(
        combinedCandidates.map(async ({ result, dedupeKey, normalizedSourceName }) => {
          let resolution: string | null | undefined;
          const m3u8Start = performance.now();
          try {
            if (result.episodes && result.episodes.length > 0) {
              resolution = await getResolutionFromM3U8(result.episodes[0], signal);
            }
          } catch (e) {
            if ((e as Error).name !== "AbortError") {
              logger.info(`Failed to get resolution for ${result.source_name}`, e);
            }
          }
          const m3u8End = performance.now();
          logger.info(
            `[PERF] M3U8 resolution for ${result.source_name}: ${(m3u8End - m3u8Start).toFixed(2)}ms (${resolution || "failed"})`
          );
          return {
            ...result,
            source_name: result.source_name.trim(),
            resolution,
            dedupeKey,
            normalizedSourceName,
          };
        })
      );

      const resolutionEnd = performance.now();
      logger.info(`[PERF] Resolution detection COMPLETE - took ${(resolutionEnd - resolutionStart).toFixed(2)}ms`);

      if (signal.aborted) {
        return 0;
      }

      let addedKeys: string[] = [];
      let updatedKeys: string[] = [];

      set((state) => {
        const previousResults = merge ? state.searchResults : [];
        const baseResults = merge ? state.searchResults : [];
        const combined = merge
          ? [...baseResults, ...resultsWithResolution]
          : [...resultsWithResolution];
        const mergedResults = mergeResultsByDedupeKey(combined);
        const truncated = mergedResults.slice(0, MAX_PLAY_SOURCES);

        const previousMap = new Map(
          previousResults.map((item) => [item.dedupeKey || buildResultDedupeKey(item), item])
        );
        addedKeys = [];
        updatedKeys = [];

        for (const item of truncated) {
          const key = item.dedupeKey || buildResultDedupeKey(item);
          const prev = previousMap.get(key);
          if (!prev) {
            addedKeys.push(key);
          } else if (
            prev.episodes.length !== item.episodes.length ||
            prev.resolution !== item.resolution ||
            prev.source_name !== item.source_name
          ) {
            updatedKeys.push(key);
          }
        }

        const reachedMax = truncated.length >= MAX_PLAY_SOURCES;

        const nextDetail =
          state.detail &&
          truncated.some(
            (item) => item.source === state.detail?.source && item.id === state.detail?.id
          )
            ? state.detail
            : truncated[0] ?? null;

        return {
          searchResults: truncated,
          sources: truncated.map((r) => ({
            source: r.source,
            source_name: r.source_name.trim(),
            resolution: r.resolution,
          })),
          detail: nextDetail,
          ...(reachedMax ? { allSourcesLoaded: true } : {}),
        };
      });

      const totalAfterUpdate = get().searchResults.length;

      if (addedKeys.length > 0) {
        logger.info(
          `[INFO] Added ${addedKeys.length} new sources (merge: ${merge}). Total cached sources: ${totalAfterUpdate}`
        );
      }

      if (updatedKeys.length > 0) {
        logger.info(
          `[INFO] Updated ${updatedKeys.length} existing source(s) with fresher data (merge: ${merge}).`
        );
      }

      return addedKeys.length;
    };

    try {
      // Optimization for favorite navigation
      if (preferredSource && id) {
        const searchPreferredStart = performance.now();
        logger.info(`[PERF] API searchVideo (preferred) START - source: ${preferredSource}, query: "${q}"`);
        
        let preferredResult: SearchResult[] = [];
        let preferredSearchError: any = null;
        
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
        let preferredAddedCount = 0;
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
            logger.error(`[ERROR] FALLBACK search FAILED:`, fallbackError);
            set({
              error: `搜索失败：${fallbackError instanceof Error ? fallbackError.message : "网络错误，请稍后重试"}`,
              loading: false,
            });
          }
        }

        // 后台搜索（如果preferred source成功的话）
        if (!shouldFallback) {
          const searchAllStart = performance.now();
          logger.info(`[PERF] API searchVideos (background) START`);

          try {
            const { results: allResults } = await api.searchVideos(q);

            const searchAllEnd = performance.now();
            logger.info(`[PERF] API searchVideos (background) END - took ${(searchAllEnd - searchAllStart).toFixed(2)}ms, results: ${allResults.length}`);

            if (signal.aborted) return;
            await processAndSetResults(allResults.filter((item) => item.title === q), { merge: true });
          } catch (backgroundError) {
            logger.warn(`[WARN] Background search failed, but preferred source already succeeded:`, backgroundError);
          }
        }
      } else {
        // Standard navigation: fetch resources, then fetch details one by one
        const resourcesStart = performance.now();
        logger.info(`[PERF] API getResources START - query: "${q}"`);
        
        try {
          const allResources = await api.getResources(signal);
          
          const resourcesEnd = performance.now();
          logger.info(`[PERF] API getResources END - took ${(resourcesEnd - resourcesStart).toFixed(2)}ms, resources: ${allResources.length}`);
          
          const enabledResources = videoSource.enabledAll
            ? allResources
            : allResources.filter((r) => videoSource.sources[r.key]);

          logger.info(`[PERF] Enabled resources: ${enabledResources.length}/${allResources.length}`);
          
          if (enabledResources.length === 0) {
            logger.error(`[ERROR] No enabled resources available for search`);
            set({ 
              error: "没有可用的视频源，请检查设置或联系管理员",
              loading: false 
            });
            return;
          }

          let firstResultFound = false;
          let totalResults = 0;
          let resourceIndex = 0;

          const runResource = async (resource: (typeof enabledResources)[number]) => {
            if (signal.aborted) {
              logger.info(`[INFO] Search aborted before requesting ${resource.name}`);
              return;
            }

            if (get().searchResults.length >= MAX_PLAY_SOURCES) {
              logger.info(
                `[LIMIT] Max play sources (${MAX_PLAY_SOURCES}) reached before requesting ${resource.name}, skipping request`
              );
              return;
            }

            try {
              const searchStart = performance.now();
              const { results } = await api.searchVideo(q, resource.key, signal);
              const searchEnd = performance.now();
              logger.info(
                `[PERF] API searchVideo (${resource.name}) took ${(searchEnd - searchStart).toFixed(2)}ms, results: ${results.length}`
              );

              if (signal.aborted) {
                logger.info(`[INFO] Search aborted after fetching ${resource.name}`);
                return;
              }

              const validResults = results.filter((item) => item.episodes && item.episodes.length > 0);

              if (validResults.length > 0) {
                logger.info(
                  `[SUCCESS] Source "${resource.name}" found ${validResults.length} valid results for "${q}"`
                );

                if (get().searchResults.length >= MAX_PLAY_SOURCES) {
                  logger.info(
                    `[LIMIT] Max play sources (${MAX_PLAY_SOURCES}) reached before processing ${resource.name}, skipping`
                  );
                  return;
                }

                const added = await processAndSetResults(validResults, {
                  merge: true,
                  sourceKey: resource.key,
                });

                if (added > 0) {
                  totalResults += added;
                  logger.info(
                    `[SUCCESS] Source "${resource.name}" added ${added} result(s). Total cached sources: ${get().searchResults.length}`
                  );
                  if (!firstResultFound) {
                    set({ loading: false });
                    firstResultFound = true;
                    logger.info(
                      `[SUCCESS] First result found from "${resource.name}", stopping loading indicator`
                    );
                  }
                } else {
                  logger.info(
                    `[INFO] Source "${resource.name}" produced results but none were added (duplicates or limit reached)`
                  );
                }
              } else {
                logger.warn(`[WARN] Source "${resource.name}" returned 0 valid results for "${q}"`);
              }
            } catch (error) {
              if ((error as Error)?.name === "AbortError") {
                logger.info(`[INFO] searchVideo request for ${resource.name} aborted`);
                return;
              }
              logger.error(`[ERROR] Failed to fetch from ${resource.name}:`, error);
            }
          };

          const workerCount = Math.min(MAX_CONCURRENT_SOURCE_REQUESTS, enabledResources.length);
          const workers = Array.from({ length: workerCount }, async (_, workerIndex) => {
            while (true) {
              if (signal.aborted) {
                logger.info(`[INFO] Aborting worker ${workerIndex} due to signal abort`);
                return;
              }

              if (get().searchResults.length >= MAX_PLAY_SOURCES) {
                logger.info(
                  `[LIMIT] Worker ${workerIndex} exiting after reaching max play sources (${MAX_PLAY_SOURCES})`
                );
                return;
              }

              const currentIndex = resourceIndex++;
              if (currentIndex >= enabledResources.length) {
                return;
              }

              const resource = enabledResources[currentIndex];
              await runResource(resource);
            }
          });

          await Promise.all(workers);

          // 检查是否找到任何结果
          if (totalResults === 0) {
            logger.error(`[ERROR] All sources returned 0 results for "${q}"`);
            set({
              error: `未找到 "${q}" 的播放源，请尝试其他关键词或稍后重试`,
              loading: false 
            });
          } else {
            logger.info(
              `[SUCCESS] Standard search completed, cached ${get().searchResults.length} unique sources (added ${totalResults})`
            );
          }
        } catch (resourceError) {
          logger.error(`[ERROR] Failed to get resources:`, resourceError);
          set({ 
            error: `获取视频源失败：${resourceError instanceof Error ? resourceError.message : '网络错误，请稍后重试'}`,
            loading: false 
          });
          return;
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
        set({ error: `搜索失败：${errorMessage}` });
      } else {
        logger.info(`[INFO] DetailStore.init aborted by user`);
      }
    } finally {
      if (!signal.aborted) {
        set({ loading: false, allSourcesLoaded: true });
        logger.info(`[INFO] DetailStore.init cleanup completed`);
      }
      
      const perfEnd = performance.now();
      logger.info(`[PERF] DetailStore.init COMPLETE - total time: ${(perfEnd - perfStart).toFixed(2)}ms`);
    }
  },

  setDetail: async (detail) => {
    set({ detail });
    const { source, id } = detail;
    const isFavorited = await FavoriteManager.isFavorited(source, id.toString());
    set({ isFavorited });
  },

  abort: () => {
    get().controller?.abort();
  },

  toggleFavorite: async () => {
    const { detail } = get();
    if (!detail) return;

    const { source, id, title, poster, source_name, episodes, year } = detail;
    const favoriteItem = {
      cover: poster,
      title,
      poster,
      source_name,
      total_episodes: episodes.length,
      search_title: get().q!,
      year: year || "",
    };

    const newIsFavorited = await FavoriteManager.toggle(source, id.toString(), favoriteItem);
    set({ isFavorited: newIsFavorited });
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
