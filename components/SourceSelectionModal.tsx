import React, { useCallback, memo } from "react";
import { View, Text, StyleSheet, Modal, FlatList } from "react-native";
import { useShallow } from "zustand/react/shallow";
import { StyledButton } from "./StyledButton";
import useDetailStore from "@/stores/detailStore";
import usePlayerStore from "@/stores/playerStore";
import usePlayerUIStore from "@/stores/playerUIStore";
import Logger from '@/utils/Logger';
import { useRouter } from "expo-router";

const logger = Logger.withTag('SourceSelectionModal');

export const SourceSelectionModal = memo(() => {
  const router = useRouter();
  const { loadVideo, currentEpisodeIndex } = usePlayerStore(
    useShallow((state) => ({
      loadVideo: state.loadVideo,
      currentEpisodeIndex: state.currentEpisodeIndex,
    }))
  );
  const { showSourceModal, setShowSourceModal } = usePlayerUIStore(
    useShallow((state) => ({
      showSourceModal: state.showSourceModal,
      setShowSourceModal: state.setShowSourceModal,
    }))
  );
  const { searchResults, detail, setDetail } = useDetailStore(
    useShallow((state) => ({
      searchResults: state.searchResults,
      detail: state.detail,
      setDetail: state.setDetail,
    }))
  );

  const onSelectSource = useCallback((index: number) => {
    logger.debug("onSelectSource", index, searchResults[index].source, detail?.source);
    if (searchResults[index].source !== detail?.source) {
      const newDetail = searchResults[index];
      setDetail(newDetail);
      
      // Reload the video with the new source, preserving current position
      // Use getState() to access latest status without triggering re-renders
      const currentStatus = usePlayerStore.getState().status;
      const currentPosition = currentStatus?.isLoaded ? currentStatus.positionMillis : undefined;
      loadVideo({
        detail: newDetail,
        episodeIndex: currentEpisodeIndex,
        position: currentPosition,
        router: router,
      });
    }
    setShowSourceModal(false);
  }, [searchResults, detail, setDetail, loadVideo, currentEpisodeIndex, router, setShowSourceModal]);

  const onClose = useCallback(() => {
    setShowSourceModal(false);
  }, [setShowSourceModal]);

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
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={5}
          />
        </View>
      </View>
    </Modal>
  );
});

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
    backgroundColor: "rgba(0, 0, 0, 0.3)",
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
    fontSize: 12,
  },
});
