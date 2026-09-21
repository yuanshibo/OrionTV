import ReactNativeBlobUtil from 'react-native-blob-util';
import Logger from '@/utils/Logger';

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
  /** Regular expressions for matching ad slice URLs or paths */
  adKeywords?: RegExp[];
  /** Common standard ad durations in seconds */
  adDurations?: number[];
}

const DEFAULT_AD_KEYWORDS = [
  /guanggao/i,
  /\/ad\//i,
  /\/adv\//i,
  /adv\./i,
  /advert/i,
  /\/dsp\//i,
  /\/union\//i,
  /\/pop\//i,
  /\/gg\//i,
  /tuiguang/i,
];

const DEFAULT_AD_DURATIONS = [5, 6, 8, 9, 10, 12, 15, 16, 17, 18, 19, 20, 21, 22, 25, 30, 45, 60, 75, 90];

/**
 * Resolves a relative URL against a base URL into an absolute URL
 */
export function resolveAbsoluteUrl(relativeUrl: string, baseUrl: string): string {
  const trimmed = relativeUrl.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    if (baseUrl.endsWith('/')) {
      return baseUrl + trimmed;
    }
    const lastSlash = baseUrl.lastIndexOf('/');
    return (lastSlash > 0 ? baseUrl.slice(0, lastSlash + 1) : baseUrl + '/') + trimmed;
  }
}

/**
 * Rewrites URI attributes in tags like #EXT-X-KEY or #EXT-X-MAP to absolute URLs
 */
export function rewriteTagUri(line: string, baseUrl: string): string {
  const uriMatch = line.match(/URI="([^"]+)"/i);
  if (uriMatch) {
    const originalUri = uriMatch[1];
    const absoluteUri = resolveAbsoluteUrl(originalUri, baseUrl);
    return line.replace(uriMatch[0], `URI="${absoluteUri}"`);
  }
  return line;
}

interface BlockData {
  lines: string[];
  durs: number[];
  duration: number;
  hasKeyword: boolean;
  urls: string[];
}

/**
 * Pure function: Filters M3U8 content by identifying ad blocks,
 * removing them, and rewriting relative segment/key URLs to absolute URLs.
 */
export function filterM3U8Content(
  m3u8Content: string,
  baseUrl: string,
  options: AdFilterOptions = {}
): {
  content: string;
  adIntervals: AdInterval[];
  totalAdDuration: number;
  isModified: boolean;
} {
  if (!m3u8Content || typeof m3u8Content !== 'string') {
    return { content: '', adIntervals: [], totalAdDuration: 0, isModified: false };
  }

  const adKeywords = options.adKeywords || DEFAULT_AD_KEYWORDS;
  const standardAdDurs = options.adDurations || DEFAULT_AD_DURATIONS;

  const lines = m3u8Content.split(/\r?\n/);

  // 1. Calculate dominant slice duration across the entire playlist
  const durCounts: Record<string, number> = {};
  let totalSliceCount = 0;

  for (const line of lines) {
    if (line.startsWith('#EXTINF:')) {
      const match = line.match(/#EXTINF:([0-9.]+)/);
      if (match) {
        const d = parseFloat(match[1]).toFixed(2);
        durCounts[d] = (durCounts[d] || 0) + 1;
        totalSliceCount++;
      }
    }
  }

  let dominantDur: number | null = null;
  let maxCount = 0;
  for (const [dStr, count] of Object.entries(durCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantDur = parseFloat(dStr);
    }
  }
  const dominantFreq = dominantDur !== null && totalSliceCount > 0 ? maxCount / totalSliceCount : 0;

  // 2. Parse into blocks separated by #EXT-X-DISCONTINUITY
  const blocks: BlockData[] = [];
  let curBlock: BlockData = { lines: [], durs: [], duration: 0, hasKeyword: false, urls: [] };
  const headerLines: string[] = [];
  let inHeader = true;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line && i === lines.length - 1) continue;

    if (inHeader) {
      if (line.startsWith('#EXTINF:') || line.startsWith('#EXT-X-DISCONTINUITY')) {
        inHeader = false;
      } else {
        headerLines.push(raw);
        continue;
      }
    }

    if (line.startsWith('#EXT-X-DISCONTINUITY')) {
      if (curBlock.durs.length > 0) {
        blocks.push(curBlock);
      }
      curBlock = { lines: [], durs: [], duration: 0, hasKeyword: false, urls: [] };
      continue;
    }

    if (line.startsWith('#EXTINF:')) {
      const match = line.match(/#EXTINF:([0-9.]+)/);
      if (match) {
        const d = parseFloat(match[1]);
        curBlock.duration += d;
        curBlock.durs.push(d);
      }
    } else if (line && !line.startsWith('#')) {
      curBlock.urls.push(line);
      if (adKeywords.some((rx) => rx.test(line))) {
        curBlock.hasKeyword = true;
      }
    }

    curBlock.lines.push(raw);
  }

  if (curBlock.durs.length > 0) {
    blocks.push(curBlock);
  }

  // 3. Detect which blocks are ads
  const totalPlaylistDuration = blocks.reduce((sum, b) => sum + b.duration, 0);
  const avgBlockDuration = blocks.length > 0 ? totalPlaylistDuration / blocks.length : 0;
  // Sparse discontinuity streams have long blocks or few blocks, where discontinuities bracket commercial ads
  const isSparseDiscontinuity = avgBlockDuration >= 60 || (blocks.length <= 15 && totalPlaylistDuration > 90);

  const isAdBlock: boolean[] = new Array(blocks.length).fill(false);

  // 3.1 Initial pass: keyword matching & long block elimination
  for (let idx = 0; idx < blocks.length; idx++) {
    const b = blocks[idx];
    if (b.duration > 90) {
      continue;
    }
    if (b.hasKeyword) {
      isAdBlock[idx] = true;
    }
  }

  // 3.2 Detection based on stream discontinuity sparsity
  if (isSparseDiscontinuity && blocks.length > 1) {
    // In sparse discontinuity streams, discontinuities are inserted almost exclusively for commercial breaks.
    // Identify contiguous runs of short blocks (<= 50s each) flanked by long content (> 50s or stream boundaries).
    let runStart: number | null = null;
    let runDur = 0;

    for (let idx = 0; idx < blocks.length; idx++) {
      const b = blocks[idx];
      if (b.duration <= 50) {
        if (runStart === null) {
          runStart = idx;
          runDur = b.duration;
        } else {
          runDur += b.duration;
        }
      } else {
        if (runStart !== null) {
          const prevLong = runStart === 0 || blocks[runStart - 1].duration > 50;
          const nextLong = blocks[idx].duration > 50;
          if (runDur <= 90 && (prevLong || nextLong)) {
            for (let k = runStart; k < idx; k++) {
              isAdBlock[k] = true;
            }
          }
          runStart = null;
          runDur = 0;
        }
      }
    }

    if (runStart !== null) {
      const prevLong = runStart === 0 || blocks[runStart - 1].duration > 50;
      if (runDur <= 90 && prevLong) {
        for (let k = runStart; k < blocks.length; k++) {
          isAdBlock[k] = true;
        }
      }
    }

    // Individual short block inspection (e.g. matching standard commercial duration or low dominant ratio)
    for (let idx = 0; idx < blocks.length; idx++) {
      const b = blocks[idx];
      if (!isAdBlock[idx] && b.duration <= 45) {
        const matchesStandardDur = standardAdDurs.some((d) => Math.abs(b.duration - d) <= 1.5);
        const matchDominantCount =
          dominantDur !== null ? b.durs.filter((d) => Math.abs(d - dominantDur!) < 0.05).length : 0;
        const dominantRatio = b.durs.length > 0 ? matchDominantCount / b.durs.length : 0;

        if (matchesStandardDur || dominantRatio <= 0.25 || b.durs.length <= 4) {
          isAdBlock[idx] = true;
        }
      }
    }
  } else {
    // 3.3 Dense discontinuity streams (e.g. dytt where discontinuity occurs every ~20s)
    for (let idx = 0; idx < blocks.length; idx++) {
      if (isAdBlock[idx]) continue;
      const b = blocks[idx];
      if (b.duration > 90) continue;

      if (dominantFreq >= 0.25 && dominantDur !== null) {
        const matchDominantCount = b.durs.filter((d) => Math.abs(d - dominantDur!) < 0.05).length;
        const dominantRatio = b.durs.length > 0 ? matchDominantCount / b.durs.length : 0;
        const matchesStandardDur = standardAdDurs.some((d) => Math.abs(b.duration - d) <= 1.5);

        // In dense streams, require dominantRatio === 0 with short slice count (<= 3 or <= 4 with standard dur),
        // OR an exact integer standard commercial ad duration (e.g. 22.000s, 19.000s, 15.000s) with dominantRatio <= 0.35,
        // OR a boundary ad (pre-roll or post-roll) with short slice count (<= 3), matching standard ad duration, and dominantRatio <= 0.35
        if (dominantRatio === 0 && (b.durs.length <= 3 || (matchesStandardDur && b.durs.length <= 4))) {
          isAdBlock[idx] = true;
        } else if (
          standardAdDurs.some((d) => Math.abs(b.duration - d) < 0.01) &&
          dominantRatio <= 0.35 &&
          b.duration <= 35
        ) {
          isAdBlock[idx] = true;
        } else if (
          (idx === 0 || idx === blocks.length - 1) &&
          b.durs.length <= 3 &&
          matchesStandardDur &&
          dominantRatio <= 0.35
        ) {
          isAdBlock[idx] = true;
        }
      } else if (b.duration > 0 && b.duration <= 35) {
        const matchesStandardDur = standardAdDurs.some((d) => Math.abs(b.duration - d) <= 1.0);
        if (matchesStandardDur && b.durs.length <= 3) {
          isAdBlock[idx] = true;
        }
      }
    }
  }

  // Safeguard: Never drop all blocks in a valid stream
  const keptCount = isAdBlock.filter((x) => !x).length;
  if (keptCount === 0 && blocks.length > 0) {
    isAdBlock.fill(false);
  }

  // Compute adIntervals from isAdBlock
  let totalTime = 0;
  const adIntervals: AdInterval[] = [];
  let currentAdStart: number | null = null;
  let currentAdDur = 0;

  for (let idx = 0; idx < blocks.length; idx++) {
    const b = blocks[idx];
    const blockStart = totalTime;
    totalTime += b.duration;

    if (isAdBlock[idx]) {
      if (currentAdStart === null) {
        currentAdStart = blockStart;
        currentAdDur = b.duration;
      } else {
        currentAdDur += b.duration;
      }
    } else {
      if (currentAdStart !== null) {
        adIntervals.push({
          start: currentAdStart,
          end: currentAdStart + currentAdDur,
          duration: currentAdDur,
        });
        currentAdStart = null;
        currentAdDur = 0;
      }
    }
  }

  if (currentAdStart !== null) {
    adIntervals.push({
      start: currentAdStart,
      end: currentAdStart + currentAdDur,
      duration: currentAdDur,
    });
  }

  const isModified = adIntervals.length > 0;
  const totalAdDuration = adIntervals.reduce((sum, item) => sum + item.duration, 0);

  // 4. Reconstruct clean M3U8 content
  const outputLines: string[] = [];

  for (const hLine of headerLines) {
    let rewritten = hLine;
    if (rewritten.startsWith('#EXT-X-KEY:') || rewritten.startsWith('#EXT-X-MAP:')) {
      rewritten = rewriteTagUri(rewritten, baseUrl);
    }
    outputLines.push(rewritten);
  }

  let keptBlockCount = 0;
  for (let idx = 0; idx < blocks.length; idx++) {
    if (isAdBlock[idx]) {
      continue;
    }

    if (keptBlockCount > 0) {
      outputLines.push('#EXT-X-DISCONTINUITY');
    }
    keptBlockCount++;

    for (const rawLine of blocks[idx].lines) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('#EXT-X-KEY:') || trimmed.startsWith('#EXT-X-MAP:')) {
        outputLines.push(rewriteTagUri(trimmed, baseUrl));
      } else if (trimmed.startsWith('#')) {
        outputLines.push(trimmed);
      } else {
        // Rewrite TS segment to absolute URL
        outputLines.push(resolveAbsoluteUrl(trimmed, baseUrl));
      }
    }
  }

  // Preserve #EXT-X-ENDLIST if present in original
  if (m3u8Content.includes('#EXT-X-ENDLIST') && !outputLines[outputLines.length - 1]?.includes('#EXT-X-ENDLIST')) {
    outputLines.push('#EXT-X-ENDLIST');
  }

  return {
    content: outputLines.join('\n'),
    adIntervals,
    totalAdDuration,
    isModified,
  };
}

/**
 * Cache management: removes old temporary M3U8 files, keeping at most 5 files.
 */
export async function cleanOldAdfreeFiles(): Promise<void> {
  try {
    const cacheDir = ReactNativeBlobUtil.fs?.dirs?.CacheDir;
    if (!cacheDir) return;

    const files = await ReactNativeBlobUtil.fs.ls(cacheDir);
    const adfreeFiles = files.filter((f) => f.startsWith('adfree_') && f.endsWith('.m3u8'));

    if (adfreeFiles.length > 5) {
      // Sort and remove older files
      const toDelete = adfreeFiles.slice(0, adfreeFiles.length - 5);
      for (const file of toDelete) {
        try {
          await ReactNativeBlobUtil.fs.unlink(`${cacheDir}/${file}`);
        } catch (e) {
          logger.debug('Failed to delete old adfree file:', e);
        }
      }
    }
  } catch (error) {
    logger.debug('cleanOldAdfreeFiles error:', error);
  }
}

/**
 * Simple hash helper for filenames
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Main entrance: processes an M3U8 URL according to the specified AdBlockMode.
 */
export async function processM3U8ForPlayback(
  originalUrl: string,
  mode: AdBlockMode = 'seamless',
  options?: AdFilterOptions
): Promise<AdFilterResult> {
  if (!originalUrl || mode === 'off') {
    return { cleanUrl: originalUrl, adIntervals: [], totalAdDuration: 0, isModified: false };
  }

  // Only process HTTP/HTTPS URLs likely to be M3U8 streams
  const isLikelyM3U8 =
    originalUrl.includes('.m3u8') ||
    originalUrl.includes('/hls/') ||
    originalUrl.includes('playlist') ||
    originalUrl.includes('mixed');

  if (!isLikelyM3U8) {
    return { cleanUrl: originalUrl, adIntervals: [], totalAdDuration: 0, isModified: false };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

    const response = await fetch(originalUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: '*/*',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.debug(`Failed to fetch M3U8 for ad filtering: HTTP ${response.status}`);
      return { cleanUrl: originalUrl, adIntervals: [], totalAdDuration: 0, isModified: false };
    }

    const m3u8Text = await response.text();
    const finalUrl = response.url || originalUrl;

    // Check if this is a Master Playlist (#EXT-X-STREAM-INF)
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

    // Determine baseUrl for resolving relative slice URLs
    const lastSlashIdx = finalUrl.lastIndexOf('/');
    const baseUrl = lastSlashIdx > 0 ? finalUrl.slice(0, lastSlashIdx + 1) : finalUrl + '/';

    const filterResult = filterM3U8Content(m3u8Text, baseUrl, options);

    if (!filterResult.isModified) {
      logger.debug('No ads detected in M3U8 stream');
      return { cleanUrl: originalUrl, adIntervals: [], totalAdDuration: 0, isModified: false };
    }

    logger.info(
      `Detected ${filterResult.adIntervals.length} ad intervals (total ${filterResult.totalAdDuration.toFixed(
        1
      )}s) in stream`
    );

    // If mode is 'skip', do not write file, return originalUrl with adIntervals
    if (mode === 'skip') {
      return {
        cleanUrl: originalUrl,
        adIntervals: filterResult.adIntervals,
        totalAdDuration: filterResult.totalAdDuration,
        isModified: true,
      };
    }

    // Mode is 'seamless': save clean M3U8 to local cache file
    try {
      const cacheDir = ReactNativeBlobUtil.fs?.dirs?.CacheDir;
      if (!cacheDir) {
        logger.warn('Cache directory not available, falling back to skip mode');
        return {
          cleanUrl: originalUrl,
          adIntervals: filterResult.adIntervals,
          totalAdDuration: filterResult.totalAdDuration,
          isModified: true,
        };
      }

      await cleanOldAdfreeFiles();

      const filename = `adfree_${hashString(finalUrl)}_${Date.now()}.m3u8`;
      const filePath = `${cacheDir}/${filename}`;

      await ReactNativeBlobUtil.fs.writeFile(filePath, filterResult.content, 'utf8');

      const localFileUri = `file://${filePath}`;
      logger.info(`Cleaned M3U8 written to local file: ${localFileUri}`);

      return {
        cleanUrl: localFileUri,
        // When using a clean local file, the ads are already physically stripped.
        // adIntervals is set to empty so the player does NOT seek or show skip toasts.
        adIntervals: [],
        totalAdDuration: filterResult.totalAdDuration,
        isModified: true,
      };
    } catch (fsErr) {
      logger.warn('Failed to write local M3U8 file, falling back to skip mode:', fsErr);
      return {
        cleanUrl: originalUrl,
        adIntervals: filterResult.adIntervals,
        totalAdDuration: filterResult.totalAdDuration,
        isModified: true,
      };
    }
  } catch (error) {
    logger.warn('processM3U8ForPlayback failed, playing original stream:', error);
    return { cleanUrl: originalUrl, adIntervals: [], totalAdDuration: 0, isModified: false };
  }
}
