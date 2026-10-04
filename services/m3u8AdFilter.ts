import ReactNativeBlobUtil from 'react-native-blob-util';
import Logger from '@/utils/Logger';
import { getRawM3U8FromCache, setRawM3U8ToCache, clearRawM3U8Cache } from './m3u8';
import { PhysicalAdEngine, parseM3U8BlocksForEngine, reconstructM3U8, resolveAbsoluteUrl } from './m3u8AdEngine';

const logger = Logger.withTag('M3U8AdFilter');

export type AdBlockMode = 'seamless' | 'skip' | 'off';

export interface AdInterval {
  start: number;
  end: number;
  duration: number;
}

export interface AdFilterResult {
  cleanUrl: string;
  adIntervals: AdInterval[];
  totalAdDuration: number;
  isModified: boolean;
}

export interface AdFilterOptions {
  // Legacy options kept for signature compatibility
  adKeywords?: RegExp[];
  adDurations?: number[];
  verifiedAdIndices?: Set<number>;
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

interface CachedFilterResult {
  result: AdFilterResult;
  timestamp: number;
}

const adFilterResultCache = new Map<string, CachedFilterResult>();
const IN_MEMORY_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const inFlightProcessPromiseMap = new Map<string, Promise<AdFilterResult>>();

export async function processM3U8ForPlayback(
  originalUrl: string,
  mode: AdBlockMode = 'seamless',
  options?: AdFilterOptions
): Promise<AdFilterResult> {
  if (!originalUrl || mode === 'off') {
    return { cleanUrl: originalUrl, adIntervals: [], totalAdDuration: 0, isModified: false };
  }

  const isLikelyM3U8 =
    originalUrl.includes('.m3u8') ||
    originalUrl.includes('/hls/') ||
    originalUrl.includes('playlist') ||
    originalUrl.includes('mixed');

  if (!isLikelyM3U8) {
    return { cleanUrl: originalUrl, adIntervals: [], totalAdDuration: 0, isModified: false };
  }

  const cacheKey = `${originalUrl}|${mode}`;
  const inFlight = inFlightProcessPromiseMap.get(cacheKey);
  if (inFlight) {
    logger.debug(`Reusing in-flight ad-filter process for: ${originalUrl}`);
    return inFlight;
  }

  const processPromise = _processM3U8ForPlaybackInternal(originalUrl, mode, cacheKey, options);
  inFlightProcessPromiseMap.set(cacheKey, processPromise);
  try {
    return await processPromise;
  } finally {
    inFlightProcessPromiseMap.delete(cacheKey);
  }
}

async function _processM3U8ForPlaybackInternal(
  originalUrl: string,
  mode: AdBlockMode,
  cacheKey: string,
  options?: AdFilterOptions
): Promise<AdFilterResult> {
  const cacheDir = ReactNativeBlobUtil.fs?.dirs?.CacheDir;
  const deterministicFilename = `adfree_${hashString(originalUrl)}.m3u8`;
  const deterministicFilePath = cacheDir ? `${cacheDir}/${deterministicFilename}` : null;
  const deterministicFileUri = deterministicFilePath ? `file://${deterministicFilePath}` : null;

  const cached = adFilterResultCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < IN_MEMORY_CACHE_TTL_MS) {
    if (cached.result.cleanUrl.startsWith('file://')) {
      const filePath = cached.result.cleanUrl.replace(/^file:\/\//, '');
      try {
        const exists = await ReactNativeBlobUtil.fs.exists(filePath);
        if (exists) {
          logger.debug(`Using in-memory cached ad-filter result for: ${originalUrl}`);
          return cached.result;
        }
      } catch {}
    } else {
      logger.debug(`Using in-memory cached ad-filter result for: ${originalUrl}`);
      return cached.result;
    }
  }

  if (deterministicFilePath && mode === 'seamless') {
    try {
      const exists = await ReactNativeBlobUtil.fs.exists(deterministicFilePath);
      if (exists) {
        logger.debug(`Hit deterministic disk cache for: ${originalUrl}`);
        const diskResult: AdFilterResult = {
          cleanUrl: deterministicFileUri!,
          adIntervals: [],
          totalAdDuration: 0,
          isModified: true,
        };
        adFilterResultCache.set(cacheKey, { result: diskResult, timestamp: Date.now() });
        return diskResult;
      }
    } catch (e) {}
  }

  let m3u8Text: string;
  let finalUrl = originalUrl;

  const cachedRaw = getRawM3U8FromCache(originalUrl);
  if (cachedRaw) {
    logger.debug(`Hit raw M3U8 cache for: ${originalUrl}`);
    m3u8Text = cachedRaw.text;
    finalUrl = cachedRaw.finalUrl;
  } else {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const response = await fetch(originalUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: '*/*',
        },
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        logger.debug(`Failed to fetch M3U8 for ad filtering: HTTP ${response.status}`);
        return { cleanUrl: originalUrl, adIntervals: [], totalAdDuration: 0, isModified: false };
      }
      m3u8Text = await response.text();
      finalUrl = response.url || originalUrl;
      setRawM3U8ToCache(originalUrl, m3u8Text, finalUrl);
    } catch (err) {
      logger.debug(`Network error fetching M3U8: ${err}`);
      return { cleanUrl: originalUrl, adIntervals: [], totalAdDuration: 0, isModified: false };
    }
  }

  if (m3u8Text.includes('#EXT-X-STREAM-INF')) {
    const lines = m3u8Text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
        const nextLine = lines[i + 1]?.trim();
        if (nextLine && !nextLine.startsWith('#')) {
          const variantUrl = resolveAbsoluteUrl(nextLine, finalUrl);
          logger.debug(`Found variant playlist, delegating to: ${variantUrl}`);
          return processM3U8ForPlayback(variantUrl, mode, options);
        }
      }
    }
  }

  const lastSlashIdx = finalUrl.lastIndexOf('/');
  const baseUrl = lastSlashIdx > 0 ? finalUrl.slice(0, lastSlashIdx + 1) : finalUrl + '/';

  const { blocks, headerLines } = parseM3U8BlocksForEngine(m3u8Text);
  const engine = new PhysicalAdEngine(blocks, baseUrl);
  const ads = await engine.detectAds();

  if (ads.size === 0) {
    logger.debug('No ads detected in M3U8 stream (Physical Engine)');
    const unmodifiedResult: AdFilterResult = {
      cleanUrl: originalUrl,
      adIntervals: [],
      totalAdDuration: 0,
      isModified: false,
    };
    adFilterResultCache.set(cacheKey, { result: unmodifiedResult, timestamp: Date.now() });
    return unmodifiedResult;
  }

  const sortedAds = Array.from(ads).sort((a, b) => a - b);
  const adIntervals: AdInterval[] = [];
  let totalAdDuration = 0;
  
  let currentStart: number | null = null;
  let currentDur = 0;
  let runningTime = 0;
  
  for (let idx = 0; idx < blocks.length; idx++) {
    const b = blocks[idx];
    const blockStart = runningTime;
    runningTime += b.duration;
    
    if (ads.has(idx)) {
      if (currentStart === null) {
        currentStart = blockStart;
        currentDur = b.duration;
      } else {
        currentDur += b.duration;
      }
      totalAdDuration += b.duration;
    } else {
      if (currentStart !== null) {
        adIntervals.push({ start: currentStart, end: currentStart + currentDur, duration: currentDur });
        currentStart = null;
        currentDur = 0;
      }
    }
  }
  if (currentStart !== null) {
    adIntervals.push({ start: currentStart, end: currentStart + currentDur, duration: currentDur });
  }

  logger.info(`Detected ${adIntervals.length} ad intervals (total ${totalAdDuration.toFixed(1)}s) using Physical Engine`);

  if (mode === 'skip') {
    const skipResult: AdFilterResult = {
      cleanUrl: originalUrl,
      adIntervals,
      totalAdDuration,
      isModified: true,
    };
    adFilterResultCache.set(cacheKey, { result: skipResult, timestamp: Date.now() });
    return skipResult;
  }

  const originalHasEndlist = m3u8Text.includes('#EXT-X-ENDLIST');
  const rewrittenContent = reconstructM3U8(blocks, headerLines, ads, baseUrl, originalHasEndlist);

  let cleanUrl = originalUrl;
  if (deterministicFilePath) {
    try {
      await ReactNativeBlobUtil.fs.writeFile(deterministicFilePath, rewrittenContent, 'utf8');
      cleanUrl = deterministicFileUri!;
      logger.info(`Cleaned M3U8 written to local file: ${cleanUrl}`);
    } catch (err) {
      logger.warn(`Failed to write cleaned M3U8 to cache: ${err}`);
      // Fallback to data URI if disk write fails
      cleanUrl = `data:application/vnd.apple.mpegurl;base64,${ReactNativeBlobUtil.base64.encode(rewrittenContent)}`;
    }
  } else {
    // If we can't access disk cache dir, use data URI
    cleanUrl = `data:application/vnd.apple.mpegurl;base64,${ReactNativeBlobUtil.base64.encode(rewrittenContent)}`;
  }

  const finalResult: AdFilterResult = {
    cleanUrl,
    adIntervals,
    totalAdDuration,
    isModified: true,
  };
  adFilterResultCache.set(cacheKey, { result: finalResult, timestamp: Date.now() });
  return finalResult;
}

export interface M3U8CacheCleanupOptions {
  maxAgeMs?: number;
  activeUrl?: string;
}
export async function cleanupM3U8Cache(options: M3U8CacheCleanupOptions = {}): Promise<void> {
  const { maxAgeMs = 12 * 60 * 60 * 1000, activeUrl } = options;
  const activeFilename = activeUrl ? `adfree_${hashString(activeUrl)}.m3u8` : null;
  try {
    const cacheDir = ReactNativeBlobUtil.fs?.dirs?.CacheDir;
    if (!cacheDir) return;
    const exists = await ReactNativeBlobUtil.fs.exists(cacheDir);
    if (!exists) return;
    const files = await ReactNativeBlobUtil.fs.ls(cacheDir);
    const now = Date.now();
    let cleanedCount = 0;
    for (const file of files) {
      if (file.startsWith('adfree_') && file.endsWith('.m3u8')) {
        if (activeFilename && file === activeFilename) {
          continue;
        }
        const filePath = `${cacheDir}/${file}`;
        const stat = await ReactNativeBlobUtil.fs.stat(filePath);
        if (now - stat.lastModified > maxAgeMs) {
          await ReactNativeBlobUtil.fs.unlink(filePath);
          cleanedCount++;
        }
      }
    }
    if (cleanedCount > 0) logger.debug(`Cleaned ${cleanedCount} expired adfree m3u8 files from disk cache`);
  } catch (error) {
    logger.warn(`Failed to cleanup m3u8 cache: ${error}`);
  }
}
export async function cleanOldAdfreeFiles(): Promise<void> {
  await cleanupM3U8Cache();
}
export function clearAdFilterCache(): void {
  adFilterResultCache.clear();
  clearRawM3U8Cache();
}
