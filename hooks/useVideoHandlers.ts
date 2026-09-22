import { useCallback, useEffect, useMemo, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useVideoPlayer, VideoPlayer, VideoViewProps } from "expo-video";
import type {
  VideoPlayerEvents,
  StatusChangeEventPayload,
  PlayingChangeEventPayload,
  TimeUpdateEventPayload,
} from 'expo-video';
import usePlayerStore, { PlaybackState, createInitialPlaybackState } from '@/stores/playerStore';
import errorService, { ErrorType } from '@/services/ErrorService';

export type VideoViewPropsSubset = Pick<VideoViewProps, 'nativeControls' | 'contentFit'>;

interface UseVideoHandlersProps {
  currentEpisode: { url: string; title: string } | undefined;
  initialPosition: number;
  introEndTime?: number;
  playbackRate: number;
  handlePlaybackStatusUpdate: (status: PlaybackState) => void;
  deviceType: string;
}

interface UseVideoHandlersResult {
  player: VideoPlayer | null;
  videoViewProps: VideoViewPropsSubset;
}

type EventfulVideoPlayer = VideoPlayer & {
  addListener<K extends keyof VideoPlayerEvents>(eventName: K, listener: VideoPlayerEvents[K]): { remove(): void };
};

export const useVideoHandlers = ({
  currentEpisode,
  initialPosition,
  introEndTime,
  playbackRate,
  handlePlaybackStatusUpdate,
  deviceType,
}: UseVideoHandlersProps): UseVideoHandlersResult => {
  const player = useVideoPlayer(currentEpisode?.url ?? null, (instance: VideoPlayer) => {
    instance.loop = false;
    instance.timeUpdateEventInterval = 0.5; // Optimal progress updates (2Hz) for TV performance
    instance.keepScreenOnWhilePlaying = true;
  });

  const statusRef = useRef<PlaybackState>(createInitialPlaybackState());
  const pendingSeekRef = useRef<number>(0);
  const lastErrorUrlRef = useRef<string | null>(null);
  const audioRecoveryCountRef = useRef<number>(0);
  const lastAudioRecoveryTimeRef = useRef<number>(0);
  const playbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSkippedAdEndRef = useRef<number>(0);

  const contentFit = usePlayerStore((state) => state.contentFit);

  const clearPlaybackTimeout = useCallback(() => {
    if (playbackTimeoutRef.current) {
      clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }
  }, []);

  const startPlaybackTimeout = useCallback(() => {
    clearPlaybackTimeout();
    if (currentEpisode?.url && !statusRef.current.isLoaded) {
      playbackTimeoutRef.current = setTimeout(() => {
        const isAppInBackground =
          AppState.currentState === "background" || AppState.currentState === "inactive";
        if (
          !statusRef.current.isLoaded &&
          !statusRef.current.error &&
          currentEpisode?.url &&
          !isAppInBackground
        ) {
          console.warn("[VIDEO] Playback loading timed out after 15s, triggering source fallback...");
          errorService.showToast("加载超时，正在自动切换播放源...", "error");
          usePlayerStore.getState().handleVideoError("network", currentEpisode.url);
        }
      }, 15000);
    }
  }, [clearPlaybackTimeout, currentEpisode?.url]);

  const emitStatusUpdate = useCallback(
    (updates: Partial<PlaybackState>) => {
      statusRef.current = { ...statusRef.current, ...updates };
      handlePlaybackStatusUpdate({ ...statusRef.current });
    },
    [handlePlaybackStatusUpdate],
  );

  const lastValidPositionRef = useRef<number>(0);
  const hasStartedPlayingRef = useRef<boolean>(false);
  const lastProgressTimestampRef = useRef<number>(Date.now());
  const lastSeenTimeRef = useRef<number>(0);
  const uninterruptedPlaySecondsRef = useRef<number>(0);
  const isAppActiveRef = useRef<boolean>(
    AppState.currentState !== "background" && AppState.currentState !== "inactive"
  );
  const lastActiveTimestampRef = useRef<number>(Date.now());

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const now = Date.now();
      if (nextAppState === "active") {
        isAppActiveRef.current = true;
        lastActiveTimestampRef.current = now;
        lastProgressTimestampRef.current = now;
        uninterruptedPlaySecondsRef.current = 0;
        startPlaybackTimeout();
      } else {
        isAppActiveRef.current = false;
        lastProgressTimestampRef.current = now;
        uninterruptedPlaySecondsRef.current = 0;
        clearPlaybackTimeout();
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [startPlaybackTimeout, clearPlaybackTimeout]);

  useEffect(() => {
    statusRef.current = createInitialPlaybackState();
    handlePlaybackStatusUpdate(statusRef.current);
    lastErrorUrlRef.current = null;
    lastValidPositionRef.current = 0;
    audioRecoveryCountRef.current = 0;
    lastAudioRecoveryTimeRef.current = 0;
    lastSkippedAdEndRef.current = 0;
    hasStartedPlayingRef.current = false;
    lastProgressTimestampRef.current = Date.now();
    lastSeenTimeRef.current = 0;
    uninterruptedPlaySecondsRef.current = 0;

    startPlaybackTimeout();

    return () => {
      clearPlaybackTimeout();
    };
  }, [currentEpisode?.url, handlePlaybackStatusUpdate, clearPlaybackTimeout, startPlaybackTimeout]);

  useEffect(() => {
    pendingSeekRef.current = initialPosition || introEndTime || 0;
  }, [initialPosition, introEndTime, currentEpisode?.url]);

  const applyPendingSeek = useCallback(() => {
    if (!player) return;
    const target = pendingSeekRef.current;
    if (target > 0) {
      try {
        player.currentTime = target / 1000;
      } catch (error) {
        console.warn('[VIDEO] Failed to apply initial seek', error);
      }
    }
    pendingSeekRef.current = 0;
  }, [player]);

  const updateDuration = useCallback(() => {
    if (!player) {
      emitStatusUpdate({ durationMillis: undefined });
      return;
    }
    try {
      const durationSeconds = player.duration;
      const durationMillis = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds * 1000 : undefined;
      emitStatusUpdate({ durationMillis });
    } catch (e) {
      console.warn('[VIDEO] Failed to read duration', e);
    }
  }, [player, emitStatusUpdate]);

  useEffect(() => {
    if (!player) return undefined;

    const eventedPlayer = player as EventfulVideoPlayer;

    const subscriptions = [
      eventedPlayer.addListener('statusChange', ({ status, error }: StatusChangeEventPayload) => {
        switch (status) {
          case 'loading':
            emitStatusUpdate({ isLoaded: false, isBuffering: true, error: undefined, didJustFinish: false });
            break;
          case 'readyToPlay':
            clearPlaybackTimeout();
            hasStartedPlayingRef.current = true;
            lastProgressTimestampRef.current = Date.now();
            emitStatusUpdate({ isLoaded: true, isBuffering: false, error: undefined });
            updateDuration();
            applyPendingSeek();
            try {
              player.play();
            } catch (err) {
              console.warn('[VIDEO] Failed to start playback automatically', err);
            }
            lastErrorUrlRef.current = null;
            audioRecoveryCountRef.current = 0;
            break;
          case 'idle':
            emitStatusUpdate({ isLoaded: false, isPlaying: false, isBuffering: false });
            break;
          case 'error': {
            clearPlaybackTimeout();
            const message = error?.message ?? 'Unknown playback error';
            const errorType = errorService.detectErrorType(message);

            // Audio device routing change (e.g. Bluetooth speaker disconnected)
            if (errorType === ErrorType.AUDIO && currentEpisode?.url) {
              const now = Date.now();
              if (now - lastAudioRecoveryTimeRef.current > 10000) {
                audioRecoveryCountRef.current = 0;
              }
              audioRecoveryCountRef.current += 1;
              lastAudioRecoveryTimeRef.current = now;

              if (audioRecoveryCountRef.current <= 3) {
                console.warn(`[VIDEO] Audio output changed/disconnected (${message}). Recovering playback (attempt ${audioRecoveryCountRef.current})...`);
                errorService.showToast('音频设备变动，正在自动恢复...', 'info');
                const resumePosition = lastValidPositionRef.current || statusRef.current.positionMillis || 0;
                pendingSeekRef.current = resumePosition;

                emitStatusUpdate({ isLoaded: false, isBuffering: true, error: undefined });

                try {
                  if (typeof (player as any).replaceAsync === 'function') {
                    void (player as any).replaceAsync(currentEpisode.url).catch((err: any) => {
                      console.warn('[VIDEO] replaceAsync audio recovery failed:', err);
                    });
                  } else if (typeof (player as any).replace === 'function') {
                    (player as any).replace(currentEpisode.url);
                  } else {
                    player.replay();
                  }
                  return;
                } catch (recoveryErr) {
                  console.warn('[VIDEO] Audio recovery failed, falling back to source switch', recoveryErr);
                }
              } else {
                console.warn('[VIDEO] Audio recovery exceeded retry limit, attempting normal error fallback');
              }
            }

            if (currentEpisode?.url && lastErrorUrlRef.current !== currentEpisode.url) {
              lastErrorUrlRef.current = currentEpisode.url;
              const { handleVideoError } = usePlayerStore.getState();

              let handlerErrorType: 'ssl' | 'network' | 'other' = 'other';
              if (errorType === ErrorType.SSL) handlerErrorType = 'ssl';
              if (errorType === ErrorType.NETWORK) handlerErrorType = 'network';

              errorService.showToast(errorService.formatMessage(message), 'error', '正在切换播放源...');
              handleVideoError(handlerErrorType, currentEpisode.url);
            }
            break;
          }
          default: break;
        }
      }),
      eventedPlayer.addListener('playingChange', ({ isPlaying }: PlayingChangeEventPayload) => {
        if (isPlaying) {
          clearPlaybackTimeout();
        }
        emitStatusUpdate({ isPlaying });
      }),
      eventedPlayer.addListener('timeUpdate', ({ currentTime, bufferedPosition }: TimeUpdateEventPayload) => {
        const posMillis = currentTime * 1000;
        if (posMillis > 0) {
          lastValidPositionRef.current = posMillis;
          hasStartedPlayingRef.current = true;
          clearPlaybackTimeout();
        }

        // Track forward playback progress for stall detection and uninterrupted streak
        if (currentTime > lastSeenTimeRef.current + 0.05) {
          const deltaSec = currentTime - lastSeenTimeRef.current;
          lastProgressTimestampRef.current = Date.now();
          lastSeenTimeRef.current = currentTime;
          if (deltaSec > 0 && deltaSec < 3) {
            uninterruptedPlaySecondsRef.current += deltaSec;
            if (uninterruptedPlaySecondsRef.current >= 15) {
              if (usePlayerStore.getState().stallFailoverCount > 0) {
                usePlayerStore.setState({ stallFailoverCount: 0 });
              }
            }
          }
        }

        // Check ad intervals for auto-skip (used ONLY in 'skip' mode or fallback when playing original stream)
        const isPlayingLocalFile = currentEpisode?.url?.startsWith('file://');
        const adIntervals = usePlayerStore.getState().adIntervals;
        const isSeeking = usePlayerStore.getState().isSeeking;
        if (!isPlayingLocalFile && !isSeeking && adIntervals && adIntervals.length > 0) {
          const matchingAd = adIntervals.find(
            (ad) => currentTime >= ad.start - 0.2 && currentTime < ad.end - 0.5 && lastSkippedAdEndRef.current !== ad.end
          );
          if (matchingAd) {
            try {
              lastSkippedAdEndRef.current = matchingAd.end;
              player.currentTime = matchingAd.end;
              errorService.showToast('已为您自动跳过片中广告', 'info');
            } catch (seekErr) {
              console.warn('[VIDEO] Failed to auto-seek past ad:', seekErr);
            }
          }
        }

        emitStatusUpdate({
          positionMillis: posMillis,
          playableDurationMillis: bufferedPosition >= 0 ? bufferedPosition * 1000 : undefined,
          didJustFinish: false,
        });
      }),
      eventedPlayer.addListener('playToEnd', () => {
        emitStatusUpdate({ didJustFinish: true, isPlaying: false });
      }),
      eventedPlayer.addListener('sourceLoad', () => {
        updateDuration();
        applyPendingSeek();
        try {
          player.play();
        } catch (err) {
          console.warn('[VIDEO] Failed to start playback after loading source', err);
        }
      }),
    ];

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [player, currentEpisode?.url, applyPendingSeek, updateDuration, emitStatusUpdate, clearPlaybackTimeout]);

  useEffect(() => {
    if (!player) return;
    try {
      player.playbackRate = playbackRate;
    } catch (error) {
      console.warn('[VIDEO] Failed to apply playback rate update', error);
    }
  }, [player, playbackRate]);

  // Mid-playback stall watchdog (6s continuous freeze/buffering detection)
  useEffect(() => {
    const watchdogInterval = setInterval(() => {
      const store = usePlayerStore.getState();
      const now = Date.now();
      const isAppInBackground =
        !isAppActiveRef.current ||
        AppState.currentState === "background" ||
        AppState.currentState === "inactive";
      const isWarmingUpFromBackground = now - lastActiveTimestampRef.current < 2500;

      if (
        isAppInBackground ||
        isWarmingUpFromBackground ||
        !player ||
        !hasStartedPlayingRef.current ||
        store.isUserPaused ||
        store.isSeeking ||
        store.isSeekBuffering ||
        statusRef.current.didJustFinish ||
        !currentEpisode?.url
      ) {
        lastProgressTimestampRef.current = now;
        uninterruptedPlaySecondsRef.current = 0;
        return;
      }

      const isBuffering = statusRef.current.isBuffering || (player as any).status === "loading";
      const isSupposedToBePlaying = player.playing || isBuffering;

      if (isSupposedToBePlaying) {
        const stalledMs = now - lastProgressTimestampRef.current;
        if (stalledMs >= 6000) {
          lastProgressTimestampRef.current = now; // Prevent multiple triggers in same stall
          uninterruptedPlaySecondsRef.current = 0;
          console.warn(`[VIDEO] Playback stalled for ${stalledMs}ms, triggering silent failover...`);
          const stallPos = lastValidPositionRef.current || statusRef.current.positionMillis || 0;
          store.handlePlaybackStall(stallPos);
        }
      } else {
        lastProgressTimestampRef.current = now;
      }
    }, 1000);

    return () => {
      clearInterval(watchdogInterval);
    };
  }, [player, currentEpisode?.url]);

  const videoViewProps = useMemo<VideoViewPropsSubset>(
    () => ({ nativeControls: deviceType !== 'tv', contentFit }),
    [deviceType, contentFit],
  );

  return { player, videoViewProps };
};