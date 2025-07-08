import React from "react";
import { View, Text, StyleSheet, Modal, FlatList } from "react-native";
import { StyledButton } from "./StyledButton";
import usePlayerStore from "@/stores/playerStore";

export const SourceSelectionModal: React.FC = () => {
  const { showSourceModal, sources, currentSourceIndex, switchSource, setShowSourceModal } = usePlayerStore();

  const onSelectSource = (index: number) => {
    if (index !== currentSourceIndex) {
      switchSource(index);
    }
    setShowSourceModal(false);
  };

  const onClose = () => {
    setShowSourceModal(false);
  };

  return (
    <Modal visible={showSourceModal} transparent={true} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>选择播放源</Text>
          <FlatList
            data={sources}
            numColumns={3}
            contentContainerStyle={styles.sourceList}
            keyExtractor={(item, index) => `source-${item.source}-${item.id}-${index}`}
            renderItem={({ item, index }) => (
              <StyledButton
                text={item.source_name}
                onPress={() => onSelectSource(index)}
                isSelected={currentSourceIndex === index}
                hasTVPreferredFocus={currentSourceIndex === index}
                style={styles.sourceItem}
                textStyle={styles.sourceItemText}
              />
            )}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    backgroundColor: "transparent",
  },
  modalContent: {
    width: 600,
    height: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    padding: 20,
  },
  modalTitle: {
    color: "white",
    marginBottom: 12,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "bold",
  },
  sourceList: {
    justifyContent: "flex-start",
  },
  sourceItem: {
    paddingVertical: 2,
    margin: 4,
    width: "31%",
  },
  sourceItemText: {
    fontSize: 14,
  },
});
