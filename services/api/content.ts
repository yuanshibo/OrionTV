import { ApiClient } from "./core";
import {
  DoubanResponse,
  DoubanRecommendationFilters,
  DoubanRecommendationResponse,
  DiscoverResponse,
  SearchResult,
  ApiSite,
  VideoDetail
} from "./types";

export class ContentApi {
  constructor(private client: ApiClient) {}

  getImageProxyUrl(imageUrl: string): string {
    return `${this.client.baseURL}/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
  }

  async getDoubanData(
    type: "movie" | "tv",
    tag: string,
    pageSize: number = 16,
    pageStart: number = 0,
    signal?: AbortSignal
  ): Promise<DoubanResponse> {
    const url = `/api/douban?type=${type}&tag=${encodeURIComponent(tag)}&pageSize=${pageSize}&pageStart=${pageStart}`;
    const response = await this.client.fetch(url, { signal });
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

    const response = await this.client.fetch('/api/douban/recommends?' + params.toString(), { signal });
    return response.json();
  }

  async discover(page: number, limit: number): Promise<DiscoverResponse> {
    const response = await this.client.fetch(`/api/discover?page=${page}&limit=${limit}`);
    const data = await response.json();
    return { list: data.results || [] };
  }

  async aiAssistantSearch(query: string, signal?: AbortSignal): Promise<{ results: SearchResult[] }> {
    const response = await this.client.fetch('/api/ai/assistant', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      signal
    });
    return response.json();
  }

  async searchVideos(query: string): Promise<{ results: SearchResult[] }> {
    const url = `/api/search?q=${encodeURIComponent(query)}`;
    const response = await this.client.fetch(url);
    return response.json();
  }

  async searchVideo(query: string, resourceId: string, signal?: AbortSignal): Promise<{ results: SearchResult[] }> {
    const url = `/api/search/one?q=${encodeURIComponent(query)}&resourceId=${encodeURIComponent(resourceId)}`;
    const response = await this.client.fetch(url, { signal });
    const { results } = await response.json();
    return { results: results.filter((item: any) => item.title === query )};
  }

  async getResources(signal?: AbortSignal): Promise<ApiSite[]> {
    const url = `/api/search/resources`;
    const response = await this.client.fetch(url, { signal });
    return response.json();
  }

  async getVideoDetail(source: string, id: string): Promise<VideoDetail> {
    const url = `/api/detail?source=${source}&id=${id}`;
    const response = await this.client.fetch(url);
    return response.json();
  }
}
