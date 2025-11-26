import React, { useEffect, useRef, useCallback, memo } from "react";
import { View, ViewStyle, TextStyle } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { StyledButton } from "@/components/StyledButton";
import { Category } from "@/services/dataTypes";
import { requestTVFocus } from "@/utils/tvUtils";

interface CategoryNavigationProps {
  categories: Category[];
  selectedCategory: Category | null;
  onCategorySelect: (category: Category) => void;
  onCategoryLongPress?: (category: Category) => void;
  onTagSelect: (tag: string) => void;
  categoryStyles: {
    categoryContainer: ViewStyle;
    categoryListContent: ViewStyle;
    categoryButton: ViewStyle;
    categoryText: TextStyle;
  };
  deviceType: "mobile" | "tablet" | "tv";
  spacing: number;
  focusTrigger?: number;
}

interface CategoryItemProps {
  item: Category;
  index: number;
  isSelected: boolean;
  onSelect: (category: Category) => void;
  onLongPress?: (category: Category) => void;
  styles: any;
  setRef: (index: number, ref: any) => void;
}

const CategoryItem = memo(({ item, index, isSelected, onSelect, onLongPress, styles, setRef }: CategoryItemProps) => (
  <StyledButton
    ref={(ref) => setRef(index, ref)}
    hasTVPreferredFocus={index === 0}
    text={item.title}
    onPress={() => onSelect(item)}
    onLongPress={() => onLongPress && onLongPress(item)}
    isSelected={isSelected}
    style={styles.categoryButton}
    textStyle={styles.categoryText}
  />
));

CategoryItem.displayName = "CategoryItem";

interface TagItemProps {
  item: string;
  index: number;
  isSelected: boolean;
  onSelect: (tag: string) => void;
  styles: any;
}

const TagItem = memo(({ item, index, isSelected, onSelect, styles }: TagItemProps) => (
  <StyledButton
    text={item}
    onPress={() => onSelect(item)}
    isSelected={isSelected}
    style={styles.categoryButton}
    textStyle={styles.categoryText}
    variant="ghost"
  />
));

TagItem.displayName = "TagItem";

const CategoryNavigationComponent: React.FC<CategoryNavigationProps> = ({
  categories,
  selectedCategory,
  onCategorySelect,
  onCategoryLongPress,
  onTagSelect,
  categoryStyles,
  deviceType,
  spacing,
  focusTrigger,
}) => {
  const buttonRefs = useRef<(any)[]>([]);
  const lastSelectedTitleRef = useRef<string | undefined>(undefined);
  const lastFocusTriggerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (focusTrigger && selectedCategory) {
      const shouldFocus =
        lastSelectedTitleRef.current !== selectedCategory.title ||
        lastFocusTriggerRef.current !== focusTrigger;

      lastSelectedTitleRef.current = selectedCategory.title;
      lastFocusTriggerRef.current = focusTrigger;

      if (shouldFocus) {
        const index = categories.findIndex((c) => c.title === selectedCategory.title);
        const buttonRef = buttonRefs.current[index];
        requestTVFocus(buttonRef);
      }
    }
  }, [focusTrigger, selectedCategory, categories]);

  const setRef = useCallback((index: number, ref: any) => {
    buttonRefs.current[index] = ref;
  }, []);

  const renderCategory = useCallback(
    ({ item, index }: { item: Category; index: number }) => (
      <CategoryItem
        item={item}
        index={index}
        isSelected={selectedCategory?.title === item.title}
        onSelect={onCategorySelect}
        onLongPress={onCategoryLongPress}
        styles={categoryStyles}
        setRef={setRef}
      />
    ),
    [selectedCategory?.title, onCategorySelect, onCategoryLongPress, categoryStyles, setRef]
  );

  const renderTag = useCallback(
    ({ item, index }: { item: string; index: number }) => (
      <TagItem
        item={item}
        index={index}
        isSelected={selectedCategory?.tag === item}
        onSelect={onTagSelect}
        styles={categoryStyles}
      />
    ),
    [selectedCategory?.tag, onTagSelect, categoryStyles]
  );

  const hasTags = selectedCategory?.type === "record";

  return (
    <View style={[categoryStyles.categoryContainer, hasTags && { paddingBottom: spacing * 0.8 }]}>
      <FlashList
        horizontal
        data={categories}
        renderItem={renderCategory}
        keyExtractor={(item) => item.title}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={categoryStyles.categoryListContent}
        estimatedItemSize={80}
      />
      {selectedCategory?.tags && (
        <FlashList
          horizontal
          data={selectedCategory.tags}
          renderItem={renderTag}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={categoryStyles.categoryListContent}
          estimatedItemSize={60}
        />
      )}
    </View>
  );
};

export const CategoryNavigation = memo(CategoryNavigationComponent);
