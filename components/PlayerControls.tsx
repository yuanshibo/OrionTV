import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, useColorScheme, GestureResponderEvent } from "react-native";
import { Pause, Play, SkipForward, List, Tv, ArrowDownToDot, ArrowUpFromDot, Gauge } from "lucide-react-native";
import { ThemedText } from "@/components/ThemedText";
import { MediaButton } from "@/components/MediaButton";

import usePlayerStore from "@/stores/playerStore";
import usePlayerUIStore from "@/stores/playerUIStore";
import useDetailStore from "@/stores/detailStore";
import { useSources } from "@/stores/sourceStore";
import { Colors } from "@/constants/Colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";

interface PlayerControlsProps {
  showControls: boolean;
  setShowControls: (show: boolean) => void;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({ showControls, setShowControls }) => {
  const colorScheme = useColorScheme() ?? "dark";
  const colors = Colors[colorScheme];

  // Use Player Store
  const currentEpisodeIndex = usePlayerStore((state) => state.currentEpisodeIndex);
  const episodes = usePlayerStore((state) => state.episodes);
  const status = usePlayerStore((state) => state.status);
  const isSeeking = usePlayerStore((state) => state.isSeeking);
  const seekPosition = usePlayerStore((state) => state.seekPosition);
  const progressPosition = usePlayerStore((state) => state.progressPosition);
  const playbackRate = usePlayerStore((state) => state.playbackRate);
  const seek = usePlayerStore((state) => state.seek);
  const togglePlayPause = usePlayerStore((state) => state.togglePlayPause);
  const playEpisode = usePlayerStore((state) => state.playEpisode);
  const setIntroEndTime = usePlayerStore((state) => state.setIntroEndTime);
  const setOutroStartTime = usePlayerStore((state) => state.setOutroStartTime);
  const introEndTime = usePlayerStore((state) => state.introEndTime);
  const outroStartTime = usePlayerStore((state) => state.outroStartTime);

  // Use UI Store
  const setShowEpisodeModal = usePlayerUIStore((state) => state.setShowEpisodeModal);
  const setShowSourceModal = usePlayerUIStore((state) => state.setShowSourceModal);
  const setShowSpeedModal = usePlayerUIStore((state) => state.setShowSpeedModal);

  const { detail } = useDetailStore();
  const resources = useSources();
  const { deviceType } = useResponsiveLayout();
  const [progressBarWidth, setProgressBarWidth] = useState(0);

  const videoTitle = detail?.title || "";
  const currentEpisode = episodes[currentEpisodeIndex];
  const currentEpisodeTitle = currentEpisode?.title;
  const currentSource = resources.find((r) => r.source === detail?.source);
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

  const handleProgressBarPress = (e: GestureResponderEvent) => {
    if (deviceType === 'tv' || !status?.durationMillis || progressBarWidth === 0) return;

    const tapX = e.nativeEvent.locationX;
    const percentage = tapX / progressBarWidth;
    const targetTime = percentage * status.durationMillis;

    // Calculate difference to seek
    const current = status.positionMillis;
    const diff = targetTime - current;

    // Use seek method which expects duration difference in milliseconds (Wait, verify seek method)
    // Checking playerStore: seek(duration: number) where duration is in ms?
    // seek(duration) implementation: const newPosition = current + duration;
    // So yes, diff is correct.
    // Wait, seek(duration) takes ms or seconds?
    // playerStore.ts: set seekPosition: newPosition / durationMillis.
    // It expects milliseconds.
    seek(diff);
  };
  
  const durationMillis = status?.durationMillis || 0;
  const playableDurationMillis = status?.playableDurationMillis || 0;
  const loadedPercentage = durationMillis > 0 ? playableDurationMillis / durationMillis : 0;

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
    progressBarContainer: {
      width: "100%",
      height: 8,
      position: "relative",
      marginTop: 10,
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressBarBackground: {
      position: "absolute",
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(255, 255, 255, 0.3)",
    },
    progressBarLoaded: {
      position: "absolute",
      left: 0,
      top: 0,
      height: "100%",
      backgroundColor: "rgba(255, 255, 255, 0.5)",
    },
    progressBarFilled: {
      position: "absolute",
      left: 0,
      top: 0,
      height: "100%",
      backgroundColor: colors.primary,
    },
    progressBarTouchable: {
      position: "absolute",
      left: 0,
      right: 0,
      height: 30,
      top: -10,
      zIndex: 10,
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
        <View
          style={styles.progressBarContainer}
          onLayout={(e) => setProgressBarWidth(e.nativeEvent.layout.width)}
        >
          <View style={styles.progressBarBackground} />
          <View
            style={[
              styles.progressBarLoaded,
              {
                width: `${loadedPercentage * 100}%`,
              },
            ]}
          />
          <View
            style={[
              styles.progressBarFilled,
              {
                width: `${(isSeeking ? seekPosition : progressPosition) * 100}%`,
              },
            ]}
          />
          <Pressable
            style={styles.progressBarTouchable}
            onPress={handleProgressBarPress}
            focusable={false} // Disable focus on TV to prevent accidental interaction
          />
        </View>

        <ThemedText style={{ color: colors.text, marginTop: 5 }}>
          {status?.isLoaded
            ? `${formatTime(status.positionMillis)} / ${formatTime(status.durationMillis || 0)}`
            : "00:00 / 00:00"}
        </ThemedText>

        <View style={styles.bottomControls}>
          <MediaButton onPress={setIntroEndTime} timeLabel={introEndTime ? formatTime(introEndTime) : undefined}>
            <ArrowDownToDot color={colors.text} size={24} />
          </MediaButton>

          <MediaButton onPress={togglePlayPause} hasTVPreferredFocus={showControls}>
            {status?.isLoaded && status.isPlaying ? (
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
