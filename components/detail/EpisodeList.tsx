import React, { memo, useCallback } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StyledButton } from '@/components/StyledButton';
import { ThemedText } from '@/components/ThemedText';
import { FlashList } from '@shopify/flash-list';

interface EpisodeButtonProps {
  index: number;
  onPlay: (index: number) => void;
  style: any;
  textStyle: any;
}

const EpisodeButton = memo(({ index, onPlay, style, textStyle }: EpisodeButtonProps) => {
  const handlePress = useCallback(() => {
    onPlay(index);
  }, [onPlay, index]);

  return (
    <StyledButton
      style={style}
      onPress={handlePress}
      text={`第 ${index + 1} 集`}
      textStyle={textStyle}
    />
  );
});

EpisodeButton.displayName = 'EpisodeButton';

interface EpisodeListProps {
  episodes?: any[];
  onPlay: (index: number) => void;
  styles: any;
  isLoading?: boolean;
}

export const EpisodeList: React.FC<EpisodeListProps> = memo(({ episodes, onPlay, styles, isLoading = false }) => {
  const renderItem = useCallback(({ index }: { item: any, index: number }) => (
    <EpisodeButton
      index={index}
      onPlay={onPlay}
      style={styles.episodeButton}
      textStyle={styles.episodeButtonText}
    />
  ), [onPlay, styles.episodeButton, styles.episodeButtonText]);

  const keyExtractor = useCallback((item: any, index: number) => index.toString(), []);

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.centeredContent}>
          <ActivityIndicator />
        </View>
      );
    }

    if (!episodes || episodes.length === 0) {
      return (
        <View style={styles.centeredContent}>
          <ThemedText>暂无剧集信息</ThemedText>
        </View>
      );
    }

    return (
      <View style={styles.episodeList}>
        <FlashList
          data={episodes}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={5} // Adjust based on your design
        />
      </View>
    );
  };

  return (
    <View style={styles.episodesContainer}>
      <ThemedText style={styles.episodesTitle}>播放列表</ThemedText>
      {renderContent()}
    </View>
  );
});

EpisodeList.displayName = 'EpisodeList';
