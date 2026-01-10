import React, { memo, useCallback, useState } from 'react';
import { View, ScrollView, useWindowDimensions, findNodeHandle } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { SourceList } from '@/components/detail/SourceList';
import RelatedSeries from '@/components/RelatedSeries';
import { EpisodeRangeSelector } from '@/components/detail/EpisodeRangeSelector';
import { PureDynamicBackground } from '@/components/DynamicBackground';
import { TVTopInfo } from '@/components/detail/TVTopInfo';
import { EpisodeHorizontalList, EpisodeHorizontalListRef } from '@/components/detail/EpisodeHorizontalList';

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

// Extracted content component to prevent re-renders when background changes
const DetailTVContent = memo(({
  dynamicStyles,
  detail,
  isFavorited,
  toggleFavorite,
  handlePrimaryPlay,
  playButtonLabel,
  isPlayDisabled,
  colors,
  firstSourceTag,
  handleTVTopInfoFocus,
  searchResults,
  deviceType,
  allSourcesLoaded,
  setDetail,
  setFirstSourceRef,
  targetEpisodeTag,
  episodes,
  itemWidth,
  handlePlay,
  handleEpisodeFocus,
  firstRangeTag,
  episodeListRef,
  setTargetEpisodeTag,
  chunkSize,
  currentRange,
  handleRangeSelect,
  focusOffset,
  handleSetFirstRangeRef,
  handleRelatedSeriesFocus
}: any) => {
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
        onFocus={handleTVTopInfoFocus}
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
            <EpisodeHorizontalList
              ref={episodeListRef}
              episodes={episodes}
              itemWidth={itemWidth}
              handlePlay={handlePlay}
              handleEpisodeFocus={handleEpisodeFocus}
              firstRangeTag={firstRangeTag}
              dynamicStyles={dynamicStyles}
              setTargetEpisodeTag={setTargetEpisodeTag}
            />

            {/* Range Selector (Bottom) */}
            {episodes.length > chunkSize && (
              <EpisodeRangeSelector
                totalEpisodes={episodes.length}
                currentRange={currentRange}
                onRangeSelect={handleRangeSelect}
                chunkSize={chunkSize}
                styles={dynamicStyles}
                colors={colors}
                focusOffset={focusOffset}
                setFirstRangeRef={handleSetFirstRangeRef}
                nextFocusUp={targetEpisodeTag}
              />
            )}
          </View>
        )}

        <RelatedSeries
          title={detail.title}
          onFocus={handleRelatedSeriesFocus}
        />
      </View>
    </ScrollView>
  );
});

DetailTVContent.displayName = 'DetailTVContent';

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
  const episodeListRef = React.useRef<EpisodeHorizontalListRef>(null);
  const { width } = useWindowDimensions();
  const [overridePoster, setOverridePoster] = useState<string | null>(null);

  const activePoster = overridePoster || detail.poster;

  const [firstSourceTag, setFirstSourceTag] = useState<number | null>(null);
  const [targetEpisodeTag, setTargetEpisodeTag] = useState<number | null>(null);
  const [firstRangeTag, setFirstRangeTag] = useState<number | null>(null);

  const setFirstSourceRef = useCallback((node: any) => {
    if (node) {
      setFirstSourceTag(findNodeHandle(node));
    }
  }, []);

  const handleSetFirstRangeRef = useCallback((node: any) => {
    if (node) {
      setFirstRangeTag(findNodeHandle(node));
    }
  }, []);

  // Show ALL episodes
  const episodes = detail.episodes || [];

  // Calculate item width to fit 10 items.
  // Assuming some padding (e.g. 40px total horizontal padding).
  const padding = 40;
  const itemWidth = (width - padding) / 10;
  const focusOffset = itemWidth * 0.5;
  const updateTargetEpisode = useCallback((index: number) => {
    episodeListRef.current?.updateTargetEpisode(index);
  }, []);

  const handleRangeSelect = useCallback((index: number) => {
    if (index === currentRange) return;

    setCurrentRange(index);
    const startIndex = index * chunkSize;
    // Scroll episode list to the start of the selected range
    // Align to second item by scrolling to startIndex with offset
    // Use animated: false for instant jump
    episodeListRef.current?.scrollToIndex({
      index: startIndex,
      animated: false,
      viewPosition: 0,
      viewOffset: startIndex === 0 ? 0 : focusOffset
    });
    // Try to update target to the start of the range (if rendered)
    // We need to wait for layout/render? FlashList might not have mounted the new items yet.
    // But updateTargetEpisode checks if node exists.
    // For FlashList, we might need a small delay or rely on onFocus if focus moves there.
    // However, for "nextFocusUp" to work immediately, we need the tag.
    // Since we just scrolled, the item *should* be rendered soon.
    requestAnimationFrame(() => {
      updateTargetEpisode(startIndex);
    });
  }, [chunkSize, updateTargetEpisode, focusOffset, currentRange]);

  const handleEpisodeFocus = useCallback((index: number) => {
    const newRange = Math.floor(index / chunkSize);
    setCurrentRange(prev => {
      if (prev !== newRange) return newRange;
      return prev;
    });

    // Update the target tag for SourceList -> EpisodeList navigation
    updateTargetEpisode(index);

    // Use requestAnimationFrame for smoother and faster interaction with native focus
    // forcing the focused item to align to the left immediately
    requestAnimationFrame(() => {
      // Align to second item by scrolling to index with offset
      episodeListRef.current?.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0,
        viewOffset: index === 0 ? 0 : focusOffset
      });
    });
  }, [chunkSize, updateTargetEpisode, focusOffset]);

  const posterUpdateTimer = React.useRef<any>(null);

  const handleTVTopInfoFocus = useCallback(() => {
    if (posterUpdateTimer.current) {
      clearTimeout(posterUpdateTimer.current);
      posterUpdateTimer.current = null;
    }
    setOverridePoster(null);
  }, []);

  const handleRelatedSeriesFocus = useCallback((item: any) => {
    if (posterUpdateTimer.current) {
      clearTimeout(posterUpdateTimer.current);
    }
    posterUpdateTimer.current = setTimeout(() => {
      setOverridePoster(item?.poster || null);
    }, 300);
  }, []);

  // Cleanup timer on unmount
  React.useEffect(() => {
    return () => {
      if (posterUpdateTimer.current) {
        clearTimeout(posterUpdateTimer.current);
      }
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Background Atmosphere */}
      {/* Detail page poster URL works better without proxy (direct access or already proxied) */}
      <PureDynamicBackground poster={activePoster} useProxy={false} />

      <DetailTVContent
        dynamicStyles={dynamicStyles}
        detail={detail}
        isFavorited={isFavorited}
        toggleFavorite={toggleFavorite}
        handlePrimaryPlay={handlePrimaryPlay}
        playButtonLabel={playButtonLabel}
        isPlayDisabled={isPlayDisabled}
        colors={colors}
        firstSourceTag={firstSourceTag}
        handleTVTopInfoFocus={handleTVTopInfoFocus}
        searchResults={searchResults}
        deviceType={deviceType}
        allSourcesLoaded={allSourcesLoaded}
        setDetail={setDetail}
        setFirstSourceRef={setFirstSourceRef}
        targetEpisodeTag={targetEpisodeTag}
        episodes={episodes}
        itemWidth={itemWidth}
        handlePlay={handlePlay}
        handleEpisodeFocus={handleEpisodeFocus}
        firstRangeTag={firstRangeTag}
        episodeListRef={episodeListRef}
        setTargetEpisodeTag={setTargetEpisodeTag}
        chunkSize={chunkSize}
        currentRange={currentRange}
        handleRangeSelect={handleRangeSelect}
        focusOffset={focusOffset}
        handleSetFirstRangeRef={handleSetFirstRangeRef}
        handleRelatedSeriesFocus={handleRelatedSeriesFocus}
      />
    </View>
  );
});

DetailTVView.displayName = 'DetailTVView';
