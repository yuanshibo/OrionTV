import { useRef, useCallback } from "react";
import { Alert, Platform } from "react-native";
import { useRouter } from "expo-router";
import { PlayRecordManager, FavoriteManager } from "@/services/storage";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import Logger from '@/utils/Logger';

const logger = Logger.withTag('useVideoCardInteractions');

interface InteractionProps {
  id: string;
  source: string;
  title: string;
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
  type = 'record',
  progress,
  playTime = 0,
  episodeIndex,
  onRecordDeleted,
  onFavoriteDeleted,
}: InteractionProps) => {
  const router = useRouter();
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
      router.push({
        pathname: "/detail",
        params: { source, q: title },
      });
    }
  }, [id, source, title, progress, episodeIndex, playTime, router]);

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

    const deleteButton = {
      text: "删除",
      style: "destructive" as const,
      isPreferred: deviceType === 'tv', // Preferred on TV
      onPress: handleDelete,
    };

    const cancelButton = {
      text: "取消",
      style: "cancel" as const,
      onPress: () => { longPressTriggered.current = false; }
    };

    // TV order vs Mobile order
    // TV: [Delete, Cancel] (Delete preferred)
    // Mobile: [Cancel, Delete]
    const buttons = deviceType === 'tv'
      ? [deleteButton, cancelButton]
      : [cancelButton, deleteButton];

    Alert.alert(titleText, messageText, buttons);
  }, [type, progress, title, deviceType, handleDelete]);

  return {
    handlePress,
    handleLongPress,
  };
};
