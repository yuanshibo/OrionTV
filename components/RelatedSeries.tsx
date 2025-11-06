
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { ThemedText } from './ThemedText';
import { api, SearchResult } from '@/services/api';
import { fetchSearchResults } from '@/services/searchService';
import VideoCard from './VideoCard';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { getCommonResponsiveStyles } from '@/utils/ResponsiveStyles';

interface RelatedSeriesProps {
  title: string;
}

const RelatedSeries: React.FC<RelatedSeriesProps> = ({ title }) => {
  const [related, setRelated] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);

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

      let searchTerm = title;
      const isPureChinese = /^[\u4e00-\u9fa5]+$/.test(title);

      if (isPureChinese) {
        const suffixMatch = title.match(/^(.*?)(?:之.+|第[一二三四五六七八九十]+[季部]|粤语|国语|剧场版|预告片)$/);
        if (suffixMatch && suffixMatch[1] && suffixMatch[1].length >= 2) {
          searchTerm = suffixMatch[1];
        }
      } else {
        const chinesePartMatch = title.match(/^[\u4e00-\u9fa5]+/);
        if (chinesePartMatch && chinesePartMatch[0]) {
          searchTerm = chinesePartMatch[0];
        }
      }

      fetchSearchResults(searchTerm)
        .then(results => {
          const filteredResults = results.filter(item => item.title !== title);
          setRelated(filteredResults.slice(0, 10));
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
    return null;
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
