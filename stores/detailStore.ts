import { create } from "zustand";
import { SearchResult, api } from "@/services/api";
import { getResolutionFromM3U8 } from "@/services/m3u8";
import { useSettingsStore } from "@/stores/settingsStore";

export type SearchResultWithResolution = SearchResult & { resolution?: string | null };

interface DetailState {
  q: string | null;
  searchResults: SearchResultWithResolution[];
  sources: { source: string; source_name: string; resolution: string | null | undefined }[];
  detail: SearchResultWithResolution | null;
  loading: boolean;
  error: string | null;
  allSourcesLoaded: boolean;
  controller: AbortController | null

  init: (q: string) => void;
  setDetail: (detail: SearchResultWithResolution) => void;
  abort: () => void;
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

  init: async (q) => {
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

    try {
      const processAndSetResults = async (
        results: SearchResult[]
      ) => {
        const resultsWithResolution = await Promise.all(
          results.map(async (searchResult) => {
            let resolution;
            try {
              if (searchResult.episodes && searchResult.episodes.length > 0) {
                resolution = await getResolutionFromM3U8(
                  searchResult.episodes[0],
                  signal
                );
              }
            } catch (e) {
              if ((e as Error).name !== "AbortError") {
                console.error(
                  `Failed to get resolution for ${searchResult.source_name}`,
                  e
                );
              }
            }
            return { ...searchResult, resolution };
          })
        );

        if (signal.aborted) return;

        set((state) => {
          const existingSources = new Set(state.searchResults.map((r) => r.source));
          const newResults = resultsWithResolution.filter(
            (r) => !existingSources.has(r.source)
          );
          const finalResults = [...state.searchResults, ...newResults];
          return {
            searchResults: finalResults,
            sources: finalResults.map((r) => ({
              source: r.source,
              source_name: r.source_name,
              resolution: r.resolution,
            })),
            detail: state.detail ?? finalResults[0] ?? null,
          };
        });
      };

      // Background fetch for all sources
      const { results: allResults } = await api.searchVideos(q);
      if (signal.aborted) return;

      const filteredResults = videoSource.enabledAll
        ? allResults
        : allResults.filter((result) => videoSource.sources[result.source]);

      if (filteredResults.length > 0) {
        await processAndSetResults(filteredResults);
      }

      if (get().searchResults.length === 0) {
         if (!videoSource.enabledAll) {
           set({ error: "请到设置页面启用的播放源" });
         } else {
           set({ error: "未找到播放源" });
         }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        set({ error: e instanceof Error ? e.message : "获取数据失败" });
      }
    } finally {
      if (!signal.aborted) {
        set({ loading: false, allSourcesLoaded: true });
      }
    }
  },

  setDetail: (detail) => {
    set({ detail });
  },

  abort: () => {
    get().controller?.abort();
  },
}));

export const sourcesSelector = (state: DetailState) => state.sources;
export default useDetailStore;
export const episodesSelectorBySource = (source: string) => (state: DetailState) =>
  state.searchResults.find((r) => r.source === source)?.episodes || [];