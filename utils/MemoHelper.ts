/**
 * React.memo 辅助工具
 * 提供常用的比较函数和优化模式
 */
import React from 'react';

/**
 * 浅比较指定的键（忽略函数引用）
 */
export function createShallowEqualComparator<T extends Record<string, any>>(
  keys: (keyof T)[]
) {
  return (prevProps: T, nextProps: T) => {
    for (const key of keys) {
      if (prevProps[key] !== nextProps[key]) {
        return false; // 属性不同，需要重渲染
      }
    }
    return true; // 所有指定属性相同，跳过重渲染
  };
}

/**
 * 包装组件为优化的 memo 组件
 */
export function withMemo<P extends object>(
  Component: React.ComponentType<P>,
  compareFn?: (prev: P, next: P) => boolean,
  displayName?: string
) {
  const Wrapped = React.memo(Component, compareFn);
  Wrapped.displayName = displayName || Component.displayName || 'Memoized';
  return Wrapped;
}

/**
 * 创建列表项组件（自动优化）
 */
export function createListItemComponent<T extends Record<string, any>>(
  Component: React.ComponentType<T>,
  propsToCompare: (keyof T)[]
) {
  const compareFn = createShallowEqualComparator(propsToCompare);
  return withMemo(Component, compareFn);
}
