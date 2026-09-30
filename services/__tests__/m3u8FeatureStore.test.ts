import {
  initFeatureStore,
  getLearnedKeywords,
  getLearnedDurations,
  extractUrlPattern,
  learnAdFeature,
  clearLearnedFeatures,
} from '../m3u8FeatureStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('m3u8FeatureStore', () => {
  beforeEach(async () => {
    await clearLearnedFeatures();
    jest.clearAllMocks();
  });

  describe('extractUrlPattern', () => {
    it('returns null for empty or invalid input', () => {
      expect(extractUrlPattern('')).toBeNull();
      expect(extractUrlPattern(null as any)).toBeNull();
    });

    it('extracts pattern from url with ad in hostname', () => {
      const pattern = extractUrlPattern('https://ad.ffzy-online.com/2024/seg.ts');
      expect(pattern).toBe('ad\\.ffzy-online\\.com');
    });

    it('extracts pattern from url with /ad/ or /adv/ directory in pathname', () => {
      const pattern = extractUrlPattern('https://cdn.example.com/adv/slice.ts');
      expect(pattern).toBe('\\/adv\\/');
    });

    it('returns null for generic CDN hostnames without ad-specific tokens (prevents mislearning)', () => {
      // Domains like zuidazym3u8.com, ryplay1.com are shared between ad and movie segments
      expect(extractUrlPattern('https://v13.zuidazym3u8.com/yyv13/202609/11/UqsZQmKs8m27/video/2000k_1080/hls/seg_001.ts')).toBeNull();
      expect(extractUrlPattern('https://cdn1.ryplay1.com/20240910/7784_c1c8f178/2000k/hls/seg_001.ts')).toBeNull();
      expect(extractUrlPattern('https://play.phimgood.com/20260707/28681_f69fa239/3000k/hls/seg.ts')).toBeNull();
    });
  });

  describe('learnAdFeature and persistence', () => {
    it('learns new ad duration and persists to AsyncStorage', async () => {
      const changed = await learnAdFeature({ duration: 44.2 });
      expect(changed).toBe(true);

      const durations = getLearnedDurations();
      expect(durations).toContain(44.2);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@oriontv_m3u8_learned_features',
        expect.stringContaining('44.2')
      );
    });

    it('does not duplicate existing similar duration', async () => {
      await learnAdFeature({ duration: 44.0 });
      const changed = await learnAdFeature({ duration: 44.2 });
      expect(changed).toBe(false);
      expect(getLearnedDurations().length).toBe(1);
    });

    it('learns new URL ad pattern and converts to regex', async () => {
      const changed = await learnAdFeature({ url: 'https://dsp.adnetwork.com/slice1.ts' });
      expect(changed).toBe(true);

      const keywords = getLearnedKeywords();
      expect(keywords.some((rx) => rx.test('https://dsp.adnetwork.com/foo.ts'))).toBe(true);
    });

    it('does NOT learn pattern for generic CDN URLs without ad-specific tokens', async () => {
      const changed = await learnAdFeature({ url: 'https://cdn1.ryplay1.com/20240910/7784/seg.ts' });
      expect(changed).toBe(false);
      expect(getLearnedKeywords().length).toBe(0);
    });

    it('evicts oldest keyword when capacity exceeds 50', async () => {
      for (let i = 0; i < 50; i++) {
        await learnAdFeature({ url: `https://ad${i}.adserver.com/seg.ts` });
      }
      expect(getLearnedKeywords().length).toBe(50);

      // Adding one more should evict the oldest (ad0)
      await learnAdFeature({ url: 'https://adnew.adserver.com/seg.ts' });
      expect(getLearnedKeywords().length).toBe(50);
      expect(getLearnedKeywords().some((rx) => rx.test('https://ad0.adserver.com/seg.ts'))).toBe(false);
    });

    it('evicts oldest duration when capacity exceeds 50', async () => {
      for (let i = 0; i < 50; i++) {
        await learnAdFeature({ duration: 10 + i });
      }
      expect(getLearnedDurations().length).toBe(50);

      // Adding one more should evict the oldest (10s)
      await learnAdFeature({ duration: 99 });
      expect(getLearnedDurations().length).toBe(50);
      expect(getLearnedDurations()).not.toContain(10);
    });
  });

  describe('initFeatureStore from existing storage', () => {
    it('loads stored keywords and durations on startup', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({
          keywords: ['specialad\\.com'],
          durations: [38.8],
        })
      );

      await clearLearnedFeatures();
      await initFeatureStore();

      expect(getLearnedDurations()).toContain(38.8);
      const kws = getLearnedKeywords();
      expect(kws.some((rx) => rx.test('http://specialad.com/1.ts'))).toBe(true);
    });
  });
});
