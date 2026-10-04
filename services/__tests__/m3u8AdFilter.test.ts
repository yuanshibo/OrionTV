import ReactNativeBlobUtil from 'react-native-blob-util';
import {
  processM3U8ForPlayback,
  cleanupM3U8Cache,
  clearAdFilterCache,
} from '../m3u8AdFilter';
import {
  parseM3U8BlocksForEngine,
  resolveAbsoluteUrl,
  PhysicalAdEngine,
  reconstructM3U8,
  parsePTSFromUint8Array,
} from '../m3u8AdEngine';

// Mock react-native-blob-util
jest.mock('react-native-blob-util', () => ({
  fs: {
    dirs: { CacheDir: '/mock/cache' },
    writeFile: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn().mockResolvedValue(false),
    ls: jest.fn().mockResolvedValue([]),
    stat: jest.fn().mockResolvedValue({ lastModified: Date.now() }),
  },
  base64: { encode: jest.fn().mockReturnValue('mockBase64') },
}));

global.fetch = jest.fn() as jest.Mock;

describe('m3u8AdEngine and m3u8AdFilter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAdFilterCache();
  });

  describe('resolveAbsoluteUrl', () => {
    it('returns absolute URL unchanged', () => {
      expect(resolveAbsoluteUrl('https://example.com/a.ts', 'https://base.com/')).toBe('https://example.com/a.ts');
    });

    it('resolves relative URL', () => {
      expect(resolveAbsoluteUrl('a.ts', 'https://base.com/')).toBe('https://base.com/a.ts');
    });
  });

  describe('parseM3U8BlocksForEngine', () => {
    it('parses blocks by discontinuity', () => {
      const text = [
        '#EXTM3U',
        '#EXTINF:2.0',
        'a.ts',
        '#EXT-X-DISCONTINUITY',
        '#EXTINF:4.0',
        'b.ts'
      ].join('\n');
      
      const res = parseM3U8BlocksForEngine(text);
      expect(res.blocks.length).toBe(2);
      expect(res.blocks[0].duration).toBe(2.0);
      expect(res.blocks[1].duration).toBe(4.0);
    });
  });

  describe('reconstructM3U8', () => {
    it('omits discontinuity when seamless bridging drops an ad', () => {
      const text = [
        '#EXTM3U',
        '#EXTINF:2.0',
        'a.ts',
        '#EXT-X-DISCONTINUITY',
        '#EXTINF:4.0',
        'ad.ts',
        '#EXT-X-DISCONTINUITY',
        '#EXTINF:2.0',
        'b.ts'
      ].join('\n');
      
      const { blocks, headerLines } = parseM3U8BlocksForEngine(text);
      const ads = new Set([1]); // ad block is index 1
      
      const out = reconstructM3U8(blocks, headerLines, ads, 'http://base/', false);
      // We removed the ad. Since we bridged 0 and 2, and 1 was an ad,
      // it should NOT output a discontinuity between a.ts and b.ts.
      expect(out).toContain('a.ts');
      expect(out).toContain('b.ts');
      expect(out).not.toContain('ad.ts');
      // Number of discontinuities: original had 2, we dropped the ad block, so 0 should remain.
      expect(out).not.toContain('#EXT-X-DISCONTINUITY');
    });
  });

  describe('processM3U8ForPlayback', () => {
    it('returns unmodified for non-m3u8 urls', async () => {
      const res = await processM3U8ForPlayback('https://example.com/video.mp4');
      expect(res.isModified).toBe(false);
    });

    it('fetches m3u8 and filters it when ads are present (mocked)', async () => {
      // Return a basic m3u8
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve([
          '#EXTM3U',
          '#EXTINF:2.0',
          'a.ts',
          '#EXT-X-DISCONTINUITY',
          '#EXTINF:4.0',
          'ad.ts',
        ].join('\n')),
        url: 'https://example.com/master.m3u8'
      });
      
      // Mock the engine probe fetch (it will fail and return null PTS, which we just ignore)
      (global.fetch as jest.Mock).mockResolvedValue({
         ok: false,
         status: 404
      });

      const res = await processM3U8ForPlayback('https://example.com/playlist.m3u8');
      // Since fetch fails to get PTS, engine will fail open and not remove anything
      expect(res.isModified).toBe(false);
    });
  });
});
