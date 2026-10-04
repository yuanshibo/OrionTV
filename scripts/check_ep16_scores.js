const fs = require('fs');

async function run() {
  const url = 'https://cdn.ryplay12.com/20251123/24610_8c9d10df/2000k/hls/index.m3u8';
  const res = await fetch(url);
  const text = await res.text();
  const lines = text.split(/\r?\n/);
  
  const durCounts = {};
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

  let dominantDur = null;
  let maxCount = 0;
  for (const [dur, count] of Object.entries(durCounts)) {
    if (count > maxCount) { maxCount = count; dominantDur = parseFloat(dur); }
  }
  const dominantFreq = totalSliceCount > 0 ? maxCount / totalSliceCount : 0;

  const blocks = [];
  let cur = { idx: 0, dur: 0, count: 0, durs: [], urls: [] };
  for (const l of lines) {
    if (l.startsWith('#EXT-X-DISCONTINUITY')) {
      if (cur.count > 0) blocks.push(cur);
      cur = { idx: blocks.length, dur: 0, count: 0, durs: [], urls: [] };
    } else if (l.startsWith('#EXTINF:')) {
      const d = parseFloat(l.split(':')[1]);
      cur.dur += d; cur.durs.push(d); cur.count++;
    } else if (l.trim() && !l.startsWith('#')) {
      cur.urls.push(l.trim());
    }
  }
  if (cur.count > 0) blocks.push(cur);

  const standardAdDurs = [5, 6, 8, 9, 10, 12, 15, 16, 17, 18, 19, 20, 21, 22, 25, 30, 45, 60, 75, 90];

  const candidates = [];
  for (let idx = 0; idx < blocks.length; idx++) {
    const b = blocks[idx];
    let score = 0;
    const isBoundary = idx === 0 || idx === blocks.length - 1;
    const matchesStandardDur = standardAdDurs.some(d => Math.abs(b.dur - d) <= 1.5);
    const isExactIntegerDur = standardAdDurs.some(d => Math.abs(b.dur - d) < 0.01);
    
    const matchDominantCount = dominantDur !== null ? b.durs.filter(d => Math.abs(d - dominantDur) < 0.05).length : 0;
    const dominantRatio = b.durs.length > 0 ? matchDominantCount / b.durs.length : 0;

    // A
    if (dominantRatio === 0) {
      if (b.durs.length <= 3) score += 40;
      else if (b.durs.length <= 4 && matchesStandardDur) score += 40;
    }
    // B
    if (isExactIntegerDur && dominantRatio <= 0.35 && b.dur <= 35) score += 45;
    // C
    if (isBoundary && b.durs.length <= 3 && matchesStandardDur && dominantRatio <= 0.35) score += 45;
    // D
    if (dominantFreq >= 0.70 && !isBoundary && b.dur <= 60 && matchesStandardDur && matchDominantCount < b.durs.length) score += 45;
    // E
    if (dominantFreq >= 0.95 && !isBoundary && b.dur <= 90 && matchDominantCount < b.durs.length) score += 50;

    candidates.push({ idx, score, dur: b.dur, isBoundary, matchesStandardDur });
  }

  candidates.sort((a, b) => b.score - a.score);
  console.log('Top 15 candidates:');
  for (let i = 0; i < 15; i++) {
    console.log(`Rank ${i+1}: Block #${candidates[i].idx} (score=${candidates[i].score}, dur=${candidates[i].dur.toFixed(2)})`);
  }
}
run();
