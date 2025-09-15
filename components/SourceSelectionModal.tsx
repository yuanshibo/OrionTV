import React from "react";
import { View, Text, StyleSheet, Modal, FlatList } from "react-native";
import { StyledButton } from "./StyledButton";
import useDetailStore from "@/stores/detailStore";
import usePlayerStore from "@/stores/playerStore";
import Logger from '@/utils/Logger';

const logger = Logger.withTag('SourceSelectionModal');

export const SourceSelectionModal: React.FC = () => {
  const { showSourceModal, setShowSourceModal, loadVideo, currentEpisodeIndex, status } = usePlayerStore();
  const { searchResults, detail, setDetail } = useDetailStore();

  const onSelectSource = (index: number) => {
    logger.debug("onSelectSource", index, searchResults[index].source, detail?.source);
    if (searchResults[index].source !== detail?.source) {
      const newDetail = searchResults[index];
      setDetail(newDetail);
      
      // Reload the video with the new source, preserving current position
      const currentPosition = status?.isLoaded ? status.positionMillis : undefined;
      loadVideo({
        source: newDetail.source,
        id: newDetail.id.toString(),
        episodeIndex: currentEpisodeIndex,
        title: newDetail.title,
        position: currentPosition
      });
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
            data={searchResults}
            numColumns={4}
            contentContainerStyle={styles.sourceList}
            keyExtractor={(item, index) => `source-${item.source}-${index}`}
            renderItem={({ item, index }) => (
              <StyledButton
                text={item.source_name}
                onPress={() => onSelectSource(index)}
                isSelected={detail?.source === item.source}
                hasTVPreferredFocus={detail?.source === item.source}
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
    width: 500,
    height: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.1)",
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
    marginLeft: 10,
    marginRight: 8,
    width: "20%",
  },
  sourceItemText: {
    fontSize: 14,
  },
});
