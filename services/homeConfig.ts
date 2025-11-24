import { Category, DoubanFilterConfig, DoubanFilterGroup, ActiveDoubanFilters, DoubanRecommendationFilters } from "./dataTypes";

export const SHARED_FILTER_GROUPS: DoubanFilterGroup[] = [
  {
    key: "region",
    label: "地区",
    defaultValue: "all",
    options: [
      { label: "全部", value: "all" },
      { label: '华语', value: '华语' },
      { label: '欧美', value: '欧美' },
      { label: '韩国', value: '韩国' },
      { label: '日本', value: '日本' },
      { label: '中国大陆', value: '中国大陆' },
      { label: '美国', value: '美国' },
      { label: '中国香港', value: '中国香港' },
      { label: '中国台湾', value: '中国台湾' },
      { label: '英国', value: '英国' },
      { label: '法国', value: '法国' },
      { label: '德国', value: '德国' },
      { label: '意大利', value: '意大利' },
      { label: '西班牙', value: '西班牙' },
      { label: '印度', value: '印度' },
      { label: '泰国', value: '泰国' },
      { label: '俄罗斯', value: '俄罗斯' },
      { label: '加拿大', value: '加拿大' },
      { label: '澳大利亚', value: '澳大利亚' },
      { label: '爱尔兰', value: '爱尔兰' },
      { label: '瑞典', value: '瑞典' },
      { label: '巴西', value: '巴西' },
      { label: '丹麦', value: '丹麦' },
    ],
  },
  {
    key: "year",
    label: "年代",
    defaultValue: "all",
    options: [
      { label: "全部", value: "all" },
      { label: '2020年代', value: '2020年代' },
      { label: '2025', value: '2025' },
      { label: '2024', value: '2024' },
      { label: '2023', value: '2023' },
      { label: '2022', value: '2022' },
      { label: '2021', value: '2021' },
      { label: '2020', value: '2020' },
      { label: '2019', value: '2019' },
      { label: '2010年代', value: '2010年代' },
      { label: '2000年代', value: '2000年代' },
      { label: '90年代', value: '90年代' },
      { label: '80年代', value: '80年代' },
      { label: '70年代', value: '70年代' },
      { label: '60年代', value: '60年代' },
      { label: '更早', value: '更早' },
    ],
  },
];

export const DOUBAN_FILTERS_METADATA: Record<"tv" | "movie", DoubanFilterGroup[]> = {
  tv: [
    {
      key: "category",
      label: "类型",
      defaultValue: "all",
      options: [
        { label: "全部", value: "all" },
        { label: '喜剧', value: '喜剧' },
        { label: '爱情', value: '爱情' },
        { label: '悬疑', value: '悬疑' },
        { label: '武侠', value: '武侠' },
        { label: '古装', value: '古装' },
        { label: '家庭', value: '家庭' },
        { label: '犯罪', value: '犯罪' },
        { label: '科幻', value: '科幻' },
        { label: '恐怖', value: '恐怖' },
        { label: '历史', value: '历史' },
        { label: '战争', value: '战争' },
        { label: '动作', value: '动作' },
        { label: '冒险', value: '冒险' },
        { label: '传记', value: '传记' },
        { label: '剧情', value: '剧情' },
        { label: '奇幻', value: '奇幻' },
        { label: '惊悚', value: '惊悚' },
        { label: '灾难', value: '灾难' },
        { label: '歌舞', value: '歌舞' },
        { label: '音乐', value: '音乐' },
      ],
    },
    ...SHARED_FILTER_GROUPS,
    {
      key: "platform",
      label: "平台",
      defaultValue: "all",
      options: [
        { label: "全部", value: "all" },
        { label: '腾讯视频', value: '腾讯视频' },
        { label: '爱奇艺', value: '爱奇艺' },
        { label: '优酷', value: '优酷' },
        { label: '湖南卫视', value: '湖南卫视' },
        { label: 'Netflix', value: 'Netflix' },
        { label: 'HBO', value: 'HBO' },
        { label: 'BBC', value: 'BBC' },
        { label: 'NHK', value: 'NHK' },
        { label: 'CBS', value: 'CBS' },
        { label: 'NBC', value: 'NBC' },
        { label: 'tvN', value: 'tvN' },
      ],
    },
    {
      key: "sort",
      label: "排序",
      defaultValue: "T",
      options: [
        { label: '综合排序', value: 'T' },
        { label: '近期热度', value: 'U' },
        { label: '首播时间', value: 'R' },
        { label: '高分优先', value: 'S' },
      ],
    },
  ],
  movie: [
    {
      key: "category",
      label: "类型",
      defaultValue: "all",
      options: [
        { label: "全部", value: "all" },
        { label: '喜剧', value: '喜剧' },
        { label: '爱情', value: '爱情' },
        { label: '动作', value: '动作' },
        { label: '科幻', value: '科幻' },
        { label: '悬疑', value: '悬疑' },
        { label: '犯罪', value: '犯罪' },
        { label: '惊悚', value: '惊悚' },
        { label: '冒险', value: '冒险' },
        { label: '音乐', value: '音乐' },
        { label: '历史', value: '历史' },
        { label: '奇幻', value: '奇幻' },
        { label: '恐怖', value: '恐怖' },
        { label: '战争', value: '战争' },
        { label: '传记', value: '传记' },
        { label: '歌舞', value: '歌舞' },
        { label: '武侠', value: '武侠' },
        { label: '情色', value: '情色' },
        { label: '灾难', value: '灾难' },
        { label: '西部', value: '西部' },
        { label: '纪录片', value: '纪录片' },
        { label: '短片', value: '短片' },
      ],
    },
    ...SHARED_FILTER_GROUPS,
    {
      key: "sort",
      label: "排序",
      defaultValue: "T",
      options: [
        { label: '综合排序', value: 'T' },
        { label: '近期热度', value: 'U' },
        { label: '首映时间', value: 'R' },
        { label: '高分优先', value: 'S' },
      ],
    },
  ],
};

export const ALL_MEDIA_KIND_SELECTOR_GROUP: DoubanFilterGroup = {
  key: "kind",
  label: "分类",
  defaultValue: "tv",
  options: [
    { label: "电视剧", value: "tv" },
    { label: "电影", value: "movie" },
  ],
};

export const DOUBAN_ALL_FILTER_GROUPS: DoubanFilterGroup[] = [
  ALL_MEDIA_KIND_SELECTOR_GROUP,
  ...DOUBAN_FILTERS_METADATA.tv,
];

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
