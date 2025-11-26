import Logger from '@/utils/Logger';

const logger = Logger.withTag('M3U8');

interface CacheEntry {
  resolution: string | null;
  timestamp: number;
}

const resolutionCache: { [url: string]: CacheEntry } = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const getResolutionFromM3U8 = async (
  url: string,
  signal?: AbortSignal
): Promise<string | null> => {
  const perfStart = performance.now();
  // logger.info(`[PERF] M3U8 resolution detection START - url: ${url.substring(0, 100)}...`);

  // 1. Check cache first
  const cachedEntry = resolutionCache[url];
  if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_DURATION) {
    // const perfEnd = performance.now();
    // logger.info(`[PERF] M3U8 resolution detection CACHED - took ${(perfEnd - perfStart).toFixed(2)}ms, resolution: ${cachedEntry.resolution}`);
    return cachedEntry.resolution;
  }

  // Relaxed check: allow query params or just check for .m3u8 in the string
  if (!url.includes(".m3u8")) {
    // logger.info(`[PERF] M3U8 resolution detection SKIPPED - not M3U8 file`);
    // return null; 
    // Actually, some m3u8 urls might not have the extension visible? 
    // But for now, let's just relax to 'includes' to handle query params.
  }

  try {
    const fetchStart = performance.now();
    const response = await fetch(url, {
      signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      }
    });
    const fetchEnd = performance.now();
    // logger.info(`[PERF] M3U8 fetch took ${(fetchEnd - fetchStart).toFixed(2)}ms, status: ${response.status}`);

    if (!response.ok) {
      return null;
    }

    // Optional: Check Content-Type if strictness is needed, but some servers send wrong types.
    // const contentType = response.headers.get("Content-Type");
    // if (contentType && !contentType.includes("mpegurl") && !contentType.includes("text/")) { ... }

    const parseStart = performance.now();
    const playlist = await response.text();
    const lines = playlist.split("\n");
    let highestResolution = 0;
    let resolutionString: string | null = null;

    for (const line of lines) {
      if (line.startsWith("#EXT-X-STREAM-INF")) {
        const resolutionMatch = line.match(/RESOLUTION=(\d+)x(\d+)/);
        if (resolutionMatch) {
          const height = parseInt(resolutionMatch[2], 10);
          if (height > highestResolution) {
            highestResolution = height;
            resolutionString = `${height}p`;
          }
        }
      }
    }

    if (!resolutionString) {
      // Fallback: Try to guess from URL
      const urlLower = url.toLowerCase();
      if (urlLower.match(/\/4k\/|4k\.|-4k/)) {
        resolutionString = "4K";
      } else if (urlLower.match(/\/1080[pP]\/|1080[pP]\.|-1080[pP]/)) {
        resolutionString = "1080p";
      } else if (urlLower.match(/\/720[pP]\/|720[pP]\.|-720[pP]/)) {
        resolutionString = "720p";
      } else if (urlLower.match(/\/480[pP]\/|480[pP]\.|-480[pP]/)) {
        resolutionString = "480p";
      }
    }

    const parseEnd = performance.now();
    // logger.info(`[PERF] M3U8 parsing took ${(parseEnd - parseStart).toFixed(2)}ms, lines: ${lines.length}`);

    // 2. Store result in cache
    resolutionCache[url] = {
      resolution: resolutionString,
      timestamp: Date.now(),
    };

    const perfEnd = performance.now();
    logger.info(`[PERF] M3U8 resolution detection COMPLETE - took ${(perfEnd - perfStart).toFixed(2)}ms, resolution: ${resolutionString}`);

    return resolutionString;
  } catch (error) {
    const perfEnd = performance.now();
    logger.info(`[PERF] M3U8 resolution detection ERROR - took ${(perfEnd - perfStart).toFixed(2)}ms, error: ${error}`);
    return null;
  }
};
