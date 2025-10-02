import React, { useEffect, useCallback, useMemo, useRef } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Animated,
  StatusBar,
  Platform,
  BackHandler,
  ToastAndroid,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { api } from "@/services/api";
import VideoCard from "@/components/VideoCard";
import { useFocusEffect, useRouter } from "expo-router";
import { Search, Settings, LogOut, Heart } from "lucide-react-native";
import { StyledButton } from "@/components/StyledButton";
import useHomeStore, { RowItem, Category, DoubanFilterKey } from "@/stores/homeStore";
import useAuthStore from "@/stores/authStore";
import CustomScrollView from "@/components/CustomScrollView";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { getCommonResponsiveStyles } from "@/utils/ResponsiveStyles";
import ResponsiveNavigation from "@/components/navigation/ResponsiveNavigation";
import { useApiConfig, getApiConfigErrorMessage } from "@/hooks/useApiConfig";
import { Colors } from "@/constants/Colors";

const LOAD_MORE_THRESHOLD = 200;

export default function HomeScreen() {
  const router = useRouter();
  const colorScheme = "dark";
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  // 响应式布局配置
  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType, spacing } = responsiveConfig;
  const {
    categories,
    selectedCategory,
    contentData,
    loading,
    loadingMore,
    error,
    fetchInitialData,
    loadMoreData,
    selectCategory,
    updateFilterOption,
    refreshPlayRecords,
    clearError,
    hydrateFromStorage,
  } = useHomeStore();
  const hasRecordCategory = useMemo(() => categories.some((category) => category.type === "record"), [categories]);
  const hasContent = contentData.length > 0;
  const hadContentRef = useRef(hasContent);
  const selectedCategoryType = selectedCategory?.type;
  const { isLoggedIn, logout } = useAuthStore();
  const apiConfigStatus = useApiConfig();

  useEffect(() => {
    void hydrateFromStorage();
  }, [hydrateFromStorage]);

  useFocusEffect(
    useCallback(() => {
      if (selectedCategoryType === "record") {
        refreshPlayRecords();
      }
    }, [refreshPlayRecords, selectedCategoryType])
  );

  useFocusEffect(
    useCallback(() => {
      if (!hasRecordCategory) {
        refreshPlayRecords();
      }
    }, [hasRecordCategory, refreshPlayRecords])
  );

    // 双击返回退出逻辑（只限当前页面）
  const backPressTimeRef = useRef<number | null>(null);

  useFocusEffect(
    useCallback(() => {
    const handleBackPress = () => {
      const now = Date.now();

      // 如果还没按过返回键，或距离上次超过2秒
      if (!backPressTimeRef.current || now - backPressTimeRef.current > 2000) {
        backPressTimeRef.current = now;

        ToastAndroid.show("再按一次返回键退出", ToastAndroid.SHORT);
        return true; // 拦截返回事件，不退出
      }

      // 两次返回键间隔小于2秒，退出应用
      BackHandler.exitApp();
      return true;
    };

    // 仅限 Android 平台启用此功能
    if (Platform.OS === "android") {
      const backHandler = BackHandler.addEventListener("hardwareBackPress", handleBackPress);

      // 返回首页时重置状态
      return () => {
        backHandler.remove();
        backPressTimeRef.current = null;
      };
    }
  }, [])
);

  // 统一的数据获取逻辑
  useEffect(() => {
    if (!selectedCategory) return;

    if (selectedCategory.tags && !selectedCategory.tag) {
      return;
    }

    if (!apiConfigStatus.isConfigured || apiConfigStatus.needsConfiguration) {
      return;
    }

    fetchInitialData();
  }, [
    selectedCategory,
    selectedCategory?.tag,
    apiConfigStatus.isConfigured,
    apiConfigStatus.needsConfiguration,
    fetchInitialData,
  ]);

  // 清除错误状态的逻辑
  useEffect(() => {
    if (apiConfigStatus.needsConfiguration && error) {
      clearError();
    }
  }, [apiConfigStatus.needsConfiguration, error, clearError]);

  useEffect(() => {
    // 只在从"无内容"到"有内容"的真正转换时才播放淡入动画
    if (loading && !hasContent) {
      // 正在加载且当前无内容,隐藏内容区域
      fadeAnim.setValue(0);
    } else if (!loading && hasContent) {
      // 加载完成且有内容
      if (!hadContentRef.current) {
        // 从无内容到有内容的转换,播放淡入动画
        fadeAnim.setValue(0);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      } else {
        // 内容刷新(从后台返回等场景),保持可见状态,不播放动画
        fadeAnim.setValue(1);
      }
    } else if (!loading && !hasContent) {
      // 加载完成但无内容(空状态),保持可见以显示空状态提示
      fadeAnim.setValue(1);
    }
    // loading && hasContent 的情况不处理,保持当前状态
    hadContentRef.current = hasContent;
  }, [loading, hasContent, fadeAnim]);

  const handleCategorySelect = useCallback(
    (category: Category) => {
      selectCategory(category);
    },
    [selectCategory]
  );

  const handleTagSelect = useCallback(
    (tag: string) => {
      if (selectedCategory) {
        const categoryWithTag = { ...selectedCategory, tag };
        selectCategory(categoryWithTag);
      }
    },
    [selectCategory, selectedCategory]
  );

  const handleFilterSelect = useCallback(
    (groupKey: DoubanFilterKey, value: string) => {
      if (!selectedCategory || !selectedCategory.filterConfig) {
        return;
      }

      if (selectedCategory.activeFilters?.[groupKey] === value) {
        return;
      }

      updateFilterOption(selectedCategory.title, groupKey, value);
    },
    [selectedCategory, updateFilterOption]
  );

  const insetTop = insets.top;

  const selectedTag = useMemo(() => {
    if (!selectedCategory) {
      return null;
    }

    if (selectedCategory.tag) {
      return selectedCategory.tag;
    }

    if (selectedCategory.tags?.length) {
      return selectedCategory.tags[0];
    }

    return null;
  }, [selectedCategory]);

  const dynamicStyles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          paddingTop: deviceType === "mobile" ? insetTop : deviceType === "tablet" ? insetTop + 20 : 40,
        },
        headerContainer: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: spacing * 1.5,
          marginBottom: spacing,
        },
        headerTitle: {
          fontSize: deviceType === "mobile" ? 24 : deviceType === "tablet" ? 28 : 32,
          fontWeight: "bold",
          paddingTop: 16,
          height: 45,
        },
        rightHeaderButtons: {
          flexDirection: "row",
          alignItems: "center",
        },
        iconButton: {
          borderRadius: 30,
          marginLeft: spacing / 2,
        },
        categoryContainer: {
          paddingBottom: spacing / 2,
        },
        categoryListContent: {
          paddingHorizontal: spacing,
        },
        categoryButton: {
          paddingHorizontal: deviceType === "tv" ? spacing / 4 : spacing / 2,
          paddingVertical: spacing / 2,
          borderRadius: deviceType === "mobile" ? 6 : 8,
          marginHorizontal: deviceType === "tv" ? spacing / 4 : spacing / 2,
        },
        filterContainer: {
          paddingHorizontal: spacing,
          marginBottom: spacing / 2,
        },
        filterGroup: {
          marginBottom: spacing / 2,
          flexDirection: "row",
          alignItems: "center",
        },
        filterGroupLabel: {
          fontSize: deviceType === "tv" ? 20 : deviceType === "tablet" ? 16 : 13,
          color: Colors.dark.icon,
          marginRight: spacing / 2,
          fontWeight: "600",
          minWidth: deviceType === "tv" ? 72 : 52,
        },
        filterOptionsList: {
          flex: 1,
        },
        filterOptionsRow: {
          flexDirection: "row",
          alignItems: "center",
          paddingRight: spacing / 2,
        },
        filterOptionButton: {
          marginRight: spacing / 2,
          paddingHorizontal: deviceType === "tv" ? spacing : spacing * 0.75,
          paddingVertical: deviceType === "tv" ? spacing / 1.5 : spacing / 2.5,
          minHeight: deviceType === "tv" ? 52 : undefined,
          minWidth: deviceType === "tv" ? 88 : undefined,
        },
        filterOptionText: {
          fontSize: deviceType === "tv" ? 22 : deviceType === "tablet" ? 18 : 16,
          fontWeight: "600",
        },
        categoryText: {
          fontSize: deviceType === "mobile" ? 14 : 16,
          fontWeight: "500",
        },
        contentContainer: {
          flex: 1,
        },
      }),
    [deviceType, insetTop, spacing]
  );

  const renderCategory = useCallback(
    ({ item }: { item: Category }) => {
      const isSelected = selectedCategory?.title === item.title;
      return (
        <StyledButton
          text={item.title}
          onPress={() => handleCategorySelect(item)}
          isSelected={isSelected}
          hasTVPreferredFocus={isSelected}
          style={dynamicStyles.categoryButton}
          textStyle={dynamicStyles.categoryText}
        />
      );
    },
    [dynamicStyles, handleCategorySelect, selectedCategory?.title]
  );

  const renderContentItem = useCallback(
    ({ item }: { item: RowItem; index: number }) => (
      <VideoCard
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
        onRecordDeleted={fetchInitialData}
      />
    ),
    [fetchInitialData]
  );

  const footerComponent = useMemo(() => {
    if (!loadingMore) return null;
    return <ActivityIndicator style={{ marginVertical: 20 }} size="large" />;
  }, [loadingMore]);

  // 检查是否需要显示API配置提示
  const shouldShowApiConfig = apiConfigStatus.needsConfiguration && selectedCategory && !selectedCategory.tags;

  // TV端和平板端的顶部导航
  const renderHeader = () => {
    if (deviceType === "mobile") {
      // 移动端不显示顶部导航，使用底部Tab导航
      return null;
    }

    return (
      <View style={dynamicStyles.headerContainer}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <ThemedText style={dynamicStyles.headerTitle}>首页</ThemedText>
        </View>
        <View style={dynamicStyles.rightHeaderButtons}>
          <StyledButton style={dynamicStyles.iconButton} onPress={() => router.push("/favorites")} variant="ghost">
            <Heart color={colorScheme === "dark" ? "white" : "black"} size={24} />
          </StyledButton>
          <StyledButton
            style={dynamicStyles.iconButton}
            onPress={() => router.push({ pathname: "/search" })}
            variant="ghost"
          >
            <Search color={colorScheme === "dark" ? "white" : "black"} size={24} />
          </StyledButton>
          <StyledButton style={dynamicStyles.iconButton} onPress={() => router.push("/settings")} variant="ghost">
            <Settings color={colorScheme === "dark" ? "white" : "black"} size={24} />
          </StyledButton>
          {isLoggedIn && (
            <StyledButton style={dynamicStyles.iconButton} onPress={logout} variant="ghost">
              <LogOut color={colorScheme === "dark" ? "white" : "black"} size={24} />
            </StyledButton>
          )}
        </View>
      </View>
    );
  };

  // 动态样式
  const content = (
    <ThemedView style={[commonStyles.container, dynamicStyles.container]}>
      {/* 状态栏 */}
      {deviceType === "mobile" && <StatusBar barStyle="light-content" />}

      {/* 顶部导航 */}
      {renderHeader()}

      {/* 分类选择器 */}
      <View style={dynamicStyles.categoryContainer}>
        <FlatList
          data={categories}
          renderItem={renderCategory}
          keyExtractor={(item) => item.title}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={dynamicStyles.categoryListContent}
        />
      </View>

      {/* 筛选条件按钮 */}
      {selectedCategory && selectedCategory.filterConfig && (
        <View style={dynamicStyles.filterContainer}>
          {selectedCategory.filterConfig.groups.map((group, groupIndex) => {
            const activeValue = selectedCategory.activeFilters?.[group.key] ?? group.defaultValue;

            return (
              <View key={group.key} style={dynamicStyles.filterGroup}>
                <ThemedText style={dynamicStyles.filterGroupLabel}>{group.label}</ThemedText>
                <FlatList
                  horizontal
                  data={group.options}
                  style={dynamicStyles.filterOptionsList}
                  contentContainerStyle={dynamicStyles.filterOptionsRow}
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(option) => option.value}
                  renderItem={({ item: option, index: optionIndex }) => {
                    const isSelected = activeValue === option.value;
                    return (
                      <StyledButton
                        text={option.label}
                        onPress={() => handleFilterSelect(group.key, option.value)}
                        isSelected={isSelected}
                        style={dynamicStyles.filterOptionButton}
                        textStyle={dynamicStyles.filterOptionText}
                        variant="ghost"
                        hasTVPreferredFocus={groupIndex === 0 && optionIndex === 0}
                      />
                    );
                  }}
                />
              </View>
            );
          })}
        </View>
      )}

      {/* 子分类标签 */}
      {selectedCategory && selectedCategory.tags && (
        <View style={dynamicStyles.categoryContainer}>
          <FlatList
            data={selectedCategory.tags}
            renderItem={({ item, index }) => {
              const isSelected = selectedTag === item;
              return (
                <StyledButton
                  hasTVPreferredFocus={index === 0}
                  text={item}
                  onPress={() => handleTagSelect(item)}
                  isSelected={isSelected}
                  style={dynamicStyles.categoryButton}
                  textStyle={dynamicStyles.categoryText}
                  variant="ghost"
                />
              );
            }}
            keyExtractor={(item) => item}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={dynamicStyles.categoryListContent}
          />
        </View>
      )}

      {/* 内容网格 */}
      {shouldShowApiConfig ? (
        <View style={commonStyles.center}>
          <ThemedText type="subtitle" style={{ padding: spacing, textAlign: "center" }}>
            {getApiConfigErrorMessage(apiConfigStatus)}
          </ThemedText>
        </View>
      ) : apiConfigStatus.isValidating ? (
        <View style={commonStyles.center}>
          <ActivityIndicator size="large" />
          <ThemedText type="subtitle" style={{ padding: spacing, textAlign: "center" }}>
            正在验证服务器配置...
          </ThemedText>
        </View>
      ) : apiConfigStatus.error && !apiConfigStatus.isValid ? (
        <View style={commonStyles.center}>
          <ThemedText type="subtitle" style={{ padding: spacing, textAlign: "center" }}>
            {apiConfigStatus.error}
          </ThemedText>
        </View>
      ) : loading ? (
        <View style={commonStyles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : error ? (
        <View style={commonStyles.center}>
          <ThemedText type="subtitle" style={{ padding: spacing }}>
            {error}
          </ThemedText>
        </View>
      ) : (
        <Animated.View style={[dynamicStyles.contentContainer, { opacity: fadeAnim }]}>
          <CustomScrollView
            data={contentData}
            renderItem={renderContentItem}
            loading={loading}
            loadingMore={loadingMore}
            error={error}
            onEndReached={loadMoreData}
            loadMoreThreshold={LOAD_MORE_THRESHOLD}
            emptyMessage={selectedCategory?.tags ? "请选择一个子分类" : "该分类下暂无内容"}
            ListFooterComponent={footerComponent}
          />
        </Animated.View>
      )}
    </ThemedView>
  );

  // 根据设备类型决定是否包装在响应式导航中
  if (deviceType === "tv") {
    return content;
  }

  return <ResponsiveNavigation>{content}</ResponsiveNavigation>;
}
