import React, { useMemo } from "react";
import { View, Text, useColorScheme, StyleSheet } from "react-native";
import usePlayerStore from "@/stores/playerStore";
import usePlayerUIStore from "@/stores/playerUIStore";
import { Colors } from "@/constants/Colors";

const formatTime = (milliseconds: number) => {
  if (isNaN(milliseconds) || milliseconds < 0) {
    return "00:00";
  }
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

export const SeekingBar = () => {
  const { isSeeking, isSeekBuffering, seekPosition, status } = usePlayerStore();
  const { showControls } = usePlayerUIStore();
  const colorScheme = useColorScheme() ?? "dark";
  const colors = Colors[colorScheme];

  const styles = useMemo(() => StyleSheet.create({
    seekingContainer: {
      position: "absolute",
      bottom: 80,
      left: "5%",
      right: "5%",
      alignItems: "center",
      zIndex: 20,
    },
    timeText: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "bold",
      backgroundColor: "rgba(0,0,0,0.6)",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      marginBottom: 10,
    },
    seekingBarContainer: {
      width: "100%",
      height: 8,
      position: "relative",
      borderRadius: 4,
      overflow: 'hidden',
    },
    seekingBarBackground: {
      position: 'absolute',
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(255, 255, 255, 0.3)",
    },
    seekingBarLoaded: {
      position: 'absolute',
      left: 0,
      top: 0,
      height: "100%",
      backgroundColor: "rgba(255, 255, 255, 0.5)",
    },
    seekingBarFilled: {
      position: 'absolute',
      top: 0,
      left: 0,
      height: "100%",
      backgroundColor: colors.primary,
    },
  }), [colors]);

  if (!isSeeking || showControls) {
    return null;
  }

  const durationMillis = status?.durationMillis || 0;
  const playableDurationMillis = status?.playableDurationMillis || 0;
  const loadedPercentage = durationMillis > 0 ? playableDurationMillis / durationMillis : 0;

  let currentPositionMillis: number;
  let progressPercentage: number;

  if (isSeekBuffering) {
    progressPercentage = seekPosition;
    currentPositionMillis = seekPosition * durationMillis;
  } else {
    currentPositionMillis = status?.positionMillis || 0;
    progressPercentage = durationMillis > 0 ? currentPositionMillis / durationMillis : 0;
  }

  return (
    <View style={styles.seekingContainer}>
      <Text style={styles.timeText}>
        {formatTime(currentPositionMillis)} / {formatTime(durationMillis)}
      </Text>
      <View style={styles.seekingBarContainer}>
        <View style={styles.seekingBarBackground} />
        <View
          style={[
            styles.seekingBarLoaded,
            {
              width: `${loadedPercentage * 100}%`,
            },
          ]}
        />
        <View
          style={[
            styles.seekingBarFilled,
            {
              width: `${progressPercentage * 100}%`,
            },
          ]}
        />
      </View>
    </View>
  );
};
