import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useVideoPlayer, VideoPlayer, VideoViewProps } from 'expo-video';
import type {
  VideoPlayerEvents,
  StatusChangeEventPayload,
  PlayingChangeEventPayload,
  TimeUpdateEventPayload,
  SourceLoadEventPayload,
} from 'expo-video';
import Toast from 'react-native-toast-message';
import usePlayerStore, { PlaybackState, createInitialPlaybackState } from '@/stores/playerStore';

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
  videoViewProps: Pick<VideoViewProps, 'nativeControls' | 'contentFit'>;
}

type EventfulVideoPlayer = VideoPlayer & {
  addListener<K extends keyof VideoPlayerEvents>(eventName: K, listener: VideoPlayerEvents[K]): { remove(): void };
};

const ERROR_SIGNATURES = {
  ssl: [
    'SSLHandshakeException',
    'CertPathValidatorException',
    'Trust anchor for certification path not found',
  ],
  network: ['HttpDataSourceException', 'IOException', 'SocketTimeoutException'],
} as const;

type ErrorType = keyof typeof ERROR_SIGNATURES | 'other';

const detectErrorType = (message: string): ErrorType => {
  if (!message) {
    return 'other';
  }

  const normalizedMessage = message.toLowerCase();

  if (ERROR_SIGNATURES.ssl.some((token) => normalizedMessage.includes(token.toLowerCase()))) {
    return 'ssl';
  }

  if (ERROR_SIGNATURES.network.some((token) => normalizedMessage.includes(token.toLowerCase()))) {
    return 'network';
  }

  return 'other';
};

const showErrorToast = (type: ErrorType) => {
  switch (type) {
    case 'ssl':
      Toast.show({
        type: 'error',
        text1: 'SSL证书错误，正在尝试其他播放源...',
        text2: '请稍候',
      });
      break;
    case 'network':
      Toast.show({
        type: 'error',
        text1: '网络连接失败，正在尝试其他播放源...',
        text2: '请稍候',
      });
      break;
    default:
      Toast.show({
        type: 'error',
        text1: '视频播放失败，正在尝试其他播放源...',
        text2: '请稍候',
      });
  }
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
    instance.timeUpdateEventInterval = 0.5;
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
    handlePlaybackStatusUpdate({ ...statusRef.current });
    lastErrorRef.current = null;
  }, [player, handlePlaybackStatusUpdate]);

  useEffect(() => {
    pendingSeekRef.current = initialPosition || introEndTime || 0;
  }, [initialPosition, introEndTime, currentEpisode?.url]);

  useEffect(() => {
    if (currentEpisode?.url) {
      usePlayerStore.setState({ isLoading: true });
    }
  }, [currentEpisode?.url]);

  const applyPendingSeek = useCallback(() => {
    if (!player) {
      return;
    }

    const target = pendingSeekRef.current;
    if (target && target > 0) {
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
    const durationMillis =
      Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds * 1000 : undefined;
    emitStatusUpdate({ durationMillis });
  }, [player, emitStatusUpdate]);

  useEffect(() => {
    if (!player) {
      return undefined;
    }

    const eventedPlayer = player as EventfulVideoPlayer;

    const subscriptions = [
      eventedPlayer.addListener('statusChange', ({ status, error }: StatusChangeEventPayload) => {
        switch (status) {
          case 'loading':
            emitStatusUpdate({
              isLoaded: false,
              isBuffering: true,
              error: undefined,
              didJustFinish: false,
            });
            usePlayerStore.setState({ isLoading: true });
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
            usePlayerStore.setState({ isLoading: false });
            lastErrorRef.current = null;
            break;
          case 'idle':
            emitStatusUpdate({ isLoaded: false, isPlaying: false, isBuffering: false });
            break;
          case 'error': {
            const message = error?.message ?? 'Unknown playback error';
            emitStatusUpdate({
              isLoaded: false,
              isPlaying: false,
              isBuffering: false,
              error: message,
            });
            usePlayerStore.setState({ isLoading: false });
            if (currentEpisode?.url && lastErrorRef.current !== message) {
              lastErrorRef.current = message;
              const errorType = detectErrorType(message);
              showErrorToast(errorType);
              usePlayerStore.getState().handleVideoError(errorType === 'other' ? 'other' : errorType, currentEpisode.url);
            }
            break;
          }
          default:
            break;
        }
      }),
      eventedPlayer.addListener('playingChange', ({ isPlaying }: PlayingChangeEventPayload) => {
        emitStatusUpdate({ isPlaying, isBuffering: false, didJustFinish: false });
        if (isPlaying) {
          usePlayerStore.setState({ isLoading: false });
        }
      }),
      eventedPlayer.addListener(
        'timeUpdate',
        ({ currentTime, bufferedPosition }: TimeUpdateEventPayload) => {
          emitStatusUpdate({
            positionMillis: currentTime * 1000,
            bufferedMillis: bufferedPosition >= 0 ? bufferedPosition * 1000 : undefined,
            didJustFinish: false,
          });
        },
      ),
      eventedPlayer.addListener('playToEnd', () => {
        emitStatusUpdate({ didJustFinish: true, isPlaying: false });
      }),
      eventedPlayer.addListener('sourceLoad', (_payload: SourceLoadEventPayload) => {
        updateDuration();
        applyPendingSeek();
        try {
          player.play();
        } catch (err) {
          console.warn('[VIDEO] Failed to start playback after loading source', err);
        }
        usePlayerStore.setState({ isLoading: false });
      }),
    ];

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [player, currentEpisode?.url, applyPendingSeek, updateDuration, emitStatusUpdate]);

  useEffect(() => {
    if (!player) {
      return;
    }

    try {
      player.playbackRate = playbackRate;
    } catch (error) {
      console.warn('[VIDEO] Failed to apply playback rate update', error);
    }
  }, [player, playbackRate]);

  const videoViewProps = useMemo<Pick<VideoViewProps, 'nativeControls' | 'contentFit'>>(
    () => ({
      nativeControls: deviceType !== 'tv',
      contentFit: 'contain',
    }),
    [deviceType],
  );

  return {
    player,
    videoViewProps,
  };
};
