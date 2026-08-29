import React from "react";
import { StyleSheet, FlatList } from "react-native";
import { StyledButton } from "./StyledButton";
import { PlayerModalBase } from "./player/PlayerModalBase";
import usePlayerStore from "@/stores/playerStore";

interface SpeedOption {
  rate: number;
  label: string;
}

const SPEED_OPTIONS: SpeedOption[] = [
  { rate: 0.5, label: "0.5x" },
  { rate: 0.75, label: "0.75x" },
  { rate: 1.0, label: "1x" },
  { rate: 1.25, label: "1.25x" },
  { rate: 1.5, label: "1.5x" },
  { rate: 1.75, label: "1.75x" },
  { rate: 2.0, label: "2x" },
];

export const SpeedSelectionModal: React.FC = () => {
  const { showSpeedModal, setShowSpeedModal, playbackRate, setPlaybackRate } = usePlayerStore();

  const onSelectSpeed = (rate: number) => {
    setPlaybackRate(rate);
    setShowSpeedModal(false);
  };

  const onClose = () => {
    setShowSpeedModal(false);
  };

  return (
    <PlayerModalBase
      visible={showSpeedModal}
      onClose={onClose}
      title="播放速度"
      width={400}
    >
      <FlatList
        data={SPEED_OPTIONS}
        numColumns={4}
        contentContainerStyle={styles.speedList}
        keyExtractor={(item) => `speed-${item.rate}`}
        renderItem={({ item }) => (
          <StyledButton
            text={item.label}
            onPress={() => onSelectSpeed(item.rate)}
            isSelected={playbackRate === item.rate}
            hasTVPreferredFocus={playbackRate === item.rate}
            style={styles.speedItem}
            textStyle={styles.speedItemText}
          />
        )}
      />
    </PlayerModalBase>
  );
};

const styles = StyleSheet.create({
  speedList: {
    justifyContent: "flex-start",
  },
  speedItem: {
    paddingVertical: 10,
    margin: 4,
    marginLeft: 10,
    marginRight: 8,
    width: "20%",
  },
  speedItemText: {
    fontSize: 14,
  },
});