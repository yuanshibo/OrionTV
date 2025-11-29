import React, { useMemo, useEffect, useCallback } from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Category, DoubanFilterKey, DoubanFilterGroup } from "@/services/dataTypes";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyledButton } from "@/components/StyledButton";
import { Colors } from "@/constants/Colors";
import { useFocusStore } from "@/stores/focusStore";
import { FocusPriority } from "@/types/focus";
import { FlashList } from "@shopify/flash-list";

// --- Sub-components ---

interface TagListProps {
  tags: string[];
  selectedTag?: string;
  onSelect: (tag: string) => void;
  styles: any;
}

const TagList = React.memo(({ tags, selectedTag, onSelect, styles }: TagListProps) => {
  if (!tags || tags.length === 0) return null;

  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterGroupLabel}>标签</Text>
      <View style={{ flex: 1 }}>
        <FlashList
          horizontal
          data={tags}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(tag) => tag}
          // @ts-ignore
          estimatedItemSize={60}
          renderItem={({ item: tag, index }) => {
            const isSelected = selectedTag === tag;
            return (
              <StyledButton
                text={tag}
                onPress={() => onSelect(tag)}
                isSelected={isSelected}
                style={styles.filterOptionButton}
                textStyle={styles.filterOptionText}
                variant="ghost"
                hasTVPreferredFocus={index === 0}
              />
            );
          }}
        />
      </View>
    </View>
  );
});

TagList.displayName = "TagList";

interface FilterGroupListProps {
  group: DoubanFilterGroup;
  activeValue: string;
  onSelect: (groupKey: DoubanFilterKey, value: string) => void;
  styles: any;
  isFirstGroup: boolean;
  hasTags: boolean;
}

const FilterGroupList = React.memo(({ group, activeValue, onSelect, styles, isFirstGroup, hasTags }: FilterGroupListProps) => {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterGroupLabel}>{group.label}</Text>
      <View style={{ flex: 1 }}>
        <FlashList
          horizontal
          data={group.options}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(option) => option.value}
          // @ts-ignore
          estimatedItemSize={60}
          renderItem={({ item: option, index: optionIndex }) => {
            const isSelected = activeValue === option.value;
            return (
              <StyledButton
                text={option.label}
                onPress={() => onSelect(group.key, option.value)}
                isSelected={isSelected}
                style={styles.filterOptionButton}
                textStyle={styles.filterOptionText}
                hasTVPreferredFocus={!hasTags && isFirstGroup && optionIndex === 0}
              />
            );
          }}
        />
      </View>
    </View>
  );
});

FilterGroupList.displayName = "FilterGroupList";

// --- Main Component ---

interface FilterPanelProps {
  isVisible: boolean;
  onClose: () => void;
  category: Category;
  onFilterChange: (change: { tag: string } | { filterKey: DoubanFilterKey; filterValue: string }) => void;
  deviceType: "mobile" | "tablet" | "tv";
}

const FilterPanel: React.FC<FilterPanelProps> = ({ isVisible, onClose, category, onFilterChange, deviceType }) => {
  const insets = useSafeAreaInsets();
  const colorScheme = "dark";
  const colors = Colors[colorScheme];
  const setFocusArea = useFocusStore((state) => state.setFocusArea);
  const restorePreviousFocus = useFocusStore((state) => state.restorePreviousFocus);

  // Set focus area to modal when visible
  useEffect(() => {
    if (isVisible) {
      setFocusArea('modal', FocusPriority.MODAL);
    }
  }, [isVisible, setFocusArea]);

  // Handle close with focus restoration
  const handleClose = () => {
    restorePreviousFocus();
    onClose();
  };

  const styles = useMemo(() => StyleSheet.create({
    panel: {
      backgroundColor: "rgba(10, 10, 10, 0.4)",
      paddingHorizontal: 20,
      borderBottomWidth: 0,
      borderBottomColor: "rgba(255, 255, 255, 0.1)",
    },
    filterSection: {
      width: "100%",
    },
    filterGroup: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 2,
    },
    filterGroupLabel: {
      fontSize: 15,
      color: colors.text,
      opacity: 0.7,
      fontWeight: "600",
      minWidth: 40,
      marginRight: 10,
    },
    filterOptionButton: {
      marginRight: 4,
      paddingVertical: 2,
      paddingHorizontal: 4,
    },
    filterOptionText: {
      fontSize: 15,
    },
  }), [colors]);

  const handleTagSelect = useCallback((tag: string) => {
    onFilterChange({ tag });
  }, [onFilterChange]);

  const handleFilterSelect = useCallback((groupKey: DoubanFilterKey, value: string) => {
    onFilterChange({ filterKey: groupKey, filterValue: value });
  }, [onFilterChange]);

  return (
    <Modal transparent={true} visible={isVisible} onRequestClose={onClose} animationType="fade">
      <View style={{ flex: 1 }}>
        <View style={[styles.panel, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 20 }]}>
          <ScrollView>
            {category.tags && category.tags.length > 0 && (
              <TagList
                tags={category.tags}
                selectedTag={category.tag}
                onSelect={handleTagSelect}
                styles={styles}
              />
            )}

            {category.filterConfig && (
              <View style={styles.filterSection}>
                {category.filterConfig.groups.map((group, index) => (
                  <FilterGroupList
                    key={group.key}
                    group={group}
                    activeValue={category.activeFilters?.[group.key] ?? group.defaultValue}
                    onSelect={handleFilterSelect}
                    styles={styles}
                    isFirstGroup={index === 0}
                    hasTags={!!(category.tags && category.tags.length > 0)}
                  />
                ))}
              </View>
            )}
          </ScrollView>
        </View>
        <TouchableOpacity style={{ flex: 1 }} onPress={handleClose} activeOpacity={0} />
      </View>
    </Modal>
  );
};

export default FilterPanel;
