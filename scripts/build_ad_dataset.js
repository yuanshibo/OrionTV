// Build a labeled ad dataset from real streams.
// Label rule (physical): block run [k..k+m-1] (m<=4) is an ad if the block before it (a) and the block after it (c)
// bridge seamlessly (|head_c - (head_a + dur_a)| <= 2.0s) while head_k does NOT continue from a (>2.0s).
// Tail break: last block whose head does not continue from the previous block and which has no c.
const fs = require('fs');

const STREAMS = [
  'https://cdn.ryplay12.com/20251123/24601_c949702a/index.m3u8',
  'https://cdn.ryplay12.com/20251123/24602_d7ed9641/index.m3u8',
  'https://cdn.ryplay12.com/20251123/24606_d17f1ae2/index.m3u8',
  'https://cdn.ryplay12.com/20251123/24610_8c9d10df/index.m3u8',
  'https://cdn.ryplay12.com/20251123/24590_1733bbc5/index.m3u8',
  'https://cdn.ryplay11.com/20260504/199628_ebbce7cc/2000k/hls/index.m3u8',
  'https://cdn.vvvip-plays33.cc/20260911/19498_2da1cfad/index.m3u8',
  'https://cdn.yzzy28-play.com/20260803/32838_a024f8a6/index.m3u8',
  'https://cdn.yzzy31-play.com/20260909/25483_37499bff/3000k/hls/mixed.m3u8',
  'https://cdn.yzzy32-play.com/20260727/49496_506bcafd/3000k/hls/mixed.m3u8',
  'https://cdn.yzzyvip-29.com/20260720/25891_f6ff1d6f/3000k/hls/mixed.m3u8',
  'https://cdn7.ryplay7.com/20251119/17340_0aa2a99f/2000k/hls/index.m3u8',
  'https://play.modujx11.com/20260504/ZwBEzqN3/index.m3u8',
  'https://play.modujx17.com/20260909/dEAwnHvc/985kb/hls/index.m3u8',
  'https://play.phimgood.com/20260731/29580_06038170/3000k/hls/mixed.m3u8',
  'https://play.subokk.com/play/0dNzK7md/index.m3u8',
  'https://vv.jisuzyv.com/play/b4xLpYxb/index.m3u8',
  'https://super.ffzy-online6.com/20260809/38382_1786aee5/3000k/hls/mixed.m3u8',
  'https://super.ffzy-online6.com/20260909/40612_78afc259/3000k/hls/mixed.m3u8',
  'https://super.ffzy-online6.com/20260911/40831_b5ae90d5/3000k/hls/mixed.m3u8',
  'https://v13.zuidazym3u8.com/yyv13/202609/11/UqsZQmKs8m27/video/index.m3u8',
  'https://v13.zuidazym3u8.com/yyv13/202609/11/x5hc0mYiEY27/video/index.m3u8',
  'https://v13.zuidazym3u8.com/yyv13/202609/09/agQrnVk1hM27/video/2000k_1080/hls/index.m3u8',
  'https://v15.zuidazym3u8.com/yyv15/202609/09/TNkM1XnyWi27/video/2000k_1080/hls/index.m3u8',
  'https://vip.dytt-hot.com/20250213/72013_e835617a/index.m3u8',
  'https://vip.dytt-tvs.com/20260504/18941_6de7c6c7/index.m3u8',
  'https://vod1.maowushi.com/20260909/QOVKAylY/985kb/hls/index.m3u8',
  'https://vod1.maowushi.com/20260911/92PQbCFu/1837kb/hls/index.m3u8',
];

const UA = { 'User-Agent': 'Mozilla/5.0' };

async function getText(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(url, { headers: UA, signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } finally { clearTimeout(t); }
}

function parsePTS(u8) {
  let minPts = null;
  for (let i = 0; i + 188 < u8.length; i++) {
    if (u8[i] === 0x47 && u8[i + 188] === 0x47) {
      const pusi = (u8[i + 1] & 0x40) !== 0;
      const afc = (u8[i + 3] >> 4) & 0x03;
      const offset = 4 + (afc === 2 || afc === 3 ? 1 + u8[i + 4] : 0);
      if (pusi && offset + 14 <= 188 && u8[i + offset] === 0 && u8[i + offset + 1] === 0 && u8[i + offset + 2] === 1) {
        const sid = u8[i + offset + 3];
        if (sid >= 0xe0 && sid <= 0xef && (u8[i + offset + 7] & 0x80)) {
          const p = u8.subarray(i + offset + 9, i + offset + 14);
          const pts = ((p[0] & 0x0e) * 2 ** 29 + (p[1] << 22) + ((p[2] & 0xfe) << 14) + (p[3] << 7) + (p[4] >> 1)) / 90000;
          if (minPts === null || pts < minPts) minPts = pts;
        }
      }
      i += 187;
    }
  }
  return minPts;
}

async function headPts(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 10000);
  try {
    const r = await fetch(url, { headers: { ...UA, Range: 'bytes=0-16383' }, signal: ctl.signal });
    if (!r.ok && r.status !== 206) return { status: 'HTTP' + r.status };
    const buf = new Uint8Array(await r.arrayBuffer());
    const pts = parsePTS(buf);
    return pts === null ? { status: 'NO_PTS' } : { status: 'OK', pts };
  } catch (e) { return { status: 'FAILED' }; } finally { clearTimeout(t); }
}

function resolve(u, base) { try { return new URL(u, base).toString(); } catch { return u; } }

async function loadMedia(url) {
  let text = await getText(url);
  let cur = url;
  for (let d = 0; d < 3 && text.includes('#EXT-X-STREAM-INF'); d++) {
    const ls = text.split(/\r?\n/);
    let best = null, bw = -1;
    for (let i = 0; i < ls.length; i++) {
      if (ls[i].startsWith('#EXT-X-STREAM-INF')) {
        const m = ls[i].match(/BANDWIDTH=(\d+)/);
        const b = m ? +m[1] : 0;
        const uri = ls.slice(i + 1).find((x) => x.trim() && !x.startsWith('#'));
        if (uri && b >= bw) { bw = b; best = uri.trim(); }
      }
    }
    cur = resolve(best, cur);
    text = await getText(cur);
  }
  return { text, url: cur };
}

function parseBlocks(text, base) {
  const blocks = [];
  let b = { urls: [], durs: [], key: '' };
  let key = '';
  let pendingDur = null;
  for (const raw of text.split(/\r?\n/)) {
    const l = raw.trim();
    if (l.startsWith('#EXT-X-KEY')) key = l;
    if (l.startsWith('#EXT-X-DISCONTINUITY')) {
      if (b.urls.length) blocks.push(b);
      b = { urls: [], durs: [], key };
    } else if (l.startsWith('#EXTINF:')) {
      pendingDur = parseFloat(l.slice(8));
    } else if (l && !l.startsWith('#')) {
      b.urls.push(resolve(l, base));
      b.durs.push(pendingDur ?? 0);
      b.key = key;
      pendingDur = null;
    }
  }
  if (b.urls.length) blocks.push(b);
  return blocks;
}

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; await fn(items[k], k); }
  }));
}

function label(blocks) {
  const n = blocks.length;
  const lab = new Array(n).fill('movie');
  const ok = (i) => blocks[i].probe && blocks[i].probe.status === 'OK';
  const cont = (a, c) => Math.abs(blocks[c].probe.pts - (blocks[a].probe.pts + blocks[a].dur)) <= 2.0;
  let i = 1;
  while (i < n) {
    if (!ok(i) || !ok(i - 1)) { if (!ok(i)) lab[i] = 'unknown'; i++; continue; }
    if (cont(i - 1, i)) { i++; continue; }
    // break at i: try to bridge over run i..i+m-1
    let found = false;
    for (let m = 1; m <= 4 && i + m < n; m++) {
      if (!ok(i + m)) break;
      let removed = 0;
      for (let q = 0; q < m; q++) removed += blocks[i + q].dur;
      if (cont(i - 1, i + m) && removed >= 4) {
        for (let q = 0; q < m; q++) lab[i + q] = 'ad_bridged';
        i += m; found = true; break;
      }
    }
    if (!found) {
      // tail or unbridged break
      if (i === n - 1) lab[i] = 'ad_tail_break';
      else lab[i] = 'break_unbridged';
      i++;
    }
  }
  // head block: if block 0 has PTS far from block 1 continuity
  if (n > 1 && ok(0) && ok(1) && !cont(0, 1)) { if (lab[1] === 'movie') lab[0] = 'break_head'; }
  return lab;
}

(async () => {
  const START = Number(process.env.START || 0);
  const out = START ? JSON.parse(fs.readFileSync('scripts/ad_dataset.json', 'utf8')).slice(0, START) : [];
  for (const s of STREAMS.slice(START)) {
    const rec = { url: s };
    try {
      const { text, url } = await loadMedia(s);
      rec.media = url;
      rec.encrypted = /#EXT-X-KEY:METHOD=(?!NONE)/.test(text);
      const blocks = parseBlocks(text, url);
      blocks.forEach((b, idx) => { b.idx = idx; b.dur = b.durs.reduce((x, y) => x + y, 0); });
      await pool(blocks, 6, async (b) => { b.probe = await headPts(b.urls[0]); });
      const lab = label(blocks);
      rec.blocks = blocks.map((b, i) => ({
        idx: i, dur: +b.dur.toFixed(3), n: b.durs.length, durs: b.durs.map((d) => +d.toFixed(3)),
        host: new URL(b.urls[0]).host, pts: b.probe.status === 'OK' ? +b.probe.pts.toFixed(3) : null,
        pstatus: b.probe.status, key: b.key ? 1 : 0, label: lab[i], name: b.urls[0].split('/').pop().slice(0, 40),
      }));
      const c = {};
      lab.forEach((x) => (c[x] = (c[x] || 0) + 1));
      console.log(s.replace(/^https?:\/\//, '').slice(0, 70), 'blocks=' + blocks.length, JSON.stringify(c), rec.encrypted ? 'ENC' : '');
    } catch (e) {
      rec.error = String(e.message || e);
      console.log('FAIL', s.slice(0, 70), rec.error);
    }
    out.push(rec);
    fs.writeFileSync('scripts/ad_dataset.json', JSON.stringify(out));
  }
  console.log('done');
})();
