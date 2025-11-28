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
  nextFocusDown?: number | null;
}

const SourceButton = memo(React.forwardRef<View, SourceButtonProps>(({ item, isSelected, onSelect, deviceType, styles, colors, nextFocusDown }, ref) => {
  const isMobile = deviceType === 'mobile';
  const handlePress = useCallback(() => onSelect(item), [onSelect, item]);

  if (isMobile) {
    return (
      <StyledButton
        ref={ref}
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
      ref={ref}
      onPress={handlePress}
      isSelected={isSelected}
      style={styles.sourceButton}
      nextFocusDown={nextFocusDown}
    >
      <View style={styles.sourceButtonContent}>
        <ThemedText style={styles.sourceNameText} numberOfLines={1}>
          {item.source_name.slice(0, 2)}
        </ThemedText>
        <ThemedText style={styles.sourceMetaText} numberOfLines={1}>
          ・{item.episodes.length > 99 ? "99+" : item.episodes.length}集
        </ThemedText>
      </View>
    </StyledButton>
  );
}));

SourceButton.displayName = 'SourceButton';

interface SourceListProps {
  searchResults: SearchResultWithResolution[];
  currentSource?: string;
  onSelect: (item: SearchResultWithResolution) => void;
  loading?: boolean;
  deviceType: 'mobile' | 'tablet' | 'tv';
  styles: any;
  colors: typeof Colors.dark;
  setFirstSourceRef?: (node: any) => void;
  nextFocusDown?: number | null;
}

export const SourceList: React.FC<SourceListProps> = memo(({
  searchResults,
  currentSource,
  onSelect,
  loading,
  deviceType,
  styles,
  colors,
  setFirstSourceRef,
  nextFocusDown,
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
      ref={index === 0 ? setFirstSourceRef : undefined}
      item={item}
      isSelected={currentSource === item.source}
      onSelect={onSelect}
      deviceType={deviceType}
      styles={styles}
      colors={colors}
      nextFocusDown={nextFocusDown}
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
