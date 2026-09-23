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

export interface AdCandidateBlock {
  idx: number;
  duration: number;
  prevUrl: string;
  curUrl: string;
  nextUrl: string;
  prevDur: number;
}

export interface FilterM3U8Result {
  content: string;
  adIntervals: AdInterval[];
  totalAdDuration: number;
  isModified: boolean;
  candidates?: AdCandidateBlock[];
}

export interface AdFilterOptions {
  /** Regular expressions for matching ad slice URLs or paths */
  adKeywords?: RegExp[];
  /** Common standard ad durations in seconds */
  adDurations?: number[];
  /** Set of block indices explicitly verified as ads (e.g. via PTS probing) */
  verifiedAdIndices?: Set<number>;
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

/**
 * Fast zero-dependency MPEG-TS PES PTS parser using standard Uint8Array.
 * Parses PAT (PID 0) -> PMT -> Video elementary PID -> first PES PTS timestamp.
 * Returns PTS timestamp in seconds, or null if not found.
 */
export function parsePTSFromUint8Array(u8: Uint8Array): number | null {
  if (!u8 || u8.length < 188) return null;
  let pmtPid: number | null = null;
  let videoPid: number | null = null;

  for (let offset = 0; offset + 188 <= u8.length; offset += 188) {
    if (u8[offset] !== 0x47) continue;
    const pusi = (u8[offset + 1] & 0x40) !== 0;
    const pid = ((u8[offset + 1] & 0x1f) << 8) | u8[offset + 2];
    const afc = (u8[offset + 3] >> 4) & 0x03;
    let pStart = offset + 4;
    if (afc === 2 || afc === 3) pStart += 1 + u8[pStart];
    if (pStart >= offset + 188) continue;

    // PAT (Program Association Table)
    if (pid === 0 && pusi) {
      const p = u8[pStart];
      if (pStart + 1 + p + 11 >= offset + 188) continue;
      pmtPid = ((u8[pStart + 1 + p + 10] & 0x1f) << 8) | u8[pStart + 1 + p + 11];
    } else if (pid === pmtPid && pusi) {
      // PMT (Program Map Table)
      const p = u8[pStart];
      const tableStart = pStart + 1 + p;
      if (tableStart + 11 >= offset + 188) continue;
      const progInfoLength = ((u8[tableStart + 10] & 0x0f) << 8) | u8[tableStart + 11];
      let esStart = tableStart + 12 + progInfoLength;
      while (esStart + 5 <= offset + 188) {
        const streamType = u8[esStart];
        if (streamType === 0x1b || streamType === 0x24) {
          // H.264 or H.265 video elementary stream
          videoPid = ((u8[esStart + 1] & 0x1f) << 8) | u8[esStart + 2];
          break;
        }
        esStart += 5 + (((u8[esStart + 3] & 0x0f) << 8) | u8[esStart + 4]);
      }
    } else if (pid === videoPid && pusi && u8[pStart] === 0 && u8[pStart + 1] === 0 && u8[pStart + 2] === 1) {
      // Video PES Header
      if (pStart + 14 > offset + 188 || pStart + 14 > u8.length) continue;
      const flags2 = u8[pStart + 7];
      if (((flags2 >> 6) & 0x03) >= 2) {
        const b = u8.subarray(pStart + 9, pStart + 14);
        const ptsTicks =
          (b[0] & 0x0e) * 536870912 +
          (b[1] << 22) +
          ((b[2] & 0xfe) << 14) +
          (b[3] << 7) +
          ((b[4] & 0xfe) >> 1);
        return ptsTicks / 90000;
      }
    }
  }
  return null;
}

export interface StreamBlock {
  lines: string[];
  durs: number[];
  duration: number;
  hasKeyword: boolean;
  urls: string[];
  /** Cumulative playlist time offset at the start of this block (seconds) */
  start?: number;
}

export interface StreamStats {
  totalDuration: number;
  blockCount: number;
  avgBlockDuration: number;
  isSparseDiscontinuity: boolean;
  dominantDur: number | null;
  dominantFreq: number;
  totalSliceCount: number;
}

export interface BlockScoreResult {
  score: number;
  reasons: string[];
}

/**
 * Computes stream-level statistics such as dominant slice duration,
 * slice frequency, and discontinuity sparsity.
 */
export function calculateStreamStats(
  blocks: StreamBlock[],
  durCounts: Record<string, number>,
  totalSliceCount: number
): StreamStats {
  let dominantDur: number | null = null;
  let maxCount = 0;
  for (const [dStr, count] of Object.entries(durCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantDur = parseFloat(dStr);
    }
  }
  const dominantFreq = dominantDur !== null && totalSliceCount > 0 ? maxCount / totalSliceCount : 0;
  const totalDuration = blocks.reduce((sum, b) => sum + b.duration, 0);
  const avgBlockDuration = blocks.length > 0 ? totalDuration / blocks.length : 0;
  const isSparseDiscontinuity = avgBlockDuration >= 60 || (blocks.length <= 15 && totalDuration > 90);

  return {
    totalDuration,
    blockCount: blocks.length,
    avgBlockDuration,
    isSparseDiscontinuity,
    dominantDur,
    dominantFreq,
    totalSliceCount,
  };
}

/**
 * Multi-dimensional anomaly scoring engine: Evaluates a candidate block
 * across commercial duration matching, GOP/slice deviation, remainder slice detection,
 * and topological context.
 *
 * Returns a score between 0 and 100. Scores >= 70 indicate high-confidence commercial ads.
 */
export function calculateBlockAdScore(
  b: StreamBlock,
  idx: number,
  blocks: StreamBlock[],
  stats: StreamStats,
  standardAdDurs: number[] = DEFAULT_AD_DURATIONS,
  isPartOfAdPod = false
): BlockScoreResult {
  const reasons: string[] = [];
  if (b.duration > 90) {
    return { score: 0, reasons: ['exceeds_max_ad_duration_90s'] };
  }

  if (b.hasKeyword) {
    return { score: 100, reasons: ['keyword_match'] };
  }

  if (isPartOfAdPod) {
    return { score: 95, reasons: ['ad_pod_sparse_sequence'] };
  }

  let score = 0;
  const isBoundary = idx === 0 || idx === blocks.length - 1;
  const matchesStandardDur = standardAdDurs.some((d) => Math.abs(b.duration - d) <= 1.5);
  const isExactIntegerDur = standardAdDurs.some((d) => Math.abs(b.duration - d) < 0.01);

  const matchDominantCount =
    stats.dominantDur !== null ? b.durs.filter((d) => Math.abs(d - stats.dominantDur!) < 0.05).length : 0;
  const dominantRatio = b.durs.length > 0 ? matchDominantCount / b.durs.length : 0;

  if (stats.isSparseDiscontinuity) {
    // Sparse Discontinuity Streams (e.g. phimgood, yzzy, ffzy):
    // Discontinuities are inserted almost exclusively around commercial ad pods.
    if (b.duration <= 45) {
      if (matchesStandardDur) {
        score += 50;
        reasons.push('matches_standard_ad_dur');
      }
      if (dominantRatio <= 0.25) {
        score += 40;
        reasons.push('low_dominant_ratio');
      }
      if (b.durs.length <= 4) {
        score += 30;
        reasons.push('short_slice_count');
      }
    }
  } else {
    // Dense Discontinuity Streams (e.g. dytt, ryplay7, zuidazym3u8):
    // Discontinuities appear frequently even in normal movie content.
    // Feature A: Zero dominant ratio with short slice count (<= 3 slices, or <= 4 slices with standard dur)
    if (dominantRatio === 0) {
      if (b.durs.length <= 3) {
        score += 80;
        reasons.push('zero_dominant_short_slice_3');
      } else if (b.durs.length <= 4 && matchesStandardDur) {
        score += 80;
        reasons.push('zero_dominant_short_slice_4_standard_dur');
      }
    }

    // Feature B: Exact integer standard commercial ad duration with low dominant ratio (e.g. Sample 5 at 9m38s)
    if (isExactIntegerDur && dominantRatio <= 0.35 && b.duration <= 35) {
      score += 85;
      reasons.push('exact_integer_commercial_dur_low_dominant');
    }

    // Feature C: Boundary short commercial ad (e.g. Sample 5 post-roll at 24m19s)
    if (isBoundary && b.durs.length <= 3 && matchesStandardDur && dominantRatio <= 0.35) {
      score += 85;
      reasons.push('boundary_short_commercial_ad');
    }

    // Feature D: High-uniformity stream with remainder slice (e.g. Sample 6 at 12m32s)
    if (
      stats.dominantFreq >= 0.70 &&
      idx > 0 &&
      idx < blocks.length - 1 &&
      b.duration <= 60 &&
      matchesStandardDur &&
      matchDominantCount < b.durs.length
    ) {
      score += 85;
      reasons.push('uniform_stream_remainder_slice_ad');
    }

    // Feature E: Ultra-uniform stream (>= 0.95) with an anomalous remainder slice.
    // In heavily stitched streams, the movie is perfectly sliced (e.g. exactly 2.0s),
    // but the inserted ad's total duration is not a multiple, leaving a fractional slice (e.g. 38.8s).
    if (
      stats.dominantFreq >= 0.95 &&
      idx > 0 &&
      idx < blocks.length - 1 &&
      b.duration <= 90 &&
      matchDominantCount < b.durs.length
    ) {
      score += 90;
      reasons.push('ultra_uniform_anomalous_remainder_slice');
    }
  }

  return { score: Math.min(100, score), reasons };
}

export function parseM3U8Blocks(m3u8Text: string): StreamBlock[] {
  const lines = m3u8Text.split(/\r?\n/);
  const blocks: StreamBlock[] = [];
  let curBlock: StreamBlock = { lines: [], durs: [], duration: 0, hasKeyword: false, urls: [] };
  let totalTime = 0;
  let inHeader = true;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    // Skip header lines before any content block (same logic as filterM3U8Content)
    if (inHeader) {
      if (line.startsWith('#EXTINF:') || line.startsWith('#EXT-X-DISCONTINUITY')) {
        inHeader = false;
      } else {
        continue;
      }
    }

    if (line.startsWith('#EXT-X-DISCONTINUITY')) {
      // Use durs.length > 0 (same guard as filterM3U8Content) to keep indices aligned
      if (curBlock.durs.length > 0) {
        curBlock.start = totalTime;
        totalTime += curBlock.duration;
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
    }
    curBlock.lines.push(raw);
  }

  // Same guard as filterM3U8Content
  if (curBlock.durs.length > 0) {
    curBlock.start = totalTime;
    blocks.push(curBlock);
  }
  return blocks;
}

/**
 * Pure function: Filters M3U8 content by identifying ad blocks,
 * removing them, and rewriting relative segment/key URLs to absolute URLs.
 */
export function filterM3U8Content(
  m3u8Content: string,
  baseUrl: string,
  options: AdFilterOptions = {}
): FilterM3U8Result {
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

  // 2. Parse into blocks separated by #EXT-X-DISCONTINUITY
  const blocks: StreamBlock[] = [];
  let curBlock: StreamBlock = { lines: [], durs: [], duration: 0, hasKeyword: false, urls: [] };
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

  // 3. Detect which blocks are ads using the Unified Scoring Engine
  const stats = calculateStreamStats(blocks, durCounts, totalSliceCount);
  const isAdBlock: boolean[] = new Array(blocks.length).fill(false);
  const isPodBlock: boolean[] = new Array(blocks.length).fill(false);

  // 3.1 Pre-pass: Ad Pod aggregation in sparse streams
  if (stats.isSparseDiscontinuity && blocks.length > 1) {
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
              isPodBlock[k] = true;
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
          isPodBlock[k] = true;
        }
      }
    }
  }

  // 3.2 Scoring pass
  const AD_SCORE_THRESHOLD = 70;
  for (let idx = 0; idx < blocks.length; idx++) {
    const b = blocks[idx];
    if (options.verifiedAdIndices?.has(idx)) {
      isAdBlock[idx] = true;
      logger.debug(`Flagged block #${idx} as ad: score=100, reasons=pts_verified_inserted_ad`);
      continue;
    }
    const { score, reasons } = calculateBlockAdScore(b, idx, blocks, stats, standardAdDurs, isPodBlock[idx]);
    if (score >= AD_SCORE_THRESHOLD) {
      isAdBlock[idx] = true;
      logger.debug(
        `Flagged block #${idx} as ad: score=${score}, reasons=${reasons.join(', ')}`
      );
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
  let prevWasVerifiedAd = false;
  for (let idx = 0; idx < blocks.length; idx++) {
    if (isAdBlock[idx]) {
      // Only mark as verified if this block was confirmed via PTS probing.
      // Heuristic-detected ads (keyword, duration, sparse sequence) may have
      // genuinely different codec parameters on either side, so the
      // #EXT-X-DISCONTINUITY between surrounding content blocks must be kept.
      if (options.verifiedAdIndices?.has(idx)) {
        prevWasVerifiedAd = true;
      }
      continue;
    }

    // Omit #EXT-X-DISCONTINUITY ONLY when the excised ad was PTS-verified
    // (proving the surrounding movie segments share continuous PTS timestamps).
    // For all other ad types, keep the discontinuity to preserve correct
    // decoder behavior across potentially different encodings.
    if (keptBlockCount > 0 && !prevWasVerifiedAd) {
      outputLines.push('#EXT-X-DISCONTINUITY');
    }
    prevWasVerifiedAd = false;
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

  // 5. Candidate identification for discontinuity streams (without hardcoded duration feature libraries)
  let candidates: AdCandidateBlock[] | undefined = undefined;
  if (!isModified && blocks.length > 2) {
    const rawCandidates: AdCandidateBlock[] = [];
    for (let idx = 1; idx < blocks.length - 1; idx++) {
      const b = blocks[idx];
      // Physical boundary: Normal movie blocks are long (e.g. hundreds of seconds).
      // Any inserted commercial or autonomous ad is typically <= 120 seconds.
      // We do NOT assume standard integer durations (e.g. 15s/30s/45s), because ads can be
      // disguised or arbitrary length (e.g. 38.8s, 19.2s, 44s).
      if (b.duration >= 3 && b.duration <= 120) {
        const prevBlock = blocks[idx - 1];
        const nextBlock = blocks[idx + 1];
        if (prevBlock.urls.length > 0 && b.urls.length > 0 && nextBlock.urls.length > 0) {
          rawCandidates.push({
            idx,
            duration: b.duration,
            prevUrl: prevBlock.urls[prevBlock.urls.length - 1],
            curUrl: b.urls[0],
            nextUrl: nextBlock.urls[0],
            prevDur: prevBlock.durs[prevBlock.durs.length - 1] || 2,
          });
        }
      }
    }

    // Prioritize candidates: shorter blocks and anomalous blocks probed first
    rawCandidates.sort((a, b) => {
      const blockA = blocks[a.idx];
      const blockB = blocks[b.idx];
      // Anomalous slice remainder priority
      const remA = blockA && stats.dominantDur !== null ? blockA.durs.filter(d => Math.abs(d - stats.dominantDur!) < 0.05).length < blockA.durs.length : false;
      const remB = blockB && stats.dominantDur !== null ? blockB.durs.filter(d => Math.abs(d - stats.dominantDur!) < 0.05).length < blockB.durs.length : false;
      if (remA !== remB) return remA ? -1 : 1;
      return a.duration - b.duration;
    });

    candidates = rawCandidates;
  }

  return {
    content: outputLines.join('\n'),
    adIntervals,
    totalAdDuration,
    isModified,
    candidates,
  };
}

/**
 * Cache management options for M3U8 temporary files.
 */
export interface M3U8CacheCleanupOptions {
  /** Maximum number of recent adfree M3U8 files to keep (default: 15) */
  maxFiles?: number;
  /** Maximum age in milliseconds before a file is considered expired (default: 24 hours) */
  maxAgeMs?: number;
  /** Currently active file URI (e.g. file:///.../adfree_xxx.m3u8), will NEVER be deleted */
  activeUrl?: string;
}

const DEFAULT_MAX_CACHE_FILES = 15;
const DEFAULT_MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Cache management: removes old temporary M3U8 files with timestamp ordering,
 * active playback file protection, and TTL expiration.
 */
export async function cleanupM3U8Cache(options?: M3U8CacheCleanupOptions): Promise<void> {
  try {
    const cacheDir = ReactNativeBlobUtil.fs?.dirs?.CacheDir;
    if (!cacheDir) return;

    const maxFiles = options?.maxFiles ?? DEFAULT_MAX_CACHE_FILES;
    const maxAgeMs = options?.maxAgeMs ?? DEFAULT_MAX_CACHE_AGE_MS;
    const activeUrl = options?.activeUrl;

    const files = await ReactNativeBlobUtil.fs.ls(cacheDir);
    const now = Date.now();

    // Filter files matching adfree_*.m3u8
    const adfreeEntries = files
      .filter((f) => f.startsWith('adfree_') && f.endsWith('.m3u8'))
      .map((filename) => {
        const fullPath = `${cacheDir}/${filename}`;
        const fileUri = `file://${fullPath}`;
        // Extract timestamp if present: adfree_<hash>_<timestamp>.m3u8
        const match = filename.match(/^adfree_[^_]+_(\d+)\.m3u8$/);
        const timestamp = match ? parseInt(match[1], 10) : 0;
        return { filename, fullPath, fileUri, timestamp };
      });

    // Separate active file from candidate files (active file is strictly protected)
    const candidateEntries = adfreeEntries.filter((entry) => {
      if (activeUrl && (entry.fileUri === activeUrl || entry.fullPath === activeUrl || activeUrl.endsWith(entry.filename))) {
        return false;
      }
      return true;
    });

    // Sort candidate files descending by timestamp (newest first)
    candidateEntries.sort((a, b) => b.timestamp - a.timestamp);

    const filesToDelete: typeof candidateEntries = [];

    candidateEntries.forEach((entry, index) => {
      const isTooOld = entry.timestamp > 0 && now - entry.timestamp > maxAgeMs;
      const isExceedingCount = index >= maxFiles;
      if (isTooOld || isExceedingCount) {
        filesToDelete.push(entry);
      }
    });

    for (const entry of filesToDelete) {
      try {
        await ReactNativeBlobUtil.fs.unlink(entry.fullPath);
        logger.debug(`[M3U8Cache] Evicted cache file: ${entry.filename}`);
      } catch (unlinkErr) {
        logger.debug(`[M3U8Cache] Failed to unlink file ${entry.filename}:`, unlinkErr);
      }
    }
  } catch (error) {
    logger.debug('[M3U8Cache] Cache cleanup error:', error);
  }
}

/** Backward compatibility alias */
export const cleanOldAdfreeFiles = cleanupM3U8Cache;

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

/** In-memory cache for processed M3U8 ad filter results */
interface CachedFilterResult {
  result: AdFilterResult;
  timestamp: number;
}
const adFilterResultCache = new Map<string, CachedFilterResult>();
const IN_MEMORY_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const inFlightProcessPromiseMap = new Map<string, Promise<AdFilterResult>>();

/** Clears the in-memory ad filter cache (useful for testing or full resets) */
export function clearAdFilterCache(): void {
  adFilterResultCache.clear();
  inFlightProcessPromiseMap.clear();
}

/**
 * Verifies ambiguous ad candidate blocks in dense streams by checking PTS continuity.
 * Makes a micro-range request (first 3KB) on the boundaries of candidate blocks.
 */
/**
 * Verifies ad candidate blocks by evaluating immutable physical MPEG-TS PTS continuity.
 * Uses micro-range requests (first 8KB) to read hardware encoder timestamps.
 *
 * Implements the Invariant Laws:
 * 1. Seamless Bridge Invariant: If removing candidate block k allows block k-1 and block k+1
 *    to join seamlessly in hardware PTS time (|PTS_next - (PTS_prev + dur_prev)| <= 3.0s or |PTS_next - PTS_prev| <= 3.0s),
 *    block k is 100% physically proven to be an inserted third-party ad.
 * 2. Timeline Monotonicity Invariant: If physical PTS advance between surrounding movie content
 *    is significantly less than the advertised playlist duration (PTS_next - PTS_prev < duration - 4.0s),
 *    and candidate block k has an isolated autonomous PTS timeline, block k is verified as an inserted ad.
 */
export async function verifyCandidateBlocksViaPTS(
  candidates: AdCandidateBlock[],
  baseUrl: string,
  timeoutMs = 2500
): Promise<Set<number>> {
  const verifiedIndices = new Set<number>();
  if (!candidates || candidates.length === 0) return verifiedIndices;

  // 1. Collect all unique URLs required to evaluate physical laws
  const urlSet = new Set<string>();
  for (const c of candidates) {
    if (c.prevUrl) urlSet.add(resolveAbsoluteUrl(c.prevUrl, baseUrl));
    if (c.curUrl) urlSet.add(resolveAbsoluteUrl(c.curUrl, baseUrl));
    if (c.nextUrl) urlSet.add(resolveAbsoluteUrl(c.nextUrl, baseUrl));
  }
  const urls = Array.from(urlSet);

  // 2. Dynamic Worker Pool for concurrent sweeping (Concurrency Limit = 50)
  // Drastically reduces total HTTP requests from 3N to 1N and eliminates straggler wait times
  const ptsCache = new Map<string, number | null>();
  const CONCURRENCY_LIMIT = 50;
  let currentIndex = 0;

  const fetchWorker = async () => {
    while (currentIndex < urls.length) {
      const url = urls[currentIndex++];
      try {
        const controller = new AbortController();
        const tId = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { Range: 'bytes=0-8191' },
        });
        clearTimeout(tId);
        if (!res.ok && res.status !== 206) {
          ptsCache.set(url, null);
          continue;
        }
        const ab = await res.arrayBuffer();
        ptsCache.set(url, parsePTSFromUint8Array(new Uint8Array(ab)));
      } catch {
        ptsCache.set(url, null);
      }
    }
  };

  const workers = [];
  for (let i = 0; i < Math.min(CONCURRENCY_LIMIT, urls.length); i++) {
    workers.push(fetchWorker());
  }
  await Promise.all(workers);

  // 3. Evaluate Physical Invariants Synchronously
  for (const c of candidates) {
    const ptsPrev = ptsCache.get(resolveAbsoluteUrl(c.prevUrl, baseUrl)) ?? null;
    const ptsCur = ptsCache.get(resolveAbsoluteUrl(c.curUrl, baseUrl)) ?? null;
    const ptsNext = ptsCache.get(resolveAbsoluteUrl(c.nextUrl, baseUrl)) ?? null;

    // Physical Law 1: Seamless Bridge Invariant
    const prevEndPts = ptsPrev !== null ? ptsPrev + (c.prevDur || 2.0) : null;
    const seamlessBridge =
      ptsPrev !== null &&
      ptsNext !== null &&
      prevEndPts !== null &&
      Math.abs(ptsNext - prevEndPts) <= 3.0 &&
      c.duration >= 4.0;

    // Physical Law 2: Timeline Monotonicity Broken
    const ptsAdvance = prevEndPts !== null && ptsNext !== null ? ptsNext - prevEndPts : null;
    const ptsUnderAdvances = ptsAdvance !== null && ptsAdvance < c.duration - 4.0;
    const ptsCurDisconnected =
      ptsCur !== null && prevEndPts !== null && Math.abs(ptsCur - prevEndPts) > 3.0;

    const isVerifiedAd =
      (seamlessBridge && (ptsCurDisconnected || c.duration >= 8.0)) ||
      (ptsUnderAdvances && ptsCurDisconnected && c.duration >= 5.0);

    if (isVerifiedAd) {
      verifiedIndices.add(c.idx);
      logger.info(
        `[PTSProbe] Physically verified AD at block #${c.idx} (dur: ${c.duration.toFixed(
          1
        )}s, PTS: prev=${ptsPrev?.toFixed(1) ?? 'null'}, cur=${ptsCur?.toFixed(1) ?? 'null'}, next=${ptsNext?.toFixed(1) ?? 'null'})`
      );
    }
  }

  return verifiedIndices;
}

/**
 * Exhaustive mathematically proven ad detection using PTS continuity verification.
 * Extracts all non-movie blocks (duration <= 120s) and evaluates MPEG-TS hardware PTS continuity.
 */
export async function buildPTSTimeline(
  blocks: StreamBlock[],
  baseUrl: string,
  timeoutMs = 2500
): Promise<Set<number>> {
  const verifiedAdIndices = new Set<number>();
  if (!blocks || blocks.length < 3) return verifiedAdIndices;

  const rawCandidates: AdCandidateBlock[] = [];
  for (let idx = 1; idx < blocks.length - 1; idx++) {
    const b = blocks[idx];
    if (b.duration >= 3 && b.duration <= 120) {
      const prevBlock = blocks[idx - 1];
      const nextBlock = blocks[idx + 1];
      if (prevBlock.urls.length > 0 && b.urls.length > 0 && nextBlock.urls.length > 0) {
        rawCandidates.push({
          idx,
          duration: b.duration,
          prevUrl: prevBlock.urls[prevBlock.urls.length - 1],
          curUrl: b.urls[0],
          nextUrl: nextBlock.urls[0],
          prevDur: prevBlock.durs[prevBlock.durs.length - 1] || 2,
        });
      }
    }
  }

  if (rawCandidates.length === 0) return verifiedAdIndices;

  return verifyCandidateBlocksViaPTS(rawCandidates, baseUrl, timeoutMs);
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

  const cacheKey = `${originalUrl}|${mode}`;

  // Check in-flight promise deduplication to prevent parallel duplicate downloads & disk writes
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
  const cached = adFilterResultCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < IN_MEMORY_CACHE_TTL_MS) {
    // If it's a local file, ensure the file still exists
    if (cached.result.cleanUrl.startsWith('file://')) {
      const filePath = cached.result.cleanUrl.replace(/^file:\/\//, '');
      try {
        const exists = await ReactNativeBlobUtil.fs.exists(filePath);
        if (exists) {
          logger.debug(`Using in-memory cached ad-filter result for: ${originalUrl}`);
          return cached.result;
        }
      } catch {
        // If check fails, continue to re-fetch
      }
    } else {
      logger.debug(`Using in-memory cached ad-filter result for: ${originalUrl}`);
      return cached.result;
    }
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

    // Physical PTS Continuity Search (for streams with discontinuities)
    let verifiedAdIndices: Set<number> | undefined = undefined;
    if (m3u8Text.includes('#EXT-X-DISCONTINUITY')) {
      const blocks = parseM3U8Blocks(m3u8Text);
      if (blocks.length > 2) {
        logger.debug(`[PTSProbe] Multi-block stream detected (${blocks.length} blocks). Evaluating physical PTS continuity...`);
        verifiedAdIndices = await buildPTSTimeline(blocks, baseUrl);
      }
    }

    let filterResult = filterM3U8Content(m3u8Text, baseUrl, {
      ...options,
      verifiedAdIndices: verifiedAdIndices && verifiedAdIndices.size > 0 ? verifiedAdIndices : options?.verifiedAdIndices,
    });

    if (!filterResult.isModified) {
      logger.debug('No ads detected in M3U8 stream');
      const unmodifiedResult: AdFilterResult = {
        cleanUrl: originalUrl,
        adIntervals: [],
        totalAdDuration: 0,
        isModified: false,
      };
      adFilterResultCache.set(cacheKey, { result: unmodifiedResult, timestamp: Date.now() });
      return unmodifiedResult;
    }

    logger.info(
      `Detected ${filterResult.adIntervals.length} ad intervals (total ${filterResult.totalAdDuration.toFixed(
        1
      )}s) in stream`
    );

    // If mode is 'skip', do not write file, return originalUrl with adIntervals
    if (mode === 'skip') {
      const skipResult: AdFilterResult = {
        cleanUrl: originalUrl,
        adIntervals: filterResult.adIntervals,
        totalAdDuration: filterResult.totalAdDuration,
        isModified: true,
      };
      adFilterResultCache.set(cacheKey, { result: skipResult, timestamp: Date.now() });
      return skipResult;
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

      const filename = `adfree_${hashString(finalUrl)}_${Date.now()}.m3u8`;
      const filePath = `${cacheDir}/${filename}`;

      await ReactNativeBlobUtil.fs.writeFile(filePath, filterResult.content, 'utf8');

      const localFileUri = `file://${filePath}`;
      logger.info(`Cleaned M3U8 written to local file: ${localFileUri}`);

      // Non-blocking opportunistic cache cleanup protecting active/new file
      void cleanupM3U8Cache({ activeUrl: localFileUri }).catch((err) =>
        logger.debug('[M3U8Cache] Background cleanup error:', err)
      );

      const seamlessResult: AdFilterResult = {
        cleanUrl: localFileUri,
        // When using a clean local file, the ads are already physically stripped.
        // adIntervals is set to empty so the player does NOT seek or show skip toasts.
        adIntervals: [],
        totalAdDuration: filterResult.totalAdDuration,
        isModified: true,
      };
      adFilterResultCache.set(cacheKey, { result: seamlessResult, timestamp: Date.now() });
      return seamlessResult;
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
