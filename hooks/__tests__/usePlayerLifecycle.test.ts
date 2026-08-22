import { renderHook, act } from '@testing-library/react-native';
import { AppState, BackHandler } from 'react-native';
import { usePlayerLifecycle } from '../usePlayerLifecycle';
import usePlayerStore, { PlaybackState } from '@/stores/playerStore';

const createInitialPlaybackState = (): PlaybackState => ({
  isLoaded: false,
  isPlaying: false,
  isBuffering: false,
  positionMillis: 0,
  durationMillis: undefined,
  playableDurationMillis: undefined,
  bufferedMillis: undefined,
  didJustFinish: false,
  error: undefined,
});

const mockBack = jest.fn();
const mockCanGoBack = jest.fn().mockReturnValue(true);

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    canGoBack: mockCanGoBack,
  }),
}));

describe('usePlayerLifecycle', () => {
  let appStateListener: ((state: string) => void) | null = null;
  let backHandlerListener: (() => boolean) | null = null;
  let mockPlayer: { play: jest.Mock; pause: jest.Mock; playing: boolean };
  let mockFlushPlaybackRecord: jest.Mock;
  let mockSetShowControls: jest.Mock;
  let mockSetShowRelatedVideos: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();

    appStateListener = null;
    backHandlerListener = null;
    usePlayerStore.setState({ isUserPaused: false, status: null });

    (AppState as any).currentState = 'active';
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event: string, handler: any) => {
      if (event === 'change') {
        appStateListener = handler;
      }
      return { remove: jest.fn() } as any;
    });

    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((event: string, handler: any) => {
      if (event === 'hardwareBackPress') {
        backHandlerListener = handler;
      }
      return { remove: jest.fn() } as any;
    });

    mockPlayer = {
      play: jest.fn(),
      pause: jest.fn(),
      playing: true,
    };

    mockFlushPlaybackRecord = jest.fn();
    mockSetShowControls = jest.fn();
    mockSetShowRelatedVideos = jest.fn();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  const setupHook = (initialStatus?: Partial<PlaybackState>) => {
    const status: PlaybackState = {
      ...createInitialPlaybackState(),
      isLoaded: true,
      isPlaying: true,
      ...initialStatus,
    };
    usePlayerStore.setState({ isUserPaused: !status.isPlaying, status });

    interface HookProps {
      player: typeof mockPlayer | null;
      status: PlaybackState;
      showControls: boolean;
      showRelatedVideos: boolean;
    }

    return renderHook(
      (props: HookProps) =>
        usePlayerLifecycle({
          player: props.player as any,
          status: props.status,
          showControls: props.showControls,
          showRelatedVideos: props.showRelatedVideos,
          flushPlaybackRecord: mockFlushPlaybackRecord,
          setShowControls: mockSetShowControls,
          setShowRelatedVideos: mockSetShowRelatedVideos,
        }),
      {
        initialProps: {
          player: mockPlayer,
          status,
          showControls: false,
          showRelatedVideos: false,
        },
      },
    );
  };

  it('resumes playback when returning from TV home launcher (active -> inactive -> background -> active)', () => {
    setupHook({ isPlaying: true });

    expect(appStateListener).not.toBeNull();

    // 1. App loses focus (inactive)
    act(() => {
      appStateListener!('inactive');
    });
    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
    expect(mockFlushPlaybackRecord).toHaveBeenCalledTimes(1);

    // Simulate player pausing event causing isPlaying to become false
    mockPlayer.playing = false;

    // 2. App goes to background (onStop)
    act(() => {
      appStateListener!('background');
    });
    expect(mockPlayer.pause).toHaveBeenCalledTimes(2);

    // 3. User clicks app icon to return (active)
    act(() => {
      appStateListener!('active');
    });
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  });

  it('does NOT resume playback if video was already paused before background transition', () => {
    mockPlayer.playing = false;
    setupHook({ isPlaying: false });

    // Transition active -> inactive -> background
    act(() => {
      appStateListener!('inactive');
    });
    act(() => {
      appStateListener!('background');
    });

    // Return to active
    act(() => {
      appStateListener!('active');
    });

    expect(mockPlayer.play).not.toHaveBeenCalled();
  });

  it('resumes playback on direct active -> background -> active transition', () => {
    setupHook({ isPlaying: true });

    act(() => {
      appStateListener!('background');
    });
    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);

    act(() => {
      appStateListener!('active');
    });
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  });

  it('handles multiple background/resume cycles correctly', () => {
    const { rerender } = setupHook({ isPlaying: true });

    // Cycle 1: was playing -> background -> active (should resume)
    act(() => {
      appStateListener!('inactive');
      appStateListener!('background');
    });
    act(() => {
      appStateListener!('active');
    });
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);

    // User pauses manually
    mockPlayer.playing = false;
    usePlayerStore.setState({ isUserPaused: true });
    rerender({
      player: mockPlayer,
      status: { ...createInitialPlaybackState(), isLoaded: true, isPlaying: false },
      showControls: false,
      showRelatedVideos: false,
    });

    // Cycle 2: was paused -> background -> active (should NOT resume)
    act(() => {
      appStateListener!('inactive');
      appStateListener!('background');
    });
    act(() => {
      appStateListener!('active');
    });
    // play count should still be 1 from cycle 1
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  });

  it('handles BackHandler properly for related videos modal, controls, and router back', () => {
    const { rerender } = setupHook({ isPlaying: true });

    expect(backHandlerListener).not.toBeNull();

    // 1. Related videos open
    rerender({
      player: mockPlayer,
      status: { ...createInitialPlaybackState(), isLoaded: true, isPlaying: true },
      showControls: false,
      showRelatedVideos: true,
    });
    let handled = false;
    act(() => {
      handled = backHandlerListener!();
    });
    expect(handled).toBe(true);
    expect(mockSetShowRelatedVideos).toHaveBeenCalledWith(false);
    expect(mockBack).toHaveBeenCalledTimes(1);

    // 2. Controls open
    rerender({
      player: mockPlayer,
      status: { ...createInitialPlaybackState(), isLoaded: true, isPlaying: true },
      showControls: true,
      showRelatedVideos: false,
    });
    act(() => {
      handled = backHandlerListener!();
    });
    expect(handled).toBe(true);
    expect(mockSetShowControls).toHaveBeenCalledWith(false);

    // 3. Normal back
    rerender({
      player: mockPlayer,
      status: { ...createInitialPlaybackState(), isLoaded: true, isPlaying: true },
      showControls: false,
      showRelatedVideos: false,
    });
    act(() => {
      handled = backHandlerListener!();
    });
    expect(handled).toBe(true);
    expect(mockFlushPlaybackRecord).toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalledTimes(2);
  });
});
