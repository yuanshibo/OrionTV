import React, { useEffect, useRef } from "react";
import { StyleSheet, TouchableOpacity, ActivityIndicator, BackHandler } from "react-native";
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
import usePlayerStore from "@/stores/playerStore";
import { useTVRemoteHandler } from "@/hooks/useTVRemoteHandler";

export default function PlayScreen() {
  const videoRef = useRef<Video>(null);
  const router = useRouter();
  useKeepAwake();
  const { source, id, episodeIndex, position } = useLocalSearchParams<{
    source: string;
    id: string;
    episodeIndex: string;
    position: string;
  }>();

  const {
    detail,
    episodes,
    currentEpisodeIndex,
    isLoading,
    showControls,
    showEpisodeModal,
    showSourceModal,
    showNextEpisodeOverlay,
    initialPosition,
    introEndTime,
    setVideoRef,
    loadVideo,
    handlePlaybackStatusUpdate,
    setShowControls,
    setShowEpisodeModal,
    setShowSourceModal,
    setShowNextEpisodeOverlay,
    reset,
  } = usePlayerStore();

  useEffect(() => {
    setVideoRef(videoRef);
    if (source && id) {
      loadVideo(source, id, parseInt(episodeIndex || "0", 10), parseInt(position || "0", 10));
    }
    return () => {
      reset(); // Reset state when component unmounts
    };
  }, [source, id, episodeIndex, position, setVideoRef, loadVideo, reset]);

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
  }, [
    showControls,
    showEpisodeModal,
    showSourceModal,
    setShowControls,
    setShowEpisodeModal,
    setShowSourceModal,
    router,
  ]);

  if (!detail && isLoading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#fff" />
      </ThemedView>
    );
  }

  const currentEpisode = episodes[currentEpisodeIndex];

  return (
    <ThemedView focusable style={styles.container}>
      <TouchableOpacity activeOpacity={1} style={styles.videoContainer} onPress={onScreenPress}>
        <Video
          ref={videoRef}
          style={styles.videoPlayer}
          source={{ uri: currentEpisode?.url }}
          usePoster
          posterSource={{ uri: detail?.videoInfo.cover ?? "" }}
          resizeMode={ResizeMode.CONTAIN}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          onLoad={() => {
            const jumpPosition = introEndTime || initialPosition;
            if (jumpPosition > 0) {
              videoRef.current?.setPositionAsync(jumpPosition);
            }
            usePlayerStore.setState({ isLoading: false });
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
