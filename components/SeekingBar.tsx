import React from "react";
import { View, StyleSheet } from "react-native";
import usePlayerStore from "@/stores/playerStore";
import { PlayerProgressBar } from "@/components/player/PlayerProgressBar";
import { PlayerTimeDisplay } from "@/components/player/PlayerTimeDisplay";

export const SeekingBar = () => {
  const isSeeking = usePlayerStore((state) => state.isSeeking);
  const showControls = usePlayerStore((state) => state.showControls);

  if (!isSeeking || showControls) {
    return null;
  }

  return (
    <View style={styles.seekingContainer}>
      <PlayerProgressBar />
      <PlayerTimeDisplay />
    </View>
  );
};

const styles = StyleSheet.create({
  seekingContainer: {
    position: "absolute",
    bottom: 100,
    left: "10%",
    right: "10%",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    padding: 15,
    borderRadius: 8,
    zIndex: 20,
  },
});
