import { useState, useCallback, useEffect } from "react";
import { PlayRecordManager } from "@/services/storage";
import { SearchResult } from "@/services/api";

export interface ResumeInfo {
  hasRecord: boolean;
  episodeIndex: number;
  position?: number;
}

export const useResumeProgress = (detail: SearchResult | null) => {
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
      // Ignore errors and fall back to default resume info
    }

    return { hasRecord: false, episodeIndex: 0, position: undefined };
  }, [detail]);

  const applyResumeInfo = useCallback((next: ResumeInfo) => {
    setResumeInfo((prev) => {
      if (
        prev.hasRecord === next.hasRecord &&
        prev.episodeIndex === next.episodeIndex &&
        prev.position === next.position
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    const info = await loadResumeInfo();
    applyResumeInfo(info);
  }, [loadResumeInfo, applyResumeInfo]);

  useEffect(() => {
    let isActive = true;

    loadResumeInfo().then((info) => {
      if (isActive) {
        applyResumeInfo(info);
      }
    });

    return () => {
      isActive = false;
    };
  }, [loadResumeInfo, applyResumeInfo]);

  return { resumeInfo, refresh };
};
