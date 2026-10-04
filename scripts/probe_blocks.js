const fs = require('fs');

async function test() {
  const url = 'https://cdn.ryplay12.com/20251123/24601_c949702a/2000k/hls/index.m3u8';
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const text = await res.text();
  const lines = text.split(/\r?\n/);
  
  const blocks = [];
  let cur = { idx: 0, dur: 0, count: 0, urls: [], durs: [], start: 0 };
  let totalTime = 0;
  for (const l of lines) {
    if (l.startsWith('#EXT-X-DISCONTINUITY')) {
      if (cur.count > 0) {
        cur.start = totalTime;
        totalTime += cur.dur;
        blocks.push(cur);
      }
      cur = { idx: blocks.length, dur: 0, count: 0, urls: [], durs: [], start: 0 };
    } else if (l.startsWith('#EXTINF:')) {
      const d = parseFloat(l.split(':')[1]);
      cur.dur += d;
      cur.durs.push(d);
      cur.count++;
    } else if (l.trim() && !l.startsWith('#')) {
      cur.urls.push(l.trim());
    }
  }
  if (cur.count > 0) {
    cur.start = totalTime;
    totalTime += cur.dur;
    blocks.push(cur);
  }

  function parsePTS(u8) {
    let minPts = null;
    for (let i = 0; i < u8.length - 188; i++) {
      if (u8[i] === 0x47 && u8[i + 188] === 0x47) {
        const pusi = (u8[i + 1] & 0x40) !== 0;
        const pid = ((u8[i + 1] & 0x1f) << 8) | u8[i + 2];
        const adapt = (u8[i + 3] >> 4) & 0x03;
        let offset = 4;
        if (adapt === 2 || adapt === 3) {
          offset += 1 + u8[i + 4];
        }
        if (pusi && offset + 14 <= 188 && u8[i + offset] === 0x00 && u8[i + offset + 1] === 0x00 && u8[i + offset + 2] === 0x01) {
          const streamId = u8[i + offset + 3];
          if ((streamId >= 0xe0 && streamId <= 0xef) || (streamId >= 0xc0 && streamId <= 0xdf)) {
            const flags = u8[i + offset + 7];
            if (flags & 0x80) {
              const ptsBytes = u8.subarray(i + offset + 9, i + offset + 14);
              const pts = (
                ((ptsBytes[0] & 0x0e) * Math.pow(2, 29)) +
                ((ptsBytes[1] & 0xff) << 22) +
                ((ptsBytes[2] & 0xfe) << 14) +
                ((ptsBytes[3] & 0xff) << 7) +
                (ptsBytes[4] >> 1)
              ) / 90000;
              if (minPts === null || pts < minPts) minPts = pts;
            }
          }
        }
        i += 187;
      }
    }
    return minPts;
  }

  const baseUrl = url.slice(0, url.lastIndexOf('/') + 1);

  for (let idx = 16; idx <= 23; idx++) {
    const b = blocks[idx];
    const firstUrl = baseUrl + b.urls[0];
    const lastUrl = baseUrl + b.urls[b.urls.length - 1];
    
    let pts1 = null;
    try {
      const r1 = await fetch(firstUrl, { headers: { Range: 'bytes=0-16384' } });
      const ab1 = await r1.arrayBuffer();
      pts1 = parsePTS(new Uint8Array(ab1));
    } catch (e) {
      pts1 = 'err: ' + e.message;
    }

    let pts2 = null;
    try {
      const r2 = await fetch(lastUrl, { headers: { Range: 'bytes=0-16384' } });
      const ab2 = await r2.arrayBuffer();
      pts2 = parsePTS(new Uint8Array(ab2));
    } catch (e) {
      pts2 = 'err: ' + e.message;
    }

    const m = Math.floor(b.start / 60);
    const s = Math.floor(b.start % 60);
    console.log(`Block #${idx} (${m}m${s}s, ${b.start.toFixed(1)}s..${(b.start + b.dur).toFixed(1)}s): dur=${b.dur.toFixed(2)}s, slices=${b.count}, PTS_first=${typeof pts1 === 'number' ? pts1.toFixed(3) : pts1}, PTS_last=${typeof pts2 === 'number' ? pts2.toFixed(3) : pts2}, file0=${b.urls[0]}`);
  }
}

test().catch(console.error);
