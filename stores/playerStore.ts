import { create } from 'zustand';
import { AVPlaybackStatus, Video } from 'expo-av';
import { RefObject } from 'react';
import { api, VideoDetail as ApiVideoDetail } from '@/services/api';
import { PlayRecordManager } from '@/services/storage';

interface Episode {
  url: string;
  title: string;
}

interface VideoDetail {
  videoInfo: ApiVideoDetail['videoInfo'];
  episodes: Episode[];
}

interface PlayerState {
  videoRef: RefObject<Video> | null;
  detail: VideoDetail | null;
  episodes: Episode[];
  currentEpisodeIndex: number;
  status: AVPlaybackStatus | null;
  isLoading: boolean;
  showControls: boolean;
  showEpisodeModal: boolean;
  showNextEpisodeOverlay: boolean;
  isSeeking: boolean;
  seekPosition: number;
  progressPosition: number;
  initialPosition: number;
  setVideoRef: (ref: RefObject<Video>) => void;
  loadVideo: (source: string, id: string, episodeIndex: number, position?: number) => Promise<void>;
  playEpisode: (index: number) => void;
  togglePlayPause: () => void;
  seek: (forward: boolean) => void;
  handlePlaybackStatusUpdate: (newStatus: AVPlaybackStatus) => void;
  setLoading: (loading: boolean) => void;
  setShowControls: (show: boolean) => void;
  setShowEpisodeModal: (show: boolean) => void;
  setShowNextEpisodeOverlay: (show: boolean) => void;
  reset: () => void;
}

const usePlayerStore = create<PlayerState>((set, get) => ({
  videoRef: null,
  detail: null,
  episodes: [],
  currentEpisodeIndex: 0,
  status: null,
  isLoading: true,
  showControls: true,
  showEpisodeModal: false,
  showNextEpisodeOverlay: false,
  isSeeking: false,
  seekPosition: 0,
  progressPosition: 0,
  initialPosition: 0,

  setVideoRef: (ref) => set({ videoRef: ref }),

  loadVideo: async (source, id, episodeIndex, position) => {
    set({
      isLoading: true,
      detail: null,
      episodes: [],
      currentEpisodeIndex: 0,
      initialPosition: position || 0,
    });
    try {
      const videoDetail = await api.getVideoDetail(source, id);
      const episodes = videoDetail.episodes.map((ep, index) => ({ url: ep, title: `第 ${index + 1} 集` }));
      set({
        detail: { videoInfo: videoDetail.videoInfo, episodes },
        episodes,
        currentEpisodeIndex: episodeIndex,
        isLoading: false,
      });
    } catch (error) {
      console.error("Failed to load video details", error);
      set({ isLoading: false });
    }
  },

  playEpisode: (index) => {
    const { episodes, videoRef } = get();
    if (index >= 0 && index < episodes.length) {
      set({ currentEpisodeIndex: index, showNextEpisodeOverlay: false, initialPosition: 0 });
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

  seek: (forward) => {
    const { status, videoRef } = get();
    if (status?.isLoaded) {
      const newPosition = status.positionMillis + (forward ? 15000 : -15000);
      videoRef?.current?.setPositionAsync(Math.max(0, newPosition));
    }
  },

  handlePlaybackStatusUpdate: (newStatus) => {
    set({ status: newStatus });
    if (!newStatus.isLoaded) {
      if (newStatus.error) {
        console.error(`Playback Error: ${newStatus.error}`);
      }
      return;
    }

    const { detail, currentEpisodeIndex, episodes } = get();
    if (detail && newStatus.durationMillis) {
      const { videoInfo } = detail;
      PlayRecordManager.save(
        videoInfo.source,
        videoInfo.id,
        {
          title: videoInfo.title,
          cover: videoInfo.cover || '',
          index: currentEpisodeIndex,
          total_episodes: episodes.length,
          play_time: newStatus.positionMillis,
          total_time: newStatus.durationMillis,
          source_name: videoInfo.source_name,
        }
      );

      const isNearEnd = newStatus.positionMillis / newStatus.durationMillis > 0.95;
      if (isNearEnd && currentEpisodeIndex < episodes.length - 1) {
        set({ showNextEpisodeOverlay: true });
      } else {
        set({ showNextEpisodeOverlay: false });
      }
    }
    if (newStatus.didJustFinish) {
        const { playEpisode, currentEpisodeIndex, episodes } = get();
        if (currentEpisodeIndex < episodes.length - 1) {
            playEpisode(currentEpisodeIndex + 1);
        }
    }
  },
  
  setLoading: (loading) => set({ isLoading: loading }),
  setShowControls: (show) => set({ showControls: show }),
  setShowEpisodeModal: (show) => set({ showEpisodeModal: show }),
  setShowNextEpisodeOverlay: (show) => set({ showNextEpisodeOverlay: show }),

  reset: () => {
    set({
      detail: null,
      episodes: [],
      currentEpisodeIndex: 0,
      status: null,
      isLoading: true,
      showControls: true,
      showEpisodeModal: false,
      showNextEpisodeOverlay: false,
      initialPosition: 0,
    });
  },
}));

export default usePlayerStore;