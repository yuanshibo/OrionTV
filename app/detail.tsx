import React, { useEffect, useState, useCallback, useMemo } from "react";
import { View, Image, ScrollView, BackHandler, useColorScheme } from "react-native";
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
import { Colors } from "@/constants/Colors";
import RelatedSeries from "@/components/RelatedSeries";
import { SourceList } from '@/components/detail/SourceList';
import { EpisodeList } from '@/components/detail/EpisodeList';
import { createResponsiveStyles } from '@/components/detail/detail.styles';

type ResumeInfo = {
  hasRecord: boolean;
  episodeIndex: number;
  position?: number;
};


import { SearchResultWithResolution } from "@/services/api";

export default function DetailScreen() {
  const { q, source, id, poster, year, sourceName, desc } = useLocalSearchParams<{
    q: string;
    source?: string;
    id?: string;
    poster?: string;
    year?: string;
    sourceName?: string;
    desc?: string;
  }>();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'dark';
  const colors = Colors[colorScheme];

  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType, spacing } = responsiveConfig;
  const isTvExperience = deviceType === "tv";

  const dynamicStyles = useMemo(() => createResponsiveStyles(deviceType, spacing, colors), [deviceType, spacing, colors]);

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

  // Construct optimistic detail from params
  const optimisticDetail = useMemo<SearchResultWithResolution | null>(() => {
    if (!id || !poster || !q) return null;
    return {
      id: parseInt(id), // search result uses number id usually, but API defines string?
                        // Wait, SearchResult id is number. VideoDetail id is string?
                        // Let's check usage. detail.id usage.
                        // In store: detail is SearchResultWithResolution.
                        // SearchResult id is number.
                        // In VideoCard, id is string.
                        // We might need to parse int if possible, or handle type mismatch.
                        // Most SearchResult ids are from API, usually numbers.
                        // But some might be string hashes.
      // Let's assume it's parsable or handle it.
      // If parsing fails, use 0 or handle mismatch.
      title: q,
      poster: poster,
      year: year || '',
      source: source || '',
      source_name: sourceName || '',
      desc: desc || '',
      episodes: [], // Empty initially
      resolution: null,
    } as unknown as SearchResultWithResolution; // Cast to satisfy type if needed
  }, [id, poster, q, year, source, sourceName, desc]);

  // Use store detail if available, otherwise optimistic
  const computedDetail = detail || optimisticDetail;

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
  }, [init, q, source, id, abort]);

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
    if (!computedDetail) {
      return { hasRecord: false, episodeIndex: 0, position: undefined };
    }

    try {
      const record = await PlayRecordManager.get(computedDetail.source, computedDetail.id.toString());
      const totalEpisodes = computedDetail.episodes?.length ?? 0;

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
    } catch {
      // Ignore errors and fall back to default resume info
    }

    return { hasRecord: false, episodeIndex: 0, position: undefined };
  }, [computedDetail]);

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
    if (!computedDetail) return;
    abort();
    const params: Record<string, string> = {
      q: computedDetail.title,
      source: computedDetail.source,
      id: computedDetail.id.toString(),
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
    if (!computedDetail || !computedDetail.episodes || computedDetail.episodes.length === 0) {
      return;
    }

    const targetEpisodeIndex = resumeInfo.hasRecord ? resumeInfo.episodeIndex : 0;
    const resumePosition = resumeInfo.hasRecord ? resumeInfo.position : undefined;

    handlePlay(targetEpisodeIndex, resumePosition);
  };

  if (loading && !computedDetail) {
    return <VideoLoadingAnimation showProgressBar={false} />;
  }

  if (error && !computedDetail) {
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

  if (!computedDetail) {
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

  const totalEpisodes = computedDetail.episodes?.length ?? 0;
  const isPlayDisabled = totalEpisodes === 0;
  const playButtonLabel = loading && isPlayDisabled
    ? "正在加载..."
    : (resumeInfo.hasRecord ? `继续播放 · 第${resumeInfo.episodeIndex + 1}集` : "立即播放 · 第1集") + `/全${totalEpisodes}集`;


  const renderDetailContent = () => {
    if (deviceType === 'mobile') {
      return (
        <ScrollView
          style={dynamicStyles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={dynamicStyles.mobileTopContainer}>
            <Image source={{ uri: computedDetail.poster }} style={dynamicStyles.mobilePoster} />
            <View style={dynamicStyles.mobileInfoContainer}>
              <View style={dynamicStyles.titleContainer}>
                <ThemedText style={dynamicStyles.title} numberOfLines={2}>
                  {computedDetail.title}
                </ThemedText>
                <StyledButton onPress={toggleFavorite} variant="ghost" style={dynamicStyles.favoriteButton}>
                  <FontAwesome
                    name={isFavorited ? "heart" : "heart-o"}
                    size={20}
                    color={isFavorited ? colors.tint : colors.icon}
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
                <ThemedText style={dynamicStyles.metaText}>{computedDetail.year}</ThemedText>
                <ThemedText style={dynamicStyles.metaText}>{computedDetail.type_name}</ThemedText>
              </View>
            </View>
          </View>

          <View style={dynamicStyles.descriptionContainer}>
            <ThemedText style={dynamicStyles.description}>{computedDetail.desc}</ThemedText>
          </View>

          <SourceList
            searchResults={searchResults}
            currentSource={computedDetail.source}
            onSelect={setDetail}
            loading={!allSourcesLoaded}
            deviceType={deviceType}
            styles={dynamicStyles}
            colors={colors}
          />

          <EpisodeList
            episodes={computedDetail.episodes}
            onPlay={handlePlay}
            styles={dynamicStyles}
          />
          <RelatedSeries title={computedDetail.title} />
        </ScrollView>
      );
    } else {
      return (
        <ScrollView
          style={dynamicStyles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={dynamicStyles.topContainer}>
            <Image source={{ uri: computedDetail.poster }} style={dynamicStyles.poster} />
            <View style={dynamicStyles.infoContainer}>
              <View style={dynamicStyles.titleContainer}>
                <ThemedText style={dynamicStyles.title} numberOfLines={1} ellipsizeMode="tail">
                  {computedDetail.title}
                </ThemedText>
                <StyledButton onPress={toggleFavorite} variant="ghost" style={dynamicStyles.favoriteButton}>
                  <FontAwesome
                    name={isFavorited ? "heart" : "heart-o"}
                    size={24}
                    color={isFavorited ? colors.tint : colors.icon}
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
                <ThemedText style={dynamicStyles.metaText}>{computedDetail.year}</ThemedText>
                <ThemedText style={dynamicStyles.metaText}>{computedDetail.type_name}</ThemedText>
              </View>

              <ScrollView
                style={dynamicStyles.descriptionScrollView}
                showsVerticalScrollIndicator={false}
              >
                <ThemedText style={dynamicStyles.description}>{computedDetail.desc}</ThemedText>
              </ScrollView>
            </View>
          </View>

          <View style={dynamicStyles.bottomContainer}>
            <SourceList
              searchResults={searchResults}
              currentSource={computedDetail.source}
              onSelect={setDetail}
              loading={!allSourcesLoaded}
              deviceType={deviceType}
              styles={dynamicStyles}
              colors={colors}
            />
            <EpisodeList
              episodes={computedDetail.episodes}
              onPlay={handlePlay}
              styles={dynamicStyles}
            />
            <RelatedSeries title={computedDetail.title} />
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

  if (isTvExperience) {
    return content;
  }

  return (
    <ResponsiveNavigation>
      <ResponsiveHeader title={computedDetail?.title || "详情"} showBackButton showBottomBorder={false} />
      {content}
    </ResponsiveNavigation>
  );
}
