/**
 * 图片预加载服务
 * 在用户浏览或滚动时，提前加载即将显示的图片
 */
import { Image } from 'expo-image';

export class ImagePreloader {
  private static loadingQueue = new Set<string>();
  private static maxConcurrent = 3;
  private static activeLoads = 0;

  /**
   * 预加载图片
   */
  static async preload(urls: string[]): Promise<void> {
    for (const url of urls) {
      if (!url || this.loadingQueue.has(url)) continue;

      this.loadingQueue.add(url);

      // 限制并发数
      while (this.activeLoads >= this.maxConcurrent) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      this.activeLoads++;

      try {
        await Image.prefetch(url);
        if (__DEV__) {
          // console.debug(`[ImagePreloader] Preloaded: ${url}`);
        }
      } catch (error) {
        // 静默失败，不影响主流程
      } finally {
        this.activeLoads--;
        this.loadingQueue.delete(url);
      }
    }
  }

  /**
   * 根据当前索引预加载后续项目
   */
  static preloadNextItems(
    items: Array<{ poster?: string }>,
    currentIndex: number,
    preloadCount: number = 6
  ): void {
    const startIndex = currentIndex + 1;
    const endIndex = Math.min(startIndex + preloadCount, items.length);

    const urlsToPreload = items
      .slice(startIndex, endIndex)
      .map((item) => item.poster)
      .filter((url): url is string => !!url);

    if (urlsToPreload.length > 0) {
      this.preload(urlsToPreload).catch(() => {});
    }
  }

  /**
   * 清空队列
   */
  static clear(): void {
    this.loadingQueue.clear();
    this.activeLoads = 0;
  }
}
