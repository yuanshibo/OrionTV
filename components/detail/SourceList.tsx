import React, { memo, useCallback } from 'react';
import { View, ScrollView, Text } from 'react';
import { StyledButton } from '@/components/StyledButton';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';

type SourceName = { key: string; name: string; resolution?: string | null };

interface SourceButtonProps {
  item: SourceName;
  isSelected: boolean;
  onSelect: (sourceKey: string) => void;
  deviceType: 'mobile' | 'tablet' | 'tv';
  styles: any;
  colors: typeof Colors.dark;
}

const SourceButton = memo(({ item, isSelected, onSelect, deviceType, styles, colors }: SourceButtonProps) => {
  const handlePress = useCallback(() => onSelect(item.key), [onSelect, item.key]);

  if (deviceType === 'mobile') {
    return (
      <StyledButton
        onPress={handlePress}
        isSelected={isSelected}
        style={styles.sourceButton}
      >
        <ThemedText style={styles.sourceButtonText}>{item.name}</ThemedText>
        {item.resolution && (
          <View style={[styles.badge, { backgroundColor: colors.border }, isSelected && styles.selectedBadge]}>
            <Text style={styles.badgeText}>{item.resolution}</Text>
          </View>
        )}
      </StyledButton>
    );
  }

  // TV View
  return (
    <StyledButton
      onPress={handlePress}
      isSelected={isSelected}
      style={styles.sourceButton}
    >
      <View style={styles.sourceButtonContent}>
        <ThemedText style={styles.sourceNameText} numberOfLines={1}>
          {item.name}
        </ThemedText>
        {item.resolution && (
          <ThemedText style={styles.sourceMetaText} numberOfLines={1}>
            {item.resolution}
          </ThemedText>
        )}
      </View>
    </StyledButton>
  );
});
SourceButton.displayName = 'SourceButton';


interface SourceListProps {
  sourceNames: SourceName[];
  activeSourceKey: string | null;
  onSelect: (sourceKey: string) => void;
  deviceType: 'mobile' | 'tablet' | 'tv';
  styles: any;
  colors: typeof Colors.dark;
}

export const SourceList: React.FC<SourceListProps> = memo(({
  sourceNames,
  activeSourceKey,
  onSelect,
  deviceType,
  styles,
  colors,
}) => {
  const isMobile = deviceType === 'mobile';

  const title = (
    <View style={styles.sourcesTitleContainer}>
      <ThemedText style={styles.sourcesTitle}>
        {isMobile ? `播放源 (${sourceNames.length})` : `选择播放源 共 ${sourceNames.length} 个`}
      </ThemedText>
    </View>
  );

  const renderButton = (item: SourceName, index: number) => (
    <SourceButton
      key={item.key}
      item={item}
      isSelected={activeSourceKey === item.key}
      onSelect={onSelect}
      deviceType={deviceType}
      styles={styles}
      colors={colors}
    />
  );

  const content = isMobile ? (
    <View style={styles.sourceList}>
      {sourceNames.map(renderButton)}
    </View>
  ) : (
    <ScrollView
      horizontal
      style={styles.sourceList}
      showsHorizontalScrollIndicator={false}
    >
      {sourceNames.map(renderButton)}
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
