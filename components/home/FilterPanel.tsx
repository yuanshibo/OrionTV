import React, { useMemo, useEffect } from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList } from "react-native";
import { Category, DoubanFilterKey } from "@/stores/homeStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyledButton } from "@/components/StyledButton";
import { Colors } from "@/constants/Colors";
import { useFocusStore } from "@/stores/focusStore";
import { FocusPriority } from "@/types/focus";

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

  const handleTagSelect = (tag: string) => {
    onFilterChange({ tag });
  };

  const handleFilterSelect = (groupKey: DoubanFilterKey, value: string) => {
    onFilterChange({ filterKey: groupKey, filterValue: value });
  };

  const renderTags = () => {
    if (!category.tags || category.tags.length === 0) return null;
    return (
      <View style={styles.filterGroup}>
        <Text style={styles.filterGroupLabel}>标签</Text>
        <FlatList
          horizontal
          data={category.tags}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(tag) => tag}
          renderItem={({ item: tag, index }) => {
            const isSelected = category.tag === tag;
            return (
              <StyledButton
                text={tag}
                onPress={() => handleTagSelect(tag)}
                isSelected={isSelected}
                style={styles.filterOptionButton}
                textStyle={styles.filterOptionText}
                variant="ghost"
                hasTVPreferredFocus={index === 0 && !category.filterConfig} // Focus here if no other filters exist
              />
            );
          }}
        />
      </View>
    );
  };

  const renderFilters = () => {
    if (!category.filterConfig) return null;

    return (
      <View style={styles.filterSection}>
        {category.filterConfig.groups.map((group, groupIndex) => {
          const activeValue = category.activeFilters?.[group.key] ?? group.defaultValue;

          return (
            <View key={group.key} style={styles.filterGroup}>
              <Text style={styles.filterGroupLabel}>{group.label}</Text>
              <FlatList
                horizontal
                data={group.options}
                showsHorizontalScrollIndicator={false}
                keyExtractor={(option) => option.value}
                renderItem={({ item: option, index: optionIndex }) => {
                  const isSelected = activeValue === option.value;
                  return (
                    <StyledButton
                      text={option.label}
                      onPress={() => handleFilterSelect(group.key, option.value)}
                      isSelected={isSelected}
                      style={styles.filterOptionButton}
                      textStyle={styles.filterOptionText} // Simplified: no conditional style
                      hasTVPreferredFocus={!category.tags && groupIndex === 0 && optionIndex === 0}
                    />
                  );
                }}
              />
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <Modal transparent={true} visible={isVisible} onRequestClose={onClose} animationType="fade">
      <View style={{ flex: 1 }}>
        <View style={[styles.panel, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 20 }]}>
          <ScrollView>
            {renderTags()}
            {renderFilters()}
          </ScrollView>
        </View>
        <TouchableOpacity style={{ flex: 1 }} onPress={handleClose} activeOpacity={0} />
      </View>
    </Modal>
  );
};

export default FilterPanel;
