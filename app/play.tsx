import React, { useEffect, useCallback, useRef } from "react";
import { StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import { ThemedView } from "@/components/ThemedView";
import PlayerView from "@/components/PlayerView";
import { EpisodeSelectionModal } from "@/components/EpisodeSelectionModal";
import { SourceSelectionModal } from "@/components/SourceSelectionModal";
import { SpeedSelectionModal } from "@/components/SpeedSelectionModal";
import { RelatedSeriesModal } from "@/components/RelatedSeriesModal";
import useDetailStore from "@/stores/detailStore";
import usePlayerStore, { selectCurrentEpisode } from "@/stores/playerStore";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useVideoHandlers } from "@/hooks/useVideoHandlers";
import { usePlayerInteractions } from "@/hooks/usePlayerInteractions";
import { usePlayerLifecycle } from "@/hooks/usePlayerLifecycle";
import Logger from "@/utils/Logger";
import { useShallow } from "zustand/react/shallow";
import { useFocusStore } from "@/stores/focusStore";
import { FocusPriority } from "@/types/focus";

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

  const { episodeIndex: episodeIndexStr, position: positionStr, source: sourceStr, id: videoId, title: videoTitle, q: queryTitle } = useLocalSearchParams<{
    episodeIndex: string; position?: string; source?: string; id?: string; title?: string; q?: string;
  }>();
  const episodeIndex = parseInt(episodeIndexStr || "0", 10);
  const position = positionStr ? parseInt(positionStr, 10) : undefined;

  // Select state from the store reactively
  const detail = useDetailStore((state) => state.detail);
  const initDetail = useDetailStore((state) => state.init);

  const {
    isLoaded,
    isBuffering,
    isLoading,
    isSeeking,
    isSeekBuffering,
    seekPosition,
    showControls,
    showRelatedVideos,
    initialPosition,
    introEndTime,
    playbackRate,
    error,
    loadVideo,
    reset,
    setVideoPlayer,
    handlePlaybackStatusUpdate,
    setShowControls,
    setShowRelatedVideos,
    setError,
    savePlayRecord,
  } = usePlayerStore(
    useShallow((state) => ({
      isLoaded: state.status?.isLoaded ?? false,
      isBuffering: state.status?.isBuffering ?? false,
      isLoading: state.isLoading,
      isSeeking: state.isSeeking,
      isSeekBuffering: state.isSeekBuffering,
      seekPosition: state.seekPosition,
      showControls: state.showControls,
      showRelatedVideos: state.showRelatedVideos,
      initialPosition: state.initialPosition,
      introEndTime: state.introEndTime,
      playbackRate: state.playbackRate,
      error: state.error,
      loadVideo: state.loadVideo,
      reset: state.reset,
      setVideoPlayer: state.setVideoPlayer,
      handlePlaybackStatusUpdate: state.handlePlaybackStatusUpdate,
      setShowControls: state.setShowControls,
      setShowRelatedVideos: state.setShowRelatedVideos,
      setError: state.setError,
      savePlayRecord: state.savePlayRecord,
    }))
  );
  const currentEpisode = usePlayerStore(selectCurrentEpisode);
  const setFocusArea = useFocusStore((state) => state.setFocusArea);

  // Set focus area to player when component mounts
  useEffect(() => {
    setFocusArea('player', FocusPriority.MODAL);
    return () => {
      // Reset focus area when leaving player
      setFocusArea(null, FocusPriority.DEFAULT);
    };
  }, [setFocusArea]);

  // Create the player instance
  const { player, videoViewProps } = useVideoHandlers({
    currentEpisode,
    initialPosition,
    introEndTime,
    playbackRate,
    handlePlaybackStatusUpdate,
    deviceType,
  });

  useKeepAwake();

  const { onScreenPress, onScreenLongPress } = usePlayerInteractions(deviceType);

  const flushPlaybackRecord = useCallback(() => {
    const playbackStatus = usePlayerStore.getState().status;
    if (playbackStatus?.isLoaded && playbackStatus.positionMillis > 0) {
      savePlayRecord({}, { immediate: true });
    }
  }, [savePlayRecord]);

  usePlayerLifecycle({
    player,
    showControls,
    showRelatedVideos,
    flushPlaybackRecord,
    setShowControls,
    setShowRelatedVideos,
  });

  useEffect(() => {
    const source = sourceStr;
    const id = videoId;
    const title = videoTitle || (queryTitle as string);

    if (source && id && title) {
      initDetail(title, source, id);
    } else {
      setError("视频加载失败: 缺少必要信息。");
    }
  }, [sourceStr, videoId, videoTitle, queryTitle, initDetail, setError]);

  const lastLoadedKeyRef = useRef<string>('');

  useEffect(() => {
    if (detail && detail.episodes && detail.episodes.length > 0) {
      const matchesTitle = videoTitle ? detail.title === videoTitle : true;
      const matchesId = videoId ? detail.id.toString() === videoId : true;
      const matchesSource = sourceStr ? detail.source === sourceStr : true;

      if (matchesTitle || matchesId || matchesSource) {
        // Prevent duplicate loadVideo calls caused by metadata/resolution/latency enrichment on the same active detail
        const loadKey = `${detail.source}::${detail.id}::${episodeIndex}::${position ?? 'auto'}`;
        if (lastLoadedKeyRef.current === loadKey) {
          return;
        }
        lastLoadedKeyRef.current = loadKey;
        loadVideo({ detail, episodeIndex, position, router });
      }
    }
  }, [detail, videoId, videoTitle, sourceStr, episodeIndex, position, router, loadVideo]);

  useEffect(() => {
    return () => {
      flushPlaybackRecord();
      reset();
      lastLoadedKeyRef.current = '';
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
        isLoaded={isLoaded}
        isBuffering={isBuffering}
        isLoading={isLoading || !detail}
        isSeeking={isSeeking}
        isSeekBuffering={isSeekBuffering}
        currentEpisode={currentEpisode}
        player={player}
        videoViewProps={videoViewProps}
        showControls={showControls && !showRelatedVideos}
        onScreenPress={onScreenPress}
        onScreenLongPress={onScreenLongPress}
        setShowControls={setShowControls}
      />
      <EpisodeSelectionModal />
      <SourceSelectionModal />
      <SpeedSelectionModal />
      <RelatedSeriesModal />
    </ThemedView>
  );
}
