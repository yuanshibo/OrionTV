import { create } from "zustand";
import { PlayRecordManager } from "@/services/storage";
import useAuthStore from "./authStore";
import { useSettingsStore } from "./settingsStore";
import {
  Category,
  RowItem,
  DoubanFilterKey,
  DoubanFilterConfig,
} from "@/types/home";
import {
  ALL_MEDIA_KIND_SELECTOR_GROUP,
} from "@/constants/doubanFilters";
import {
  DOUBAN_FILTERS_METADATA,
} from "@/constants/doubanFilters"; // Needed for dynamic switching
import {
  hydrateCacheFromStorage,
  getValidCacheEntry,
  writeCacheEntry,
  appendCacheEntry,
  createCacheEntry,
} from "@/services/contentCache";
import {
  initialCategories,
  ensureCategoryHasDefaultTag,
  getCacheKey,
  isSameCategory,
  transformPlayRecordsToRowItems,
  isContentCategory,
  fetchDoubanCategoryContent,
  mapErrorToMessage,
  initializeFilterableCategory,
  buildDefaultFilters,
} from "@/utils/homeUtils";

// Re-export types for backward compatibility or convenience if needed,
// but consumers should preferably import from @/types/home
export type { RowItem, Category, DoubanFilterKey };

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

const prefetchingCacheKeys = new Set<string>();
let currentFetchAbortController: AbortController | null = null;
let currentRequestToken = 0;
let pendingFetchKey: string | null = null;

const cancelOngoingRequest = () => {
  if (currentFetchAbortController) {
    currentFetchAbortController.abort();
    currentFetchAbortController = null;
  }
};

const createRequestToken = () => {
  currentRequestToken += 1;
  return currentRequestToken;
};

const beginRequest = () => {
  const token = createRequestToken();
  cancelOngoingRequest();
  return token;
};

const isRequestActive = (requestToken: number, category: Category, getState: () => HomeState): boolean => {
  return requestToken === currentRequestToken && isSameCategory(getState().selectedCategory, category);
};

const schedulePrefetchForTag = (category: Category, tag: string) => {
  const categoryWithTag = { ...category, tag };

  if (!isContentCategory(categoryWithTag)) {
    return;
  }

  const cacheKey = getCacheKey(categoryWithTag);

  if (getValidCacheEntry(cacheKey) || prefetchingCacheKeys.has(cacheKey)) {
    return;
  }

  prefetchingCacheKeys.add(cacheKey);

  void (async () => {
    try {
      const { items, hasMore } = await fetchDoubanCategoryContent(categoryWithTag, 0);
      writeCacheEntry(cacheKey, createCacheEntry(categoryWithTag.type, items, hasMore));
    } catch (_error) {
      void _error;
      // 预加载失败时静默处理，等待用户主动加载
    } finally {
      prefetchingCacheKeys.delete(cacheKey);
    }
  })();
};

const schedulePrefetchAdditionalTags = (category: Category) => {
  if (category.filterConfig) {
    return;
  }

  if (!category.tags || category.tags.length <= 1) {
    return;
  }

  category.tags.forEach((tag, index) => {
    if (tag === category.tag) {
      return;
    }

    const delay = Math.min(index * 300, 1500); // 控制预加载节奏，避免瞬时大量请求

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
    if (state.hydrated) {
      return;
    }

    if (state.hydrating) {
      await hydrateCacheFromStorage();
      return;
    }

    set({ hydrating: true });

    await hydrateCacheFromStorage();

    const activeCategory = ensureCategoryHasDefaultTag(get().selectedCategory);
    const cacheKey = getCacheKey(activeCategory);
    const cached = getValidCacheEntry(cacheKey);

    set((currentState) => {
      if (!cached) {
        return {
          hydrating: false,
          hydrated: true,
        };
      }

      if (currentState.contentData.length > 0 && !currentState.loading) {
        return {
          hydrating: false,
          hydrated: true,
        };
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

    const cacheKey = getCacheKey(activeCategory);
    const isDuplicateFetch = pendingFetchKey === cacheKey && get().loading;

    if (isDuplicateFetch) {
      return;
    }

    const requestToken = beginRequest();

    if (activeCategory.type === "record") {
      pendingFetchKey = cacheKey;

      try {
        set({ loading: true, contentData: [], pageStart: 0, hasMore: true, error: null, loadingMore: false });
        await get().loadMoreData(requestToken);
      } finally {
        if (pendingFetchKey === cacheKey) {
          pendingFetchKey = null;
        }
      }

      return;
    }

    const cachedData = getValidCacheEntry(cacheKey);
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

    pendingFetchKey = cacheKey;

    try {
      set({ loading: true, contentData: [], pageStart: 0, hasMore: true, error: null, loadingMore: false });
      await get().loadMoreData(requestToken);
    } finally {
      if (pendingFetchKey === cacheKey) {
        pendingFetchKey = null;
      }
    }
  },
  loadMoreData: async (providedToken?: number) => {
    const { selectedCategory: rawSelectedCategory, pageStart, loadingMore, hasMore } = get();
    const selectedCategory = ensureCategoryHasDefaultTag(rawSelectedCategory);

    if (!isSameCategory(rawSelectedCategory, selectedCategory)) {
      set({ selectedCategory });
    }

    if (loadingMore || !hasMore) {
      return;
    }

    if (pageStart > 0) {
      set({ loadingMore: true });
    }

    const requestToken = providedToken ?? createRequestToken();
    let abortController: AbortController | null = null;

    try {
      if (selectedCategory.type === "record") {
        const { isLoggedIn } = useAuthStore.getState();
        if (!isLoggedIn) {
          if (isRequestActive(requestToken, selectedCategory, get)) {
            set({ contentData: [], hasMore: false, pageStart: 0 });
          }
          return;
        }

        const records = await PlayRecordManager.getAllLatestByTitle();
        const rowItems = transformPlayRecordsToRowItems(records);

        if (!isRequestActive(requestToken, selectedCategory, get)) {
          return;
        }

        set({ contentData: rowItems, hasMore: false, pageStart: rowItems.length });
        return;
      }

      if (isContentCategory(selectedCategory)) {
        abortController = new AbortController();
        currentFetchAbortController = abortController;

        const { items, hasMore: newHasMore } = await fetchDoubanCategoryContent(
          selectedCategory,
          pageStart,
          abortController.signal
        );

        const cacheKey = getCacheKey(selectedCategory);

        if (pageStart === 0) {
          writeCacheEntry(cacheKey, createCacheEntry(selectedCategory.type, items, newHasMore));

          if (!isRequestActive(requestToken, selectedCategory, get)) {
            return;
          }

          set({
            contentData: items,
            pageStart: items.length,
            hasMore: newHasMore,
          });

          schedulePrefetchAdditionalTags(selectedCategory);
        } else {
          appendCacheEntry(cacheKey, selectedCategory.type, items, newHasMore);

          if (!isRequestActive(requestToken, selectedCategory, get)) {
            return;
          }

          set((state) => ({
            contentData: [...state.contentData, ...items],
            pageStart: state.pageStart + items.length,
            hasMore: newHasMore,
          }));
        }

        return;
      }

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
      if (err?.name === "AbortError" || err?.message === "Aborted") {
        return;
      }

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
      // This part required importing DOUBAN_FILTERS_METADATA which I did.
      const newKindGroups = DOUBAN_FILTERS_METADATA[newKind];
      
      const newStaticFilters: Partial<Category["filterConfig"] extends undefined ? {} : NonNullable<Category["filterConfig"]>["staticFilters"]> = { label: "all" };
      if (newKind === 'tv') {
        (newStaticFilters as any).format = '电视剧';
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

    const cacheKey = getCacheKey(category);
    const cachedData = getValidCacheEntry(cacheKey);

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

    const records = await PlayRecordManager.getAllLatestByTitle();
    const hasRecords = Object.keys(records).length > 0;

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
          const rowItems = transformPlayRecordsToRowItems(records);
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
