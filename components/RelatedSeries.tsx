import React, { useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { FlashList } from "@shopify/flash-list";
import { ThemedText } from "@/components/ThemedText";
import VideoCard from "@/components/VideoCard.tv";
import { api } from "@/services/api";
import { FlashListOptimizer } from '@/utils/FlashListOptimizer';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

interface RelatedSeriesProps {
  title: string;
  onFocus?: (item: any) => void;
}

const RelatedSeries: React.FC<RelatedSeriesProps> = ({ title, onFocus }) => {
  const [related, setRelated] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const { deviceType } = useResponsiveLayout();

  React.useEffect(() => {
    const fetchRelated = async () => {
      try {
        setLoading(true);
        const { results } = await api.searchVideos(title);
        // Filter out the current one if possible, or just limit
        setRelated(results.slice(0, 10));
      } catch (error) {
        console.error('Failed to fetch related series:', error);
      } finally {
        setLoading(false);
      }
    };

    if (title) {
      fetchRelated();
    }
  }, [title]);

  const renderItem = React.useCallback(
    ({ item }: { item: any }) => (
      <VideoCard
        {...item}
        onFocus={() => onFocus?.(item)}
      />
    ),
    [onFocus]
  );

  const flashListConfig = useMemo(() => 
    FlashListOptimizer.getHorizontalListConfig(deviceType, 170),
    [deviceType]
  );

  if (loading || related.length === 0) {
    return null;
  }

  const FlashListAny = FlashList as any;

  return (
    <View style={styles.container}>
      <ThemedText style={styles.title}>相关推荐</ThemedText>
      <FlashListAny
        horizontal
        data={related}
        renderItem={renderItem}
        keyExtractor={(item: any, index: number) => index.toString()}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        {...flashListConfig}
        removeClippedSubviews={Platform.OS === 'android'}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    marginBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    marginLeft: 10,
  },
  list: {
    paddingLeft: 10,
  },
});

export default React.memo(RelatedSeries);
