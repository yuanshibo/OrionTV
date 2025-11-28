import React, { memo, useCallback, useState } from 'react';
import { View, Image, ScrollView, FlatList, useWindowDimensions, findNodeHandle } from 'react-native';
import { EpisodeButton } from '@/components/detail/EpisodeList';
import { ThemedText } from '@/components/ThemedText';
import { StyledButton } from '@/components/StyledButton';
import { SourceList } from '@/components/detail/SourceList';
import RelatedSeries from '@/components/RelatedSeries';
import { EpisodeRangeSelector } from '@/components/detail/EpisodeRangeSelector';
import { Heart } from 'lucide-react-native';

interface DetailTVViewProps {
  detail: any;
  searchResults: any[];
  allSourcesLoaded: boolean;
  isFavorited: boolean;
  toggleFavorite: () => void;
  handlePrimaryPlay: () => void;
  handlePlay: (episodeIndex: number, position?: number) => void;
  playButtonLabel: string;
  isPlayDisabled: boolean;
  setDetail: (detail: any) => void;
  dynamicStyles: any;
  colors: any;
  deviceType: 'mobile' | 'tablet' | 'tv';
}

const TVTopInfo = memo(({
  detail,
  isFavorited,
  toggleFavorite,
  handlePrimaryPlay,
  playButtonLabel,
  isPlayDisabled,
  dynamicStyles,
  colors,
  nextFocusDown
}: any) => {
  return (
    <View style={dynamicStyles.topContainer}>
      <Image source={{ uri: detail.poster }} style={dynamicStyles.poster} />
      <View style={dynamicStyles.infoContainer}>
        <View style={dynamicStyles.titleContainer}>
          <ThemedText style={dynamicStyles.title} numberOfLines={1} ellipsizeMode="tail">
            {detail.title}
          </ThemedText>
          <StyledButton onPress={toggleFavorite} variant="ghost" style={dynamicStyles.favoriteButton}>
            <Heart
              size={24}
              color={isFavorited ? colors.tint : colors.icon}
              fill={isFavorited ? colors.tint : 'transparent'}
            />
          </StyledButton>
        </View>
        <StyledButton
          onPress={handlePrimaryPlay}
          style={dynamicStyles.playButton}
          text={playButtonLabel}
          textStyle={dynamicStyles.playButtonText}
          disabled={isPlayDisabled}
          hasTVPreferredFocus={true}
          nextFocusDown={nextFocusDown}
        />
        <View style={dynamicStyles.metaContainer}>
          <ThemedText style={dynamicStyles.metaText}>{detail.year}</ThemedText>
          <ThemedText style={dynamicStyles.metaText}>{detail.type_name}</ThemedText>
        </View>

        <ScrollView
          style={dynamicStyles.descriptionScrollView}
          showsVerticalScrollIndicator={false}
          nextFocusDown={nextFocusDown}
        >
          <ThemedText style={dynamicStyles.description}>{detail.desc}</ThemedText>
        </ScrollView>
      </View>
    </View>
  );
});

TVTopInfo.displayName = 'TVTopInfo';

export const DetailTVView: React.FC<DetailTVViewProps> = memo(({
  detail,
  searchResults,
  allSourcesLoaded,
  isFavorited,
  toggleFavorite,
  handlePrimaryPlay,
  handlePlay,
  playButtonLabel,
  isPlayDisabled,
  setDetail,
  dynamicStyles,
  colors,
  deviceType,
}) => {
  const [currentRange, setCurrentRange] = useState(0);
  const chunkSize = 10; // Changed to 10
  const episodeListRef = React.useRef<FlatList>(null);
  const { width } = useWindowDimensions();

  const [firstSourceTag, setFirstSourceTag] = useState<number | null>(null);
  const [targetEpisodeTag, setTargetEpisodeTag] = useState<number | null>(null);
  const episodeRefs = React.useRef<Map<number, any>>(new Map());

  const setFirstSourceRef = useCallback((node: any) => {
    if (node) {
      setFirstSourceTag(findNodeHandle(node));
    }
  }, []);

  // Show ALL episodes
  const episodes = detail.episodes || [];

  // Calculate item width to fit 10 items.
  // Assuming some padding (e.g. 40px total horizontal padding).
  const padding = 40;
  const itemWidth = (width - padding) / 10;

  const updateTargetEpisode = useCallback((index: number) => {
    const node = episodeRefs.current.get(index);
    if (node) {
      setTargetEpisodeTag(findNodeHandle(node));
    }
  }, []);

  const handleRangeSelect = useCallback((index: number) => {
    setCurrentRange(index);
    const startIndex = index * chunkSize;
    // Scroll episode list to the start of the selected range
    episodeListRef.current?.scrollToIndex({ index: startIndex, animated: true, viewPosition: 0 });
    // Try to update target to the start of the range (if rendered)
    updateTargetEpisode(startIndex);
  }, [chunkSize, updateTargetEpisode]);

  const handleEpisodeFocus = useCallback((index: number) => {
    const newRange = Math.floor(index / chunkSize);
    if (newRange !== currentRange) {
      setCurrentRange(newRange);
    }
    // Update the target tag for SourceList -> EpisodeList navigation
    updateTargetEpisode(index);

    // Use requestAnimationFrame for smoother and faster interaction with native focus
    // forcing the focused item to align to the left immediately
    requestAnimationFrame(() => {
      episodeListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
    });
  }, [chunkSize, currentRange, updateTargetEpisode]);

  const renderEpisodeItem = useCallback(({ item, index }: { item: any, index: number }) => {
    return (
      <View style={{ padding: 4, width: itemWidth }}>
        <EpisodeButton
          ref={(node) => {
            if (node) {
              episodeRefs.current.set(index, node);
              // If this is the first episode and no target is set, set it
              if (index === 0 && targetEpisodeTag === null) {
                setTargetEpisodeTag(findNodeHandle(node));
              }
            } else {
              episodeRefs.current.delete(index);
            }
          }}
          index={index}
          onPlay={handlePlay}
          style={[dynamicStyles.episodeButton, { minHeight: 50 }]}
          textStyle={[dynamicStyles.episodeButtonText, { fontSize: 16 }]}
          onFocus={() => handleEpisodeFocus(index)}
        />
      </View>
    );
  }, [handlePlay, dynamicStyles, handleEpisodeFocus, itemWidth, targetEpisodeTag]);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={dynamicStyles.scrollContainer}>
      <TVTopInfo
        detail={detail}
        isFavorited={isFavorited}
        toggleFavorite={toggleFavorite}
        handlePrimaryPlay={handlePrimaryPlay}
        playButtonLabel={playButtonLabel}
        isPlayDisabled={isPlayDisabled}
        dynamicStyles={dynamicStyles}
        colors={colors}
        nextFocusDown={firstSourceTag}
      />
      <View style={dynamicStyles.bottomContainer}>
        <SourceList
          searchResults={searchResults}
          currentSource={detail.source}
          onSelect={setDetail}
          loading={!allSourcesLoaded}
          deviceType={deviceType}
          styles={dynamicStyles}
          colors={colors}
          setFirstSourceRef={setFirstSourceRef}
          nextFocusDown={targetEpisodeTag}
        />

        {episodes.length > 0 && (
          <View>
            <ThemedText style={dynamicStyles.episodesTitle}>播放列表</ThemedText>

            {/* Episode List (Horizontal) */}
            <View style={{ height: 60, marginBottom: 0 }}>
              <FlatList
                ref={episodeListRef}
                data={episodes}
                horizontal
                showsHorizontalScrollIndicator={false}
                renderItem={renderEpisodeItem}
                keyExtractor={(item, index) => `episode-${index}`}
                contentContainerStyle={{ paddingHorizontal: 0 }}
                getItemLayout={(data, index) => (
                  { length: itemWidth, offset: itemWidth * index, index }
                )}
                removeClippedSubviews={false}
                windowSize={10}
                initialNumToRender={10}
                ListFooterComponent={<View style={{ width: itemWidth * 9 }} />}
              />
            </View>

            {/* Range Selector (Bottom) */}
            {episodes.length > chunkSize && (
              <EpisodeRangeSelector
                totalEpisodes={episodes.length}
                currentRange={currentRange}
                onRangeSelect={handleRangeSelect}
                chunkSize={chunkSize}
                styles={dynamicStyles}
                colors={colors}
              />
            )}
          </View>
        )}

        <RelatedSeries title={detail.title} />
      </View>
    </ScrollView>
  );
});

DetailTVView.displayName = 'DetailTVView';
