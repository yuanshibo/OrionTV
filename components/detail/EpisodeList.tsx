import React, { memo, useCallback } from 'react';
import { View } from 'react-native';
import { StyledButton } from '@/components/StyledButton';
import { ThemedText } from '@/components/ThemedText';

import { StyleSheet } from 'react-native';

export interface EpisodeButtonProps {
  index: number;
  displayLabel?: string;
  onPlay: (index: number) => void;
  style?: any;
  textStyle?: any;
  onFocus?: (index: number) => void;
  nextFocusDown?: number | null;
  nextFocusUp?: number | null;
  isWatched?: boolean;
  isCurrent?: boolean;
  progress?: number;
}

export const EpisodeButton = memo(React.forwardRef<View, EpisodeButtonProps>(({
  index,
  displayLabel,
  onPlay,
  style,
  textStyle,
  onFocus,
  nextFocusDown,
  nextFocusUp,
  isWatched = false,
  isCurrent = false,
  progress,
}, ref) => {
  const handlePress = useCallback(() => {
    onPlay(index);
  }, [onPlay, index]);

  const handleFocus = useCallback(() => {
    onFocus?.(index);
  }, [onFocus, index]);

  const showProgressBar = typeof progress === 'number' && progress > 0 && progress < 0.95;

  return (
    <StyledButton
      ref={ref}
      style={style}
      onPress={handlePress}
      onFocus={handleFocus}
      nextFocusDown={nextFocusDown}
      nextFocusUp={nextFocusUp}
      isSelected={isCurrent}
    >
      <View style={buttonStyles.contentWrapper}>
        <View style={buttonStyles.labelRow}>
          <ThemedText
            style={[
              textStyle,
              isWatched && !isCurrent && buttonStyles.watchedText,
              isCurrent && buttonStyles.currentText,
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {displayLabel || `${index + 1}集`}
          </ThemedText>
          {isWatched && !isCurrent && (
            <ThemedText style={buttonStyles.checkMark}>✓</ThemedText>
          )}
        </View>
        {showProgressBar && (
          <View style={buttonStyles.progressBarTrack}>
            <View
              style={[
                buttonStyles.progressBarFill,
                { width: `${Math.max(5, Math.min(100, Math.round(progress * 100)))}%` },
              ]}
            />
          </View>
        )}
      </View>
    </StyledButton>
  );
}));

const buttonStyles = StyleSheet.create({
  contentWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingBottom: 3,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  watchedText: {
    opacity: 0.65,
  },
  currentText: {
    fontWeight: 'bold',
  },
  checkMark: {
    fontSize: 10,
    color: '#38bdf8',
    marginLeft: 3,
    fontWeight: 'bold',
    opacity: 0.8,
  },
  progressBarTrack: {
    position: 'absolute',
    bottom: -4,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#0ea5e9',
    borderRadius: 2,
  },
});

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
