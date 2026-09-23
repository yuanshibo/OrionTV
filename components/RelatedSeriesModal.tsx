import React, { useCallback, useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter, useNavigation } from "expo-router";
import { PlayerModalBase } from "./player/PlayerModalBase";
import { ThemedText } from "./ThemedText";
import RelatedSeries from "./RelatedSeries";
import useDetailStore from "@/stores/detailStore";
import usePlayerStore from "@/stores/playerStore";
import { SearchResult } from "@/services/api";
import { requestTVFocus } from "@/utils/tvUtils";
import { FocusPriority } from "@/types/focus";
import Logger from "@/utils/Logger";

const logger = Logger.withTag("RelatedSeriesModal");

export const RelatedSeriesModal: React.FC = () => {
  const router = useRouter();
  const navigation = useNavigation();
  const { showRelatedVideos, setShowRelatedVideos, savePlayRecord } = usePlayerStore();
  const { detail } = useDetailStore();

  const isCooldownRef = useRef(false);
  // Ref to the first VideoCard's Pressable node for imperative TV focus
  const firstCardRef = useRef<View>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (showRelatedVideos) {
      isCooldownRef.current = true;
      const cooldownTimer = setTimeout(() => {
        isCooldownRef.current = false;
      }, 250);

      // Imperatively move TV focus to the first card after the native Modal has mounted.
      // 300ms gives Android TV enough time to attach the surface and accept focus.
      focusTimerRef.current = setTimeout(() => {
        focusTimerRef.current = null;
        if (firstCardRef.current) {
          requestTVFocus(firstCardRef, { priority: FocusPriority.MODAL, duration: 300 });
        }
      }, 300);

      return () => {
        clearTimeout(cooldownTimer);
        if (focusTimerRef.current) {
          clearTimeout(focusTimerRef.current);
          focusTimerRef.current = null;
        }
      };
    }
    isCooldownRef.current = false;
  }, [showRelatedVideos]);

  const onClose = useCallback(() => {
    setShowRelatedVideos(false);
  }, [setShowRelatedVideos]);

  const onSelectSeries = useCallback(
    (item: SearchResult) => {
      // 250ms anti-misclick cooldown on modal open
      if (isCooldownRef.current) {
        logger.debug("onSelectSeries ignored due to anti-misclick cooldown");
        return;
      }

      logger.info(`Switching from "${detail?.title}" to related series: "${item.title}"`);

      // 1. Immediately persist current video playback progress
      try {
        savePlayRecord({}, { immediate: true });
      } catch (err) {
        logger.warn("Failed to flush current playback before navigating to related series:", err);
      }

      // 2. Dismiss modal
      setShowRelatedVideos(false);

      // 3. Smart navigation reset:
      // Strip old ['detail', 'play', 'related'] screens to eliminate player stacking
      // and deep back loops, setting the new detail page directly on top of context routes.
      const params = {
        q: item.title,
        title: item.title,
        poster: item.poster,
        year: item.year,
        type: item.type_name || item.type,
        ...(item.source === "douban" ? {} : { source: item.source, id: String(item.id) }),
      };

      if (navigation) {
        navigation.dispatch((state: any) => {
          const routesToKeep = state.routes.filter(
            (r: any) => !["detail", "play", "related"].includes(r.name)
          );

          return {
            type: "RESET",
            payload: {
              ...state,
              routes: [...routesToKeep, { name: "detail", params }],
              index: routesToKeep.length,
            },
          };
        });
      } else {
        router.push({
          pathname: "/detail",
          params,
        });
      }
    },
    [detail?.title, savePlayRecord, setShowRelatedVideos, navigation, router]
  );

  const title = detail?.title || "";

  return (
    <PlayerModalBase
      visible={showRelatedVideos}
      onClose={onClose}
      title="相关剧集"
      variant="bottom"
      headerExtra={
        <View style={styles.headerSubtitleContainer}>
          <ThemedText style={styles.headerSubtitle}>
            选择剧集进入详情页 · 按【返回键】继续播放当前视频
          </ThemedText>
        </View>
      }
      contentStyle={styles.modalContent}
    >
      <View style={styles.contentContainer}>
        {title ? (
          <RelatedSeries
            title={title}
            autoFocus={false}
            hideTitle={true}
            showEmptyMessage={true}
            onItemPress={onSelectSeries}
            firstItemRef={firstCardRef}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <ThemedText style={styles.emptyText}>暂无剧集信息</ThemedText>
          </View>
        )}
      </View>
    </PlayerModalBase>
  );
};

const styles = StyleSheet.create({
  modalContent: {
    paddingBottom: 20,
  },
  headerSubtitleContainer: {
    alignItems: "center",
    marginBottom: 10,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#9ca3af",
  },
  contentContainer: {
    minHeight: 220,
    justifyContent: "center",
  },
  emptyContainer: {
    paddingVertical: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "#9ca3af",
    fontSize: 15,
  },
});
