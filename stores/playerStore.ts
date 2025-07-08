import { create } from "zustand";
import Toast from "react-native-toast-message";
import { AVPlaybackStatus, Video } from "expo-av";
import { RefObject } from "react";
import { api, VideoDetail as ApiVideoDetail, SearchResult } from "@/services/api";
import { PlayRecord, PlayRecordManager } from "@/services/storage";

interface Episode {
  url: string;
  title: string;
}

interface VideoDetail {
  videoInfo: ApiVideoDetail["videoInfo"];
  episodes: Episode[];
  sources: SearchResult[];
}

interface PlayerState {
  videoRef: RefObject<Video> | null;
  detail: VideoDetail | null;
  episodes: Episode[];
  sources: SearchResult[];
  currentSourceIndex: number;
  currentEpisodeIndex: number;
  status: AVPlaybackStatus | null;
  isLoading: boolean;
  showControls: boolean;
  showEpisodeModal: boolean;
  showSourceModal: boolean;
  showNextEpisodeOverlay: boolean;
  isSeeking: boolean;
  seekPosition: number;
  progressPosition: number;
  initialPosition: number;
  introEndTime?: number;
  outroStartTime?: number;
  setVideoRef: (ref: RefObject<Video>) => void;
  loadVideo: (source: string, id: string, episodeIndex: number, position?: number) => Promise<void>;
  switchSource: (newSourceIndex: number) => Promise<void>;
  playEpisode: (index: number) => void;
  togglePlayPause: () => void;
  seek: (duration: number) => void;
  handlePlaybackStatusUpdate: (newStatus: AVPlaybackStatus) => void;
  setLoading: (loading: boolean) => void;
  setShowControls: (show: boolean) => void;
  setShowEpisodeModal: (show: boolean) => void;
  setShowSourceModal: (show: boolean) => void;
  setShowNextEpisodeOverlay: (show: boolean) => void;
  setIntroEndTime: () => void;
  setOutroStartTime: () => void;
  reset: () => void;
  _seekTimeout?: NodeJS.Timeout;
  // Internal helper
  _savePlayRecord: (updates?: Partial<PlayRecord>) => void;
}

const usePlayerStore = create<PlayerState>((set, get) => ({
  videoRef: null,
  detail: null,
  episodes: [],
  sources: [],
  currentSourceIndex: 0,
  currentEpisodeIndex: 0,
  status: null,
  isLoading: true,
  showControls: false,
  showEpisodeModal: false,
  showSourceModal: false,
  showNextEpisodeOverlay: false,
  isSeeking: false,
  seekPosition: 0,
  progressPosition: 0,
  initialPosition: 0,
  introEndTime: undefined,
  outroStartTime: undefined,
  _seekTimeout: undefined,

  setVideoRef: (ref) => set({ videoRef: ref }),

  loadVideo: async (source, id, episodeIndex, position) => {
    set({
      isLoading: true,
      detail: null,
      episodes: [],
      sources: [],
      currentEpisodeIndex: 0,
      initialPosition: position || 0,
    });
    try {
      const videoDetail = await api.getVideoDetail(source, id);
      const episodes = videoDetail.episodes.map((ep, index) => ({ url: ep, title: `第 ${index + 1} 集` }));

      const searchResults = await api.searchVideos(videoDetail.videoInfo.title);
      const sources = searchResults.results.filter((r) => r.title === videoDetail.videoInfo.title);
      const currentSourceIndex = sources.findIndex((s) => s.source === source && s.id.toString() === id);
      const playRecord = await PlayRecordManager.get(source, id);

      set({
        detail: { videoInfo: videoDetail.videoInfo, episodes, sources },
        episodes,
        sources,
        currentSourceIndex: currentSourceIndex !== -1 ? currentSourceIndex : 0,
        currentEpisodeIndex: episodeIndex,
        isLoading: false,
        introEndTime: playRecord?.introEndTime,
        outroStartTime: playRecord?.outroStartTime,
      });
    } catch (error) {
      console.error("Failed to load video details", error);
      set({ isLoading: false });
    }
  },

  switchSource: async (newSourceIndex: number) => {
    const { sources, currentEpisodeIndex, status, detail } = get();
    if (!detail || newSourceIndex < 0 || newSourceIndex >= sources.length) return;

    const newSource = sources[newSourceIndex];
    const position = status?.isLoaded ? status.positionMillis : 0;

    set({ isLoading: true, showSourceModal: false });

    try {
      const videoDetail = await api.getVideoDetail(newSource.source, newSource.id.toString());
      const episodes = videoDetail.episodes.map((ep, index) => ({ url: ep, title: `第 ${index + 1} 集` }));

      set({
        detail: {
          ...detail,
          videoInfo: videoDetail.videoInfo,
          episodes,
        },
        episodes,
        currentSourceIndex: newSourceIndex,
        currentEpisodeIndex: currentEpisodeIndex < episodes.length ? currentEpisodeIndex : 0,
        initialPosition: position,
        isLoading: false,
      });
    } catch (error) {
      console.error("Failed to switch source", error);
      set({ isLoading: false });
    }
  },

  playEpisode: (index) => {
    const { episodes, videoRef } = get();
    if (index >= 0 && index < episodes.length) {
      set({
        currentEpisodeIndex: index,
        showNextEpisodeOverlay: false,
        initialPosition: 0,
        progressPosition: 0,
        seekPosition: 0,
      });
      videoRef?.current?.replayAsync();
    }
  },

  togglePlayPause: () => {
    const { status, videoRef } = get();
    if (status?.isLoaded) {
      if (status.isPlaying) {
        videoRef?.current?.pauseAsync();
      } else {
        videoRef?.current?.playAsync();
      }
    }
  },

  seek: (duration) => {
    const { status, videoRef } = get();
    if (!status?.isLoaded || !status.durationMillis) return;

    const newPosition = Math.max(0, Math.min(status.positionMillis + duration, status.durationMillis));
    videoRef?.current?.setPositionAsync(newPosition);

    set({
      isSeeking: true,
      seekPosition: newPosition / status.durationMillis,
    });

    if (get()._seekTimeout) {
      clearTimeout(get()._seekTimeout);
    }
    const timeoutId = setTimeout(() => set({ isSeeking: false }), 1000);
    set({ _seekTimeout: timeoutId });
  },

  setIntroEndTime: () => {
    const { status, detail } = get();
    if (status?.isLoaded && detail) {
      const introEndTime = status.positionMillis;
      set({ introEndTime });
      get()._savePlayRecord({ introEndTime });
      Toast.show({
        type: "success",
        text1: "设置成功",
        text2: "片头时间已记录。",
      });
    }
  },

  setOutroStartTime: () => {
    const { status, detail } = get();
    if (status?.isLoaded && detail) {
      const outroStartTime = status.positionMillis;
      set({ outroStartTime });
      get()._savePlayRecord({ outroStartTime });
      Toast.show({
        type: "success",
        text1: "设置成功",
        text2: "片尾时间已记录。",
      });
    }
  },

  _savePlayRecord: (updates = {}) => {
    const { detail, currentEpisodeIndex, episodes, status, introEndTime, outroStartTime } = get();
    if (detail && status?.isLoaded) {
      const { videoInfo } = detail;
      const existingRecord = {
        introEndTime,
        outroStartTime,
      };
      PlayRecordManager.save(videoInfo.source, videoInfo.id, {
        title: videoInfo.title,
        cover: videoInfo.cover || "",
        index: currentEpisodeIndex,
        total_episodes: episodes.length,
        play_time: status.positionMillis,
        total_time: status.durationMillis || 0,
        source_name: videoInfo.source_name,
        ...existingRecord,
        ...updates,
      });
    }
  },

  handlePlaybackStatusUpdate: (newStatus) => {
    if (!newStatus.isLoaded) {
      if (newStatus.error) {
        console.error(`Playback Error: ${newStatus.error}`);
      }
      set({ status: newStatus });
      return;
    }

    const { detail, currentEpisodeIndex, episodes, outroStartTime, playEpisode } = get();

    if (outroStartTime && newStatus.positionMillis >= outroStartTime) {
      if (currentEpisodeIndex < episodes.length - 1) {
        playEpisode(currentEpisodeIndex + 1);
        return; // Stop further processing for this update
      }
    }

    if (detail && newStatus.durationMillis) {
      get()._savePlayRecord();

      const isNearEnd = newStatus.positionMillis / newStatus.durationMillis > 0.95;
      if (isNearEnd && currentEpisodeIndex < episodes.length - 1 && !outroStartTime) {
        set({ showNextEpisodeOverlay: true });
      } else {
        set({ showNextEpisodeOverlay: false });
      }
    }

    if (newStatus.didJustFinish) {
      if (currentEpisodeIndex < episodes.length - 1) {
        playEpisode(currentEpisodeIndex + 1);
      }
    }

    const progressPosition = newStatus.durationMillis ? newStatus.positionMillis / newStatus.durationMillis : 0;
    set({ status: newStatus, progressPosition });
  },

  setLoading: (loading) => set({ isLoading: loading }),
  setShowControls: (show) => set({ showControls: show }),
  setShowEpisodeModal: (show) => set({ showEpisodeModal: show }),
  setShowSourceModal: (show) => set({ showSourceModal: show }),
  setShowNextEpisodeOverlay: (show) => set({ showNextEpisodeOverlay: show }),

  reset: () => {
    set({
      detail: null,
      episodes: [],
      sources: [],
      currentSourceIndex: 0,
      currentEpisodeIndex: 0,
      status: null,
      isLoading: true,
      showControls: false,
      showEpisodeModal: false,
      showSourceModal: false,
      showNextEpisodeOverlay: false,
      initialPosition: 0,
      introEndTime: undefined,
      outroStartTime: undefined,
    });
  },
}));

export default usePlayerStore;
