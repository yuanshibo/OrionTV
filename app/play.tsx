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
import VideoLoadingAnimation from "@/components/VideoLoadingAnimation";
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
  const isSeeking = usePlayerStore((state) => state.isSeeking);
  const isSeekBuffering = usePlayerStore((state) => state.isSeekBuffering);
  const seekPosition = usePlayerStore((state) => state.seekPosition);
  const showControls = usePlayerStore((state) => state.showControls);
  const showDetails = usePlayerStore((state) => state.showDetails);
  const initialPosition = usePlayerStore((state) => state.initialPosition);
  const introEndTime = usePlayerStore((state) => state.introEndTime);
  const playbackRate = usePlayerStore((state) => state.playbackRate);
  const error = usePlayerStore((state) => state.error);
  const currentEpisode = usePlayerStore(selectCurrentEpisode);

  // Get non-reactive actions from the store
  const { loadVideo, reset, setVideoPlayer, handlePlaybackStatusUpdate, setShowControls, setShowDetails, setError, _savePlayRecord } = usePlayerStore.getState();

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
  }, [showDetails, setShowDetails]);


  // --- REFACTORED --- Effect to load video details.
  // This effect runs when URL params change, and it's responsible for fetching the video details.
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

  // --- REFACTORED --- Effect to load the player.
  // This effect runs ONLY when the `detail` object is successfully loaded or changed.
  // It decouples the player loading from the detail fetching, breaking the infinite loop.
  useEffect(() => {
    if (detail) {
      loadVideo({ detail, episodeIndex, position, router });
    }
  }, [detail, episodeIndex, position, router, loadVideo]);

  // Effect to clean up state ONLY when the component unmounts.
  useEffect(() => {
    return () => {
      flushPlaybackRecord();
      reset();
    };
  }, [flushPlaybackRecord, reset]);

  // Effect to sync the player instance from the hook to the store.
  useEffect(() => {
    setVideoPlayer(player);
    return () => {
      setVideoPlayer(null);
    };
  }, [player, setVideoPlayer]);

  // --- REVISED --- Effect for handling seeking logic to prevent stuttering.
  // It no longer depends on the frequently updating 'status' object.
  // Instead, it runs only when a seek is initiated and gets the latest status from the store.
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

  if (!detail && !error) {
    return <VideoLoadingAnimation showProgressBar />;
  }

  return (
    <ThemedView focusable style={styles.container}>
      <PlayerView
        deviceType={deviceType}
        detail={detail}
        error={error}
        status={status}
        isSeeking={isSeeking}
        isSeekBuffering={isSeekBuffering}
        currentEpisode={currentEpisode}
        player={player} // Pass the correct player instance
        videoViewProps={videoViewProps}
        showControls={showControls && !showDetails} // Hide controls when details are visible
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
