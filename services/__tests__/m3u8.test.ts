import {
  probeM3U8,
  getRawM3U8FromCache,
  setRawM3U8ToCache,
  clearRawM3U8Cache,
} from '../m3u8';

describe('services/m3u8 and rawM3U8Cache', () => {
  beforeEach(() => {
    clearRawM3U8Cache();
    jest.clearAllMocks();
  });

  describe('rawM3U8Cache', () => {
    it('sets and gets raw M3U8 text from cache', () => {
      const url = 'https://example.com/stream.m3u8';
      const text = '#EXTM3U\n#EXTINF:2.0,\nseg1.ts\n';
      setRawM3U8ToCache(url, text, url);

      const cached = getRawM3U8FromCache(url);
      expect(cached).not.toBeNull();
      expect(cached?.text).toBe(text);
      expect(cached?.finalUrl).toBe(url);
    });

    it('returns null for nonexistent or cleared cache entries', () => {
      expect(getRawM3U8FromCache('https://notfound.com/1.m3u8')).toBeNull();

      setRawM3U8ToCache('https://example.com/stream.m3u8', 'test');
      clearRawM3U8Cache();
      expect(getRawM3U8FromCache('https://example.com/stream.m3u8')).toBeNull();
    });
  });

  describe('probeM3U8 caching integration', () => {
    it('populates rawM3U8Cache upon successful probe', async () => {
      const url = 'https://cdn.example.com/playlist.m3u8';
      const fakeContent =
        '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1920x1080\nvariant.m3u8';

      const fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValueOnce({
        ok: true,
        text: async () => fakeContent,
        url,
      } as any);

      const probeResult = await probeM3U8(url);
      expect(probeResult.available).toBe(true);
      expect(probeResult.resolution).toBe('1080p');

      const cached = getRawM3U8FromCache(url);
      expect(cached).not.toBeNull();
      expect(cached?.text).toBe(fakeContent);

      fetchSpy.mockRestore();
    });
  });
});
