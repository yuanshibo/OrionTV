import { create } from "zustand";
import { Category, DoubanFilterKey, DoubanFilterConfig, ActiveDoubanFilters } from "@/services/dataTypes";
import { initialCategories, initializeFilterableCategory, buildDefaultFilters, DOUBAN_FILTERS_METADATA, ALL_MEDIA_KIND_SELECTOR_GROUP } from "@/services/homeConfig";
import useAuthStore from "./authStore";
import { useSettingsStore } from "./settingsStore";
import { homeService } from "@/services/HomeService";
import { useHomeDataStore } from "./homeDataStore";

interface HomeUIState {
    categories: Category[];
    selectedCategory: Category;
    focusedPoster: string | null;

    // Actions
    selectCategory: (category: Category) => void;
    updateFilterOption: (categoryTitle: string, key: DoubanFilterKey, value: string) => void;
    refreshPlayRecords: () => Promise<void>;
    initialize: () => Promise<void>;
    setFocusedPoster: (poster: string | null) => void;
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

    initialize: async () => {
        const { apiBaseUrl } = useSettingsStore.getState();
        await useAuthStore.getState().checkLoginStatus(apiBaseUrl);

        // Hydrate data store
        await useHomeDataStore.getState().hydrateFromStorage();

        // Ensure selected category is valid and fetch data
        const current = get().selectedCategory;
        const active = ensureCategoryHasDefaultTag(current);

        if (!isSameCategory(current, active)) {
            set({ selectedCategory: active });
        }

        // Fetch data for initial category
        await useHomeDataStore.getState().fetchDataForCategory(active);
    },

    selectCategory: (incomingCategory: Category) => {
        const category = ensureCategoryHasDefaultTag(incomingCategory);
        const currentCategory = get().selectedCategory;

        if (isSameCategory(currentCategory, category)) {
            return;
        }

        set({ selectedCategory: category });

        // Trigger data fetch in data store
        useHomeDataStore.getState().fetchDataForCategory(category);
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

    setFocusedPoster: (poster: string | null) => set({ focusedPoster: poster }),
}));
