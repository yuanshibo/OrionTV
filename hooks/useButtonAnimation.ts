import { useRef, useEffect } from 'react';
import { Animated } from 'react-native';

export const useButtonAnimation = (isSelected: boolean, isFocused: boolean) => {
  const scaleValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scaleValue, {
      toValue: isSelected || isFocused ? 1.1 : 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  }, [isSelected, isFocused, scaleValue]);

  return {
    transform: [{ scale: scaleValue }],
  };
};