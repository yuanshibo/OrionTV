import React, { useEffect, useRef } from "react";
import { StyleSheet, TouchableOpacity, ActivityIndicator, BackHandler, AppState, AppStateStatus } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Video, ResizeMode } from "expo-av";
import { useKeepAwake } from "expo-keep-awake";
import { ThemedView } from "@/components/ThemedView";
import { PlayerControls } from "@/components/PlayerControls";
import { EpisodeSelectionModal } from "@/components/EpisodeSelectionModal";
import { SourceSelectionModal } from "@/components/SourceSelectionModal";
import { SeekingBar } from "@/components/SeekingBar";
import { NextEpisodeOverlay } from "@/components/NextEpisodeOverlay";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import useDetailStore from "@/stores/detailStore";
import { useTVRemoteHandler } from "@/hooks/useTVRemoteHandler";
import Toast from "react-native-toast-message";
import usePlayerStore, { selectCurrentEpisode } from "@/stores/playerStore";

export default function PlayScreen() {
  const videoRef = useRef<Video>(null);
  const router = useRouter();
  useKeepAwake();
  const {
    episodeIndex: episodeIndexStr,
    position: positionStr,
    source: sourceStr,
    id: videoId,
    title: videoTitle,
  } = useLocalSearchParams<{
    episodeIndex: string;
    position?: string;
    source?: string;
    id?: string;
    title?: string;
  }>();
  const episodeIndex = parseInt(episodeIndexStr || "0", 10);
  const position = positionStr ? parseInt(positionStr, 10) : undefined;

  const { detail } = useDetailStore();
  const source = sourceStr || detail?.source;
  const id = videoId || detail?.id.toString();
  const title = videoTitle || detail?.title;
  const {
    isLoading,
    showControls,
    showNextEpisodeOverlay,
    initialPosition,
    introEndTime,
    setVideoRef,
    handlePlaybackStatusUpdate,
    setShowControls,
    setShowNextEpisodeOverlay,
    reset,
    loadVideo,
  } = usePlayerStore();
  const currentEpisode = usePlayerStore(selectCurrentEpisode);

  useEffect(() => {
    setVideoRef(videoRef);
    if (source && id && title) {
      loadVideo({ source, id, episodeIndex, position, title });
    }

    return () => {
      reset(); // Reset state when component unmounts
    };
  }, [episodeIndex, source, position, setVideoRef, reset, loadVideo, id, title]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "background" || nextAppState === "inactive") {
        videoRef.current?.pauseAsync();
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);

  const { onScreenPress } = useTVRemoteHandler();

  useEffect(() => {
    const backAction = () => {
      if (showControls) {
        setShowControls(false);
        return true;
      }
      router.back();
      return true;
    };

    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);

    return () => backHandler.remove();
  }, [showControls, setShowControls, router]);

  if (!detail) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#fff" />
      </ThemedView>
    );
  }

  return (
    <ThemedView focusable style={styles.container}>
      <TouchableOpacity activeOpacity={1} style={styles.videoContainer} onPress={onScreenPress}>
        <Video
          ref={videoRef}
          style={styles.videoPlayer}
          source={{ uri: currentEpisode?.url || "" }}
          usePoster
          posterSource={{ uri: detail?.poster ?? "" }}
          resizeMode={ResizeMode.CONTAIN}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          onLoad={() => {
            const jumpPosition = initialPosition || introEndTime || 0;
            if (jumpPosition > 0) {
              videoRef.current?.setPositionAsync(jumpPosition);
            }
            usePlayerStore.setState({ isLoading: false });
          }}
          onError={() => {
            usePlayerStore.setState({ isLoading: false });
            Toast.show({ type: "error", text1: "播放失败，请更换源后重试" });
          }}
          onLoadStart={() => usePlayerStore.setState({ isLoading: true })}
          useNativeControls={false}
          shouldPlay
        />

        {showControls && <PlayerControls showControls={showControls} setShowControls={setShowControls} />}

        <SeekingBar />

        <LoadingOverlay visible={isLoading} />

        <NextEpisodeOverlay visible={showNextEpisodeOverlay} onCancel={() => setShowNextEpisodeOverlay(false)} />
      </TouchableOpacity>

      <EpisodeSelectionModal />
      <SourceSelectionModal />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "black" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  videoContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  videoPlayer: {
    ...StyleSheet.absoluteFillObject,
  },
});
