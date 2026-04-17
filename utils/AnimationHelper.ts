/**
 * Reanimated 动画优化工具
 * 确保所有动画使用原生驱动，避免 JS 线程阻塞
 */
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';

export interface AnimationConfig {
  duration: number;
  easing: (v: number) => number;
  useNativeDriver: boolean;
}

export const DEFAULT_ANIMATION_CONFIG: AnimationConfig = {
  duration: 300,
  easing: Easing.inOut(Easing.cubic),
  useNativeDriver: true, // 始终使用原生驱动
};

/**
 * 创建淡入淡出动画
 */
export function useOpacityAnimation(initialValue = 0, defaultConfig = DEFAULT_ANIMATION_CONFIG) {
  const opacity = useSharedValue(initialValue);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }), [opacity]);

  const fadeIn = () => {
    opacity.value = withTiming(1, defaultConfig);
  };

  const fadeOut = () => {
    opacity.value = withTiming(0, defaultConfig);
  };

  return { opacity, animatedStyle, fadeIn, fadeOut };
}

/**
 * 创建缩放动画（原生驱动）
 */
export function useScaleAnimation(initialValue = 1) {
  const scale = useSharedValue(initialValue);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }), [scale]);

  const scaleUp = (targetScale = 1.1) => {
    scale.value = withSpring(targetScale, {
      damping: 10,
      mass: 1,
      stiffness: 100,
      overshootClamping: false,
    });
  };

  const scaleDown = () => {
    scale.value = withSpring(initialValue);
  };

  return { scale, animatedStyle, scaleUp, scaleDown };
}

/**
 * 创建平移动画
 */
export function useTranslateAnimation(initialX = 0, initialY = 0) {
  const translateX = useSharedValue(initialX);
  const translateY = useSharedValue(initialY);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }), [translateX, translateY]);

  const animate = (x: number, y: number, config = DEFAULT_ANIMATION_CONFIG) => {
    translateX.value = withTiming(x, config);
    translateY.value = withTiming(y, config);
  };

  return { translateX, translateY, animatedStyle, animate };
}
