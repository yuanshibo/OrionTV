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
    instance.timeUpdateEventInterval = 0.25; // Smoother progress updates (4Hz)
    instance.keepScreenOnWhilePlaying = true;
  });

  const statusRef = useRef<PlaybackState>(createInitialPlaybackState());
  const pendingSeekRef = useRef<number>(0);
  const lastErrorRef = useRef<string | null>(null);

  const emitStatusUpdate = useCallback(
    (updates: Partial<PlaybackState>) => {
      statusRef.current = { ...statusRef.current, ...updates };
      handlePlaybackStatusUpdate({ ...statusRef.current });
    },
    [handlePlaybackStatusUpdate],
  );

  useEffect(() => {
    statusRef.current = createInitialPlaybackState();
    handlePlaybackStatusUpdate(statusRef.current);
    lastErrorRef.current = null;
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
    const durationSeconds = player.duration;
    const durationMillis = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds * 1000 : undefined;
    emitStatusUpdate({ durationMillis });
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
            lastErrorRef.current = null;
            break;
          case 'idle':
            emitStatusUpdate({ isLoaded: false, isPlaying: false, isBuffering: false });
            break;
          case 'error': {
            const message = error?.message ?? 'Unknown playback error';
            if (currentEpisode?.url && lastErrorRef.current !== message) {
              lastErrorRef.current = message;
              const { handleVideoError } = usePlayerStore.getState();

              // Use ErrorService to detect and handle error
              const errorType = errorService.detectErrorType(message);

              // Map ErrorService types to handleVideoError expected types
              let handlerErrorType: 'ssl' | 'network' | 'other' = 'other';
              if (errorType === ErrorType.SSL) handlerErrorType = 'ssl';
              if (errorType === ErrorType.NETWORK) handlerErrorType = 'network';

              errorService.showToast(errorService.formatMessage(message), 'error', '请稍候');
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
        emitStatusUpdate({
          positionMillis: currentTime * 1000,
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
      player.release();
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