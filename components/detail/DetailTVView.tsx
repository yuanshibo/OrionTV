import React from 'react';
import { View, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { FontAwesome } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { StyledButton } from "@/components/StyledButton";
import { SourceList } from '@/components/detail/SourceList';
import { EpisodeList } from '@/components/detail/EpisodeList';
import RelatedSeries from "@/components/RelatedSeries";
import { SearchResultWithResolution } from "@/services/api/types";
import { Colors } from "@/constants/Colors";

interface DetailTVViewProps {
  detail: SearchResultWithResolution;
  searchResults: any[];
  allSourcesLoaded: boolean;
  isFavorited: boolean;
  toggleFavorite: () => void;
  handlePrimaryPlay: () => void;
  playButtonLabel: string;
  isPlayDisabled: boolean;
  setDetail: (detail: SearchResultWithResolution) => void;
  handlePlay: (episodeIndex: number, position?: number) => void;
  colors: typeof Colors.dark;
  dynamicStyles: any;
}

export const DetailTVView: React.FC<DetailTVViewProps> = ({
  detail,
  searchResults,
  allSourcesLoaded,
  isFavorited,
  toggleFavorite,
  handlePrimaryPlay,
  playButtonLabel,
  isPlayDisabled,
  setDetail,
  handlePlay,
  colors,
  dynamicStyles,
}) => {
  return (
    <ScrollView
      style={dynamicStyles.scrollContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={dynamicStyles.topContainer}>
        <Image source={{ uri: detail.poster }} style={dynamicStyles.poster} contentFit="cover" />
        <View style={dynamicStyles.infoContainer}>
          <View style={dynamicStyles.titleContainer}>
            <ThemedText style={dynamicStyles.title} numberOfLines={1} ellipsizeMode="tail">
              {detail.title}
            </ThemedText>
            <StyledButton onPress={toggleFavorite} variant="ghost" style={dynamicStyles.favoriteButton}>
              <FontAwesome
                name={isFavorited ? "heart" : "heart-o"}
                size={24}
                color={isFavorited ? colors.tint : colors.icon}
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
          searchResults={searchResults}
          currentSource={detail.source}
          onSelect={setDetail}
          loading={!allSourcesLoaded}
          deviceType="tv"
          styles={dynamicStyles}
          colors={colors}
        />
        <EpisodeList
          episodes={detail.episodes}
          onPlay={handlePlay}
          styles={dynamicStyles}
        />
        <RelatedSeries title={detail.title} />
      </View>
    </ScrollView>
  );
};
