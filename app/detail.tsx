import React, { useEffect, useState, useCallback, useMemo } from "react";
import { View, BackHandler, useColorScheme } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import VideoLoadingAnimation from "@/components/VideoLoadingAnimation";
import useDetailStore from "@/stores/detailStore";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { getCommonResponsiveStyles } from "@/utils/ResponsiveStyles";
import ResponsiveNavigation from "@/components/navigation/ResponsiveNavigation";
import ResponsiveHeader from "@/components/navigation/ResponsiveHeader";
import { PlayRecordManager } from "@/services/storage";
import { Colors } from "@/constants/Colors";
import { createResponsiveStyles } from '@/components/detail/detail.styles';
import { DetailMobileView } from '@/components/detail/DetailMobileView';
import { DetailTVView } from '@/components/detail/DetailTVView';
import { useShallow } from 'zustand/react/shallow';

type ResumeInfo = {
  hasRecord: boolean;
  episodeIndex: number;
  position?: number;
};

export default function DetailScreen() {
  const { q, source, id } = useLocalSearchParams<{ q: string; source?: string; id?: string }>();
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
    } catch {
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
    return <VideoLoadingAnimation showProgressBar={false} />;
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
    <ThemedView style={[commonStyles.container, { paddingTop: isTvExperience ? 40 : 0 }]}>
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
