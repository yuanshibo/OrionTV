import {
  DoubanItem,
  DoubanRecommendationItem,
  ApiSite,
  PlayRecord,
  Favorite,
} from "./media";

export interface DoubanResponse {
  code: number;
  message: string;
  list: DoubanItem[];
}

export interface DiscoverResponse {
  list: DoubanRecommendationItem[];
}

export interface DoubanRecommendationResponse {
  code: number;
  message?: string;
  list: DoubanRecommendationItem[];
}

export interface ResourcesResponse {
  code: number;
  message?: string;
  list: ApiSite[];
}

export interface PlayRecordsResponse {
  code: number;
  message?: string;
  list: PlayRecord[];
}

export interface FavoritesResponse {
  code: number;
  message?: string;
  list: Favorite[];
}
