import usePlayerStore, { createInitialPlaybackState } from '../playerStore';
import useDetailStore from '../detailStore';

describe('playerStore - Playback Recovery and togglePlayPause', () => {
  beforeEach(() => {
    usePlayerStore.getState().reset();
    useDetailStore.setState({ detail: null, loading: false });
    jest.clearAllMocks();
  });

  it('toggles play/pause when loaded and playing normally', () => {
    const mockPlay = jest.fn();
    const mockPause = jest.fn();
    const mockPlayer = {
      play: mockPlay,
      pause: mockPause,
      status: 'readyToPlay',
    } as any;

    usePlayerStore.setState({
      videoPlayer: mockPlayer,
      status: {
        ...createInitialPlaybackState(),
        isLoaded: true,
        isPlaying: true,
      },
    });

    // 1. When playing, toggle should pause
    usePlayerStore.getState().togglePlayPause();
    expect(mockPause).toHaveBeenCalledTimes(1);
    expect(usePlayerStore.getState().isUserPaused).toBe(true);

    // Update status to paused
    usePlayerStore.setState({
      status: {
        ...createInitialPlaybackState(),
        isLoaded: true,
        isPlaying: false,
      },
    });

    // 2. When paused, toggle should play
    usePlayerStore.getState().togglePlayPause();
    expect(mockPlay).toHaveBeenCalledTimes(1);
    expect(usePlayerStore.getState().isUserPaused).toBe(false);
  });

  it('triggers recovery on togglePlayPause when in error state', async () => {
    const mockReplace = jest.fn();
    const mockPlay = jest.fn();
    const mockPlayer = {
      replace: mockReplace,
      play: mockPlay,
      currentTime: 0,
      status: 'error',
    } as any;

    usePlayerStore.setState({
      videoPlayer: mockPlayer,
      episodes: [{ url: 'http://example.com/ep1.m3u8', title: '第 1 集' }],
      currentEpisodeIndex: 0,
      initialPosition: 45000,
      error: '音频设备连接变动，正在恢复播放...',
      status: null,
    });

    // When error is present, togglePlayPause should call retryCurrentPlayback
    usePlayerStore.getState().togglePlayPause();

    // Verify error was cleared and replace was invoked
    expect(usePlayerStore.getState().error).toBeUndefined();
    expect(mockReplace).toHaveBeenCalledWith('http://example.com/ep1.m3u8');
    expect(mockPlayer.currentTime).toBe(45);
    expect(mockPlay).toHaveBeenCalled();
  });

  it('triggers recovery on togglePlayPause when native video player is in error status', async () => {
    const mockReplace = jest.fn();
    const mockPlay = jest.fn();
    const mockPlayer = {
      replace: mockReplace,
      play: mockPlay,
      currentTime: 0,
      status: 'error',
    } as any;

    usePlayerStore.setState({
      videoPlayer: mockPlayer,
      episodes: [{ url: 'http://example.com/ep1.m3u8', title: '第 1 集' }],
      currentEpisodeIndex: 0,
      status: {
        ...createInitialPlaybackState(),
        isLoaded: true,
        isPlaying: false,
        positionMillis: 60000,
      },
    });

    usePlayerStore.getState().togglePlayPause();

    expect(mockReplace).toHaveBeenCalledWith('http://example.com/ep1.m3u8');
    expect(mockPlayer.currentTime).toBe(60);
    expect(mockPlay).toHaveBeenCalled();
  });
});
