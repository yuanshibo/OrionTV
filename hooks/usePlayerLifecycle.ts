import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { VideoPlayer } from 'expo-video';
import { PlaybackState } from '@/stores/playerStore';

interface PlayerLifecycleProps {
  player: VideoPlayer | null;
  status: PlaybackState | null;
  showControls: boolean;
  showRelatedVideos: boolean;
  flushPlaybackRecord: () => void;
  setShowControls: (show: boolean) => void;
  setShowRelatedVideos: (show: boolean) => void;
}

export function usePlayerLifecycle({
  player,
  status,
  showControls,
  showRelatedVideos,
  flushPlaybackRecord,
  setShowControls,
  setShowRelatedVideos,
}: PlayerLifecycleProps) {
  const router = useRouter();
  const wasPlayingBeforeBackgroundRef = useRef<boolean>(false);
  const isPlayingCurrentRef = useRef<boolean>(false);

  useEffect(() => {
    isPlayingCurrentRef.current = Boolean(status?.isPlaying);
  }, [status?.isPlaying]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (!player) return;

      if (nextAppState === 'background' || nextAppState === 'inactive') {
        wasPlayingBeforeBackgroundRef.current = isPlayingCurrentRef.current;
        try {
          player.pause();
        } catch (err) {
          console.warn('[LIFECYCLE] Safe pause failed:', err);
        }
        try {
          flushPlaybackRecord();
        } catch (err) {
          console.warn('[LIFECYCLE] Safe flush record failed:', err);
        }
      } else if (nextAppState === 'active') {
        // Only resume if the video was actually playing before going to the background
        if (wasPlayingBeforeBackgroundRef.current) {
          try {
            player.play();
          } catch (err) {
            console.warn('[LIFECYCLE] Safe resume play failed:', err);
          }
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [player, flushPlaybackRecord]);

  useEffect(() => {
    const backAction = () => {
      if (showRelatedVideos) {
        setShowRelatedVideos(false);
        if (router.canGoBack()) {
          router.back();
        }
        return true;
      }

      if (showControls) {
        setShowControls(false);
        return true;
      }

      try {
        flushPlaybackRecord();
      } catch (err) {
        console.warn('[LIFECYCLE] Failed to flush playback record on back:', err);
      }

      if (router.canGoBack()) {
        router.back();
      }
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [showControls, showRelatedVideos, setShowControls, setShowRelatedVideos, router, flushPlaybackRecord]);
}
