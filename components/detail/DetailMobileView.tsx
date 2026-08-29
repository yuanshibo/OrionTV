import React, { memo, useCallback, useMemo, useState } from 'react';
import { View, Image, Pressable } from 'react-native';
import { FlashList } from "@shopify/flash-list";
import { EpisodeButton } from '@/components/detail/EpisodeList';
import { ThemedText } from '@/components/ThemedText';
import { StyledButton } from '@/components/StyledButton';
import { SourceList } from '@/components/detail/SourceList';
import RelatedSeries from '@/components/RelatedSeries';
import { EpisodeRangeSelector } from '@/components/detail/EpisodeRangeSelector';
import { DetailInfoModal } from '@/components/detail/DetailInfoModal';
import { Heart, ArrowUpDown } from 'lucide-react-native';
import { buildDisplayEpisodes, chunkDisplayEpisodes, EpisodeItem, getEpisodeProgressInfo } from '@/utils/episodeUtils';

import { SearchResultWithResolution, PlayRecord } from '@/types';
import { Colors } from '@/constants/Colors';

interface DetailMobileViewProps {
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

interface MobileTopInfoProps {
  detail: SearchResultWithResolution;
  isFavorited: boolean;
  toggleFavorite: () => void;
  handlePrimaryPlay: () => void;
  playButtonLabel: string;
  isPlayDisabled: boolean;
  dynamicStyles: any;
  colors: (typeof Colors.dark) | (typeof Colors.light);
  onOpenDetailModal?: () => void;
}

const MobileTopInfo = memo(({
  detail,
  isFavorited,
  toggleFavorite,
  handlePrimaryPlay,
  playButtonLabel,
  isPlayDisabled,
  dynamicStyles,
  colors,
  onOpenDetailModal,
}: MobileTopInfoProps) => {
  return (
    <View>
      <View style={dynamicStyles.mobileTopContainer}>
        <Image source={{ uri: detail.poster }} style={dynamicStyles.mobilePoster} />
        <View style={dynamicStyles.mobileInfoContainer}>
          <View style={dynamicStyles.titleContainer}>
            <ThemedText style={dynamicStyles.title} numberOfLines={2}>
              {detail.title}
            </ThemedText>
            <StyledButton onPress={toggleFavorite} variant="ghost" style={dynamicStyles.favoriteButton}>
              <Heart
                size={20}
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
          />
          <View style={dynamicStyles.metaContainer}>
            {detail.year ? <ThemedText style={dynamicStyles.metaText}>{detail.year}</ThemedText> : null}
            {detail.type_name ? <ThemedText style={dynamicStyles.metaText}>{detail.type_name}</ThemedText> : null}
            {detail.resolution ? (
              <View style={[dynamicStyles.badge, { backgroundColor: colors.border, alignSelf: 'center', marginLeft: 4 }]}>
                <ThemedText style={dynamicStyles.badgeText}>{detail.resolution}</ThemedText>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <Pressable onPress={onOpenDetailModal} style={dynamicStyles.descriptionContainer}>
        <ThemedText style={dynamicStyles.description} numberOfLines={3}>
          {detail.desc && detail.desc.trim().length > 0 ? detail.desc.trim() : "暂无简介信息"}
        </ThemedText>
        <ThemedText style={dynamicStyles.mobileMoreText}>
          查看完整简介与演职员 &gt;
        </ThemedText>
      </Pressable>
    </View>
  );
});

MobileTopInfo.displayName = 'MobileTopInfo';

export const DetailMobileView: React.FC<DetailMobileViewProps> = memo(({
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
  const chunkSize = 50;

  const displayEpisodes = useMemo(() => {
    return buildDisplayEpisodes(detail.episodes || [], isReversed);
  }, [detail.episodes, isReversed]);

  const chunks = useMemo(() => {
    return chunkDisplayEpisodes(displayEpisodes, chunkSize);
  }, [displayEpisodes, chunkSize]);

  const visibleEpisodes = useMemo(() => {
    return chunks[currentRange]?.items || [];
  }, [chunks, currentRange]);

  const toggleSortOrder = useCallback(() => {
    setIsReversed(prev => !prev);
    setCurrentRange(0);
  }, []);

  const handleRangeSelect = useCallback((index: number) => {
    setCurrentRange(index);
  }, []);

  const ListHeaderComponent = useMemo(() => {
    return (
      <View>
        <MobileTopInfo
          detail={detail}
          isFavorited={isFavorited}
          toggleFavorite={toggleFavorite}
          handlePrimaryPlay={handlePrimaryPlay}
          playButtonLabel={playButtonLabel}
          isPlayDisabled={isPlayDisabled}
          dynamicStyles={dynamicStyles}
          colors={colors}
          onOpenDetailModal={() => setShowInfoModal(true)}
        />
        <SourceList
          searchResults={searchResults}
          currentSource={detail.source}
          onSelect={setDetail}
          loading={!allSourcesLoaded}
          deviceType={deviceType}
          styles={dynamicStyles}
          colors={colors}
        />
        {displayEpisodes.length > 0 && (
          <View style={dynamicStyles.episodesContainer}>
            <View style={dynamicStyles.episodesHeaderContainer}>
              <View style={dynamicStyles.episodesTitleGroup}>
                <ThemedText style={dynamicStyles.episodesTitle}>播放列表</ThemedText>
                {displayEpisodes.length > 1 && (
                  <StyledButton
                    variant="ghost"
                    onPress={toggleSortOrder}
                    style={dynamicStyles.sortOrderButton}
                  >
                    <ArrowUpDown size={12} color={colors.text} />
                    <ThemedText style={dynamicStyles.sortOrderButtonText}>
                      {isReversed ? "倒序" : "正序"}
                    </ThemedText>
                  </StyledButton>
                )}
              </View>
            </View>
            <EpisodeRangeSelector
              chunks={chunks}
              currentRange={currentRange}
              onRangeSelect={handleRangeSelect}
              chunkSize={chunkSize}
              styles={dynamicStyles}
              colors={colors}
            />
          </View>
        )}
      </View>
    );
  }, [
    detail,
    isFavorited,
    toggleFavorite,
    handlePrimaryPlay,
    playButtonLabel,
    isPlayDisabled,
    dynamicStyles,
    colors,
    searchResults,
    allSourcesLoaded,
    deviceType,
    setDetail,
    displayEpisodes.length,
    isReversed,
    toggleSortOrder,
    chunks,
    currentRange,
    handleRangeSelect,
  ]);

  const renderFooter = useCallback(() => (
    <RelatedSeries title={detail.title} />
  ), [detail.title]);

  const renderItem = useCallback(({ item }: { item: EpisodeItem }) => {
    const originalIndex = item.originalIndex;
    const progressInfo = getEpisodeProgressInfo(originalIndex, resumeRecord || null, detail.title);

    return (
      <View style={{ flex: 1, padding: 4 }}>
        <EpisodeButton
          index={originalIndex}
          displayLabel={item?.title || `${originalIndex + 1}集`}
          isWatched={progressInfo.isWatched}
          isCurrent={progressInfo.isCurrent}
          progress={progressInfo.progress}
          onPlay={handlePlay}
          style={dynamicStyles.episodeButton}
          textStyle={dynamicStyles.episodeButtonText}
        />
      </View>
    );
  }, [handlePlay, dynamicStyles, resumeRecord, detail.title]);

  return (
    <>
      <FlashList
        data={visibleEpisodes}
        renderItem={renderItem}
        // @ts-ignore
        estimatedItemSize={50}
        numColumns={4}
        ListHeaderComponent={ListHeaderComponent}
        ListFooterComponent={renderFooter}
        style={dynamicStyles.scrollContainer}
        showsVerticalScrollIndicator={false}
      />
      <DetailInfoModal
        visible={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        detail={detail}
        colors={colors}
      />
    </>
  );
});

DetailMobileView.displayName = 'DetailMobileView';
