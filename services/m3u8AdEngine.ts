import Logger from '@/utils/Logger';

export interface StreamBlock {
  idx: number;
  duration: number;
  urls: string[];
  durs: number[];
  lines: string[];
}

export function parseM3U8BlocksForEngine(text: string): { blocks: StreamBlock[], headerLines: string[] } {
  const blocks: StreamBlock[] = [];
  const lines = text.split(/\r?\n/);
  
  const headerLines: string[] = [];
  let inHeader = true;
  let curBlock: StreamBlock = { idx: 0, duration: 0, urls: [], durs: [], lines: [] };

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
        curBlock = { idx: blocks.length, duration: 0, urls: [], durs: [], lines: [] };
      }
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
  if (curBlock.durs.length > 0) {
    blocks.push(curBlock);
  }
  
  return { blocks, headerLines };
}

export function rewriteTagUri(line: string, baseUrl: string): string {
  return line.replace(/URI="([^"]+)"/, (_, uri) => {
    return `URI="${resolveAbsoluteUrl(uri, baseUrl)}"`;
  });
}

export function reconstructM3U8(
  blocks: StreamBlock[],
  headerLines: string[],
  ads: Set<number>,
  baseUrl: string,
  originalHasEndlist: boolean
): string {
  const outputLines: string[] = [];
  for (const hLine of headerLines) {
    let rewritten = hLine;
    if (rewritten.includes('URI="')) {
      rewritten = rewriteTagUri(rewritten, baseUrl);
    }
    outputLines.push(rewritten);
  }

  let keptBlockCount = 0;
  for (let idx = 0; idx < blocks.length; idx++) {
    if (ads.has(idx)) continue;

    // We assume ads found by PTS physical probing mean the surrounding blocks are seamless,
    // so we omit the discontinuity when we drop an ad.
    // Actually, if we are bridging, we drop the discontinuity between the ad and the next block.
    // If the movie itself has a discontinuity, we should keep it. 
    // Here we just don't add EXT-X-DISCONTINUITY unless keptBlockCount > 0 and the PREVIOUS kept block 
    // was not contiguous with this one in the original.
    // To simplify: if they were not contiguous in the original (e.g. there was no ad between them), 
    // they originally had a discontinuity. Wait, `blocks` were split by discontinuity.
    // If we keep block A (idx=0) and block C (idx=2), and dropped B (idx=1, which was an ad), 
    // A and C are stitched seamlessly. So no discontinuity needed!
    // But what if they were NOT seamlessly stitched? PhysicalAdEngine only drops an ad if it bridges perfectly.
    // Thus, we NEVER inject a discontinuity where an ad was removed!
    
    // BUT what if we kept block A (idx=0) and block B (idx=1)? They were separated by a discontinuity originally.
    // So if the current block idx > 0, and the previous KEPT block was idx - 1, we MUST insert a discontinuity,
    // because they are adjacent in the original stream (meaning they had a discontinuity between them!).
    // Wait, let's keep it simple: if idx > 0 and the block before it (idx - 1) was NOT dropped, 
    // then there was an original discontinuity between them, so we emit it.
    // If the block before it WAS dropped, we bridged them seamlessly, so we DON'T emit it.
    if (keptBlockCount > 0 && !ads.has(idx - 1)) {
      outputLines.push('#EXT-X-DISCONTINUITY');
    }
    keptBlockCount++;

    for (const rawLine of blocks[idx].lines) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;
      if (trimmed.includes('URI="')) {
        outputLines.push(rewriteTagUri(trimmed, baseUrl));
      } else if (trimmed.startsWith('#')) {
        outputLines.push(trimmed);
      } else {
        outputLines.push(resolveAbsoluteUrl(trimmed, baseUrl));
      }
    }
  }

  if (originalHasEndlist && !outputLines[outputLines.length - 1]?.includes('#EXT-X-ENDLIST')) {
    outputLines.push('#EXT-X-ENDLIST');
  }

  return outputLines.join('\n');
}

export function resolveAbsoluteUrl(relativeUrl: string, baseUrl: string): string {
  const trimmed = relativeUrl.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
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

export function parsePTSFromUint8Array(u8: Uint8Array): number | null {
  if (!u8 || u8.length < 188) return null;
  let minPts: number | null = null;
  for (let i = 0; i < u8.length - 188; i++) {
    if (u8[i] === 0x47 && u8[i + 188] === 0x47) {
      const pusi = (u8[i + 1] & 0x40) !== 0;
      const afc = (u8[i + 3] >> 4) & 0x03;
      const offset = 4 + (afc === 2 || afc === 3 ? 1 + u8[i + 4] : 0);
      if (pusi && offset + 14 <= 188 && u8[i + offset] === 0 && u8[i + offset + 1] === 0 && u8[i + offset + 2] === 1) {
        const streamId = u8[i + offset + 3];
        if ((streamId >= 0xe0 && streamId <= 0xef) || (streamId >= 0xc0 && streamId <= 0xdf)) {
          if (u8[i + offset + 7] & 0x80) {
            const ptsBytes = u8.subarray(i + offset + 9, i + offset + 14);
            const pts = (((ptsBytes[0] & 0x0e) * Math.pow(2, 29)) + ((ptsBytes[1] & 0xff) << 22) + ((ptsBytes[2] & 0xfe) << 14) + ((ptsBytes[3] & 0xff) << 7) + (ptsBytes[4] >> 1)) / 90000;
            if (minPts === null || pts < minPts) minPts = pts;
          }
        }
      }
      i += 187;
    }
  }
  return minPts;
}

export class PhysicalAdEngine {
  private ptsCache = new Map<string, number | null>();
  private blocks: StreamBlock[] = [];
  private baseUrl: string;
  private logger = Logger.withTag('M3U8AdFilter');

  constructor(blocks: StreamBlock[], baseUrl: string) {
    this.blocks = blocks;
    this.baseUrl = baseUrl;
  }

  private async fetchPTSBatch(urls: string[], timeoutMs = 2000): Promise<void> {
    const fetchWorker = async (u: string) => {
      try {
        const controller = new AbortController();
        const tId = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(u, { signal: controller.signal, headers: { Range: 'bytes=0-8191' } });
        clearTimeout(tId);
        if (!res.ok && res.status !== 206) {
          this.ptsCache.set(u, null);
          return;
        }
        const ab = await res.arrayBuffer();
        this.ptsCache.set(u, parsePTSFromUint8Array(new Uint8Array(ab)));
      } catch {
        this.ptsCache.set(u, null);
      }
    };

    const CONCURRENCY_LIMIT = 4;
    const queue = [...urls];
    
    const worker = async () => {
      while (queue.length > 0) {
        const u = queue.shift();
        if (u) await fetchWorker(u);
      }
    };

    const workers = [];
    for (let i = 0; i < Math.min(CONCURRENCY_LIMIT, queue.length); i++) {
      workers.push(worker());
    }
    await Promise.all(workers);
  }

  private async ensureProbed(indices: number[], type: 'first' | 'last' = 'first') {
    const missing = new Set<string>();
    for (const i of indices) {
      if (i < 0 || i >= this.blocks.length) continue;
      const b = this.blocks[i];
      if (b.urls.length === 0) continue;
      const u = resolveAbsoluteUrl(type === 'first' ? b.urls[0] : b.urls[b.urls.length - 1], this.baseUrl);
      if (!this.ptsCache.has(u)) missing.add(u);
    }
    if (missing.size > 0) {
      await this.fetchPTSBatch(Array.from(missing));
    }
  }

  private getCachedPTS(i: number, type: 'first' | 'last' = 'first'): number | null {
    if (i < 0 || i >= this.blocks.length) return null;
    const b = this.blocks[i];
    if (b.urls.length === 0) return null;
    const u = resolveAbsoluteUrl(type === 'first' ? b.urls[0] : b.urls[b.urls.length - 1], this.baseUrl);
    return this.ptsCache.get(u) ?? null;
  }

  public async detectAds(): Promise<Set<number>> {
    const n = this.blocks.length;
    const ads = new Set<number>();
    if (n === 0) return ads;

    const cum: number[] = [];
    let currentCum = 0;
    for (const b of this.blocks) {
      cum.push(currentCum);
      currentCum += b.duration;
    }

    const STRIDE = 8;
    const TAU = 3.0;
    const samples = [];
    const stride = n <= 16 ? 1 : STRIDE;
    for (let i = 0; i < n; i += stride) samples.push(i);
    if (samples[samples.length - 1] !== n - 1) samples.push(n - 1);

    this.logger.debug(`[AdEngine] Initializing physical PTS sampling. Total blocks: ${n}, Samples: ${samples.length}`);
    await this.ensureProbed(samples, 'first');

    const isReset = (i: number) => {
      const p = this.getCachedPTS(i);
      return i > 0 && p !== null && p < 20 && cum[i] - p > 30;
    };

    const isContAd = (a: number, b2: number) => {
      const pa = this.getCachedPTS(a);
      const pb = this.getCachedPTS(b2);
      if (pa === null || pb === null) return false;
      return Math.abs(pb - (pa + this.blocks[a].duration)) <= 1.0;
    };

    const expandAd = async (i: number) => {
      ads.add(i);
      for (let j = i - 1; j > 0; j--) {
        await this.ensureProbed([j], 'first');
        const p = this.getCachedPTS(j);
        // Backward expansion: must be another reset ad or continuous with next ad block
        if (p !== null && cum[j] - p > 10 && (p < 20 || isContAd(j, j + 1))) {
          ads.add(j);
        } else {
          break;
        }
      }
      for (let j = i + 1; j < n; j++) {
        await this.ensureProbed([j], 'first');
        const p = this.getCachedPTS(j);
        // Forward expansion: must be another reset ad or physically continuous with previous ad block
        if (p !== null && cum[j] - p > 10 && (p < 20 || isContAd(j - 1, j))) {
          ads.add(j);
        } else {
          break;
        }
      }
    };

    for (const i of samples) {
      if (isReset(i)) await expandAd(i);
    }

    const anchors = new Set(samples.filter(i => !ads.has(i)));
    let changed = true;
    while (changed) {
      changed = false;
      for (const i of Array.from(ads)) {
        for (const j of [i - 1, i + 1]) {
          if (j < 0 || j >= n || ads.has(j)) continue;
          await this.ensureProbed([j], 'first');
          if (isReset(j)) {
            await expandAd(j);
            changed = true;
          } else {
            anchors.add(j);
          }
        }
      }
    }

    const list = Array.from(anchors).filter(i => !ads.has(i)).sort((x, y) => x - y);
    const off = (i: number) => {
      const p = this.getCachedPTS(i);
      return p !== null ? p - cum[i] : 0;
    };

    const refine = async (a: number, b: number) => {
      if (b - a <= 1) return;
      const pa = this.getCachedPTS(a);
      const pb = this.getCachedPTS(b);
      if (pa === null || pb === null) return;
      if (Math.abs(off(a) - off(b)) <= TAU) return;

      const m = (a + b) >> 1;
      await this.ensureProbed([m], 'first');
      if (isReset(m)) {
        await expandAd(m);
        const inside = Array.from(ads).filter(x => x > a && x < b);
        if (inside.length > 0) {
          const lo = Math.min(...inside);
          const hi = Math.max(...inside);
          if (lo - 1 > a && !ads.has(lo - 1)) await refine(a, lo - 1);
          if (hi + 1 < b && !ads.has(hi + 1)) await refine(hi + 1, b);
        }
        return;
      }
      await refine(a, m);
      await refine(m, b);
    };

    for (let k = 0; k + 1 < list.length; k++) {
      const a = list[k], b = list[k + 1];
      if (Array.from(ads).some(x => x > a && x < b)) continue;
      await refine(a, b);
    }

    const unverified = new Set<number>();
    
    // Convert to arrays and group contiguous ad blocks
    const sortedAds = Array.from(ads).sort((a, b) => a - b);
    let startIdx = 0;
    
    while (startIdx < sortedAds.length) {
      let endIdx = startIdx;
      while (endIdx + 1 < sortedAds.length && sortedAds[endIdx + 1] === sortedAds[endIdx] + 1) {
        endIdx++;
      }
      
      const start = sortedAds[startIdx];
      const end = sortedAds[endIdx];
      
      // Verify this specific continuous block
      if (end === n - 1) {
        // Tail ad check
        await this.ensureProbed([start], 'first');
        const p = this.getCachedPTS(start);
        if (p === null || p < 0 || p > 5.0 || cum[start] - p <= 30) {
          this.logger.debug(`[AdEngine] Rejecting tail ad starting at block ${start}: PTS ${p} did not match ad reset pattern`);
          for (let j = start; j <= end; j++) unverified.add(j);
        } else {
          this.logger.debug(`[AdEngine] Confirmed tail ad starting at block ${start} (PTS: ${p})`);
        }
      } else {
        // Bridging check
        await this.ensureProbed([start - 1], 'last');
        await this.ensureProbed([end + 1], 'first');
        const pPrevEnd = this.getCachedPTS(start - 1, 'last');
        const prevDur = this.blocks[start - 1]?.durs[this.blocks[start - 1].durs.length - 1] || 2.0;
        const pNextStart = this.getCachedPTS(end + 1, 'first');
        
        if (pPrevEnd !== null && pNextStart !== null) {
          const removedDur = this.blocks.slice(start, end + 1).reduce((sum, b) => sum + b.duration, 0);
          const bridged = Math.abs(pNextStart - (pPrevEnd + prevDur)) <= Math.min(TAU, removedDur * 0.25);
          if (!bridged) {
             this.logger.debug(`[AdEngine] Rejecting ad ${start}-${end}: bridging failed. pPrevEnd=${pPrevEnd}, dur=${prevDur}, pNextStart=${pNextStart}`);
             for (let j = start; j <= end; j++) unverified.add(j);
          } else {
             this.logger.debug(`[AdEngine] Confirmed bridged ad ${start}-${end}`);
          }
        } else {
          // If we couldn't fetch bridging segments, we must fail open to avoid destroying the movie
          this.logger.debug(`[AdEngine] Rejecting ad ${start}-${end}: missing bridging PTS probes`);
          for (let j = start; j <= end; j++) unverified.add(j);
        }
      }
      
      startIdx = endIdx + 1;
    }

    unverified.forEach(x => ads.delete(x));
    return ads;
  }
}
