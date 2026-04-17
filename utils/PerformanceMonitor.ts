/**
 * 性能监测工具
 * 实时追踪帧率、内存使用、渲染时间等指标
 */
interface PerformanceMetrics {
  fps: number;
  renderTime: number;
  slowFrames: number;
}

export class PerformanceMonitor {
  private static metrics: PerformanceMetrics = {
    fps: 60,
    renderTime: 0,
    slowFrames: 0,
  };

  private static frameCount = 0;
  private static lastTimestamp = 0;
  private static monitoringEnabled = false;
  private static listeners: ((metrics: PerformanceMetrics) => void)[] = [];

  /**
   * 启动性能监测
   */
  static start(): void {
    if (this.monitoringEnabled) return;

    this.monitoringEnabled = true;
    this.lastTimestamp = performance.now();

    // 每秒计算一次 FPS
    const interval = setInterval(() => {
      const now = performance.now();
      const deltaTime = now - this.lastTimestamp;
      if (deltaTime > 0) {
        this.metrics.fps = Math.round((this.frameCount / deltaTime) * 1000);
      }
      this.frameCount = 0;
      this.lastTimestamp = now;

      // 通知监听器
      this.listeners.forEach(listener => listener({ ...this.metrics }));

      if (__DEV__ && this.metrics.fps < 50) {
        // console.warn(`[PerformanceMonitor] Low FPS: ${this.metrics.fps}`);
      }
    }, 1000);

    // 使用 requestAnimationFrame 计数帧数
    const countFrames = () => {
      if (!this.monitoringEnabled) return;
      this.frameCount++;
      requestAnimationFrame(countFrames);
    };
    requestAnimationFrame(countFrames);

    (this as any)._intervalId = interval;
  }

  /**
   * 停止监测
   */
  static stop(): void {
    this.monitoringEnabled = false;
    if ((this as any)._intervalId) {
      clearInterval((this as any)._intervalId);
    }
  }

  /**
   * 订阅性能变化
   */
  static subscribe(callback: (metrics: PerformanceMetrics) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  /**
   * 记录渲染时间
   */
  static recordRenderTime(componentName: string, duration: number): void {
    this.metrics.renderTime = duration;

    if (__DEV__ && duration > 16.67) { // 超过 1 帧时间（60fps）
      // console.warn(`[PerformanceMonitor] Slow render: ${componentName} took ${duration.toFixed(2)}ms`);
    }
  }
}
