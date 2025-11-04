import React from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, BackHandler, FlatList } from "react-native";
import { Category, DoubanFilterKey } from "@/stores/homeStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyledButton } from "@/components/StyledButton";

interface FilterPanelProps {
  isVisible: boolean;
  onClose: () => void;
  category: Category;
  onFilterChange: (change: { tag: string } | { filterKey: DoubanFilterKey; filterValue: string }) => void;
  deviceType: "mobile" | "tablet" | "tv";
}

const FilterPanel: React.FC<FilterPanelProps> = ({ isVisible, onClose, category, onFilterChange, deviceType }) => {
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (isVisible) {
        onClose();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [isVisible, onClose]);

  const handleTagSelect = (tag: string) => {
    onFilterChange({ tag });
  };

  const handleFilterSelect = (groupKey: DoubanFilterKey, value: string) => {
    onFilterChange({ filterKey: groupKey, filterValue: value });
  };

  const renderTags = () => {
    if (!category.tags) return null;
    return (
      <View style={styles.tagsContainer}>
        {category.tags.map((tag) => (
          <TouchableOpacity key={tag} onPress={() => handleTagSelect(tag)} style={[styles.tag, category.tag === tag && styles.selectedTag]}>
            <Text style={[styles.tagText, category.tag === tag && styles.selectedTagText]}>{tag}</Text>
          </TouchableOpacity>
        ))}
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
                      textStyle={[styles.filterOptionText, isSelected && styles.selectedFilterOptionText]}
                      variant="ghost"
                      hasTVPreferredFocus={groupIndex === 0 && optionIndex === 0}
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
        <View style={[styles.panel, { paddingTop: insets.top + 10 }]}>
          <ScrollView>
            {renderTags()}
            {renderFilters()}
          </ScrollView>
        </View>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={0} />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "rgba(10, 10, 10, 0.8)",
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: 10,
    marginTop: 10
  },
  tag: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'transparent',
    margin: 8,
    borderWidth: 1,
    borderColor: '#555',
  },
  selectedTag: {
    backgroundColor: "rgba(212, 175, 55, 0.2)",
    borderColor: '#D4AF37',
  },
  tagText: {
    color: "#EAEAEA",
    fontSize: 16,
  },
  selectedTagText: {
    color: "#D4AF37",
    fontWeight: 'bold',
  },
  filterSection: {
    width: "100%",
  },
  filterGroup: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  filterGroupLabel: {
    fontSize: 15,
    color: "#AAA",
    fontWeight: "600",
    minWidth: 50,
  },
  filterOptionButton: {
    marginRight: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  filterOptionText: {
    fontSize: 15,
    color: "#EAEAEA",
  },
  selectedFilterOptionText: {
    color: '#D4AF37',
    fontWeight: 'bold'
  }
});

export default FilterPanel;
