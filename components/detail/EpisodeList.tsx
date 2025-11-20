import React from 'react';
import { View } from 'react-native';
import { StyledButton } from '@/components/StyledButton';
import { ThemedText } from '@/components/ThemedText';

interface EpisodeListProps {
  episodes: any[];
  onPlay: (index: number) => void;
  styles: any;
}

export const EpisodeList: React.FC<EpisodeListProps> = ({ episodes, onPlay, styles }) => {
  if (!episodes || episodes.length === 0) return null;

  return (
    <View style={styles.episodesContainer}>
      <ThemedText style={styles.episodesTitle}>播放列表</ThemedText>
      <View style={styles.episodeList}>
        {episodes.map((episode, index) => (
          <StyledButton
            key={index}
            style={styles.episodeButton}
            onPress={() => onPlay(index)}
            text={`第 ${index + 1} 集`}
            textStyle={styles.episodeButtonText}
          />
        ))}
      </View>
    </View>
  );
};
