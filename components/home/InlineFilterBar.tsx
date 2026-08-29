import React, { useMemo, useCallback, useRef, useEffect, memo } from "react";
import { View, Text, StyleSheet, ScrollView, findNodeHandle } from "react-native";
import { Category, DoubanFilterKey, DoubanFilterGroup } from "@/types";
import { StyledButton } from "@/components/StyledButton";
import { Colors } from "@/constants/Colors";
import { SlidersHorizontal, ChevronUp, RotateCcw } from "lucide-react-native";
import { requestTVFocus } from "@/utils/tvUtils";
import { FocusPriority } from "@/types/focus";

interface InlineFilterBarProps {
  category: Category;
  onFilterChange: (change: { tag: string } | { filterKey: DoubanFilterKey; filterValue: string }) => void;
  onResetFilters?: () => void;
  deviceType: "mobile" | "tablet" | "tv";
  spacing: number;
  currentFocusArea?: "header" | "category" | "tags" | "content";
  firstRowRef?: React.MutableRefObject<any>;
  lastRowRef?: React.MutableRefObject<any>;
  firstItemRef?: React.RefObject<any>;
  selectedCategoryRef?: React.RefObject<any>;
  selectedCategoryTag?: number;
  firstItemTag?: number;
  onFirstRowMount?: (tag: number) => void;
  onLastRowMount?: (tag: number) => void;
  onFocus?: () => void;
}

interface FilterRowProps {
  group: DoubanFilterGroup;
  activeValue: string;
  onSelect: (groupKey: DoubanFilterKey, value: string) => void;
  onFocus?: () => void;
  rowIndex: number;
  totalRows: number;
  styles: any;
  setRowRef: (rowIndex: number, ref: any) => void;
  nextFocusUpTag?: number;
  nextFocusDownTag?: number;
}

const FilterRow = memo(({
  group,
  activeValue,
  onSelect,
  onFocus,
  rowIndex,
  styles,
  setRowRef,
  nextFocusUpTag,
  nextFocusDownTag,
}: FilterRowProps) => {
  return (
    <View style={styles.filterRow}>
      <Text style={styles.filterRowLabel}>{group.label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {group.options.map((option, optIndex) => {
          const isSelected = activeValue === option.value;
          return (
            <StyledButton
              key={option.value}
              ref={isSelected || (!activeValue && optIndex === 0) ? (ref) => setRowRef(rowIndex, ref) : undefined}
              text={option.label}
              onPress={() => onSelect(group.key, option.value)}
              onFocus={onFocus}
              isSelected={isSelected}
              style={styles.filterOptionButton}
              buttonStyle={styles.filterOptionInnerButton}
              textStyle={styles.filterOptionText}
              nextFocusUp={nextFocusUpTag}
              nextFocusDown={nextFocusDownTag}
            />
          );
        })}
      </ScrollView>
    </View>
  );
});

FilterRow.displayName = "FilterRow";

interface CombinedHeaderRowProps {
  kindGroup: DoubanFilterGroup;
  sortGroup: DoubanFilterGroup;
  activeKind: string;
  activeSort: string;
  onSelect: (groupKey: DoubanFilterKey, value: string) => void;
  onResetFilters?: () => void;
  onFocus?: () => void;
  styles: any;
  setRowRef: (rowIndex: number, ref: any) => void;
  nextFocusUpTag?: number;
  nextFocusDownTag?: number;
}

const CombinedHeaderRow = memo(({
  kindGroup,
  sortGroup,
  activeKind,
  activeSort,
  onSelect,
  onResetFilters,
  onFocus,
  styles,
  setRowRef,
  nextFocusUpTag,
  nextFocusDownTag,
}: CombinedHeaderRowProps) => {
  return (
    <View style={styles.filterRow}>
      {/* 分类 */}
      <Text style={styles.filterRowLabel}>{kindGroup.label}</Text>
      <View style={styles.combinedOptionGroup}>
        {kindGroup.options.map((option, optIndex) => {
          const isSelected = activeKind === option.value;
          return (
            <StyledButton
              key={option.value}
              ref={isSelected || (!activeKind && optIndex === 0) ? (ref) => setRowRef(0, ref) : undefined}
              text={option.label}
              onPress={() => onSelect(kindGroup.key, option.value)}
              onFocus={onFocus}
              isSelected={isSelected}
              style={styles.filterOptionButton}
              buttonStyle={styles.filterOptionInnerButton}
              textStyle={styles.filterOptionText}
              nextFocusUp={nextFocusUpTag}
              nextFocusDown={nextFocusDownTag}
            />
          );
        })}
      </View>

      {/* 重置按钮 */}
      {onResetFilters && (
        <StyledButton
          onPress={onResetFilters}
          onFocus={onFocus}
          variant="ghost"
          style={styles.resetButton}
          buttonStyle={styles.resetInnerButton}
          nextFocusUp={nextFocusUpTag}
          nextFocusDown={nextFocusDownTag}
        >
          <RotateCcw size={10} color="rgba(255, 255, 255, 0.7)" />
          <Text style={styles.resetButtonText}>重置</Text>
        </StyledButton>
      )}

      {/* 分割线 */}
      <View style={styles.combinedDivider} />

      {/* 排序 */}
      <Text style={styles.filterRowLabel}>{sortGroup.label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {sortGroup.options.map((option) => {
          const isSelected = activeSort === option.value;
          return (
            <StyledButton
              key={option.value}
              text={option.label}
              onPress={() => onSelect(sortGroup.key, option.value)}
              onFocus={onFocus}
              isSelected={isSelected}
              style={styles.filterOptionButton}
              buttonStyle={styles.filterOptionInnerButton}
              textStyle={styles.filterOptionText}
              nextFocusUp={nextFocusUpTag}
              nextFocusDown={nextFocusDownTag}
            />
          );
        })}
      </ScrollView>
    </View>
  );
});

CombinedHeaderRow.displayName = "CombinedHeaderRow";

export const InlineFilterBar: React.FC<InlineFilterBarProps> = memo(({
  category,
  onFilterChange,
  onResetFilters,
  currentFocusArea = "tags",
  firstRowRef,
  lastRowRef,
  firstItemRef,
  selectedCategoryRef,
  selectedCategoryTag: propSelectedCategoryTag,
  firstItemTag: propFirstItemTag,
  onFirstRowMount,
  onLastRowMount,
  onFocus,
}) => {
  const colorScheme = "dark";
  const colors = Colors[colorScheme];
  const rowRefs = useRef<(any)[]>([]);
  const collapsedRef = useRef<any>(null);

  const isCollapsed = currentFocusArea === "content";
  const groups = useMemo(() => category.filterConfig?.groups || [], [category.filterConfig]);

  // Split groups into combined (kind + sort) and regular rows
  const { kindGroup, sortGroup, regularGroups, totalRenderRows } = useMemo(() => {
    const kind = groups.find((g) => g.key === "kind");
    const sort = groups.find((g) => g.key === "sort");
    const regular = groups.filter((g) => g.key !== "kind" && g.key !== "sort");
    const totalRows = kind && sort ? 1 + regular.length : groups.length;
    return { kindGroup: kind, sortGroup: sort, regularGroups: regular, totalRenderRows: totalRows };
  }, [groups]);

  // Generate readable summary string for collapsed view
  const summaryText = useMemo(() => {
    if (!category.filterConfig) return "";
    const parts: string[] = [];
    parts.push(category.type === "movie" ? "电影" : "电视剧");
    const filters = (category.activeFilters as Record<string, string> | undefined) || {};

    for (const group of category.filterConfig.groups) {
      if (group.key === "kind") continue;
      const active = filters[group.key] ?? group.defaultValue;
      const opt = group.options.find((o) => o.value === active);
      if (opt && active !== "all" && active !== "") {
        parts.push(opt.label);
      }
    }
    if (parts.length === 1) {
      parts.push("全部", "综合排序");
    }
    return parts.join(" · ");
  }, [category.filterConfig, category.type, category.activeFilters]);

  const setRowRef = useCallback((rowIndex: number, ref: any) => {
    rowRefs.current[rowIndex] = ref;
    if (ref) {
      const tag = findNodeHandle(ref);
      if (tag) {
        if (rowIndex === 0) {
          if (firstRowRef) firstRowRef.current = ref;
          if (onFirstRowMount) onFirstRowMount(tag);
        }
        if (rowIndex === totalRenderRows - 1) {
          if (lastRowRef) lastRowRef.current = ref;
          if (onLastRowMount) onLastRowMount(tag);
        }
      }
    }
  }, [totalRenderRows, firstRowRef, lastRowRef, onFirstRowMount, onLastRowMount]);

  const setCollapsedRef = useCallback((ref: any) => {
    collapsedRef.current = ref;
    if (ref) {
      const tag = findNodeHandle(ref);
      if (tag) {
        if (firstRowRef) firstRowRef.current = ref;
        if (lastRowRef) lastRowRef.current = ref;
        if (onFirstRowMount) onFirstRowMount(tag);
        if (onLastRowMount) onLastRowMount(tag);
      }
    }
  }, [firstRowRef, lastRowRef, onFirstRowMount, onLastRowMount]);

  const handleFilterSelect = useCallback((groupKey: DoubanFilterKey, value: string) => {
    onFilterChange({ filterKey: groupKey, filterValue: value });
  }, [onFilterChange]);

  const handleCollapsedFocus = useCallback(() => {
    if (onFocus) onFocus();
    setTimeout(() => {
      const target = rowRefs.current[0];
      if (target) {
        requestTVFocus(target, { priority: FocusPriority.NAVIGATION, duration: 200 });
      }
    }, 40);
  }, [onFocus]);

  const wasCollapsedRef = useRef(isCollapsed);
  useEffect(() => {
    if (wasCollapsedRef.current && !isCollapsed && currentFocusArea === "tags") {
      const timer = setTimeout(() => {
        const target = rowRefs.current[0];
        if (target) {
          requestTVFocus(target, { priority: FocusPriority.NAVIGATION, duration: 200 });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
    wasCollapsedRef.current = isCollapsed;
  }, [isCollapsed, currentFocusArea]);

  const selectedCategoryTag = propSelectedCategoryTag ?? (selectedCategoryRef?.current
    ? (findNodeHandle(selectedCategoryRef.current) ?? undefined)
    : undefined);

  const firstItemTag = propFirstItemTag ?? (firstItemRef?.current
    ? (findNodeHandle(firstItemRef.current) ?? undefined)
    : undefined);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      paddingHorizontal: 20,
      paddingVertical: 0,
      marginBottom: isCollapsed ? 3 : 1,
    },
    collapsedBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: "rgba(255, 255, 255, 0.06)",
      borderRadius: 5,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.08)",
    },
    collapsedLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    collapsedLabel: {
      fontSize: 10.5,
      color: "rgba(255, 255, 255, 0.6)",
      marginLeft: 4,
      marginRight: 5,
      fontWeight: "600",
    },
    collapsedSummary: {
      fontSize: 10.5,
      color: colors.tint,
      fontWeight: "600",
      flex: 1,
    },
    collapsedHint: {
      flexDirection: "row",
      alignItems: "center",
    },
    collapsedHintText: {
      fontSize: 9.5,
      color: "rgba(255, 255, 255, 0.4)",
      marginLeft: 2,
    },
    filterRow: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 0.5,
    },
    filterRowLabel: {
      fontSize: 10.5,
      color: colors.text,
      opacity: 0.7,
      fontWeight: "600",
      minWidth: 26,
      marginRight: 6,
    },
    scrollContent: {
      alignItems: "center",
      paddingRight: 20,
    },
    combinedOptionGroup: {
      flexDirection: "row",
      alignItems: "center",
    },
    combinedDivider: {
      width: 1,
      height: 11,
      backgroundColor: "rgba(255, 255, 255, 0.15)",
      marginHorizontal: 8,
    },
    resetButton: {
      marginLeft: 3,
      marginRight: 2,
      paddingVertical: 0,
      paddingHorizontal: 1,
    },
    resetInnerButton: {
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 5,
      backgroundColor: "rgba(255, 255, 255, 0.08)",
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
    },
    resetButtonText: {
      fontSize: 10.5,
      color: "rgba(255, 255, 255, 0.7)",
      fontWeight: "500",
    },
    filterOptionButton: {
      marginRight: 2,
      paddingVertical: 0,
      paddingHorizontal: 1,
    },
    filterOptionInnerButton: {
      paddingHorizontal: 9,
      paddingVertical: 3.5,
      borderRadius: 5,
    },
    filterOptionText: {
      fontSize: 10.5,
    },
  }), [colors, isCollapsed]);

  if (!category.filterConfig || groups.length === 0) {
    return null;
  }

  // Collapsed mode: single line summary bar
  if (isCollapsed) {
    return (
      <View style={styles.container}>
        <StyledButton
          ref={setCollapsedRef}
          style={styles.collapsedBar}
          onPress={handleCollapsedFocus}
          onFocus={handleCollapsedFocus}
          variant="ghost"
          nextFocusUp={selectedCategoryTag}
          nextFocusDown={firstItemTag}
        >
          <View style={styles.collapsedLeft}>
            <SlidersHorizontal size={12} color={colors.tint} />
            <Text style={styles.collapsedLabel}>筛选:</Text>
            <Text style={styles.collapsedSummary} numberOfLines={1}>
              {summaryText}
            </Text>
          </View>
          <View style={styles.collapsedHint}>
            <ChevronUp size={12} color="rgba(255, 255, 255, 0.4)" />
            <Text style={styles.collapsedHintText}>按上键展开筛选</Text>
          </View>
        </StyledButton>
      </View>
    );
  }

  const activeFilters = (category.activeFilters as Record<string, string> | undefined) || {};

  // Expanded mode: merged kind & sort in row 0 if both present, followed by other filter rows
  if (kindGroup && sortGroup) {
    const activeKind = activeFilters[kindGroup.key] ?? kindGroup.defaultValue;
    const activeSort = activeFilters[sortGroup.key] ?? sortGroup.defaultValue;
    const nextRowRef = rowRefs.current[1];
    const row0NextDownTag = nextRowRef ? (findNodeHandle(nextRowRef) ?? undefined) : undefined;

    return (
      <View style={styles.container}>
        {/* Row 0: Merged 分类 + 排序 */}
        <CombinedHeaderRow
          kindGroup={kindGroup}
          sortGroup={sortGroup}
          activeKind={activeKind}
          activeSort={activeSort}
          onSelect={handleFilterSelect}
          onResetFilters={onResetFilters}
          onFocus={onFocus}
          styles={styles}
          setRowRef={setRowRef}
          nextFocusUpTag={selectedCategoryTag}
          nextFocusDownTag={row0NextDownTag}
        />

        {/* Regular Rows: 类型、地区、年代、特色等 */}
        {regularGroups.map((group, regIndex) => {
          const rowIndex = regIndex + 1;
          const activeValue = activeFilters[group.key] ?? group.defaultValue;
          const isLastRow = rowIndex === totalRenderRows - 1;

          const prevRowRef = rowRefs.current[rowIndex - 1];
          const nextRowRefTarget = rowRefs.current[rowIndex + 1];

          const nextFocusUpTag = prevRowRef ? (findNodeHandle(prevRowRef) ?? undefined) : undefined;
          const nextFocusDownTag = isLastRow
            ? firstItemTag
            : (nextRowRefTarget ? (findNodeHandle(nextRowRefTarget) ?? undefined) : undefined);

          return (
            <FilterRow
              key={group.key}
              group={group}
              activeValue={activeValue}
              onSelect={handleFilterSelect}
              onFocus={onFocus}
              rowIndex={rowIndex}
              totalRows={totalRenderRows}
              styles={styles}
              setRowRef={setRowRef}
              nextFocusUpTag={nextFocusUpTag}
              nextFocusDownTag={nextFocusDownTag}
            />
          );
        })}
      </View>
    );
  }

  // Fallback: regular sequential rendering
  return (
    <View style={styles.container}>
      {groups.map((group, index) => {
        const activeValue = activeFilters[group.key] ?? group.defaultValue;
        const isFirstRow = index === 0;
        const isLastRow = index === groups.length - 1;

        const prevRowRef = rowRefs.current[index - 1];
        const nextRowRef = rowRefs.current[index + 1];

        const nextFocusUpTag = isFirstRow
          ? selectedCategoryTag
          : (prevRowRef ? (findNodeHandle(prevRowRef) ?? undefined) : undefined);

        const nextFocusDownTag = isLastRow
          ? firstItemTag
          : (nextRowRef ? (findNodeHandle(nextRowRef) ?? undefined) : undefined);

        return (
          <FilterRow
            key={group.key}
            group={group}
            activeValue={activeValue}
            onSelect={handleFilterSelect}
            onFocus={onFocus}
            rowIndex={index}
            totalRows={groups.length}
            styles={styles}
            setRowRef={setRowRef}
            nextFocusUpTag={nextFocusUpTag}
            nextFocusDownTag={nextFocusDownTag}
          />
        );
      })}
    </View>
  );
});

InlineFilterBar.displayName = "InlineFilterBar";
export default InlineFilterBar;
