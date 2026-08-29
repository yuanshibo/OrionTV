import type { DoubanFilterConfig } from "./filter";

export interface DoubanItem {
  title: string;
  poster: string;
  rate?: string;
}

export interface DoubanRecommendationItem {
  id?: string;
  title: string;
  poster: string;
  rate?: string;
  url?: string;
  year?: string;
  region?: string;
  platform?: string;
  type?: string;
}

export interface DoubanRecommendationFilters {
  kind?: "movie" | "tv";
  category?: string;
  format?: string;
  region?: string;
  year?: string;
  platform?: string;
  sort?: string;
  label?: string;
  start?: number;
  limit?: number;
}

export interface VideoDetail {
  id: string;
  title: string;
  poster: string;
  source: string;
  source_name: string;
  desc?: string;
  type?: string;
  year?: string;
  area?: string;
  director?: string;
  actor?: string;
  remarks?: string;
  episodes?: {
    name?: string;
    url?: string;
    [key: string]: any;
  }[];
}

export interface SearchResult {
  id: number;
  title: string;
  poster: string;
  episodes: string[];
  source: string;
  source_name: string;
  class?: string;
  year: string;
  desc?: string;
  type_name?: string;
  type?: string;
}

export interface SearchResultWithResolution extends SearchResult {
  resolution?: string | null;
  dedupeKey?: string;
}

export interface ApiSite {
  key: string;
  api: string;
  name: string;
  detail?: string;
}

export interface PlayRecord {
  title: string;
  source_name: string;
  cover: string;
  index: number;
  total_episodes: number;
  play_time: number;
  total_time: number;
  save_time: number;
  year: string;
  type?: string;
  duration?: number;
  introEndTime?: number;
  outroStartTime?: number;
  playbackRate?: number;
  description?: string;
}

export interface Favorite {
  cover: string;
  title: string;
  source_name: string;
  total_episodes: number;
  search_title: string;
  year: string;
  save_time?: number;
  description?: string;
}

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
  isCompleted?: boolean;
  isEpisodeFinished?: boolean;
};

export type ActiveDoubanFilters = Partial<Omit<DoubanRecommendationFilters, "start" | "limit">>;

export interface Category {
  title: string;
  type?: "movie" | "tv" | "record";
  tag?: string;
  tags?: string[];
  filterConfig?: DoubanFilterConfig;
  activeFilters?: ActiveDoubanFilters;
}

export interface CacheItem {
  data: RowItem[];
  timestamp: number;
  type: "movie" | "tv" | "record";
  hasMore: boolean;
}
