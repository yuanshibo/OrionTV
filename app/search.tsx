import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { View, TextInput, StyleSheet, Alert, Keyboard, TouchableOpacity, useColorScheme, ActivityIndicator } from "react-native";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import VideoCard from "@/components/VideoCard";
import VideoLoadingAnimation from "@/components/VideoLoadingAnimation";
import { api, SearchResult, DoubanRecommendationItem } from "@/services/api";
import { Search, QrCode } from "lucide-react-native";
import { StyledButton } from "@/components/StyledButton";
import { useRemoteControlStore } from "@/stores/remoteControlStore";
import { RemoteControlModal } from "@/components/RemoteControlModal";
import { useSettingsStore } from "@/stores/settingsStore";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Colors } from "@/constants/Colors";
import CustomScrollView from "@/components/CustomScrollView";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { getCommonResponsiveStyles } from "@/utils/ResponsiveStyles";
import ResponsiveNavigation from "@/components/navigation/ResponsiveNavigation";
import ResponsiveHeader from "@/components/navigation/ResponsiveHeader";
import { DeviceUtils } from "@/utils/DeviceUtils";
import Logger from "@/utils/Logger";

const logger = Logger.withTag("SearchScreen");

type UnifiedResult = SearchResult | DoubanRecommendationItem;

export default function SearchScreen() {
  const params = useLocalSearchParams();
  const [keyword, setKeyword] = useState((params.q as string) || "");
  const [results, setResults] = useState<UnifiedResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textInputRef = useRef<TextInput>(null);
  const loadingRef = useRef(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const { showModal: showRemoteModal, lastMessage, targetPage, clearMessage } = useRemoteControlStore();
  const { remoteInputEnabled } = useSettingsStore();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];

  const [discoverPage, setDiscoverPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Ref to store all search results for client-side pagination
  const allSearchResultsRef = useRef<UnifiedResult[]>([]);

  // 响应式布局配置
  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType, spacing } = responsiveConfig;

  const loadDiscoverData = useCallback(async (page: number) => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    if (page === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const response = await api.discover(page, 25);
      if (response && response.list && response.list.length > 0) {
        setResults(prev => page === 1 ? response.list : [...prev, ...response.list]);
        setDiscoverPage(page + 1);
        setHasMore(response.list.length === 25);
      } else {
        setHasMore(false);
        if (page === 1) {
          setResults([]);
        }
      }
    } catch (err) {
      logger.info("Discover data loading failed:", err);
      setHasMore(false);
      if (page === 1) {
        setResults([]);
      }
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const doSearch = useCallback(async (term: string) => {
    if (!term.trim()) {
      Keyboard.dismiss();
      setResults([]); // Clear previous search results
      allSearchResultsRef.current = [];
      setDiscoverPage(1); // Reset discover page
      setHasMore(true); // Allow discover to load more
      loadDiscoverData(1);
      return;
    }
    Keyboard.dismiss();
    setLoading(true);
    setError(null);
    setResults([]);
    allSearchResultsRef.current = [];

    try {
      const { results: searchResults } = await api.aiAssistantSearch(term);
      if (searchResults.length > 0) {
        allSearchResultsRef.current = searchResults;
        setResults(searchResults.slice(0, 25));
        setHasMore(searchResults.length > 25);
      } else {
        setError("没有找到相关内容，为你推荐...");
        loadDiscoverData(1);
      }
    } catch (err) {
      setError("搜索失败，请稍后重试。");
      logger.info("Search failed:", err);
    } finally {
      setLoading(false);
    }
  }, [loadDiscoverData]);

  useEffect(() => {
    if (lastMessage && targetPage === 'search') {
      logger.debug("Received remote input:", lastMessage);
      const realMessage = lastMessage.split("_")[0];
      setKeyword(realMessage);
      doSearch(realMessage);
      clearMessage(); // Clear the message after processing
    }
  }, [lastMessage, targetPage, clearMessage, doSearch]);

  useEffect(() => {
    if (params.q) {
      doSearch(params.q as string);
    } else {
      loadDiscoverData(1);
      const timer = setTimeout(() => {
        textInputRef.current?.focus();
      }, 200);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.q]);

  const handleSearch = (searchText?: string) => {
    const term = typeof searchText === "string" ? searchText : keyword;
    doSearch(term);
  };

  const onSearchPress = () => handleSearch();

  const handleQrPress = () => {
    if (!remoteInputEnabled) {
      Alert.alert("远程输入未启用", "请先在设置页面中启用远程输入功能", [
        { text: "取消", style: "cancel" },
        { text: "去设置", onPress: () => router.push("/settings") },
      ]);
      return;
    }
    showRemoteModal('search');
  };

  const loadMoreSearchResults = useCallback(() => {
    if (loadingMore || results.length >= allSearchResultsRef.current.length) return;

    setLoadingMore(true);

    // Small timeout to prevent blocking UI if rendering is heavy, or just to show spinner
    setTimeout(() => {
        const currentLen = results.length;
        const nextBatch = allSearchResultsRef.current.slice(currentLen, currentLen + 25);

        if (nextBatch.length > 0) {
            setResults(prev => [...prev, ...nextBatch]);
        }

        setLoadingMore(false);

        if (currentLen + nextBatch.length >= allSearchResultsRef.current.length) {
            setHasMore(false);
        }
    }, 200);
  }, [loadingMore, results.length]);

  const handleLoadMore = () => {
    if (loadingRef.current || loadingMore || !hasMore) return;

    if (keyword.trim() === "") {
        loadDiscoverData(discoverPage);
    } else {
        loadMoreSearchResults();
    }
  };

  const renderItem = ({ item, index }: { item: UnifiedResult; index: number }) => {
    const isSearchResult = 'source' in item;
    return (
        <VideoCard
        id={item.id?.toString() || `${item.title}-${index}`}
        source={isSearchResult ? (item as SearchResult).source : (item as DoubanRecommendationItem).url || ''}
        title={item.title}
        poster={item.poster}
        year={item.year}
        sourceName={isSearchResult ? (item as SearchResult).source_name : (item as DoubanRecommendationItem).platform || ''}
        rate={!isSearchResult ? (item as DoubanRecommendationItem).rate : undefined}
        api={api}
        />
    );
  };

  // 动态样式
  const dynamicStyles = useMemo(() => createResponsiveStyles(deviceType, spacing, colors), [deviceType, spacing, colors]);

  const footerComponent = useMemo(() => {
    if (!loadingMore) return null;
    return <ActivityIndicator style={{ marginVertical: 20 }} size="large" />;
  }, [loadingMore]);

  const renderSearchContent = () => (
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
          />
        </TouchableOpacity>
        <StyledButton style={dynamicStyles.searchButton} onPress={onSearchPress}>
          <Search size={deviceType === 'mobile' ? 20 : 24} color={colors.text} />
        </StyledButton>
        {deviceType !== 'mobile' && (
          <StyledButton style={dynamicStyles.qrButton} onPress={handleQrPress}>
            <QrCode size={deviceType === 'tv' ? 24 : 20} color={colors.text} />
          </StyledButton>
        )}
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
        />
      )}
      <RemoteControlModal />
    </>
  );

  const content = (
    <ThemedView style={[commonStyles.container, dynamicStyles.container]}>
      {renderSearchContent()}
    </ThemedView>
  );

  // 根据设备类型决定是否包装在响应式导航中
  if (deviceType === 'tv') {
    return content;
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
      marginRight: deviceType !== 'mobile' ? spacing / 2 : 0,
    },
    qrButton: {
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
