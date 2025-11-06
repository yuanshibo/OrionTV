import { create } from "zustand";
import Toast from "react-native-toast-message";
import { VideoPlayer } from "expo-video";
import { PlayRecord, PlayRecordManager, PlayerSettingsManager } from "@/services/storage";
import useDetailStore, { episodesSelectorBySource } from "./detailStore";
import Logger from '@/utils/Logger';
import { SearchResultWithResolution } from "@/services/api";
import { useRouter } from "expo-router";

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
  showDetails: boolean;
  showEpisodeModal: boolean;
  showSourceModal: boolean;
  showSpeedModal: boolean;
  showNextEpisodeOverlay: boolean;
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
  setShowDetails: (show: boolean) => void;
  setShowEpisodeModal: (show: boolean) => void;
  setShowSourceModal: (show: boolean) => void;
  setShowSpeedModal: (show: boolean) => void;
  setShowNextEpisodeOverlay: (show: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  setIntroEndTime: () => void;
  setOutroStartTime: () => void;
  reset: () => void;
  _isRecordSaveThrottled: boolean;
  _savePlayRecord: (updates?: Partial<PlayRecord>, options?: { immediate?: boolean }) => void;
  handleVideoError: (errorType: 'ssl' | 'network' | 'other', failedUrl: string) => Promise<void>;
}

const usePlayerStore = create<PlayerState>((set, get) => {
  const _loadPlaybackData = async (detail: SearchResultWithResolution): Promise<{ data?: Partial<PlayerState>; error?: string }> => {
    try {
      const playRecord = await PlayRecordManager.get(detail.source, detail.id.toString());
      const playerSettings = await PlayerSettingsManager.get(detail.source, detail.id.toString());
      return {
        data: {
          initialPosition: playRecord?.play_time ? playRecord.play_time * 1000 : 0,
          playbackRate: playerSettings?.playbackRate || 1.0,
          introEndTime: playRecord?.introEndTime || playerSettings?.introEndTime,
          outroStartTime: playRecord?.outroStartTime || playerSettings?.outroStartTime,
        },
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
    showDetails: false,
    showEpisodeModal: false,
    showSourceModal: false,
    showSpeedModal: false,
    showNextEpisodeOverlay: false,
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
      set({ status: null, isLoading: true, error: undefined, router });

      const episodes = episodesSelectorBySource(detail.source)(useDetailStore.getState());
      if (!episodes || episodes.length === 0) {
        set({ status: null, isLoading: false, error: "未找到可播放的剧集" });
        return;
      }

      const playbackDataResult = await _loadPlaybackData(detail);
      if (playbackDataResult.error) {
        set({ status: null, isLoading: false, error: playbackDataResult.error });
        return;
      }

      const mappedEpisodes = episodes.map((ep, index) => ({ url: ep, title: `第 ${index + 1} 集` }));
      set({
        isLoading: false, // Correctly set isLoading to false after loading
        currentEpisodeIndex: episodeIndex,
        episodes: mappedEpisodes,
        ...playbackDataResult.data,
        ...(position !== undefined && { initialPosition: position }),
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
      set({ isSeeking: true, isSeekBuffering: true, seekPosition: newPosition / durationMillis });
      seekTimeoutId = setTimeout(() => {
        set({ isSeeking: false });
        seekTimeoutId = undefined;
      }, SEEK_UI_TIMEOUT);
    },

    handlePlaybackStatusUpdate: (newStatus) => {
      const { isSeekBuffering, seekPosition, status: oldStatus, router, currentEpisodeIndex, episodes, outroStartTime, playEpisode, _savePlayRecord } = get();

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
        } else if (router?.canGoBack()) {
          router.back();
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
        nextState.progressPosition = newStatus.positionMillis / newStatus.durationMillis;
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
          title: detail.title, cover: detail.poster || "", index: currentEpisodeIndex + 1, total_episodes: episodes.length,
          play_time: Math.floor(status.positionMillis / 1000),
          total_time: status.durationMillis ? Math.floor(status.durationMillis / 1000) : 0,
          source_name: detail.source_name, year: detail.year || "", introEndTime, outroStartTime, ...updates,
        });
      }
    },

    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error, isLoading: false, status: null }),
    setShowControls: (show) => set({ showControls: show }),
    setShowDetails: (show) => set({ showDetails: show }),
    setShowEpisodeModal: (show) => set({ showEpisodeModal: show }),
    setShowSourceModal: (show) => set({ showSourceModal: show }),
    setShowSpeedModal: (show) => set({ showSpeedModal: show }),
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
        showDetails: false,
        showEpisodeModal: false, showSourceModal: false, showSpeedModal: false, showNextEpisodeOverlay: false,
        initialPosition: 0, playbackRate: 1.0, introEndTime: undefined, outroStartTime: undefined, error: undefined,
        isSeeking: false, isSeekBuffering: false,
      });
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
        set({ error: "所有播放源均不可用", isLoading: false, status: null });
        Toast.show({ type: "error", text1: "播放失败", text2: "所有播放源都不可用" });
        return;
      }

      await useDetailStore.getState().setDetail(fallbackSource);
      const newEpisodes = fallbackSource.episodes || [];
      if (newEpisodes.length > currentEpisodeIndex) {
        const mappedEpisodes = newEpisodes.map((ep, index) => ({ url: ep, title: `第 ${index + 1} 集` }));
        set({ episodes: mappedEpisodes, error: undefined, status: null, isLoading: true });
        Toast.show({ type: "success", text1: "已切换播放源", text2: `正在使用 ${fallbackSource.source_name}` });
      } else {
        set({ error: "回退的播放源缺少当前剧集", isLoading: false, status: null });
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
