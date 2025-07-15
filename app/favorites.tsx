import React, { useEffect } from "react";
import { View, FlatList, StyleSheet, ActivityIndicator, Image, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import useFavoritesStore from "@/stores/favoritesStore";
import { Favorite } from "@/services/storage";

export default function FavoritesScreen() {
  const router = useRouter();
  const { favorites, loading, error, fetchFavorites } = useFavoritesStore();

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const handlePress = (favorite: Favorite & { key: string }) => {
    const [source, id] = favorite.key.split("+");
    router.push({
      pathname: "/detail",
      params: { q: favorite.title, source, id },
    });
  };

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="subtitle">{error}</ThemedText>
      </ThemedView>
    );
  }

  if (favorites.length === 0) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="subtitle">暂无收藏</ThemedText>
      </ThemedView>
    );
  }

  const renderItem = ({ item }: { item: Favorite & { key: string } }) => (
    <Pressable onPress={() => handlePress(item)} style={styles.itemContainer}>
      <Image source={{ uri: item.poster }} style={styles.poster} />
      <View style={styles.infoContainer}>
        <ThemedText style={styles.title} numberOfLines={1}>
          {item.title}
        </ThemedText>
        <ThemedText style={styles.year}>{item.year}</ThemedText>
      </View>
    </Pressable>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={styles.headerContainer}>
        <ThemedText style={styles.headerTitle}>我的收藏</ThemedText>
      </View>
      <FlatList
        data={favorites}
        renderItem={renderItem}
        keyExtractor={(item) => item.key}
        numColumns={3}
        contentContainerStyle={styles.list}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 40,
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "bold",
    paddingTop: 16,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  list: {
    padding: 10,
  },
  itemContainer: {
    flex: 1,
    margin: 10,
    alignItems: "center",
  },
  poster: {
    width: 120,
    height: 180,
    borderRadius: 8,
  },
  infoContainer: {
    marginTop: 8,
    alignItems: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
  },
  year: {
    fontSize: 14,
    color: "#888",
  },
});
