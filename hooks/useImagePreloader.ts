import { useCallback, useEffect, useRef } from 'react';
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
  const lastOffsetRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const handleScroll = useCallback(
    (offset: number, contentSize: number, layoutSize: number) => {
      if (!enablePreload || !items.length || contentSize === 0) return;

      const now = Date.now();
      // Throttle: only execute if offset changed by > 80px or at least 150ms passed
      if (Math.abs(offset - lastOffsetRef.current) < 80 && now - lastTimeRef.current < 150) {
        return;
      }
      lastOffsetRef.current = offset;
      lastTimeRef.current = now;

      // Calculate approximate current index
      const currentIndex = Math.floor((offset / contentSize) * items.length);

      // Preload next batch of images
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
