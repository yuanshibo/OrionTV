import React, { memo, useCallback } from 'react';
import { View, ScrollView, Text, ActivityIndicator } from 'react-native';
import { StyledButton } from '@/components/StyledButton';
import { ThemedText } from '@/components/ThemedText';
import { SearchResultWithResolution } from '@/services/api';
import { Colors } from '@/constants/Colors';

interface SourceButtonProps {
  item: SearchResultWithResolution;
  isSelected: boolean;
  onSelect: (item: SearchResultWithResolution) => void;
  deviceType: 'mobile' | 'tablet' | 'tv';
  styles: any;
  colors: typeof Colors.dark;
}

const SourceButton = memo(({ item, isSelected, onSelect, deviceType, styles, colors }: SourceButtonProps) => {
  const isMobile = deviceType === 'mobile';
  const handlePress = useCallback(() => onSelect(item), [onSelect, item]);

  if (isMobile) {
    return (
      <StyledButton
        onPress={handlePress}
        isSelected={isSelected}
        style={styles.sourceButton}
      >
        <ThemedText style={styles.sourceButtonText}>{item.source_name}</ThemedText>
        {item.episodes.length > 1 && (
          <View style={[styles.badge, isSelected && styles.selectedBadge]}>
            <Text style={styles.badgeText}>
              {item.episodes.length > 99 ? "99+" : `${item.episodes.length}`} 集
            </Text>
          </View>
        )}
        {item.resolution && (
          <View style={[styles.badge, { backgroundColor: colors.border }, isSelected && styles.selectedBadge]}>
            <Text style={styles.badgeText}>{item.resolution}</Text>
          </View>
        )}
      </StyledButton>
    );
  }

  const episodesDisplay = item.episodes.length > 99 ? "99+集" : `${item.episodes.length}集`;
  const metaLine = item.resolution ? `${episodesDisplay} · ${item.resolution}` : episodesDisplay;

  return (
    <StyledButton
      onPress={handlePress}
      isSelected={isSelected}
      style={styles.sourceButton}
    >
      <View style={styles.sourceButtonContent}>
        <ThemedText style={styles.sourceNameText} numberOfLines={1}>
          {item.source_name}
        </ThemedText>
        <ThemedText style={styles.sourceMetaText} numberOfLines={1}>
          {metaLine}
        </ThemedText>
      </View>
    </StyledButton>
  );
});

SourceButton.displayName = 'SourceButton';

interface SourceListProps {
  searchResults: SearchResultWithResolution[];
  currentSource?: string;
  onSelect: (item: SearchResultWithResolution) => void;
  loading?: boolean;
  deviceType: 'mobile' | 'tablet' | 'tv';
  styles: any;
  colors: typeof Colors.dark;
}

export const SourceList: React.FC<SourceListProps> = memo(({
  searchResults,
  currentSource,
  onSelect,
  loading,
  deviceType,
  styles,
  colors,
}) => {
  const isMobile = deviceType === 'mobile';

  const title = (
    <View style={styles.sourcesTitleContainer}>
      <ThemedText style={styles.sourcesTitle}>
        {isMobile ? `播放源 (${searchResults.length})` : `选择播放源 共 ${searchResults.length} 个`}
      </ThemedText>
      {loading && <ActivityIndicator style={{ marginLeft: 10 }} />}
    </View>
  );

  const renderButton = (item: SearchResultWithResolution, index: number) => (
    <SourceButton
      key={index}
      item={item}
      isSelected={currentSource === item.source}
      onSelect={onSelect}
      deviceType={deviceType}
      styles={styles}
      colors={colors}
    />
  );

  const content = isMobile ? (
    <View style={styles.sourceList}>
      {searchResults.map(renderButton)}
    </View>
  ) : (
    <ScrollView
      horizontal
      style={styles.sourceList}
      showsHorizontalScrollIndicator={false}
    >
      {searchResults.map(renderButton)}
    </ScrollView>
  );

  return (
    <View style={styles.sourcesContainer}>
      {title}
      {content}
    </View>
  );
});

SourceList.displayName = 'SourceList';
