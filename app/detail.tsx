import React, { useEffect, useMemo, useCallback } from "react";
import { BackHandler, useColorScheme } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import VideoLoadingAnimation from "@/components/VideoLoadingAnimation";
import useDetailStore from "@/stores/detailStore";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { getCommonResponsiveStyles } from "@/utils/ResponsiveStyles";
import ResponsiveNavigation from "@/components/navigation/ResponsiveNavigation";
import ResponsiveHeader from "@/components/navigation/ResponsiveHeader";
import { Colors } from "@/constants/Colors";
import { createResponsiveStyles } from '@/components/detail/detail.styles';
import { DetailMobileView } from '@/components/detail/DetailMobileView';
import { DetailTVView } from '@/components/detail/DetailTVView';
import { DetailTVSkeleton } from '@/components/detail/DetailTVSkeleton';
import { useShallow } from 'zustand/react/shallow';
import { useResumeProgress } from "@/hooks/useResumeProgress";
import { Image } from "expo-image";
import { useFocusStore } from "@/stores/focusStore";
import { FocusPriority } from "@/types/focus";

export default function DetailScreen() {
  const { q, source, id, poster } = useLocalSearchParams<{ q: string; source?: string; id?: string; poster?: string }>();
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
  } = useDetailStore(useShallow((state) => ({
    detail: state.detail,
    searchResults: state.searchResults,
    loading: state.loading,
    error: state.error,
    allSourcesLoaded: state.allSourcesLoaded,
    init: state.init,
    setDetail: state.setDetail,
    abort: state.abort,
    isFavorited: state.isFavorited,
    toggleFavorite: state.toggleFavorite,
  })));

  // Use the extracted hook for resume logic
  const { resumeInfo, refresh } = useResumeProgress(detail);
  const setFocusArea = useFocusStore((state) => state.setFocusArea);

  // Set focus area when detail page is active
  useFocusEffect(
    useCallback(() => {
      setFocusArea('content', FocusPriority.CONTENT);
    }, [setFocusArea])
  );

  useEffect(() => {
    if (q) {
      init(q, source, id);
    }
    return () => {
      abort();
    };
  }, [init, q, source, id, abort]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
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
    abort();
    const params: Record<string, string> = {
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
    if (isTvExperience) {
      return <DetailTVSkeleton />;
    }

    // Skeleton Screen for Mobile
    return (
      <ResponsiveNavigation>
        <ResponsiveHeader title={q || "详情"} showBackButton showBottomBorder={false} />
        <ThemedView style={[commonStyles.container, { padding: spacing }]}>
          <ThemedView style={{ flexDirection: 'row', marginBottom: spacing }}>
            {poster ? (
              <Image
                source={{ uri: poster }}
                style={{ width: 100, height: 150, borderRadius: 8, backgroundColor: colors.border }}
                contentFit="cover"
              />
            ) : (
              <ThemedView style={{ width: 100, height: 150, borderRadius: 8, backgroundColor: colors.border }} />
            )}
            <ThemedView style={{ flex: 1, marginLeft: spacing, justifyContent: 'center' }}>
              <ThemedText type="subtitle" numberOfLines={2} style={{ marginBottom: 8 }}>{q}</ThemedText>
              <ThemedView style={{ width: '60%', height: 14, backgroundColor: colors.border, borderRadius: 4, marginBottom: 6 }} />
              <ThemedView style={{ width: '40%', height: 14, backgroundColor: colors.border, borderRadius: 4 }} />
            </ThemedView>
          </ThemedView>

          {/* Action Buttons Skeleton */}
          <ThemedView style={{ flexDirection: 'row', marginBottom: spacing }}>
            <ThemedView style={{ flex: 1, height: 40, backgroundColor: colors.border, borderRadius: 8, marginRight: spacing / 2 }} />
            <ThemedView style={{ flex: 1, height: 40, backgroundColor: colors.border, borderRadius: 8, marginLeft: spacing / 2 }} />
          </ThemedView>

          {/* Episodes Skeleton */}
          <ThemedView style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing / 2 }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <ThemedView key={i} style={{ width: '18%', aspectRatio: 1, backgroundColor: colors.border, borderRadius: 4 }} />
            ))}
          </ThemedView>

          <ThemedView style={{ marginTop: spacing * 2, alignItems: 'center' }}>
            <ThemedText style={{ color: colors.icon }}>正在加载资源...</ThemedText>
          </ThemedView>
        </ThemedView>
      </ResponsiveNavigation>
    );
  }

  if (error && !detail) {
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

  const totalEpisodes = detail.episodes?.length ?? 0;
  const isPlayDisabled = totalEpisodes === 0;
  const playButtonLabel = (resumeInfo.hasRecord ? `继续播放 · 第${resumeInfo.episodeIndex + 1}集` : "立即播放 · 第1集") + `/全${totalEpisodes}集`;

  const renderDetailContent = () => {
    const props = {
      detail,
      searchResults,
      allSourcesLoaded,
      isFavorited,
      toggleFavorite,
      handlePrimaryPlay,
      handlePlay,
      playButtonLabel,
      isPlayDisabled,
      setDetail,
      dynamicStyles,
      colors,
      deviceType
    };

    if (deviceType === 'mobile') {
      return <DetailMobileView {...props} />;
    } else {
      return <DetailTVView {...props} />;
    }
  };

  const content = (
    <ThemedView style={[commonStyles.container, isTvExperience && { padding: 0, paddingHorizontal: 0, paddingVertical: 0, margin: 0 }]}>
      {renderDetailContent()}
    </ThemedView>
  );

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
