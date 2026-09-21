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

  it('manages isLocked state and auto-hides controls on lock', () => {
    expect(usePlayerStore.getState().isLocked).toBe(false);

    // Open controls and modals
    usePlayerStore.setState({
      showControls: true,
      showEpisodeModal: true,
      showSourceModal: true,
      showSpeedModal: true,
    });

    // Lock screen
    usePlayerStore.getState().setIsLocked(true);
    expect(usePlayerStore.getState().isLocked).toBe(true);
    expect(usePlayerStore.getState().showControls).toBe(false);
    expect(usePlayerStore.getState().showEpisodeModal).toBe(false);
    expect(usePlayerStore.getState().showSourceModal).toBe(false);
    expect(usePlayerStore.getState().showSpeedModal).toBe(false);

    // Unlock screen
    usePlayerStore.getState().setIsLocked(false);
    expect(usePlayerStore.getState().isLocked).toBe(false);

    // Toggle screen lock
    usePlayerStore.getState().toggleScreenLock();
    expect(usePlayerStore.getState().isLocked).toBe(true);

    usePlayerStore.getState().toggleScreenLock();
    expect(usePlayerStore.getState().isLocked).toBe(false);

    // Reset clears isLocked
    usePlayerStore.getState().setIsLocked(true);
    usePlayerStore.getState().reset();
    expect(usePlayerStore.getState().isLocked).toBe(false);
  });

  it('preserves isLocked state when switching episodes via playEpisode or loadVideo', async () => {
    usePlayerStore.setState({
      isLocked: true,
      episodes: [
        { url: 'http://example.com/ep1.m3u8', title: '第 1 集' },
        { url: 'http://example.com/ep2.m3u8', title: '第 2 集' },
      ],
      currentEpisodeIndex: 0,
    });

    // Switch episode via playEpisode
    usePlayerStore.getState().playEpisode(1);
    expect(usePlayerStore.getState().currentEpisodeIndex).toBe(1);
    expect(usePlayerStore.getState().isLocked).toBe(true);

    // Reload video / episode via loadVideo
    const mockDetail = {
      id: 123,
      title: '小猪佩奇',
      source: 'test',
      episodes: [
        { url: 'http://example.com/ep1.m3u8', title: '第 1 集' },
        { url: 'http://example.com/ep2.m3u8', title: '第 2 集' },
      ],
    } as any;

    await usePlayerStore.getState().loadVideo({
      detail: mockDetail,
      episodeIndex: 1,
      router: { back: jest.fn() } as any,
    });

    // Still locked!
    expect(usePlayerStore.getState().isLocked).toBe(true);
  });

  it('plays prefetched clean file immediately without delay', () => {
    const mockReplaceAsync = jest.fn().mockResolvedValue(undefined);
    const mockPlayer = {
      replaceAsync: mockReplaceAsync,
    } as any;

    usePlayerStore.setState({
      videoPlayer: mockPlayer,
      episodes: [
        { url: 'file:///mock/cache/adfree_ep1.m3u8', title: '第 1 集' },
        { url: 'file:///mock/cache/adfree_ep2.m3u8', title: '第 2 集' },
      ],
      currentEpisodeIndex: 0,
    });

    usePlayerStore.getState().playEpisode(1);

    expect(usePlayerStore.getState().currentEpisodeIndex).toBe(1);
    expect(mockReplaceAsync).toHaveBeenCalledTimes(1);
    expect(mockReplaceAsync).toHaveBeenCalledWith('file:///mock/cache/adfree_ep2.m3u8');
  });

  it('triggers prefetchNextEpisode when playback status reaches 85% progress', async () => {
    const prefetchSpy = jest.spyOn(usePlayerStore.getState(), 'prefetchNextEpisode').mockResolvedValue(undefined);

    usePlayerStore.setState({
      episodes: [
        { url: 'http://example.com/ep1.m3u8', title: '第 1 集' },
        { url: 'http://example.com/ep2.m3u8', title: '第 2 集' },
      ],
      currentEpisodeIndex: 0,
      status: {
        ...createInitialPlaybackState(),
        isLoaded: true,
        isPlaying: true,
        durationMillis: 100000,
        positionMillis: 50000,
      },
    });

    usePlayerStore.getState().handlePlaybackStatusUpdate({
      ...createInitialPlaybackState(),
      isLoaded: true,
      isPlaying: true,
      durationMillis: 100000,
      positionMillis: 86000, // 86% > 85%
    });

    expect(prefetchSpy).toHaveBeenCalled();
    prefetchSpy.mockRestore();
  });

  it('triggers prefetchNextEpisode at least 60s before outroStartTime even if progress is below 85%', () => {
    const prefetchSpy = jest.spyOn(usePlayerStore.getState(), 'prefetchNextEpisode').mockResolvedValue(undefined);

    usePlayerStore.setState({
      episodes: [
        { url: 'http://example.com/ep1.m3u8', title: '第 1 集' },
        { url: 'http://example.com/ep2.m3u8', title: '第 2 集' },
      ],
      currentEpisodeIndex: 0,
      outroStartTime: 180000, // Outro starts at 180s remaining
      status: {
        ...createInitialPlaybackState(),
        isLoaded: true,
        isPlaying: true,
        durationMillis: 1000000,
        positionMillis: 700000,
      },
    });

    // At 780s (78% < 85%, 220s remaining > 120s, but 220s <= 180s + 60s = 240s)
    usePlayerStore.getState().handlePlaybackStatusUpdate({
      ...createInitialPlaybackState(),
      isLoaded: true,
      isPlaying: true,
      durationMillis: 1000000,
      positionMillis: 780000,
    });

    expect(prefetchSpy).toHaveBeenCalled();
    prefetchSpy.mockRestore();
  });

  describe('Stall failover and position preservation', () => {
    const mockDetail1 = {
      id: '1',
      title: '剧集A',
      source: 'source_1',
      source_name: '源 1',
      episodes: ['http://example.com/s1_ep1.m3u8', 'http://example.com/s1_ep2.m3u8'],
    } as any;

    const mockDetail2 = {
      id: '2',
      title: '剧集A',
      source: 'source_2',
      source_name: '源 2',
      episodes: ['http://example.com/s2_ep1.m3u8', 'http://example.com/s2_ep2.m3u8'],
    } as any;

    beforeEach(() => {
      usePlayerStore.getState().reset();
      useDetailStore.setState({
        detail: mockDetail1,
        searchResults: [mockDetail1, mockDetail2],
        failedSources: new Set(),
      });
    });

    it('handleVideoError preserves current playback position rather than resetting to introEndTime', async () => {
      usePlayerStore.setState({
        currentEpisodeIndex: 0,
        introEndTime: 60000, // 60s
        status: {
          ...createInitialPlaybackState(),
          isLoaded: true,
          isPlaying: true,
          positionMillis: 185000, // 185s
        },
      });

      await usePlayerStore.getState().handleVideoError('network', 'http://example.com/s1_ep1.m3u8');

      const state = usePlayerStore.getState();
      expect(state.initialPosition).toBe(185000); // Preserves 185s, NOT wiped to introEndTime
      expect(useDetailStore.getState().detail?.source).toBe('source_2');
    });

    it('handlePlaybackStall switches source, preserves position, and increments stallFailoverCount', async () => {
      usePlayerStore.setState({
        currentEpisodeIndex: 0,
        introEndTime: 45000,
        stallFailoverCount: 0,
        status: {
          ...createInitialPlaybackState(),
          isLoaded: true,
          isPlaying: false,
          isBuffering: true,
          positionMillis: 230000, // 230s
        },
      });

      await usePlayerStore.getState().handlePlaybackStall(230000);

      const state = usePlayerStore.getState();
      expect(state.initialPosition).toBe(230000);
      expect(state.stallFailoverCount).toBe(1);
      expect(useDetailStore.getState().detail?.source).toBe('source_2');
    });

    it('handlePlaybackStall stops failover when stallFailoverCount reaches 3', async () => {
      usePlayerStore.setState({
        currentEpisodeIndex: 0,
        stallFailoverCount: 3,
        status: {
          ...createInitialPlaybackState(),
          isLoaded: true,
          isPlaying: false,
          isBuffering: true,
          positionMillis: 50000,
        },
      });

      await usePlayerStore.getState().handlePlaybackStall(50000);

      // Should not switch source
      expect(usePlayerStore.getState().stallFailoverCount).toBe(3);
      expect(useDetailStore.getState().detail?.source).toBe('source_1');
    });

    it('playEpisode resets stallFailoverCount to 0', () => {
      usePlayerStore.setState({
        episodes: [
          { url: 'http://example.com/ep1.m3u8', title: '第 1 集' },
          { url: 'http://example.com/ep2.m3u8', title: '第 2 集' },
        ],
        currentEpisodeIndex: 0,
        stallFailoverCount: 2,
      });

      usePlayerStore.getState().playEpisode(1);
      expect(usePlayerStore.getState().stallFailoverCount).toBe(0);
    });
  });
});
