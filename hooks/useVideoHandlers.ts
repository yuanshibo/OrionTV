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

  const emitStatusUpdate = useCallback(
    (updates: Partial<PlaybackState>) => {
      statusRef.current = { ...statusRef.current, ...updates };
      handlePlaybackStatusUpdate({ ...statusRef.current });
    },
    [handlePlaybackStatusUpdate],
  );

  const lastValidPositionRef = useRef<number>(0);

  useEffect(() => {
    statusRef.current = createInitialPlaybackState();
    handlePlaybackStatusUpdate(statusRef.current);
    lastErrorUrlRef.current = null;
    lastValidPositionRef.current = 0;
    audioRecoveryCountRef.current = 0;
    lastAudioRecoveryTimeRef.current = 0;
  }, [currentEpisode?.url, handlePlaybackStatusUpdate]);

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
                    (player as any).replaceAsync(currentEpisode.url);
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
        emitStatusUpdate({ isPlaying });
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
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [player, currentEpisode?.url, applyPendingSeek, updateDuration, emitStatusUpdate]);

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