import React from "react";
import { StyleSheet, FlatList } from "react-native";
import { StyledButton } from "./StyledButton";
import { PlayerModalBase } from "./player/PlayerModalBase";
import useDetailStore from "@/stores/detailStore";
import usePlayerStore from "@/stores/playerStore";
import Logger from '@/utils/Logger';
import { useRouter } from "expo-router";

const logger = Logger.withTag('SourceSelectionModal');

export const SourceSelectionModal: React.FC = () => {
  const router = useRouter();
  const { showSourceModal, setShowSourceModal, loadVideo, currentEpisodeIndex, status, _savePlayRecord } = usePlayerStore();
  const { searchResults, detail, setDetail } = useDetailStore();

  const filteredSearchResults = React.useMemo(() => {
    if (!detail) return searchResults;
    return searchResults.filter((item) => {
      // Strict filter: If year or type is present in both, they MUST match.
      if (detail.year && item.year && detail.year !== item.year) return false;
      if (detail.type && item.type && detail.type !== item.type) return false;
      return true;
    });
  }, [searchResults, detail]);

  const onSelectSource = (index: number) => {
    // Note: index is now based on filteredSearchResults
    const selectedItem = filteredSearchResults[index];
    logger.debug("onSelectSource", index, selectedItem.source, detail?.source);
    if (selectedItem.source !== detail?.source) {
      // Force save current progress before switching
      // This ensures the new source loading logic can find the up-to-date record via getLatestByTitle
      _savePlayRecord({}, { immediate: true });

      const newDetail = selectedItem;
      setDetail(newDetail);

      // Reload the video with the new source, preserving current position
      const currentPosition = status?.isLoaded ? status.positionMillis : undefined;
      loadVideo({
        detail: newDetail,
        episodeIndex: currentEpisodeIndex,
        position: currentPosition,
        router: router,
      });
    }
    setShowSourceModal(false);
  };

  const onClose = () => {
    setShowSourceModal(false);
  };

  return (
    <PlayerModalBase
      visible={showSourceModal}
      onClose={onClose}
      title="选择播放源"
      width={500}
    >
      <FlatList
        data={filteredSearchResults}
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
    </PlayerModalBase>
  );
};

const styles = StyleSheet.create({
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
