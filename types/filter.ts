import { DoubanRecommendationFilters } from "./media";

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
