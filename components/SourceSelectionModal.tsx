import React from "react";
import { StyleSheet, FlatList, View } from "react-native";
import { StyledButton } from "./StyledButton";
import { ThemedText } from "./ThemedText";
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

  const selectedIndex = React.useMemo(() => {
    if (!detail) return -1;
    return filteredSearchResults.findIndex((item) => detail.source === item.source);
  }, [filteredSearchResults, detail]);

  const isCooldownRef = React.useRef(false);

  React.useEffect(() => {
    if (showSourceModal) {
      isCooldownRef.current = true;
      const timer = setTimeout(() => {
        isCooldownRef.current = false;
      }, 250);
      return () => clearTimeout(timer);
    }
    isCooldownRef.current = false;
  }, [showSourceModal]);

  const onSelectSource = React.useCallback((index: number) => {
    // 250ms cooldown to avoid accidental click-through on long-press release
    if (isCooldownRef.current) {
      logger.debug("onSelectSource ignored due to anti-misclick cooldown");
      return;
    }

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
  }, [filteredSearchResults, detail, _savePlayRecord, setDetail, status, loadVideo, currentEpisodeIndex, router, setShowSourceModal]);

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
        numColumns={3}
        contentContainerStyle={styles.sourceList}
        keyExtractor={(item, index) => `source-${item.source}-${index}`}
        removeClippedSubviews={false}
        initialNumToRender={filteredSearchResults.length || 12}
        maxToRenderPerBatch={filteredSearchResults.length || 12}
        renderItem={({ item, index }) => {
          const isSelected = detail?.source === item.source;
          return (
            <StyledButton
              onPress={() => onSelectSource(index)}
              isSelected={isSelected}
              hasTVPreferredFocus={isSelected || (selectedIndex === -1 && index === 0)}
              style={styles.sourceItem}
            >
              <View style={styles.sourceItemContent}>
                <ThemedText style={[styles.sourceItemText, isSelected && styles.selectedItemText]} numberOfLines={1}>
                  {item.source_name}
                </ThemedText>
                <View style={styles.badgeRow}>
                  {item.resolution ? (
                    <View style={[styles.badge, styles.resBadge, isSelected && styles.selectedBadge]}>
                      <ThemedText style={styles.badgeText}>{item.resolution}</ThemedText>
                    </View>
                  ) : null}
                  {item.latencyMs !== undefined && item.latencyMs !== null ? (
                    <View
                      style={[
                        styles.badge,
                        item.latencyMs < 400
                          ? styles.latencyFast
                          : item.latencyMs < 900
                          ? styles.latencyMedium
                          : styles.latencySlow,
                      ]}
                    >
                      <ThemedText style={styles.latencyBadgeText}>{item.latencyMs}ms</ThemedText>
                    </View>
                  ) : null}
                </View>
              </View>
            </StyledButton>
          );
        }}
      />
    </PlayerModalBase>
  );
};

const styles = StyleSheet.create({
  sourceList: {
    justifyContent: "flex-start",
    paddingVertical: 4,
  },
  sourceItem: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    margin: 4,
    width: "31%",
    borderRadius: 8,
  },
  sourceItemContent: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  sourceItemText: {
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  selectedItemText: {
    fontWeight: "700",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: 3,
  },
  badge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  resBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  selectedBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  badgeText: {
    fontSize: 9,
    color: "#fff",
    fontWeight: "600",
  },
  latencyFast: {
    backgroundColor: "rgba(46, 204, 113, 0.25)",
  },
  latencyMedium: {
    backgroundColor: "rgba(243, 156, 18, 0.25)",
  },
  latencySlow: {
    backgroundColor: "rgba(189, 195, 199, 0.2)",
  },
  latencyBadgeText: {
    fontSize: 9,
    fontWeight: "600",
    color: "#ecf0f1",
  },
});
