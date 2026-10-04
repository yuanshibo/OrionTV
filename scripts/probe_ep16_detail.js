const url = 'https://cdn.ryplay12.com/20251123/24610_8c9d10df/2000k/hls/index.m3u8';
async function run() {
  const res = await fetch(url);
  const text = await res.text();
  const lines = text.split(/\r?\n/);
  
  const blocks = [];
  let cur = { idx: 0, dur: 0, count: 0, urls: [], start: 0, durs: [] };
  let totalTime = 0;
  for (const l of lines) {
    if (l.startsWith('#EXT-X-DISCONTINUITY')) {
      if (cur.count > 0) { cur.start = totalTime; totalTime += cur.dur; blocks.push(cur); }
      cur = { idx: blocks.length, dur: 0, count: 0, urls: [], start: 0, durs: [] };
    } else if (l.startsWith('#EXTINF:')) {
      const d = parseFloat(l.split(':')[1]);
      cur.dur += d; cur.durs.push(d); cur.count++;
    } else if (l.trim() && !l.startsWith('#')) {
      cur.urls.push(l.trim());
    }
  }
  if (cur.count > 0) { cur.start = totalTime; totalTime += cur.dur; blocks.push(cur); }
  
  function parsePTS(u8) {
    let minPts = null;
    for (let i = 0; i < u8.length - 188; i++) {
      if (u8[i] === 0x47 && u8[i + 188] === 0x47) {
        const pusi = (u8[i + 1] & 0x40) !== 0;
        const offset = 4 + ((((u8[i + 3] >> 4) & 0x03) === 2 || ((u8[i + 3] >> 4) & 0x03) === 3) ? 1 + u8[i + 4] : 0);
        if (pusi && offset + 14 <= 188 && u8[i + offset] === 0x00 && u8[i + offset + 1] === 0x00 && u8[i + offset + 2] === 0x01) {
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
  
  const baseUrl = url.slice(0, url.lastIndexOf('/') + 1);
  for (let idx of [20, 21, 22, 23, 24]) {
    const b = blocks[idx];
    const r1 = await fetch(baseUrl + b.urls[0], { headers: { Range: 'bytes=0-16384' } });
    const pts1 = parsePTS(new Uint8Array(await r1.arrayBuffer()));
    
    const rn = await fetch(baseUrl + b.urls[b.urls.length - 1], { headers: { Range: 'bytes=0-16384' } });
    const ptsn = parsePTS(new Uint8Array(await rn.arrayBuffer()));
    
    console.log(`Block #${idx}: start=${b.start.toFixed(1)}s, dur=${b.dur.toFixed(2)}s`);
    console.log(`  lastDur=${b.durs[b.durs.length - 1]}`);
    console.log(`  PTS_first=${pts1?.toFixed(3)}, PTS_last=${ptsn?.toFixed(3)}`);
  }
}
run();
