import { useEffect } from 'react';
import { AppState, AppStateStatus, BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { VideoPlayer } from 'expo-video';

interface PlayerLifecycleProps {
  player: VideoPlayer | null;
  showControls: boolean;
  flushPlaybackRecord: () => void;
  setShowControls: (show: boolean) => void;
}

export function usePlayerLifecycle({
  player,
  showControls,
  flushPlaybackRecord,
  setShowControls,
}: PlayerLifecycleProps) {
  const router = useRouter();

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (!player) return;
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        player.pause();
        flushPlaybackRecord();
      } else if (nextAppState === 'active') {
        // Depending on the desired UX, you might want to resume playback automatically.
         player.play();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [player, flushPlaybackRecord]);

  useEffect(() => {
    const backAction = () => {
      if (showControls) {
        setShowControls(false);
        return true; // Prevent default behavior (exiting the app)
      }
      flushPlaybackRecord();
      if (router.canGoBack()) {
        router.back();
      }
      return true; // Prevent default behavior
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [showControls, setShowControls, router, flushPlaybackRecord]); // `player` has been removed as it's not a dependency
}
