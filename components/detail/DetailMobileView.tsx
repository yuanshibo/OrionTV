import React, { memo, useCallback, useMemo, useState } from 'react';
import { View, Image } from 'react-native';
import { FlashList } from "@shopify/flash-list";
import { EpisodeButton } from '@/components/detail/EpisodeList';
import { ThemedText } from '@/components/ThemedText';
import { StyledButton } from '@/components/StyledButton';
import { SourceList } from '@/components/detail/SourceList';
import RelatedSeries from '@/components/RelatedSeries';
import { EpisodeRangeSelector } from '@/components/detail/EpisodeRangeSelector';
import { Heart } from 'lucide-react-native';

interface DetailMobileViewProps {
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

const MobileTopInfo = memo(({
  detail,
  isFavorited,
  toggleFavorite,
  handlePrimaryPlay,
  playButtonLabel,
  isPlayDisabled,
  dynamicStyles,
  colors
}: any) => {
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
            <ThemedText style={dynamicStyles.metaText}>{detail.year}</ThemedText>
            <ThemedText style={dynamicStyles.metaText}>{detail.type_name}</ThemedText>
          </View>
        </View>
      </View>

      <View style={dynamicStyles.descriptionContainer}>
        <ThemedText style={dynamicStyles.description}>{detail.desc}</ThemedText>
      </View>
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
}) => {
  const [currentRange, setCurrentRange] = useState(0);
  const chunkSize = 50;

  const visibleEpisodes = useMemo(() => {
    if (!detail.episodes) return [];
    if (detail.episodes.length <= chunkSize) return detail.episodes;

    const start = currentRange * chunkSize;
    const end = Math.min((currentRange + 1) * chunkSize, detail.episodes.length);
    return detail.episodes.slice(start, end);
  }, [detail.episodes, currentRange]);

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
        {detail.episodes && detail.episodes.length > 0 && (
          <View style={dynamicStyles.episodesContainer}>
            <ThemedText style={dynamicStyles.episodesTitle}>播放列表</ThemedText>
            <EpisodeRangeSelector
              totalEpisodes={detail.episodes.length}
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
  }, [detail, isFavorited, toggleFavorite, handlePrimaryPlay, playButtonLabel, isPlayDisabled, dynamicStyles, colors, searchResults, allSourcesLoaded, deviceType, setDetail, currentRange, handleRangeSelect]);

  const renderFooter = useCallback(() => (
    <RelatedSeries title={detail.title} />
  ), [detail.title]);

  const renderItem = useCallback(({ index }: { index: number }) => {
    const actualIndex = currentRange * chunkSize + index;
    return (
      <View style={{ flex: 1, padding: 4 }}>
        <EpisodeButton
          index={actualIndex}
          onPlay={handlePlay}
          style={dynamicStyles.episodeButton}
          textStyle={dynamicStyles.episodeButtonText}
        />
      </View>
    );
  }, [handlePlay, dynamicStyles, currentRange]);

  return (
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
  );
});

DetailMobileView.displayName = 'DetailMobileView';
