/**
 * 生产环境控制台优化器
 * 确保生产环境中移除所有 console 调用
 */
export class ConsoleOptimizer {
  static initialize(): void {
    if (!__DEV__) {
      // 生产环境：禁用所有日志
      console.log = () => {};
      console.debug = () => {};
      console.info = () => {};
      console.trace = () => {};
      
      // 保留 error 和 warn 用于错误追踪
      const originalError = console.error;
      const originalWarn = console.warn;

      console.error = (...args: any[]) => {
        // 仅在特定情况下输出（例如包含关键错误的关键词）
        if (args[0]?.toString?.().includes?.('critical') || args[0]?.toString?.().includes?.('fatal')) {
          originalError(...args);
        }
      };

      console.warn = (...args: any[]) => {
        // 仅在特定情况下输出
        if (args[0]?.toString?.().includes?.('perf') || args[0]?.toString?.().includes?.('memory')) {
          originalWarn(...args);
        }
      };
    }
  }
}
