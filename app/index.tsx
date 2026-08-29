import React, { useEffect, useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, StatusBar, View } from "react-native";
import { FlashListRef } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSharedValue, withTiming } from "react-native-reanimated";
import { ThemedView } from "@/components/ThemedView";
import { useFocusEffect } from "expo-router";
import { useHomeUIStore } from "@/stores/homeUIStore";
import { useHomeDataStore } from "@/stores/homeDataStore";
import { RowItem, Category, DoubanFilterKey } from "@/types";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useTVBackHandler } from "@/hooks/useTVBackHandler";
import { getCommonResponsiveStyles } from "@/utils/ResponsiveStyles";
import ResponsiveNavigation from "@/components/navigation/ResponsiveNavigation";
import { useApiConfig } from "@/hooks/useApiConfig";
import { SyncQueue } from "@/services/storage/SyncQueue";
import { HomeHeader } from "@/components/navigation/HomeHeader";
import { CategoryNavigation } from "@/components/navigation/CategoryNavigation";
import { ContentDisplay } from "@/components/home/ContentDisplay";
import FilterPanel from "@/components/home/FilterPanel";
import { requestTVFocus } from "@/utils/tvUtils";
import { useShallow } from "zustand/react/shallow";
import { useFocusStore } from "@/stores/focusStore";
import { FocusPriority } from "@/types/focus";
import { DynamicBackground } from "@/components/DynamicBackground";

export default function HomeScreen() {
  const fadeAnim = useSharedValue(0);
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlashListRef<RowItem>>(null);
  const firstItemRef = useRef<View>(null);
  const searchButtonRef = useRef<View>(null);
  const selectedCategoryRef = useRef<View>(null);
  const allCategoryRef = useRef<View>(null);
  const [searchButtonTag, setSearchButtonTag] = useState<number | undefined>(undefined);
  const [selectedCategoryTag, setSelectedCategoryTag] = useState<number | undefined>(undefined);
  const [allCategoryTag, setAllCategoryTag] = useState<number | undefined>(undefined);
  const lastCheckedPlayRecords = useRef<number>(0);
  const posterUpdateTimer = useRef<any>(null);

  // 响应式布局配置
  const responsiveConfig = useResponsiveLayout();
  const commonStyles = useMemo(() => getCommonResponsiveStyles(responsiveConfig), [responsiveConfig]);
  const { deviceType, spacing } = responsiveConfig;

  // UI Store
  const {
    categories,
    selectedCategory,
    selectCategory,
    updateFilterOption,
    refreshPlayRecords,
    deletePlayRecord,
    initialize,
    setFocusedPoster,
    setLastFocusedCardIndex,
    setCurrentFocusArea,
  } = useHomeUIStore(useShallow(state => ({
    categories: state.categories,
    selectedCategory: state.selectedCategory,
    selectCategory: state.selectCategory,
    updateFilterOption: state.updateFilterOption,
    refreshPlayRecords: state.refreshPlayRecords,
    deletePlayRecord: state.deletePlayRecord,
    initialize: state.initialize,
    setFocusedPoster: state.setFocusedPoster,
    setLastFocusedCardIndex: state.setLastFocusedCardIndex,
    setCurrentFocusArea: state.setCurrentFocusArea,
  })));

  // Data Store
  const {
    contentData,
    loading,
    loadingMore,
    error,
    loadMoreData,
    clearError,
    hydrateFromStorage,
  } = useHomeDataStore(useShallow(state => ({
    contentData: state.contentData,
    loading: state.loading,
    loadingMore: state.loadingMore,
    error: state.error,
    loadMoreData: state.loadMoreData,
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
      // Set initial background if available (for mobile/tablet)
      if (deviceType !== 'tv' && contentData[0]?.poster) {
        setFocusedPoster(contentData[0].poster);
      }
    }
  }, [contentData.length, loading, setFocusArea, deviceType, contentData, setFocusedPoster]);

  useEffect(() => {
    void hydrateFromStorage();
    void SyncQueue.flush();
  }, [hydrateFromStorage]);

  useFocusEffect(
    useCallback(() => {
      if (selectedCategoryType === "record") {
        refreshPlayRecords()
          .then(() => setCategoryFocusTrigger(p => p + 1))
          .catch(() => {});
      } else if (!hasRecordCategory) {
        const now = Date.now();
        if (now - lastCheckedPlayRecords.current > 5000) {
          refreshPlayRecords().catch(() => {});
          lastCheckedPlayRecords.current = now;
        }
      }
    }, [refreshPlayRecords, selectedCategoryType, hasRecordCategory])
  );

  useTVBackHandler({
    doublePressToExit: true,
    exitToastMessage: "再按一次退出",
    onBackPress: useCallback(() => {
      // Level 1: If filter panel is visible, close it and refocus category
      if (isFilterPanelVisible) {
        setFilterPanelVisible(false);
        setCategoryFocusTrigger(p => p + 1);
        return true;
      }

      const currentArea = useHomeUIStore.getState().currentFocusArea;
      const lastIndex = useHomeUIStore.getState().lastFocusedCardIndex;
      const columns = responsiveConfig.columns || 4;

      // Level 2: If focus is deep in content (beyond row 1), scroll to top & focus first card
      if (currentArea === "content" && lastIndex >= columns) {
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
        setTimeout(() => {
          requestTVFocus(firstItemRef, { priority: FocusPriority.CONTENT, duration: 300 });
        }, 250);
        return true;
      }

      // Level 3: If focus is in row 1 of content or on tags, retreat back to categories
      if (currentArea === "content" || currentArea === "tags") {
        setCategoryFocusTrigger(p => p + 1);
        return true;
      }

      // Return false so doublePressToExit can handle the exit prompt
      return false;
    }, [isFilterPanelVisible, responsiveConfig.columns]),
  });

  // 数据获取逻辑
  useEffect(() => {
    if (!selectedCategory || (selectedCategory.tags && !selectedCategory.tag) || !apiConfigStatus.isConfigured || apiConfigStatus.needsConfiguration) {
      return;
    }

    // Initial data hydration if empty
    if (contentData.length === 0 && !loading) {
      initialize();
    }
  }, [selectedCategory, selectedCategory?.tag, apiConfigStatus.isConfigured, apiConfigStatus.needsConfiguration, initialize, contentData.length, loading]);

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

  const lastFocusTimeRef = useRef(0);

  const handleItemFocus = useCallback((item: any) => {
    setCurrentFocusArea('content');
    if (item?.index !== undefined) {
      setLastFocusedCardIndex(item.index);
    }
    if (posterUpdateTimer.current) {
      clearTimeout(posterUpdateTimer.current);
    }
    if (item?.poster) {
      const now = Date.now();
      const isFastScrolling = now - lastFocusTimeRef.current < 150;
      lastFocusTimeRef.current = now;
      // D-Pad fast scroll debounce protection
      const delay = isFastScrolling ? 250 : 180;
      posterUpdateTimer.current = setTimeout(() => {
        setFocusedPoster(item.poster);
      }, delay);
    }
  }, [setCurrentFocusArea, setLastFocusedCardIndex, setFocusedPoster]);

  useEffect(() => {
    return () => {
      if (posterUpdateTimer.current) {
        clearTimeout(posterUpdateTimer.current);
      }
    };
  }, []);

  // 动态样式
  const dynamicContainerStyle = useMemo(() => ({ paddingTop: deviceType === "mobile" ? insets.top : deviceType === "tablet" ? insets.top + 20 : 20 }), [deviceType, insets.top]);

  const headerStyles = useMemo(() => StyleSheet.create({
    headerContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing * 1.5, marginBottom: spacing / 2 },
    headerTitle: { fontSize: deviceType === "mobile" ? 24 : deviceType === "tablet" ? 28 : 32, fontWeight: "bold", paddingTop: 0, height: 45 },
    rightHeaderButtons: { flexDirection: "row", alignItems: "center" },
    iconButton: { borderRadius: 30, marginLeft: spacing / 2 },
  }), [deviceType, spacing]);

  const categoryStyles = useMemo(() => StyleSheet.create({
    categoryContainer: { paddingBottom: spacing / 10 },
    categoryListContent: { paddingHorizontal: spacing },
    categoryButton: { paddingHorizontal: deviceType === "tv" ? spacing / 6 : spacing / 2, paddingVertical: spacing / 4, borderRadius: deviceType === "mobile" ? 6 : 8, marginHorizontal: deviceType === "tv" ? spacing / 6 : spacing / 2 },
    categoryText: { fontSize: deviceType === "mobile" ? 14 : 16, fontWeight: "500" },
  }), [deviceType, spacing]);

  const showFilterPanel = useCallback(() => setFilterPanelVisible(true), []);

  const content = (
    <ThemedView style={[commonStyles.container, dynamicContainerStyle]}>
      <DynamicBackground />

      {deviceType === "mobile" && <StatusBar barStyle="light-content" />}
      {deviceType !== "mobile" && (
        <HomeHeader
          styles={headerStyles}
          searchButtonRef={searchButtonRef}
          selectedCategoryRef={selectedCategoryRef}
          allCategoryRef={allCategoryRef}
          selectedCategoryTag={selectedCategoryTag}
          allCategoryTag={allCategoryTag}
          onSearchButtonMount={(tag) => setSearchButtonTag(tag)}
        />
      )}
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
        selectedCategoryRef={selectedCategoryRef}
        searchButtonRef={searchButtonRef}
        firstItemRef={firstItemRef}
        allCategoryRef={allCategoryRef}
        searchButtonTag={searchButtonTag}
        onSelectedCategoryMount={(tag) => setSelectedCategoryTag(tag)}
        onAllCategoryMount={(tag) => setAllCategoryTag(tag)}
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
        loadMoreData={() => selectedCategory && loadMoreData(selectedCategory)}
        loadingMore={loadingMore}
        deviceType={deviceType}
        onShowFilterPanel={showFilterPanel}
        onRecordDeleted={deletePlayRecord}
        firstItemRef={firstItemRef}
        selectedCategoryRef={selectedCategoryRef}
        onFocus={handleItemFocus}
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
