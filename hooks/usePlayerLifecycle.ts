import { useEffect } from 'react';
import { AppState, AppStateStatus, BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { VideoPlayer } from 'expo-video';
import usePlayerUIStore from '@/stores/playerUIStore';

interface PlayerLifecycleProps {
  player: VideoPlayer | null;
  flushPlaybackRecord: () => void;
}

export function usePlayerLifecycle({
  player,
  flushPlaybackRecord,
}: PlayerLifecycleProps) {
  const router = useRouter();

  // Subscribe to UI state
  const showControls = usePlayerUIStore(s => s.showControls);
  const showDetails = usePlayerUIStore(s => s.showDetails);
  const showRelatedVideos = usePlayerUIStore(s => s.showRelatedVideos);

  // Actions
  const setShowControls = usePlayerUIStore.getState().setShowControls;
  const setShowDetails = usePlayerUIStore.getState().setShowDetails;
  const setShowRelatedVideos = usePlayerUIStore.getState().setShowRelatedVideos;

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (!player) return;
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        player.pause();
        flushPlaybackRecord();
      } else if (nextAppState === 'active') {
         player.play();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [player, flushPlaybackRecord]);

  useEffect(() => {
    const backAction = () => {
      // Priority 1: Close Related Videos Overlay
      if (showRelatedVideos) {
        setShowRelatedVideos(false);
        // Logic from original play.tsx: go back if related was open?
        // "if (showRelatedVideos) { setShowRelatedVideos(false); router.back(); return true; }"
        // It seems originally it navigated back? Let's double check the logic.
        // In play.tsx: "setShowRelatedVideos(false); router.back();"
        // This implies related videos is treated like a separate screen on top stack.
        router.back();
        return true;
      }

      // Priority 2: Close Details Overlay
      if (showDetails) {
        setShowDetails(false);
        return true;
      }

      // Priority 3: Hide Player Controls
      if (showControls) {
        setShowControls(false);
        return true;
      }

      // Priority 4: Flush record and Navigate Back
      flushPlaybackRecord();
      if (router.canGoBack()) {
        router.back();
      }

      return true; // Prevent default behavior
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [
    showControls,
    showDetails,
    showRelatedVideos,
    setShowControls,
    setShowDetails,
    setShowRelatedVideos,
    router,
    flushPlaybackRecord
  ]);
}
