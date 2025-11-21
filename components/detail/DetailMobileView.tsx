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

interface DetailMobileViewProps {
  detail: SearchResultWithResolution;
  searchResults: any[]; // Type as needed
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

export const DetailMobileView: React.FC<DetailMobileViewProps> = ({
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
      <View style={dynamicStyles.mobileTopContainer}>
        <Image source={{ uri: detail.poster }} style={dynamicStyles.mobilePoster} contentFit="cover" />
        <View style={dynamicStyles.mobileInfoContainer}>
          <View style={dynamicStyles.titleContainer}>
            <ThemedText style={dynamicStyles.title} numberOfLines={2}>
              {detail.title}
            </ThemedText>
            <StyledButton onPress={toggleFavorite} variant="ghost" style={dynamicStyles.favoriteButton}>
              <FontAwesome
                name={isFavorited ? "heart" : "heart-o"}
                size={20}
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
        deviceType="mobile"
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
