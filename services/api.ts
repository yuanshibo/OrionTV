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
  type?: string;
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
  type?: string;
  duration?: number;
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
  /** 收到 401 时的全局回调，由 authStore 注册，用于自动退出登录 */
  public onUnauthorized: (() => void) | null = null;
  private inflightRequests = new Map<string, Promise<any>>();

  constructor(baseURL?: string) {
    if (baseURL) {
      this.baseURL = baseURL;
    }
  }

  public setBaseUrl(url: string) {
    this.baseURL = url;
  }

  private async _fetchData<T>(url: string, options: RequestInit = {}, retries = 2): Promise<T> {
    const isGet = !options.method || options.method === "GET";
    const cacheKey = `${url}:${JSON.stringify(options.headers || {})}`;

    if (isGet && this.inflightRequests.has(cacheKey)) {
      return this.inflightRequests.get(cacheKey);
    }

    const requestPromise = (async () => {
      let lastError: any;
      for (let i = 0; i <= retries; i++) {
        try {
          const response = await this._fetch(url, options);
          return await response.json();
        } catch (error) {
          lastError = error;
          // Only retry on network status 0 or potential transient network issues
          if (isNetworkStatusZeroError(error) && i < retries) {
            const delay = Math.pow(2, i) * 1000;
            logger.warn(`[API] Transient error on ${url}, retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          throw error;
        }
      }
      throw lastError;
    })().finally(() => {
      if (isGet) {
        this.inflightRequests.delete(cacheKey);
      }
    });

    if (isGet) {
      this.inflightRequests.set(cacheKey, requestPromise);
    }

    return requestPromise;
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
      if (this.onUnauthorized) {
        this.onUnauthorized();
      }
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

    const data = await response.json();

    // Manual saving of cookie for persistence checks
    if (data?.ok) {
      const setCookie = response.headers.get("set-cookie");
      if (setCookie) {
        await AsyncStorage.setItem("authCookies", setCookie);
      }
    }

    return data;
  }

  async logout(): Promise<{ ok: boolean }> {
    const res = await this._fetchData<{ ok: boolean }>("/api/logout", {
      method: "POST",
    });
    await AsyncStorage.setItem("authCookies", '');
    return res;
  }

  async getServerConfig(): Promise<ServerConfig> {
    return this._fetchData("/api/server-config");
  }

  async getFavorites(key?: string): Promise<Record<string, Favorite> | Favorite | null> {
    const url = key ? `/api/favorites?key=${encodeURIComponent(key)}` : "/api/favorites";
    return this._fetchData(url);
  }

  async addFavorite(key: string, favorite: Omit<Favorite, "save_time">): Promise<{ success: boolean }> {
    return this._fetchData("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, favorite }),
    });
  }

  async deleteFavorite(key?: string): Promise<{ success: boolean }> {
    const url = key ? `/api/favorites?key=${encodeURIComponent(key)}` : "/api/favorites";
    return this._fetchData(url, { method: "DELETE" });
  }

  async getPlayRecords(key?: string): Promise<Record<string, PlayRecord> | PlayRecord | null> {
    const url = key ? `/api/playrecords?key=${encodeURIComponent(key)}` : "/api/playrecords";
    return this._fetchData(url);
  }

  async savePlayRecord(key: string, record: Omit<PlayRecord, "save_time">): Promise<{ success: boolean }> {
    return this._fetchData("/api/playrecords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, record }),
    });
  }

  async deletePlayRecord(key?: string): Promise<{ success: boolean }> {
    const url = key ? `/api/playrecords?key=${encodeURIComponent(key)}` : "/api/playrecords";
    return this._fetchData(url, { method: "DELETE" });
  }

  async getSearchHistory(): Promise<string[]> {
    return this._fetchData("/api/searchhistory");
  }

  async addSearchHistory(keyword: string): Promise<string[]> {
    return this._fetchData("/api/searchhistory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword }),
    });
  }

  async deleteSearchHistory(keyword?: string): Promise<{ success: boolean }> {
    const url = keyword ? `/api/searchhistory?keyword=${keyword}` : "/api/searchhistory";
    return this._fetchData(url, { method: "DELETE" });
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
    return this._fetchData(url, { signal });
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

    return this._fetchData('/api/douban/recommends?' + params.toString(), { signal });
  }

  async discover(page: number, limit: number): Promise<DiscoverResponse> {
    const data = await this._fetchData<any>(`/api/discover?page=${page}&limit=${limit}`);
    return { list: data.results || [] };
  }

  async aiAssistantSearch(query: string, signal?: AbortSignal): Promise<{ results: SearchResult[] }> {
    return this._fetchData('/api/ai/assistant', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      signal
    });
  }

  async searchVideos(query: string): Promise<{ results: SearchResult[] }> {
    return this._fetchData(`/api/search?q=${encodeURIComponent(query)}`);
  }

  async searchVideo(query: string, resourceId: string, signal?: AbortSignal): Promise<{ results: SearchResult[] }> {
    const url = `/api/search/one?q=${encodeURIComponent(query)}&resourceId=${encodeURIComponent(resourceId)}`;
    const { results } = await this._fetchData<any>(url, { signal });
    return { results: results.filter((item: any) => item.title === query) };
  }

  async getResources(signal?: AbortSignal): Promise<ApiSite[]> {
    return this._fetchData(`/api/search/resources`, { signal });
  }

  async getVideoDetail(source: string, id: string): Promise<VideoDetail> {
    return this._fetchData(`/api/detail?source=${source}&id=${id}`);
  }
}

// 默认实例
export let api = new API();
