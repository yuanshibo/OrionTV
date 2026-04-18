import { useCallback, useEffect } from 'react';
import { ImagePreloader } from '@/services/ImagePreloader';

interface UseImagePreloaderOptions {
  preloadCount?: number;
  enablePreload?: boolean;
}

/**
 * Hook：自动预加载滚动列表中的图片
 */
export function useImagePreloader(
  items: any[],
  options: UseImagePreloaderOptions = {}
) {
  const { preloadCount = 6, enablePreload = true } = options;

  const handleScroll = useCallback(
    (offset: number, contentSize: number, layoutSize: number) => {
      if (!enablePreload || !items.length || contentSize === 0) return;

      // 计算当前大约显示的索引
      const currentIndex = Math.floor((offset / contentSize) * items.length);

      // 预加载下一批图片
      ImagePreloader.preloadNextItems(items, currentIndex, preloadCount);
    },
    [items, preloadCount, enablePreload]
  );

  useEffect(() => {
    return () => {
      ImagePreloader.clear();
    };
  }, []);

  return { handleScroll };
}
