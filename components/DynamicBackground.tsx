import React, { useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useHomeUIStore } from '@/stores/homeUIStore';
import { api } from '@/services/api';
import { LinearGradient } from 'expo-linear-gradient';

interface DynamicBackgroundProps {
  poster?: string | null;
  useProxy?: boolean;
}

/**
 * 优化的动态背景组件
 * - 根据设备性能自动调整模糊半径
 * - 缓存计算的 blurRadius
 * - 使用 cachePolicy 优化图片加载
 */
export const PureDynamicBackground = React.memo(({ poster, useProxy = true }: DynamicBackgroundProps) => {
  if (!poster) return null;

  const imageUrl = useProxy ? api.getImageProxyUrl(poster) : poster;

  // 缓存 blurRadius 计算
  const blurRadius = useMemo(() => {
    if (Platform.OS === 'ios') return 10;
    if (Platform.OS === 'android') return 0; // Android GPU 友好
    return 1;
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={{ uri: imageUrl }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={Platform.OS === 'android' ? 0 : 500}
        blurRadius={blurRadius}
        cachePolicy="disk"
        recyclingKey={imageUrl}
        priority="high" // 优先加载背景
      />
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
