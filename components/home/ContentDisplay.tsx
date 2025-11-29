import React, { useCallback, useMemo } from 'react';
import { View, ActivityIndicator, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Reanimated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { ThemedText } from '@/components/ThemedText';
import CustomScrollView from '@/components/CustomScrollView';
import { getApiConfigErrorMessage } from '@/hooks/useApiConfig';
import { Category, RowItem } from '@/services/dataTypes';
import VideoCard from '@/components/VideoCard';
import { api } from '@/services/api';

const LOAD_MORE_THRESHOLD = 200;

interface ContentDisplayProps {
  apiConfigStatus: any;
  selectedCategory: Category | null;
  loading: boolean;
  error: string | null;
  fadeAnim: SharedValue<number>;
  commonStyles: any;
  spacing: number;
  contentData: RowItem[];
  listRef: React.RefObject<any>;
  loadMoreData: () => void;
  loadingMore: boolean;
  deviceType: 'mobile' | 'tablet' | 'tv';
  onShowFilterPanel: () => void;
  onRecordDeleted: () => void;
  firstItemRef?: React.RefObject<any>;
  onFocus?: (item?: any) => void;
}

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
  },
});

export const ContentDisplay: React.FC<ContentDisplayProps> = React.memo(({
  apiConfigStatus,
  selectedCategory,
  loading,
  error,
  fadeAnim,
  commonStyles,
  spacing,
  contentData,
  listRef,
  loadMoreData,
  loadingMore,
  deviceType,
  onShowFilterPanel,
  onRecordDeleted,
  firstItemRef,
  onFocus,
}) => {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  const shouldShowApiConfig = apiConfigStatus.needsConfiguration && selectedCategory && !selectedCategory.tags;

  const renderContentItem = useCallback(({ item, index, style }: { item: RowItem; index: number; style?: StyleProp<ViewStyle> }) => {
    const isFilterable = selectedCategory?.title === "所有";
    const isRecord = selectedCategory?.type === "record";
    let longPressAction;

    if (deviceType === "tv") {
      if (isFilterable) longPressAction = onShowFilterPanel;
      else if (isRecord) longPressAction = undefined;
      else longPressAction = () => { };
    }

    return (
      <VideoCard
        ref={index === 0 ? firstItemRef : undefined}
        id={item.id}
        source={item.source}
        title={item.title}
        poster={item.poster}
        year={item.year}
        rate={item.rate}
        progress={item.progress}
        playTime={item.play_time}
        episodeIndex={item.episodeIndex}
        sourceName={item.sourceName}
        totalEpisodes={item.totalEpisodes}
        api={api}
        onRecordDeleted={onRecordDeleted}
        onLongPress={longPressAction}
        style={style}
        onFocus={onFocus}
      />
    );
  }, [selectedCategory, deviceType, onShowFilterPanel, onRecordDeleted, firstItemRef, onFocus]);

  const footerComponent = useMemo(() => {
    if (!loadingMore) return null;
    return <ActivityIndicator style={{ marginVertical: 20 }} size="large" />;
  }, [loadingMore]);

  if (shouldShowApiConfig) {
    return (
      <View style={commonStyles.center}>
        <ThemedText type="subtitle" style={{ padding: spacing, textAlign: 'center' }}>
          {getApiConfigErrorMessage(apiConfigStatus)}
        </ThemedText>
      </View>
    );
  }

  if (apiConfigStatus.isValidating) {
    return (
      <View style={commonStyles.center}>
        <ActivityIndicator size="large" />
        <ThemedText type="subtitle" style={{ padding: spacing, textAlign: 'center' }}>
          正在验证服务器配置...
        </ThemedText>
      </View>
    );
  }

  if (apiConfigStatus.error && !apiConfigStatus.isValid) {
    return (
      <View style={commonStyles.center}>
        <ThemedText type="subtitle" style={{ padding: spacing, textAlign: 'center' }}>
          {apiConfigStatus.error}
        </ThemedText>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={commonStyles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={commonStyles.center}>
        <ThemedText type="subtitle" style={{ padding: spacing }}>
          {error}
        </ThemedText>
      </View>
    );
  }

  return (
    <Reanimated.View style={[styles.contentContainer, animatedStyle]}>
      <CustomScrollView
        ref={listRef}
        data={contentData}
        renderItem={renderContentItem}
        loading={loading}
        loadingMore={loadingMore}
        error={error}
        onEndReached={loadMoreData}
        loadMoreThreshold={LOAD_MORE_THRESHOLD}
        emptyMessage={selectedCategory?.tags ? '请选择一个子分类' : '该分类下暂无内容'}
        ListFooterComponent={footerComponent}
      />
    </Reanimated.View>
  );
});

ContentDisplay.displayName = 'ContentDisplay';
