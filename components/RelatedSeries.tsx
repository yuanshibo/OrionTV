import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { ThemedText } from './ThemedText';
import { api, DoubanRecommendationItem, SearchResult } from '@/services/api';
import { fetchSearchResults } from '@/services/searchService';
import VideoCard from './VideoCard';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { getCommonResponsiveStyles } from '@/utils/ResponsiveStyles';
import { getSearchTermFromTitle } from '@/utils/searchUtils';
import { requestTVFocus } from '@/utils/tvUtils';

interface RelatedSeriesProps {
  title: string;
  autoFocus?: boolean;
}

const RelatedSeriesComponent: React.FC<RelatedSeriesProps> = ({ title, autoFocus = false }) => {
  const [related, setRelated] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const firstCardRef = useRef<View>(null);
  const [listTitle, setListTitle] = useState('相关剧集');

  const responsiveConfig = useResponsiveLayout();
  const commonStyles = useMemo(() => getCommonResponsiveStyles(responsiveConfig), [responsiveConfig]);
  const { spacing } = responsiveConfig;

  const styles = useMemo(() => StyleSheet.create({
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
  }), [spacing, responsiveConfig.deviceType]);

  useEffect(() => {
    if (!loading && related.length > 0 && autoFocus) {
      const timer = setTimeout(() => {
        requestTVFocus(firstCardRef);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading, related, autoFocus]);

  useEffect(() => {
    if (title) {
      setLoading(true);
      const searchTerm = getSearchTermFromTitle(title);

      fetchSearchResults(searchTerm)
        .then(results => {
          const filteredResults = results.filter(item => item.title !== title);
          if (filteredResults.length > 0) {
            setRelated(filteredResults.slice(0, 10));
            setListTitle('相关剧集');
            setLoading(false);
          } else {
            setListTitle('猜你喜欢');
            api.discover(1, 25)
              .then(discoverResponse => {
                const discoverResults: SearchResult[] = discoverResponse.list.map((item: DoubanRecommendationItem, index) => ({
                  id: index, // Use index as a fallback ID
                  title: item.title,
                  poster: item.poster,
                  year: item.year || '',
                  source: item.url || item.id || '',
                  source_name: '推荐',
                  episodes: [],
                  class: item.type || '',
                } as SearchResult));
                setRelated(discoverResults);
              })
              .catch(console.error)
              .finally(() => setLoading(false));
          }
        })
        .catch(error => {
          console.error(error)
          setLoading(false);
        });
    }
  }, [title]);

  const renderItem = useCallback(({ item, index }: { item: SearchResult; index: number }) => (
    <View style={styles.itemContainer}>
      <VideoCard
        ref={index === 0 ? firstCardRef : undefined}
        id={item.id.toString()}
        source={item.source}
        title={item.title}
        poster={item.poster}
        year={item.year}
        sourceName={item.source_name}
        api={api}
      />
    </View>
  ), [styles.itemContainer]);

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
      <ThemedText style={styles.title}>{listTitle}</ThemedText>
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

const RelatedSeries = React.memo(RelatedSeriesComponent);
RelatedSeries.displayName = 'RelatedSeries';

export default RelatedSeries;
