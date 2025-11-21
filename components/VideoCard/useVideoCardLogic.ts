import { useRouter } from "expo-router";
import { Alert } from "react-native";
import { PlayRecordManager, FavoriteManager } from "@/services/storage";
import Logger from '@/utils/Logger';

const logger = Logger.withTag('VideoCardLogic');

export interface VideoCardLogicProps {
  id: string;
  source: string;
  title: string;
  progress?: number;
  playTime?: number;
  episodeIndex?: number;
  type?: 'record' | 'favorite';
  onRecordDeleted?: () => void;
  onFavoriteDeleted?: () => void;
}

export const useVideoCardLogic = ({
  id,
  source,
  title,
  progress,
  playTime = 0,
  episodeIndex,
  type = 'record',
  onRecordDeleted,
  onFavoriteDeleted,
}: VideoCardLogicProps) => {
  const router = useRouter();

  const handlePress = () => {
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
  };

  const handleDelete = async () => {
    const isFavorite = type === 'favorite';
    try {
      if (isFavorite) {
        await FavoriteManager.remove(source, id);
        onFavoriteDeleted?.();
      } else {
        await PlayRecordManager.remove(source, id);
        if (onRecordDeleted) {
          onRecordDeleted();
        } else {
          // Optional: Navigate back or refresh if needed, matching TV logic behavior where applicable
          // router.replace("/");
          // Logic from TV: if (router.canGoBack()) router.replace("/");
          // But this might be intrusive on Mobile if we just delete from a list.
          // So I'll stick to just onRecordDeleted which usually refreshes the list.
        }
      }
    } catch (error) {
      logger.info(`Failed to delete ${type}:`, error);
      Alert.alert("错误", `删除${isFavorite ? '收藏' : '观看记录'}失败，请重试`);
      throw error; // Re-throw to let caller know if needed
    }
  };

  const showDeleteAlert = (onCancel?: () => void) => {
    const isFavorite = type === 'favorite';
    const titleText = isFavorite ? "删除收藏" : "删除观看记录";
    const messageText = isFavorite ? `确定要删除"${title}"的收藏吗？` : `确定要删除"${title}"的观看记录吗？`;

    Alert.alert(titleText, messageText, [
      {
        text: "取消",
        style: "cancel",
        onPress: onCancel,
      },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            await handleDelete();
          } catch {
             // Alert already shown in handleDelete
          } finally {
            onCancel?.();
          }
        },
      },
    ]);
  };

  return {
    handlePress,
    showDeleteAlert,
    handleDelete, // Exposed if needed for direct call
  };
};
