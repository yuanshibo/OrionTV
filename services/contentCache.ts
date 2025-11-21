import AsyncStorage from "@react-native-async-storage/async-storage";
import { RowItem } from "@/types/home";

export interface CacheItem {
  data: RowItem[];
  timestamp: number;
  type: 'movie' | 'tv' | 'record';
  hasMore: boolean;
}

const CACHE_EXPIRE_TIME = 5 * 60 * 1000; // cache expires after 5 minutes
const MAX_CACHE_SIZE = 10; // max in-memory buckets
const MAX_ITEMS_PER_CACHE = 40; // max items persisted per bucket

const HOME_CACHE_STORAGE_KEY = "home_content_cache_v1";
const HOME_CACHE_VERSION = 1;

interface PersistedCacheEntry {
  key: string;
  data: RowItem[];
  timestamp: number;
  type: CacheItem["type"];
  hasMore: boolean;
}

interface PersistedCachePayload {
  version: number;
  entries: PersistedCacheEntry[];
}

// 内存缓存，应用生命周期内有效
const dataCache = new Map<string, CacheItem>();
let persistCacheTimeout: ReturnType<typeof setTimeout> | null = null;
let hydrationPromise: Promise<void> | null = null;

export const isValidCache = (cacheItem: CacheItem) => {
  return Date.now() - cacheItem.timestamp < CACHE_EXPIRE_TIME;
};

const snapshotCachePayload = (): PersistedCachePayload => ({
  version: HOME_CACHE_VERSION,
  entries: Array.from(dataCache.entries()).map(([key, value]) => ({
    key,
    data: value.data,
    timestamp: value.timestamp,
    type: value.type,
    hasMore: value.hasMore,
  })),
});

const sanitizePersistedCacheEntry = (entry: PersistedCacheEntry): CacheItem | null => {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const entryType = entry.type;
  const normalizedType: CacheItem["type"] =
    entryType === "movie" || entryType === "tv" || entryType === "record" ? entryType : "movie";
  const timestamp = typeof entry.timestamp === "number" ? entry.timestamp : 0;
  const hasMore = Boolean(entry.hasMore);
  const data = Array.isArray(entry.data) ? entry.data.slice(0, MAX_ITEMS_PER_CACHE) : [];

  return {
    data,
    timestamp,
    type: normalizedType,
    hasMore,
  };
};

const persistCacheToStorage = () => {
  if (persistCacheTimeout) {
    clearTimeout(persistCacheTimeout);
  }

  persistCacheTimeout = setTimeout(() => {
    persistCacheTimeout = null;
    try {
      const payload = snapshotCachePayload();
      void AsyncStorage.setItem(HOME_CACHE_STORAGE_KEY, JSON.stringify(payload));
    } catch (_error) {
      // ignore persistence errors
    }
  }, 150);
};

const pruneExpiredCacheEntries = () => {
  for (const [key, value] of dataCache.entries()) {
    if (!isValidCache(value)) {
      dataCache.delete(key);
    }
  }
};

export const hydrateCacheFromStorage = async (): Promise<void> => {
  if (hydrationPromise) {
    await hydrationPromise;
    return;
  }

  hydrationPromise = (async () => {
    try {
      const stored = await AsyncStorage.getItem(HOME_CACHE_STORAGE_KEY);
      if (!stored) {
        return;
      }

      const payload = JSON.parse(stored) as PersistedCachePayload;
      if (!payload || payload.version !== HOME_CACHE_VERSION || !Array.isArray(payload.entries)) {
        return;
      }

      payload.entries.forEach((entry) => {
        const sanitized = sanitizePersistedCacheEntry(entry);
        if (!sanitized || !isValidCache(sanitized)) {
          return;
        }

        dataCache.set(entry.key, sanitized);
      });

      pruneExpiredCacheEntries();
      persistCacheToStorage();
    } catch (_error) {
      // ignore hydration errors
    } finally {
      hydrationPromise = null;
    }
  })();

  await hydrationPromise;
};

export const getValidCacheEntry = (cacheKey: string): CacheItem | undefined => {
  const cached = dataCache.get(cacheKey);
  if (!cached) {
    return undefined;
  }

  if (!isValidCache(cached)) {
    dataCache.delete(cacheKey);
    return undefined;
  }

  return cached;
};

export const createCacheEntry = (type: CacheItem["type"], items: RowItem[], hasMore: boolean): CacheItem => ({
  data: items.slice(0, MAX_ITEMS_PER_CACHE),
  timestamp: Date.now(),
  type,
  hasMore,
});

export const writeCacheEntry = (cacheKey: string, entry: CacheItem) => {
  pruneExpiredCacheEntries();

  if (dataCache.has(cacheKey)) {
    dataCache.delete(cacheKey);
  }

  while (dataCache.size >= MAX_CACHE_SIZE) {
    const { value: oldestKey, done } = dataCache.keys().next();
    if (done || oldestKey === undefined) {
      break;
    }
    dataCache.delete(oldestKey);
  }

  dataCache.set(cacheKey, entry);
  persistCacheToStorage();
};

export const appendCacheEntry = (cacheKey: string, type: CacheItem["type"], items: RowItem[], hasMore: boolean) => {
  const existing = getValidCacheEntry(cacheKey);
  const mergedItems = existing ? [...existing.data, ...items] : items;
  writeCacheEntry(cacheKey, createCacheEntry(type, mergedItems, hasMore));
};
