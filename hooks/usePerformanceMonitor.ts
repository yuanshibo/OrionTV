import { useEffect } from 'react';
import { PerformanceMonitor } from '@/utils/PerformanceMonitor';

/**
 * Hook: 启用性能监测，可选地显示指标
 */
export function usePerformanceMonitor(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    PerformanceMonitor.start();

    if (__DEV__) {
      const unsubscribe = PerformanceMonitor.subscribe((metrics) => {
        // console.log(`[Perf] FPS: ${metrics.fps}, Render: ${metrics.renderTime.toFixed(2)}ms`);
      });

      return () => {
        unsubscribe();
        PerformanceMonitor.stop();
      };
    }

    return () => {
      PerformanceMonitor.stop();
    };
  }, [enabled]);
}
