/**
 * FlashList 性能优化配置生成器
 * 根据设备类型和列表场景生成最优参数
 */
export interface FlashListConfig {
  initialNumToRender: number;
  maxToRenderPerBatch: number;
  updateCellsBatchingPeriod: number;
  estimatedItemSize: number;
  drawDistance: number;
}

export class FlashListOptimizer {
  /**
   * 为垂直列表生成优化配置
   */
  static getVerticalListConfig(deviceType: 'mobile' | 'tablet' | 'tv', itemHeight: number): FlashListConfig {
    const isTV = deviceType === 'tv';
    const isTablet = deviceType === 'tablet';

    return {
      initialNumToRender: isTV ? 8 : isTablet ? 10 : 6,
      maxToRenderPerBatch: isTV ? 10 : isTablet ? 12 : 8,
      updateCellsBatchingPeriod: isTV ? 50 : 30,
      estimatedItemSize: itemHeight,
      drawDistance: itemHeight * (isTV ? 3 : 2),
    };
  }

  /**
   * 为水平列表生成优化配置
   */
  static getHorizontalListConfig(deviceType: 'mobile' | 'tablet' | 'tv', itemWidth: number): FlashListConfig {
    const isTV = deviceType === 'tv';

    return {
      initialNumToRender: isTV ? 6 : 4,
      maxToRenderPerBatch: isTV ? 8 : 5,
      updateCellsBatchingPeriod: isTV ? 50 : 30,
      estimatedItemSize: itemWidth,
      drawDistance: itemWidth * (isTV ? 2 : 1.5),
    };
  }

  /**
   * 为大型列表（1000+ 项）生成激进优化配置
   */
  static getLargeListConfig(deviceType: 'mobile' | 'tablet' | 'tv', itemHeight: number): FlashListConfig {
    return {
      initialNumToRender: 5,
      maxToRenderPerBatch: 6,
      updateCellsBatchingPeriod: 70,
      estimatedItemSize: itemHeight,
      drawDistance: itemHeight * 2,
    };
  }
}
