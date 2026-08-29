import React, { memo, useCallback, useState, useMemo } from 'react';
import { View, ScrollView, useWindowDimensions, findNodeHandle, TVFocusGuideView } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { StyledButton } from '@/components/StyledButton';
import { SourceList } from '@/components/detail/SourceList';
import RelatedSeries from '@/components/RelatedSeries';
import { EpisodeRangeSelector } from '@/components/detail/EpisodeRangeSelector';
import { PureDynamicBackground } from '@/components/DynamicBackground';
import { TVTopInfo } from '@/components/detail/TVTopInfo';
import { EpisodeHorizontalList, EpisodeHorizontalListRef } from '@/components/detail/EpisodeHorizontalList';
import { DetailInfoModal } from '@/components/detail/DetailInfoModal';
import { ArrowUpDown } from 'lucide-react-native';

import { SearchResultWithResolution, PlayRecord } from '@/types';
import { Colors } from '@/constants/Colors';
import { buildDisplayEpisodes, chunkDisplayEpisodes, EpisodeItem, EpisodeChunk } from '@/utils/episodeUtils';

interface DetailTVViewProps {
  detail: SearchResultWithResolution;
  searchResults: SearchResultWithResolution[];
  allSourcesLoaded: boolean;
  isFavorited: boolean;
  toggleFavorite: () => void;
  handlePrimaryPlay: () => void;
  handlePlay: (episodeIndex: number, position?: number) => void;
  playButtonLabel: string;
  isPlayDisabled: boolean;
  setDetail: (detail: SearchResultWithResolution) => void;
  dynamicStyles: any;
  colors: (typeof Colors.dark) | (typeof Colors.light);
  deviceType: 'mobile' | 'tablet' | 'tv';
  resumeRecord?: PlayRecord | null;
}

interface DetailTVContentProps extends DetailTVViewProps {
  firstSourceTag: number | null;
  handleTVTopInfoFocus: () => void;
  setFirstSourceRef: (node: any) => void;
  targetEpisodeTag: number | null;
  displayEpisodes: EpisodeItem[];
  chunks: EpisodeChunk<EpisodeItem>[];
  itemWidth: number;
  handleEpisodeFocus: (index: number) => void;
  firstRangeTag: number | null;
  episodeListRef: React.RefObject<EpisodeHorizontalListRef | null>;
  setTargetEpisodeTag: (tag: number | null) => void;
  chunkSize: number;
  currentRange: number;
  handleRangeSelect: (index: number) => void;
  focusOffset: number;
  handleSetFirstRangeRef: (node: any) => void;
  handleRelatedSeriesFocus: (item: any) => void;
  isReversed: boolean;
  toggleSortOrder: () => void;
  onOpenDetailModal: () => void;
  sortButtonTag: number | null;
  setSortButtonRef: (node: any) => void;
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
  displayEpisodes,
  chunks,
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
  handleRelatedSeriesFocus,
  isReversed,
  toggleSortOrder,
  onOpenDetailModal,
  resumeRecord,
  sortButtonTag,
  setSortButtonRef,
}: DetailTVContentProps) => {
  const nextTargetDown = sortButtonTag || targetEpisodeTag;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={dynamicStyles.scrollContainer}
      removeClippedSubviews={false}
    >
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
        onOpenDetailModal={onOpenDetailModal}
      />
      <View style={dynamicStyles.bottomContainer}>
        <TVFocusGuideView trapFocusUp={false} trapFocusDown={false} destinations={[nextTargetDown].filter(Boolean) as any}>
          <SourceList
            searchResults={searchResults}
            currentSource={detail.source}
            onSelect={setDetail}
            loading={!allSourcesLoaded}
            deviceType={deviceType}
            styles={dynamicStyles}
            colors={colors}
            setFirstSourceRef={setFirstSourceRef}
            nextFocusDown={nextTargetDown}
          />
        </TVFocusGuideView>

        {displayEpisodes.length > 0 && (
          <TVFocusGuideView trapFocusUp={false} trapFocusDown={false}>
            <View>
              <View style={dynamicStyles.episodesHeaderContainer}>
                <View style={dynamicStyles.episodesTitleGroup}>
                  <ThemedText style={dynamicStyles.episodesTitle}>播放列表</ThemedText>
                  {displayEpisodes.length > 1 && (
                    <StyledButton
                      ref={setSortButtonRef}
                      variant="ghost"
                      onPress={toggleSortOrder}
                      style={dynamicStyles.sortOrderButton}
                      nextFocusUp={firstSourceTag || undefined}
                      nextFocusDown={targetEpisodeTag || undefined}
                      focusedStyle={{
                        backgroundColor: colors.primary,
                        borderColor: colors.text,
                      }}
                    >
                      <ArrowUpDown size={14} color={colors.text} />
                      <ThemedText style={dynamicStyles.sortOrderButtonText}>
                        {isReversed ? "倒序 (最新在前)" : "正序"}
                      </ThemedText>
                    </StyledButton>
                  )}
                </View>
              </View>

              {/* Episode List (Horizontal) */}
              <EpisodeHorizontalList
                ref={episodeListRef}
                episodes={displayEpisodes}
                itemWidth={itemWidth}
                handlePlay={handlePlay}
                handleEpisodeFocus={handleEpisodeFocus}
                firstRangeTag={firstRangeTag}
                firstSourceTag={firstSourceTag}
                nextFocusUpTag={sortButtonTag || firstSourceTag}
                dynamicStyles={dynamicStyles}
                setTargetEpisodeTag={setTargetEpisodeTag}
                resumeRecord={resumeRecord}
                detailTitle={detail.title}
              />

              {/* Range Selector (Bottom) */}
              {displayEpisodes.length > chunkSize && (
                <EpisodeRangeSelector
                  chunks={chunks}
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
          </TVFocusGuideView>
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
  resumeRecord,
}) => {
  const [currentRange, setCurrentRange] = useState(0);
  const [isReversed, setIsReversed] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const chunkSize = 10;
  const episodeListRef = React.useRef<EpisodeHorizontalListRef>(null);
  const { width } = useWindowDimensions();
  const [overridePoster, setOverridePoster] = useState<string | null>(null);

  const activePoster = overridePoster || detail.poster;

  const [firstSourceTag, setFirstSourceTag] = useState<number | null>(null);
  const [targetEpisodeTag, setTargetEpisodeTag] = useState<number | null>(null);
  const [firstRangeTag, setFirstRangeTag] = useState<number | null>(null);
  const [sortButtonTag, setSortButtonTag] = useState<number | null>(null);

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

  const setSortButtonRef = useCallback((node: any) => {
    if (node) {
      setSortButtonTag(findNodeHandle(node));
    }
  }, []);

  // Show ALL episodes with optional reverse order
  const displayEpisodes = useMemo(() => {
    return buildDisplayEpisodes(detail.episodes || [], isReversed);
  }, [detail.episodes, isReversed]);

  const chunks = useMemo(() => {
    return chunkDisplayEpisodes(displayEpisodes, chunkSize);
  }, [displayEpisodes, chunkSize]);

  const toggleSortOrder = useCallback(() => {
    setIsReversed(prev => !prev);
    setCurrentRange(0);
    requestAnimationFrame(() => {
      episodeListRef.current?.scrollToIndex({
        index: 0,
        animated: false,
        viewPosition: 0,
        viewOffset: 0,
      });
      episodeListRef.current?.updateTargetEpisode(0);
    });
  }, []);

  // Calculate item width to fit 10 items.
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
    episodeListRef.current?.scrollToIndex({
      index: startIndex,
      animated: false,
      viewPosition: 0,
      viewOffset: startIndex === 0 ? 0 : focusOffset
    });
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

    updateTargetEpisode(index);

    requestAnimationFrame(() => {
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
        displayEpisodes={displayEpisodes}
        chunks={chunks}
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
        isReversed={isReversed}
        toggleSortOrder={toggleSortOrder}
        onOpenDetailModal={() => setShowInfoModal(true)}
        resumeRecord={resumeRecord}
        sortButtonTag={sortButtonTag}
        setSortButtonRef={setSortButtonRef}
      />

      {/* Full Synopsis & Cast Modal */}
      <DetailInfoModal
        visible={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        detail={detail}
        colors={colors}
      />
    </View>
  );
});

DetailTVView.displayName = 'DetailTVView';
