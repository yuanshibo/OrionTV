import AsyncStorage from "@react-native-async-storage/async-storage";
import Logger from "@/utils/Logger";

export const NETWORK_STATUS_ZERO_MESSAGE = "Network request failed (status 0)";
export const NETWORK_STATUS_ZERO_ERROR_NAME = "NetworkStatusZeroError";

export const isNetworkStatusZeroError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.name === NETWORK_STATUS_ZERO_ERROR_NAME) {
    return true;
  }

  if (error.message === NETWORK_STATUS_ZERO_MESSAGE) {
    return true;
  }

  return /status provided \(0\)/i.test(error.message);
};

const logger = Logger.withTag("API");

const isStatusZeroRangeError = (error: unknown): error is RangeError =>
  error instanceof RangeError && /status provided \(0\)/i.test(error.message);

const createNetworkStatusZeroError = (cause?: unknown): Error => {
  const networkError = new Error(NETWORK_STATUS_ZERO_MESSAGE);
  networkError.name = NETWORK_STATUS_ZERO_ERROR_NAME;
  if (cause) {
    (networkError as any).cause = cause;
  }
  return networkError;
};

// region: --- Interface Definitions ---
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

export class API {
  public baseURL: string = "";

  constructor(baseURL?: string) {
    if (baseURL) {
      this.baseURL = baseURL;
    }
  }

  public setBaseUrl(url: string) {
    this.baseURL = url;
  }

  private async _fetch(url: string, options: RequestInit = {}): Promise<Response> {
    if (!this.baseURL) {
      throw new Error("API_URL_NOT_SET");
    }

    let response: Response;

    try {
      response = await fetch(`${this.baseURL}${url}`, options);
    } catch (error) {
      if (isStatusZeroRangeError(error)) {
        logger.warn(
          `[WARN] fetch failed with status 0 for ${url} (baseURL: ${this.baseURL}), treating as network error`
        );
        throw createNetworkStatusZeroError(error);
      }
      throw error;
    }

    if (response.status === 0) {
      logger.warn(
        `[WARN] fetch resolved with status 0 for ${url} (baseURL: ${this.baseURL}), treating as network error`
      );
      throw createNetworkStatusZeroError();
    }

    if (response.status === 401) {
      throw new Error("UNAUTHORIZED");
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response;
  }

  async login(username?: string | undefined, password?: string): Promise<{ ok: boolean }> {
    const response = await this._fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    // 存储cookie到AsyncStorage
    const cookies = response.headers.get("Set-Cookie");
    if (cookies) {
      await AsyncStorage.setItem("authCookies", cookies);
    }

    return response.json();
  }

  async logout(): Promise<{ ok: boolean }> {
    const response = await this._fetch("/api/logout", {
      method: "POST",
    });
    await AsyncStorage.setItem("authCookies", '');
    return response.json();
  }

  async getServerConfig(): Promise<ServerConfig> {
    const response = await this._fetch("/api/server-config");
    return response.json();
  }

  async getFavorites(key?: string): Promise<Record<string, Favorite> | Favorite | null> {
    const url = key ? `/api/favorites?key=${encodeURIComponent(key)}` : "/api/favorites";
    const response = await this._fetch(url);
    return response.json();
  }

  async addFavorite(key: string, favorite: Omit<Favorite, "save_time">): Promise<{ success: boolean }> {
    const response = await this._fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, favorite }),
    });
    return response.json();
  }

  async deleteFavorite(key?: string): Promise<{ success: boolean }> {
    const url = key ? `/api/favorites?key=${encodeURIComponent(key)}` : "/api/favorites";
    const response = await this._fetch(url, { method: "DELETE" });
    return response.json();
  }

  async getPlayRecords(): Promise<Record<string, PlayRecord>> {
    const response = await this._fetch("/api/playrecords");
    return response.json();
  }

  async savePlayRecord(key: string, record: Omit<PlayRecord, "save_time">): Promise<{ success: boolean }> {
    const response = await this._fetch("/api/playrecords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, record }),
    });
    return response.json();
  }

  async deletePlayRecord(key?: string): Promise<{ success: boolean }> {
    const url = key ? `/api/playrecords?key=${encodeURIComponent(key)}` : "/api/playrecords";
    const response = await this._fetch(url, { method: "DELETE" });
    return response.json();
  }

  async getSearchHistory(): Promise<string[]> {
    const response = await this._fetch("/api/searchhistory");
    return response.json();
  }

  async addSearchHistory(keyword: string): Promise<string[]> {
    const response = await this._fetch("/api/searchhistory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword }),
    });
    return response.json();
  }

  async deleteSearchHistory(keyword?: string): Promise<{ success: boolean }> {
    const url = keyword ? `/api/searchhistory?keyword=${keyword}` : "/api/searchhistory";
    const response = await this._fetch(url, { method: "DELETE" });
    return response.json();
  }

  getImageProxyUrl(imageUrl: string): string {
    return `${this.baseURL}/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
  }

  async getDoubanData(
    type: "movie" | "tv",
    tag: string,
    pageSize: number = 16,
    pageStart: number = 0,
    signal?: AbortSignal
  ): Promise<DoubanResponse> {
    const url = `/api/douban?type=${type}&tag=${encodeURIComponent(tag)}&pageSize=${pageSize}&pageStart=${pageStart}`;
    const response = await this._fetch(url, { signal });
    return response.json();
  }

  async getDoubanRecommendations(
    kind: "movie" | "tv",
    filters: DoubanRecommendationFilters,
    signal?: AbortSignal
  ): Promise<DoubanRecommendationResponse> {
    const params = new URLSearchParams();
    params.set("kind", kind);
    params.set("limit", String(filters.limit ?? 25));
    params.set("start", String(filters.start ?? 0));
    params.set("category", filters.category ?? "all");
    params.set("format", filters.format ?? (kind === 'movie' ? '' : 'all'));
    params.set("region", filters.region ?? "all");
    params.set("year", filters.year ?? "all");
    params.set("platform", filters.platform ?? "all");
    params.set("sort", filters.sort ?? "T");
    params.set("label", filters.label ?? "all");

    logger.info(`[info] test--- ${params.toString()}`);

    const response = await this._fetch('/api/douban/recommends?' + params.toString(), { signal });
    return response.json();
  }

  async searchVideos(query: string): Promise<{ results: SearchResult[] }> {
    const url = `/api/search?q=${encodeURIComponent(query)}`;
    const response = await this._fetch(url);
    return response.json();
  }

  async searchVideo(query: string, resourceId: string, signal?: AbortSignal): Promise<{ results: SearchResult[] }> {
    const url = `/api/search/one?q=${encodeURIComponent(query)}&resourceId=${encodeURIComponent(resourceId)}`;
    const response = await this._fetch(url, { signal });
    const { results } = await response.json();
    return { results: results.filter((item: any) => item.title === query )};
  }

  async getResources(signal?: AbortSignal): Promise<ApiSite[]> {
    const url = `/api/search/resources`;
    const response = await this._fetch(url, { signal });
    return response.json();
  }

  async getVideoDetail(source: string, id: string): Promise<VideoDetail> {
    const url = `/api/detail?source=${source}&id=${id}`;
    const response = await this._fetch(url);
    return response.json();
  }
}

// 默认实例
export let api = new API();
