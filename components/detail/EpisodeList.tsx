import React, { memo, useCallback } from 'react';
import { View } from 'react-native';
import { StyledButton } from '@/components/StyledButton';
import { ThemedText } from '@/components/ThemedText';

interface EpisodeButtonProps {
  index: number;
  onPlay: (index: number) => void;
  style: any;
  textStyle: any;
  onFocus?: () => void;
}

export const EpisodeButton = memo(React.forwardRef<View, EpisodeButtonProps>(({ index, onPlay, style, textStyle, onFocus }, ref) => {
  const handlePress = useCallback(() => {
    onPlay(index);
  }, [onPlay, index]);

  return (
    <StyledButton
      ref={ref}
      style={style}
      onPress={handlePress}
      onFocus={onFocus}
      text={`${index + 1}集`}
      textStyle={textStyle}
      textProps={{ numberOfLines: 1, adjustsFontSizeToFit: true }}
    />
  );
}));

EpisodeButton.displayName = 'EpisodeButton';

interface EpisodeListProps {
  episodes: any[];
  onPlay: (index: number) => void;
  styles: any;
}

export const EpisodeList: React.FC<EpisodeListProps> = memo(({ episodes, onPlay, styles }) => {
  if (!episodes || episodes.length === 0) return null;

  return (
    <View style={styles.episodesContainer}>
      <ThemedText style={styles.episodesTitle}>播放列表</ThemedText>
      <View style={styles.episodeList}>
        {episodes.map((_, index) => (
          <EpisodeButton
            key={index}
            index={index}
            onPlay={onPlay}
            style={styles.episodeButton}
            textStyle={styles.episodeButtonText}
          />
        ))}
      </View>
    </View>
  );
});

EpisodeList.displayName = 'EpisodeList';
