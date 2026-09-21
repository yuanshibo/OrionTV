import { latencyPriority, shouldPreferEnrichedResult } from '../DetailUtils';
import { SearchResultWithResolution } from '@/types';

describe('DetailUtils - Latency and Source Ranking', () => {
  describe('latencyPriority', () => {
    it('returns 0 for unknown or non-positive latency', () => {
      expect(latencyPriority(undefined)).toBe(0);
      expect(latencyPriority(null)).toBe(0);
      expect(latencyPriority(0)).toBe(0);
      expect(latencyPriority(-100)).toBe(0);
    });

    it('ranks latency into proper quality buckets', () => {
      expect(latencyPriority(120)).toBe(4); // < 300ms
      expect(latencyPriority(299)).toBe(4);
      expect(latencyPriority(300)).toBe(3); // 300-600ms
      expect(latencyPriority(599)).toBe(3);
      expect(latencyPriority(600)).toBe(2); // 600-1200ms
      expect(latencyPriority(1199)).toBe(2);
      expect(latencyPriority(1200)).toBe(1); // 1200-2000ms
      expect(latencyPriority(1999)).toBe(1);
      expect(latencyPriority(2000)).toBe(-2); // > 2000ms
      expect(latencyPriority(5000)).toBe(-2);
    });
  });

  describe('shouldPreferEnrichedResult with Composite Scoring', () => {
    const baseSource: SearchResultWithResolution = {
      id: 1,
      title: 'Test Movie',
      poster: 'http://example.com/poster.jpg',
      year: '2024',
      source: 'src_base',
      source_name: '普通源',
      episodes: ['http://example.com/1.m3u8'],
    };

    it('prefers candidate with more episodes regardless of other metrics', () => {
      const current = { ...baseSource, episodes: ['ep1'] };
      const candidate = { ...baseSource, source: 'src2', episodes: ['ep1', 'ep2'] };
      expect(shouldPreferEnrichedResult(current, candidate)).toBe(true);

      // Fewer episodes rejected
      expect(shouldPreferEnrichedResult(candidate, current)).toBe(false);
    });

    it('prefers candidate with higher resolution when episode count is equal', () => {
      const current: SearchResultWithResolution = {
        ...baseSource,
        resolution: '720P',
        latencyMs: 200,
      };
      const candidate: SearchResultWithResolution = {
        ...baseSource,
        source: 'src2',
        resolution: '1080P',
        latencyMs: 400,
      };
      // 1080P (score 3*10=30 + 3*8=24 = 54) vs 720P (score 2*10=20 + 4*8=32 = 52)
      expect(shouldPreferEnrichedResult(current, candidate)).toBe(true);
    });

    it('prefers candidate with lower latency when episode count and resolution are equal', () => {
      const slowCurrent: SearchResultWithResolution = {
        ...baseSource,
        resolution: '1080P',
        latencyMs: 1500, // score 1
      };
      const fastCandidate: SearchResultWithResolution = {
        ...baseSource,
        source: 'src2',
        resolution: '1080P',
        latencyMs: 220, // score 4
      };
      expect(shouldPreferEnrichedResult(slowCurrent, fastCandidate)).toBe(true);
      expect(shouldPreferEnrichedResult(fastCandidate, slowCurrent)).toBe(false);
    });

    it('returns false when candidate total score is less than or equal to current', () => {
      const current: SearchResultWithResolution = {
        ...baseSource,
        resolution: '1080P',
        latencyMs: 250,
      };
      const candidate: SearchResultWithResolution = {
        ...baseSource,
        source: 'src2',
        resolution: '720P',
        latencyMs: 300,
      };
      expect(shouldPreferEnrichedResult(current, candidate)).toBe(false);
    });
  });
});
