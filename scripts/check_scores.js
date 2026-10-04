const fs = require('fs');

async function checkScores() {
  const url = 'https://cdn.ryplay12.com/20251123/24601_c949702a/2000k/hls/index.m3u8';
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
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
    if (count > maxCount) {
      maxCount = count;
      dominantDur = parseFloat(dur);
    }
  }
  const dominantFreq = totalSliceCount > 0 ? maxCount / totalSliceCount : 0;
  console.log('DominantDur:', dominantDur, 'DominantFreq:', dominantFreq, 'TotalSlices:', totalSliceCount);
  console.log('Top DurCounts:', Object.entries(durCounts).sort((a,b)=>b[1]-a[1]).slice(0, 10));

  const blocks = [];
  let cur = { idx: 0, dur: 0, count: 0, durs: [], urls: [] };
  for (const l of lines) {
    if (l.startsWith('#EXT-X-DISCONTINUITY')) {
      if (cur.count > 0) blocks.push(cur);
      cur = { idx: blocks.length, dur: 0, count: 0, durs: [], urls: [] };
    } else if (l.startsWith('#EXTINF:')) {
      const d = parseFloat(l.split(':')[1]);
      cur.dur += d;
      cur.durs.push(d);
      cur.count++;
    } else if (l.trim() && !l.startsWith('#')) {
      cur.urls.push(l.trim());
    }
  }
  if (cur.count > 0) blocks.push(cur);

  const standardAdDurs = [5, 6, 8, 9, 10, 12, 15, 16, 17, 18, 19, 20, 21, 22, 25, 30, 45, 60, 75, 90];

  for (let idx of [18, 19, 20, 21, 22, 23, 72, 73]) {
    const b = blocks[idx];
    const matchDominantCount = dominantDur !== null ? b.durs.filter(d => Math.abs(d - dominantDur) < 0.05).length : 0;
    const dominantRatio = b.durs.length > 0 ? matchDominantCount / b.durs.length : 0;
    const isExactIntegerDur = standardAdDurs.some(d => Math.abs(b.dur - d) < 0.01);
    console.log(`Block #${idx}: dur=${b.dur}, count=${b.count}, durs=[${b.durs.join(',')}], matchDom=${matchDominantCount}, domRatio=${dominantRatio.toFixed(2)}, isExactInt=${isExactIntegerDur}`);
  }
}

checkScores().catch(console.error);
