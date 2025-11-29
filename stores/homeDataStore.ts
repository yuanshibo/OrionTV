import { create } from "zustand";
import { RowItem, Category } from "@/services/dataTypes";
import { homeService } from "@/services/HomeService";
import { contentCacheService } from "@/services/ContentCacheService";
import useAuthStore from "./authStore";
import errorService from "@/services/ErrorService";

interface HomeDataState {
    contentData: RowItem[];
    loading: boolean;
    loadingMore: boolean;
    pageStart: number;
    hasMore: boolean;
    error: string | null;
    hydrating: boolean;
    hydrated: boolean;

    // Actions
    hydrateFromStorage: () => Promise<void>;
    fetchDataForCategory: (category: Category, forceRefresh?: boolean) => Promise<void>;
    loadMoreData: (category: Category) => Promise<void>;
    setDirectData: (data: RowItem[]) => void; // For when UI store fetches records directly
    clearError: () => void;
    resetData: () => void;
}

// Request Management
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

const isRequestActive = (requestToken: number) => {
    return requestToken === currentRequestToken;
};

const isContentCategory = (category: Category): boolean => {
    return (category.type === "movie" || category.type === "tv") && typeof category.tag === "string" && category.tag.length > 0;
};

// Prefetching Logic (kept local)
const schedulePrefetchForTag = (category: Category, tag: string) => {
    const categoryWithTag = { ...category, tag };
    if (!isContentCategory(categoryWithTag)) return;

    const cacheKey = contentCacheService.getCacheKey(categoryWithTag);
    if (contentCacheService.getValidCacheEntry(categoryWithTag) || prefetchingCacheKeys.has(cacheKey)) return;

    prefetchingCacheKeys.add(cacheKey);

    void (async () => {
        try {
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

export const useHomeDataStore = create<HomeDataState>((set, get) => ({
    contentData: [],
    loading: false, // Initial loading state is managed by UI or hydration
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
            await contentCacheService.hydrateFromStorage();
            return;
        }

        set({ hydrating: true });
        await contentCacheService.hydrateFromStorage();
        set({ hydrating: false, hydrated: true });
    },

    fetchDataForCategory: async (category: Category, forceRefresh = false) => {
        const cacheKey = contentCacheService.getCacheKey(category);
        const isDuplicateFetch = pendingFetchKey === cacheKey && get().loading;

        if (isDuplicateFetch && !forceRefresh) return;

        // Check cache first if not forcing refresh
        if (!forceRefresh) {
            const cachedData = contentCacheService.getValidCacheEntry(category);
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
        }

        // Fetch Fresh
        const requestToken = beginRequest();
        pendingFetchKey = cacheKey;

        set({ loading: true, contentData: [], pageStart: 0, hasMore: true, error: null, loadingMore: false });

        try {
            await get().loadMoreData(category);
        } finally {
            if (pendingFetchKey === cacheKey) pendingFetchKey = null;
            // If request is still active (not cancelled by another fetch), ensure loading is off
            if (isRequestActive(requestToken)) {
                // loadMoreData handles setting loading to false, but double check?
                // Actually loadMoreData sets loading: false in finally block if active.
            }
        }
    },

    loadMoreData: async (category: Category) => {
        const { pageStart, loadingMore, hasMore } = get();

        // Safety check: if we are already loading more, or no more data, skip
        // BUT: fetchDataForCategory calls this with pageStart=0, so we must allow it even if loadingMore was true (though it shouldn't be)
        // The requestToken check handles concurrency.

        const requestToken = currentRequestToken; // Assumes beginRequest was called if this is a fresh fetch, or we use current if just loading more

        // If this is a "load more" triggered by scroll (not fresh fetch), we need to set loadingMore
        if (pageStart > 0) {
            if (loadingMore || !hasMore) return;
            set({ loadingMore: true });
        }

        let abortController: AbortController | null = null;

        try {
            // 1. Play Records - Handled by UI store usually, but if passed here:
            if (category.type === "record") {
                // Records are usually fetched via refreshPlayRecords in UI store and passed via setDirectData
                // But if we want to support it here:
                const { isLoggedIn } = useAuthStore.getState();
                if (!isLoggedIn) {
                    if (isRequestActive(requestToken)) set({ contentData: [], hasMore: false, pageStart: 0 });
                    return;
                }
                const rowItems = await homeService.fetchPlayRecords();
                if (isRequestActive(requestToken)) {
                    set({ contentData: rowItems, hasMore: false, pageStart: rowItems.length });
                }
                return;
            }

            // 2. Content
            if (isContentCategory(category)) {
                abortController = new AbortController();
                currentFetchAbortController = abortController;

                const serviceCategory = {
                    ...category,
                    type: category.type as "movie" | "tv",
                    tag: category.tag!
                };

                const { items, hasMore: newHasMore } = await homeService.fetchDoubanCategoryContent(
                    serviceCategory,
                    pageStart,
                    abortController.signal
                );

                if (pageStart === 0) {
                    contentCacheService.writeCacheEntry(category, items, newHasMore);
                    if (!isRequestActive(requestToken)) return;

                    set({
                        contentData: items,
                        pageStart: items.length,
                        hasMore: newHasMore,
                    });
                    schedulePrefetchAdditionalTags(category);
                } else {
                    contentCacheService.appendCacheEntry(category, items, newHasMore);
                    if (!isRequestActive(requestToken)) return;

                    set((state) => ({
                        contentData: [...state.contentData, ...items],
                        pageStart: state.pageStart + items.length,
                        hasMore: newHasMore,
                    }));
                }
                return;
            }

            // 3. Category Groups (just tags)
            if (category.tags) {
                if (isRequestActive(requestToken)) set({ contentData: [], hasMore: false, pageStart: 0 });
                return;
            }

            if (isRequestActive(requestToken)) set({ hasMore: false });

        } catch (err: any) {
            if (err?.name === "AbortError" || err?.message === "Aborted") return;
            set({ error: errorService.formatMessage(err) });
        } finally {
            if (abortController && currentFetchAbortController === abortController) {
                currentFetchAbortController = null;
            }
            if (isRequestActive(requestToken)) {
                set({ loading: false, loadingMore: false });
            }
        }
    },

    setDirectData: (data: RowItem[]) => {
        cancelOngoingRequest();
        set({
            contentData: data,
            pageStart: data.length,
            hasMore: false,
            loading: false,
            loadingMore: false,
            error: null
        });
    },

    clearError: () => set({ error: null }),

    resetData: () => {
        cancelOngoingRequest();
        set({ contentData: [], pageStart: 0, hasMore: true, loading: false, loadingMore: false, error: null });
    }
}));
