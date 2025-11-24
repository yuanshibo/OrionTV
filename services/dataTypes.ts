import { SearchResult, PlayRecord, DoubanRecommendationFilters } from "@/services/api";

export { SearchResult, PlayRecord, DoubanRecommendationFilters };

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

export type DoubanFilterKey = Exclude<keyof DoubanRecommendationFilters, "start" | "limit">;

export interface DoubanFilterOption {
  label: string;
  value: string;
}

export type DoubanFilterGroup =
  | {
      key: "kind";
      label: string;
      options: { label: string; value: "movie" | "tv" }[];
      defaultValue: "movie" | "tv";
    }
  | {
      key: Exclude<DoubanFilterKey, "kind">;
      label: string;
      options: DoubanFilterOption[];
      defaultValue: string;
    };

export interface DoubanFilterConfig {
  kind: "movie" | "tv";
  groups: DoubanFilterGroup[];
  staticFilters?: Partial<DoubanRecommendationFilters>;
}

export type ActiveDoubanFilters = Partial<Omit<DoubanRecommendationFilters, "start" | "limit" | "category">> & {
  category?: string;
};

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
  type: 'movie' | 'tv' | 'record';
  hasMore: boolean;
}
