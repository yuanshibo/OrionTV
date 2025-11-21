import React, { useState, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { StyledButton } from '@/components/StyledButton';
import { ThemedText } from '@/components/ThemedText';

interface EpisodeListProps {
  episodes: any[];
  onPlay: (index: number) => void;
  styles: any;
}

const GROUP_SIZE = 30;

export const EpisodeList: React.FC<EpisodeListProps> = React.memo(({ episodes, onPlay, styles }) => {
  const [selectedGroup, setSelectedGroup] = useState(0);

  const groups = useMemo(() => {
    if (!episodes || episodes.length === 0) return [];
    const numGroups = Math.ceil(episodes.length / GROUP_SIZE);
    return Array.from({ length: numGroups }, (_, i) => ({
      label: `${i * GROUP_SIZE + 1}-${Math.min((i + 1) * GROUP_SIZE, episodes.length)}`,
      index: i,
    }));
  }, [episodes]);

  const currentEpisodes = useMemo(() => {
    if (!episodes) return [];
    const start = selectedGroup * GROUP_SIZE;
    return episodes.slice(start, start + GROUP_SIZE);
  }, [episodes, selectedGroup]);

  if (!episodes || episodes.length === 0) return null;

  // Custom styles for group tabs if not passed in props (which usually contains layout styles only)
  const localStyles = StyleSheet.create({
    groupContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 10,
      paddingHorizontal: 10,
    },
    groupButton: {
      margin: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
      minWidth: 60,
    },
    groupButtonText: {
      fontSize: 14,
    },
  });

  return (
    <View style={styles.episodesContainer}>
      <ThemedText style={styles.episodesTitle}>播放列表</ThemedText>

      {groups.length > 1 && (
        <View style={localStyles.groupContainer}>
          {groups.map((group) => (
            <StyledButton
              key={group.index}
              style={localStyles.groupButton}
              variant={selectedGroup === group.index ? "primary" : "default"}
              onPress={() => setSelectedGroup(group.index)}
              text={group.label}
              textStyle={localStyles.groupButtonText}
            />
          ))}
        </View>
      )}

      <View style={styles.episodeList}>
        {currentEpisodes.map((episode, index) => {
          const absoluteIndex = selectedGroup * GROUP_SIZE + index;
          return (
            <StyledButton
              key={absoluteIndex}
              style={styles.episodeButton}
              onPress={() => onPlay(absoluteIndex)}
              text={`第 ${absoluteIndex + 1} 集`}
              textStyle={styles.episodeButtonText}
            />
          );
        })}
      </View>
    </View>
  );
});

EpisodeList.displayName = 'EpisodeList';
