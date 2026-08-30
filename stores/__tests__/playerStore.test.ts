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

  it('cycles contentFit when toggleContentFit is called', () => {
    expect(usePlayerStore.getState().contentFit).toBe('contain');

    usePlayerStore.getState().toggleContentFit();
    expect(usePlayerStore.getState().contentFit).toBe('cover');

    usePlayerStore.getState().toggleContentFit();
    expect(usePlayerStore.getState().contentFit).toBe('fill');

    usePlayerStore.getState().toggleContentFit();
    expect(usePlayerStore.getState().contentFit).toBe('contain');
  });

  it('reuses videoPlayer replaceAsync/replace when switching episodes via playEpisode', () => {
    const mockReplaceAsync = jest.fn().mockResolvedValue(undefined);
    const mockPlayer = {
      replaceAsync: mockReplaceAsync,
    } as any;

    usePlayerStore.setState({
      videoPlayer: mockPlayer,
      episodes: [
        { url: 'http://example.com/ep1.m3u8', title: '第 1 集' },
        { url: 'http://example.com/ep2.m3u8', title: '第 2 集' },
      ],
      currentEpisodeIndex: 0,
    });

    usePlayerStore.getState().playEpisode(1);

    expect(usePlayerStore.getState().currentEpisodeIndex).toBe(1);
    expect(mockReplaceAsync).toHaveBeenCalledWith('http://example.com/ep2.m3u8');
  });
});
