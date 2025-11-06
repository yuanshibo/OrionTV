interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Cache duration: 10 minutes
const CACHE_DURATION = 10 * 60 * 1000;

class CacheService {
  private cache = new Map<string, CacheEntry<any>>();

  /**
   * Retrieves an entry from the cache if it exists and has not expired.
   * @param key The cache key.
   * @returns The cached data or null if not found or expired.
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    const isExpired = Date.now() - entry.timestamp > CACHE_DURATION;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Adds or updates an entry in the cache with the current timestamp.
   * @param key The cache key.
   * @param data The data to be cached.
   */
  set<T>(key: string, data: T): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };
    this.cache.set(key, entry);
  }

  /**
   * Clears the entire cache.
   */
  clear(): void {
    this.cache.clear();
  }
}

export const cacheService = new CacheService();
