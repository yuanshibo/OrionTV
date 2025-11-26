import { useRef, useCallback } from "react";
import { Alert, Platform } from "react-native";
import { useRouter, useNavigation } from "expo-router";
import { CommonActions } from "@react-navigation/native";
import { PlayRecordManager, FavoriteManager } from "@/services/storage";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useModalStore } from "@/stores/modalStore";
import Logger from '@/utils/Logger';

const logger = Logger.withTag('useVideoCardInteractions');

interface InteractionProps {
  id: string;
  source: string;
  title: string;
  poster?: string;
  type?: 'record' | 'favorite';
  progress?: number;
  playTime?: number;
  episodeIndex?: number;
  onRecordDeleted?: () => void;
  onFavoriteDeleted?: () => void;
}

export const useVideoCardInteractions = ({
  id,
  source,
  title,
  poster,
  type = 'record',
  progress,
  playTime = 0,
  episodeIndex,
  onRecordDeleted,
  onFavoriteDeleted,
}: InteractionProps) => {
  const router = useRouter();
  const navigation = useNavigation();
  const { deviceType } = useResponsiveLayout();
  const longPressTriggered = useRef(false);
  const lastPressTime = useRef(0);

  const handlePress = useCallback(() => {
    const now = Date.now();
    if (now - lastPressTime.current < 500) return;
    lastPressTime.current = now;

    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }

    if (progress !== undefined && episodeIndex !== undefined) {
      router.push({
        pathname: "/play",
        params: { source, id, episodeIndex: episodeIndex - 1, title, position: playTime * 1000 },
      });
    } else {
      const isDouban = source === 'douban';
      const params = {
        q: title,
        poster,
        ...(isDouban ? {} : { source, id })
      };

      // Smart navigation: Flatten the stack for Detail pages
      // This ensures that navigating from Detail -> Related -> Detail doesn't create a deep stack.
      // It keeps "context" pages (Home, Search, Favorites) but replaces the "Detail chain".
      if (navigation) {
        navigation.dispatch((state: any) => {
          // Filter out existing Detail, Play, and Related screens from the stack
          // This effectively "replaces" the current Detail flow with the new Detail page
          // while preserving the history of how we got here (e.g. Home -> Search)
          const routesToKeep = state.routes.filter((r: any) =>
            !['detail', 'play', 'related'].includes(r.name)
          );

          return CommonActions.reset({
            ...state,
            routes: [...routesToKeep, { name: 'detail', params }],
            index: routesToKeep.length,
          });
        });
      } else {
        // Fallback if navigation is not available (shouldn't happen in expo-router)
        router.push({
          pathname: "/detail",
          params,
        });
      }
    }
  }, [id, source, title, poster, progress, episodeIndex, playTime, router, navigation]);

  const handleDelete = useCallback(async () => {
    try {
      if (type === 'favorite') {
        await FavoriteManager.remove(source, id);
        onFavoriteDeleted?.();
      } else {
        await PlayRecordManager.remove(source, id);
        if (onRecordDeleted) {
          onRecordDeleted();
        } else if (router.canGoBack()) {
          // If onRecordDeleted is not provided (e.g. from Detail page?), maybe go back?
          // The original logic had: if (onRecordDeleted) ... else if (router.canGoBack()) router.replace("/");
          // Wait, replace("/") means go Home.
          router.replace("/");
        }
      }
    } catch (error) {
      logger.info(`Failed to delete ${type}:`, error);
      Alert.alert("错误", `删除${type === 'favorite' ? '收藏' : '观看记录'}失败，请重试`);
    } finally {
      longPressTriggered.current = false;
    }
  }, [id, source, type, onRecordDeleted, onFavoriteDeleted, router]);

  const handleLongPress = useCallback(() => {
    if (type === 'record' && progress === undefined) return;

    longPressTriggered.current = true;

    const isFavorite = type === 'favorite';
    const titleText = isFavorite ? "删除收藏" : "删除观看记录";
    const messageText = isFavorite ? `确定要删除"${title}"的收藏吗？` : `确定要删除"${title}"的观看记录吗？`;

    useModalStore.getState().showDeleteModal(
      titleText,
      messageText,
      handleDelete,
      () => { longPressTriggered.current = false; }
    );
  }, [type, progress, title, handleDelete]);

  return {
    handlePress,
    handleLongPress,
  };
};
