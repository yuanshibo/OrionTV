import { create } from "zustand";
import { api } from "@/services/api";
import { fetchAISearchResults } from "@/services/searchService";
import { VideoCardViewModel, normalizeSearchResult } from "@/utils/searchUtils";
import Logger from "@/utils/Logger";

const logger = Logger.withTag("SearchStore");

let currentSearchAbortController: AbortController | null = null;
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

interface SearchState {
  keyword: string;
  results: VideoCardViewModel[];
  loading: boolean;
  error: string | null;
  discoverPage: number;
  loadingMore: boolean;
  hasMore: boolean;
  allSearchResults: VideoCardViewModel[];
  
  setKeyword: (keyword: string) => void;
  loadDiscoverData: (page: number) => Promise<void>;
  doSearch: (term: string) => Promise<void>;
  loadMoreSearchResults: () => void;
  handleSearch: (searchText?: string, immediate?: boolean) => void;
  resetSearch: () => void;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  keyword: "",
  results: [],
  loading: false,
  error: null,
  discoverPage: 1,
  loadingMore: false,
  hasMore: true,
  allSearchResults: [],

  setKeyword: (keyword: string) => set({ keyword }),

  loadDiscoverData: async (page: number) => {
    if (page === 1) {
      set({ loading: true, error: null });
    } else {
      set({ loadingMore: true, error: null });
    }

    try {
      const response = await api.discover(page, 25);
      if (response && response.list && response.list.length > 0) {
        const normalizedList = response.list.map((item: any, index: number) => 
          normalizeSearchResult(item, index + (page - 1) * 25)
        );
        set((prev) => ({
          results: page === 1 ? normalizedList : [...prev.results, ...normalizedList],
          discoverPage: page + 1,
          hasMore: response.list.length === 25
        }));
      } else {
        set((prev) => ({
          hasMore: false,
          results: page === 1 ? [] : prev.results
        }));
      }
    } catch (err) {
      logger.info("Discover data loading failed:", err);
      set((prev) => ({
        hasMore: false,
        results: page === 1 ? [] : prev.results
      }));
    } finally {
      set({ loading: false, loadingMore: false });
    }
  },

  doSearch: async (term: string) => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = null;
    }

    if (currentSearchAbortController) {
      currentSearchAbortController.abort();
      currentSearchAbortController = null;
    }

    if (!term.trim()) {
      get().resetSearch();
      get().loadDiscoverData(1);
      return;
    }

    const abortController = new AbortController();
    currentSearchAbortController = abortController;

    set({
      loading: true,
      error: null,
      results: [],
      allSearchResults: []
    });

    try {
      const searchResults = await fetchAISearchResults(term, abortController.signal);
      if (abortController.signal.aborted) return;

      if (searchResults.length > 0) {
        const normalizedResults = searchResults.map((item, index) => normalizeSearchResult(item, index));
        set({
          allSearchResults: normalizedResults,
          results: normalizedResults.slice(0, 25),
          hasMore: normalizedResults.length > 25
        });
      } else {
        set({ error: "没有找到相关内容，为你推荐..." });
        get().loadDiscoverData(1);
      }
    } catch (err: any) {
      if (err?.name === "AbortError" || err?.message === "Aborted") return;
      logger.info("Search failed:", err);
      set({ error: "搜索失败，请稍后重试。" });
    } finally {
      if (currentSearchAbortController === abortController) {
        currentSearchAbortController = null;
      }
      set({ loading: false });
    }
  },

  loadMoreSearchResults: () => {
    const state = get();
    if (state.loadingMore || state.results.length >= state.allSearchResults.length) return;

    set({ loadingMore: true });

    setTimeout(() => {
      const currentLen = get().results.length;
      const nextBatch = get().allSearchResults.slice(currentLen, currentLen + 25);
      
      if (nextBatch.length > 0) {
        set((prev) => ({
          results: [...prev.results, ...nextBatch]
        }));
      }

      const newLen = get().results.length;
      set({
        loadingMore: false,
        hasMore: newLen < get().allSearchResults.length
      });
    }, 200);
  },

  handleSearch: (searchText?: string, immediate = true) => {
    const term = typeof searchText === "string" ? searchText : get().keyword;
    if (immediate) {
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = null;
      }
      get().doSearch(term);
    } else {
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        get().doSearch(term);
      }, 300);
    }
  },

  resetSearch: () => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = null;
    }
    if (currentSearchAbortController) {
      currentSearchAbortController.abort();
      currentSearchAbortController = null;
    }
    set({
      keyword: "",
      error: null,
      results: [],
      allSearchResults: [],
      discoverPage: 1,
      hasMore: true
    });
  }
}));
