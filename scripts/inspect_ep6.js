async function inspect() {
  const url = 'https://cdn.ryplay12.com/20251123/24601_c949702a/2000k/hls/index.m3u8';
  console.log('Fetching:', url);
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const text = await res.text();
  console.log('M3U8 length:', text.length);

  const lines = text.split(/\r?\n/);
  console.log('Total lines:', lines.length);
  const blocks = [];
  let cur = { idx: 0, dur: 0, count: 0, firstUrl: '', lastUrl: '', durs: [], start: 0 };
  let totalTime = 0;

  for (const l of lines) {
    if (l.startsWith('#EXT-X-DISCONTINUITY')) {
      if (cur.count > 0) {
        cur.start = totalTime;
        totalTime += cur.dur;
        blocks.push(cur);
      }
      cur = { idx: blocks.length, dur: 0, count: 0, firstUrl: '', lastUrl: '', durs: [], start: 0 };
    } else if (l.startsWith('#EXTINF:')) {
      const d = parseFloat(l.split(':')[1]);
      cur.dur += d;
      cur.durs.push(d);
      cur.count++;
    } else if (l.trim() && !l.startsWith('#')) {
      if (!cur.firstUrl) cur.firstUrl = l.trim();
      cur.lastUrl = l.trim();
    }
  }
  if (cur.count > 0) {
    cur.start = totalTime;
    totalTime += cur.dur;
    blocks.push(cur);
  }

  console.log('Total blocks:', blocks.length, 'Total duration:', totalTime.toFixed(1) + 's');
  
  // 6分58秒 is around 418 seconds!
  console.log('\n--- Blocks around 6m58s (~418s) and small blocks ---');
  blocks.forEach(b => {
    const min = Math.floor(b.start / 60);
    const sec = Math.floor(b.start % 60);
    if (b.dur <= 60 || (b.start >= 350 && b.start <= 500) || b.idx === 19 || b.idx === 73) {
      console.log(`Block #${b.idx} at ${min}m${sec}s (${b.start.toFixed(1)}s..${(b.start + b.dur).toFixed(1)}s): dur=${b.dur.toFixed(2)}s, count=${b.count}, durs=[${b.durs.slice(0, 6).join(',')}], first=${b.firstUrl}, last=${b.lastUrl}`);
    }
  });
}

inspect().catch(console.error);
