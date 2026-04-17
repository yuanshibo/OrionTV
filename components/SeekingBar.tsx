import React from "react";
import { View, StyleSheet } from "react-native";
import usePlayerStore from "@/stores/playerStore";
import { PlayerBottomBar } from "@/components/player/PlayerBottomBar";

export const SeekingBar = () => {
  const isSeeking = usePlayerStore((state) => state.isSeeking);
  const showControls = usePlayerStore((state) => state.showControls);

  if (!isSeeking || showControls) {
    return null;
  }

  return (
    <View style={styles.seekingContainer}>
      <PlayerBottomBar showBackground />
    </View>
  );
};

const styles = StyleSheet.create({
  seekingContainer: {
    position: "absolute",
    bottom: 0,
    left: 20,
    right: 20,
    alignItems: "center",
    zIndex: 20,
  },
});
