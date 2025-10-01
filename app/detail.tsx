import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, Image, ScrollView, ActivityIndicator, BackHandler } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
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

type ResumeInfo = {
  hasRecord: boolean;
  episodeIndex: number;
  position?: number;
};


export default function DetailScreen() {
  const { q, source, id } = useLocalSearchParams<{ q: string; source?: string; id?: string }>();
  const router = useRouter();

  // 响应式布局配置
  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType, spacing } = responsiveConfig;
  const isTvExperience = deviceType === "tv";

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

  const [resumeInfo, setResumeInfo] = useState<ResumeInfo>(() => ({
    hasRecord: false,
    episodeIndex: 0,
    position: undefined,
  }));

  useEffect(() => {
    if (q) {
      init(q, source, id);
    }
    return () => {
      abort();
    };
  }, [init, q, source, id]);

  const applyResumeInfo = useCallback((next: ResumeInfo) => {
    setResumeInfo((prev) => {
      if (
        prev.hasRecord === next.hasRecord &&
        prev.episodeIndex === next.episodeIndex &&
        prev.position === next.position
      ) {
        return prev;
      }

      return next;
    });
  }, []);

  const loadResumeInfo = useCallback(async (): Promise<ResumeInfo> => {
    if (!detail) {
      return { hasRecord: false, episodeIndex: 0, position: undefined };
    }

    try {
      const record = await PlayRecordManager.get(detail.source, detail.id.toString());
      const totalEpisodes = detail.episodes?.length ?? 0;

      if (record && totalEpisodes > 0) {
        const rawIndex = typeof record.index === "number" ? record.index - 1 : 0;
        const clampedIndex = Math.min(Math.max(rawIndex, 0), totalEpisodes - 1);
        const resumePosition =
          record.play_time && record.play_time > 0
            ? Math.max(0, Math.floor(record.play_time * 1000))
            : undefined;

        return {
          hasRecord: true,
          episodeIndex: clampedIndex,
          position: resumePosition,
        };
      }
    } catch (error) {
      // Ignore errors and fall back to default resume info
    }

    return { hasRecord: false, episodeIndex: 0, position: undefined };
  }, [detail]);

  useEffect(() => {
    let isActive = true;

    loadResumeInfo().then((info) => {
      if (isActive) {
        applyResumeInfo(info);
      }
    });

    return () => {
      isActive = false;
    };
  }, [loadResumeInfo, applyResumeInfo]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      loadResumeInfo().then((info) => {
        if (isActive) {
          applyResumeInfo(info);
        }
      });

      return () => {
        isActive = false;
      };
    }, [loadResumeInfo, applyResumeInfo])
  );

  useFocusEffect(
    useCallback(() => {
      if (!isTvExperience) {
        return;
      }
      const handler = BackHandler.addEventListener("hardwareBackPress", () => {
        const canGoBack = router.canGoBack();

        if (canGoBack) {
          router.back();
          return true;
        }
        return false;
      });

      return () => {
        handler.remove();
      };
    }, [isTvExperience, router])
  );

  const handlePlay = (episodeIndex: number, position?: number) => {
    if (!detail) return;
    abort(); // Cancel any ongoing fetches
    const params: Record<string, string> = {
      // Pass necessary identifiers, the rest will be in the store
      q: detail.title,
      source: detail.source,
      id: detail.id.toString(),
      episodeIndex: episodeIndex.toString(),
    };

    if (typeof position === "number" && position > 0) {
      params.position = Math.floor(position).toString();
    }

    router.push({
      pathname: "/play",
      params,
    });
  };

  const handlePrimaryPlay = () => {
    if (!detail || !detail.episodes || detail.episodes.length === 0) {
      return;
    }

    const targetEpisodeIndex = resumeInfo.hasRecord ? resumeInfo.episodeIndex : 0;
    const resumePosition = resumeInfo.hasRecord ? resumeInfo.position : undefined;

    handlePlay(targetEpisodeIndex, resumePosition);
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

    if (isTvExperience) {
      return content;
    }

    return (
      <ResponsiveNavigation>
        <ResponsiveHeader title="详情" showBackButton showBottomBorder={false} />
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

    if (isTvExperience) {
      return content;
    }

    return (
      <ResponsiveNavigation>
        <ResponsiveHeader title="详情" showBackButton showBottomBorder={false} />
        {content}
      </ResponsiveNavigation>
    );
  }

  // 动态样式
  const dynamicStyles = createResponsiveStyles(deviceType, spacing);
  const totalEpisodes = detail.episodes?.length ?? 0;
  const isPlayDisabled = totalEpisodes === 0;
  const playButtonLabel = (resumeInfo.hasRecord ? `继续播放 · 第${resumeInfo.episodeIndex + 1}集` : "立即播放 · 第1集") + `/全${totalEpisodes}集`;


  const renderDetailContent = () => {
    if (deviceType === 'mobile') {
      // 移动端垂直布局
      return (
        <ScrollView
          style={dynamicStyles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
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
              <StyledButton
                onPress={handlePrimaryPlay}
                style={dynamicStyles.playButton}
                text={playButtonLabel}
                textStyle={dynamicStyles.playButtonText}
                disabled={isPlayDisabled}
              />
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
                />
              ))}
            </View>
          </View>
        </ScrollView>
      );
    } else {
      // 平板和TV端水平布局
      return (
        <ScrollView
          style={dynamicStyles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
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
               <StyledButton
                 onPress={handlePrimaryPlay}
                 style={dynamicStyles.playButton}
                 text={playButtonLabel}
                 textStyle={dynamicStyles.playButtonText}
                 disabled={isPlayDisabled}
                 hasTVPreferredFocus={isTvExperience}
               />
              <View style={dynamicStyles.metaContainer}>
                <ThemedText style={dynamicStyles.metaText}>{detail.year}</ThemedText>
                <ThemedText style={dynamicStyles.metaText}>{detail.type_name}</ThemedText>
              </View>

              <ScrollView
                style={dynamicStyles.descriptionScrollView}
                showsVerticalScrollIndicator={false}
              >
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
              <ScrollView
                horizontal
                style={dynamicStyles.sourceList}
                showsHorizontalScrollIndicator={false}
              >
                {searchResults.map((item, index) => {
                  const isSelected = detail?.source === item.source;
                  const episodesDisplay = item.episodes.length > 99 ? "99+集" : `${item.episodes.length}集`;
                  const metaLine = item.resolution ? `${episodesDisplay} · ${item.resolution}` : episodesDisplay;
                  return (
                    <StyledButton
                      key={index}
                       onPress={() => setDetail(item)}
                       hasTVPreferredFocus={!isTvExperience && index === 0}
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
    <ThemedView style={[commonStyles.container, { paddingTop: isTvExperience ? 40 : 0 }]}>
      {renderDetailContent()}
    </ThemedView>
  );

  // 根据设备类型决定是否包装在响应式导航中
  if (isTvExperience) {
    return content;
  }

  return (
    <ResponsiveNavigation>
      <ResponsiveHeader title={detail?.title || "详情"} showBackButton showBottomBorder={false} />
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
      height: 45,
    },
    favoriteButton: {
      padding: 10,
      marginLeft: 10,
      backgroundColor: "transparent",
    },
    playButton: {
      marginTop: spacing / 6,
      alignSelf: isMobile ? "stretch" : "flex-start",
      minWidth: isTV ? 130 : isTablet ? 140 : 140,
    },
    playButtonText: {
      fontSize: isMobile ? 14 : isTablet ? 15 : 15,
      fontWeight: "600",
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
    sourceButtonContent: {
      flexDirection: "column",
      alignItems: "stretch",
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

