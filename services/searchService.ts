import { contentApi, SearchResult } from './api';
import { cacheService } from './cacheService';

const groupSearchResults = (items: SearchResult[]): SearchResult[] => {
  const seen = new Map<string, SearchResult>();

  items.forEach((item) => {
    const normalizedTitle = item.title.trim().toLowerCase();
    const normalizedYear = (item.year || "").trim();
    const key = `${normalizedTitle}::${normalizedYear}`;

    if (!seen.has(key)) {
      seen.set(key, item);
    }
  });

  return Array.from(seen.values());
};

/**
 * Fetches and groups search results, utilizing a 10-minute cache.
 * @param term The search term.
 * @returns A promise that resolves to an array of grouped search results.
 */
export const fetchSearchResults = async (term: string): Promise<SearchResult[]> => {
  const cachedResults = cacheService.get<SearchResult[]>(term);
  if (cachedResults) {
    return cachedResults;
  }

  const response = await contentApi.searchVideos(term);
  const groupedResults = groupSearchResults(response.results);
  
  if (groupedResults.length > 0) {
      cacheService.set(term, groupedResults);
  }

  return groupedResults;
};
