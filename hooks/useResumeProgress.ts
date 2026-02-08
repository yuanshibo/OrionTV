import { useState, useEffect } from "react";
import useDetailStore from "@/stores/detailStore";
import { SearchResult } from "@/services/api";

export interface ResumeInfo {
  hasRecord: boolean;
  episodeIndex: number;
  position?: number;
}

export const useResumeProgress = (detail: SearchResult | null) => {
  const resumeRecord = useDetailStore((state) => state.resumeRecord);

  // Derive resume info directly from state (logic moved from effect to render)
  // This ensures 0 latency when the updated store value propagates.
  const getResumeInfo = (): ResumeInfo => {
    if (!detail || !resumeRecord) {
      return { hasRecord: false, episodeIndex: 0, position: undefined };
    }

    // Verify title match (double check, though store logic should ensure this)
    if (resumeRecord.title !== detail.title) {
      return { hasRecord: false, episodeIndex: 0, position: undefined };
    }

    const totalEpisodes = detail.episodes?.length ?? 0;
    if (totalEpisodes === 0) {
      return { hasRecord: false, episodeIndex: 0, position: undefined };
    }

    let rawIndex = typeof resumeRecord.index === "number" ? resumeRecord.index - 1 : 0;

    // --- Completion Logic / Auto-Advance ---
    if (resumeRecord.duration && resumeRecord.play_time) {
      const progress = resumeRecord.play_time / resumeRecord.duration;
      const isNearEnd = progress > 0.95;

      // If watched > 95% and there is a next episode, advance
      if (isNearEnd && rawIndex + 1 < totalEpisodes) {
        return {
          hasRecord: true,
          episodeIndex: rawIndex + 1,
          position: 0,
        };
      }
    }

    const clampedIndex = Math.min(Math.max(rawIndex, 0), totalEpisodes - 1);
    const resumePosition =
      resumeRecord.play_time && resumeRecord.play_time > 0
        ? Math.max(0, Math.floor(resumeRecord.play_time * 1000))
        : undefined;

    return {
      hasRecord: true,
      episodeIndex: clampedIndex,
      position: resumePosition,
    };
  };

  const [info, setInfo] = useState<ResumeInfo>(getResumeInfo());

  // Sync state when dependencies change
  useEffect(() => {
    setInfo(getResumeInfo());
  }, [detail, resumeRecord]);

  return {
    resumeInfo: info,
    refresh: () => {
      // Trigger a store refresh. The effect above will catch the updated store state.
      useDetailStore.getState().refreshResumeRecord();
    }
  };
};
