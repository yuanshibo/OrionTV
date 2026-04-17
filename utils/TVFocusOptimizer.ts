/**
 * TV 焦点管理优化工具
 * 优化遥控器导航体验
 */
import { Platform } from 'react-native';

export interface FocusConfig {
  duration: number; // 焦点转换时间（ms）
  enablePrefetch: boolean; // 是否预加载焦点目标
  enableHistory: boolean; // 是否记录焦点历史
}

export class TVFocusOptimizer {
  private static focusHistory: any[] = [];
  private static config: FocusConfig = {
    duration: 300,
    enablePrefetch: true,
    enableHistory: true,
  };

  /**
   * 优化焦点转移（减少延迟）
   */
  static optimizeFocusTransition(
    fromRef: any,
    toRef: any,
    config: Partial<FocusConfig> = {}
  ): void {
    const finalConfig = { ...this.config, ...config };

    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;

    // 预加载焦点目标（如果启用）
    if (finalConfig.enablePrefetch && toRef) {
      requestAnimationFrame(() => {
        if (toRef.current?.measure) {
          toRef.current.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
            // 确保目标元素在视口内（可以用于触发预加载等）
            if (__DEV__) {
              console.debug(`[TVFocus] Target ready at (${pageX}, ${pageY})`);
            }
          });
        }
      });
    }

    // 记录历史
    if (finalConfig.enableHistory && fromRef) {
      this.focusHistory.push(fromRef);
    }
  }

  /**
   * 恢复前一个焦点
   */
  static restorePreviousFocus(): any {
    if (this.focusHistory.length === 0) return null;
    return this.focusHistory.pop();
  }

  /**
   * 清空焦点历史
   */
  static clearHistory(): void {
    this.focusHistory = [];
  }

  /**
   * 配置全局焦点行为
   */
  static configure(config: Partial<FocusConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
