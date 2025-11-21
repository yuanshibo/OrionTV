import {
  Category,
  DoubanFilterConfig,
  ActiveDoubanFilters,
  RowItem
} from "@/types/home";
import {
  DoubanRecommendationFilters,
  DoubanItem,
  DoubanRecommendationItem,
  PlayRecord,
  api
} from "@/services/api";
import { DOUBAN_ALL_FILTER_GROUPS } from "@/constants/doubanFilters";

export const DOUBAN_RECOMMENDATION_PAGE_SIZE = 25;

export const buildDefaultFilters = (config: DoubanFilterConfig): ActiveDoubanFilters => {
  const defaults: ActiveDoubanFilters = {};

  config.groups.forEach((group) => {
    if (group.key === 'kind') {
      defaults[group.key] = group.defaultValue;
    } else {
      defaults[group.key] = group.defaultValue;
    }
  });

  return { ...defaults, ...(config.staticFilters ?? {}) };
};

export const createFilterTag = (type: "movie" | "tv" | "record", filters: ActiveDoubanFilters): string => {
  const serialized = Object.entries(filters)
    .filter(([, value]) => value !== undefined && value !== null && `${value}`.length > 0)
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("&");

  return `${type}-filters-${serialized}`;
};

export const initializeFilterableCategory = (category: Category): Category => {
  if (!category.filterConfig || !category.type || category.type === 'record') {
    return category;
  }

  const activeFilters = category.activeFilters ? { ...category.activeFilters } : buildDefaultFilters(category.filterConfig);
  const tag = createFilterTag(category.type, activeFilters);

  return {
    ...category,
    activeFilters,
    tag,
  };
};

export const initializeCategories = (categories: Category[]): Category[] =>
  categories.map((category) => initializeFilterableCategory(category));

export const initialCategories: Category[] = initializeCategories([
  { title: "最近播放", type: "record" },
  { title: "热门剧集", type: "tv", tag: "热门" },
  { title: "电视剧", type: "tv", tags: ["国产剧", "美剧", "英剧", "韩剧", "日剧", "港剧", "日本动画"] },
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
  {
    title: "所有",
    type: "tv",
    filterConfig: {
      kind: "tv",
      groups: DOUBAN_ALL_FILTER_GROUPS,
      staticFilters: { format: "电视剧", label: "all" },
    },
  },
]);

export const getCacheKey = (category: Category) => {
  return `${category.type || 'unknown'}-${category.title}-${category.tag || ''}`;
};

export const isSameCategory = (a?: Category | null, b?: Category | null) => {
  if (!a || !b) {
    return false;
  }

  return a.title === b.title && a.tag === b.tag && a.type === b.type;
};

export const ensureCategoryHasDefaultTag = (category: Category): Category => {
  if (category.filterConfig) {
    return initializeFilterableCategory(category);
  }

  if (category.tags?.length && !category.tag) {
    return { ...category, tag: category.tags[0] };
  }

  return category;
};

export type ContentCategory = Category & { type: "movie" | "tv"; tag: string };

export const isContentCategory = (category: Category): category is ContentCategory => {
  return (category.type === "movie" || category.type === "tv") && typeof category.tag === "string" && category.tag.length > 0;
};

const parseRecordKey = (key: string) => {
  const [source, id] = key.split("+");
  return {
    source: source || "",
    id: id || key,
  };
};

export const transformPlayRecordsToRowItems = (records: Record<string, PlayRecord>): RowItem[] => {
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

export const mapDoubanItemsToRows = (items: DoubanItem[]): RowItem[] =>
  items.map((item) => ({
    ...item,
    id: item.title,
    source: "douban",
  })) as RowItem[];

export const mapDoubanRecommendationsToRows = (items: DoubanRecommendationItem[]): RowItem[] =>
  items.map((item) => ({
    id: item.id || item.title,
    source: "douban",
    title: item.title,
    poster: item.poster,
    year: item.year,
    rate: item.rate,
    sourceName: "豆瓣",
  })) as RowItem[];

export const fetchDoubanCategoryContent = async (
  category: ContentCategory,
  pageStart: number,
  signal?: AbortSignal
): Promise<{ items: RowItem[]; hasMore: boolean }> => {
  if (category.filterConfig) {
    const limit = DOUBAN_RECOMMENDATION_PAGE_SIZE;
    const activeFilters = category.activeFilters ?? buildDefaultFilters(category.filterConfig);

    const result = await api.getDoubanRecommendations(
      category.filterConfig.kind,
      {
        ...activeFilters,
        start: pageStart,
        limit,
      },
      signal
    );

    const items = mapDoubanRecommendationsToRows(result.list);
    return {
      items,
      hasMore: result.list.length > 0,
    };
  }

  const result = await api.getDoubanData(category.type, category.tag, 20, pageStart, signal);
  const items = mapDoubanItemsToRows(result.list);
  return {
    items,
    hasMore: result.list.length !== 0,
  };
};

export const mapErrorToMessage = (error: unknown): string => {
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
