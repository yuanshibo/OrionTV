import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { View, StyleSheet, FlatList, findNodeHandle, useTVEventHandler, HWEvent } from "react-native";
import { StyledButton } from "./StyledButton";
import { PlayerModalBase } from "./player/PlayerModalBase";
import usePlayerStore from "@/stores/playerStore";
import { chunkEpisodes } from "@/utils/episodeUtils";

const EPISODE_GROUP_SIZE = 30;

const normalizeEventType = (type: string): string => {
  switch (type) {
    case "up":
    case "dpadUp":
    case "upPress":
      return "up";
    case "down":
    case "dpadDown":
    case "downPress":
      return "down";
    case "left":
    case "dpadLeft":
    case "leftPress":
      return "left";
    case "right":
    case "dpadRight":
    case "rightPress":
      return "right";
    case "select":
    case "dpadCenter":
      return "select";
    case "backPress":
    case "back":
      return "back";
    default:
      return type;
  }
};

export const EpisodeSelectionModal: React.FC = () => {
  const { showEpisodeModal } = usePlayerStore();

  if (!showEpisodeModal) return null;

  return <EpisodeSelectionModalContent />;
};

const EpisodeSelectionModalContent: React.FC = () => {
  const { showEpisodeModal, episodes, currentEpisodeIndex, playEpisode, setShowEpisodeModal } = usePlayerStore();

  const initialGroup = currentEpisodeIndex >= 0 ? Math.floor(currentEpisodeIndex / EPISODE_GROUP_SIZE) : 0;
  const initialLocal = currentEpisodeIndex >= 0 ? currentEpisodeIndex % EPISODE_GROUP_SIZE : 0;

  const [selectedEpisodeGroup, setSelectedEpisodeGroup] = useState(initialGroup);
  const [focusedArea, setFocusedArea] = useState<"episodes" | "range">("episodes");
  const [groupFocusGeneration, setGroupFocusGeneration] = useState(0);

  // focusedEpisodeIndex 仅用于切换分组后通过 hasTVPreferredFocus 指定初始焦点，
  // 导航中不再通过它触发重渲染，避免 keyExtractor 变化引起所有 item 重新挂载
  const [focusedEpisodeIndex, setFocusedEpisodeIndex] = useState<number>(initialLocal);

  const groupFlatListRef = useRef<FlatList>(null);
  const chunks = useMemo(() => chunkEpisodes(episodes, EPISODE_GROUP_SIZE), [episodes]);

  // Synchronous refs for TV remote event handling (不触发重渲染)
  const selectedEpisodeGroupRef = useRef(selectedEpisodeGroup);
  selectedEpisodeGroupRef.current = selectedEpisodeGroup;

  const focusedAreaRef = useRef(focusedArea);
  focusedAreaRef.current = focusedArea;

  const focusedEpisodeIndexRef = useRef(focusedEpisodeIndex);
  focusedEpisodeIndexRef.current = focusedEpisodeIndex;

  const chunksRef = useRef(chunks);
  chunksRef.current = chunks;

  const selectedChunk = chunks[selectedEpisodeGroup] || { items: [], index: 0, label: "" };
  const visibleEpisodes = selectedChunk.items;
  const visibleEpisodesRef = useRef(visibleEpisodes);
  visibleEpisodesRef.current = visibleEpisodes;

  const startIndex = selectedChunk.index * EPISODE_GROUP_SIZE;

  const episodeRefs = useRef<Map<number, any>>(new Map());
  const groupRefs = useRef<Map<number, any>>(new Map());
  const [episodeTags, setEpisodeTags] = useState<Map<number, number>>(new Map());
  const [groupTags, setGroupTags] = useState<Map<number, number>>(new Map());

  const setEpisodeRef = useCallback((index: number, node: any) => {
    if (node) {
      episodeRefs.current.set(index, node);
      const tag = findNodeHandle(node);
      if (tag) {
        setEpisodeTags((prev) => {
          if (prev.get(index) === tag) return prev;
          const next = new Map(prev);
          next.set(index, tag);
          return next;
        });
      }
    } else {
      episodeRefs.current.delete(index);
    }
  }, []);

  const setGroupRef = useCallback((index: number, node: any) => {
    if (node) {
      groupRefs.current.set(index, node);
      const tag = findNodeHandle(node);
      if (tag) {
        setGroupTags((prev) => {
          if (prev.get(index) === tag) return prev;
          const next = new Map(prev);
          next.set(index, tag);
          return next;
        });
      }
    } else {
      groupRefs.current.delete(index);
    }
  }, []);

  // 强制聚焦到某个 episode ref 节点（用于导航时精准移焦，不触发重渲染）
  const focusEpisodeRef = useCallback((localIndex: number) => {
    const node = episodeRefs.current.get(localIndex);
    if (node && typeof node.setNativeProps === "function") {
      node.setNativeProps({ hasTVPreferredFocus: true });
    }
  }, []);

  // 强制聚焦到某个 group tab ref 节点
  const focusGroupRef = useCallback((groupIndex: number) => {
    const node = groupRefs.current.get(groupIndex);
    if (node && typeof node.setNativeProps === "function") {
      node.setNativeProps({ hasTVPreferredFocus: true });
    }
  }, []);

  // 规则 1: 打开抽屉时，自动定位到当前播放集所在分组，并聚焦当前集
  useEffect(() => {
    if (showEpisodeModal && currentEpisodeIndex >= 0) {
      const targetGroup = Math.floor(currentEpisodeIndex / EPISODE_GROUP_SIZE);
      const targetLocal = currentEpisodeIndex % EPISODE_GROUP_SIZE;

      selectedEpisodeGroupRef.current = targetGroup;
      focusedEpisodeIndexRef.current = targetLocal;
      focusedAreaRef.current = "episodes";

      setSelectedEpisodeGroup(targetGroup);
      setFocusedEpisodeIndex(targetLocal);
      setFocusedArea("episodes");

      // 顶部分组栏平滑滚动到当前组
      const scrollTimer = setTimeout(() => {
        groupFlatListRef.current?.scrollToIndex({ index: targetGroup, animated: true, viewPosition: 0.3 });
      }, 60);

      // 等 FlatList 渲染完成后，通过 setNativeProps 精准聚焦当前播放集
      const focusTimer = setTimeout(() => {
        focusEpisodeRef(targetLocal);
      }, 300);

      return () => {
        clearTimeout(scrollTimer);
        clearTimeout(focusTimer);
      };
    }
  }, [showEpisodeModal, currentEpisodeIndex, focusEpisodeRef]);

  useEffect(() => {
    episodeRefs.current.clear();
    setEpisodeTags(new Map());
  }, [selectedEpisodeGroup]);

  useEffect(() => {
    if (episodes.length === 0) {
      setSelectedEpisodeGroup((prev) => (prev === 0 ? prev : 0));
      return;
    }
    const maxGroup = Math.max(0, chunks.length - 1);
    setSelectedEpisodeGroup((prev) => {
      const clamped = Math.min(Math.max(prev, 0), maxGroup);
      return clamped === prev ? prev : clamped;
    });
  }, [episodes.length, chunks.length]);

  const onSelectEpisode = useCallback((index: number) => {
    playEpisode(index);
    setShowEpisodeModal(false);
  }, [playEpisode, setShowEpisodeModal]);

  const onClose = useCallback(() => {
    setShowEpisodeModal(false);
  }, [setShowEpisodeModal]);

  // 跨分组切换：切换 selectedEpisodeGroup 触发 FlatList 重挂载，再延迟聚焦目标 item
  const switchGroup = useCallback((targetGroup: number, targetLocalIndex: number) => {
    if (targetGroup < 0 || targetGroup >= chunksRef.current.length) return;

    selectedEpisodeGroupRef.current = targetGroup;
    focusedEpisodeIndexRef.current = targetLocalIndex;
    focusedAreaRef.current = "episodes";

    setSelectedEpisodeGroup(targetGroup);
    setFocusedEpisodeIndex(targetLocalIndex);
    setFocusedArea("episodes");

    groupFlatListRef.current?.scrollToIndex({
      index: targetGroup,
      animated: true,
      viewPosition: 0.3,
    });

    // 等新分组的 FlatList 渲染完成后聚焦
    setTimeout(() => {
      const node = episodeRefs.current.get(targetLocalIndex);
      if (node && typeof node.setNativeProps === "function") {
        node.setNativeProps({ hasTVPreferredFocus: true });
      }
    }, 200);
  }, []);

  const handleTVEvent = useCallback(
    (event: HWEvent) => {
      if (!showEpisodeModal) return;
      const eventType = normalizeEventType(event.eventType);
      if (eventType === "back") { onClose(); return; }
      if (event.eventKeyAction !== undefined && event.eventKeyAction !== 0) return;

      const currentArea = focusedAreaRef.current;
      const currentGroup = selectedEpisodeGroupRef.current;
      const currentEpIdx = focusedEpisodeIndexRef.current;
      const allChunks = chunksRef.current;
      const curEpisodes = visibleEpisodesRef.current;
      const total = curEpisodes.length;

      if (currentArea === "range") {
        if (eventType === "down") {
          // 规则 7: 焦点从分组栏按下键，直接移动到当前分组第一行最左侧（第 1 集）
          focusedEpisodeIndexRef.current = 0;
          focusedAreaRef.current = "episodes";
          setFocusedArea("episodes");
          focusEpisodeRef(0);
          return;
        }
        if (eventType === "left" && currentGroup > 0) {
          const prevGroup = currentGroup - 1;
          selectedEpisodeGroupRef.current = prevGroup;
          setSelectedEpisodeGroup(prevGroup);
          setGroupFocusGeneration((prev) => prev + 1);
          groupFlatListRef.current?.scrollToIndex({ index: prevGroup, animated: true, viewPosition: 0.3 });
          return;
        }
        if (eventType === "right" && currentGroup < allChunks.length - 1) {
          const nextGroup = currentGroup + 1;
          selectedEpisodeGroupRef.current = nextGroup;
          setSelectedEpisodeGroup(nextGroup);
          setGroupFocusGeneration((prev) => prev + 1);
          groupFlatListRef.current?.scrollToIndex({ index: nextGroup, animated: true, viewPosition: 0.3 });
          return;
        }
      }

      if (currentArea === "episodes") {
        if (total === 0) return;
        const isLastInRow = currentEpIdx % 5 === 4;
        const isFirstInRow = currentEpIdx % 5 === 0;
        const isFirstRow = currentEpIdx < 5;
        const isLastRow = currentEpIdx + 5 >= total;
        const isLastItem = currentEpIdx === total - 1;
        const isFirstItem = currentEpIdx === 0;

        if (eventType === "up") {
          if (isFirstRow && allChunks.length > 1) {
            // 规则 2: 第一行按上键，焦点直接移动到顶部分组栏当前选中的分组标签
            focusedAreaRef.current = "range";
            setFocusedArea("range");
            focusGroupRef(currentGroup);
            return;
          } else if (!isFirstRow) {
            // 规则 3 上方: 严格垂直移动
            const targetIdx = currentEpIdx - 5;
            focusedEpisodeIndexRef.current = targetIdx;
            focusEpisodeRef(targetIdx);
            return;
          }
        }

        // 规则 3 & 规则 6: 下键移动
        if (eventType === "down") {
          if (isLastRow) {
            // 规则 6: 末尾行按下键，自动切换到下一组，焦点垂直移动到下一组第一行对应列
            if (currentGroup < allChunks.length - 1) {
              const col = currentEpIdx % 5;
              const nextChunk = allChunks[currentGroup + 1];
              const nextTotal = nextChunk?.items?.length || 1;
              const targetLocalIndex = Math.min(col, nextTotal - 1);
              switchGroup(currentGroup + 1, targetLocalIndex);
              return;
            }
            // 已是最后一组末尾行，回到顶部分组栏
            if (allChunks.length > 1) {
              focusedAreaRef.current = "range";
              setFocusedArea("range");
              focusGroupRef(currentGroup);
              return;
            }
          } else {
            // 规则 3: 严格垂直向下
            const targetIdx = currentEpIdx + 5;
            focusedEpisodeIndexRef.current = targetIdx;
            focusEpisodeRef(targetIdx);
            return;
          }
        }

        // 规则 4 & 规则 5: 右键移动
        if (eventType === "right") {
          if (isLastItem) {
            // 规则 5: 组末最右按右键，切换到下一组第 1 集
            if (currentGroup < allChunks.length - 1) {
              switchGroup(currentGroup + 1, 0);
              return;
            }
          } else {
            const targetIdx = currentEpIdx + 1;
            focusedEpisodeIndexRef.current = targetIdx;
            focusEpisodeRef(targetIdx);
            return;
          }
        }

        if (eventType === "left") {
          if (isFirstItem) {
            if (currentGroup > 0) {
              const prevChunk = allChunks[currentGroup - 1];
              const prevTotal = prevChunk?.items?.length || 1;
              switchGroup(currentGroup - 1, prevTotal - 1);
              return;
            }
          } else {
            const targetIdx = currentEpIdx - 1;
            focusedEpisodeIndexRef.current = targetIdx;
            focusEpisodeRef(targetIdx);
            return;
          }
        }
      }
    },
    [showEpisodeModal, switchGroup, onClose, focusEpisodeRef, focusGroupRef]
  );

  useTVEventHandler(handleTVEvent);

  return (
    <PlayerModalBase
      visible={showEpisodeModal}
      onClose={onClose}
      title="选择剧集"
      width={500}
      headerExtra={
        chunks.length > 1 ? (
          <View style={styles.rangeContainer}>
            <FlatList
              ref={groupFlatListRef}
              horizontal
              data={chunks}
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => `chunk-${item.index}`}
              contentContainerStyle={styles.episodeGroupContainer}
              initialScrollIndex={selectedEpisodeGroup >= 0 && selectedEpisodeGroup < chunks.length ? selectedEpisodeGroup : 0}
              renderItem={({ item: chunk }) => (
                <StyledButton
                  ref={(node) => setGroupRef(chunk.index, node)}
                  key={`group-${chunk.index}-${groupFocusGeneration}`}
                  text={chunk.label}
                  onPress={() => setSelectedEpisodeGroup(chunk.index)}
                  onFocus={() => {
                    focusedAreaRef.current = "range";
                    selectedEpisodeGroupRef.current = chunk.index;
                    setFocusedArea("range");
                    setSelectedEpisodeGroup(chunk.index);
                  }}
                  hasTVPreferredFocus={focusedArea === "range" && selectedEpisodeGroup === chunk.index}
                  nextFocusDown={episodeTags.get(0)}
                  isSelected={selectedEpisodeGroup === chunk.index}
                  variant="ghost"
                  style={[styles.episodeGroupButton, selectedEpisodeGroup === chunk.index && styles.selectedEpisodeGroupButton]}
                  textStyle={[styles.episodeGroupButtonText, selectedEpisodeGroup === chunk.index && styles.selectedGroupText]}
                />
              )}
            />
          </View>
        ) : undefined
      }
    >
      <FlatList
        data={visibleEpisodes}
        numColumns={5}
        contentContainerStyle={styles.episodeList}
        // keyExtractor 只用 selectedEpisodeGroup + index，切换分组才 remount，按键导航不 remount
        keyExtractor={(_, index) => `episode-${selectedEpisodeGroup}-${startIndex + index}`}
        initialNumToRender={30}
        maxToRenderPerBatch={30}
        windowSize={5}
        removeClippedSubviews={false}
        renderItem={({ item, index }) => {
          const absoluteIndex = startIndex + index;
          const isFirstRow = index < 5;
          const isLastRow = index + 5 >= visibleEpisodes.length;
          const isLastInRow = index % 5 === 4;
          const isFirstInRow = index % 5 === 0;

          // 跨行换行连接 (规则 4)
          const nextRightTag = isLastInRow && index + 1 < visibleEpisodes.length ? episodeTags.get(index + 1) : undefined;
          const nextLeftTag = isFirstInRow && index > 0 ? episodeTags.get(index - 1) : undefined;
          // 第一行向上直达分组栏 (规则 2)
          const nextUpTag = isFirstRow ? groupTags.get(selectedEpisodeGroup) : episodeTags.get(index - 5);
          // 规则 6: 末尾行不设 nextFocusDown，由 handleTVEvent 控制跨组跳转
          const nextDownTag = isLastRow ? undefined : episodeTags.get(index + 5);

          // 切换分组后，通过 hasTVPreferredFocus 指定初始焦点位置
          const isTargetFocused = focusedArea === "episodes" && focusedEpisodeIndex === index;

          return (
            <StyledButton
              ref={(node) => setEpisodeRef(index, node)}
              text={item.title || `第 ${absoluteIndex + 1} 集`}
              onPress={() => onSelectEpisode(absoluteIndex)}
              onFocus={() => {
                focusedAreaRef.current = "episodes";
                focusedEpisodeIndexRef.current = index;
                setFocusedArea("episodes");
                setFocusedEpisodeIndex(index);
              }}
              isSelected={currentEpisodeIndex === absoluteIndex}
              hasTVPreferredFocus={isTargetFocused}
              nextFocusRight={nextRightTag}
              nextFocusLeft={nextLeftTag}
              nextFocusUp={nextUpTag}
              nextFocusDown={nextDownTag}
              style={styles.episodeItem}
              textStyle={styles.episodeItemText}
              textProps={{ numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.6 }}
            />
          );
        }}
      />
    </PlayerModalBase>
  );
};

const styles = StyleSheet.create({
  rangeContainer: {
    marginBottom: 0,
    height: 50,
    justifyContent: "center",
  },
  episodeList: {
    justifyContent: "flex-start",
    paddingBottom: 20,
    paddingTop: 4,
  },
  episodeItem: {
    paddingVertical: 2,
    margin: 4,
    width: "18%",
  },
  episodeItemText: {
    fontSize: 12,
  },
  episodeGroupContainer: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    alignItems: "center",
  },
  episodeGroupButton: {
    paddingHorizontal: 12,
    paddingVertical: 0,
    marginRight: 8,
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    minHeight: 36,
    justifyContent: "center",
  },
  selectedEpisodeGroupButton: {
    borderBottomWidth: 2,
    borderBottomColor: "#FFFFFF",
  },
  episodeGroupButtonText: {
    fontSize: 14,
    color: "#AAAAAA",
    fontWeight: "600",
    textAlign: "center",
    textAlignVertical: "center",
  },
  selectedGroupText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
});
