import AsyncStorage from "@react-native-async-storage/async-storage";
import { RowItem, CacheItem, Category } from "./dataTypes";

const CACHE_EXPIRE_TIME = 5 * 60 * 1000; // 5 minutes
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

class ContentCacheService {
  private dataCache = new Map<string, CacheItem>();
  private persistCacheTimeout: ReturnType<typeof setTimeout> | null = null;
  private hydrationPromise: Promise<void> | null = null;
  private _isHydrated = false;

  public get isHydrated() {
    return this._isHydrated;
  }

  public getCacheKey(category: Category) {
    let key = `${category.type || 'unknown'}-${category.title}-${category.tag || ''}`;
    if (category.activeFilters) {
      // Sort keys to ensure consistent order
      const filterPart = Object.entries(category.activeFilters)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, v]) => `${k}:${v}`)
        .join('|');
      key += `-${filterPart}`;
    }
    return key;
  }

  public isValidCache(cacheItem: CacheItem) {
    return Date.now() - cacheItem.timestamp < CACHE_EXPIRE_TIME;
  }

  public getValidCacheEntry(category: Category): CacheItem | undefined {
    const key = this.getCacheKey(category);
    const cached = this.dataCache.get(key);

    if (!cached) {
      return undefined;
    }

    if (!this.isValidCache(cached)) {
      this.dataCache.delete(key);
      return undefined;
    }

    return cached;
  }

  public createCacheEntry(type: CacheItem["type"], items: RowItem[], hasMore: boolean): CacheItem {
    return {
      data: items.slice(0, MAX_ITEMS_PER_CACHE),
      timestamp: Date.now(),
      type,
      hasMore,
    };
  }

  public writeCacheEntry(category: Category, items: RowItem[], hasMore: boolean) {
    const key = this.getCacheKey(category);
    const type = category.type || 'movie';
    // Ensure type is valid for CacheItem (record, movie, tv)
    const validType = (type === 'record' || type === 'tv' || type === 'movie') ? type : 'movie';

    const entry = this.createCacheEntry(validType, items, hasMore);

    this.pruneExpiredCacheEntries();

    if (this.dataCache.has(key)) {
      this.dataCache.delete(key);
    }

    while (this.dataCache.size >= MAX_CACHE_SIZE) {
      const { value: oldestKey, done } = this.dataCache.keys().next();
      if (done || oldestKey === undefined) {
        break;
      }
      this.dataCache.delete(oldestKey);
    }

    this.dataCache.set(key, entry);
    this.persistCacheToStorage();
  }

  public appendCacheEntry(category: Category, items: RowItem[], hasMore: boolean) {
    const key = this.getCacheKey(category);
    const existing = this.getValidCacheEntry(category);
    const type = existing ? existing.type : (category.type === 'record' || category.type === 'tv' ? category.type : 'movie');

    const mergedItems = existing ? [...existing.data, ...items] : items;
    this.writeCacheEntry(category, mergedItems, hasMore);
  }

  private pruneExpiredCacheEntries() {
    for (const [key, value] of this.dataCache.entries()) {
      if (!this.isValidCache(value)) {
        this.dataCache.delete(key);
      }
    }
  }

  private snapshotCachePayload(): PersistedCachePayload {
    return {
      version: HOME_CACHE_VERSION,
      entries: Array.from(this.dataCache.entries()).map(([key, value]) => ({
        key,
        data: value.data,
        timestamp: value.timestamp,
        type: value.type,
        hasMore: value.hasMore,
      })),
    };
  }

  private sanitizePersistedCacheEntry(entry: PersistedCacheEntry): CacheItem | null {
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
  }

  private persistCacheToStorage() {
    if (this.persistCacheTimeout) {
      clearTimeout(this.persistCacheTimeout);
    }

    this.persistCacheTimeout = setTimeout(() => {
      this.persistCacheTimeout = null;
      try {
        const payload = this.snapshotCachePayload();
        void AsyncStorage.setItem(HOME_CACHE_STORAGE_KEY, JSON.stringify(payload));
      } catch (_error) {
        // ignore persistence errors
      }
    }, 150);
  }

  public async hydrateFromStorage(): Promise<void> {
    if (this._isHydrated) return;

    if (this.hydrationPromise) {
      await this.hydrationPromise;
      return;
    }

    this.hydrationPromise = (async () => {
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
          const sanitized = this.sanitizePersistedCacheEntry(entry);
          if (!sanitized || !this.isValidCache(sanitized)) {
            return;
          }

          this.dataCache.set(entry.key, sanitized);
        });

        this.pruneExpiredCacheEntries();
        this.persistCacheToStorage();
      } catch (_error) {
        // ignore hydration errors
      } finally {
        this.hydrationPromise = null;
        this._isHydrated = true;
      }
    })();

    await this.hydrationPromise;
  }
}

export const contentCacheService = new ContentCacheService();
