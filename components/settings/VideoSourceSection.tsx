import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, Switch, ActivityIndicator, FlatList, Pressable, Animated } from "react-native";
import { useTVEventHandler } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { SettingsSection } from "./SettingsSection";
import { api, ApiSite } from "@/services/api";
import { useSettingsStore } from "@/stores/settingsStore";

interface VideoSourceSectionProps {
  onChanged: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

export const VideoSourceSection: React.FC<VideoSourceSectionProps> = ({ onChanged, onFocus, onBlur }) => {
  const [resources, setResources] = useState<ApiSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [isSectionFocused, setIsSectionFocused] = useState(false);
  const { videoSource, setVideoSource } = useSettingsStore();

  useEffect(() => {
    fetchResources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchResources = async () => {
    try {
      setLoading(true);
      const resourcesList = await api.getResources();
      setResources(resourcesList);

      if (videoSource.enabledAll && resourcesList.length === 0) {
        const allResourceKeys: { [key: string]: boolean } = {};
        for (const resource of resourcesList) {
          allResourceKeys[resource.key] = true;
        }
        setVideoSource({
          enabledAll: true,
          sources: allResourceKeys,
        });
      }
    } catch (err) {
      setError("获取播放源失败");
      console.error("Failed to fetch resources:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleResourceEnabled = useCallback(
    (resourceKey: string) => {
      const isEnabled = videoSource.sources[resourceKey];

      const newEnabledSources = { ...videoSource.sources, [resourceKey]: !isEnabled };

      setVideoSource({
        enabledAll: Object.values(newEnabledSources).every((enabled) => enabled),
        sources: newEnabledSources,
      });

      onChanged();
    },
    [videoSource.sources, setVideoSource, onChanged]
  );

  const handleSectionFocus = () => {
    setIsSectionFocused(true);
    onFocus?.();
  };

  const handleSectionBlur = () => {
    setIsSectionFocused(false);
    setFocusedIndex(null);
    onBlur?.();
  };

  // TV遥控器事件处理
  const handleTVEvent = useCallback(
    (event: any) => {
      if (event.eventType === "select") {
        if (focusedIndex !== null) {
          const resource = resources[focusedIndex];
          if (resource) {
            toggleResourceEnabled(resource.key);
          }
        } else if (isSectionFocused) {
          setFocusedIndex(0);
        }
      }
    },
    [isSectionFocused, focusedIndex, resources, toggleResourceEnabled]
  );

  useTVEventHandler(handleTVEvent);

  const renderResourceItem = ({ item, index }: { item: ApiSite; index: number }) => {
    const isEnabled = videoSource.enabledAll || videoSource.sources[item.key];
    const isFocused = focusedIndex === index;

    return (
      <Animated.View style={[styles.resourceItem]}>
        <Pressable
          hasTVPreferredFocus={isFocused}
          style={[styles.resourcePressable, isFocused && styles.resourceFocused]}
          onFocus={() => setFocusedIndex(index)}
          onBlur={() => setFocusedIndex(null)}
        >
          <ThemedText style={styles.resourceName}>{item.name}</ThemedText>
          <Switch
            value={isEnabled}
            onValueChange={() => {}} // 禁用Switch的直接交互
            trackColor={{ false: "#767577", true: "#007AFF" }}
            thumbColor={isEnabled ? "#ffffff" : "#f4f3f4"}
            pointerEvents="none"
          />
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <SettingsSection focusable onFocus={handleSectionFocus} onBlur={handleSectionBlur}>
      <ThemedText style={styles.sectionTitle}>播放源配置</ThemedText>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" />
          <ThemedText style={styles.loadingText}>加载中...</ThemedText>
        </View>
      )}

      {error && <ThemedText style={styles.errorText}>{error}</ThemedText>}

      {!loading && !error && resources.length > 0 && (
        <FlatList
          data={resources}
          renderItem={renderResourceItem}
          keyExtractor={(item) => item.key}
          numColumns={3}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.flatListContainer}
          scrollEnabled={false}
        />
      )}
    </SettingsSection>
  );
};

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  loadingText: {
    marginLeft: 8,
    color: "#888",
  },
  errorText: {
    color: "#ff4444",
    fontSize: 14,
    textAlign: "center",
    padding: 16,
  },
  flatListContainer: {
    gap: 12,
  },
  row: {
    justifyContent: "flex-start",
  },
  resourceItem: {
    width: "32%",
    marginHorizontal: 6,
    marginVertical: 6,
    borderRadius: 8,
    overflow: "hidden",
    justifyContent: "flex-start",
  },
  resourcePressable: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#2a2a2a",
    borderRadius: 8,
    minHeight: 56,
  },
  resourceFocused: {
    backgroundColor: "#3a3a3c",
    borderWidth: 2,
    borderColor: "#007AFF",
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5,
  },
  resourceName: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
});
