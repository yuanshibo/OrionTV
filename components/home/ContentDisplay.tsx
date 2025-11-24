import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import Reanimated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { ThemedText } from '@/components/ThemedText';
import CustomScrollView from '@/components/CustomScrollView';
import { getApiConfigErrorMessage } from '@/hooks/useApiConfig';
import { Category, RowItem } from '@/services/dataTypes';

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
  renderContentItem: ({ item, index }: { item: RowItem; index: number }) => React.JSX.Element;
  loadMoreData: () => void;
  loadingMore: boolean;
  footerComponent: React.ReactElement | null;
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
  renderContentItem,
  loadMoreData,
  loadingMore,
  footerComponent,
}) => {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  const shouldShowApiConfig = apiConfigStatus.needsConfiguration && selectedCategory && !selectedCategory.tags;

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
