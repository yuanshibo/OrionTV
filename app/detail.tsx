import React, { useEffect } from "react";
import { View, Text, StyleSheet, Image, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { StyledButton } from "@/components/StyledButton";
import VideoLoadingAnimation from "@/components/VideoLoadingAnimation";
import useDetailStore from "@/stores/detailStore";
import { FontAwesome } from "@expo/vector-icons";

export default function DetailScreen() {
  const { q, source, id } = useLocalSearchParams<{ q: string; source?: string; id?: string }>();
  const router = useRouter();

  const {
    detail,
    searchResults,
    loading,
    error,
    allSourcesLoaded,
    init,
    setDetail,
    abort,
    isFavorited,
    toggleFavorite,
  } = useDetailStore();

  useEffect(() => {
    if (q) {
      init(q, source, id);
    }
    return () => {
      abort();
    };
  }, [abort, init, q, source, id]);

  const handlePlay = (episodeIndex: number) => {
    if (!detail) return;
    abort(); // Cancel any ongoing fetches
    router.push({
      pathname: "/play",
      params: {
        // Pass necessary identifiers, the rest will be in the store
        q: detail.title,
        source: detail.source,
        id: detail.id.toString(),
        episodeIndex: episodeIndex.toString(),
      },
    });
  };

  if (loading) {
    return <VideoLoadingAnimation showProgressBar={false} />;
  }

  if (error) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="subtitle" style={styles.text}>
          {error}
        </ThemedText>
      </ThemedView>
    );
  }

  if (!detail) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="subtitle">未找到详情信息</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView>
        <View style={styles.topContainer}>
          <Image source={{ uri: detail.poster }} style={styles.poster} />
          <View style={styles.infoContainer}>
            <ThemedText style={styles.title} numberOfLines={1}>
              {detail.title}
            </ThemedText>
            <View style={styles.metaContainer}>
              <ThemedText style={styles.metaText}>{detail.year}</ThemedText>
              <ThemedText style={styles.metaText}>{detail.type_name}</ThemedText>
            </View>
            {/* <Pressable onPress={toggleFavorite} style={styles.favoriteButton}>
              <FontAwesome name={isFavorited ? "star" : "star-o"} size={24} color={isFavorited ? "#FFD700" : "#ccc"} />
              <ThemedText style={styles.favoriteButtonText}>{isFavorited ? "已收藏" : "收藏"}</ThemedText>
            </Pressable> */}
            <ScrollView style={styles.descriptionScrollView}>
              <ThemedText style={styles.description}>{detail.desc}</ThemedText>
            </ScrollView>
          </View>
        </View>

        <View style={styles.bottomContainer}>
          <View style={styles.sourcesContainer}>
            <View style={styles.sourcesTitleContainer}>
              <ThemedText style={styles.sourcesTitle}>选择播放源 共 {searchResults.length} 个</ThemedText>
              {!allSourcesLoaded && <ActivityIndicator style={{ marginLeft: 10 }} />}
            </View>
            <View style={styles.sourceList}>
              {searchResults.map((item, index) => (
                <StyledButton
                  key={index}
                  onPress={() => setDetail(item)}
                  hasTVPreferredFocus={index === 0}
                  isSelected={detail?.source === item.source}
                  style={styles.sourceButton}
                >
                  <ThemedText style={styles.sourceButtonText}>{item.source_name}</ThemedText>
                  {item.episodes.length > 1 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {item.episodes.length > 99 ? "99+" : `${item.episodes.length}`} 集
                      </Text>
                    </View>
                  )}
                  {item.resolution && (
                    <View style={[styles.badge, { backgroundColor: "#28a745" }]}>
                      <Text style={styles.badgeText}>{item.resolution}</Text>
                    </View>
                  )}
                </StyledButton>
              ))}
            </View>
          </View>
          <View style={styles.episodesContainer}>
            <ThemedText style={styles.episodesTitle}>播放列表</ThemedText>
            <ScrollView contentContainerStyle={styles.episodeList}>
              {detail.episodes.map((episode, index) => (
                <StyledButton
                  key={index}
                  style={styles.episodeButton}
                  onPress={() => handlePlay(index)}
                  text={`第 ${index + 1} 集`}
                  textStyle={styles.episodeButtonText}
                />
              ))}
            </ScrollView>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  topContainer: {
    flexDirection: "row",
    padding: 20,
  },
  text: {
    padding: 20,
    textAlign: "center",
  },
  poster: {
    width: 200,
    height: 300,
    borderRadius: 8,
  },
  infoContainer: {
    flex: 1,
    marginLeft: 20,
    justifyContent: "flex-start",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 10,
    paddingTop: 20,
  },
  metaContainer: {
    flexDirection: "row",
    marginBottom: 10,
  },
  metaText: {
    color: "#aaa",
    marginRight: 10,
    fontSize: 14,
  },
  descriptionScrollView: {
    height: 150, // Constrain height to make it scrollable
  },
  description: {
    fontSize: 14,
    color: "#ccc",
    lineHeight: 22,
  },
  favoriteButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    padding: 10,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 5,
    alignSelf: "flex-start",
  },
  favoriteButtonText: {
    marginLeft: 8,
    fontSize: 16,
  },
  bottomContainer: {
    paddingHorizontal: 20,
  },
  sourcesContainer: {
    marginTop: 20,
  },
  sourcesTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  sourcesTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  sourceList: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  sourceButton: {
    margin: 8,
  },
  sourceButtonText: {
    color: "white",
    fontSize: 16,
  },
  badge: {
    backgroundColor: "red",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  episodesContainer: {
    marginTop: 20,
  },
  episodesTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
  episodeList: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  episodeButton: {
    margin: 5,
  },
  episodeButtonText: {
    color: "white",
  },
});
