import React, { useMemo } from "react";
import { View, Pressable, StyleSheet, useColorScheme } from "react-native";
import Reanimated, { useAnimatedStyle } from "react-native-reanimated";
import {
  progressPositionSV,
  bufferedPositionSV,
  isSeekingSV,
  seekPositionSV,
} from "@/utils/playerSharedValues";
import { Colors } from "@/constants/Colors";

/**
 * PlayerProgressBar
 *
 * Progress bar that drives its fill widths entirely via Reanimated SharedValues,
 * bypassing the React render cycle. The bar now updates on the UI thread every
 * ~250ms (from expo-video callbacks) WITHOUT triggering a React re-render.
 *
 * The component only re-renders on theme changes — instead of 4x/second during
 * playback as it did when subscribed to the Zustand store.
 */
interface PlayerProgressBarProps {
  style?: object;
}

export const PlayerProgressBar = ({ style }: PlayerProgressBarProps = {}) => {
  const colorScheme = useColorScheme() ?? "dark";
  const colors = Colors[colorScheme];

  // No store subscription needed — all values are driven by SharedValues.
  // This component re-renders only when the color scheme changes.

  const styles = useMemo(() => StyleSheet.create({
    progressBarContainer: {
      width: "100%",
      height: 8,
      position: "relative",
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
      width: "0%", // initial; driven by animatedStyle
    },
    progressBarFilled: {
      position: "absolute",
      left: 0,
      top: 0,
      height: "100%",
      backgroundColor: colors.primary,
      width: "0%", // initial; driven by animatedStyle
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

  // Buffered bar — runs on UI thread, no JS/React involvement during playback
  const bufferedAnimStyle = useAnimatedStyle(() => ({
    width: `${bufferedPositionSV.value * 100}%`,
  }));

  // Filled/playhead bar — switches between seek target and live playback position
  const progressAnimStyle = useAnimatedStyle(() => {
    const position = isSeekingSV.value ? seekPositionSV.value : progressPositionSV.value;
    return { width: `${position * 100}%` };
  });

  return (
    <View style={[styles.progressBarContainer, style]}>
      <View style={styles.progressBarBackground} />
      <Reanimated.View style={[styles.progressBarLoaded, bufferedAnimStyle]} />
      <Reanimated.View style={[styles.progressBarFilled, progressAnimStyle]} />
      <Pressable style={styles.progressBarTouchable} />
    </View>
  );
};
