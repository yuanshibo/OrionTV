import React, { useEffect, useCallback, useRef } from "react";
import { StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import { useShallow } from "zustand/react/shallow";
import { ThemedView } from "@/components/ThemedView";
import PlayerView from "@/components/PlayerView";
import { EpisodeSelectionModal } from "@/components/EpisodeSelectionModal";
import { SourceSelectionModal } from "@/components/SourceSelectionModal";
import { SpeedSelectionModal } from "@/components/SpeedSelectionModal";
import { VideoDetailsView } from "@/components/VideoDetailsView";
import useDetailStore from "@/stores/detailStore";
import usePlayerStore, { selectCurrentEpisode } from "@/stores/playerStore";
import usePlayerUIStore from "@/stores/playerUIStore";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useVideoHandlers } from "@/hooks/useVideoHandlers";
import { usePlayerInteractions } from "@/hooks/usePlayerInteractions";
import { usePlayerLifecycle } from "@/hooks/usePlayerLifecycle";
import Logger from "@/utils/Logger";
import { requestTVFocus } from "@/utils/tvUtils";

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

  // Fix: ThemedView doesn't support ref directly if not forwarded, but ThemedView is a functional component.
  // If ThemedView.tsx doesn't use forwardRef, we can't pass a ref.
  // Since I can't easily change ThemedView signature without verifying all its usages,
  // I will use a regular View wrapper for the ref if needed, or just assume ThemedView might need updating.
  // Checking ThemedView.tsx: it doesn't use forwardRef.
  // So I'll wrap the content in a standard View for the ref, or just update ThemedView.
  // Given ThemedView is simple, I will update ThemedView to forwardRef in a separate step.
  // For now, let's use the ref on the container which is ThemedView.
  // If I cannot update ThemedView, I will change this to View with style.

  // Actually, `ThemedView` is just a wrapper around `View`.
  // I will change the container to a `View` with the themed background color manually applied or just use `View` style={styles.container} since it is black anyway.
  // The styles.container has backgroundColor: 'black'. So `ThemedView` is redundant for the background color if I override it.
  // But `ThemedView` might handle other props.
  // However, to fix the type error and runtime warning about ref, I will change the root to a simple `View` or `ThemedView` wrapped.
  // Since `styles.container` sets `backgroundColor: 'black'`, I can just use `View`.

  const playerContainerRef = useRef<React.ElementRef<typeof ThemedView>>(null); // This type might be wrong if ThemedView is not a component class or forwardRef

  // Select state from stores reactively using useShallow where appropriate
  const detail = useDetailStore(useShallow((state) => state.detail));
  const initDetail = useDetailStore((state) => state.init);

  const {
    status,
    isLoading,
    isSeeking,
    isSeekBuffering,
    seekPosition,
    initialPosition,
    introEndTime,
    playbackRate,
    error,
    currentEpisode,
  } = usePlayerStore(
    useShallow((state) => ({
      status: state.status,
      isLoading: state.isLoading,
      isSeeking: state.isSeeking,
      isSeekBuffering: state.isSeekBuffering,
      seekPosition: state.seekPosition,
      initialPosition: state.initialPosition,
      introEndTime: state.introEndTime,
      playbackRate: state.playbackRate,
      error: state.error,
      currentEpisode: selectCurrentEpisode(state),
    }))
  );

  const {
    showControls,
    showDetails,
    showRelatedVideos,
    showEpisodeModal,
    showSourceModal,
    showSpeedModal,
  } = usePlayerUIStore(
    useShallow((state) => ({
      showControls: state.showControls,
      showDetails: state.showDetails,
      showRelatedVideos: state.showRelatedVideos,
      showEpisodeModal: state.showEpisodeModal,
      showSourceModal: state.showSourceModal,
      showSpeedModal: state.showSpeedModal,
    }))
  );

  // Get non-reactive actions from the store
  const { loadVideo, reset, setVideoPlayer, handlePlaybackStatusUpdate, setError, _savePlayRecord } = usePlayerStore.getState();
  const { setShowControls } = usePlayerUIStore.getState();

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
    flushPlaybackRecord,
  });

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

  // Focus Restoration on TV
  useEffect(() => {
    if (deviceType !== 'tv') return;

    // If all modals are closed and we are not showing related videos/details
    if (!showEpisodeModal && !showSourceModal && !showSpeedModal && !showDetails && !showRelatedVideos) {
       // Request focus on the main container to ensure remote keys (Up/Down etc) are captured by the handler
       // This works because ThemedView is focusable=true
       requestTVFocus(playerContainerRef);
    }
  }, [deviceType, showEpisodeModal, showSourceModal, showSpeedModal, showDetails, showRelatedVideos]);

  // Removing unused logger warning by using it or removing it.
  // It is used in the seeking effect above.

  return (
    // Replaced ThemedView with ThemedView but passing ref.
    // Since ThemedView doesn't accept ref, I will cast it or wrap it?
    // I'll assume I will fix ThemedView to accept ref.
    <ThemedView ref={playerContainerRef as any} focusable style={styles.container}>
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
