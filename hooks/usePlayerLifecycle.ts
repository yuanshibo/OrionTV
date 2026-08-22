import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { VideoPlayer } from 'expo-video';
import usePlayerStore, { PlaybackState } from '@/stores/playerStore';
import Logger from '@/utils/Logger';

const logger = Logger.withTag('PlayerLifecycle');

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
  const playerRef = useRef(player);
  const statusRef = useRef(status);
  const flushPlaybackRecordRef = useRef(flushPlaybackRecord);

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    flushPlaybackRecordRef.current = flushPlaybackRecord;
  }, [flushPlaybackRecord]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const currentPlayer = playerRef.current;
      const { isUserPaused, videoPlayer } = usePlayerStore.getState();

      if (nextAppState === 'background' || nextAppState === 'inactive') {
        const currentStatus = statusRef.current;
        const didFinish = currentStatus?.didJustFinish ?? false;

        // If the user did not manually pause the playback, mark to resume on returning
        if (!isUserPaused && !didFinish) {
          wasPlayingBeforeBackgroundRef.current = true;
        }

        logger.info(`App entered ${nextAppState}. isUserPaused: ${isUserPaused}, willResume: ${wasPlayingBeforeBackgroundRef.current}`);

        if (currentPlayer) {
          try {
            currentPlayer.pause();
          } catch (err) {
            logger.warn('[LIFECYCLE] Safe pause failed:', err);
          }
        }
        try {
          flushPlaybackRecordRef.current();
        } catch (err) {
          logger.warn('[LIFECYCLE] Safe flush record failed:', err);
        }
      } else if (nextAppState === 'active') {
        logger.info(`App entered active. wasPlayingBefore: ${wasPlayingBeforeBackgroundRef.current}, isUserPaused: ${isUserPaused}`);

        if (wasPlayingBeforeBackgroundRef.current && !isUserPaused) {
          wasPlayingBeforeBackgroundRef.current = false;
          const targetPlayer = currentPlayer || videoPlayer || playerRef.current;

          if (targetPlayer) {
            try {
              logger.info('[LIFECYCLE] Resuming playback via targetPlayer.play()');
              targetPlayer.play();
            } catch (err) {
              logger.warn('[LIFECYCLE] Immediate resume play failed:', err);
            }

            // Retry after 150ms to ensure Android TV Surface re-attachment is complete
            setTimeout(() => {
              try {
                const activePlayer = playerRef.current || usePlayerStore.getState().videoPlayer;
                if (activePlayer && !usePlayerStore.getState().isUserPaused) {
                  logger.info('[LIFECYCLE] Fallback retry activePlayer.play()');
                  activePlayer.play();
                }
              } catch (err) {
                logger.warn('[LIFECYCLE] Delayed resume play failed:', err);
              }
            }, 150);
          } else {
            logger.warn('[LIFECYCLE] No video player instance available on active resume');
          }
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

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
