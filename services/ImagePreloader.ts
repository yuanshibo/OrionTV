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
      // 如果队列中已经有该 URL，说明正在加载或已排队，跳过
      if (!url || this.loadingQueue.has(url)) continue;

      this.loadingQueue.add(url);

      let incremented = false;
      try {
        // 限制并发数
        while (this.activeLoads >= this.maxConcurrent) {
          await new Promise(resolve => setTimeout(resolve, 50));
          // 如果等待期间队列被清空了（调用了 clear），则停止当前任务
          if (!this.loadingQueue.has(url)) return;
        }

        // 再次检查，防止在等待并发锁期间调用了 clear()
        if (!this.loadingQueue.has(url)) return;

        this.activeLoads++;
        incremented = true;

        await Image.prefetch(url);
      } catch (error) {
        // 静默失败，不影响主流程
      } finally {
        const wasInQueue = this.loadingQueue.has(url);
        if (incremented) {
          this.activeLoads = Math.max(0, this.activeLoads - 1);
        }
        this.loadingQueue.delete(url);

        // 如果在处理过程中 url 从队列中消失了（说明调用了 clear），则停止此批次的后续预加载
        if (!wasInQueue) return;
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
    // 注意：不在这里将 activeLoads 置为 0，以防止正在进行的请求完成时导致计数器变为负数
  }
}
