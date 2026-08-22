import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useVideoPlayer, VideoPlayer, VideoViewProps } from 'expo-video';
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

const MAX_RETRY_COUNT = 3;

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
  const lastValidPositionRef = useRef<number>(0);
  const retryCountRef = useRef<number>(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastErrorRef = useRef<string | null>(null);

  const clearTimers = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
  }, []);

  const emitStatusUpdate = useCallback(
    (updates: Partial<PlaybackState>) => {
      statusRef.current = { ...statusRef.current, ...updates };
      handlePlaybackStatusUpdate({ ...statusRef.current });
    },
    [handlePlaybackStatusUpdate],
  );

  useEffect(() => {
    clearTimers();
    statusRef.current = createInitialPlaybackState();
    handlePlaybackStatusUpdate(statusRef.current);
    lastErrorRef.current = null;
    retryCountRef.current = 0;
    lastValidPositionRef.current = 0;
  }, [currentEpisode?.url, handlePlaybackStatusUpdate, clearTimers]);

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
    const durationSeconds = player.duration;
    const durationMillis = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds * 1000 : undefined;
    emitStatusUpdate({ durationMillis });
  }, [player, emitStatusUpdate]);

  const retryCurrentPlayback = useCallback(() => {
    if (!player || !currentEpisode?.url) return;
    clearTimers();
    const resumePosition = lastValidPositionRef.current;
    pendingSeekRef.current = resumePosition;

    emitStatusUpdate({ isLoaded: false, isBuffering: true, error: undefined });

    try {
      if (typeof (player as any).replace === 'function') {
        (player as any).replace(currentEpisode.url);
      } else {
        player.replay();
      }
    } catch (e) {
      console.warn('[VIDEO] Error during retry replay:', e);
    }
  }, [player, currentEpisode?.url, clearTimers, emitStatusUpdate]);

  useEffect(() => {
    if (!player) return undefined;

    const eventedPlayer = player as EventfulVideoPlayer;

    const resetStallWatchdog = () => {
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current);
        stallTimerRef.current = null;
      }
      // If buffering for more than 12 seconds continuously, trigger stall recovery
      if (statusRef.current.isBuffering && !statusRef.current.isPlaying) {
        stallTimerRef.current = setTimeout(() => {
          if (retryCountRef.current < MAX_RETRY_COUNT) {
            retryCountRef.current += 1;
            console.warn(`[VIDEO] Buffering stalled, auto-retrying (${retryCountRef.current}/${MAX_RETRY_COUNT})...`);
            retryCurrentPlayback();
          }
        }, 12000);
      }
    };

    const subscriptions = [
      eventedPlayer.addListener('statusChange', ({ status, error }: StatusChangeEventPayload) => {
        switch (status) {
          case 'loading':
            emitStatusUpdate({ isLoaded: false, isBuffering: true, error: undefined, didJustFinish: false });
            resetStallWatchdog();
            break;
          case 'readyToPlay':
            emitStatusUpdate({ isLoaded: true, isBuffering: false, error: undefined });
            updateDuration();
            applyPendingSeek();
            try {
              player.play();
            } catch (err) {
              console.warn('[VIDEO] Failed to start playback automatically', err);
            }
            lastErrorRef.current = null;
            // Success - reset retry count
            retryCountRef.current = 0;
            if (stallTimerRef.current) {
              clearTimeout(stallTimerRef.current);
              stallTimerRef.current = null;
            }
            break;
          case 'idle':
            emitStatusUpdate({ isLoaded: false, isPlaying: false, isBuffering: false });
            break;
          case 'error': {
            const message = error?.message ?? 'Unknown playback error';
            if (currentEpisode?.url) {
              // Attempt auto-retry on current source first
              if (retryCountRef.current < MAX_RETRY_COUNT) {
                retryCountRef.current += 1;
                const delay = retryCountRef.current * 1500;
                console.warn(`[VIDEO] Playback error encountered: "${message}". Retrying in ${delay}ms (Attempt ${retryCountRef.current}/${MAX_RETRY_COUNT})...`);
                
                errorService.showToast(`播放异常，正在尝试重新连接 (${retryCountRef.current}/${MAX_RETRY_COUNT})...`, 'info');
                
                if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
                retryTimeoutRef.current = setTimeout(() => {
                  retryCurrentPlayback();
                }, delay);
                return;
              }

              // Exhausted retries -> fallback to other source
              if (lastErrorRef.current !== message) {
                lastErrorRef.current = message;
                const { handleVideoError } = usePlayerStore.getState();

                const errorType = errorService.detectErrorType(message);
                let handlerErrorType: 'ssl' | 'network' | 'other' = 'other';
                if (errorType === ErrorType.SSL) handlerErrorType = 'ssl';
                if (errorType === ErrorType.NETWORK) handlerErrorType = 'network';

                errorService.showToast(errorService.formatMessage(message), 'error', '请稍候');
                handleVideoError(handlerErrorType, currentEpisode.url);
              }
            }
            break;
          }
          default: break;
        }
      }),
      eventedPlayer.addListener('playingChange', ({ isPlaying }: PlayingChangeEventPayload) => {
        emitStatusUpdate({ isPlaying });
        if (isPlaying) {
          retryCountRef.current = 0;
          if (stallTimerRef.current) {
            clearTimeout(stallTimerRef.current);
            stallTimerRef.current = null;
          }
        }
      }),
      eventedPlayer.addListener('timeUpdate', ({ currentTime, bufferedPosition }: TimeUpdateEventPayload) => {
        const posMillis = currentTime * 1000;
        if (posMillis > 0) {
          lastValidPositionRef.current = posMillis;
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
      clearTimers();
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [player, currentEpisode?.url, applyPendingSeek, updateDuration, emitStatusUpdate, retryCurrentPlayback, clearTimers]);

  useEffect(() => {
    if (!player) return;
    try {
      player.playbackRate = playbackRate;
    } catch (error) {
      console.warn('[VIDEO] Failed to apply playback rate update', error);
    }
  }, [player, playbackRate]);

  const videoViewProps = useMemo<VideoViewPropsSubset>(
    () => ({ nativeControls: deviceType !== 'tv', contentFit: 'contain' }),
    [deviceType],
  );

  return { player, videoViewProps };
};