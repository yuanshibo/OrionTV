export interface Episode {
  title?: string;
  [key: string]: any;
}

export interface EpisodeItem {
  originalIndex: number;
  url: string;
  title?: string;
  [key: string]: any;
}

export interface EpisodeChunk<T> {
  items: T[];
  label: string;
  index: number;
}

export interface EpisodeProgressInfo {
  isWatched: boolean;
  isCurrent: boolean;
  progress?: number;
}

export function chunkEpisodes<T>(episodes: T[], chunkSize: number): EpisodeChunk<T>[] {
  if (!episodes || !Array.isArray(episodes) || episodes.length === 0 || chunkSize <= 0) {
    return [];
  }
  
  const chunks: EpisodeChunk<T>[] = [];
  for (let i = 0; i < episodes.length; i += chunkSize) {
    const start = i + 1;
    const end = Math.min(i + chunkSize, episodes.length);
    chunks.push({
      items: episodes.slice(i, i + chunkSize),
      label: `${start}-${end}`,
      index: Math.floor(i / chunkSize),
    });
  }
  
  return chunks;
}

export function buildDisplayEpisodes(
  episodes: any[],
  isReversed: boolean = false
): EpisodeItem[] {
  if (!episodes || !Array.isArray(episodes)) return [];
  const items: EpisodeItem[] = episodes.map((ep, idx) => ({
    originalIndex: idx,
    url: typeof ep === 'string' ? ep : (ep?.url || ''),
    title: typeof ep === 'object' && ep?.title ? ep.title : undefined,
    ...(typeof ep === 'object' ? ep : {}),
  }));

  if (isReversed) {
    return [...items].reverse();
  }
  return items;
}

export function chunkDisplayEpisodes(
  displayEpisodes: EpisodeItem[],
  chunkSize: number
): EpisodeChunk<EpisodeItem>[] {
  if (!displayEpisodes || displayEpisodes.length === 0 || chunkSize <= 0) {
    return [];
  }
  const chunks: EpisodeChunk<EpisodeItem>[] = [];
  for (let i = 0; i < displayEpisodes.length; i += chunkSize) {
    const chunkItems = displayEpisodes.slice(i, i + chunkSize);
    const first = chunkItems[0].originalIndex + 1;
    const last = chunkItems[chunkItems.length - 1].originalIndex + 1;
    const label = first === last ? `${first}` : `${first}-${last}`;
    chunks.push({
      items: chunkItems,
      label,
      index: Math.floor(i / chunkSize),
    });
  }
  return chunks;
}

export function getEpisodeProgressInfo(
  episodeIndex: number,
  resumeRecord: { title?: string; index?: number; play_time?: number; total_time?: number; duration?: number } | null,
  currentTitle?: string
): EpisodeProgressInfo {
  if (!resumeRecord || typeof resumeRecord.index !== 'number' || resumeRecord.index <= 0) {
    return { isWatched: false, isCurrent: false, progress: 0 };
  }
  if (currentTitle && resumeRecord.title && resumeRecord.title !== currentTitle) {
    return { isWatched: false, isCurrent: false, progress: 0 };
  }

  const watchedIndex = resumeRecord.index - 1; // 0-based
  const playTime = resumeRecord.play_time || 0;
  const duration = resumeRecord.duration || resumeRecord.total_time || 0;
  const progressRatio = duration > 0 ? playTime / duration : 0;

  if (episodeIndex < watchedIndex) {
    return { isWatched: true, isCurrent: false, progress: 1 };
  }

  if (episodeIndex === watchedIndex) {
    if (progressRatio >= 0.95) {
      return { isWatched: true, isCurrent: true, progress: 1 };
    }
    return {
      isWatched: false,
      isCurrent: true,
      progress: Math.max(0, Math.min(1, progressRatio)),
    };
  }

  return { isWatched: false, isCurrent: false, progress: 0 };
}

