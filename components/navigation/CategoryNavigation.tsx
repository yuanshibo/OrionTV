import React, { useEffect, useRef, useCallback, memo, useMemo } from "react";
import { View, ViewStyle, TextStyle, findNodeHandle, TVFocusGuideView } from "react-native";
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
  searchButtonRef?: React.RefObject<any>;
  firstItemRef?: React.RefObject<any>;
  allCategoryRef?: React.MutableRefObject<any>;
  searchButtonTag?: number;
  onSelectedCategoryMount?: (tag: number) => void;
  onAllCategoryMount?: (tag: number) => void;
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
  hasTVPreferredFocus?: boolean;
  nextFocusUp?: number;
  nextFocusDown?: number;
  nextFocusLeft?: number;
  nextFocusRight?: number;
}

const CategoryItem = memo(({
  item,
  index,
  isSelected,
  onSelect,
  onLongPress,
  onFocus,
  styles,
  setRef,
  hasTVPreferredFocus,
  nextFocusUp,
  nextFocusDown,
  nextFocusLeft,
  nextFocusRight,
}: CategoryItemProps) => (
  <StyledButton
    ref={(ref) => setRef(index, ref)}
    text={item.title}
    onPress={() => onSelect(item)}
    onLongPress={() => onLongPress && onLongPress(item)}
    onFocus={() => onFocus(index)}
    isSelected={isSelected}
    hasTVPreferredFocus={hasTVPreferredFocus}
    nextFocusUp={nextFocusUp}
    nextFocusDown={nextFocusDown}
    nextFocusLeft={nextFocusLeft}
    nextFocusRight={nextFocusRight}
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
  setRef?: (index: number, ref: any) => void;
  nextFocusUp?: number;
  nextFocusDown?: number;
}

const TagItem = memo(({
  item,
  index,
  isSelected,
  onSelect,
  onFocus,
  styles,
  setRef,
  nextFocusUp,
  nextFocusDown,
}: TagItemProps) => (
  <StyledButton
    ref={setRef ? (ref) => setRef(index, ref) : undefined}
    text={item}
    onPress={() => onSelect(item)}
    onFocus={() => onFocus(index)}
    isSelected={isSelected}
    nextFocusUp={nextFocusUp}
    nextFocusDown={nextFocusDown}
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
  searchButtonRef,
  firstItemRef,
  allCategoryRef,
  searchButtonTag: propSearchButtonTag,
  onSelectedCategoryMount,
  onAllCategoryMount,
}) => {
  const buttonRefs = useRef<(any)[]>([]);
  const tagButtonRefs = useRef<(any)[]>([]);
  const categoryListRef = useRef<FlashListRef<Category>>(null);
  const tagListRef = useRef<FlashListRef<string>>(null);
  const lastSelectedTitleRef = useRef<string | undefined>(undefined);
  const lastFocusTriggerRef = useRef<number | undefined>(undefined);

  const setCurrentFocusArea = useHomeUIStore((state) => state.setCurrentFocusArea);
  const setFocusArea = useFocusStore((state) => state.setFocusArea);

  const hasTags = Boolean(selectedCategory?.tags && selectedCategory.tags.length > 0);

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
    if (selectedCategory && categories[index]?.title === selectedCategory.title) {
      if (selectedCategoryRef) {
        selectedCategoryRef.current = ref;
      }
      if (onSelectedCategoryMount && ref) {
        const tag = findNodeHandle(ref);
        if (tag) onSelectedCategoryMount(tag);
      }
    }
    if (index === categories.length - 1) {
      if (allCategoryRef) {
        allCategoryRef.current = ref;
      }
      if (onAllCategoryMount && ref) {
        const tag = findNodeHandle(ref);
        if (tag) onAllCategoryMount(tag);
      }
    }
  }, [categories, selectedCategory, selectedCategoryRef, allCategoryRef, onSelectedCategoryMount, onAllCategoryMount]);

  const setTagRef = useCallback((index: number, ref: any) => {
    tagButtonRefs.current[index] = ref;
  }, []);

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

  const currentTags = selectedCategory?.tags;
  const currentTag = selectedCategory?.tag;

  const activeTagIndex = useMemo(() => {
    if (!currentTags || !currentTag) return 0;
    const idx = currentTags.findIndex((t) => t === currentTag);
    return idx >= 0 ? idx : 0;
  }, [currentTags, currentTag]);

  const activeTagTag = tagButtonRefs.current[activeTagIndex]
    ? (findNodeHandle(tagButtonRefs.current[activeTagIndex]) ?? undefined)
    : undefined;

  const searchButtonTag = propSearchButtonTag ?? (searchButtonRef?.current
    ? (findNodeHandle(searchButtonRef.current) ?? undefined)
    : undefined);

  const firstItemTag = firstItemRef?.current
    ? (findNodeHandle(firstItemRef.current) ?? undefined)
    : undefined;

  const selectedCategoryTag = selectedCategoryRef?.current
    ? (findNodeHandle(selectedCategoryRef.current) ?? undefined)
    : undefined;

  const targetDestination = hasTags
    ? (tagButtonRefs.current[activeTagIndex] || selectedCategoryRef?.current)
    : selectedCategoryRef?.current;

  const renderCategory = useCallback(
    ({ item, index }: { item: Category; index: number }) => {
      const isSelected = selectedCategory?.title === item.title;
      const isLastItem = index === categories.length - 1;
      const selfTag = buttonRefs.current[index]
        ? (findNodeHandle(buttonRefs.current[index]) ?? undefined)
        : undefined;

      return (
        <CategoryItem
          item={item}
          index={index}
          isSelected={isSelected}
          onSelect={onCategorySelect}
          onLongPress={onCategoryLongPress}
          onFocus={handleCategoryFocus}
          styles={categoryStyles}
          setRef={setRef}
          hasTVPreferredFocus={index === 0 && isSelected && deviceType === "tv"}
          nextFocusUp={searchButtonTag}
          nextFocusDown={hasTags ? activeTagTag : firstItemTag}
          nextFocusLeft={index === 0 ? selfTag : undefined}
          nextFocusRight={isLastItem ? searchButtonTag : undefined}
        />
      );
    },
    [selectedCategory?.title, categories.length, onCategorySelect, onCategoryLongPress, handleCategoryFocus, categoryStyles, setRef, deviceType, searchButtonTag, hasTags, activeTagTag, firstItemTag]
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
        setRef={setTagRef}
        nextFocusUp={selectedCategoryTag}
        nextFocusDown={firstItemTag}
      />
    ),
    [selectedCategory?.tag, onTagSelect, handleTagFocus, categoryStyles, setTagRef, selectedCategoryTag, firstItemTag]
  );

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
    <TVFocusGuideView
      trapFocusUp={false}
      trapFocusDown={false}
      destinations={targetDestination ? [targetDestination] : []}
    >
      <View style={[categoryStyles.categoryContainer, hasTags && { paddingBottom: spacing * 0.8 }]}>
        <FlashListAny
          ref={categoryListRef}
          horizontal
          data={categories}
          renderItem={renderCategory}
          keyExtractor={(item: Category) => item.title}
          showsHorizontalScrollIndicator={false}
          removeClippedSubviews={false}
          contentContainerStyle={categoryStyles.categoryListContent}
          {...categoryListConfig}
        />
        {hasTags && (
          <FlashListAny
            ref={tagListRef}
            horizontal
            data={selectedCategory?.tags}
            renderItem={renderTag}
            keyExtractor={(item: string) => item}
            showsHorizontalScrollIndicator={false}
            removeClippedSubviews={false}
            contentContainerStyle={categoryStyles.categoryListContent}
            {...tagListConfig}
          />
        )}
      </View>
    </TVFocusGuideView>
  );
};

export const CategoryNavigation = memo(CategoryNavigationComponent);

