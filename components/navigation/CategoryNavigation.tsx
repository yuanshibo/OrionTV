import React from "react";
import { FlatList, View } from "react-native";
import { StyledButton } from "@/components/StyledButton";
import { Category } from "@/stores/homeStore";

interface CategoryNavigationProps {
  categories: Category[];
  selectedCategory: Category | null;
  onCategorySelect: (category: Category) => void;
  onCategoryLongPress?: (category: Category) => void;
  onTagSelect: (tag: string) => void;
  categoryStyles: any;
  deviceType: "mobile" | "tablet" | "tv";
  spacing: number;
}

export const CategoryNavigation: React.FC<CategoryNavigationProps> = ({ categories, selectedCategory, onCategorySelect, onCategoryLongPress, onTagSelect, categoryStyles, deviceType, spacing }) => {
  const renderCategory = ({ item, index }: { item: Category; index: number }) => {
    const isSelected = selectedCategory?.title === item.title;
    return (
      <StyledButton
        hasTVPreferredFocus={index === 0}
        text={item.title}
        onPress={() => onCategorySelect(item)}
        onLongPress={() => onCategoryLongPress && onCategoryLongPress(item)}
        isSelected={isSelected}
        style={categoryStyles.categoryButton}
        textStyle={categoryStyles.categoryText}
      />
    );
  };

  const renderTag = ({ item, index }: { item: string; index: number }) => {
    const isSelected = selectedCategory?.tag === item;
    return (
      <StyledButton
        hasTVPreferredFocus={index === 0}
        text={item}
        onPress={() => onTagSelect(item)}
        isSelected={isSelected}
        style={categoryStyles.categoryButton}
        textStyle={categoryStyles.categoryText}
        variant="ghost"
      />
    );
  };

  return (
    <View style={categoryStyles.categoryContainer}>
      <FlatList
        horizontal
        data={categories}
        renderItem={renderCategory}
        keyExtractor={(item) => item.title}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={categoryStyles.categoryListContent}
      />
      {selectedCategory?.tags && (
        <FlatList
          horizontal
          data={selectedCategory.tags}
          renderItem={renderTag}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={categoryStyles.categoryListContent}
        />
      )}
    </View>
  );
};
