import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import RelatedSeries from '@/components/RelatedSeries';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useTVBackHandler } from '@/hooks/useTVBackHandler';

export default function PostPlayScreen() {
  const { title } = useLocalSearchParams<{ title?: string }>();
  const { spacing } = useResponsiveLayout();

  useTVBackHandler({ fallbackRoute: "/" });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          justifyContent: 'center',
          paddingHorizontal: spacing,
          paddingVertical: spacing / 2,
        },
        header: {
          marginBottom: spacing / 2,
          paddingHorizontal: 10,
        },
        badge: {
          alignSelf: 'flex-start',
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          borderColor: 'rgba(59, 130, 246, 0.4)',
          borderWidth: 1,
          borderRadius: 6,
          paddingHorizontal: 10,
          paddingVertical: 4,
          marginBottom: 8,
        },
        badgeText: {
          color: '#60a5fa',
          fontSize: 13,
          fontWeight: '600',
        },
        title: {
          fontSize: 24,
          fontWeight: 'bold',
          color: '#ffffff',
          marginBottom: 6,
        },
        subtitle: {
          fontSize: 14,
          color: '#9ca3af',
        },
      }),
    [spacing]
  );

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <ThemedText style={styles.badgeText}>全剧播放完毕</ThemedText>
        </View>
        <ThemedText style={styles.title} numberOfLines={1}>
          {title ? `《${title}》` : '全剧已播完'}
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          为您推荐同系列与相关精彩剧集 · 按【返回键】返回上一页
        </ThemedText>
      </View>
      {title && (
        <RelatedSeries
          title={title}
          autoFocus={true}
          hideTitle={true}
          showEmptyMessage={true}
        />
      )}
    </ThemedView>
  );
}
