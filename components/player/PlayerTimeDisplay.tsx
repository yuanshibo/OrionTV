import React from "react";
import { useColorScheme } from "react-native";
import { useShallow } from "zustand/react/shallow";
import usePlayerStore from "@/stores/playerStore";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";

export const PlayerTimeDisplay = () => {
  const colorScheme = useColorScheme() ?? "dark";
  const colors = Colors[colorScheme];

  const { positionMillis, durationMillis, isLoaded } = usePlayerStore(
    useShallow((state) => ({
      positionMillis: state.status?.positionMillis ?? 0,
      durationMillis: state.status?.durationMillis ?? 0,
      isLoaded: state.status?.isLoaded ?? false,
    }))
  );

  const formatTime = (milliseconds: number) => {
    if (!milliseconds) return "00:00";
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <ThemedText style={{ color: colors.text, marginTop: 5 }}>
      {isLoaded
        ? `${formatTime(positionMillis)} / ${formatTime(durationMillis)}`
        : "00:00 / 00:00"}
    </ThemedText>
  );
};
