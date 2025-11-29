import React, { useCallback, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
  StyleProp,
  ViewStyle
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  withTiming,
  runOnJS
} from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { getCommonResponsiveStyles } from "@/utils/ResponsiveStyles";

const AnimatedFlashList = Animated.createAnimatedComponent(FlashList) as any;

interface CustomScrollViewProps {
  data: any[];
  renderItem: ({ item, index, style }: { item: any; index: number; style?: StyleProp<ViewStyle> }) => React.ReactElement | null;
  numColumns?: number;
  loading?: boolean;
  loadingMore?: boolean;
  error?: string | null;
  onEndReached?: () => void;
  loadMoreThreshold?: number;
  emptyMessage?: string;
  ListFooterComponent?: React.ComponentType<any> | React.ReactElement | null;
  drawDistance?: number;
}

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
    drawDistance,
  },
  ref
) => {
  const listRef = useRef<React.ElementRef<typeof FlashList>>(null);
  useImperativeHandle(ref, () => listRef.current!);

  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType } = responsiveConfig;

  // Reanimated Shared Value for opacity
  const opacity = useSharedValue(0);

  const scrollToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const effectiveColumns = numColumns || responsiveConfig.columns;

  const handleEndReached = useCallback(() => {
    if (!loadingMore && onEndReached) {
      onEndReached();
    }
  }, [loadingMore, onEndReached]);

  const updateShowScrollToTop = useCallback((show: boolean) => {
    setShowScrollToTop(show);
  }, []);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const { contentOffset, layoutMeasurement, contentSize } = event;

      // Scroll To Top Logic
      if (contentOffset.y > 200 && opacity.value === 0) {
        opacity.value = withTiming(1);
        runOnJS(updateShowScrollToTop)(true);
      } else if (contentOffset.y <= 200 && opacity.value === 1) {
        opacity.value = withTiming(0);
        runOnJS(updateShowScrollToTop)(false);
      }

      // End Reached Logic
      const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - loadMoreThreshold;
      if (isCloseToBottom) {
        runOnJS(handleEndReached)();
      }
    },
  });

  const animatedButtonStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

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
        cardContainer: {
          width: responsiveConfig.cardWidth,
          marginBottom: responsiveConfig.spacing,
        },
        cardContainerWithSpacing: {
          width: responsiveConfig.cardWidth,
          marginRight: responsiveConfig.spacing,
          marginBottom: responsiveConfig.spacing,
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
    if (item?.id != null) return String(item.id);
    if (item?.key != null) return String(item.key);
    if (item?.title != null) return `${item.title}-`;
    return `${index}`;
  }, []);

  const renderGridItem = useCallback(
    ({ item, index }: { item: any; index: number }) => {
      const isLastColumn = (index + 1) % effectiveColumns === 0;
      const style = isLastColumn ? dynamicStyles.cardContainer : dynamicStyles.cardContainerWithSpacing;

      // Directly call renderItem with the calculated style, avoiding an extra View wrapper
      const result = renderItem({ item, index, style });
      return (result === undefined ? null : result) as React.ReactElement | null;
    },
    [dynamicStyles, effectiveColumns, renderItem]
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
      <AnimatedFlashList
        ref={listRef}
        data={data}
        keyExtractor={getItemKey}
        renderItem={renderGridItem}
        numColumns={effectiveColumns}
        estimatedItemSize={responsiveConfig.cardHeight + responsiveConfig.spacing + 60}
        contentContainerStyle={dynamicStyles.listContent}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={responsiveConfig.deviceType !== "tv"}
        ListEmptyComponent={() => (
          <View style={commonStyles.center}>
            <ThemedText>{emptyMessage}</ThemedText>
          </View>
        )}
        ListFooterComponent={renderFooter}
        drawDistance={drawDistance ?? 400}
      />
      {deviceType !== 'tv' && (
        <Animated.View style={[dynamicStyles.scrollToTopButton, animatedButtonStyle]} pointerEvents={showScrollToTop ? 'auto' : 'none'}>
          <TouchableOpacity
            onPress={scrollToTop}
            activeOpacity={0.8}
          >
            <ThemedText>⬆️</ThemedText>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
});

CustomScrollView.displayName = "CustomScrollView";

export default CustomScrollView;
