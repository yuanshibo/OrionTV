import React, { useEffect, useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, ActivityIndicator, StatusBar, Platform, BackHandler, View, StyleProp, ViewStyle } from "react-native";
import { FlashList, FlashListRef } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSharedValue, withTiming } from "react-native-reanimated";
import { ThemedView } from "@/components/ThemedView";
import { api } from "@/services/api";
import VideoCard from "@/components/VideoCard";
import { useFocusEffect } from "expo-router";
import useHomeStore, { RowItem, Category, DoubanFilterKey } from "@/stores/homeStore";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { getCommonResponsiveStyles } from "@/utils/ResponsiveStyles";
import ResponsiveNavigation from "@/components/navigation/ResponsiveNavigation";
import { useApiConfig } from "@/hooks/useApiConfig";
import { HomeHeader } from "@/components/navigation/HomeHeader";
import { CategoryNavigation } from "@/components/navigation/CategoryNavigation";
import { ContentDisplay } from "@/components/home/ContentDisplay";
import FilterPanel from "@/components/home/FilterPanel";
import { requestTVFocus } from "@/utils/tvUtils";
import { useShallow } from "zustand/react/shallow";
import { useFocusStore } from "@/stores/focusStore";
import { FocusPriority } from "@/types/focus";

export default function HomeScreen() {
  const fadeAnim = useSharedValue(0);
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlashListRef<RowItem>>(null);
  const firstItemRef = useRef<View>(null);
  const lastCheckedPlayRecords = useRef<number>(0);

  // 响应式布局配置
  const responsiveConfig = useResponsiveLayout();
  const commonStyles = useMemo(() => getCommonResponsiveStyles(responsiveConfig), [responsiveConfig]);
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
  } = useHomeStore(useShallow(state => ({
    categories: state.categories,
    selectedCategory: state.selectedCategory,
    contentData: state.contentData,
    loading: state.loading,
    loadingMore: state.loadingMore,
    error: state.error,
    fetchInitialData: state.fetchInitialData,
    loadMoreData: state.loadMoreData,
    selectCategory: state.selectCategory,
    updateFilterOption: state.updateFilterOption,
    refreshPlayRecords: state.refreshPlayRecords,
    clearError: state.clearError,
    hydrateFromStorage: state.hydrateFromStorage,
  })));

  const hasRecordCategory = useMemo(() => categories.some(c => c.type === "record"), [categories]);
  const hasContent = contentData.length > 0;
  const hadContentRef = useRef(hasContent);
  const selectedCategoryType = selectedCategory?.type;
  const apiConfigStatus = useApiConfig();
  const [isFilterPanelVisible, setFilterPanelVisible] = useState(false);
  const [categoryFocusTrigger, setCategoryFocusTrigger] = useState(0);
  const setFocusArea = useFocusStore(s => s.setFocusArea);

  // Set content focus area when content is displayed
  useEffect(() => {
    if (contentData.length > 0 && !loading) {
      setFocusArea('content', FocusPriority.CONTENT);
    }
  }, [contentData.length, loading, setFocusArea]);

  useEffect(() => {
    void hydrateFromStorage();
  }, [hydrateFromStorage]);

  useFocusEffect(
    useCallback(() => {
      if (selectedCategoryType === "record") {
        refreshPlayRecords().then(() => setCategoryFocusTrigger(p => p + 1));
      } else if (!hasRecordCategory) {
        const now = Date.now();
        if (now - lastCheckedPlayRecords.current > 5000) {
          refreshPlayRecords();
          lastCheckedPlayRecords.current = now;
        }
      }
    }, [refreshPlayRecords, selectedCategoryType, hasRecordCategory])
  );

  const backPressTimeRef = useRef<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      const handleBackPress = () => {
        if (isFilterPanelVisible) {
          setFilterPanelVisible(false);
          return true;
        }
        const now = Date.now();
        if (!backPressTimeRef.current || now - backPressTimeRef.current > 2000) {
          listRef.current?.scrollToOffset({ offset: 0, animated: true });
          setTimeout(() => {
            requestTVFocus(firstItemRef, { priority: FocusPriority.CONTENT, duration: 300 });
          }, 300);
          backPressTimeRef.current = now;
          return true;
        }
        BackHandler.exitApp();
        return true;
      };
      if (Platform.OS === "android") {
        const backHandler = BackHandler.addEventListener("hardwareBackPress", handleBackPress);
        return () => {
          backHandler.remove();
          backPressTimeRef.current = null;
        };
      }
    }, [isFilterPanelVisible])
  );

  // 数据获取逻辑
  useEffect(() => {
    if (!selectedCategory || (selectedCategory.tags && !selectedCategory.tag) || !apiConfigStatus.isConfigured || apiConfigStatus.needsConfiguration) {
      return;
    }
    fetchInitialData();
  }, [selectedCategory, selectedCategory?.tag, apiConfigStatus.isConfigured, apiConfigStatus.needsConfiguration, fetchInitialData]);

  // 错误状态清理
  useEffect(() => {
    if (apiConfigStatus.needsConfiguration && error) {
      clearError();
    }
  }, [apiConfigStatus.needsConfiguration, error, clearError]);

  // 内容淡入动画
  useEffect(() => {
    if (loading && !hasContent) {
      fadeAnim.value = 0;
    } else if (!loading && hasContent) {
      if (!hadContentRef.current) {
        fadeAnim.value = 0;
        fadeAnim.value = withTiming(1, { duration: 300 });
      } else {
        fadeAnim.value = 1;
      }
    } else if (!loading && !hasContent) {
      fadeAnim.value = 1;
    }
    hadContentRef.current = hasContent;
  }, [loading, hasContent, fadeAnim]);

  const handleCategorySelect = useCallback((category: Category) => {
    if (category.title === "所有") {
      selectCategory(category);
      setFilterPanelVisible(true);
      return;
    }
    selectCategory(category);
  }, [selectCategory]);

  const handleCategoryLongPress = useCallback((category: Category) => {
    if (deviceType === "tv" && category.title === "所有") {
      setFilterPanelVisible(true);
    }
  }, [deviceType]);

  const handleTagSelect = useCallback((tag: string) => {
    if (selectedCategory) {
      const categoryWithTag = { ...selectedCategory, tag };
      selectCategory(categoryWithTag);
    }
  }, [selectCategory, selectedCategory]);

  const handleFilterChange = useCallback((change: { tag: string } | { filterKey: DoubanFilterKey; filterValue: string }) => {
    if (!selectedCategory) return;
    if ("tag" in change) {
      if (selectedCategory.tag === change.tag) return;
      const categoryWithTag = { ...selectedCategory, tag: change.tag };
      selectCategory(categoryWithTag);
    } else {
      if (selectedCategory.activeFilters?.[change.filterKey] === change.filterValue) return;
      updateFilterOption(selectedCategory.title, change.filterKey, change.filterValue);
    }
  }, [selectedCategory, selectCategory, updateFilterOption]);

  // 动态样式
  const dynamicContainerStyle = useMemo(() => ({ paddingTop: deviceType === "mobile" ? insets.top : deviceType === "tablet" ? insets.top + 20 : 40 }), [deviceType, insets.top]);

  const headerStyles = useMemo(() => StyleSheet.create({
    headerContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing * 1.5, marginBottom: spacing / 2 },
    headerTitle: { fontSize: deviceType === "mobile" ? 24 : deviceType === "tablet" ? 28 : 32, fontWeight: "bold", paddingTop: 16, height: 45 },
    rightHeaderButtons: { flexDirection: "row", alignItems: "center" },
    iconButton: { borderRadius: 30, marginLeft: spacing / 2 },
  }), [deviceType, spacing]);

  const categoryStyles = useMemo(() => StyleSheet.create({
    categoryContainer: { paddingBottom: spacing / 10 },
    categoryListContent: { paddingHorizontal: spacing },
    categoryButton: { paddingHorizontal: deviceType === "tv" ? spacing / 6 : spacing / 2, paddingVertical: spacing / 4, borderRadius: deviceType === "mobile" ? 6 : 8, marginHorizontal: deviceType === "tv" ? spacing / 6 : spacing / 2 },
    categoryText: { fontSize: deviceType === "mobile" ? 14 : 16, fontWeight: "500" },
  }), [deviceType, spacing]);

  const selectedCategoryRef = useRef(selectedCategory);
  selectedCategoryRef.current = selectedCategory;

  const showFilterPanel = useCallback(() => setFilterPanelVisible(true), []);
  const noOp = useCallback(() => { }, []);

  const renderContentItem = useCallback(({ item, index, style }: { item: RowItem; index: number; style?: StyleProp<ViewStyle> }) => {
    const currentCategory = selectedCategoryRef.current;
    const isFilterable = currentCategory?.title === "所有";
    const isRecord = currentCategory?.type === "record";
    let longPressAction;
    if (deviceType === "tv") {
      if (isFilterable) longPressAction = showFilterPanel;
      else if (isRecord) longPressAction = undefined;
      else longPressAction = noOp;
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
        onRecordDeleted={fetchInitialData}
        onLongPress={longPressAction}
        style={style}
      />
    );
  }, [fetchInitialData, deviceType, showFilterPanel, noOp]);

  const footerComponent = useMemo(() => {
    if (!loadingMore) return null;
    return <ActivityIndicator style={{ marginVertical: 20 }} size="large" />;
  }, [loadingMore]);

  const content = (
    <ThemedView style={[commonStyles.container, dynamicContainerStyle]}>
      {deviceType === "mobile" && <StatusBar barStyle="light-content" />}
      {deviceType !== "mobile" && <HomeHeader styles={headerStyles} />}
      <CategoryNavigation
        categories={categories}
        selectedCategory={selectedCategory}
        onCategorySelect={handleCategorySelect}
        onCategoryLongPress={handleCategoryLongPress}
        onTagSelect={handleTagSelect}
        categoryStyles={categoryStyles}
        deviceType={deviceType}
        spacing={spacing}
        focusTrigger={categoryFocusTrigger}
      />
      <ContentDisplay
        apiConfigStatus={apiConfigStatus}
        selectedCategory={selectedCategory}
        loading={loading}
        error={error}
        fadeAnim={fadeAnim}
        commonStyles={commonStyles}
        spacing={spacing}
        contentData={contentData}
        listRef={listRef}
        renderContentItem={renderContentItem}
        loadMoreData={loadMoreData}
        loadingMore={loadingMore}
        footerComponent={footerComponent}
      />
      {selectedCategory && (
        <FilterPanel
          isVisible={isFilterPanelVisible}
          onClose={() => {
            setFilterPanelVisible(false);
            setCategoryFocusTrigger(p => p + 1);
          }}
          category={selectedCategory}
          onFilterChange={handleFilterChange}
          deviceType={deviceType}
        />
      )}
    </ThemedView>
  );

  if (deviceType === "tv") return content;
  return <ResponsiveNavigation>{content}</ResponsiveNavigation>;
}
