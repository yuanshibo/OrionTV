import {
  chunkEpisodes,
  buildDisplayEpisodes,
  chunkDisplayEpisodes,
  getEpisodeProgressInfo,
} from '../episodeUtils';

describe('episodeUtils', () => {
  describe('chunkEpisodes', () => {
    it('returns empty array for invalid or empty inputs', () => {
      expect(chunkEpisodes([], 10)).toEqual([]);
      expect(chunkEpisodes(null as any, 10)).toEqual([]);
      expect(chunkEpisodes(['ep1'], 0)).toEqual([]);
    });

    it('correctly chunks episodes into ranges', () => {
      const episodes = Array.from({ length: 25 }, (_, i) => `url-${i + 1}`);
      const chunks = chunkEpisodes(episodes, 10);

      expect(chunks).toHaveLength(3);
      expect(chunks[0].label).toBe('1-10');
      expect(chunks[0].items).toHaveLength(10);
      expect(chunks[1].label).toBe('11-20');
      expect(chunks[1].items).toHaveLength(10);
      expect(chunks[2].label).toBe('21-25');
      expect(chunks[2].items).toHaveLength(5);
    });
  });

  describe('buildDisplayEpisodes', () => {
    it('returns empty array for empty inputs', () => {
      expect(buildDisplayEpisodes([])).toEqual([]);
      expect(buildDisplayEpisodes(null as any)).toEqual([]);
    });

    it('builds standard display episodes in ascending order', () => {
      const episodes = ['url1', 'url2', 'url3'];
      const result = buildDisplayEpisodes(episodes, false);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ originalIndex: 0, url: 'url1', title: undefined });
      expect(result[1]).toEqual({ originalIndex: 1, url: 'url2', title: undefined });
      expect(result[2]).toEqual({ originalIndex: 2, url: 'url3', title: undefined });
    });

    it('builds reversed display episodes in descending order', () => {
      const episodes = ['url1', 'url2', 'url3'];
      const result = buildDisplayEpisodes(episodes, true);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ originalIndex: 2, url: 'url3', title: undefined });
      expect(result[1]).toEqual({ originalIndex: 1, url: 'url2', title: undefined });
      expect(result[2]).toEqual({ originalIndex: 0, url: 'url1', title: undefined });
    });
  });

  describe('chunkDisplayEpisodes', () => {
    it('chunks display episodes with proper range labels', () => {
      const episodes = ['url1', 'url2', 'url3', 'url4', 'url5'];
      const asc = buildDisplayEpisodes(episodes, false);
      const ascChunks = chunkDisplayEpisodes(asc, 2);

      expect(ascChunks).toHaveLength(3);
      expect(ascChunks[0].label).toBe('1-2');
      expect(ascChunks[1].label).toBe('3-4');
      expect(ascChunks[2].label).toBe('5');

      const desc = buildDisplayEpisodes(episodes, true);
      const descChunks = chunkDisplayEpisodes(desc, 2);

      expect(descChunks).toHaveLength(3);
      expect(descChunks[0].label).toBe('5-4');
      expect(descChunks[1].label).toBe('3-2');
      expect(descChunks[2].label).toBe('1');
    });
  });

  describe('getEpisodeProgressInfo', () => {
    it('returns default unwatched state if record is missing or mismatched', () => {
      expect(getEpisodeProgressInfo(0, null, 'Test')).toEqual({
        isWatched: false,
        isCurrent: false,
        progress: 0,
      });

      expect(
        getEpisodeProgressInfo(
          0,
          { title: 'Other Title', index: 2, play_time: 100, duration: 200 },
          'Test Title'
        )
      ).toEqual({
        isWatched: false,
        isCurrent: false,
        progress: 0,
      });
    });

    it('marks prior episodes as watched', () => {
      const record = {
        title: 'My Video',
        index: 3, // Episode 3 (0-based index 2)
        play_time: 120,
        duration: 1200,
      };

      // Episodes 0 and 1 (1 and 2) are prior episodes
      expect(getEpisodeProgressInfo(0, record, 'My Video')).toEqual({
        isWatched: true,
        isCurrent: false,
        progress: 1,
      });
      expect(getEpisodeProgressInfo(1, record, 'My Video')).toEqual({
        isWatched: true,
        isCurrent: false,
        progress: 1,
      });
    });

    it('marks current episode in progress with correct ratio', () => {
      const record = {
        title: 'My Video',
        index: 3, // Episode 3 (0-based index 2)
        play_time: 600,
        duration: 1200,
      };

      const result = getEpisodeProgressInfo(2, record, 'My Video');
      expect(result.isCurrent).toBe(true);
      expect(result.isWatched).toBe(false);
      expect(result.progress).toBe(0.5);
    });

    it('marks current episode as completed if watched >= 95%', () => {
      const record = {
        title: 'My Video',
        index: 3, // Episode 3 (0-based index 2)
        play_time: 1180,
        duration: 1200,
      };

      const result = getEpisodeProgressInfo(2, record, 'My Video');
      expect(result.isCurrent).toBe(true);
      expect(result.isWatched).toBe(true);
      expect(result.progress).toBe(1);
    });

    it('marks future episodes as unwatched', () => {
      const record = {
        title: 'My Video',
        index: 3, // Episode 3 (0-based index 2)
        play_time: 600,
        duration: 1200,
      };

      expect(getEpisodeProgressInfo(3, record, 'My Video')).toEqual({
        isWatched: false,
        isCurrent: false,
        progress: 0,
      });
    });
  });
});
