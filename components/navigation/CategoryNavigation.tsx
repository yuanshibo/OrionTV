import React, { useEffect, useRef, useCallback, memo, useMemo } from "react";
import { View, ViewStyle, TextStyle } from "react-native";
import { FlashList, FlashListRef } from "@shopify/flash-list";
import { StyledButton } from "@/components/StyledButton";
import { Category } from "@/services/dataTypes";
import { requestTVFocus } from "@/utils/tvUtils";
import { useFocusStore } from "@/stores/focusStore";
import { useHomeUIStore } from "@/stores/homeUIStore";
import { FocusPriority } from "@/types/focus";
import { FlashListOptimizer } from "@/utils/FlashListOptimizer";

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
  selectedCategoryRef?: React.MutableRefObject<any>;
}

interface CategoryItemProps {
  item: Category;
  index: number;
  isSelected: boolean;
  onSelect: (category: Category) => void;
  onLongPress?: (category: Category) => void;
  onFocus: (index: number) => void;
  styles: any;
  setRef: (index: number, ref: any) => void;
}

const CategoryItem = memo(({ item, index, isSelected, onSelect, onLongPress, onFocus, styles, setRef }: CategoryItemProps) => (
  <StyledButton
    ref={(ref) => setRef(index, ref)}
    text={item.title}
    onPress={() => onSelect(item)}
    onLongPress={() => onLongPress && onLongPress(item)}
    onFocus={() => onFocus(index)}
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
  onFocus: (index: number) => void;
  styles: any;
}

const TagItem = memo(({ item, index, isSelected, onSelect, onFocus, styles }: TagItemProps) => (
  <StyledButton
    text={item}
    onPress={() => onSelect(item)}
    onFocus={() => onFocus(index)}
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
  selectedCategoryRef,
}) => {
  const buttonRefs = useRef<(any)[]>([]);
  const categoryListRef = useRef<FlashListRef<Category>>(null);
  const tagListRef = useRef<FlashListRef<string>>(null);
  const lastSelectedTitleRef = useRef<string | undefined>(undefined);
  const lastFocusTriggerRef = useRef<number | undefined>(undefined);

  const setCurrentFocusArea = useHomeUIStore((state) => state.setCurrentFocusArea);
  const setFocusArea = useFocusStore((state) => state.setFocusArea);

  useEffect(() => {
    setFocusArea('navigation', FocusPriority.NAVIGATION);
  }, [setFocusArea]);

  useEffect(() => {
    if (focusTrigger && selectedCategory) {
      const shouldFocus =
        lastSelectedTitleRef.current !== selectedCategory.title ||
        lastFocusTriggerRef.current !== focusTrigger;

      lastSelectedTitleRef.current = selectedCategory.title;
      lastFocusTriggerRef.current = focusTrigger;

      if (shouldFocus) {
        const index = categories.findIndex((c) => c.title === selectedCategory.title);
        if (index >= 0) {
          const buttonRef = buttonRefs.current[index];
          requestTVFocus(buttonRef, {
            priority: FocusPriority.NAVIGATION,
            duration: 300,
          });
          try {
            categoryListRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
          } catch {}
        }
      }
    }
  }, [focusTrigger, selectedCategory, categories]);

  const setRef = useCallback((index: number, ref: any) => {
    buttonRefs.current[index] = ref;
    if (selectedCategory && categories[index]?.title === selectedCategory.title && selectedCategoryRef) {
      selectedCategoryRef.current = ref;
    }
  }, [categories, selectedCategory, selectedCategoryRef]);

  const handleCategoryFocus = useCallback((index: number) => {
    setCurrentFocusArea('category');
    try {
      categoryListRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
    } catch {}
  }, [setCurrentFocusArea]);

  const handleTagFocus = useCallback((index: number) => {
    setCurrentFocusArea('tags');
    try {
      tagListRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
    } catch {}
  }, [setCurrentFocusArea]);

  const renderCategory = useCallback(
    ({ item, index }: { item: Category; index: number }) => (
      <CategoryItem
        item={item}
        index={index}
        isSelected={selectedCategory?.title === item.title}
        onSelect={onCategorySelect}
        onLongPress={onCategoryLongPress}
        onFocus={handleCategoryFocus}
        styles={categoryStyles}
        setRef={setRef}
      />
    ),
    [selectedCategory?.title, onCategorySelect, onCategoryLongPress, handleCategoryFocus, categoryStyles, setRef]
  );

  const renderTag = useCallback(
    ({ item, index }: { item: string; index: number }) => (
      <TagItem
        item={item}
        index={index}
        isSelected={selectedCategory?.tag === item}
        onSelect={onTagSelect}
        onFocus={handleTagFocus}
        styles={categoryStyles}
      />
    ),
    [selectedCategory?.tag, onTagSelect, handleTagFocus, categoryStyles]
  );

  const hasTags = selectedCategory?.type === "record";

  const categoryListConfig = useMemo(() => 
    FlashListOptimizer.getHorizontalListConfig(deviceType, 90),
    [deviceType]
  );

  const tagListConfig = useMemo(() => 
    FlashListOptimizer.getHorizontalListConfig(deviceType, 70),
    [deviceType]
  );

  const FlashListAny = FlashList as any;

  return (
    <View style={[categoryStyles.categoryContainer, hasTags && { paddingBottom: spacing * 0.8 }]}>
      <FlashListAny
        ref={categoryListRef}
        horizontal
        data={categories}
        renderItem={renderCategory}
        keyExtractor={(item: Category) => item.title}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={categoryStyles.categoryListContent}
        {...categoryListConfig}
      />
      {selectedCategory?.tags && (
        <FlashListAny
          ref={tagListRef}
          horizontal
          data={selectedCategory.tags}
          renderItem={renderTag}
          keyExtractor={(item: string) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={categoryStyles.categoryListContent}
          {...tagListConfig}
        />
      )}
    </View>
  );
};

export const CategoryNavigation = memo(CategoryNavigationComponent);

