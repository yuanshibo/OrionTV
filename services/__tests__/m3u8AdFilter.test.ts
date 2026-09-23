import ReactNativeBlobUtil from 'react-native-blob-util';
import {
  resolveAbsoluteUrl,
  rewriteTagUri,
  filterM3U8Content,
  processM3U8ForPlayback,
  calculateStreamStats,
  calculateBlockAdScore,
  cleanupM3U8Cache,
  clearAdFilterCache,
  parsePTSFromUint8Array,
  verifyCandidateBlocksViaPTS,
  StreamBlock,
  StreamStats,
  AdCandidateBlock,
} from '../m3u8AdFilter';

// Mock react-native-blob-util
jest.mock('react-native-blob-util', () => ({
  fs: {
    dirs: {
      CacheDir: '/mock/cache',
    },
    writeFile: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn().mockResolvedValue(true),
    ls: jest.fn().mockResolvedValue(['adfree_old_1.m3u8', 'adfree_old_2.m3u8']),
  },
}));

describe('m3u8AdFilter', () => {
  describe('resolveAbsoluteUrl', () => {
    it('returns absolute URL unchanged', () => {
      const url = 'https://cdn.example.com/video/seg1.ts';
      expect(resolveAbsoluteUrl(url, 'https://cdn.example.com/hls/')).toBe(url);
    });

    it('resolves relative URL against base URL with trailing slash', () => {
      expect(resolveAbsoluteUrl('seg1.ts', 'https://cdn.example.com/hls/')).toBe(
        'https://cdn.example.com/hls/seg1.ts'
      );
    });

    it('resolves relative URL against base URL without trailing slash', () => {
      expect(resolveAbsoluteUrl('seg1.ts', 'https://cdn.example.com/hls/index.m3u8')).toBe(
        'https://cdn.example.com/hls/seg1.ts'
      );
    });

    it('handles query parameters correctly', () => {
      expect(resolveAbsoluteUrl('seg1.ts?hash=123', 'https://cdn.example.com/hls/')).toBe(
        'https://cdn.example.com/hls/seg1.ts?hash=123'
      );
    });
  });

  describe('rewriteTagUri', () => {
    it('rewrites URI in #EXT-X-KEY tag to absolute URL', () => {
      const line = '#EXT-X-KEY:METHOD=AES-128,URI="enc.key",IV=0x123';
      const rewritten = rewriteTagUri(line, 'https://cdn.example.com/hls/');
      expect(rewritten).toBe(
        '#EXT-X-KEY:METHOD=AES-128,URI="https://cdn.example.com/hls/enc.key",IV=0x123'
      );
    });

    it('rewrites URI in #EXT-X-MAP tag to absolute URL', () => {
      const line = '#EXT-X-MAP:URI="init.mp4"';
      const rewritten = rewriteTagUri(line, 'https://cdn.example.com/hls/');
      expect(rewritten).toBe('#EXT-X-MAP:URI="https://cdn.example.com/hls/init.mp4"');
    });

    it('leaves lines without URI untouched', () => {
      const line = '#EXT-X-DISCONTINUITY';
      expect(rewriteTagUri(line, 'https://cdn.example.com/hls/')).toBe(line);
    });
  });

  describe('filterM3U8Content', () => {
    it('filters out mid-roll commercial ad block accurately while keeping movie slices', () => {
      // Movie slices: 4.167s each (standard GOP)
      // Ad block: 2 slices totaling 10s (5.0s, 5.0s)
      const m3u8 = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-TARGETDURATION:6',
        '#EXT-X-PLAYLIST-TYPE:VOD',
        '#EXTINF:4.167,',
        'movie_01.ts',
        '#EXTINF:4.167,',
        'movie_02.ts',
        '#EXTINF:4.167,',
        'movie_03.ts',
        '#EXTINF:4.167,',
        'movie_04.ts',
        '#EXT-X-DISCONTINUITY',
        '#EXTINF:5.000,',
        'ad_01.ts',
        '#EXTINF:5.000,',
        'ad_02.ts',
        '#EXT-X-DISCONTINUITY',
        '#EXTINF:4.167,',
        'movie_05.ts',
        '#EXTINF:4.167,',
        'movie_06.ts',
        '#EXTINF:4.167,',
        'movie_07.ts',
        '#EXT-X-ENDLIST',
      ].join('\n');

      const baseUrl = 'https://cdn.example.com/stream/';
      const result = filterM3U8Content(m3u8, baseUrl);

      expect(result.isModified).toBe(true);
      expect(result.adIntervals.length).toBe(1);
      expect(result.adIntervals[0].duration).toBeCloseTo(10.0, 1);
      expect(result.adIntervals[0].start).toBeCloseTo(16.668, 1);
      expect(result.adIntervals[0].end).toBeCloseTo(26.668, 1);

      // Cleaned content should not contain ad segments
      expect(result.content).not.toContain('ad_01.ts');
      expect(result.content).not.toContain('ad_02.ts');

      // Cleaned content should contain all movie segments with absolute URLs
      expect(result.content).toContain('https://cdn.example.com/stream/movie_01.ts');
      expect(result.content).toContain('https://cdn.example.com/stream/movie_07.ts');
      expect(result.content).toContain('#EXT-X-ENDLIST');
    });

    it('filters out blocks matching ad keywords even with unusual durations', () => {
      const m3u8 = [
        '#EXTM3U',
        '#EXTINF:4.0,',
        'movie1.ts',
        '#EXT-X-DISCONTINUITY',
        '#EXTINF:7.3,',
        'https://adserver.com/guanggao_slice.ts',
        '#EXT-X-DISCONTINUITY',
        '#EXTINF:4.0,',
        'movie2.ts',
        '#EXT-X-ENDLIST',
      ].join('\n');

      const result = filterM3U8Content(m3u8, 'https://cdn.example.com/');
      expect(result.isModified).toBe(true);
      expect(result.adIntervals.length).toBe(1);
      expect(result.content).not.toContain('guanggao');
      expect(result.content).toContain('https://cdn.example.com/movie1.ts');
      expect(result.content).toContain('https://cdn.example.com/movie2.ts');
    });

    it('does not falsely filter out normal movie slices that contain #EXT-X-DISCONTINUITY', () => {
      // All blocks share dominant 4.167s duration
      const m3u8 = [
        '#EXTM3U',
        '#EXTINF:4.167,',
        'movie_01.ts',
        '#EXTINF:4.167,',
        'movie_02.ts',
        '#EXT-X-DISCONTINUITY',
        '#EXTINF:4.167,',
        'movie_03.ts',
        '#EXTINF:4.167,',
        'movie_04.ts',
        '#EXT-X-ENDLIST',
      ].join('\n');

      const result = filterM3U8Content(m3u8, 'https://cdn.example.com/');
      expect(result.isModified).toBe(false);
      expect(result.adIntervals.length).toBe(0);
      expect(result.content).toContain('movie_01.ts');
      expect(result.content).toContain('movie_03.ts');
    });

    it('filters out ad block even when one ad slice coincidentally matches dominant movie duration (Sample 2 pattern)', () => {
      // Long movie part 1: 30 slices of 3.336s (~100s)
      // Ad block: 5 slices (5.57, 3.20, 5.37, 3.336, 1.60) totaling ~19.08s
      // Long movie part 2: 30 slices of 3.336s (~100s)
      const movie1 = Array.from({ length: 30 }, (_, i) => `#EXTINF:3.336,\npart1_${i}.ts`).join('\n');
      const ad = [
        '#EXT-X-DISCONTINUITY',
        '#EXTINF:5.570,',
        'ad_01.ts',
        '#EXTINF:3.200,',
        'ad_02.ts',
        '#EXTINF:5.370,',
        'ad_03.ts',
        '#EXTINF:3.336,',
        'ad_04.ts',
        '#EXTINF:1.600,',
        'ad_05.ts',
        '#EXT-X-DISCONTINUITY',
      ].join('\n');
      const movie2 = Array.from({ length: 30 }, (_, i) => `#EXTINF:3.336,\npart2_${i}.ts`).join('\n');

      const m3u8 = `#EXTM3U\n${movie1}\n${ad}\n${movie2}\n#EXT-X-ENDLIST`;
      const result = filterM3U8Content(m3u8, 'https://cdn.example.com/hls/');

      expect(result.isModified).toBe(true);
      expect(result.adIntervals.length).toBe(1);
      expect(result.adIntervals[0].duration).toBeCloseTo(19.076, 2);
      expect(result.adIntervals[0].start).toBeCloseTo(100.08, 1);
      expect(result.content).not.toContain('ad_01.ts');
      expect(result.content).not.toContain('ad_04.ts');
      expect(result.content).toContain('part1_0.ts');
      expect(result.content).toContain('part2_0.ts');
    });

    it('filters out back-to-back ad pods in sparse discontinuity streams', () => {
      // Movie 1: 20 slices of 5.0s (100s)
      // Ad 1: 15s (3 slices of 5s each)
      // Ad 2: 15s (3 slices of 5s each)
      // Movie 2: 20 slices of 5.0s (100s)
      const movie1 = Array.from({ length: 20 }, (_, i) => `#EXTINF:5.0,\nm1_${i}.ts`).join('\n');
      const adPod = [
        '#EXT-X-DISCONTINUITY',
        '#EXTINF:5.0,',
        'ad1_1.ts',
        '#EXTINF:5.0,',
        'ad1_2.ts',
        '#EXTINF:5.0,',
        'ad1_3.ts',
        '#EXT-X-DISCONTINUITY',
        '#EXTINF:5.0,',
        'ad2_1.ts',
        '#EXTINF:5.0,',
        'ad2_2.ts',
        '#EXTINF:5.0,',
        'ad2_3.ts',
        '#EXT-X-DISCONTINUITY',
      ].join('\n');
      const movie2 = Array.from({ length: 20 }, (_, i) => `#EXTINF:5.0,\nm2_${i}.ts`).join('\n');

      const m3u8 = `#EXTM3U\n${movie1}\n${adPod}\n${movie2}\n#EXT-X-ENDLIST`;
      const result = filterM3U8Content(m3u8, 'https://cdn.example.com/hls/');

      expect(result.isModified).toBe(true);
      expect(result.adIntervals.length).toBe(1);
      expect(result.adIntervals[0].duration).toBeCloseTo(30.0, 1);
      expect(result.content).not.toContain('ad1_1.ts');
      expect(result.content).not.toContain('ad2_1.ts');
      expect(result.content).toContain('m1_0.ts');
      expect(result.content).toContain('m2_0.ts');
    });

    it('does not falsely filter out normal 6-slice blocks with varying durations in dense streams (Sample 5 pattern)', () => {
      // Dense stream with 25 blocks of 6 slices each (~24s per block)
      // Dominant duration: 4.0s
      // One block has 6 slices of varying lengths [1.2, 5.8, 4.6, 2.6, 3.3, 4.9] (action scene)
      const blocks: string[] = [];
      for (let b = 0; b < 25; b++) {
        const segs: string[] = [];
        if (b === 10) {
          // Action scene with 6 slices but varying lengths (0 matching 4.0s)
          segs.push('#EXTINF:1.20,\ns1.ts', '#EXTINF:5.80,\ns2.ts', '#EXTINF:4.60,\ns3.ts', '#EXTINF:2.60,\ns4.ts', '#EXTINF:3.30,\ns5.ts', '#EXTINF:4.90,\ns6.ts');
        } else {
          // Regular block with 6 slices (mostly 4.0s)
          segs.push('#EXTINF:4.00,\ns1.ts', '#EXTINF:4.00,\ns2.ts', '#EXTINF:4.00,\ns3.ts', '#EXTINF:4.00,\ns4.ts', '#EXTINF:5.00,\ns5.ts', '#EXTINF:3.00,\ns6.ts');
        }
        blocks.push(`#EXT-X-DISCONTINUITY\n${segs.join('\n')}`);
      }

      const m3u8 = `#EXTM3U\n${blocks.join('\n')}\n#EXT-X-ENDLIST`;
      const result = filterM3U8Content(m3u8, 'https://cdn.example.com/hls/');

      expect(result.isModified).toBe(false);
      expect(result.adIntervals.length).toBe(0);
    });

    it('filters out exact integer commercial ad block (22.00s) in dense 6-slice streams (Sample 5 at 9m38s)', () => {
      // Dense stream with 25 blocks of 6 slices each (~24s per block)
      // Dominant duration: 4.0s
      // Block #12 is a 22.000s ad block with 6 slices: [4.00, 5.48, 2.92, 4.00, 4.32, 1.28] (sum = 22.00)
      const blocks: string[] = [];
      for (let b = 0; b < 25; b++) {
        const segs: string[] = [];
        if (b === 12) {
          // Exactly 22.00s commercial ad
          segs.push(
            '#EXTINF:4.00,\nad1.ts',
            '#EXTINF:5.48,\nad2.ts',
            '#EXTINF:2.92,\nad3.ts',
            '#EXTINF:4.00,\nad4.ts',
            '#EXTINF:4.32,\nad5.ts',
            '#EXTINF:1.28,\nad6.ts'
          );
        } else {
          // Regular block with 6 slices
          segs.push(
            '#EXTINF:4.00,\ns1.ts',
            '#EXTINF:4.00,\ns2.ts',
            '#EXTINF:4.00,\ns3.ts',
            '#EXTINF:4.00,\ns4.ts',
            '#EXTINF:5.00,\ns5.ts',
            '#EXTINF:3.00,\ns6.ts'
          );
        }
        blocks.push(`#EXT-X-DISCONTINUITY\n${segs.join('\n')}`);
      }

      const m3u8 = `#EXTM3U\n${blocks.join('\n')}\n#EXT-X-ENDLIST`;
      const result = filterM3U8Content(m3u8, 'https://cdn.example.com/hls/');

      expect(result.isModified).toBe(true);
      expect(result.adIntervals.length).toBe(1);
      expect(result.adIntervals[0].duration).toBeCloseTo(22.0, 1);
      expect(result.content).not.toContain('ad1.ts');
      expect(result.content).not.toContain('ad2.ts');
    });

    it('filters out boundary post-roll ad block (12.16s, 3 slices) in dense stream', () => {
      // Dense stream with 20 blocks
      // Last block is a 12.16s boundary post-roll ad with 3 slices: [4.00, 5.48, 2.68]
      const blocks: string[] = [];
      for (let b = 0; b < 20; b++) {
        const segs: string[] = [];
        if (b === 19) {
          segs.push(
            '#EXTINF:4.00,\npost_ad1.ts',
            '#EXTINF:5.48,\npost_ad2.ts',
            '#EXTINF:2.68,\npost_ad3.ts'
          );
        } else {
          segs.push(
            '#EXTINF:4.00,\ns1.ts',
            '#EXTINF:4.00,\ns2.ts',
            '#EXTINF:4.00,\ns3.ts',
            '#EXTINF:4.00,\ns4.ts',
            '#EXTINF:5.00,\ns5.ts',
            '#EXTINF:3.00,\ns6.ts'
          );
        }
        blocks.push(`#EXT-X-DISCONTINUITY\n${segs.join('\n')}`);
      }

      const m3u8 = `#EXTM3U\n${blocks.join('\n')}\n#EXT-X-ENDLIST`;
      const result = filterM3U8Content(m3u8, 'https://cdn.example.com/hls/');

      expect(result.isModified).toBe(true);
      expect(result.adIntervals.length).toBe(1);
      expect(result.adIntervals[0].duration).toBeCloseTo(12.16, 1);
      expect(result.content).not.toContain('post_ad1.ts');
    });

    it('filters out inserted ad with remainder slice (29.28s) in high dominant frequency stream (Sample 6 at 12m32s)', () => {
      // Stream with 30 blocks, where 98% of slices are 2.000s
      // Block #15 has 14 slices of 2.00s + 1 slice of 1.28s = 29.28s (matches 30s ad)
      // Block #29 (last block) has 1.16s remainder (boundary, should NOT be filtered)
      const blocks: string[] = [];
      for (let b = 0; b < 30; b++) {
        const segs: string[] = [];
        if (b === 15) {
          // 29.28s commercial ad
          for (let i = 0; i < 14; i++) {
            segs.push(`#EXTINF:2.000,\nad_${i}.ts`);
          }
          segs.push('#EXTINF:1.280,\nad_tail.ts');
        } else if (b === 29) {
          // Last movie block with natural movie end remainder
          for (let i = 0; i < 10; i++) {
            segs.push(`#EXTINF:2.000,\nlast_${i}.ts`);
          }
          segs.push('#EXTINF:1.160,\nmovie_tail.ts');
        } else {
          // Regular movie blocks: all 2.000s
          for (let i = 0; i < 10; i++) {
            segs.push(`#EXTINF:2.000,\nm_${b}_${i}.ts`);
          }
        }
        blocks.push(`#EXT-X-DISCONTINUITY\n${segs.join('\n')}`);
      }

      const m3u8 = `#EXTM3U\n${blocks.join('\n')}\n#EXT-X-ENDLIST`;
      const result = filterM3U8Content(m3u8, 'https://cdn.example.com/hls/');

      expect(result.isModified).toBe(true);
      expect(result.adIntervals.length).toBe(1);
      expect(result.adIntervals[0].duration).toBeCloseTo(29.28, 1);
      expect(result.content).not.toContain('ad_tail.ts');
      expect(result.content).toContain('movie_tail.ts');
    });
  });

  describe('calculateStreamStats', () => {
    it('accurately computes dominant slice duration and sparsity', () => {
      const blocks: StreamBlock[] = [
        { lines: [], durs: [2.0, 2.0, 2.0], duration: 6.0, hasKeyword: false, urls: [] },
        { lines: [], durs: [2.0, 2.0], duration: 4.0, hasKeyword: false, urls: [] },
      ];
      const durCounts = { '2.00': 5 };
      const stats = calculateStreamStats(blocks, durCounts, 5);

      expect(stats.dominantDur).toBe(2.0);
      expect(stats.dominantFreq).toBe(1.0);
      expect(stats.totalDuration).toBe(10.0);
      expect(stats.blockCount).toBe(2);
      expect(stats.avgBlockDuration).toBe(5.0);
    });
  });

  describe('calculateBlockAdScore', () => {
    const defaultStats: StreamStats = {
      totalDuration: 1000,
      blockCount: 20,
      avgBlockDuration: 50,
      isSparseDiscontinuity: false,
      dominantDur: 4.0,
      dominantFreq: 0.4,
      totalSliceCount: 250,
    };

    it('gives maximum score of 100 for keyword match', () => {
      const block: StreamBlock = {
        lines: ['#EXTINF:4.00,', 'guanggao_1.ts'],
        durs: [4.0],
        duration: 4.0,
        hasKeyword: true,
        urls: ['guanggao_1.ts'],
      };
      const res = calculateBlockAdScore(block, 1, [], defaultStats);
      expect(res.score).toBe(100);
      expect(res.reasons).toContain('keyword_match');
    });

    it('returns score 0 for blocks exceeding 90s', () => {
      const block: StreamBlock = {
        lines: [],
        durs: [100.0],
        duration: 100.0,
        hasKeyword: false,
        urls: [],
      };
      const res = calculateBlockAdScore(block, 1, [], defaultStats);
      expect(res.score).toBe(0);
      expect(res.reasons).toContain('exceeds_max_ad_duration_90s');
    });

    it('gives high score for exact integer standard commercial duration in dense streams', () => {
      const block: StreamBlock = {
        lines: [],
        durs: [4.0, 5.48, 2.92, 4.0, 4.32, 1.28], // sum = 22.00
        duration: 22.0,
        hasKeyword: false,
        urls: [],
      };
      const res = calculateBlockAdScore(block, 5, [block, block, block, block, block, block, block], defaultStats);
      expect(res.score).toBeGreaterThanOrEqual(70);
      expect(res.reasons).toContain('exact_integer_commercial_dur_low_dominant');
    });

    it('gives high score for remainder slice in uniform stream (dominantFreq >= 0.70)', () => {
      const uniformStats: StreamStats = {
        totalDuration: 2000,
        blockCount: 50,
        avgBlockDuration: 40,
        isSparseDiscontinuity: false,
        dominantDur: 2.0,
        dominantFreq: 0.95,
        totalSliceCount: 1000,
      };
      const block: StreamBlock = {
        lines: [],
        durs: [2.0, 2.0, 2.0, 2.0, 1.28], // sum = 9.28 ~ 10s ad
        duration: 9.28,
        hasKeyword: false,
        urls: [],
      };
      const blocks = [block, block, block];
      const res = calculateBlockAdScore(block, 1, blocks, uniformStats);
      expect(res.score).toBeGreaterThanOrEqual(70);
      expect(res.reasons).toContain('uniform_stream_remainder_slice_ad');
    });
  });

  describe('processM3U8ForPlayback', () => {
    it('returns original URL immediately when mode is off', async () => {
      const url = 'https://cdn.example.com/test.m3u8';
      const res = await processM3U8ForPlayback(url, 'off');
      expect(res.cleanUrl).toBe(url);
      expect(res.adIntervals).toEqual([]);
      expect(res.isModified).toBe(false);
    });

    it('returns original URL for non-m3u8 media (e.g. mp4)', async () => {
      const url = 'https://cdn.example.com/video.mp4';
      const res = await processM3U8ForPlayback(url, 'seamless');
      expect(res.cleanUrl).toBe(url);
      expect(res.isModified).toBe(false);
    });
  });

  describe('cleanupM3U8Cache', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('sorts files by timestamp and deletes files beyond maxFiles limit', async () => {
      const now = Date.now();
      const mockFiles = [
        `adfree_hash1_${now - 5000}.m3u8`,
        `adfree_hash2_${now - 1000}.m3u8`,
        `adfree_hash3_${now - 3000}.m3u8`,
        `adfree_hash4_${now - 4000}.m3u8`,
        `adfree_hash5_${now - 2000}.m3u8`,
      ];
      (ReactNativeBlobUtil.fs.ls as jest.Mock).mockResolvedValueOnce(mockFiles);

      await cleanupM3U8Cache({ maxFiles: 3, maxAgeMs: 24 * 60 * 60 * 1000 });

      expect(ReactNativeBlobUtil.fs.unlink).toHaveBeenCalledWith(`/mock/cache/adfree_hash4_${now - 4000}.m3u8`);
      expect(ReactNativeBlobUtil.fs.unlink).toHaveBeenCalledWith(`/mock/cache/adfree_hash1_${now - 5000}.m3u8`);
      expect(ReactNativeBlobUtil.fs.unlink).not.toHaveBeenCalledWith(`/mock/cache/adfree_hash2_${now - 1000}.m3u8`);
      expect(ReactNativeBlobUtil.fs.unlink).not.toHaveBeenCalledWith(`/mock/cache/adfree_hash5_${now - 2000}.m3u8`);
      expect(ReactNativeBlobUtil.fs.unlink).not.toHaveBeenCalledWith(`/mock/cache/adfree_hash3_${now - 3000}.m3u8`);
    });

    it('strictly protects activeUrl from being deleted even if it is old or exceeds limit', async () => {
      const now = Date.now();
      const mockFiles = [
        `adfree_hash1_${now - 5000}.m3u8`,
        `adfree_hash2_${now - 1000}.m3u8`,
      ];
      (ReactNativeBlobUtil.fs.ls as jest.Mock).mockResolvedValueOnce(mockFiles);

      await cleanupM3U8Cache({
        maxFiles: 0,
        activeUrl: `file:///mock/cache/adfree_hash1_${now - 5000}.m3u8`,
      });

      expect(ReactNativeBlobUtil.fs.unlink).toHaveBeenCalledWith(`/mock/cache/adfree_hash2_${now - 1000}.m3u8`);
      expect(ReactNativeBlobUtil.fs.unlink).not.toHaveBeenCalledWith(`/mock/cache/adfree_hash1_${now - 5000}.m3u8`);
    });

    it('deletes files older than maxAgeMs', async () => {
      const now = Date.now();
      const freshFile = `adfree_fresh_${now - 1000}.m3u8`;
      const expiredFile = `adfree_expired_${now - 50000}.m3u8`;
      (ReactNativeBlobUtil.fs.ls as jest.Mock).mockResolvedValueOnce([freshFile, expiredFile]);

      await cleanupM3U8Cache({ maxFiles: 10, maxAgeMs: 10000 });

      expect(ReactNativeBlobUtil.fs.unlink).toHaveBeenCalledWith(`/mock/cache/${expiredFile}`);
      expect(ReactNativeBlobUtil.fs.unlink).not.toHaveBeenCalledWith(`/mock/cache/${freshFile}`);
    });
  });

  describe('adFilterResultCache', () => {
    beforeEach(() => {
      clearAdFilterCache();
    });

    it('caches filter result and returns cached result on next call', async () => {
      const url = 'https://cdn.example.com/test.m3u8';
      const fakeM3u8 = '#EXTM3U\n#EXT-X-VERSION:3\n#EXTINF:6.0,\nseg1.ts\n';

      const fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValue({
        ok: true,
        text: async () => fakeM3u8,
        url,
      } as any);

      // First call
      const res1 = await processM3U8ForPlayback(url, 'seamless');
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Second call should hit in-memory cache and not call fetch
      const res2 = await processM3U8ForPlayback(url, 'seamless');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(res2).toEqual(res1);

      // After clearing cache, fetch is called again
      clearAdFilterCache();
      await processM3U8ForPlayback(url, 'seamless');
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      fetchSpy.mockRestore();
    });
  });

  function createMockTsPacketWithPTS(ptsSeconds: number): Uint8Array {
    const buf = new Uint8Array(188 * 3);

    // Packet 0: PAT (PID 0) pointing to PMT PID 256
    buf[0] = 0x47;
    buf[1] = 0x40; // PUSI = 1, PID = 0
    buf[2] = 0x00;
    buf[3] = 0x10; // AFC = 1
    buf[4] = 0x00; // pointer = 0
    buf[15] = 0x01; // PMT PID = 256 (0x0100)
    buf[16] = 0x00;

    // Packet 1: PMT (PID 256) defining H.264 video with PID 257
    buf[188] = 0x47;
    buf[189] = 0x41; // PUSI = 1, PID = 0x0100
    buf[190] = 0x00;
    buf[191] = 0x10;
    buf[192] = 0x00; // pointer = 0
    buf[203] = 0x00; // progInfoLength = 0
    buf[204] = 0x00;
    buf[205] = 0x1b; // Stream type H.264
    buf[206] = 0x01; // Video PID = 257 (0x0101)
    buf[207] = 0x01;

    // Packet 2: Video PES (PID 257) with PTS
    buf[376] = 0x47;
    buf[377] = 0x41; // PUSI = 1, PID = 0x0101
    buf[378] = 0x01;
    buf[379] = 0x10;
    buf[380] = 0x00; // PES start code 00 00 01
    buf[381] = 0x00;
    buf[382] = 0x01;
    buf[383] = 0xe0; // Video stream ID
    buf[387] = 0x80; // flags2: PTS flag set
    const ticks = Math.round(ptsSeconds * 90000);
    buf[389] = 0x21 | (((ticks >>> 30) & 0x07) << 1);
    buf[390] = (ticks >>> 22) & 0xff;
    buf[391] = (((ticks >>> 15) & 0x7f) << 1) | 0x01;
    buf[392] = (ticks >>> 7) & 0xff;
    buf[393] = ((ticks & 0x7f) << 1) | 0x01;

    return buf;
  }

  describe('parsePTSFromUint8Array', () => {
    it('returns null for null, undefined, or buffer shorter than 188 bytes', () => {
      expect(parsePTSFromUint8Array(null as any)).toBeNull();
      expect(parsePTSFromUint8Array(undefined as any)).toBeNull();
      expect(parsePTSFromUint8Array(new Uint8Array([]))).toBeNull();
      expect(parsePTSFromUint8Array(new Uint8Array(100))).toBeNull();
    });

    it('returns null if TS sync byte 0x47 is missing', () => {
      const buf = new Uint8Array(188 * 3);
      expect(parsePTSFromUint8Array(buf)).toBeNull();
    });

    it('returns null when PES packet does not have PTS flag set', () => {
      const buf = createMockTsPacketWithPTS(10.0);
      buf[387] = 0x00;
      expect(parsePTSFromUint8Array(buf)).toBeNull();
    });

    it('correctly parses PTS timestamps from MPEG-TS buffer', () => {
      const pts1 = 789.48;
      const buf1 = createMockTsPacketWithPTS(pts1);
      const parsed1 = parsePTSFromUint8Array(buf1);
      expect(parsed1).not.toBeNull();
      expect(parsed1!).toBeCloseTo(pts1, 2);

      const pts2 = 1.48;
      const buf2 = createMockTsPacketWithPTS(pts2);
      const parsed2 = parsePTSFromUint8Array(buf2);
      expect(parsed2).not.toBeNull();
      expect(parsed2!).toBeCloseTo(pts2, 2);

      const pts3 = 791.48;
      const buf3 = createMockTsPacketWithPTS(pts3);
      const parsed3 = parsePTSFromUint8Array(buf3);
      expect(parsed3).not.toBeNull();
      expect(parsed3!).toBeCloseTo(pts3, 2);
    });
  });

  describe('candidate blocks and verified ad indices in filterM3U8Content', () => {
    function generateDenseM3U8(): string {
      const lines = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-TARGETDURATION:3',
      ];
      for (let b = 0; b < 10; b++) {
        if (b > 0) lines.push('#EXT-X-DISCONTINUITY');
        if (b === 3) {
          // Block 3: inserted commercial ad of 44s (22 slices of 2.0s)
          for (let s = 0; s < 22; s++) {
            lines.push('#EXTINF:2.000,');
            lines.push(`ad_seg_${s}.ts`);
          }
        } else {
          // Movie blocks: 2 or 3 slices of 2.0s
          const sliceCount = b % 2 === 0 ? 2 : 3;
          for (let s = 0; s < sliceCount; s++) {
            lines.push('#EXTINF:2.000,');
            lines.push(`movie_b${b}_s${s}.ts`);
          }
        }
      }
      return lines.join('\n');
    }

    it('identifies ad candidate blocks when dense stream has unconfirmed milestone duration', () => {
      const m3u8 = generateDenseM3U8();
      const res = filterM3U8Content(m3u8, 'https://cdn.example.com/hls/');
      expect(res.isModified).toBe(false);
      expect(res.candidates).toBeDefined();
      expect(res.candidates!.length).toBeGreaterThan(0);
      const adCandidate = res.candidates!.find((c) => c.idx === 3);
      expect(adCandidate).toBeDefined();
      expect(adCandidate!.duration).toBe(44);
    });

    it('strips block and marks isModified true when verifiedAdIndices includes the block', () => {
      const m3u8 = generateDenseM3U8();
      const res = filterM3U8Content(m3u8, 'https://cdn.example.com/hls/', {
        verifiedAdIndices: new Set([3]),
      });
      expect(res.isModified).toBe(true);
      expect(res.totalAdDuration).toBe(44);
      expect(res.adIntervals).toHaveLength(1);
      expect(res.adIntervals[0].duration).toBe(44);
      expect(res.content).not.toContain('ad_seg_');
      expect(res.content).toContain('movie_b0_s0.ts');
      expect(res.content).toContain('movie_b4_s0.ts');
    });
  });

  describe('verifyCandidateBlocksViaPTS', () => {
    it('returns empty set when candidates list is empty', async () => {
      const res = await verifyCandidateBlocksViaPTS([], 'https://cdn.example.com/');
      expect(res.size).toBe(0);
    });

    it('confirms ad candidate when PTS jumps back and bridges seamlessly', async () => {
      const candidate: AdCandidateBlock = {
        idx: 3,
        duration: 44.0,
        prevUrl: 'https://cdn.example.com/prev.ts',
        curUrl: 'https://cdn.example.com/cur.ts',
        nextUrl: 'https://cdn.example.com/next.ts',
        prevDur: 2.0,
      };

      const prevBuf = createMockTsPacketWithPTS(789.48);
      const curBuf = createMockTsPacketWithPTS(1.48);
      const nextBuf = createMockTsPacketWithPTS(791.48);

      const fetchSpy = jest.spyOn(global, 'fetch' as any).mockImplementation((url: any) => {
        let buf = prevBuf;
        if (String(url).includes('cur.ts')) buf = curBuf;
        else if (String(url).includes('next.ts')) buf = nextBuf;
        return Promise.resolve({
          ok: true,
          status: 206,
          arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
        });
      });

      const verified = await verifyCandidateBlocksViaPTS([candidate], 'https://cdn.example.com/');
      expect(verified.has(3)).toBe(true);

      fetchSpy.mockRestore();
    });

    it('does not flag block when PTS continues smoothly without jumping back (normal scene change)', async () => {
      const candidate: AdCandidateBlock = {
        idx: 2,
        duration: 20.0,
        prevUrl: 'https://cdn.example.com/movie_prev.ts',
        curUrl: 'https://cdn.example.com/movie_cur.ts',
        nextUrl: 'https://cdn.example.com/movie_next.ts',
        prevDur: 2.0,
      };

      const prevBuf = createMockTsPacketWithPTS(200.0);
      const curBuf = createMockTsPacketWithPTS(202.0);
      const nextBuf = createMockTsPacketWithPTS(222.0);

      const fetchSpy = jest.spyOn(global, 'fetch' as any).mockImplementation((url: any) => {
        let buf = prevBuf;
        if (String(url).includes('movie_cur.ts')) buf = curBuf;
        else if (String(url).includes('movie_next.ts')) buf = nextBuf;
        return Promise.resolve({
          ok: true,
          status: 206,
          arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
        });
      });

      const verified = await verifyCandidateBlocksViaPTS([candidate], 'https://cdn.example.com/');
      expect(verified.has(2)).toBe(false);

      fetchSpy.mockRestore();
    });

    it('handles network failure or aborted request gracefully', async () => {
      const candidate: AdCandidateBlock = {
        idx: 1,
        duration: 30.0,
        prevUrl: 'https://cdn.example.com/fail_prev.ts',
        curUrl: 'https://cdn.example.com/fail_cur.ts',
        nextUrl: 'https://cdn.example.com/fail_next.ts',
        prevDur: 2.0,
      };

      const fetchSpy = jest.spyOn(global, 'fetch' as any).mockRejectedValue(new Error('Network error'));
      const verified = await verifyCandidateBlocksViaPTS([candidate], 'https://cdn.example.com/');
      expect(verified.size).toBe(0);

      fetchSpy.mockRestore();
    });
  });

  describe('processM3U8ForPlayback with PTS verification', () => {
    beforeEach(() => {
      clearAdFilterCache();
    });

    it('probes candidate blocks in dense stream and writes clean M3U8 when ad is verified via PTS', async () => {
      const streamUrl = 'https://cdn.example.com/dense/index.m3u8';
      const lines = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-TARGETDURATION:3',
      ];
      for (let b = 0; b < 10; b++) {
        if (b > 0) lines.push('#EXT-X-DISCONTINUITY');
        if (b === 3) {
          // Block 3: 44s ad (22 slices)
          for (let s = 0; s < 22; s++) {
            lines.push('#EXTINF:2.000,');
            lines.push(`ad_seg_${s}.ts`);
          }
        } else {
          // 2 slices of 2.0s
          for (let s = 0; s < 2; s++) {
            lines.push('#EXTINF:2.000,');
            lines.push(`m_b${b}_s${s}.ts`);
          }
        }
      }
      const denseM3u8 = lines.join('\n');

      const prevBuf = createMockTsPacketWithPTS(789.48);
      const curBuf = createMockTsPacketWithPTS(1.48);
      const nextBuf = createMockTsPacketWithPTS(791.48);

      const fetchSpy = jest.spyOn(global, 'fetch' as any).mockImplementation((url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('index.m3u8')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            text: async () => denseM3u8,
            url: streamUrl,
          });
        }
        let buf = prevBuf;
        if (urlStr.includes('ad_seg_0.ts')) buf = curBuf;
        else if (urlStr.includes('m_b4_s0.ts')) buf = nextBuf;
        return Promise.resolve({
          ok: true,
          status: 206,
          arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
        });
      });

      const result = await processM3U8ForPlayback(streamUrl, 'seamless');
      expect(result.isModified).toBe(true);
      expect(result.totalAdDuration).toBe(44);
      expect(result.cleanUrl).toContain('file:///mock/cache/adfree_');
      expect(result.adIntervals).toEqual([]);
      expect(ReactNativeBlobUtil.fs.writeFile).toHaveBeenCalled();

      fetchSpy.mockRestore();
    });
  });
});
