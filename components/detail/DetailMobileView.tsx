import React from 'react';
import { View, Image, ScrollView } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { StyledButton } from '@/components/StyledButton';
import { SourceList } from '@/components/detail/SourceList';
import { EpisodeList } from '@/components/detail/EpisodeList';
import RelatedSeries from '@/components/RelatedSeries';
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

export const DetailMobileView: React.FC<DetailMobileViewProps> = ({
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
  return (
    <ScrollView
      style={dynamicStyles.scrollContainer}
      showsVerticalScrollIndicator={false}
    >
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

      <SourceList
        searchResults={searchResults}
        currentSource={detail.source}
        onSelect={setDetail}
        loading={!allSourcesLoaded}
        deviceType={deviceType}
        styles={dynamicStyles}
        colors={colors}
      />

      <EpisodeList
        episodes={detail.episodes}
        onPlay={handlePlay}
        styles={dynamicStyles}
      />
      <RelatedSeries title={detail.title} />
    </ScrollView>
  );
};
