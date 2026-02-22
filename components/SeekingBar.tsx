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
    bottom: 80,
    left: "5%",
    right: "5%",
    alignItems: "center",
    zIndex: 20,
  },
});
