import { useEffect } from 'react';
import { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

export const useButtonAnimation = (isFocused: boolean, size: number = 1.1) => {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(isFocused ? size : 1, {
      damping: 15,
      stiffness: 150,
      mass: 0.6,
    });
  }, [isFocused, size, scale]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  return animatedStyle;
};