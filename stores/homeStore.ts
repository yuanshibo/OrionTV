import { create } from "zustand";
import { api, SearchResult, PlayRecord, DoubanItem } from "@/services/api";
import { PlayRecordManager } from "@/services/storage";
import useAuthStore from "./authStore";
import { useSettingsStore } from "./settingsStore";

export type RowItem = (SearchResult | PlayRecord) & {
  id: string;
  source: string;
  title: string;
  poster: string;
  progress?: number;
  play_time?: number;
  lastPlayed?: number;
  episodeIndex?: number;
  sourceName?: string;
  totalEpisodes?: number;
  year?: string;
  rate?: string;
};

export interface Category {
  title: string;
  type?: "movie" | "tv" | "record";
  tag?: string;
  tags?: string[];
}

const initialCategories: Category[] = [
  { title: "最近播放", type: "record" },
  { title: "热门剧集", type: "tv", tag: "热门" },
  { title: "电视剧", type: "tv", tags: ["国产剧", "美剧", "英剧", "韩剧", "日剧", "港剧", "日本动画", "动画"] },
  {
    title: "电影",
    type: "movie",
    tags: [
      "热门",
      "最新",
      "经典",
      "豆瓣高分",
      "冷门佳片",
      "华语",
      "欧美",
      "韩国",
      "日本",
      "动作",
      "喜剧",
      "爱情",
      "科幻",
      "悬疑",
      "恐怖",
    ],
  },
  { title: "综艺", type: "tv", tag: "综艺" },
  { title: "豆瓣 Top250", type: "movie", tag: "top250" },
];

// 添加缓存项接口
interface CacheItem {
  data: RowItem[];
  timestamp: number;
  type: 'movie' | 'tv' | 'record';
  hasMore: boolean;
}

const CACHE_EXPIRE_TIME = 5 * 60 * 1000; // 5分钟过期
const MAX_CACHE_SIZE = 10; // 最大缓存容量
const MAX_ITEMS_PER_CACHE = 40; // 每个缓存最大条目数

const getCacheKey = (category: Category) => {
  return `${category.type || 'unknown'}-${category.title}-${category.tag || ''}`;
};

const isValidCache = (cacheItem: CacheItem) => {
  return Date.now() - cacheItem.timestamp < CACHE_EXPIRE_TIME;
};

const isSameCategory = (a?: Category | null, b?: Category | null) => {
  if (!a || !b) {
    return false;
  }

  return a.title === b.title && a.tag === b.tag && a.type === b.type;
};

const ensureCategoryHasDefaultTag = (category: Category): Category => {
  if (category.tags?.length && !category.tag) {
    return { ...category, tag: category.tags[0] };
  }

  return category;
};

type ContentCategory = Category & { type: "movie" | "tv"; tag: string };

const isContentCategory = (category: Category): category is ContentCategory => {
  return (category.type === "movie" || category.type === "tv") && typeof category.tag === "string" && category.tag.length > 0;
};

const parseRecordKey = (key: string) => {
  const [source, id] = key.split("+");
  return {
    source: source || "",
    id: id || key,
  };
};

const transformPlayRecordsToRowItems = (records: Record<string, PlayRecord>): RowItem[] => {
  return Object.entries(records)
    .map(([key, record]) => {
      const { source, id } = parseRecordKey(key);
      const totalTime = record.total_time ?? 0;
      const hasValidDuration = totalTime > 0;

      return {
        ...record,
        id,
        source,
        poster: record.cover,
        sourceName: record.source_name,
        episodeIndex: record.index,
        totalEpisodes: record.total_episodes,
        lastPlayed: record.save_time,
        play_time: record.play_time,
        progress: hasValidDuration ? record.play_time / totalTime : undefined,
      };
    })
    .sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
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
  fetchInitialData: () => Promise<void>;
  loadMoreData: (requestToken?: number) => Promise<void>;
  selectCategory: (category: Category) => void;
  refreshPlayRecords: () => Promise<void>;
  clearError: () => void;
}

// 内存缓存，应用生命周期内有效
const dataCache = new Map<string, CacheItem>();
const prefetchingCacheKeys = new Set<string>();
let currentFetchAbortController: AbortController | null = null;
let currentRequestToken = 0;

const pruneExpiredCacheEntries = () => {
  for (const [key, value] of dataCache.entries()) {
    if (!isValidCache(value)) {
      dataCache.delete(key);
    }
  }
};

const getValidCacheEntry = (cacheKey: string): CacheItem | undefined => {
  const cached = dataCache.get(cacheKey);
  if (!cached) {
    return undefined;
  }

  if (!isValidCache(cached)) {
    dataCache.delete(cacheKey);
    return undefined;
  }

  return cached;
};

const createCacheEntry = (type: CacheItem["type"], items: RowItem[], hasMore: boolean): CacheItem => ({
  data: items.slice(0, MAX_ITEMS_PER_CACHE),
  timestamp: Date.now(),
  type,
  hasMore,
});

const writeCacheEntry = (cacheKey: string, entry: CacheItem) => {
  pruneExpiredCacheEntries();

  if (dataCache.has(cacheKey)) {
    dataCache.delete(cacheKey);
  }

  while (dataCache.size >= MAX_CACHE_SIZE) {
    const { value: oldestKey, done } = dataCache.keys().next();
    if (done || oldestKey === undefined) {
      break;
    }
    dataCache.delete(oldestKey);
  }

  dataCache.set(cacheKey, entry);
};

const appendCacheEntry = (cacheKey: string, type: CacheItem["type"], items: RowItem[], hasMore: boolean) => {
  const existing = getValidCacheEntry(cacheKey);
  const mergedItems = existing ? [...existing.data, ...items] : items;
  writeCacheEntry(cacheKey, createCacheEntry(type, mergedItems, hasMore));
};

const mapDoubanItemsToRows = (items: DoubanItem[]): RowItem[] =>
  items.map((item) => ({
    ...item,
    id: item.title,
    source: "douban",
  })) as RowItem[];

const fetchDoubanCategoryContent = async (
  category: ContentCategory,
  pageStart: number,
  signal?: AbortSignal
): Promise<{ items: RowItem[]; hasMore: boolean }> => {
  const result = await api.getDoubanData(category.type, category.tag, 20, pageStart, signal);
  const items = mapDoubanItemsToRows(result.list);
  return {
    items,
    hasMore: result.list.length !== 0,
  };
};

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

const mapErrorToMessage = (error: unknown): string => {
  if (!error || typeof (error as { message?: string }).message !== "string") {
    return "加载失败，请重试";
  }

  const message = (error as { message: string }).message;

  if (message === "API_URL_NOT_SET") {
    return "请点击右上角设置按钮，配置您的服务器地址";
  }

  if (message === "UNAUTHORIZED") {
    return "认证失败，请重新登录";
  }

  if (message.includes("Network")) {
    return "网络连接失败，请检查网络连接";
  }

  if (message.includes("timeout")) {
    return "请求超时，请检查网络或服务器状态";
  }

  if (message.includes("404")) {
    return "服务器API路径不正确，请检查服务器配置";
  }

  if (message.includes("500")) {
    return "服务器内部错误，请联系管理员";
  }

  if (message.includes("403")) {
    return "访问被拒绝，请检查权限设置";
  }

  return "加载失败，请重试";
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

  fetchInitialData: async () => {
    const { apiBaseUrl } = useSettingsStore.getState();
    await useAuthStore.getState().checkLoginStatus(apiBaseUrl);

    const rawSelectedCategory = get().selectedCategory;
    const activeCategory = ensureCategoryHasDefaultTag(rawSelectedCategory);

    if (!isSameCategory(rawSelectedCategory, activeCategory)) {
      set({ selectedCategory: activeCategory });
    }

    const requestToken = beginRequest();
    const cacheKey = getCacheKey(activeCategory);

    // 最近播放不缓存，始终实时获取
    if (activeCategory.type === "record") {
      set({ loading: true, contentData: [], pageStart: 0, hasMore: true, error: null, loadingMore: false });
      await get().loadMoreData(requestToken);
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

    set({ loading: true, contentData: [], pageStart: 0, hasMore: true, error: null, loadingMore: false });
    await get().loadMoreData(requestToken);
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

    if (category.type === "record" || !cachedData) {
      get().fetchInitialData();
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
          if (state.selectedCategory.type === "record") {
            const nextCategory = newCategories[0];
            if (nextCategory) {
              get().selectCategory(nextCategory);
            }
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
      if (hasRecords && !recordCategoryExists) {
        return { categories: [initialCategories[0], ...state.categories] };
      }
      if (!hasRecords && recordCategoryExists) {
        const newCategories = state.categories.filter((c) => c.type !== "record");
        if (state.selectedCategory.type === "record") {
          const nextCategory = newCategories[0];
          if (nextCategory) {
            get().selectCategory(nextCategory);
          }
        }
        return { categories: newCategories };
      }
      return {};
    });

    get().fetchInitialData();
  },

  clearError: () => {
    set({ error: null });
  },
}));

export default useHomeStore;
