import { DetailCacheEntry } from "@/types/detail";
import { getResolutionFromM3U8 } from "@/services/m3u8";
import { SearchResultWithResolution } from "@/services/api";

const DETAIL_CACHE_TTL = 10 * 60 * 1000;
const DETAIL_CACHE_MAX_ENTRIES = 8;
const RESOLUTION_CACHE_TTL = 60 * 60 * 1000;

const detailCache = new Map<string, DetailCacheEntry>();
const resolutionCache = new Map<string, { value: string | null | undefined; timestamp: number }>();
const resolutionCachePending = new Map<string, Promise<string | null | undefined>>();

export const getDetailCacheEntry = (cacheKey: string): DetailCacheEntry | null => {
  const entry = detailCache.get(cacheKey);
  if (!entry) {
    return null;
  }

  if (Date.now() - entry.timestamp > DETAIL_CACHE_TTL) {
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

  if (detailCache.size > DETAIL_CACHE_MAX_ENTRIES) {
    let oldestKey: string | null = null;
    let oldestTimestamp = Number.POSITIVE_INFINITY;
    for (const [key, value] of detailCache.entries()) {
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

export const getResolutionWithCache = async (episodeUrl: string, signal?: AbortSignal) => {
  if (!episodeUrl) {
    return undefined;
  }

  const cached = resolutionCache.get(episodeUrl);
  if (cached && Date.now() - cached.timestamp < RESOLUTION_CACHE_TTL) {
    return cached.value;
  }

  const pending = resolutionCachePending.get(episodeUrl);
  if (pending) {
    return pending;
  }

  const fetchPromise = (async () => {
    try {
      const value = await getResolutionFromM3U8(episodeUrl, signal);
      resolutionCache.set(episodeUrl, { value, timestamp: Date.now() });
      return value;
    } finally {
      resolutionCachePending.delete(episodeUrl);
    }
  })();

  resolutionCachePending.set(episodeUrl, fetchPromise);

  try {
    return await fetchPromise;
  } catch (error) {
    resolutionCache.delete(episodeUrl);
    throw error;
  }
};
