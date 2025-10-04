import React, { useEffect, useMemo, useRef, useCallback } from "react";
import { View, StyleSheet, ActivityIndicator, Animated, StatusBar, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { StyledButton } from "@/components/StyledButton";
import VideoCard from "@/components/VideoCard";
import CustomScrollView from "@/components/CustomScrollView";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { getCommonResponsiveStyles } from "@/utils/ResponsiveStyles";
import useHomeStore, { Category, DoubanFilterKey, RowItem } from "@/stores/homeStore";
import { Colors } from "@/constants/Colors";
import { api } from "@/services/api";
import { useApiConfig, getApiConfigErrorMessage } from "@/hooks/useApiConfig";

const LOAD_MORE_THRESHOLD = 200;

const isTargetCategory = (category: Category | undefined, title: string | undefined) =>
  !!category && category.title === title;

export default function CategoryScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const { title } = useLocalSearchParams<{ title?: string }>();
  const categoryTitle = Array.isArray(title) ? title[0] : title;

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
    clearError,
  } = useHomeStore();
  const apiConfigStatus = useApiConfig();

  const targetCategory = useMemo(
    () => categories.find((category) => category.title === categoryTitle),
    [categories, categoryTitle]
  );

  const isActiveCategory = isTargetCategory(selectedCategory, targetCategory?.title);
  const activeCategory = isActiveCategory ? selectedCategory : targetCategory;

  const hasContent = contentData.length > 0;
  const hadContentRef = useRef(hasContent);

  useEffect(() => {
    if (targetCategory && !isTargetCategory(selectedCategory, targetCategory.title)) {
      selectCategory(targetCategory);
    }
  }, [selectCategory, selectedCategory, targetCategory]);

  useEffect(() => {
    if (!isActiveCategory || !selectedCategory) {
      return;
    }

    if (selectedCategory.tags && !selectedCategory.tag) {
      return;
    }

    if (!apiConfigStatus.isConfigured || apiConfigStatus.needsConfiguration) {
      return;
    }

    fetchInitialData();
  }, [
    apiConfigStatus.isConfigured,
    apiConfigStatus.needsConfiguration,
    fetchInitialData,
    isActiveCategory,
    selectedCategory,
    selectedCategory?.tag,
  ]);

  useEffect(() => {
    if (apiConfigStatus.needsConfiguration && error) {
      clearError();
    }
  }, [apiConfigStatus.needsConfiguration, error, clearError]);

  useEffect(() => {
    if (!isActiveCategory) {
      return;
    }

    if (loading && !hasContent) {
      fadeAnim.setValue(0);
    } else if (!loading && hasContent) {
      if (!hadContentRef.current) {
        fadeAnim.setValue(0);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      } else {
        fadeAnim.setValue(1);
      }
    } else if (!loading && !hasContent) {
      fadeAnim.setValue(1);
    }

    hadContentRef.current = hasContent;
  }, [fadeAnim, hasContent, isActiveCategory, loading]);

  const insetTop = insets.top;

  const selectedTag = useMemo(() => {
    if (!activeCategory) {
      return null;
    }

    if (activeCategory.tag) {
      return activeCategory.tag;
    }

    if (activeCategory.tags?.length) {
      return activeCategory.tags[0];
    }

    return null;
  }, [activeCategory]);

  const dynamicStyles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          paddingTop: deviceType === "mobile" ? insetTop : deviceType === "tablet" ? insetTop + 20 : 20,
        },
        filterContainer: {
          paddingHorizontal: spacing,
        },

        filterGroup: {
          width: "100%",
          flexDirection: "row",
          alignItems: "center",
          // 核心调整：确保行间距足够大，防止重叠
          marginBottom: spacing * -0.5,
        },
        filterGroupLabel: {
          fontSize: 15,
          color: Colors.dark.icon,
          fontWeight: "600",
          minWidth: spacing * 2.5,
          lineHeight: 15,
          paddingBottom: spacing
        },
//         filterOptionsList: {
//           flex: 1,
//           flexGrow: 1,
//         },

        filterOptionsRow: {
          flexDirection: "row",
          alignItems: "center",
          flexWrap: "nowrap",
          paddingRight: spacing / 2,
          paddingLeft: spacing / 2,
        },

        filterOptionButton: {
          marginRight: spacing / 2.5,
          minWidth: spacing ,
          paddingVertical: 1,
          minHeight: 1,
          marginBottom: spacing,
        },

        filterOptionText: {
          fontSize: 10,
          color: Colors.dark.text,
          fontWeight: "500",
          lineHeight: 11
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

  const handleTagSelect = useCallback(
    (tag: string) => {
      if (!activeCategory || activeCategory.title !== selectedCategory?.title) {
        return;
      }

      const categoryWithTag = { ...activeCategory, tag };
      selectCategory(categoryWithTag);
    },
    [activeCategory, selectCategory, selectedCategory?.title]
  );

  const handleFilterSelect = useCallback(
    (groupKey: DoubanFilterKey, value: string) => {
      if (!activeCategory || !activeCategory.filterConfig) {
        return;
      }

      if (selectedCategory?.title !== activeCategory.title) {
        return;
      }

      if (activeCategory.activeFilters?.[groupKey] === value) {
        return;
      }

      updateFilterOption(activeCategory.title, groupKey, value);
    },
    [activeCategory, selectedCategory?.title, updateFilterOption]
  );

  const handleLoadMore = useCallback(() => {
    if (!isActiveCategory) {
      return;
    }

    loadMoreData();
  }, [isActiveCategory, loadMoreData]);

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

  const shouldShowApiConfig =
    isActiveCategory && apiConfigStatus.needsConfiguration && activeCategory && !activeCategory.tags;

  const renderFilters = () => {
    if (!isActiveCategory || !activeCategory?.filterConfig) {
      return null;
    }

    return (
      <View style={dynamicStyles.filterContainer}>
        {activeCategory.filterConfig.groups.map((group, groupIndex) => {
          const activeValue = activeCategory.activeFilters?.[group.key] ?? group.defaultValue;

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
    );
  };

  const renderTags = () => {
    if (!isActiveCategory || !activeCategory?.tags) {
      return null;
    }

    return (
      <View style={dynamicStyles.categoryContainer}>
        <FlatList
          horizontal
          data={activeCategory.tags}
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
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={dynamicStyles.categoryListContent}
        />
      </View>
    );
  };

  const renderContent = () => {
    if (!categoryTitle) {
      return (
        <View style={commonStyles.center}>
          <ThemedText type="subtitle">未指定分类</ThemedText>
        </View>
      );
    }

    if (!activeCategory) {
      return (
        <View style={commonStyles.center}>
          <ThemedText type="subtitle">未找到对应的分类</ThemedText>
        </View>
      );
    }

    if (!isActiveCategory) {
      return (
        <View style={commonStyles.center}>
          <ActivityIndicator size="large" />
        </View>
      );
    }

    if (shouldShowApiConfig) {
      return (
        <View style={commonStyles.center}>
          <ThemedText type="subtitle" style={{ padding: spacing, textAlign: "center" }}>
            {getApiConfigErrorMessage(apiConfigStatus)}
          </ThemedText>
        </View>
      );
    }

    if (apiConfigStatus.isValidating) {
      return (
        <View style={commonStyles.center}>
          <ActivityIndicator size="large" />
          <ThemedText type="subtitle" style={{ padding: spacing, textAlign: "center" }}>
            正在验证服务器配置...
          </ThemedText>
        </View>
      );
    }

    if (apiConfigStatus.error && !apiConfigStatus.isValid) {
      return (
        <View style={commonStyles.center}>
          <ThemedText type="subtitle" style={{ padding: spacing, textAlign: "center" }}>
            {apiConfigStatus.error}
          </ThemedText>
        </View>
      );
    }

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

    return (
      <Animated.View style={[dynamicStyles.contentContainer, { opacity: fadeAnim }]}>
        <CustomScrollView
          data={contentData}
          renderItem={renderContentItem}
          loading={loading}
          loadingMore={loadingMore}
          error={error}
          onEndReached={handleLoadMore}
          loadMoreThreshold={LOAD_MORE_THRESHOLD}
          emptyMessage={activeCategory?.tags ? "请选择一个子分类" : "该分类下暂无内容"}
          ListFooterComponent={footerComponent}
        />
      </Animated.View>
    );
  };

  const content = (
    <ThemedView style={[commonStyles.container, dynamicStyles.container]}>
      {deviceType === "mobile" && <StatusBar barStyle="light-content" />}

      {renderFilters()}

      {renderTags()}

      {renderContent()}
    </ThemedView>
  );

  return content;
}
