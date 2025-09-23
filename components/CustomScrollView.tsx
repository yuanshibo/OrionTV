import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  ListRenderItemInfo,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { getCommonResponsiveStyles } from "@/utils/ResponsiveStyles";

interface CustomScrollViewProps {
  data: any[];
  renderItem: ({ item, index }: { item: any; index: number }) => React.ReactNode;
  numColumns?: number; // 如果不提供，将使用响应式默认值
  loading?: boolean;
  loadingMore?: boolean;
  error?: string | null;
  onEndReached?: () => void;
  loadMoreThreshold?: number;
  emptyMessage?: string;
  ListFooterComponent?: React.ComponentType<any> | React.ReactElement | null;
}

const CustomScrollView: React.FC<CustomScrollViewProps> = ({
  data,
  renderItem,
  numColumns,
  loading = false,
  loadingMore = false,
  error = null,
  onEndReached,
  loadMoreThreshold = 200,
  emptyMessage = "暂无内容",
  ListFooterComponent,
}) => {
  const listRef = useRef<FlatList<any>>(null);
  const scrollToTopTimeout = useRef<NodeJS.Timeout | null>(null);
  const firstCardRef = useRef<any>(null); // <--- 新增
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType } = responsiveConfig;

  // 添加返回键处理逻辑
  useEffect(() => {
    if (deviceType === 'tv') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        if (showScrollToTop) {
          scrollToTop();
          return true; // 阻止默认的返回行为
        }
        return false; // 允许默认的返回行为
      });

      return () => backHandler.remove();
    }
  }, [deviceType, scrollToTop, showScrollToTop]);

  // 使用响应式列数，如果没有明确指定的话
  const effectiveColumns = numColumns || responsiveConfig.columns;

  const rows = useMemo(() => {
    if (!data.length) {
      return [] as any[][];
    }

    const grouped: any[][] = [];
    for (let i = 0; i < data.length; i += effectiveColumns) {
      grouped.push(data.slice(i, i + effectiveColumns));
    }
    return grouped;
  }, [data, effectiveColumns]);

  const handleScroll = useCallback(
    ({ nativeEvent }: { nativeEvent: any }) => {
      const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
      const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - loadMoreThreshold;

      // 显示/隐藏返回顶部按钮
      setShowScrollToTop(contentOffset.y > 200);

      if (isCloseToBottom && !loadingMore && onEndReached) {
        onEndReached();
      }
    },
    [onEndReached, loadingMore, loadMoreThreshold]
  );

  const scrollToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });

    // 滚动动画结束后聚焦第一个卡片
    if (scrollToTopTimeout.current) {
      clearTimeout(scrollToTopTimeout.current);
    }

    scrollToTopTimeout.current = setTimeout(() => {
      firstCardRef.current?.focus?.();
    }, 500); // 500ms 适配大多数动画时长
  }, []);

  useEffect(() => {
    return () => {
      if (scrollToTopTimeout.current) {
        clearTimeout(scrollToTopTimeout.current);
      }
    };
  }, []);

  const renderFooter = useMemo(() => {
    if (ListFooterComponent) {
      if (React.isValidElement(ListFooterComponent)) {
        return ListFooterComponent;
      }
      if (typeof ListFooterComponent === "function") {
        const Component = ListFooterComponent as React.ComponentType<any>;
        return <Component />;
      }
      return null;
    }

    if (loadingMore) {
      return <ActivityIndicator style={{ marginVertical: 20 }} size="large" />;
    }

    return null;
  }, [ListFooterComponent, loadingMore]);

  const dynamicStyles = useMemo(
    () =>
      StyleSheet.create({
        listContent: {
          paddingBottom: responsiveConfig.spacing * 2,
          paddingHorizontal: responsiveConfig.spacing / 2,
        },
        rowContainer: {
          flexDirection: "row",
          marginBottom: responsiveConfig.spacing,
        },
        fullRowContainer: {
          justifyContent: "space-around",
          marginRight: responsiveConfig.spacing / 2,
        },
        partialRowContainer: {
          justifyContent: "flex-start",
        },
        itemContainer: {
          width: responsiveConfig.cardWidth,
        },
        itemWithMargin: {
          width: responsiveConfig.cardWidth,
          marginRight: responsiveConfig.spacing,
        },
        scrollToTopButton: {
          position: "absolute",
          right: responsiveConfig.spacing,
          bottom: responsiveConfig.spacing * 2,
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          padding: responsiveConfig.spacing,
          borderRadius: responsiveConfig.spacing,
        },
      }),
    [responsiveConfig]
  );

  const getItemKey = useCallback((item: any, index: number) => {
    if (item?.id != null) {
      return String(item.id);
    }

    if (item?.key != null) {
      return String(item.key);
    }

    if (item?.title != null) {
      return `${item.title}-${index}`;
    }

    return `${index}`;
  }, []);

  const renderRow = useCallback(
    ({ item: row, index: rowIndex }: ListRenderItemInfo<any[]>) => {
      const isFullRow = row.length === effectiveColumns;
      const rowStyle = isFullRow ? dynamicStyles.fullRowContainer : dynamicStyles.partialRowContainer;

      return (
        <View style={[dynamicStyles.rowContainer, rowStyle]}>
          {row.map((item, itemIndex) => {
            const actualIndex = rowIndex * effectiveColumns + itemIndex;
            const isLastItemInPartialRow = !isFullRow && itemIndex === row.length - 1;
            const containerStyle =
              isFullRow || isLastItemInPartialRow ? dynamicStyles.itemContainer : dynamicStyles.itemWithMargin;
            const isFirstCard = rowIndex === 0 && itemIndex === 0;
            const key = getItemKey(item, actualIndex);

            return (
              <View key={key} ref={isFirstCard ? firstCardRef : undefined} style={containerStyle}>
                {renderItem({ item, index: actualIndex })}
              </View>
            );
          })}
        </View>
      );
    },
    [dynamicStyles, effectiveColumns, getItemKey, renderItem]
  );

  const rowKeyExtractor = useCallback(
    (row: any[], rowIndex: number) => {
      if (!row.length) {
        return `row-${rowIndex}`;
      }

      const firstItemKey = getItemKey(row[0], rowIndex * effectiveColumns);
      return `${firstItemKey}-row-${rowIndex}`;
    },
    [effectiveColumns, getItemKey]
  );

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
        <ThemedText type="subtitle" style={{ padding: responsiveConfig.spacing }}>
          {error}
        </ThemedText>
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <View style={commonStyles.center}>
        <ThemedText>{emptyMessage}</ThemedText>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={rowKeyExtractor}
        renderItem={renderRow}
        contentContainerStyle={dynamicStyles.listContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={responsiveConfig.deviceType !== "tv"}
        ListEmptyComponent={() => (
          <View style={commonStyles.center}>
            <ThemedText>{emptyMessage}</ThemedText>
          </View>
        )}
        ListFooterComponent={renderFooter}
        initialNumToRender={Math.ceil(responsiveConfig.screenHeight / responsiveConfig.cardHeight) + 2}
        windowSize={5}
        removeClippedSubviews={deviceType !== "tv"}
      />
      {deviceType !== 'tv' && (
        <TouchableOpacity
          style={[dynamicStyles.scrollToTopButton, { opacity: showScrollToTop ? 1 : 0 }]}
          onPress={scrollToTop}
          activeOpacity={0.8}
        >
          <ThemedText>⬆️</ThemedText>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default CustomScrollView;
