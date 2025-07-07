import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import { useKeepAwake } from 'expo-keep-awake';
import { ThemedView } from '@/components/ThemedView';
import { PlayerControls } from '@/components/PlayerControls';
import { EpisodeSelectionModal } from '@/components/EpisodeSelectionModal';
import { NextEpisodeOverlay } from '@/components/NextEpisodeOverlay';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import usePlayerStore from '@/stores/playerStore';
import { useTVRemoteHandler } from '@/hooks/useTVRemoteHandler';

export default function PlayScreen() {
  const videoRef = useRef<Video>(null);
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
    showNextEpisodeOverlay,
    initialPosition,
    setVideoRef,
    loadVideo,
    playEpisode,
    togglePlayPause,
    seek,
    handlePlaybackStatusUpdate,
    setShowControls,
    setShowEpisodeModal,
    setShowNextEpisodeOverlay,
    reset,
  } = usePlayerStore();

  useEffect(() => {
    setVideoRef(videoRef);
    if (source && id) {
      loadVideo(source, id, parseInt(episodeIndex || '0', 10), parseInt(position || '0', 10));
    }
    return () => {
      reset(); // Reset state when component unmounts
    };
  }, [source, id, episodeIndex, position, setVideoRef, loadVideo, reset]);

  const { currentFocus, setCurrentFocus } = useTVRemoteHandler({
    showControls,
    setShowControls,
    showEpisodeModal,
    onPlayPause: togglePlayPause,
    onSeek: seek,
    onShowEpisodes: () => setShowEpisodeModal(true),
    onPlayNextEpisode: () => {
      if (currentEpisodeIndex < episodes.length - 1) {
        playEpisode(currentEpisodeIndex + 1);
        setShowControls(false);
      }
    },
  });

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
      <TouchableOpacity
        activeOpacity={1}
        style={styles.videoContainer}
        onPress={() => {
          setShowControls(!showControls);
          setCurrentFocus(null);
        }}
      >
        <Video
          ref={videoRef}
          style={styles.videoPlayer}
          source={{ uri: currentEpisode?.url }}
          resizeMode={ResizeMode.CONTAIN}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          onLoad={() => {
            if (initialPosition > 0) {
              videoRef.current?.setPositionAsync(initialPosition);
            }
            usePlayerStore.setState({ isLoading: false });
          }}
          onLoadStart={() => usePlayerStore.setState({ isLoading: true })}
          useNativeControls={false}
          shouldPlay
        />

        {showControls && <PlayerControls currentFocus={currentFocus} setShowControls={setShowControls} />}

        <LoadingOverlay visible={isLoading} />

        <NextEpisodeOverlay visible={showNextEpisodeOverlay} onCancel={() => setShowNextEpisodeOverlay(false)} />
      </TouchableOpacity>

      <EpisodeSelectionModal />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  videoContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  videoPlayer: {
    ...StyleSheet.absoluteFillObject,
  },
});
