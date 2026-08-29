import Logger from '@/utils/Logger';

const logger = Logger.withTag('M3U8');

export interface M3U8ProbeResult {
  available: boolean;
  resolution: string | null;
  error?: string;
}

interface CacheEntry {
  available: boolean;
  resolution: string | null;
  timestamp: number;
}

const probeCache: { [url: string]: CacheEntry } = {};
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
const MAX_CACHE_SIZE = 100;

function setProbeCache(url: string, entry: CacheEntry) {
  probeCache[url] = entry;
  const keys = Object.keys(probeCache);
  if (keys.length > MAX_CACHE_SIZE) {
    let oldest = keys[0];
    for (let i = 1; i < keys.length; i++) {
      if (probeCache[keys[i]].timestamp < probeCache[oldest].timestamp) {
        oldest = keys[i];
      }
    }
    delete probeCache[oldest];
  }
}

export const probeM3U8 = async (
  url: string,
  externalSignal?: AbortSignal,
  timeoutMs = 3500
): Promise<M3U8ProbeResult> => {
  if (!url || typeof url !== 'string') {
    return { available: false, resolution: null, error: 'Empty URL' };
  }

  // 1. Check cache first
  const cached = probeCache[url];
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return {
      available: cached.available,
      resolution: cached.resolution,
    };
  }

  // Set up 3.5s timeout controller with external signal support
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

  let combinedSignal = timeoutController.signal;
  let abortHandler: (() => void) | undefined;

  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timeoutId);
      return { available: false, resolution: null, error: 'Aborted' };
    }
    abortHandler = () => timeoutController.abort();
    externalSignal.addEventListener('abort', abortHandler);
  }

  const perfStart = performance.now();

  try {
    const response = await fetch(url, {
      signal: combinedSignal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: '*/*',
      },
    });

    clearTimeout(timeoutId);
    if (abortHandler && externalSignal) {
      externalSignal.removeEventListener('abort', abortHandler);
    }

    if (!response.ok) {
      const result: M3U8ProbeResult = {
        available: false,
        resolution: null,
        error: `HTTP ${response.status}`,
      };
      setProbeCache(url, { available: false, resolution: null, timestamp: Date.now() });
      return result;
    }

    const playlist = await response.text();
    const lines = playlist.split(/\r?\n/);
    let highestResolution = 0;
    let resolutionString: string | null = null;
    const maxScanLines = Math.min(lines.length, 100);

    for (let i = 0; i < maxScanLines; i++) {
      const line = lines[i];
      if (line.startsWith('#EXT-X-STREAM-INF')) {
        const resolutionMatch = line.match(/RESOLUTION=(\d+)x(\d+)/i);
        if (resolutionMatch) {
          const height = parseInt(resolutionMatch[2], 10);
          if (height > highestResolution) {
            highestResolution = height;
            if (height >= 2160) resolutionString = '4K';
            else if (height >= 1440) resolutionString = '2K';
            else if (height >= 1080) resolutionString = '1080p';
            else if (height >= 720) resolutionString = '720p';
            else if (height >= 540) resolutionString = '540p';
            else if (height >= 480) resolutionString = '480p';
            else resolutionString = `${height}p`;
          }
        }
      }
    }

    if (!resolutionString) {
      // Fallback: Try to guess from playlist content and URL patterns
      const combinedText = (url + ' ' + playlist.slice(0, 500)).toLowerCase();
      if (combinedText.match(/\/4k\/|4k\.|-4k|2160p|2160/i)) {
        resolutionString = '4K';
      } else if (combinedText.match(/\/1080[pP]\/|1080[pP]\.|-1080[pP]|1080p|1080/i)) {
        resolutionString = '1080p';
      } else if (combinedText.match(/\/720[pP]\/|720[pP]\.|-720[pP]|720p|720/i)) {
        resolutionString = '720p';
      } else if (combinedText.match(/\/480[pP]\/|480[pP]\.|-480[pP]|480p|480/i)) {
        resolutionString = '480p';
      }
    }

    const perfEnd = performance.now();
    logger.debug(
      `[PROBE] M3U8 probe success: took ${(perfEnd - perfStart).toFixed(1)}ms, resolution: ${resolutionString || 'unknown'}`
    );

    setProbeCache(url, {
      available: true,
      resolution: resolutionString,
      timestamp: Date.now(),
    });

    return {
      available: true,
      resolution: resolutionString,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (abortHandler && externalSignal) {
      externalSignal.removeEventListener('abort', abortHandler);
    }
    const perfEnd = performance.now();
    const isTimeout = combinedSignal.aborted && !externalSignal?.aborted;
    const errorMsg = isTimeout ? 'Timeout (3.5s)' : error instanceof Error ? error.message : 'Network error';

    logger.debug(`[PROBE] M3U8 probe failed in ${(perfEnd - perfStart).toFixed(1)}ms: ${errorMsg}`);

    const result: M3U8ProbeResult = {
      available: false,
      resolution: null,
      error: errorMsg,
    };

    probeCache[url] = { available: false, resolution: null, timestamp: Date.now() };
    return result;
  }
};

export const getResolutionFromM3U8 = async (
  url: string,
  signal?: AbortSignal
): Promise<string | null> => {
  const result = await probeM3U8(url, signal);
  return result.resolution;
};
