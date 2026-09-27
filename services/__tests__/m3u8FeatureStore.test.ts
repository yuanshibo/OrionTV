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
