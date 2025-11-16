import React, { useEffect, useCallback } from "react";
import { StyleSheet, BackHandler } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import { ThemedView } from "@/components/ThemedView";
import PlayerView from "@/components/PlayerView";
import { EpisodeSelectionModal } from "@/components/EpisodeSelectionModal";
import { SourceSelectionModal } from "@/components/SourceSelectionModal";
import { SpeedSelectionModal } from "@/components/SpeedSelectionModal";
import { VideoDetailsView } from "@/components/VideoDetailsView";
import useDetailStore from "@/stores/detailStore";
import usePlayerStore, { selectCurrentEpisode } from "@/stores/playerStore";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useVideoHandlers } from "@/hooks/useVideoHandlers";
import { usePlayerInteractions } from "@/hooks/usePlayerInteractions";
import { usePlayerLifecycle } from "@/hooks/usePlayerLifecycle";
import Logger from "@/utils/Logger";

const logger = Logger.withTag("PlayScreen");

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
});

export default function PlayScreen() {
  const router = useRouter();
  const { deviceType } = useResponsiveLayout();

  const { episodeIndex: episodeIndexStr, position: positionStr, source: sourceStr, id: videoId, title: videoTitle } = useLocalSearchParams<{
    episodeIndex: string; position?: string; source?: string; id?: string; title?: string;
  }>();
  const episodeIndex = parseInt(episodeIndexStr || "0", 10);
  const position = positionStr ? parseInt(positionStr, 10) : undefined;

  // Select state from the store reactively
  const detail = useDetailStore((state) => state.detail);
  const initDetail = useDetailStore((state) => state.init);
  const status = usePlayerStore((state) => state.status);
  const isLoading = usePlayerStore((state) => state.isLoading);
  const isSeeking = usePlayerStore((state) => state.isSeeking);
  const isSeekBuffering = usePlayerStore((state) => state.isSeekBuffering);
  const seekPosition = usePlayerStore((state) => state.seekPosition);
  const showControls = usePlayerStore((state) => state.showControls);
  const showDetails = usePlayerStore((state) => state.showDetails);
  const showRelatedVideos = usePlayerStore((state) => state.showRelatedVideos);
  const initialPosition = usePlayerStore((state) => state.initialPosition);
  const introEndTime = usePlayerStore((state) => state.introEndTime);
  const playbackRate = usePlayerStore((state) => state.playbackRate);
  const error = usePlayerStore((state) => state.error);
  const currentEpisode = usePlayerStore(selectCurrentEpisode);

  // Get non-reactive actions from the store
  const { loadVideo, reset, setVideoPlayer, handlePlaybackStatusUpdate, setShowControls, setShowDetails, setShowRelatedVideos, setError, _savePlayRecord } = usePlayerStore.getState();

  // Create the player instance
  const { player, videoViewProps } = useVideoHandlers({
    currentEpisode,
    initialPosition,
    introEndTime,
    playbackRate,
    handlePlaybackStatusUpdate,
    deviceType,
  });

  useKeepAwake(status?.isPlaying ? "video" : undefined);

  const { onScreenPress } = usePlayerInteractions(deviceType);

  const flushPlaybackRecord = useCallback(() => {
    const playbackStatus = usePlayerStore.getState().status;
    if (playbackStatus?.isLoaded && playbackStatus.positionMillis > 0) {
      _savePlayRecord({}, { immediate: true });
    }
  }, [_savePlayRecord]);

  usePlayerLifecycle({
    player,
    showControls,
    flushPlaybackRecord,
    setShowControls,
  });

  // Effect to handle hardware back press for the details view
  useEffect(() => {
    const backAction = () => {
      if (showRelatedVideos) {
        setShowRelatedVideos(false);
        router.back();
        return true;
      }
      if (showDetails) {
        setShowDetails(false);
        return true; // Prevent default behavior (e.g., exiting the screen)
      }
      return false; // Allow default behavior
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );

    return () => backHandler.remove();
  }, [showDetails, setShowDetails, showRelatedVideos, setShowRelatedVideos, router]);

  useEffect(() => {
    const source = sourceStr;
    const id = videoId;
    const title = videoTitle;

    if (source && id && title) {
      initDetail(title, source, id);
    } else {
      setError("视频加载失败: 缺少必要信息。");
    }
  }, [sourceStr, videoId, videoTitle, initDetail, setError]);

  useEffect(() => {
    if (detail && detail.id.toString() === videoId) {
      loadVideo({ detail, episodeIndex, position, router });
    }
  }, [detail, videoId, episodeIndex, position, router, loadVideo]);

  useEffect(() => {
    return () => {
      flushPlaybackRecord();
      reset();
    };
  }, [flushPlaybackRecord, reset]);

  useEffect(() => {
    setVideoPlayer(player);
    return () => {
      setVideoPlayer(null);
    };
  }, [player, setVideoPlayer]);

  // Effect for handling seeking logic
  useEffect(() => {
    if (isSeekBuffering && player) {
      const status = usePlayerStore.getState().status;
      if (status && status.durationMillis) {
        const newPositionMillis = seekPosition * status.durationMillis;
        try {
          player.currentTime = newPositionMillis / 1000;
        } catch (e) {
          logger.error("Failed to set currentTime on video player:", e);
        }
      }
    }
  }, [isSeekBuffering, player, seekPosition]);

  return (
    <ThemedView focusable style={styles.container}>
      <PlayerView
        deviceType={deviceType}
        detail={detail}
        error={error}
        status={status}
        isLoading={isLoading || !detail}
        isSeeking={isSeeking}
        isSeekBuffering={isSeekBuffering}
        currentEpisode={currentEpisode}
        player={player}
        videoViewProps={videoViewProps}
        showControls={showControls && !showDetails && !showRelatedVideos}
        onScreenPress={onScreenPress}
        setShowControls={setShowControls}
      />
      <VideoDetailsView showDetails={showDetails} />
      <EpisodeSelectionModal />
      <SourceSelectionModal />
      <SpeedSelectionModal />
    </ThemedView>
  );
}
