import React, { useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Image } from 'expo-image';
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useHomeUIStore } from '@/stores/homeUIStore';
import { api } from '@/services/api';
import { LinearGradient } from 'expo-linear-gradient';

interface DynamicBackgroundProps {
  poster?: string | null;
  useProxy?: boolean;
}

/**
 * 优化的动态背景组件
 * - 双缓冲交叉淡入 (Dual-layer Crossfade)，杜绝海报切换黑屏
 * - 缓存计算的 blurRadius
 * - 使用 cachePolicy 优化图片加载
 */
export const PureDynamicBackground = React.memo(({ poster, useProxy = true }: DynamicBackgroundProps) => {
  // 缓存 blurRadius 计算
  const blurRadius = useMemo(() => {
    if (Platform.OS === 'ios') return 10;
    if (Platform.OS === 'android') return 0; // Android GPU 友好
    return 1;
  }, []);

  const [currentUri, setCurrentUri] = useState<string | null>(null);
  const [prevUri, setPrevUri] = useState<string | null>(null);
  const fadeAnim = useSharedValue(1);

  const targetUri = useMemo(() => {
    if (!poster) return null;
    return useProxy ? api.getImageProxyUrl(poster) : poster;
  }, [poster, useProxy]);

  useEffect(() => {
    if (!targetUri) return;
    if (targetUri === currentUri) return;

    // Initial background loads immediately without delay
    if (!currentUri) {
      setCurrentUri(targetUri);
      fadeAnim.value = 1;
      return;
    }

    // Debounce crossfade transitions on fast D-Pad navigation
    const timer = setTimeout(() => {
      setPrevUri(currentUri);
      setCurrentUri(targetUri);
      fadeAnim.value = 0;
      fadeAnim.value = withTiming(1, { duration: 250 });
    }, 200);

    return () => {
      clearTimeout(timer);
    };
  }, [targetUri, currentUri, fadeAnim]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  if (!currentUri && !prevUri) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {prevUri && (
        <Image
          source={{ uri: prevUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          blurRadius={blurRadius}
          cachePolicy="memory-disk"
          recyclingKey={prevUri}
        />
      )}
      {currentUri && (
        <Reanimated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
          <Image
            source={{ uri: currentUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            blurRadius={blurRadius}
            cachePolicy="memory-disk"
            recyclingKey={currentUri}
            priority="high"
          />
        </Reanimated.View>
      )}
      <LinearGradient
        colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,1)']}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
});

PureDynamicBackground.displayName = 'PureDynamicBackground';

export const DynamicBackground = React.memo(({ poster, useProxy = true }: DynamicBackgroundProps) => {
  const storeFocusedPoster = useHomeUIStore((state) => state.focusedPoster);
  const backgroundPoster = poster !== undefined ? poster : storeFocusedPoster;

  return <PureDynamicBackground poster={backgroundPoster} useProxy={useProxy} />;
});

DynamicBackground.displayName = 'DynamicBackground';
