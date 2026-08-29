import React from "react";
import { useColorScheme, Platform } from "react-native";
import { useShallow } from "zustand/react/shallow";
import usePlayerStore from "@/stores/playerStore";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { formatTime } from "@/utils/formatUtils";

export const PlayerTimeDisplay = () => {
  const colorScheme = useColorScheme() === 'light' ? 'light' : 'dark';
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

  const currentDuration = durationMillis || 0;
  const displayPosition = isSeeking ? (seekPosition * currentDuration) : positionMillis;

  return (
    <ThemedText
      style={{
        color: colors.text,
        marginTop: 5,
        fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 1,
      }}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {isLoaded || (isSeeking && currentDuration > 0)
        ? `${formatTime(displayPosition)} / ${formatTime(currentDuration)}`
        : "00:00 / 00:00"}
    </ThemedText>
  );
};
