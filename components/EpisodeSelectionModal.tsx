import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Modal, FlatList, ScrollView } from "react-native";
import { StyledButton } from "./StyledButton";
import usePlayerStore from "@/stores/playerStore";

const EPISODE_GROUP_SIZE = 30;

export const EpisodeSelectionModal: React.FC = () => {
  const { showEpisodeModal, episodes, currentEpisodeIndex, playEpisode, setShowEpisodeModal } = usePlayerStore();

  const initialGroup = currentEpisodeIndex >= 0 ? Math.floor(currentEpisodeIndex / EPISODE_GROUP_SIZE) : 0;
  const [selectedEpisodeGroup, setSelectedEpisodeGroup] = useState(initialGroup);

  useEffect(() => {
    if (currentEpisodeIndex < 0) {
      return;
    }
    const targetGroup = Math.floor(currentEpisodeIndex / EPISODE_GROUP_SIZE);
    setSelectedEpisodeGroup((prev) => (prev === targetGroup ? prev : targetGroup));
  }, [currentEpisodeIndex]);

  useEffect(() => {
    if (episodes.length === 0) {
      setSelectedEpisodeGroup((prev) => (prev === 0 ? prev : 0));
      return;
    }

    const maxGroup = Math.max(0, Math.floor((episodes.length - 1) / EPISODE_GROUP_SIZE));
    setSelectedEpisodeGroup((prev) => {
      const clamped = Math.min(Math.max(prev, 0), maxGroup);
      return clamped === prev ? prev : clamped;
    });
  }, [episodes.length]);

  const startIndex = selectedEpisodeGroup * EPISODE_GROUP_SIZE;
  const visibleEpisodes = episodes.slice(startIndex, startIndex + EPISODE_GROUP_SIZE);

  const onSelectEpisode = (index: number) => {
    playEpisode(index);
    setShowEpisodeModal(false);
  };

  const onClose = () => {
    setShowEpisodeModal(false);
  };

  return (
    <Modal visible={showEpisodeModal} transparent={true} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>选择剧集</Text>

          {episodes.length > EPISODE_GROUP_SIZE && (
            <View style={styles.rangeContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.episodeGroupContainer}
              >
                {Array.from({ length: Math.ceil(episodes.length / EPISODE_GROUP_SIZE) }, (_, groupIndex) => (
                  <StyledButton
                    key={groupIndex}
                    text={`${groupIndex * EPISODE_GROUP_SIZE + 1}-${Math.min((groupIndex + 1) * EPISODE_GROUP_SIZE, episodes.length)}`}
                    onPress={() => setSelectedEpisodeGroup(groupIndex)}
                    onFocus={() => setSelectedEpisodeGroup(groupIndex)}
                    isSelected={selectedEpisodeGroup === groupIndex}
                    variant="ghost"
                    style={styles.episodeGroupButton}
                    textStyle={[
                      styles.episodeGroupButtonText,
                      selectedEpisodeGroup === groupIndex && styles.selectedGroupText
                    ]}
                  />
                ))}
              </ScrollView>
            </View>
          )}
          <FlatList
            data={visibleEpisodes}
            numColumns={5}
            contentContainerStyle={styles.episodeList}
            keyExtractor={(_, index) => `episode-${startIndex + index}`}
            renderItem={({ item, index }) => {
              const absoluteIndex = startIndex + index;
              return (
                <StyledButton
                  text={item.title || `第 {absoluteIndex + 1} 集`}
                  onPress={() => onSelectEpisode(absoluteIndex)}
                  isSelected={currentEpisodeIndex === absoluteIndex}
                  hasTVPreferredFocus={currentEpisodeIndex === absoluteIndex}
                  style={styles.episodeItem}
                  textStyle={styles.episodeItemText}
                  textProps={{ numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.6 }}
                />
              );
            }}
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
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    padding: 20,
  },
  modalTitle: {
    color: "white",
    marginBottom: 12,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "bold",
  },
  rangeContainer: {
    marginBottom: 0, // Removed margin
    height: 50, // Reduced height slightly
    justifyContent: 'center',
  },
  episodeList: {
    justifyContent: "flex-start",
    paddingBottom: 20,
    paddingTop: 4, // Small top padding
  },
  episodeItem: {
    paddingVertical: 2,
    margin: 4,
    width: "18%",
  },
  episodeItemText: {
    fontSize: 12,
  },
  episodeGroupContainer: {
    paddingHorizontal: 10,
    paddingVertical: 2, // Reduced vertical padding
    alignItems: 'center',
  },
  episodeGroupButton: {
    paddingHorizontal: 12,
    paddingVertical: 0, // Remove vertical padding to let flex center it
    marginRight: 8,
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    minHeight: 36,
    justifyContent: 'center', // Ensure text is centered
  },
  episodeGroupButtonText: {
    fontSize: 14,
    color: "#AAAAAA", // Opaque color
    fontWeight: "600",
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  selectedGroupText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
});
