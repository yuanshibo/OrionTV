interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Default Cache duration: 10 minutes
const DEFAULT_TTL = 10 * 60 * 1000;

class CacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private inFlightRequests = new Map<string, Promise<any>>();

  /**
   * Retrieves an entry from the cache if it exists and has not expired.
   * @param key The cache key.
   * @param ttl Optional override for TTL.
   * @returns The cached data or null if not found or expired.
   */
  get<T>(key: string, ttl: number = DEFAULT_TTL): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    const isExpired = Date.now() - entry.timestamp > ttl;
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
   * 执行请求，支持自动缓存和请求去重
   * @param key 缓存键
   * @param fetcher 实际请求函数
   * @param options 缓存配置
   */
  async execute<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: { ttl?: number; skipCache?: boolean } = {}
  ): Promise<T> {
    const { ttl = DEFAULT_TTL, skipCache = false } = options;

    // 1. 检查有效缓存
    if (!skipCache) {
      const cached = this.get<T>(key, ttl);
      if (cached) return cached;
    }

    // 2. 检查是否有正在进行的相同请求 (请求去重)
    if (this.inFlightRequests.has(key)) {
      return this.inFlightRequests.get(key) as Promise<T>;
    }

    // 3. 执行单次请求并缓存
    const requestPromise = fetcher().finally(() => {
      this.inFlightRequests.delete(key);
    });

    this.inFlightRequests.set(key, requestPromise);

    try {
      const data = await requestPromise;
      this.set(key, data);
      return data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Clears the entire cache or entries matching a pattern.
   * @param pattern Optional string pattern to match keys.
   */
  clear(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      this.inFlightRequests.clear();
      return;
    }

    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

export const cacheService = new CacheService();
