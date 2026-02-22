import { create } from "zustand";
import Toast from "react-native-toast-message";
import { VideoPlayer } from "expo-video";
import { PlayRecord, PlayRecordManager, PlayerSettingsManager } from "@/services/storage";
import useDetailStore, { episodesSelectorBySource } from "./detailStore";
import Logger from '@/utils/Logger';
import errorService from "@/services/ErrorService";
import { SearchResultWithResolution } from "@/services/api";
import { useRouter } from "expo-router";
import {
  progressPositionSV,
  bufferedPositionSV,
  isSeekingSV,
  seekPositionSV,
  resetPlayerSharedValues,
} from "@/utils/playerSharedValues";

const logger = Logger.withTag('PlayerStore');

let seekTimeoutId: ReturnType<typeof setTimeout> | undefined = undefined;
const SEEK_UI_TIMEOUT = 5000;

interface Episode {
  url: string;
  title: string;
}

export interface PlaybackState {
  isLoaded: boolean;
  isPlaying: boolean;
  isBuffering: boolean;
  positionMillis: number;
  durationMillis?: number;
  playableDurationMillis?: number;
  bufferedMillis?: number;
  didJustFinish: boolean;
  error?: string;
}

export const createInitialPlaybackState = (): PlaybackState => ({
  isLoaded: false,
  isPlaying: false,
  isBuffering: false,
  positionMillis: 0,
  durationMillis: undefined,
  playableDurationMillis: undefined,
  bufferedMillis: undefined,
  didJustFinish: false,
  error: undefined,
});

interface PlayerState {
  videoPlayer: VideoPlayer | null;
  currentEpisodeIndex: number;
  episodes: Episode[];
  status: PlaybackState | null;
  isLoading: boolean;
  error?: string;
  showControls: boolean;
  showEpisodeModal: boolean;
  showSourceModal: boolean;
  showSpeedModal: boolean;
  showNextEpisodeOverlay: boolean;
  showRelatedVideos: boolean;
  isSeeking: boolean;
  isSeekBuffering: boolean;
  seekPosition: number;
  progressPosition: number;
  initialPosition: number;
  playbackRate: number;
  introEndTime?: number;
  outroStartTime?: number;
  router?: ReturnType<typeof useRouter>;
  setVideoPlayer: (player: VideoPlayer | null) => void;
  loadVideo: (options: {
    detail: SearchResultWithResolution;
    episodeIndex: number;
    position?: number;
    router: ReturnType<typeof useRouter>;
  }) => Promise<void>;
  playEpisode: (index: number) => void;
  togglePlayPause: () => void;
  seek: (duration: number) => void;
  handlePlaybackStatusUpdate: (newStatus: PlaybackState) => void;
  setLoading: (loading: boolean) => void;
  setError: (error?: string) => void;
  setShowControls: (show: boolean) => void;
  setShowEpisodeModal: (show: boolean) => void;
  setShowSourceModal: (show: boolean) => void;
  setShowSpeedModal: (show: boolean) => void;
  setShowNextEpisodeOverlay: (show: boolean) => void;
  setShowRelatedVideos: (show: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  setIntroEndTime: () => void;
  setOutroStartTime: () => void;
  reset: () => void;
  _isRecordSaveThrottled: boolean;
  _savePlayRecord: (updates?: Partial<PlayRecord>, options?: { immediate?: boolean }) => void;
  handleVideoError: (errorType: 'ssl' | 'network' | 'other', failedUrl: string) => Promise<void>;
}

/** Typed result for _loadPlaybackData, replacing the previous `as any` escape hatch */
interface PlaybackDataResult {
  data?: Partial<PlayerState>;
  error?: string;
  latestRecord?: PlayRecord;
}

const usePlayerStore = create<PlayerState>((set, get) => {
  const _loadPlaybackData = async (detail: SearchResultWithResolution): Promise<PlaybackDataResult> => {
    try {
      // Load current source record along with the latest record across all sources (by title/year/type)
      const [playRecord, playerSettings, latestRecord] = await Promise.all([
        PlayRecordManager.get(detail.source, detail.id.toString()),
        PlayerSettingsManager.get(detail.source, detail.id.toString()),
        PlayRecordManager.getLatestByTitle(detail.title, detail.year, detail.type),
      ]);

      const introEndTime = playRecord?.introEndTime || playerSettings?.introEndTime || latestRecord?.introEndTime;
      const outroStartTime = playRecord?.outroStartTime || playerSettings?.outroStartTime || latestRecord?.outroStartTime;
      const playbackRate = playerSettings?.playbackRate || latestRecord?.playbackRate || 1.0;

      // Position Sync Logic:
      // 1. Prefer current source's record if it exists.
      // 2. If current source has no record, check if we are playing the episode that corresponds to the latest record.
      //    (latestRecord.index is 1-based, currentEpisodeIndex in store isn't available here but passed to loadVideo's caller.
      //     Wait, _loadPlaybackData is called inside loadVideo. We need to know the target episode index to sync position correctly.)

      // We return the raw data here. The consumer (loadVideo) needs to decide on initialPosition based on the target episode.
      // Let's refine the return type or logic. 

      // Actually, _loadPlaybackData is called *inside* loadVideo, but it doesn't take episodeIndex as arg currently.
      // However, we can return the latestRecord and let loadVideo handle the position logic, OR we can pass episodeIndex to _loadPlaybackData.
      // Let's update _loadPlaybackData signature to take episodeIndex? 
      // No, looking at loadVideo: `const playbackDataResult = await _loadPlaybackData(detail);`
      // It sets `initialPosition` from `playbackDataResult.data.initialPosition`.

      // Let's change _loadPlaybackData to return the potential sync position.
      // We can't know if it matches the *target* episode inside here without the argument. 
      // But wait, `loadVideo` has `episodeIndex`.

      return {
        data: {
          // Return the current source's position if its record exists (even if 0).
          // If no record exists, return undefined so loadVideo can check the cross-source latestRecord.
          initialPosition: playRecord ? playRecord.play_time * 1000 : undefined,
          playbackRate,
          introEndTime,
          outroStartTime,
        },
        // Pass latestRecord back so loadVideo can apply cross-source position sync
        latestRecord: latestRecord ?? undefined,
      };
    } catch (error) {
      logger.debug("Failed to load play record", error);
      return { error: "加载播放记录失败" };
    }
  };

  return {
    videoPlayer: null,
    episodes: [],
    currentEpisodeIndex: -1,
    status: null,
    isLoading: true,
    error: undefined,
    showControls: false,
    showEpisodeModal: false,
    showSourceModal: false,
    showSpeedModal: false,
    showNextEpisodeOverlay: false,
    showRelatedVideos: false,
    isSeeking: false,
    isSeekBuffering: false,
    seekPosition: 0,
    progressPosition: 0,
    initialPosition: 0,
    playbackRate: 1.0,
    introEndTime: undefined,
    outroStartTime: undefined,
    _isRecordSaveThrottled: false,

    setVideoPlayer: (player) => set({ videoPlayer: player }),

    loadVideo: async ({ detail, episodeIndex, position, router }) => {
      set({ status: null, isLoading: true, error: undefined, router, showRelatedVideos: false });

      const episodes = episodesSelectorBySource(detail.source)(useDetailStore.getState());
      if (!episodes || episodes.length === 0) {
        const msg = errorService.handle("未找到可播放的剧集", { context: "loadVideo", showToast: false });
        set({ status: null, isLoading: false, error: msg });
        return;
      }

      // _loadPlaybackData now returns a typed PlaybackDataResult
      const playbackDataResult = await _loadPlaybackData(detail);

      if (playbackDataResult.error) {
        const msg = errorService.handle(playbackDataResult.error, { context: "loadVideo", showToast: false });
        set({ status: null, isLoading: false, error: msg });
        return;
      }

      const { data, latestRecord } = playbackDataResult;

      // Default to 0 if nothing found
      let finalInitialPosition = 0;

      // Priority 1: Explicit position argument (e.g. "Continue Playing")
      if (position !== undefined) {
        finalInitialPosition = position;
      }
      // Priority 2: Current source record (if exists, even if 0)
      else if (data?.initialPosition !== undefined) {
        finalInitialPosition = data.initialPosition;
      }
      // Priority 3: Cross-source record (only if current source has NO record)
      else {
        if (latestRecord && latestRecord.index === (episodeIndex + 1)) {
          if (latestRecord.play_time > 0) {
            finalInitialPosition = latestRecord.play_time * 1000;
            logger.debug(`[PlayerStore] Syncing position from cross-source record: ${finalInitialPosition}ms`);
          }
        }
      }

      const mappedEpisodes = episodes.map((ep, index) => ({ url: ep, title: `第 ${index + 1} 集` }));
      set({
        isLoading: false,
        currentEpisodeIndex: episodeIndex,
        episodes: mappedEpisodes,
        ...data,
        initialPosition: finalInitialPosition,
      });
    },

    playEpisode: (index) => {
      const { episodes, videoPlayer } = get();
      if (index >= 0 && index < episodes.length) {
        set({
          status: null,
          isLoading: true,
          currentEpisodeIndex: index,
          showNextEpisodeOverlay: false,
          initialPosition: 0,
          progressPosition: 0,
          seekPosition: 0,
          error: undefined,
          isSeekBuffering: false,
        });
        // Reset SharedValues for the new episode
        progressPositionSV.value = 0;
        bufferedPositionSV.value = 0;
        isSeekingSV.value = false;
        seekPositionSV.value = 0;
        videoPlayer?.replay();
      }
    },

    togglePlayPause: () => {
      const { status, videoPlayer } = get();
      if (status?.isLoaded && videoPlayer) {
        status.isPlaying ? videoPlayer.pause() : videoPlayer.play();
      }
    },

    seek: (duration) => {
      if (seekTimeoutId) clearTimeout(seekTimeoutId);
      const { status, isSeeking, seekPosition } = get();
      if (!status || !status.durationMillis) return;
      const durationMillis = status.durationMillis;
      const currentPosition = isSeeking ? seekPosition * durationMillis : status.positionMillis;
      const newPosition = Math.max(0, Math.min(currentPosition + duration, durationMillis));
      const newSeekPosition = newPosition / durationMillis;
      set({ isSeeking: true, isSeekBuffering: true, seekPosition: newSeekPosition });
      // Mirror to SharedValues so PlayerProgressBar can update on the UI thread
      isSeekingSV.value = true;
      seekPositionSV.value = newSeekPosition;
      seekTimeoutId = setTimeout(() => {
        set({ isSeeking: false });
        isSeekingSV.value = false;
        seekTimeoutId = undefined;
      }, SEEK_UI_TIMEOUT);
    },

    handlePlaybackStatusUpdate: (newStatus) => {
      const { isSeekBuffering, seekPosition, status: oldStatus, router, currentEpisodeIndex, episodes, outroStartTime, playEpisode, _savePlayRecord, setShowRelatedVideos } = get();

      const nextState: Partial<PlayerState> = { status: newStatus };

      if (newStatus.error) {
        nextState.isLoading = false;
        nextState.error = newStatus.error;
      } else {
        nextState.isLoading = newStatus.isBuffering;
      }

      if (!newStatus.isLoaded) {
        set(nextState);
        return;
      }

      if (isSeekBuffering && newStatus.isPlaying && !newStatus.isBuffering) {
        const durationMillis = oldStatus?.durationMillis;
        if (durationMillis && Math.abs(newStatus.positionMillis - seekPosition * durationMillis) < 1000) {
          nextState.isSeekBuffering = false;
        } else if (!durationMillis) {
          nextState.isSeekBuffering = false;
        }
      }

      if (outroStartTime && newStatus.durationMillis && newStatus.positionMillis >= newStatus.durationMillis - outroStartTime) {
        if (currentEpisodeIndex < episodes.length - 1) {
          playEpisode(currentEpisodeIndex + 1);
          return;
        }
      }

      if (newStatus.didJustFinish) {
        if (currentEpisodeIndex < episodes.length - 1) {
          playEpisode(currentEpisodeIndex + 1);
        } else {
          const detail = useDetailStore.getState().detail;
          if (router && detail?.title) {
            router.replace({
              pathname: '/related',
              params: { title: detail.title },
            });
          }
        }
        return;
      }

      const detail = useDetailStore.getState().detail;
      if (detail && newStatus.durationMillis) {
        _savePlayRecord();
        const isNearEnd = newStatus.positionMillis / newStatus.durationMillis > 0.95;
        nextState.showNextEpisodeOverlay = isNearEnd && currentEpisodeIndex < episodes.length - 1 && !outroStartTime;
      }

      if (newStatus.durationMillis) {
        const newProgress = newStatus.positionMillis / newStatus.durationMillis;
        nextState.progressPosition = newProgress;
        // Update SharedValues directly → PlayerProgressBar renders on UI thread, no React cycle
        progressPositionSV.value = newProgress;
        bufferedPositionSV.value = newStatus.playableDurationMillis
          ? newStatus.playableDurationMillis / newStatus.durationMillis
          : 0;
      }

      if (nextState.error === undefined && oldStatus?.error) {
        nextState.error = undefined;
      }

      set(nextState);
    },

    setIntroEndTime: () => {
      const { status, introEndTime: existingIntroEndTime } = get();
      if (!status || !status.isLoaded) return;
      if (existingIntroEndTime) {
        set({ introEndTime: undefined });
        get()._savePlayRecord({ introEndTime: undefined }, { immediate: true });
        Toast.show({ type: "info", text1: "已清除片头时间" });
      } else {
        const newIntroEndTime = status.positionMillis;
        set({ introEndTime: newIntroEndTime });
        get()._savePlayRecord({ introEndTime: newIntroEndTime }, { immediate: true });
        Toast.show({ type: "success", text1: "设置成功", text2: "片头时间已记录。" });
      }
    },

    setOutroStartTime: () => {
      const { status, outroStartTime: existingOutroStartTime } = get();
      if (!status || !status.isLoaded) return;

      if (existingOutroStartTime) {
        set({ outroStartTime: undefined });
        get()._savePlayRecord({ outroStartTime: undefined }, { immediate: true });
        Toast.show({ type: "info", text1: "已清除片尾时间" });
      } else {
        if (!status.durationMillis) return;
        const newOutroStartTime = status.durationMillis - status.positionMillis;
        set({ outroStartTime: newOutroStartTime });
        get()._savePlayRecord({ outroStartTime: newOutroStartTime }, { immediate: true });
        Toast.show({ type: "success", text1: "设置成功", text2: "片尾时间已记录。" });
      }
    },

    _savePlayRecord: (updates = {}, options = {}) => {
      const { immediate = false } = options;
      if (!immediate) {
        if (get()._isRecordSaveThrottled) return;
        set({ _isRecordSaveThrottled: true });
        setTimeout(() => set({ _isRecordSaveThrottled: false }), 10000);
      }
      const { detail } = useDetailStore.getState();
      const { currentEpisodeIndex, episodes, status, introEndTime, outroStartTime } = get();
      if (detail && status?.isLoaded) {
        PlayRecordManager.save(detail.source, detail.id.toString(), {
          title: detail.title,
          description: detail.desc,
          cover: detail.poster || "",
          index: currentEpisodeIndex + 1,
          total_episodes: episodes.length,
          play_time: Math.floor(status.positionMillis / 1000),
          total_time: status.durationMillis ? Math.floor(status.durationMillis / 1000) : 0,
          source_name: detail.source_name,
          year: detail.year || "",
          type: detail.type || "",
          introEndTime,
          outroStartTime,
          ...updates,
        });
      }
    },

    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error, isLoading: false, status: null }),
    setShowControls: (show) => set({ showControls: show }),
    setShowEpisodeModal: (show) => set({ showEpisodeModal: show }),
    setShowSourceModal: (show) => set({ showSourceModal: show }),
    setShowSpeedModal: (show) => set({ showSpeedModal: show }),
    setShowRelatedVideos: (show) => set({ showRelatedVideos: show }),
    setShowNextEpisodeOverlay: (show) => set({ showNextEpisodeOverlay: show }),

    setPlaybackRate: async (rate) => {
      const { videoPlayer } = get();
      if (videoPlayer) videoPlayer.playbackRate = rate;
      set({ playbackRate: rate });
      const { detail } = useDetailStore.getState();
      if (detail) {
        await PlayerSettingsManager.save(detail.source, detail.id.toString(), { playbackRate: rate });
      }
    },

    reset: () => {
      if (seekTimeoutId) clearTimeout(seekTimeoutId);
      set({
        videoPlayer: null, episodes: [], currentEpisodeIndex: 0, status: null, isLoading: true, showControls: false,
        showEpisodeModal: false, showSourceModal: false, showSpeedModal: false, showNextEpisodeOverlay: false,
        initialPosition: 0, playbackRate: 1.0, introEndTime: undefined, outroStartTime: undefined, error: undefined,
        isSeeking: false, isSeekBuffering: false,
      });
      // Reset SharedValues so stale progress doesn't bleed into the next video
      resetPlayerSharedValues();
    },

    handleVideoError: async (errorType, failedUrl) => {
      const { detail } = useDetailStore.getState();
      if (!detail) {
        set({ error: "无法回退播放源", isLoading: false, status: null });
        return;
      }

      const { currentEpisodeIndex } = get();
      const currentSource = detail.source;
      useDetailStore.getState().markSourceAsFailed(currentSource, `${errorType} error`);
      const fallbackSource = useDetailStore.getState().getNextAvailableSource(currentSource, currentEpisodeIndex);

      if (!fallbackSource) {
        logger.warn(`[SOURCE_SELECTION] All sources exhausted. Last failed: type=${errorType}, url=${failedUrl}`);
        const msg = errorService.handle("所有播放源均不可用", { context: "handleVideoError", showToast: true });
        set({ error: msg, isLoading: false, status: null });
        return;
      }

      await useDetailStore.getState().setDetail(fallbackSource);
      const newEpisodes = fallbackSource.episodes || [];
      if (newEpisodes.length > currentEpisodeIndex) {
        const mappedEpisodes = newEpisodes.map((ep, index) => ({ url: ep, title: `第 ${index + 1} 集` }));
        set({ episodes: mappedEpisodes, error: undefined, status: null, isLoading: true });
        Toast.show({ type: "success", text1: "已切换播放源", text2: `正在使用 ${fallbackSource.source_name}` });
      } else {
        const msg = errorService.handle("回退的播放源缺少当前剧集", { context: "handleVideoError", showToast: false });
        set({ error: msg, isLoading: false, status: null });
      }
    },
  };
});

export default usePlayerStore;

export const selectCurrentEpisode = (state: PlayerState) => {
  if (state.episodes && state.currentEpisodeIndex >= 0 && state.currentEpisodeIndex < state.episodes.length) {
    const episode = state.episodes[state.currentEpisodeIndex];
    if (episode?.url) return episode;
  }
  return undefined;
};
