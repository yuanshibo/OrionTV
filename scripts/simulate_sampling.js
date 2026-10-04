// Simulate "offset-trend sampling + binary search" on the labeled dataset.
// probe(i) is a lookup into the dataset (head PTS), and we count how many distinct probes the algorithm needs.
const fs = require('fs');
const rows = JSON.parse(fs.readFileSync('scripts/ad_dataset_labeled.json', 'utf8'));
const STRIDE = Number(process.env.STRIDE || 8);
const TAU = Number(process.env.TAU || 3.0);
const isAd = (l) => l.startsWith('ad_');

// 1) measure drift: within contiguous movie runs, how far does offset (pts - cumStart) wander?
let maxDrift = 0, driftSamples = [];
for (const s of rows) {
  const bl = s.blocks; let cum = 0; const off = [];
  bl.forEach((b, i) => { off.push(b.pts === null ? null : b.pts - cum); cum += b.dur; });
  let runMin = null, runMax = null;
  bl.forEach((b, i) => {
    if (off[i] === null || b.label !== 'movie') return;
    const prev = bl[i - 1];
    if (prev && prev.label !== 'movie') { runMin = runMax = off[i]; return; }
    if (runMin === null) { runMin = runMax = off[i]; return; }
    runMin = Math.min(runMin, off[i]); runMax = Math.max(runMax, off[i]);
    maxDrift = Math.max(maxDrift, runMax - runMin);
  });
  if (bl.length > 20) driftSamples.push(+(runMax - runMin).toFixed(2));
}
console.log('max offset wander inside one movie run (all streams):', maxDrift.toFixed(2) + 's');

// 2) algorithm
function run(s) {
  const bl = s.blocks, n = bl.length;
  const cum = []; let c = 0; bl.forEach((b) => { cum.push(c); c += b.dur; });
  const memo = new Map(); let reqs = 0;
  const probe = (i) => { if (!memo.has(i)) { reqs++; memo.set(i, bl[i].pts); } return memo.get(i); };
  const unknown = bl.some((b) => b.pstatus !== 'OK');
  if (unknown) return null;
  const isReset = (i) => { const p = probe(i); return i > 0 && p !== null && p < 20 && cum[i] - p > 30; };
  const ads = new Set();
  const contAd = (a, b2) => Math.abs(probe(b2) - (probe(a) + bl[a].dur)) <= 1.0; // continuity inside ad timeline
  function expandAd(i) {
    ads.add(i);
    // backwards (pod members before)
    for (let j = i - 1; j > 0; j--) {
      const p = probe(j);
      if (p !== null && p < 20 && cum[j] - p > 30 && contAd(j, j + 1)) ads.add(j); else break;
    }
    // forwards
    for (let j = i + 1; j < n; j++) {
      const p = probe(j);
      if (p !== null && p < 20 && cum[j] - p > 30 && contAd(j - 1, j)) ads.add(j); else break;
    }
  }
  const off = (i) => probe(i) - cum[i];
  const samples = [];
  const stride = n <= 16 ? 1 : STRIDE;
  for (let i = 0; i < n; i += stride) samples.push(i);
  if (samples[samples.length - 1] !== n - 1) samples.push(n - 1);
  for (const i of samples) if (isReset(i)) expandAd(i);
  // anchors: non-ad samples plus the blocks right next to each ad run (may themselves be adjacent ads of a different pod)
  const anchors = new Set(samples.filter((i) => !ads.has(i)));
  let changed = true;
  while (changed) {
    changed = false;
    for (const i of [...ads]) for (const j of [i - 1, i + 1]) {
      if (j < 0 || j >= n || ads.has(j)) continue;
      if (isReset(j)) { expandAd(j); changed = true; } else anchors.add(j);
    }
  }
  const list = [...anchors].filter((i) => !ads.has(i)).sort((x, y) => x - y);
  function refine(a, b) { // a<b both non-ad anchors with no known ad between them
    if (b - a <= 1) return;
    if (Math.abs(off(a) - off(b)) <= TAU) return;
    const m = (a + b) >> 1;
    if (isReset(m)) {
      expandAd(m);
      const inside = [...ads].filter((x) => x > a && x < b);
      const lo = Math.min(...inside), hi = Math.max(...inside);
      if (lo - 1 > a) { if (!ads.has(lo - 1)) refine(a, lo - 1); }
      if (hi + 1 < b) { if (!ads.has(hi + 1)) refine(hi + 1, b); }
      return;
    }
    refine(a, m); refine(m, b);
  }
  for (let k = 0; k + 1 < list.length; k++) {
    const a = list[k], b = list[k + 1];
    if ([...ads].some((x) => x > a && x < b)) continue;
    refine(a, b);
  }
  return { ads, reqs, n };
}


let tp = 0, fp = 0, fn = 0, totReq = 0, totN = 0;
const perStream = [];
for (const s of rows) {
  const r = run(s);
  if (!r) continue;
  const truth = new Set(); s.blocks.forEach((b, i) => { if (isAd(b.label)) truth.add(i); });
  let t = 0, f = 0, m = 0;
  r.ads.forEach((i) => (truth.has(i) ? t++ : f++));
  truth.forEach((i) => { if (!r.ads.has(i)) m++; });
  tp += t; fp += f; fn += m; totReq += r.reqs; totN += r.n;
  perStream.push(`${s.url.split('/')[2].padEnd(24)} n=${String(r.n).padStart(3)} req=${String(r.reqs).padStart(3)} tp=${t} fp=${f} fn=${m}${m ? '  missed:' + [...truth].filter((i) => !r.ads.has(i)).join(',') : ''}`);
}
console.log(perStream.join('\n'));
console.log(`\nSTRIDE=${STRIDE} TAU=${TAU}  TP=${tp} FP=${fp} FN=${fn}  requests=${totReq} vs probe-all=${totN} (${(100 * totReq / totN).toFixed(0)}%)`);
