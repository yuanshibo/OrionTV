import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Image, ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { StyledButton } from "@/components/StyledButton";
import VideoLoadingAnimation from "@/components/VideoLoadingAnimation";
import useDetailStore from "@/stores/detailStore";
import { FontAwesome } from "@expo/vector-icons";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { getCommonResponsiveStyles } from "@/utils/ResponsiveStyles";
import ResponsiveNavigation from "@/components/navigation/ResponsiveNavigation";
import ResponsiveHeader from "@/components/navigation/ResponsiveHeader";
import { PlayRecordManager } from "@/services/storage";
import Logger from "@/utils/Logger";

const logger = Logger.withTag("DetailScreen");

export default function DetailScreen() {
  const { q, source, id } = useLocalSearchParams<{ q: string; source?: string; id?: string }>();
  const router = useRouter();

  // 响应式布局配置
  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType, spacing } = responsiveConfig;

  const {
    detail,
    searchResults,
    loading,
    error,
    allSourcesLoaded,
    init,
    setDetail,
    abort,
    isFavorited,
    toggleFavorite,
  } = useDetailStore();

  const [recordInfo, setRecordInfo] = useState<{ source: string; id: string; episodeIndex: number } | null>(null);
  const [recentEpisodeIndex, setRecentEpisodeIndex] = useState<number | null>(null);
  const [recordLookupComplete, setRecordLookupComplete] = useState(false);

  useEffect(() => {
    if (q) {
      init(q, source, id);
    }
    return () => {
      abort();
    };
  }, [abort, init, q, source, id]);

  useEffect(() => {
    setRecordInfo(null);
    setRecentEpisodeIndex(null);
    setRecordLookupComplete(false);
  }, [detail?.title]);

  useEffect(() => {
    if (!detail?.title) {
      return;
    }

    let isCancelled = false;
    const normalizeTitle = (value: string) => value.trim().replace(/\s+/g, " ");

    const fetchRecord = async () => {
      try {
        const records = await PlayRecordManager.getAllLatestByTitle();
        const normalizedDetailTitle = normalizeTitle(detail.title);
        const matchedEntry = Object.entries(records).find(([, record]) =>
          record.title ? normalizeTitle(record.title) === normalizedDetailTitle : false
        );

        if (!matchedEntry) {
          if (!isCancelled) {
            setRecordLookupComplete(true);
          }
          return;
        }

        const [key, record] = matchedEntry;
        const separatorIndex = key.indexOf("+");
        if (separatorIndex === -1) {
          if (!isCancelled) {
            setRecordLookupComplete(true);
          }
          return;
        }

        const recordSource = key.slice(0, separatorIndex);
        const recordId = key.slice(separatorIndex + 1);
        if (!recordSource || !recordId) {
          if (!isCancelled) {
            setRecordLookupComplete(true);
          }
          return;
        }

        const targetEpisodeIndex = Math.max(0, (record.index ?? 1) - 1);

        if (!isCancelled) {
          setRecordInfo({
            source: recordSource,
            id: recordId,
            episodeIndex: targetEpisodeIndex,
          });
          setRecordLookupComplete(true);
        }
      } catch (error) {
        logger.debug("Failed to load play record for detail page", error);
        if (!isCancelled) {
          setRecordLookupComplete(true);
        }
      }
    };

    fetchRecord();

    return () => {
      isCancelled = true;
    };
  }, [detail?.title]);

  useEffect(() => {
    if (!recordInfo || recentEpisodeIndex !== null) {
      return;
    }

    let isCancelled = false;

    const matchedSource = searchResults.find(
      (item) => item.source === recordInfo.source && item.id.toString() === recordInfo.id
    );

    if (!matchedSource || !matchedSource.episodes || matchedSource.episodes.length === 0) {
      return;
    }

    const applyRecordSelection = async () => {
      try {
        const episodesCount = matchedSource.episodes.length;
        const clampedEpisodeIndex = Math.min(
          Math.max(recordInfo.episodeIndex, 0),
          Math.max(episodesCount - 1, 0)
        );

        const currentDetailId = detail?.id != null ? detail.id.toString() : undefined;
        if (
          !detail ||
          detail.source !== matchedSource.source ||
          currentDetailId !== recordInfo.id
        ) {
          await setDetail(matchedSource);
        }

        if (!isCancelled) {
          setRecentEpisodeIndex(clampedEpisodeIndex);
        }
      } catch (error) {
        logger.debug("Failed to apply play record selection", error);
      }
    };

    applyRecordSelection();

    return () => {
      isCancelled = true;
    };
  }, [detail, recordInfo, recentEpisodeIndex, searchResults, setDetail]);

  const handlePlay = (episodeIndex: number) => {
    if (!detail) return;
    abort(); // Cancel any ongoing fetches
    router.push({
      pathname: "/play",
      params: {
        // Pass necessary identifiers, the rest will be in the store
        q: detail.title,
        source: detail.source,
        id: detail.id.toString(),
        episodeIndex: episodeIndex.toString(),
      },
    });
  };

  if (loading) {
    return <VideoLoadingAnimation showProgressBar={false} />;
  }

  if (error) {
    const content = (
      <ThemedView style={[commonStyles.safeContainer, commonStyles.center]}>
        <ThemedText type="subtitle" style={commonStyles.textMedium}>
          {error}
        </ThemedText>
      </ThemedView>
    );

    if (deviceType === 'tv') {
      return content;
    }

    return (
      <ResponsiveNavigation>
        <ResponsiveHeader title="详情" showBackButton />
        {content}
      </ResponsiveNavigation>
    );
  }

  if (!detail) {
    const content = (
      <ThemedView style={[commonStyles.safeContainer, commonStyles.center]}>
        <ThemedText type="subtitle">未找到详情信息</ThemedText>
      </ThemedView>
    );

    if (deviceType === 'tv') {
      return content;
    }

    return (
      <ResponsiveNavigation>
        <ResponsiveHeader title="详情" showBackButton />
        {content}
      </ResponsiveNavigation>
    );
  }

  // 动态样式
  const dynamicStyles = createResponsiveStyles(deviceType, spacing);
  const isTVDevice = deviceType === 'tv';
  const fallbackEpisodeIndex =
    recordLookupComplete && recordInfo === null && detail.episodes.length > 0 ? 0 : null;
  const tvFocusEpisodeIndex = recentEpisodeIndex ?? fallbackEpisodeIndex;
  const shouldFocusEpisode = isTVDevice && tvFocusEpisodeIndex !== null;
  const shouldHighlightEpisode = recentEpisodeIndex !== null;

  const renderDetailContent = () => {
    if (deviceType === 'mobile') {
      // 移动端垂直布局
      return (
        <ScrollView style={dynamicStyles.scrollContainer}>
          {/* 海报和基本信息 */}
          <View style={dynamicStyles.mobileTopContainer}>
            <Image source={{ uri: detail.poster }} style={dynamicStyles.mobilePoster} />
            <View style={dynamicStyles.mobileInfoContainer}>
              <View style={dynamicStyles.titleContainer}>
                <ThemedText style={dynamicStyles.title} numberOfLines={2}>
                  {detail.title}
                </ThemedText>
                <StyledButton onPress={toggleFavorite} variant="ghost" style={dynamicStyles.favoriteButton}>
                  <FontAwesome
                    name={isFavorited ? "heart" : "heart-o"}
                    size={20}
                    color={isFavorited ? "#feff5f" : "#ccc"}
                  />
                </StyledButton>
              </View>
              <View style={dynamicStyles.metaContainer}>
                <ThemedText style={dynamicStyles.metaText}>{detail.year}</ThemedText>
                <ThemedText style={dynamicStyles.metaText}>{detail.type_name}</ThemedText>
              </View>
            </View>
          </View>

          {/* 描述 */}
          <View style={dynamicStyles.descriptionContainer}>
            <ThemedText style={dynamicStyles.description}>{detail.desc}</ThemedText>
          </View>

          {/* 播放源 */}
          <View style={dynamicStyles.sourcesContainer}>
            <View style={dynamicStyles.sourcesTitleContainer}>
              <ThemedText style={dynamicStyles.sourcesTitle}>播放源 ({searchResults.length})</ThemedText>
              {!allSourcesLoaded && <ActivityIndicator style={{ marginLeft: 10 }} />}
            </View>
            <View style={dynamicStyles.sourceList}>
              {searchResults.map((item, index) => {
                const isSelected = detail?.source === item.source;
                return (
                  <StyledButton
                    key={index}
                    onPress={() => setDetail(item)}
                    isSelected={isSelected}
                    style={dynamicStyles.sourceButton}
                    hasTVPreferredFocus={isTVDevice && index === 0 && !shouldFocusEpisode}
                  >
                    <ThemedText style={dynamicStyles.sourceButtonText}>{item.source_name}</ThemedText>
                    {item.episodes.length > 1 && (
                      <View style={[dynamicStyles.badge, isSelected && dynamicStyles.selectedBadge]}>
                        <Text style={dynamicStyles.badgeText}>
                          {item.episodes.length > 99 ? "99+" : `${item.episodes.length}`} 集
                        </Text>
                      </View>
                    )}
                    {item.resolution && (
                      <View style={[dynamicStyles.badge, { backgroundColor: "#666" }, isSelected && dynamicStyles.selectedBadge]}>
                        <Text style={dynamicStyles.badgeText}>{item.resolution}</Text>
                      </View>
                    )}
                  </StyledButton>
                );
              })}
            </View>
          </View>

          {/* 剧集列表 */}
          <View style={dynamicStyles.episodesContainer}>
            <ThemedText style={dynamicStyles.episodesTitle}>播放列表</ThemedText>
            <View style={dynamicStyles.episodeList}>
              {detail.episodes.map((episode, index) => (
                <StyledButton
                  key={index}
                  style={dynamicStyles.episodeButton}
                  onPress={() => handlePlay(index)}
                  text={`第 ${index + 1} 集`}
                  textStyle={dynamicStyles.episodeButtonText}
                  isSelected={shouldHighlightEpisode && recentEpisodeIndex === index}
                  hasTVPreferredFocus={shouldFocusEpisode && tvFocusEpisodeIndex === index}
                />
              ))}
            </View>
          </View>
        </ScrollView>
      );
    } else {
      // 平板和TV端水平布局
      return (
        <ScrollView style={dynamicStyles.scrollContainer}>
          <View style={dynamicStyles.topContainer}>
            <Image source={{ uri: detail.poster }} style={dynamicStyles.poster} />
            <View style={dynamicStyles.infoContainer}>
              <View style={dynamicStyles.titleContainer}>
                <ThemedText style={dynamicStyles.title} numberOfLines={1} ellipsizeMode="tail">
                  {detail.title}
                </ThemedText>
                <StyledButton onPress={toggleFavorite} variant="ghost" style={dynamicStyles.favoriteButton}>
                  <FontAwesome
                    name={isFavorited ? "heart" : "heart-o"}
                    size={24}
                    color={isFavorited ? "#feff5f" : "#ccc"}
                  />
                </StyledButton>
              </View>
              <View style={dynamicStyles.metaContainer}>
                <ThemedText style={dynamicStyles.metaText}>{detail.year}</ThemedText>
                <ThemedText style={dynamicStyles.metaText}>{detail.type_name}</ThemedText>
              </View>

              <ScrollView style={dynamicStyles.descriptionScrollView}>
                <ThemedText style={dynamicStyles.description}>{detail.desc}</ThemedText>
              </ScrollView>
            </View>
          </View>

          <View style={dynamicStyles.bottomContainer}>
            <View style={dynamicStyles.sourcesContainer}>
              <View style={dynamicStyles.sourcesTitleContainer}>
                <ThemedText style={dynamicStyles.sourcesTitle}>选择播放源 共 {searchResults.length} 个</ThemedText>
                {!allSourcesLoaded && <ActivityIndicator style={{ marginLeft: 10 }} />}
              </View>
              <ScrollView horizontal style={dynamicStyles.sourceList}>
                {searchResults.map((item, index) => {
                  const isSelected = detail?.source === item.source;
                  const episodesDisplay = item.episodes.length > 99 ? "99+集" : `${item.episodes.length}集`;
                  const metaLine = item.resolution ? `${episodesDisplay} · ${item.resolution}` : episodesDisplay;
                  return (
                    <StyledButton
                      key={index}
                      onPress={() => setDetail(item)}
                      hasTVPreferredFocus={isTVDevice && index === 0 && !shouldFocusEpisode}
                      isSelected={isSelected}
                      style={dynamicStyles.sourceButton}
                    >
                      <View style={dynamicStyles.sourceButtonContent}>
                        <ThemedText style={dynamicStyles.sourceNameText} numberOfLines={1}>
                          {item.source_name}
                        </ThemedText>
                        <ThemedText style={dynamicStyles.sourceMetaText} numberOfLines={1}>
                          {metaLine}
                        </ThemedText>
                      </View>
                    </StyledButton>
                  );
                })}
              </ScrollView>
            </View>
            <View style={dynamicStyles.episodesContainer}>
              <ThemedText style={dynamicStyles.episodesTitle}>播放列表</ThemedText>
              <View style={dynamicStyles.episodeList}>
                {detail.episodes.map((episode, index) => (
                  <StyledButton
                    key={index}
                    style={dynamicStyles.episodeButton}
                    onPress={() => handlePlay(index)}
                    text={`第 ${index + 1} 集`}
                    textStyle={dynamicStyles.episodeButtonText}
                    isSelected={shouldHighlightEpisode && recentEpisodeIndex === index}
                    hasTVPreferredFocus={shouldFocusEpisode && tvFocusEpisodeIndex === index}
                  />
                ))}
              </View>
            </View>
          </View>
        </ScrollView>
      );
    }
  };

  const content = (
    <ThemedView style={[commonStyles.container, { paddingTop: deviceType === 'tv' ? 40 : 0 }]}>
      {renderDetailContent()}
    </ThemedView>
  );

  // 根据设备类型决定是否包装在响应式导航中
  if (deviceType === 'tv') {
    return content;
  }

  return (
    <ResponsiveNavigation>
      <ResponsiveHeader title={detail?.title || "详情"} showBackButton />
      {content}
    </ResponsiveNavigation>
  );
}

const createResponsiveStyles = (deviceType: string, spacing: number) => {
  const isTV = deviceType === 'tv';
  const isTablet = deviceType === 'tablet';
  const isMobile = deviceType === 'mobile';

  return StyleSheet.create({
    scrollContainer: {
      flex: 1,
    },
    
    // 移动端专用样式
    mobileTopContainer: {
      paddingHorizontal: spacing,
      paddingTop: spacing,
      paddingBottom: spacing / 2,
    },
    mobilePoster: {
      width: '100%',
      height: 280,
      borderRadius: 8,
      alignSelf: 'center',
      marginBottom: spacing,
    },
    mobileInfoContainer: {
      flex: 1,
    },
    descriptionContainer: {
      paddingHorizontal: spacing,
      paddingBottom: spacing,
    },

    // 平板和TV端样式
    topContainer: {
      flexDirection: "row",
      padding: spacing,
    },
    poster: {
      width: isTV ? 200 : 160,
      height: isTV ? 300 : 240,
      borderRadius: 8,
    },
    infoContainer: {
      flex: 1,
      marginLeft: spacing,
      justifyContent: "flex-start",
    },
    descriptionScrollView: {
      height: 150,
    },

    // 通用样式
    titleContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing / 2,
    },
    title: {
      paddingTop: 16,
      fontSize: isMobile ? 20 : isTablet ? 24 : 28,
      fontWeight: "bold",
      flexShrink: 1,
      color: 'white',
    },
    favoriteButton: {
      padding: 10,
      marginLeft: 10,
      backgroundColor: "transparent",
    },
    metaContainer: {
      flexDirection: "row",
      marginBottom: spacing / 2,
    },
    metaText: {
      color: "#aaa",
      marginRight: spacing / 2,
      fontSize: isMobile ? 12 : 14,
    },
    description: {
      fontSize: isMobile ? 13 : 14,
      color: "#ccc",
      lineHeight: isMobile ? 18 : 22,
    },

    // 播放源和剧集样式
    bottomContainer: {
      paddingHorizontal: spacing,
    },
    sourcesContainer: {
      marginTop: spacing,
    },
    sourcesTitleContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing / 2,
    },
    sourcesTitle: {
      fontSize: isMobile ? 16 : isTablet ? 18 : 20,
      fontWeight: "bold",
      color: 'white',
    },
    sourceList: {
      flexDirection: "row",
      flexWrap: isMobile ? "wrap" : "nowrap",
    },
    sourceButton: {
      margin: isMobile ? 4 : 8,
      minHeight: isMobile ? 36 : 44,
    },
    sourceButtonText: {
      color: "white",
      fontSize: isMobile ? 14 : 16,
    },
    badge: {
      backgroundColor: "#666",
      borderRadius: 10,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginLeft: 8,
    },
    badgeText: {
      color: "#fff",
      fontSize: isMobile ? 10 : 12,
      fontWeight: "bold",
      paddingBottom: 2.5,
    },
    selectedBadge: {
      backgroundColor: "#4c4c4c",
    },
    sourceNameText: {
      color: "white",
      fontSize: isMobile ? 14 : 14,
      fontWeight: "600"
    },
    sourceButtonContent: {
      alignItems: "center",
    },
    sourceMetaText: {
      color: "#ccc",
      fontSize: isMobile ? 10 : 10,
      marginTop: 2,
      textAlign: 'center',
    },

    episodesContainer: {
      marginTop: spacing,
      paddingBottom: spacing * 2,
    },
    episodesTitle: {
      fontSize: isMobile ? 16 : isTablet ? 18 : 20,
      fontWeight: "bold",
      marginBottom: spacing / 2,
      color: 'white',
    },
    episodeList: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    episodeButton: {
      margin: isMobile ? 3 : 5,
      minHeight: isMobile ? 32 : 36,
      width: isMobile ? '23%': isTablet ? '11.5%' : '8.88%',
    },
    episodeButtonText: {
      color: "white",
      fontSize: isMobile ? 12 : 11,
      textAlign: 'center',
    },
  });
};
