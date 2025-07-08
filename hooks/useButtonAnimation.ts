import { useRef, useEffect } from 'react';
import { Animated } from 'react-native';

export const useButtonAnimation = (isFocused: boolean) => {
  const scaleValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scaleValue, {
      toValue: isFocused ? 1.1 : 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  }, [ isFocused, scaleValue]);

  return {
    transform: [{ scale: scaleValue }],
  };
};