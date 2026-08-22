import { SearchResultWithResolution } from "@/services/api";
import { probeM3U8, M3U8ProbeResult } from "@/services/m3u8";
import { APP_CONFIG } from "@/constants/AppConfig";

export type DetailCacheEntry = {
  timestamp: number;
  detail: SearchResultWithResolution | null;
  searchResults: SearchResultWithResolution[];
  sources: { source: string; source_name: string; resolution: string | null | undefined }[];
  allSourcesLoaded: boolean;
};

const detailCache = new Map<string, DetailCacheEntry>();
const probeCache = new Map<string, { value: M3U8ProbeResult; timestamp: number }>();
const probeCachePending = new Map<string, Promise<M3U8ProbeResult>>();

export const getDetailCacheEntry = (cacheKey: string): DetailCacheEntry | null => {
  const entry = detailCache.get(cacheKey);
  if (!entry) {
    return null;
  }

  if (Date.now() - entry.timestamp > APP_CONFIG.DETAIL.CACHE_TTL) {
    detailCache.delete(cacheKey);
    return null;
  }

  return entry;
};

export const setDetailCacheEntry = (
  cacheKey: string,
  detail: SearchResultWithResolution | null,
  searchResults: SearchResultWithResolution[],
  sources: { source: string; source_name: string; resolution: string | null | undefined }[],
  allSourcesLoaded: boolean
) => {
  detailCache.set(cacheKey, {
    timestamp: Date.now(),
    detail: detail ? { ...detail } : null,
    searchResults: searchResults.map((item) => ({ ...item })),
    sources: sources.map((item) => ({ ...item })),
    allSourcesLoaded,
  });

  if (detailCache.size > APP_CONFIG.DETAIL.CACHE_MAX_ENTRIES) {
    let oldestKey: string | null = null;
    let oldestTimestamp = Number.POSITIVE_INFINITY;
    for (const [key, value] of Array.from(detailCache.entries())) {
      if (value.timestamp < oldestTimestamp) {
        oldestTimestamp = value.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      detailCache.delete(oldestKey);
    }
  }
};

export const probeM3U8WithCache = async (
  episodeUrl: string,
  signal?: AbortSignal
): Promise<M3U8ProbeResult> => {
  if (!episodeUrl) {
    return { available: false, resolution: null, error: "Empty URL" };
  }

  const cached = probeCache.get(episodeUrl);
  if (cached && Date.now() - cached.timestamp < APP_CONFIG.DETAIL.RESOLUTION_CACHE_TTL) {
    return cached.value;
  }

  const pending = probeCachePending.get(episodeUrl);
  if (pending) {
    return pending;
  }

  const fetchPromise = (async () => {
    try {
      const result = await probeM3U8(episodeUrl, signal);
      probeCache.set(episodeUrl, { value: result, timestamp: Date.now() });
      return result;
    } finally {
      probeCachePending.delete(episodeUrl);
    }
  })();

  probeCachePending.set(episodeUrl, fetchPromise);

  try {
    return await fetchPromise;
  } catch (error) {
    probeCache.delete(episodeUrl);
    throw error;
  }
};

export const getResolutionWithCache = async (
  episodeUrl: string,
  signal?: AbortSignal
): Promise<string | undefined> => {
  const result = await probeM3U8WithCache(episodeUrl, signal);
  return result.resolution || undefined;
};
