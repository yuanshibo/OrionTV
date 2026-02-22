import React from "react";
import { useColorScheme } from "react-native";
import { useShallow } from "zustand/react/shallow";
import usePlayerStore from "@/stores/playerStore";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";

export const PlayerTimeDisplay = () => {
  const colorScheme = useColorScheme() ?? "dark";
  const colors = Colors[colorScheme];

  const { positionMillis, durationMillis, isLoaded, isSeeking, seekPosition } = usePlayerStore(
    useShallow((state) => ({
      positionMillis: state.status?.positionMillis ?? 0,
      durationMillis: state.status?.durationMillis ?? 0,
      isLoaded: state.status?.isLoaded ?? false,
      isSeeking: state.isSeeking,
      seekPosition: state.seekPosition,
    }))
  );

  const formatTime = (milliseconds: number) => {
    if (!milliseconds || isNaN(milliseconds)) return "00:00";
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

  const currentDuration = durationMillis || 0;
  const displayPosition = isSeeking ? (seekPosition * currentDuration) : positionMillis;

  return (
    <ThemedText style={{ color: colors.text, marginTop: 5 }}>
      {isLoaded || (isSeeking && currentDuration > 0)
        ? `${formatTime(displayPosition)} / ${formatTime(currentDuration)}`
        : "00:00 / 00:00"}
    </ThemedText>
  );
};
