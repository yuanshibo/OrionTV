import { create } from "zustand";
import { AppState } from "react-native";
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
import { processM3U8ForPlayback, AdInterval } from "@/services/m3u8AdFilter";
import { useSettingsStore } from "@/stores/settingsStore";

const logger = Logger.withTag('PlayerStore');

let seekTimeoutId: ReturnType<typeof setTimeout> | undefined = undefined;
const SEEK_UI_TIMEOUT = 5000;
let isEpisodeSwitching = false;

// Prefetch state tracking for seamless next-episode transitions
let prefetchedIndex: number | null = null;
let inFlightPrefetchIndex: number | null = null;
let inFlightPrefetchPromise: Promise<void> | null = null;
const prefetchedAdIntervalsMap = new Map<number, AdInterval[]>();

export function resetPrefetchState(): void {
  prefetchedIndex = null;
  inFlightPrefetchIndex = null;
  inFlightPrefetchPromise = null;
  prefetchedAdIntervalsMap.clear();
}

type ExtendableVideoPlayer = VideoPlayer & {
  replaceAsync?: (url: string) => Promise<void>;
  replace?: (url: string) => void;
  status?: string;
};

const safeReplacePlayerSource = (player: VideoPlayer | null, url: string): Promise<void> | void => {
  if (!player || !url) return;
  const extPlayer = player as ExtendableVideoPlayer;
  try {
    if (typeof extPlayer.replaceAsync === "function") {
      const p = extPlayer.replaceAsync(url);
      if (p && typeof p.catch === "function") {
        p.catch((e) => {
          logger.debug(
            "[PlayerStore] safeReplacePlayerSource async failed (player may have been released or changed):",
            e
          );
        });
      }
      return p;
    } else if (typeof extPlayer.replace === "function") {
      extPlayer.replace(url);
    } else if (typeof player.replay === "function") {
      player.replay();
    }
  } catch (e) {
    logger.debug("[PlayerStore] safeReplacePlayerSource failed:", e);
  }
};

const isPlayerNativeError = (player: VideoPlayer | null): boolean => {
  if (!player) return false;
  return (player as ExtendableVideoPlayer).status === "error";
};

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
  isUserPaused: boolean;
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
  adIntervals: AdInterval[];
  playEpisode: (index: number) => Promise<void> | void;
  prefetchNextEpisode: () => Promise<void>;
  togglePlayPause: () => void;
  retryCurrentPlayback: () => Promise<void>;
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
  contentFit: 'contain' | 'cover' | 'fill';
  setContentFit: (fit: 'contain' | 'cover' | 'fill') => void;
  toggleContentFit: () => void;
  isLocked: boolean;
  setIsLocked: (isLocked: boolean) => void;
  toggleScreenLock: () => void;
  reset: () => void;
  _isRecordSaveThrottled: boolean;
  savePlayRecord: (updates?: Partial<PlayRecord>, options?: { immediate?: boolean }) => void;
  /** @deprecated Use savePlayRecord instead */
  _savePlayRecord: (updates?: Partial<PlayRecord>, options?: { immediate?: boolean }) => void;
  handleVideoError: (errorType: 'ssl' | 'network' | 'other', failedUrl: string) => Promise<void>;
  stallFailoverCount: number;
  handlePlaybackStall: (stallPositionMs?: number) => Promise<void>;
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
      // Return current source's playback position if available; otherwise return undefined so
      // loadVideo can fall back to cross-source latestRecord matching the target episode index.
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
    isUserPaused: false,
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
    contentFit: 'contain',
    isLocked: false,
    introEndTime: undefined,
    outroStartTime: undefined,
    _isRecordSaveThrottled: false,
    adIntervals: [],
    stallFailoverCount: 0,

    setVideoPlayer: (player) => set({ videoPlayer: player }),

    loadVideo: async ({ detail, episodeIndex, position, router }) => {
      resetPrefetchState();
      set({ status: null, isLoading: true, isUserPaused: false, error: undefined, router, showRelatedVideos: false, adIntervals: [], stallFailoverCount: 0 });

      const episodes = detail.episodes && detail.episodes.length > 0
        ? detail.episodes
        : episodesSelectorBySource(detail.source)(useDetailStore.getState());

      if (!episodes || episodes.length === 0) {
        if (useDetailStore.getState().loading) {
          // Still fetching sources in progress, remain in loading state
          set({ status: null, isLoading: true, error: undefined });
          return;
        }
        logger.warn(`[PlayerStore] No playable episodes found for "${detail.title}" (${detail.source})`);
        set({ status: null, isLoading: false, error: "未找到可播放的剧集" });
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

      // Process target episode for ad-filtering
      let adIntervals: AdInterval[] = [];
      const adBlockMode = useSettingsStore.getState().adBlockMode || 'seamless';
      const targetEpisode = mappedEpisodes[episodeIndex];

      if (targetEpisode?.url && adBlockMode !== 'off') {
        try {
          const filterResult = await processM3U8ForPlayback(targetEpisode.url, adBlockMode);
          if (filterResult.isModified) {
            mappedEpisodes[episodeIndex] = { ...targetEpisode, url: filterResult.cleanUrl };
            adIntervals = filterResult.adIntervals;
          }
        } catch (adErr) {
          logger.warn('[PlayerStore] Error processing M3U8 ad filter:', adErr);
        }
      }

      set({
        isLoading: false,
        isUserPaused: false,
        currentEpisodeIndex: episodeIndex,
        episodes: mappedEpisodes,
        adIntervals,
        ...data,
        initialPosition: finalInitialPosition,
      });
    },

    playEpisode: (index) => {
      const { episodes, introEndTime, videoPlayer } = get();
      if (index >= 0 && index < episodes.length) {
        const targetEpisode = episodes[index];
        const prefetchedIntervals = prefetchedAdIntervalsMap.get(index) || [];

        set({
          status: null,
          isLoading: true,
          isUserPaused: false,
          currentEpisodeIndex: index,
          showNextEpisodeOverlay: false,
          initialPosition: introEndTime || 0,
          progressPosition: 0,
          seekPosition: 0,
          error: undefined,
          isSeekBuffering: false,
          adIntervals: prefetchedIntervals,
          stallFailoverCount: 0,
        });
        // Reset SharedValues for the new episode
        progressPositionSV.value = 0;
        bufferedPositionSV.value = 0;
        isSeekingSV.value = false;
        seekPositionSV.value = 0;

        // Reuse videoPlayer instance immediately
        if (videoPlayer && targetEpisode?.url) {
          void safeReplacePlayerSource(videoPlayer, targetEpisode.url);
        }

        // If targetEpisode.url is already a prefetched clean local file (file://), no additional processing needed!
        if (targetEpisode?.url?.startsWith('file://')) {
          logger.debug(`[PlayerStore] playEpisode #${index + 1} playing prefetched clean file immediately:`, targetEpisode.url);
          return;
        }

        // Asynchronously process M3U8 for ad filtering if enabled
        const adBlockMode = useSettingsStore.getState().adBlockMode || 'seamless';
        if (targetEpisode?.url && adBlockMode !== 'off') {
          // If prefetch is in flight for this exact index, reuse that promise
          const adPromise =
            inFlightPrefetchIndex === index && inFlightPrefetchPromise
              ? inFlightPrefetchPromise.then(() => {
                  const ep = get().episodes[index];
                  return {
                    cleanUrl: ep?.url || targetEpisode.url,
                    adIntervals: prefetchedAdIntervalsMap.get(index) || [],
                    totalAdDuration: 0,
                    isModified: ep?.url !== targetEpisode.url,
                  };
                })
              : processM3U8ForPlayback(targetEpisode.url, adBlockMode);

          adPromise
            .then((filterResult) => {
              if (filterResult.isModified) {
                const currentEpList = get().episodes;
                if (currentEpList[index]) {
                  const updatedEpisodes = [...currentEpList];
                  updatedEpisodes[index] = { ...updatedEpisodes[index], url: filterResult.cleanUrl };
                  set({ episodes: updatedEpisodes, adIntervals: filterResult.adIntervals });
                  const activePlayer = get().videoPlayer;
                  if (get().currentEpisodeIndex === index && activePlayer && filterResult.cleanUrl !== targetEpisode.url) {
                    void safeReplacePlayerSource(activePlayer, filterResult.cleanUrl);
                  }
                }
              }
            })
            .catch((adErr) => {
              logger.debug('[PlayerStore] playEpisode ad filter background check:', adErr);
            });
        }
      }
    },

    prefetchNextEpisode: async () => {
      const { episodes, currentEpisodeIndex } = get();
      const nextIndex = currentEpisodeIndex + 1;
      if (nextIndex >= episodes.length) return;
      if (prefetchedIndex === nextIndex || inFlightPrefetchIndex === nextIndex) return;

      const targetEpisode = episodes[nextIndex];
      if (!targetEpisode?.url) return;

      // Already processed into a local clean file
      if (targetEpisode.url.startsWith('file://')) {
        prefetchedIndex = nextIndex;
        return;
      }

      const adBlockMode = useSettingsStore.getState().adBlockMode || 'seamless';
      if (adBlockMode === 'off') return;

      inFlightPrefetchIndex = nextIndex;
      logger.info(`[PlayerStore] Prefetching next episode #${nextIndex + 1}: ${targetEpisode.url}`);

      const promise = (async () => {
        try {
          const filterResult = await processM3U8ForPlayback(targetEpisode.url, adBlockMode);
          if (filterResult.isModified) {
            const currentEpList = get().episodes;
            if (currentEpList[nextIndex]) {
              const updatedEpisodes = [...currentEpList];
              updatedEpisodes[nextIndex] = { ...updatedEpisodes[nextIndex], url: filterResult.cleanUrl };
              set({ episodes: updatedEpisodes });
              prefetchedAdIntervalsMap.set(nextIndex, filterResult.adIntervals);
              logger.info(`[PlayerStore] Next episode #${nextIndex + 1} prefetched and cleaned: ${filterResult.cleanUrl}`);
            }
          }
          prefetchedIndex = nextIndex;
        } catch (err) {
          logger.debug(`[PlayerStore] Prefetch for episode #${nextIndex + 1} failed:`, err);
        } finally {
          inFlightPrefetchPromise = null;
          inFlightPrefetchIndex = null;
        }
      })();

      inFlightPrefetchPromise = promise;
      await promise;
    },

    retryCurrentPlayback: async () => {
      const { videoPlayer, currentEpisodeIndex, status, episodes, router, initialPosition } = get();
      const { detail } = useDetailStore.getState();
      const currentEpisode = episodes[currentEpisodeIndex];

      const resumePosition = (status?.positionMillis && status.positionMillis > 0)
        ? status.positionMillis
        : initialPosition || 0;

      set({ error: undefined, isLoading: true });

      if (videoPlayer && currentEpisode?.url) {
        try {
          const replaceResult = safeReplacePlayerSource(videoPlayer, currentEpisode.url);
          if (replaceResult instanceof Promise) {
            await replaceResult;
          }
          if (resumePosition > 0) {
            videoPlayer.currentTime = resumePosition / 1000;
          }
          videoPlayer.play();
          set({ isUserPaused: false, isLoading: false });
          return;
        } catch (err) {
          logger.warn('[PLAYER] retryCurrentPlayback via videoPlayer failed, falling back to full reload:', err);
        }
      }

      if (detail && router) {
        await get().loadVideo({
          detail,
          episodeIndex: currentEpisodeIndex,
          position: resumePosition,
          router,
        });
      }
    },

    togglePlayPause: () => {
      const { status, videoPlayer, error } = get();

      // If in error state or not loaded, pressing play/pause attempts in-place recovery
      if (error || !status?.isLoaded) {
        get().retryCurrentPlayback();
        return;
      }

      if (videoPlayer) {
        try {
          if (isPlayerNativeError(videoPlayer)) {
            get().retryCurrentPlayback();
            return;
          }

          if (status.isPlaying) {
            videoPlayer.pause();
            set({ isUserPaused: true });
          } else {
            videoPlayer.play();
            set({ isUserPaused: false });
          }
        } catch (e) {
          console.warn('[PLAYER] togglePlayPause error, attempting recovery:', e);
          get().retryCurrentPlayback();
        }
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
        if (!isEpisodeSwitching) {
          isEpisodeSwitching = true;
          setTimeout(() => { isEpisodeSwitching = false; }, 2500);
          if (currentEpisodeIndex < episodes.length - 1) {
            Toast.show({ type: "info", text1: "已跳过片尾", text2: `正在播放第 ${currentEpisodeIndex + 2} 集` });
            playEpisode(currentEpisodeIndex + 1);
          } else {
            set({ isUserPaused: true });
            get()._savePlayRecord({ play_time: Math.floor(newStatus.durationMillis / 1000) }, { immediate: true });
            const detail = useDetailStore.getState().detail;
            Toast.show({ type: "success", text1: "全剧已播放完毕" });
            if (router && detail?.title) {
              router.replace({
                pathname: '/related',
                params: { title: detail.title },
              });
            }
          }
          return;
        }
      }

      if (newStatus.didJustFinish) {
        set({ isUserPaused: true });
        if (!isEpisodeSwitching) {
          isEpisodeSwitching = true;
          setTimeout(() => { isEpisodeSwitching = false; }, 2500);
          if (currentEpisodeIndex < episodes.length - 1) {
            Toast.show({ type: "info", text1: "本集播放完毕", text2: `正在播放第 ${currentEpisodeIndex + 2} 集` });
            playEpisode(currentEpisodeIndex + 1);
          } else {
            get()._savePlayRecord({ play_time: newStatus.durationMillis ? Math.floor(newStatus.durationMillis / 1000) : 0 }, { immediate: true });
            const detail = useDetailStore.getState().detail;
            Toast.show({ type: "success", text1: "全剧已播放完毕" });
            if (router && detail?.title) {
              router.replace({
                pathname: '/related',
                params: { title: detail.title },
              });
            }
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

      // Trigger background prefetch & pre-filtering for next episode:
      // - At 85% progress
      // - OR when remaining time <= 120s
      // - OR at least 60s before outroStartTime kicks in (if configured)
      if (newStatus.durationMillis && newStatus.durationMillis >= 60000) {
        const remainingMillis = newStatus.durationMillis - newStatus.positionMillis;
        const progressRatio = newStatus.positionMillis / newStatus.durationMillis;
        const prefetchThresholdMillis = Math.max(120000, (outroStartTime || 0) + 60000);
        const nextIdx = currentEpisodeIndex + 1;
        if (
          (progressRatio >= 0.85 || remainingMillis <= prefetchThresholdMillis) &&
          nextIdx < episodes.length &&
          prefetchedIndex !== nextIdx &&
          inFlightPrefetchIndex !== nextIdx
        ) {
          void get().prefetchNextEpisode();
        }
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

    savePlayRecord: (updates = {}, options = {}) => {
      const { immediate = false } = options;
      if (!immediate) {
        if (get()._isRecordSaveThrottled) return;
        set({ _isRecordSaveThrottled: true });
        setTimeout(() => {
          if (usePlayerStore.getState()._isRecordSaveThrottled) {
            set({ _isRecordSaveThrottled: false });
          }
        }, 10000);
      }
      const { detail } = useDetailStore.getState();
      const { currentEpisodeIndex, episodes, status, introEndTime, outroStartTime } = get();
      if (detail && status?.isLoaded && status.positionMillis > 0) {
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
        }).catch((err) => {
          logger.debug("Failed to persist play record:", err);
        });
      }
    },

    _savePlayRecord: (updates = {}, options = {}) => {
      get().savePlayRecord(updates, options);
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

    setContentFit: (fit) => set({ contentFit: fit }),
    toggleContentFit: () => {
      const { contentFit } = get();
      const nextFit = contentFit === 'contain' ? 'cover' : contentFit === 'cover' ? 'fill' : 'contain';
      set({ contentFit: nextFit });
      const labelMap = { contain: '默认比例 (等比)', cover: '撑满裁剪 (全屏)', fill: '拉伸铺满' };
      Toast.show({ type: 'info', text1: '画面比例', text2: labelMap[nextFit] });
    },

    setIsLocked: (isLocked) => {
      if (isLocked) {
        set({
          isLocked: true,
          showControls: false,
          showEpisodeModal: false,
          showSourceModal: false,
          showSpeedModal: false,
          showRelatedVideos: false,
          showNextEpisodeOverlay: false,
        });
      } else {
        set({ isLocked: false });
      }
    },
    toggleScreenLock: () => {
      const { isLocked } = get();
      get().setIsLocked(!isLocked);
    },

    reset: () => {
      if (seekTimeoutId) clearTimeout(seekTimeoutId);
      resetPrefetchState();
      set({
        videoPlayer: null, episodes: [], currentEpisodeIndex: 0, status: null, isLoading: true, isUserPaused: false, showControls: false,
        showEpisodeModal: false, showSourceModal: false, showSpeedModal: false, showRelatedVideos: false, showNextEpisodeOverlay: false,
        initialPosition: 0, playbackRate: 1.0, contentFit: 'contain', isLocked: false, introEndTime: undefined, outroStartTime: undefined, error: undefined,
        isSeeking: false, isSeekBuffering: false, stallFailoverCount: 0,
      });
      // Reset SharedValues so stale progress doesn't bleed into the next video
      resetPlayerSharedValues();
    },

    handleVideoError: async (errorType, failedUrl) => {
      const { detail } = useDetailStore.getState();
      if (!detail) {
        set({ error: "无法回退播放源", isLoading: false, isUserPaused: false, status: null });
        return;
      }

      const { currentEpisodeIndex, introEndTime, status, progressPosition, initialPosition, videoPlayer } = get();
      const currentSource = detail.source;
      useDetailStore.getState().markSourceAsFailed(currentSource, `${errorType} error`);
      const fallbackSource = useDetailStore.getState().getNextAvailableSource(currentSource, currentEpisodeIndex);

      if (!fallbackSource) {
        logger.warn(`[SOURCE_SELECTION] All sources exhausted. Last failed: type=${errorType}, url=${failedUrl}`);
        if (currentEpisodeIndex >= (detail.episodes?.length || 0) - 1 && currentEpisodeIndex > 0) {
          Toast.show({ type: "info", text1: "后续剧集暂未更新或不可用" });
        } else {
          errorService.handle("所有播放源均不可用", { context: "handleVideoError", showToast: true });
        }
        set({ error: "所有播放源均不可用", isLoading: false, isUserPaused: false, status: null });
        return;
      }

      await useDetailStore.getState().setDetail(fallbackSource);
      const newEpisodes = fallbackSource.episodes || [];
      if (newEpisodes.length > currentEpisodeIndex) {
        const mappedEpisodes = newEpisodes.map((ep, index) => ({ url: ep, title: `第 ${index + 1} 集` }));
        const resumePosition =
          status?.positionMillis && status.positionMillis > 0
            ? status.positionMillis
            : (progressPosition && progressPosition > 0 ? progressPosition : (initialPosition || introEndTime || 0));

        set({
          episodes: mappedEpisodes,
          error: undefined,
          status: null,
          isLoading: true,
          isUserPaused: false,
          initialPosition: resumePosition,
        });

        const targetEp = mappedEpisodes[currentEpisodeIndex];
        if (videoPlayer && targetEp?.url) {
          void safeReplacePlayerSource(videoPlayer, targetEp.url);
        }

        Toast.show({
          type: "success",
          text1: "已自动切换播放源",
          text2: `正在使用 ${fallbackSource.source_name} 播放第 ${currentEpisodeIndex + 1} 集`,
        });
      } else {
        const msg = errorService.handle("回退的播放源缺少当前剧集", { context: "handleVideoError", showToast: false });
        set({ error: msg, isLoading: false, status: null });
      }
    },

    handlePlaybackStall: async (stallPositionMs?: number) => {
      if (AppState.currentState === "background" || AppState.currentState === "inactive") {
        logger.info("[STALL_FAILOVER] Ignored stall failover because AppState is background/inactive");
        return;
      }

      const { stallFailoverCount = 0 } = get();
      if (stallFailoverCount >= 3) {
        logger.warn("[STALL_FAILOVER] Reached max consecutive stall failovers (3). Halting auto-switch.");
        Toast.show({
          type: "error",
          text1: "播放多次卡顿，网络可能较慢",
          text2: "请检查网络或在播放控制面板手动切换清晰度/播放源",
        });
        return;
      }

      const { detail } = useDetailStore.getState();
      if (!detail) return;

      const { currentEpisodeIndex, introEndTime, status, progressPosition, initialPosition, videoPlayer } = get();
      const currentSource = detail.source;
      useDetailStore.getState().markSourceAsFailed(currentSource, "Playback stall (buffering > 6s)");
      const fallbackSource = useDetailStore.getState().getNextAvailableSource(currentSource, currentEpisodeIndex);

      if (!fallbackSource) {
        logger.warn(`[STALL_FAILOVER] No alternative source available after stall on "${currentSource}"`);
        Toast.show({
          type: "info",
          text1: "播放卡顿",
          text2: "暂无其他可用的备用源，请稍候缓冲...",
        });
        return;
      }

      const resumePosition =
        stallPositionMs && stallPositionMs > 0
          ? stallPositionMs
          : (status?.positionMillis && status.positionMillis > 0
            ? status.positionMillis
            : (progressPosition && progressPosition > 0 ? progressPosition : (initialPosition || introEndTime || 0)));

      logger.info(
        `[STALL_FAILOVER] Stalling detected. Switching from "${currentSource}" to "${fallbackSource.source}" at ${Math.round(resumePosition / 1000)}s (attempt ${stallFailoverCount + 1}/3)`
      );

      await useDetailStore.getState().setDetail(fallbackSource);
      const newEpisodes = fallbackSource.episodes || [];
      if (newEpisodes.length > currentEpisodeIndex) {
        const mappedEpisodes = newEpisodes.map((ep, index) => ({ url: ep, title: `第 ${index + 1} 集` }));
        const targetEp = mappedEpisodes[currentEpisodeIndex];

        set({
          episodes: mappedEpisodes,
          error: undefined,
          status: null,
          isLoading: true,
          isUserPaused: false,
          initialPosition: resumePosition,
          stallFailoverCount: stallFailoverCount + 1,
        });

        if (videoPlayer && targetEp?.url) {
          void safeReplacePlayerSource(videoPlayer, targetEp.url);
        }

        Toast.show({
          type: "info",
          text1: "检测到播放卡顿，已静默换源",
          text2: `正在切换至 ${fallbackSource.source_name} 继续播放`,
        });
      } else {
        logger.warn("[STALL_FAILOVER] Fallback source missing current episode index");
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
