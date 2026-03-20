import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { View, TextInput, StyleSheet, Alert, TouchableOpacity, useColorScheme, ActivityIndicator, StyleProp, ViewStyle } from "react-native";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import VideoCardMobile from "@/components/VideoCard.mobile";
import VideoCardTV from "@/components/VideoCard.tv";
import VideoLoadingAnimation from "@/components/VideoLoadingAnimation";
import { api } from "@/services/api";
import { useSearchStore } from "@/stores/searchStore";
import { VideoCardViewModel } from "@/utils/searchUtils";
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
import { DynamicBackground } from "@/components/DynamicBackground";

const logger = Logger.withTag("SearchScreen");



export default function SearchScreen() {
  const params = useLocalSearchParams();
  const {
    keyword, results, loading, error, discoverPage, loadingMore, hasMore,
    setKeyword, loadDiscoverData, doSearch, loadMoreSearchResults, handleSearch, resetSearch
  } = useSearchStore();

  const textInputRef = useRef<TextInput>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const { showModal: showRemoteModal, lastMessage, targetPage, clearMessage } = useRemoteControlStore();
  const { remoteInputEnabled } = useSettingsStore();
  const router = useRouter();
  const colorScheme = useColorScheme() === 'light' ? 'light' : 'dark';
  const colors = Colors[colorScheme];
  const [focusedPoster, setFocusedPoster] = useState<string | null>(null);

  // 响应式布局配置
  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType, spacing } = responsiveConfig;


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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.q]);

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

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;

    if (keyword.trim() === "") {
      loadDiscoverData(discoverPage);
    } else {
      loadMoreSearchResults();
    }
  };

  const renderItem = useCallback(({ item, style }: { item: VideoCardViewModel; index: number; style?: StyleProp<ViewStyle> }) => {
    if (deviceType === 'mobile') {
      return (
        <VideoCardMobile
          id={item.id}
          source={item.source}
          title={item.title}
          poster={item.poster}
          year={item.year}
          sourceName={item.sourceName}
          rate={item.rate}
          api={api}
          style={style}
        />
      );
    } else {
      return (
        <VideoCardTV
          id={item.id}
          source={item.source}
          title={item.title}
          poster={item.poster}
          year={item.year}
          sourceName={item.sourceName}
          rate={item.rate}
          api={api}
          style={style}
          onFocus={(item: any) => setFocusedPoster(item?.poster || null)}
        />
      );
    }
  }, [deviceType]);

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
        <RemoteControlModal />
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
