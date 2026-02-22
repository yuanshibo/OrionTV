import React, { useMemo } from "react";
import { View, Text, StyleSheet, useColorScheme } from "react-native";
import { Pause, Play, SkipForward, List, Tv, ArrowDownToDot, ArrowUpFromDot, Gauge } from "lucide-react-native";
import { MediaButton } from "@/components/MediaButton";
import { useShallow } from "zustand/react/shallow";

import usePlayerStore from "@/stores/playerStore";
import useDetailStore from "@/stores/detailStore";
import { useSources } from "@/stores/sourceStore";
import { Colors } from "@/constants/Colors";
import { PlayerProgressBar } from "@/components/player/PlayerProgressBar";
import { PlayerTimeDisplay } from "@/components/player/PlayerTimeDisplay";

interface PlayerControlsProps {
  showControls: boolean;
  setShowControls: (show: boolean) => void;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({ showControls, setShowControls }) => {
  const colorScheme = useColorScheme() ?? "dark";
  const colors = Colors[colorScheme];

  const {
    currentEpisodeIndex,
    episodes,
    isLoaded,
    isPlaying,
    playbackRate,
    introEndTime,
    outroStartTime,
    togglePlayPause,
    playEpisode,
    setShowEpisodeModal,
    setShowSourceModal,
    setShowSpeedModal,
    setIntroEndTime,
    setOutroStartTime,
  } = usePlayerStore(
    useShallow((state) => ({
      currentEpisodeIndex: state.currentEpisodeIndex,
      episodes: state.episodes,
      isLoaded: state.status?.isLoaded,
      isPlaying: state.status?.isPlaying,
      playbackRate: state.playbackRate,
      introEndTime: state.introEndTime,
      outroStartTime: state.outroStartTime,
      togglePlayPause: state.togglePlayPause,
      playEpisode: state.playEpisode,
      setShowEpisodeModal: state.setShowEpisodeModal,
      setShowSourceModal: state.setShowSourceModal,
      setShowSpeedModal: state.setShowSpeedModal,
      setIntroEndTime: state.setIntroEndTime,
      setOutroStartTime: state.setOutroStartTime,
    }))
  );

  const { title: videoTitle, source } = useDetailStore(
    useShallow((state) => ({
      title: state.detail?.title,
      source: state.detail?.source,
    }))
  );

  const resources = useSources();

  const currentEpisode = episodes[currentEpisodeIndex];
  const currentEpisodeTitle = currentEpisode?.title;
  const currentSource = resources.find((r) => r.source === source);
  const currentSourceName = currentSource?.source_name;
  const hasNextEpisode = currentEpisodeIndex < (episodes.length || 0) - 1;

  const formatTime = (milliseconds: number) => {
    if (!milliseconds) return "00:00";
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const onPlayNextEpisode = () => {
    if (hasNextEpisode) {
      playEpisode(currentEpisodeIndex + 1);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    controlsOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0, 0, 0, 0.4)",
      justifyContent: "space-between",
      padding: 20,
    },
    topControls: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    controlTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "bold",
      flex: 1,
      textAlign: "center",
      marginHorizontal: 10,
    },
    bottomControlsContainer: {
      width: "100%",
      alignItems: "center",
    },
    bottomControls: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap",
      marginTop: 15,
    },
  }), [colors]);

  return (
    <View style={styles.controlsOverlay}>
      <View style={styles.topControls}>
        <Text style={styles.controlTitle}>
          {videoTitle} {currentEpisodeTitle ? `- ${currentEpisodeTitle}` : ""}
          {currentSourceName ? `(${currentSourceName})` : ""}
        </Text>
      </View>

      <View style={styles.bottomControlsContainer}>
        <PlayerProgressBar style={{ marginTop: 10 }} />
        <PlayerTimeDisplay />

        <View style={styles.bottomControls}>
          <MediaButton onPress={setIntroEndTime} timeLabel={introEndTime ? formatTime(introEndTime) : undefined}>
            <ArrowDownToDot color={colors.text} size={24} />
          </MediaButton>

          <MediaButton onPress={togglePlayPause} hasTVPreferredFocus={showControls}>
            {isLoaded && isPlaying ? (
              <Pause color={colors.text} size={24} />
            ) : (
              <Play color={colors.text} size={24} />
            )}
          </MediaButton>

          <MediaButton onPress={onPlayNextEpisode} disabled={!hasNextEpisode}>
            <SkipForward color={hasNextEpisode ? colors.text : colors.icon} size={24} />
          </MediaButton>

          <MediaButton onPress={setOutroStartTime} timeLabel={outroStartTime ? formatTime(outroStartTime) : undefined}>
            <ArrowUpFromDot color={colors.text} size={24} />
          </MediaButton>

          <MediaButton onPress={() => setShowEpisodeModal(true)}>
            <List color={colors.text} size={24} />
          </MediaButton>

          <MediaButton onPress={() => setShowSpeedModal(true)} timeLabel={playbackRate !== 1.0 ? `${playbackRate}x` : undefined}>
            <Gauge color={colors.text} size={24} />
          </MediaButton>

          <MediaButton onPress={() => setShowSourceModal(true)}>
            <Tv color={colors.text} size={24} />
          </MediaButton>
        </View>
      </View>
    </View>
  );
};
