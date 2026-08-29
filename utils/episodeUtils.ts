export interface Episode {
  title?: string;
  [key: string]: any;
}

export interface EpisodeChunk<T> {
  items: T[];
  label: string;
  index: number;
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
