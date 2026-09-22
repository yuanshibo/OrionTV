import React, { useMemo } from 'react';
import { View, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { FlashList } from "@shopify/flash-list";
import { ThemedText } from "@/components/ThemedText";
import VideoCard from "@/components/VideoCard";
import { api, SearchResult } from "@/services/api";
import { FlashListOptimizer } from '@/utils/FlashListOptimizer';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { getSearchTermFromTitle } from "@/utils/searchUtils";
import Logger from "@/utils/Logger";

const logger = Logger.withTag("RelatedSeries");

interface RelatedSeriesProps {
  title: string;
  onFocus?: (item: any) => void;
  autoFocus?: boolean;
  onItemPress?: (item: SearchResult) => void;
  hideTitle?: boolean;
  showEmptyMessage?: boolean;
  firstItemRef?: React.RefObject<View | null>;
}

const normalizeTitle = (s: string): string => {
  return s.toLowerCase().replace(/[\s\-_:：·()（）\[\]【】]/g, '');
};

const RelatedSeries: React.FC<RelatedSeriesProps> = ({
  title,
  onFocus,
  autoFocus,
  onItemPress,
  hideTitle = false,
  showEmptyMessage = false,
  firstItemRef,
}) => {
  const [related, setRelated] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(true);
  const { deviceType } = useResponsiveLayout();

  React.useEffect(() => {
    let isCancelled = false;

    const fetchRelated = async () => {
      try {
        setLoading(true);
        const rootTitle = getSearchTermFromTitle(title).trim();
        const searchKeyword = rootTitle.length >= 2 ? rootTitle : title.trim();

        logger.debug("Fetching related series for:", title, "-> keyword:", searchKeyword);

        // 1. 优先使用提取出的主剧名进行搜索
        const { results } = await api.searchVideos(searchKeyword);
        if (isCancelled) return;

        const currentNorm = normalizeTitle(title);
        const searchNorm = normalizeTitle(searchKeyword);

        // 2. 去重与当前剧目过滤
        const seen = new Set<string>();
        const filtered: SearchResult[] = [];

        for (const item of results) {
          if (!item.title) continue;
          const itemNorm = normalizeTitle(item.title);

          // 排除当前正在查看的同一部剧
          if (itemNorm === currentNorm) {
            continue;
          }

          // 避免多源造成的同名重复霸榜
          if (!seen.has(itemNorm)) {
            seen.add(itemNorm);
            filtered.push(item);
          }
        }

        // 3. 排序：同系列（包含或以根剧名开头）优先排在最前
        filtered.sort((a, b) => {
          const aNorm = normalizeTitle(a.title);
          const bNorm = normalizeTitle(b.title);

          const aStarts = aNorm.startsWith(searchNorm);
          const bStarts = bNorm.startsWith(searchNorm);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;

          const aIncludes = aNorm.includes(searchNorm);
          const bIncludes = bNorm.includes(searchNorm);
          if (aIncludes && !bIncludes) return -1;
          if (!aIncludes && bIncludes) return 1;

          return 0;
        });

        // 4. 兜底：如果使用提取根词未能搜索出其他结果，且根词与原标题不同，尝试直接搜索原标题
        if (filtered.length === 0 && searchKeyword !== title.trim()) {
          const fallbackRes = await api.searchVideos(title.trim());
          if (isCancelled) return;
          const fallbackFiltered: SearchResult[] = [];
          for (const item of fallbackRes.results) {
            if (!item.title) continue;
            const itemNorm = normalizeTitle(item.title);
            if (itemNorm !== currentNorm && !seen.has(itemNorm)) {
              seen.add(itemNorm);
              fallbackFiltered.push(item);
            }
          }
          setRelated(fallbackFiltered.slice(0, 15));
        } else {
          setRelated(filtered.slice(0, 15));
        }
      } catch (error) {
        logger.error('Failed to fetch related series:', error);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    if (title) {
      fetchRelated();
    }

    return () => {
      isCancelled = true;
    };
  }, [title]);

  const renderItem = React.useCallback(
    ({ item, index }: { item: SearchResult; index: number }) => (
      <VideoCard
        ref={index === 0 ? firstItemRef : undefined}
        id={String(item.id)}
        source={item.source}
        title={item.title}
        poster={item.poster}
        year={item.year}
        sourceName={item.source_name}
        mediaType={item.type_name || item.type}
        api={api}
        index={index}
        onFocus={() => onFocus?.(item)}
        {...(onItemPress ? { onPress: () => onItemPress(item) } : {})}
        hasTVPreferredFocus={autoFocus && index === 0}
      />
    ),
    [onFocus, autoFocus, onItemPress, firstItemRef]
  );

  const flashListConfig = useMemo(() => 
    FlashListOptimizer.getHorizontalListConfig(deviceType, 170),
    [deviceType]
  );

  if (loading) {
    if (showEmptyMessage) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      );
    }
    return null;
  }

  if (related.length === 0) {
    if (showEmptyMessage) {
      return (
        <View style={styles.centerContainer}>
          <ThemedText style={styles.emptyText}>暂无相关剧集推荐</ThemedText>
        </View>
      );
    }
    return null;
  }

  const FlashListAny = FlashList as any;

  return (
    <View style={styles.container}>
      {!hideTitle && <ThemedText style={styles.title}>相关推荐</ThemedText>}
      <FlashListAny
        horizontal
        data={related}
        renderItem={renderItem}
        keyExtractor={(item: SearchResult, index: number) => `related-${item.source}-${item.id}-${index}`}
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
  centerContainer: {
    paddingVertical: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 15,
  },
});

export default React.memo(RelatedSeries);
