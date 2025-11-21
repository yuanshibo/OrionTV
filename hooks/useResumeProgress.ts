import { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import { PlayRecordManager } from '@/services/storage';
import { SearchResultWithResolution } from '@/services/api';

export type ResumeInfo = {
  hasRecord: boolean;
  episodeIndex: number;
  position?: number;
};

export const useResumeProgress = (detail: SearchResultWithResolution | null) => {
  const [resumeInfo, setResumeInfo] = useState<ResumeInfo>({
    hasRecord: false,
    episodeIndex: 0,
    position: undefined,
  });

  const loadResumeInfo = useCallback(async (): Promise<ResumeInfo> => {
    if (!detail) {
      return { hasRecord: false, episodeIndex: 0, position: undefined };
    }

    try {
      const record = await PlayRecordManager.get(detail.source, detail.id.toString());
      const totalEpisodes = detail.episodes?.length ?? 0;

      if (record && totalEpisodes > 0) {
        const rawIndex = typeof record.index === "number" ? record.index - 1 : 0;
        const clampedIndex = Math.min(Math.max(rawIndex, 0), totalEpisodes - 1);
        const resumePosition =
          record.play_time && record.play_time > 0
            ? Math.max(0, Math.floor(record.play_time * 1000))
            : undefined;

        return {
          hasRecord: true,
          episodeIndex: clampedIndex,
          position: resumePosition,
        };
      }
    } catch {
      // Ignore errors
    }

    return { hasRecord: false, episodeIndex: 0, position: undefined };
  }, [detail]);

  const refresh = useCallback(() => {
    loadResumeInfo().then((info) => {
        setResumeInfo(prev => {
             if (
                prev.hasRecord === info.hasRecord &&
                prev.episodeIndex === info.episodeIndex &&
                prev.position === info.position
              ) {
                return prev;
              }
              return info;
        });
    });
  }, [loadResumeInfo]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return resumeInfo;
};
