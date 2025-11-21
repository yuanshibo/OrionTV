import React, { useCallback, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
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

// Use React.ElementRef to correctly infer the instance type of FlashList
const CustomScrollView = forwardRef<React.ElementRef<typeof FlashList>, CustomScrollViewProps>((
  {
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
  },
  ref
) => {
  const listRef = useRef<React.ElementRef<typeof FlashList>>(null);
  // @ts-ignore: complex ref forwarding types with FlashList
  useImperativeHandle(ref, () => listRef.current);

  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType, spacing, cardHeight, cardWidth } = responsiveConfig;

  const scrollToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  // 使用响应式列数，如果没有明确指定的话
  const effectiveColumns = numColumns || responsiveConfig.columns;

  const handleScroll = useCallback(
    (event: any) => {
      const { contentOffset } = event.nativeEvent;
      setShowScrollToTop(contentOffset.y > 200);
    },
    []
  );

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
          paddingBottom: spacing * 2,
          paddingHorizontal: spacing / 2,
        },
        scrollToTopButton: {
          position: "absolute",
          right: spacing,
          bottom: spacing * 2,
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          padding: spacing,
          borderRadius: spacing,
        },
        itemContainer: {
          padding: spacing / 2,
        }
      }),
    [spacing]
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

  const renderFlashListItem = useCallback(
    ({ item, index }: { item: any; index: number }) => {
      return (
        <View style={{
          flex: 1,
          margin: spacing / 2,
          maxWidth: cardWidth,
        }}>
          {renderItem({ item, index })}
        </View>
      );
    },
    [renderItem, spacing, cardWidth]
  );

  const estimatedItemSize = cardHeight + spacing;

  // Workaround for TypeScript definition mismatch in current environment where estimatedItemSize is missing from types
  const FlashListAny = FlashList as any;

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

  if (data.length === 0) {
    return (
      <View style={commonStyles.center}>
        <ThemedText>{emptyMessage}</ThemedText>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlashListAny
        ref={listRef}
        data={data}
        renderItem={renderFlashListItem}
        estimatedItemSize={estimatedItemSize}
        numColumns={effectiveColumns}
        keyExtractor={getItemKey}
        contentContainerStyle={dynamicStyles.listContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={deviceType !== "tv"}
        onEndReached={onEndReached}
        onEndReachedThreshold={loadMoreThreshold ? 0.5 : undefined}
        ListEmptyComponent={() => (
          <View style={commonStyles.center}>
            <ThemedText>{emptyMessage}</ThemedText>
          </View>
        )}
        ListFooterComponent={renderFooter}
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
});

CustomScrollView.displayName = "CustomScrollView";

export default CustomScrollView;
