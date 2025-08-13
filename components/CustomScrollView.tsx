import React, { useCallback } from "react";
import { View, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
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
  numColumns, // 现在可选，如果不提供将使用响应式默认值
  loading = false,
  loadingMore = false,
  error = null,
  onEndReached,
  loadMoreThreshold = 200,
  emptyMessage = "暂无内容",
  ListFooterComponent,
}) => {
  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  
  // 使用响应式列数，如果没有明确指定的话
  const effectiveColumns = numColumns || responsiveConfig.columns;

  const handleScroll = useCallback(
    ({ nativeEvent }: { nativeEvent: any }) => {
      const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
      const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - loadMoreThreshold;

      if (isCloseToBottom && !loadingMore && onEndReached) {
        onEndReached();
      }
    },
    [onEndReached, loadingMore, loadMoreThreshold]
  );

  const renderFooter = () => {
    if (ListFooterComponent) {
      if (React.isValidElement(ListFooterComponent)) {
        return ListFooterComponent;
      } else if (typeof ListFooterComponent === "function") {
        const Component = ListFooterComponent as React.ComponentType<any>;
        return <Component />;
      }
      return null;
    }
    if (loadingMore) {
      return <ActivityIndicator style={{ marginVertical: 20 }} size="large" />;
    }
    return null;
  };

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

  // 将数据按行分组
  const groupItemsByRow = (items: any[], columns: number) => {
    const rows = [];
    for (let i = 0; i < items.length; i += columns) {
      rows.push(items.slice(i, i + columns));
    }
    return rows;
  };

  const rows = groupItemsByRow(data, effectiveColumns);

  // 动态样式
  const dynamicStyles = StyleSheet.create({
    listContent: {
      paddingBottom: responsiveConfig.spacing * 2,
      paddingHorizontal: responsiveConfig.spacing / 2,
    },
    rowContainer: {
      flexDirection: "row",
      marginBottom: responsiveConfig.spacing,
    },
    fullRowContainer: {
      justifyContent: "space-between",
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
  });

  return (
    <ScrollView 
      contentContainerStyle={dynamicStyles.listContent} 
      onScroll={handleScroll} 
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={responsiveConfig.deviceType !== 'tv'}
    >
      {data.length > 0 ? (
        <>
          {rows.map((row, rowIndex) => {
            const isFullRow = row.length === effectiveColumns;
            const rowStyle = isFullRow ? dynamicStyles.fullRowContainer : dynamicStyles.partialRowContainer;
            
            return (
              <View key={rowIndex} style={[dynamicStyles.rowContainer, rowStyle]}>
                {row.map((item, itemIndex) => {
                  const actualIndex = rowIndex * effectiveColumns + itemIndex;
                  const isLastItemInPartialRow = !isFullRow && itemIndex === row.length - 1;
                  const itemStyle = isLastItemInPartialRow ? dynamicStyles.itemContainer : dynamicStyles.itemWithMargin;
                  
                  return (
                    <View key={actualIndex} style={isFullRow ? dynamicStyles.itemContainer : itemStyle}>
                      {renderItem({ item, index: actualIndex })}
                    </View>
                  );
                })}
              </View>
            );
          })}
          {renderFooter()}
        </>
      ) : (
        <View style={commonStyles.center}>
          <ThemedText>{emptyMessage}</ThemedText>
        </View>
      )}
    </ScrollView>
  );

};

export default CustomScrollView;
