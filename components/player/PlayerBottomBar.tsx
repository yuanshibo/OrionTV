import React from "react";
import { View, StyleSheet } from "react-native";
import { PlayerProgressBar } from "./PlayerProgressBar";
import { PlayerTimeDisplay } from "./PlayerTimeDisplay";

/**
 * PlayerBottomBar
 * 
 * A unified component that displays the progress bar and time current/total.
 * This is shared between PlayerControls and SeekingBar to ensure consistent
 * positioning and appearance.
 */
interface PlayerBottomBarProps {
  style?: object;
  showBackground?: boolean;
}

export const PlayerBottomBar: React.FC<PlayerBottomBarProps> = ({ style, showBackground = false }) => {
  return (
    <View style={[
      styles.container, 
      showBackground && styles.withBackground,
      style
    ]}>
      <PlayerTimeDisplay />
      <PlayerProgressBar />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
  },
  withBackground: {
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    padding: 20,
    borderRadius: 12,
  },
});
