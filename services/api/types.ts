export interface DoubanItem {
  title: string;
  poster: string;
  rate?: string;
}

export interface DoubanResponse {
  code: number;
  message: string;
  list: DoubanItem[];
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

export interface DiscoverResponse {
  list: DoubanRecommendationItem[];
}

export interface DoubanRecommendationResponse {
  code: number;
  message?: string;
  list: DoubanRecommendationItem[];
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
}

export interface SearchResultWithResolution extends SearchResult {
  resolution?: string | null;
  dedupeKey?: string;
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
}

export interface ApiSite {
  key: string;
  api: string;
  name: string;
  detail?: string;
}

export interface ServerConfig {
  SiteName: string;
  StorageType: "localstorage" | "redis" | string;
}
