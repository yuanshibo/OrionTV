import { useRef, useCallback } from "react";
import { Alert, Platform } from "react-native";
import { useRouter, useNavigation } from "expo-router";
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
  totalEpisodes?: number;
  isCompleted?: boolean;
  isEpisodeFinished?: boolean;
  onRecordDeleted?: () => void;
  onFavoriteDeleted?: () => void;
  year?: string;
  mediaType?: string;
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
  totalEpisodes,
  isCompleted,
  isEpisodeFinished,
  onRecordDeleted,
  onFavoriteDeleted,
  ...rest
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
      let targetEpisodeIndex = 0;
      let targetPosition = 0;
      if (isCompleted) {
        // 全剧或电影播放完毕：从第一集开头（第1集 00:00）重新开始播放
        targetEpisodeIndex = 0;
        targetPosition = 0;
      } else if (isEpisodeFinished && totalEpisodes && episodeIndex < totalEpisodes) {
        // 中间集数播完：自动续播下一集从开头播放
        targetEpisodeIndex = episodeIndex;
        targetPosition = 0;
      } else {
        // 继续播放当前集数断点进度
        targetEpisodeIndex = Math.max(episodeIndex - 1, 0);
        targetPosition = playTime * 1000;
      }

      const playParams = {
        source,
        id,
        episodeIndex: targetEpisodeIndex,
        title,
        position: targetPosition,
      };

      if (navigation) {
        const state = navigation.getState();
        const hasExistingPlayOrDetail = state?.routes?.some((r: any) =>
          ['detail', 'play', 'related'].includes(r.name)
        );

        if (hasExistingPlayOrDetail && state?.routes) {
          // If we are coming from a play, detail, or related screen:
          // We MUST replace the existing consumption chain to prevent player stacking!
          const routesToKeep = state.routes.filter((r: any) =>
            !['detail', 'play', 'related'].includes(r.name)
          );

          navigation.dispatch({
            type: 'RESET',
            payload: {
              ...state,
              routes: [
                ...routesToKeep,
                { name: 'play', params: playParams },
              ],
              index: routesToKeep.length,
            },
          });
          return;
        }
      }

      router.push({
        pathname: "/play",
        params: playParams,
      });
    } else {
      const isDouban = source === 'douban';
      const params = {
        q: title,
        title,
        poster,
        year: (rest as any).year,
        type: (rest as any).mediaType,
        ...(isDouban ? {} : { source, id })
      };

      // Smart navigation: Flatten the stack for Detail pages
      // If the stack already has a detail/play/related chain (e.g. Detail -> Related -> Detail),
      // RESET to prevent deep stacking. Otherwise simply push.
      const state = navigation?.getState();
      const hasExistingConsumptionChain = state?.routes?.some((r: any) =>
        ['detail', 'play', 'related'].includes(r.name)
      );

      if (hasExistingConsumptionChain && state?.routes) {
        const routesToKeep = state.routes.filter((r: any) =>
          !['detail', 'play', 'related'].includes(r.name)
        );

        navigation!.dispatch({
          type: 'RESET',
          payload: {
            ...state,
            routes: [...routesToKeep, { name: 'detail', params }],
            index: routesToKeep.length,
          },
        });
      } else {
        router.push({
          pathname: "/detail",
          params,
        });
      }
    }
  }, [id, source, title, poster, progress, episodeIndex, totalEpisodes, isCompleted, isEpisodeFinished, playTime, router, navigation]);

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
