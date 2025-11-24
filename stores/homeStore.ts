import { create } from "zustand";
import {
  RowItem,
  Category,
  DoubanFilterKey,
  CacheItem,
  DoubanFilterConfig,
  ActiveDoubanFilters,
  DoubanFilterGroup,
  DoubanFilterOption
} from "@/services/dataTypes";
import { homeService } from "@/services/HomeService";
import { contentCacheService } from "@/services/ContentCacheService";
import {
  initialCategories,
  initializeFilterableCategory,
  buildDefaultFilters,
  DOUBAN_FILTERS_METADATA,
  ALL_MEDIA_KIND_SELECTOR_GROUP
} from "@/services/homeConfig";
import useAuthStore from "./authStore";
import { useSettingsStore } from "./settingsStore";
import { mapErrorToMessage } from "@/utils/errorUtils";

// Re-export types for consumers
export { RowItem, Category, DoubanFilterKey, DoubanFilterOption, DoubanFilterGroup, DoubanFilterConfig, ActiveDoubanFilters };

const isSameCategory = (a?: Category | null, b?: Category | null) => {
  if (!a || !b) {
    return false;
  }
  return a.title === b.title && a.tag === b.tag && a.type === b.type;
};

const ensureCategoryHasDefaultTag = (category: Category): Category => {
  if (category.filterConfig) {
    return initializeFilterableCategory(category);
  }
  if (category.tags?.length && !category.tag) {
    return { ...category, tag: category.tags[0] };
  }
  return category;
};

const isContentCategory = (category: Category): boolean => {
  return (category.type === "movie" || category.type === "tv") && typeof category.tag === "string" && category.tag.length > 0;
};

interface HomeState {
  categories: Category[];
  selectedCategory: Category;
  contentData: RowItem[];
  loading: boolean;
  loadingMore: boolean;
  pageStart: number;
  hasMore: boolean;
  error: string | null;
  hydrating: boolean;
  hydrated: boolean;
  hydrateFromStorage: () => Promise<void>;
  fetchInitialData: () => Promise<void>;
  loadMoreData: (requestToken?: number) => Promise<void>;
  selectCategory: (category: Category) => void;
  updateFilterOption: (categoryTitle: string, key: DoubanFilterKey, value: string) => void;
  refreshPlayRecords: () => Promise<void>;
  clearError: () => void;
}

// Request Management State (kept local to module to avoid store pollution, or could be in store)
let currentFetchAbortController: AbortController | null = null;
let currentRequestToken = 0;
let pendingFetchKey: string | null = null;
const prefetchingCacheKeys = new Set<string>();

const createRequestToken = () => {
  currentRequestToken += 1;
  return currentRequestToken;
};

const cancelOngoingRequest = () => {
  if (currentFetchAbortController) {
    currentFetchAbortController.abort();
    currentFetchAbortController = null;
  }
};

const beginRequest = () => {
  const token = createRequestToken();
  cancelOngoingRequest();
  return token;
};

const isRequestActive = (requestToken: number, category: Category, getState: () => HomeState): boolean => {
  return requestToken === currentRequestToken && isSameCategory(getState().selectedCategory, category);
};

// Prefetching Logic
const schedulePrefetchForTag = (category: Category, tag: string) => {
  const categoryWithTag = { ...category, tag };
  if (!isContentCategory(categoryWithTag)) return;

  const cacheKey = contentCacheService.getCacheKey(categoryWithTag);
  if (contentCacheService.getValidCacheEntry(categoryWithTag) || prefetchingCacheKeys.has(cacheKey)) return;

  prefetchingCacheKeys.add(cacheKey);

  void (async () => {
    try {
      // Need to cast type for homeService
      const serviceCategory = { ...categoryWithTag, type: categoryWithTag.type as "movie" | "tv", tag: categoryWithTag.tag! };
      const { items, hasMore } = await homeService.fetchDoubanCategoryContent(serviceCategory, 0);
      contentCacheService.writeCacheEntry(categoryWithTag, items, hasMore);
    } catch (_error) {
      // silent fail
    } finally {
      prefetchingCacheKeys.delete(cacheKey);
    }
  })();
};

const schedulePrefetchAdditionalTags = (category: Category) => {
  if (category.filterConfig) return;
  if (!category.tags || category.tags.length <= 1) return;

  category.tags.forEach((tag, index) => {
    if (tag === category.tag) return;
    const delay = Math.min(index * 300, 1500);
    setTimeout(() => {
      schedulePrefetchForTag(category, tag);
    }, delay);
  });
};

const useHomeStore = create<HomeState>((set, get) => ({
  categories: initialCategories,
  selectedCategory: initialCategories[0],
  contentData: [],
  loading: true,
  loadingMore: false,
  pageStart: 0,
  hasMore: true,
  error: null,
  hydrating: false,
  hydrated: false,

  hydrateFromStorage: async () => {
    const state = get();
    if (state.hydrated) return;
    if (state.hydrating) {
      // Wait for service to be hydrated if we could, but service handles its own promise.
      // We'll just wait for the service.
      await contentCacheService.hydrateFromStorage();
      return;
    }

    set({ hydrating: true });
    await contentCacheService.hydrateFromStorage();

    const activeCategory = ensureCategoryHasDefaultTag(get().selectedCategory);
    const cached = contentCacheService.getValidCacheEntry(activeCategory);

    set((currentState) => {
      if (!cached) {
        return { hydrating: false, hydrated: true };
      }
      // If data was already loaded while hydrating (rare race), keep it.
      if (currentState.contentData.length > 0 && !currentState.loading) {
        return { hydrating: false, hydrated: true };
      }
      return {
        hydrating: false,
        hydrated: true,
        contentData: cached.data,
        pageStart: cached.data.length,
        hasMore: cached.hasMore,
        loading: false,
        loadingMore: false,
      };
    });
  },

  fetchInitialData: async () => {
    const { apiBaseUrl } = useSettingsStore.getState();
    await useAuthStore.getState().checkLoginStatus(apiBaseUrl);
    await get().hydrateFromStorage();

    const rawSelectedCategory = get().selectedCategory;
    const activeCategory = ensureCategoryHasDefaultTag(rawSelectedCategory);

    if (!isSameCategory(rawSelectedCategory, activeCategory)) {
      set({ selectedCategory: activeCategory });
    }

    const cacheKey = contentCacheService.getCacheKey(activeCategory);
    const isDuplicateFetch = pendingFetchKey === cacheKey && get().loading;

    if (isDuplicateFetch) return;

    const requestToken = beginRequest();

    // Record Category: Always fetch fresh
    if (activeCategory.type === "record") {
      pendingFetchKey = cacheKey;
      try {
        set({ loading: true, contentData: [], pageStart: 0, hasMore: true, error: null, loadingMore: false });
        await get().loadMoreData(requestToken);
      } finally {
        if (pendingFetchKey === cacheKey) pendingFetchKey = null;
      }
      return;
    }

    // Content Category: Check Cache
    const cachedData = contentCacheService.getValidCacheEntry(activeCategory);
    if (cachedData) {
      set({
        loading: false,
        contentData: cachedData.data,
        pageStart: cachedData.data.length,
        hasMore: cachedData.hasMore,
        error: null,
        loadingMore: false,
      });
      return;
    }

    // Content Category: Fetch Fresh
    pendingFetchKey = cacheKey;
    try {
      set({ loading: true, contentData: [], pageStart: 0, hasMore: true, error: null, loadingMore: false });
      await get().loadMoreData(requestToken);
    } finally {
      if (pendingFetchKey === cacheKey) pendingFetchKey = null;
    }
  },

  loadMoreData: async (providedToken?: number) => {
    const { selectedCategory: rawSelectedCategory, pageStart, loadingMore, hasMore } = get();
    const selectedCategory = ensureCategoryHasDefaultTag(rawSelectedCategory);

    if (!isSameCategory(rawSelectedCategory, selectedCategory)) {
      set({ selectedCategory });
    }

    if (loadingMore || !hasMore) return;
    if (pageStart > 0) set({ loadingMore: true });

    const requestToken = providedToken ?? createRequestToken();
    let abortController: AbortController | null = null;

    try {
      // 1. Play Records
      if (selectedCategory.type === "record") {
        const { isLoggedIn } = useAuthStore.getState();
        if (!isLoggedIn) {
          if (isRequestActive(requestToken, selectedCategory, get)) {
            set({ contentData: [], hasMore: false, pageStart: 0 });
          }
          return;
        }

        const rowItems = await homeService.fetchPlayRecords();

        if (!isRequestActive(requestToken, selectedCategory, get)) return;

        set({ contentData: rowItems, hasMore: false, pageStart: rowItems.length });
        return;
      }

      // 2. Content (Douban / Recommendations)
      if (isContentCategory(selectedCategory)) {
        abortController = new AbortController();
        currentFetchAbortController = abortController;

        // Force type cast for Service (validated by isContentCategory)
        const serviceCategory = {
            ...selectedCategory,
            type: selectedCategory.type as "movie" | "tv",
            tag: selectedCategory.tag!
        };

        const { items, hasMore: newHasMore } = await homeService.fetchDoubanCategoryContent(
          serviceCategory,
          pageStart,
          abortController.signal
        );

        if (pageStart === 0) {
          contentCacheService.writeCacheEntry(selectedCategory, items, newHasMore);

          if (!isRequestActive(requestToken, selectedCategory, get)) return;

          set({
            contentData: items,
            pageStart: items.length,
            hasMore: newHasMore,
          });

          schedulePrefetchAdditionalTags(selectedCategory);
        } else {
          contentCacheService.appendCacheEntry(selectedCategory, items, newHasMore);

          if (!isRequestActive(requestToken, selectedCategory, get)) return;

          set((state) => ({
            contentData: [...state.contentData, ...items],
            pageStart: state.pageStart + items.length,
            hasMore: newHasMore,
          }));
        }
        return;
      }

      // 3. Category Groups (tags list) - shouldn't really load data but just in case
      if (selectedCategory.tags) {
        if (isRequestActive(requestToken, selectedCategory, get)) {
          set({ contentData: [], hasMore: false, pageStart: 0 });
        }
        return;
      }

      if (isRequestActive(requestToken, selectedCategory, get)) {
        set({ hasMore: false });
      }

    } catch (err: any) {
      if (err?.name === "AbortError" || err?.message === "Aborted") return;
      set({ error: mapErrorToMessage(err) });
    } finally {
      if (abortController && currentFetchAbortController === abortController) {
        currentFetchAbortController = null;
      }
      if (isRequestActive(requestToken, selectedCategory, get)) {
        set({ loading: false, loadingMore: false });
      } else if (requestToken === currentRequestToken) {
        set({ loadingMore: false });
      }
    }
  },

  updateFilterOption: (categoryTitle, key, value) => {
    const state = get();
    const targetCategory = state.categories.find((c) => c.title === categoryTitle);

    if (!targetCategory?.filterConfig) return;

    const currentFilters = targetCategory.activeFilters ?? buildDefaultFilters(targetCategory.filterConfig);
    if (currentFilters[key] === value) return;

    const group = targetCategory.filterConfig.groups.find((g) => g.key === key);
    if (!group?.options.some((o) => o.value === value)) return;

    let updatedCategory: Category;

    if (key === "kind" && targetCategory.title === "所有") {
      const newKind = value as "movie" | "tv";
      const newKindGroups = DOUBAN_FILTERS_METADATA[newKind];
      
      const newStaticFilters: Partial<ActiveDoubanFilters> = { label: "all" };
      if (newKind === 'tv') {
        newStaticFilters.format = '电视剧';
      }

      const newFilterConfig: DoubanFilterConfig = {
        ...targetCategory.filterConfig,
        kind: newKind,
        groups: [ALL_MEDIA_KIND_SELECTOR_GROUP, ...newKindGroups],
        staticFilters: newStaticFilters,
      };

      const newActiveFilters = buildDefaultFilters(newFilterConfig);
      newActiveFilters.kind = newKind;

      updatedCategory = initializeFilterableCategory({
        ...targetCategory,
        type: newKind,
        filterConfig: newFilterConfig,
        activeFilters: newActiveFilters,
      });
    } else {
      updatedCategory = initializeFilterableCategory({
        ...targetCategory,
        activeFilters: { ...currentFilters, [key]: value },
      });
    }

    const updatedCategories = state.categories.map((c) =>
      c.title === categoryTitle ? updatedCategory : c
    );

    cancelOngoingRequest();

    set({ categories: updatedCategories });

    if (state.selectedCategory.title === categoryTitle) {
      get().selectCategory(updatedCategory);
    }
  },

  selectCategory: (incomingCategory: Category) => {
    const category = ensureCategoryHasDefaultTag(incomingCategory);
    const currentCategory = ensureCategoryHasDefaultTag(get().selectedCategory);

    if (isSameCategory(currentCategory, category)) {
      return;
    }

    cancelOngoingRequest();

    const cachedData = contentCacheService.getValidCacheEntry(category);

    set({
      selectedCategory: category,
      contentData: cachedData ? cachedData.data : [],
      pageStart: cachedData ? cachedData.data.length : 0,
      hasMore: cachedData ? cachedData.hasMore : true,
      error: null,
      loadingMore: false,
      loading: !cachedData,
    });
  },

  refreshPlayRecords: async () => {
    const { apiBaseUrl } = useSettingsStore.getState();
    await useAuthStore.getState().checkLoginStatus(apiBaseUrl);
    const { isLoggedIn } = useAuthStore.getState();

    if (!isLoggedIn) {
      set((state) => {
        const recordCategoryExists = state.categories.some((c) => c.type === "record");
        if (recordCategoryExists) {
          const newCategories = state.categories.filter((c) => c.type !== "record");
          if (state.selectedCategory.type === "record") {
            const nextCategory = newCategories[0];
            return { categories: newCategories, selectedCategory: nextCategory || state.selectedCategory };
          }
          return { categories: newCategories };
        }
        return {};
      });
      return;
    }

    const rowItems = await homeService.fetchPlayRecords();
    const hasRecords = rowItems.length > 0;

    set((state) => {
      const recordCategoryExists = state.categories.some((c) => c.type === "record");
      let newCategories = state.categories;

      if (hasRecords && !recordCategoryExists) {
        newCategories = [initialCategories[0], ...state.categories];
      } else if (!hasRecords && recordCategoryExists) {
        newCategories = state.categories.filter((c) => c.type !== "record");
      }

      const updates: Partial<HomeState> = {};
      if (newCategories !== state.categories) {
        updates.categories = newCategories;
      }

      if (state.selectedCategory.type === "record") {
        if (hasRecords) {
          updates.contentData = rowItems;
          updates.pageStart = rowItems.length;
          updates.hasMore = false;
          updates.loading = false;
          updates.loadingMore = false;
          updates.error = null;
        } else {
          const nextCategory = newCategories[0];
          if (nextCategory) {
            updates.selectedCategory = nextCategory;
          }
        }
      }

      return updates;
    });
  },

  clearError: () => {
    set({ error: null });
  },
}));

export default useHomeStore;
