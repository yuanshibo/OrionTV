import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { View, TextInput, StyleSheet, TouchableOpacity, useColorScheme, ActivityIndicator, StyleProp, ViewStyle } from "react-native";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import VideoCard from "@/components/VideoCard";
import VideoLoadingAnimation from "@/components/VideoLoadingAnimation";
import { api } from "@/services/api";
import { useSearchStore } from "@/stores/searchStore";
import { VideoCardViewModel } from "@/utils/searchUtils";
import { Search } from "lucide-react-native";
import { StyledButton } from "@/components/StyledButton";
import { useLocalSearchParams } from "expo-router";
import { Colors } from "@/constants/Colors";
import CustomScrollView from "@/components/CustomScrollView";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useTVBackHandler } from "@/hooks/useTVBackHandler";
import { getCommonResponsiveStyles } from "@/utils/ResponsiveStyles";
import ResponsiveNavigation from "@/components/navigation/ResponsiveNavigation";
import ResponsiveHeader from "@/components/navigation/ResponsiveHeader";
import { DeviceUtils } from "@/utils/DeviceUtils";
import { useShallow } from "zustand/react/shallow";
import { DynamicBackground } from "@/components/DynamicBackground";



export default function SearchScreen() {
  const params = useLocalSearchParams();
  const {
    keyword, results, loading, error, discoverPage, loadingMore, hasMore,
    setKeyword, loadDiscoverData, doSearch, loadMoreSearchResults, handleSearch, resetSearch
  } = useSearchStore(
    useShallow((state) => ({
      keyword: state.keyword,
      results: state.results,
      loading: state.loading,
      error: state.error,
      discoverPage: state.discoverPage,
      loadingMore: state.loadingMore,
      hasMore: state.hasMore,
      setKeyword: state.setKeyword,
      loadDiscoverData: state.loadDiscoverData,
      doSearch: state.doSearch,
      loadMoreSearchResults: state.loadMoreSearchResults,
      handleSearch: state.handleSearch,
      resetSearch: state.resetSearch,
    }))
  );

  const textInputRef = useRef<TextInput>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const colorScheme = useColorScheme() === 'light' ? 'light' : 'dark';
  const colors = Colors[colorScheme];
  const [focusedPoster, setFocusedPoster] = useState<string | null>(null);

  // 响应式布局配置
  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType, spacing } = responsiveConfig;

  useTVBackHandler({ fallbackRoute: "/" });

  useEffect(() => {
    if (params.q) {
      setKeyword(params.q as string);
      doSearch(params.q as string);
    } else {
      resetSearch();
      loadDiscoverData(1);
      const timer = setTimeout(() => {
        textInputRef.current?.focus();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [params.q, doSearch, loadDiscoverData, resetSearch, setKeyword]);

  const onSearchPress = () => handleSearch();

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;

    if (keyword.trim() === "") {
      loadDiscoverData(discoverPage);
    } else {
      loadMoreSearchResults();
    }
  };

  const renderItem = useCallback(
    ({ item, style }: { item: VideoCardViewModel; index: number; style?: StyleProp<ViewStyle> }) => {
      return (
        <VideoCard
          id={item.id}
          source={item.source}
          title={item.title}
          poster={item.poster}
          year={item.year}
          sourceName={item.sourceName}
          rate={item.rate}
          api={api}
          style={style}
          onFocus={(focusedItem: any) => setFocusedPoster(focusedItem?.poster || null)}
        />
      );
    },
    []
  );

  // 动态样式
  const dynamicStyles = useMemo(() => createResponsiveStyles(deviceType, spacing, colors), [deviceType, spacing, colors]);

  const footerComponent = useMemo(() => {
    if (!loadingMore) return null;
    return <ActivityIndicator style={{ marginVertical: 20 }} size="large" />;
  }, [loadingMore]);

  const renderSearchContent = () => {
    const TV_ITEM_HEIGHT = 240 + 60 + spacing; // Card height + meta height + spacing
    const MOBILE_ITEM_HEIGHT = (responsiveConfig.cardHeight) + 40 + spacing;

    return (
      <>
        <View style={dynamicStyles.searchContainer}>
          <TouchableOpacity
            activeOpacity={1}
            style={[
              dynamicStyles.inputContainer,
              {
                borderColor: isInputFocused ? colors.primary : "transparent",
              },
            ]}
            onPress={() => textInputRef.current?.focus()}
          >
            <TextInput
              ref={textInputRef}
              style={dynamicStyles.input}
              placeholder="搜索电影、剧集..."
              placeholderTextColor={colors.icon}
              value={keyword}
              onChangeText={setKeyword}
              onSubmitEditing={onSearchPress}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              returnKeyType="search"
              blurOnSubmit={true}
              autoComplete="off"
            />
          </TouchableOpacity>
          <StyledButton style={dynamicStyles.searchButton} onPress={onSearchPress}>
            <Search size={deviceType === 'mobile' ? 20 : 24} color={colors.text} />
          </StyledButton>
        </View>

        {loading && results.length === 0 ? (
          <VideoLoadingAnimation showProgressBar={false} />
        ) : error && results.length === 0 ? (
          <View style={[commonStyles.center, { flex: 1 }]}>
            <ThemedText style={dynamicStyles.errorText}>{error}</ThemedText>
          </View>
        ) : (
          <CustomScrollView
            data={results}
            renderItem={renderItem}
            onEndReached={handleLoadMore}
            loadMoreThreshold={300}
            ListFooterComponent={footerComponent}
            emptyMessage="输入关键词开始搜索"
            estimatedItemSize={deviceType === 'tv' ? TV_ITEM_HEIGHT : MOBILE_ITEM_HEIGHT}
            overrideItemLayout={
              deviceType === 'tv'
                ? (layout: { span?: number; size?: number }) => {
                  layout.size = TV_ITEM_HEIGHT;
                  layout.span = 1;
                }
                : undefined
            }
          />
        )}
      </>
    );
  };

  const content = (
    <ThemedView style={[
      commonStyles.container,
      dynamicStyles.container,
      deviceType === 'tv' && { backgroundColor: 'transparent' }
    ]}>
      {renderSearchContent()}
    </ThemedView>
  );

  // 根据设备类型决定是否包装在响应式导航中
  if (deviceType === 'tv') {
    return (
      <>
        <DynamicBackground poster={focusedPoster} />
        {content}
      </>
    );
  }

  return (
    <ResponsiveNavigation>
      <ResponsiveHeader title="搜索" showBackButton />
      {content}
    </ResponsiveNavigation>
  );
}

const createResponsiveStyles = (deviceType: string, spacing: number, colors: (typeof Colors.dark) | (typeof Colors.light)) => {
  const isMobile = deviceType === 'mobile';
  const minTouchTarget = DeviceUtils.getMinTouchTargetSize();

  return StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: deviceType === 'tv' ? 50 : 0,
    },
    searchContainer: {
      flexDirection: "row",
      paddingHorizontal: spacing,
      marginBottom: spacing,
      alignItems: "center",
      paddingTop: isMobile ? spacing / 2 : 0,
    },
    inputContainer: {
      flex: 1,
      height: isMobile ? minTouchTarget : 50,
      backgroundColor: colors.border, // Use a contrasting background
      borderRadius: isMobile ? 8 : 8,
      marginRight: spacing / 2,
      borderWidth: 2,
      borderColor: "transparent",
      justifyContent: "center",
    },
    input: {
      flex: 1,
      paddingHorizontal: spacing,
      color: colors.text,
      fontSize: isMobile ? 16 : 18,
    },
    searchButton: {
      width: isMobile ? minTouchTarget : 50,
      height: isMobile ? minTouchTarget : 50,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: isMobile ? 8 : 8,
    },
    errorText: {
      color: colors.primary, // Using primary for consistency
      fontSize: isMobile ? 14 : 16,
      textAlign: "center",
    },
  });
};
