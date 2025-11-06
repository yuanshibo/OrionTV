
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from './ThemedText';
import { api, SearchResult } from '@/services/api';
import VideoCard from './VideoCard';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { getCommonResponsiveStyles } from '@/utils/ResponsiveStyles';

interface RelatedSeriesProps {
  title: string;
}

const RelatedSeries: React.FC<RelatedSeriesProps> = ({ title }) => {
  const [related, setRelated] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { spacing } = responsiveConfig;
  
  const styles = StyleSheet.create({
    container: {
      marginTop: spacing,
      paddingBottom: spacing * 2,
    },
    title: {
      fontSize: responsiveConfig.deviceType === 'mobile' ? 16 : responsiveConfig.deviceType === 'tablet' ? 18 : 20,
      fontWeight: 'bold',
      marginBottom: spacing / 2,
      paddingHorizontal: spacing,
    },
    list: {
      paddingLeft: spacing,
    },
    itemContainer: {
      marginRight: spacing,
    },
  });


  useEffect(() => {
    if (title) {
      setLoading(true);
      api.searchVideos(title)
        .then(response => {
          // Filter out the current item from the related results and take the first 10
          const filteredResults = response.results.filter(item => item.title !== title).slice(0, 10);
          setRelated(filteredResults);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [title]);

  const renderItem = ({ item }: { item: SearchResult; index: number }) => (
    <View style={styles.itemContainer}>
        <VideoCard
            id={item.id.toString()}
            source={item.source}
            title={item.title}
            poster={item.poster}
            year={item.year}
            sourceName={item.source_name}
            api={api}
        />
    </View>
  );

  if (loading) {
    return (
        <View style={[commonStyles.container, styles.container, commonStyles.center]}>
            <ActivityIndicator />
        </View>
    );
  }

  if (related.length === 0) {
    return null; // Don't render anything if there are no related series
  }

  return (
    <View style={styles.container}>
      <ThemedText style={styles.title}>相关剧集</ThemedText>
      <FlatList
        horizontal
        data={related}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      />
    </View>
  );
};

export default RelatedSeries;
