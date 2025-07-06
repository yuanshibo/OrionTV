import React, { useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, FlatList, Pressable, Dimensions } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { api } from '@/services/api';
import VideoCard from '@/components/VideoCard.tv';
import { useFocusEffect, useRouter } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Search, Settings } from 'lucide-react-native';
import { SettingsModal } from '@/components/SettingsModal';
import useHomeStore, { RowItem, Category } from '@/stores/homeStore';
import { useSettingsStore } from '@/stores/settingsStore';

const NUM_COLUMNS = 5;
const { width } = Dimensions.get('window');
const ITEM_WIDTH = width / NUM_COLUMNS - 24;

export default function HomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const flatListRef = useRef<FlatList>(null);

  const {
    categories,
    selectedCategory,
    contentData,
    loading,
    loadingMore,
    error,
    fetchInitialData,
    loadMoreData,
    selectCategory,
    refreshPlayRecords,
  } = useHomeStore();

  const showSettingsModal = useSettingsStore(state => state.showModal);

  useFocusEffect(
    useCallback(() => {
      refreshPlayRecords();
    }, [refreshPlayRecords])
  );

  useEffect(() => {
    fetchInitialData();
    flatListRef.current?.scrollToOffset({ animated: false, offset: 0 });
  }, [selectedCategory, fetchInitialData]);

  const handleCategorySelect = (category: Category) => {
    selectCategory(category);
  };

  const renderCategory = ({ item }: { item: Category }) => {
    const isSelected = selectedCategory?.title === item.title;
    return (
      <Pressable
        style={({ focused }) => [
          styles.categoryButton,
          isSelected && styles.categoryButtonSelected,
          focused && styles.categoryButtonFocused,
        ]}
        onPress={() => handleCategorySelect(item)}
      >
        <ThemedText style={[styles.categoryText, isSelected && styles.categoryTextSelected]}>{item.title}</ThemedText>
      </Pressable>
    );
  };

  const renderContentItem = ({ item }: { item: RowItem }) => (
    <View style={styles.itemContainer}>
      <VideoCard
        id={item.id}
        source={item.source}
        title={item.title}
        poster={item.poster}
        year={item.year}
        rate={item.rate}
        progress={item.progress}
        episodeIndex={item.episodeIndex}
        sourceName={item.sourceName}
        totalEpisodes={item.totalEpisodes}
        api={api}
        onRecordDeleted={fetchInitialData} // For "Recent Plays"
      />
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return <ActivityIndicator style={{ marginVertical: 20 }} size="large" />;
  };

  return (
    <ThemedView style={styles.container}>
      {/* 顶部导航 */}
      <View style={styles.headerContainer}>
        <ThemedText style={styles.headerTitle}>首页</ThemedText>
        <View style={styles.rightHeaderButtons}>
          <Pressable
            style={({ focused }) => [styles.searchButton, focused && styles.searchButtonFocused]}
            onPress={() => router.push({ pathname: '/search' })}
          >
            <Search color={colorScheme === 'dark' ? 'white' : 'black'} size={24} />
          </Pressable>
          <Pressable
            style={({ focused }) => [styles.searchButton, focused && styles.searchButtonFocused]}
            onPress={showSettingsModal}
          >
            <Settings color={colorScheme === 'dark' ? 'white' : 'black'} size={24} />
          </Pressable>
        </View>
      </View>

      {/* 分类选择器 */}
      <View style={styles.categoryContainer}>
        <FlatList
          data={categories}
          renderItem={renderCategory}
          keyExtractor={item => item.title}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryListContent}
        />
      </View>

      {/* 内容网格 */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" />
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <ThemedText type="subtitle" style={{ padding: 10 }}>
            {error}
          </ThemedText>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={contentData}
          renderItem={renderContentItem}
          keyExtractor={(item, index) => `${item.source}-${item.id}-${index}`}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={styles.listContent}
          onEndReached={loadMoreData}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <ThemedText>该分类下暂无内容</ThemedText>
            </View>
          }
        />
      )}
      <SettingsModal />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 40,
  },
  centerContainer: {
    flex: 1,
    paddingTop: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Header
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    paddingTop: 16,
  },
  rightHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchButton: {
    padding: 10,
    borderRadius: 30,
    marginLeft: 10,
  },
  searchButtonFocused: {
    backgroundColor: '#007AFF',
    transform: [{ scale: 1.1 }],
  },
  // Category Selector
  categoryContainer: {
    paddingBottom: 10,
  },
  categoryListContent: {
    paddingHorizontal: 16,
  },
  categoryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  categoryButtonSelected: {
    backgroundColor: '#007AFF', // A bright blue for selected state
  },
  categoryButtonFocused: {
    backgroundColor: '#0056b3', // A darker blue for focused state
    elevation: 5,
  },
  categoryText: {
    fontSize: 16,
    fontWeight: '500',
  },
  categoryTextSelected: {
    color: '#FFFFFF',
  },
  // Content Grid
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  itemContainer: {
    margin: 8,
    width: ITEM_WIDTH,
    alignItems: 'center',
  },
});
