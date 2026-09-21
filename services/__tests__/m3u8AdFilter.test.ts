import {
  resolveAbsoluteUrl,
  rewriteTagUri,
  filterM3U8Content,
  processM3U8ForPlayback,
} from '../m3u8AdFilter';

// Mock react-native-blob-util
jest.mock('react-native-blob-util', () => ({
  fs: {
    dirs: {
      CacheDir: '/mock/cache',
    },
    writeFile: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
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
});
