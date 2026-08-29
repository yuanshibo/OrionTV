import { create } from "zustand";
import { Category, DoubanFilterKey, DoubanFilterConfig, DoubanFilterGroup, ActiveDoubanFilters, DoubanRecommendationFilters } from "@/types";
import { initialCategories, initializeFilterableCategory, buildDefaultFilters, DOUBAN_FILTERS_METADATA, ALL_MEDIA_KIND_SELECTOR_GROUP } from "@/services/homeConfig";
import useAuthStore from "./authStore";
import { useSettingsStore } from "./settingsStore";
import { homeService } from "@/services/HomeService";
import { useHomeDataStore } from "./homeDataStore";

interface HomeUIState {
    categories: Category[];
    selectedCategory: Category;
    focusedPoster: string | null;
    lastFocusedCardIndex: number;
    currentFocusArea: 'header' | 'category' | 'tags' | 'content';

    // Actions
    selectCategory: (category: Category) => void;
    updateFilterOption: (categoryTitle: string, key: DoubanFilterKey, value: string) => void;
    refreshPlayRecords: () => Promise<void>;
    deletePlayRecord: (source: string, id: string) => Promise<void>;
    initialize: () => Promise<void>;
    setFocusedPoster: (poster: string | null) => void;
    setLastFocusedCardIndex: (index: number) => void;
    setCurrentFocusArea: (area: 'header' | 'category' | 'tags' | 'content') => void;
}

const isSameCategory = (a?: Category | null, b?: Category | null) => {
    if (!a || !b) return false;
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

export const useHomeUIStore = create<HomeUIState>((set, get) => ({
    categories: initialCategories,
    selectedCategory: initialCategories[0],
    focusedPoster: null,
    lastFocusedCardIndex: 0,
    currentFocusArea: 'category',

    initialize: async () => {
        const active = ensureCategoryHasDefaultTag(get().selectedCategory);
        const current = get().selectedCategory;

        if (!isSameCategory(current, active)) {
            set({ selectedCategory: active });
        }

        // 1. Fast-path: Hydrate local cache and display cached content instantly (0ms)
        await useHomeDataStore.getState().hydrateFromStorage();
        await useHomeDataStore.getState().fetchDataForCategory(active);

        // 2. Background: Verify auth and refresh records
        const { apiBaseUrl } = useSettingsStore.getState();
        await useAuthStore.getState().checkLoginStatus(apiBaseUrl);
        await get().refreshPlayRecords();
    },

    selectCategory: (incomingCategory: Category) => {
        const category = ensureCategoryHasDefaultTag(incomingCategory);
        const currentCategory = get().selectedCategory;

        if (isSameCategory(currentCategory, category)) {
            return;
        }

        set({ selectedCategory: category, lastFocusedCardIndex: 0 });

        // Trigger data fetch in data store
        useHomeDataStore.getState().fetchDataForCategory(category);
    },

    updateFilterOption: (categoryTitle, key, value) => {
        const state = get();
        const targetCategory = state.categories.find((c) => c.title === categoryTitle);

        if (!targetCategory?.filterConfig) return;

        const currentFilters = targetCategory.activeFilters ?? buildDefaultFilters(targetCategory.filterConfig);
        if (currentFilters[key] === value) return;

        const group = targetCategory.filterConfig.groups.find((g: DoubanFilterGroup) => g.key === key);
        if (!group?.options.some((o: { value: string }) => o.value === value)) return;

        let updatedCategory: Category;

        if (key === "kind" && targetCategory.title === "所有") {
            const newKind = value as "movie" | "tv";
            const newKindGroups = DOUBAN_FILTERS_METADATA[newKind];

            const newStaticFilters: Partial<DoubanRecommendationFilters> = { label: "all" };
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

        set({ categories: updatedCategories });

        if (state.selectedCategory.title === categoryTitle) {
            get().selectCategory(updatedCategory);
        }
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
                    // If we were on record category, switch to first available
                    if (state.selectedCategory.type === "record") {
                        const nextCategory = newCategories[0];
                        if (nextCategory) {
                            // Defer state update to avoid conflicts? 
                            // We need to switch category AND fetch data for it.
                            // Calling selectCategory here might be safe.
                            setTimeout(() => get().selectCategory(nextCategory), 0);
                        }
                        return { categories: newCategories };
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

            const updates: Partial<HomeUIState> = {};
            if (newCategories !== state.categories) {
                updates.categories = newCategories;
            }

            // If currently viewing records, update the data directly
            if (state.selectedCategory.type === "record") {
                if (hasRecords) {
                    useHomeDataStore.getState().setDirectData(rowItems);
                } else {
                    // No records anymore, switch category
                    const nextCategory = newCategories[0];
                    if (nextCategory) {
                        setTimeout(() => get().selectCategory(nextCategory), 0);
                    }
                }
            }

            return updates;
        });
    },

    deletePlayRecord: async (source: string, id: string) => {
        // Optimistically remove from contentData in homeDataStore
        const currentData = useHomeDataStore.getState().contentData;
        const updatedData = currentData.filter((item) => !(item.id === id && item.source === source));
        useHomeDataStore.getState().setDirectData(updatedData);

        // If no records left and we are in record category, switch to the first non-record category
        if (updatedData.length === 0 && get().selectedCategory.type === "record") {
            const nonRecordCategories = get().categories.filter((c) => c.type !== "record");
            set({ categories: nonRecordCategories });
            if (nonRecordCategories[0]) {
                get().selectCategory(nonRecordCategories[0]);
            }
        }
    },

    setFocusedPoster: (poster: string | null) => set({ focusedPoster: poster }),
    setLastFocusedCardIndex: (index: number) => set({ lastFocusedCardIndex: index }),
    setCurrentFocusArea: (area: 'header' | 'category' | 'tags' | 'content') => set({ currentFocusArea: area }),
}));
