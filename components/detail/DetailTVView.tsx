import React, { memo } from 'react';
import { View, Image, ScrollView } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { StyledButton } from '@/components/StyledButton';
import { SourceList } from '@/components/detail/SourceList';
import { EpisodeList } from '@/components/detail/EpisodeList';
import RelatedSeries from '@/components/RelatedSeries';
import { Heart } from 'lucide-react-native';

interface DetailTVViewProps {
  detail: any;
  isFavorited: boolean;
  toggleFavorite: () => void;
  handlePrimaryPlay: () => void;
  handlePlay: (episodeIndex: number, position?: number) => void;
  playButtonLabel: string;
  isPlayDisabled: boolean;
  dynamicStyles: any;
  colors: any;
  deviceType: 'mobile' | 'tablet' | 'tv';
  // New props for progressive loading
  sourceNames: { key: string; name: string; resolution?: string | null }[];
  activeSourceKey: string | null;
  isEpisodeListLoading: boolean;
  onSourceChange: (sourceKey: string) => void;
}

export const DetailTVView: React.FC<DetailTVViewProps> = memo(({
  detail,
  isFavorited,
  toggleFavorite,
  handlePrimaryPlay,
  handlePlay,
  playButtonLabel,
  isPlayDisabled,
  dynamicStyles,
  colors,
  deviceType,
  sourceNames,
  activeSourceKey,
  isEpisodeListLoading,
  onSourceChange,
}) => {
  return (
    <ScrollView
      style={dynamicStyles.scrollContainer}
      showsVerticalScrollIndicator={false}
    >
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
           />
          <View style={dynamicStyles.metaContainer}>
            <ThemedText style={dynamicStyles.metaText}>{detail.year}</ThemedText>
            <ThemedText style={dynamicStyles.metaText}>{detail.type_name}</ThemedText>
          </View>

          <ScrollView
            style={dynamicStyles.descriptionScrollView}
            showsVerticalScrollIndicator={false}
          >
            <ThemedText style={dynamicStyles.description}>{detail.desc}</ThemedText>
          </ScrollView>
        </View>
      </View>

      <View style={dynamicStyles.bottomContainer}>
        <SourceList
          sourceNames={sourceNames}
          activeSourceKey={activeSourceKey}
          onSelect={onSourceChange}
          deviceType={deviceType}
          styles={dynamicStyles}
          colors={colors}
        />
        <EpisodeList
          episodes={detail.episodes}
          onPlay={handlePlay}
          styles={dynamicStyles}
          isLoading={isEpisodeListLoading}
        />
        <RelatedSeries title={detail.title} />
      </View>
    </ScrollView>
  );
});

DetailTVView.displayName = 'DetailTVView';
