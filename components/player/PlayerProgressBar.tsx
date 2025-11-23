import React, { useMemo } from "react";
import { View, Pressable, StyleSheet, useColorScheme } from "react-native";
import { useShallow } from "zustand/react/shallow";
import usePlayerStore from "@/stores/playerStore";
import { Colors } from "@/constants/Colors";

export const PlayerProgressBar = () => {
  const colorScheme = useColorScheme() ?? "dark";
  const colors = Colors[colorScheme];

  const { isSeeking, seekPosition, progressPosition, status } = usePlayerStore(
    useShallow((state) => ({
      isSeeking: state.isSeeking,
      seekPosition: state.seekPosition,
      progressPosition: state.progressPosition,
      status: state.status,
    }))
  );

  const durationMillis = status?.durationMillis || 0;
  const playableDurationMillis = status?.playableDurationMillis || 0;
  const loadedPercentage = durationMillis > 0 ? playableDurationMillis / durationMillis : 0;

  const styles = useMemo(() => StyleSheet.create({
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
    <View style={styles.progressBarContainer}>
      <View style={styles.progressBarBackground} />
      <View
        style={[
          styles.progressBarLoaded,
          { width: `${loadedPercentage * 100}%` },
        ]}
      />
      <View
        style={[
          styles.progressBarFilled,
          { width: `${(isSeeking ? seekPosition : progressPosition) * 100}%` },
        ]}
      />
      <Pressable style={styles.progressBarTouchable} />
    </View>
  );
};
