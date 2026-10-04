// Evaluate candidate ad features against the physically-labeled dataset.
const fs = require('fs');
const rows = JSON.parse(fs.readFileSync('scripts/ad_dataset_labeled.json', 'utf8'));

const isAd = (l) => l.startsWith('ad_');
const feats = {
  'F1 head PTS < 20s (block idx>0)': (bl, i) => i > 0 && bl[i].pts !== null && bl[i].pts < 20,
  'F1b head PTS in [1.3,1.6] (idx>0)': (bl, i) => i > 0 && bl[i].pts !== null && bl[i].pts >= 1.3 && bl[i].pts <= 1.6,
  'F2 slice-duration sequence repeats in stream': (bl, i, ctx) => ctx.sigCount[ctx.sig[i]] >= 2,
  'F3 first-slice filename repeats in stream': (bl, i, ctx) => ctx.nameCount[bl[i].name] >= 2,
  'F4 total duration is exact integer (0.01)': (bl, i) => Math.abs(bl[i].dur - Math.round(bl[i].dur)) < 0.01,
  'F5 host differs from neighbor': (bl, i) => (bl[i - 1] && bl[i - 1].host !== bl[i].host) || (bl[i + 1] && bl[i + 1].host !== bl[i].host),
  'F6 dur <= 35s': (bl, i) => bl[i].dur <= 35,
  'F7 total duration < 0.6 x stream median block dur': (bl, i, ctx) => bl[i].dur < 0.6 * ctx.median,
  'F8 block idx==0 or last': (bl, i) => i === 0 || i === bl.length - 1,
};

const stat = {};
for (const k of Object.keys(feats)) stat[k] = { tp: 0, fp: 0, fn: 0, tn: 0 };
let adTotal = 0, movieTotal = 0;
const perStreamFP = {};

for (const s of rows) {
  const bl = s.blocks;
  if (bl.length < 5) { /* sparse mixed streams: still count */ }
  const known = bl.map((b, i) => i).filter((i) => bl[i].label !== 'unknown' && !bl[i].label.startsWith('break'));
  const sig = bl.map((b) => (b.durs.length >= 2 ? b.durs.join('|') : 'single' + Math.random()));
  const sigCount = {}; sig.forEach((x) => (sigCount[x] = (sigCount[x] || 0) + 1));
  const nameCount = {}; bl.forEach((b) => (nameCount[b.name] = (nameCount[b.name] || 0) + 1));
  const ds = bl.map((b) => b.dur).sort((a, b) => a - b);
  const median = ds[Math.floor(ds.length / 2)];
  const ctx = { sig, sigCount, nameCount, median };
  for (const i of known) {
    const ad = isAd(bl[i].label);
    ad ? adTotal++ : movieTotal++;
    for (const [k, f] of Object.entries(feats)) {
      const hit = !!f(bl, i, ctx);
      const t = stat[k];
      if (hit && ad) t.tp++; else if (hit && !ad) { t.fp++; (perStreamFP[k] = perStreamFP[k] || []).push(s.url.split('/')[3] + ':#' + i); }
      else if (!hit && ad) t.fn++; else t.tn++;
    }
  }
}
console.log('ads=' + adTotal, 'movie blocks=' + movieTotal);
console.log('feature'.padEnd(52), 'recall  precision  FP  (hits)');
for (const [k, t] of Object.entries(stat)) {
  const rec = t.tp / (t.tp + t.fn || 1), prec = t.tp / (t.tp + t.fp || 1);
  console.log(k.padEnd(52), rec.toFixed(2).padStart(6), prec.toFixed(2).padStart(9), String(t.fp).padStart(5), ' tp=' + t.tp);
}
// movie-block baseline statistics in dense streams
const mdur = [], mn = [], mfrac = [];
for (const s of rows) if (s.blocks.length > 20) s.blocks.forEach((b) => { if (b.label === 'movie') { mdur.push(b.dur); mn.push(b.n); mfrac.push(Math.abs(b.dur - Math.round(b.dur)) < 0.01); } });
const q = (a, p) => a.slice().sort((x, y) => x - y)[Math.floor(a.length * p)];
console.log('\nmovie block dur p10/p50/p90:', q(mdur, .1), q(mdur, .5), q(mdur, .9), ' n(slices) p10/p50/p90:', q(mn, .1), q(mn, .5), q(mn, .9));
console.log('movie blocks with exact-integer total:', mfrac.filter(Boolean).length, '/', mfrac.length);
// ad pods: pts of 2nd block in a run
console.log('\nad run continuation check (ad block following ad block):');
for (const s of rows) s.blocks.forEach((b, i, bl) => {
  if (b.label === 'ad_bridged' && bl[i - 1] && bl[i - 1].label === 'ad_bridged')
    console.log('  ', s.url.split('/')[3], '#' + i, 'pts=' + b.pts, 'prevAd pts+dur=' + (bl[i - 1].pts + bl[i - 1].dur).toFixed(3));
});
// key-state difference
console.log('\nstreams with key flag mixed (ad vs movie):');
for (const s of rows) {
  const adK = new Set(s.blocks.filter((b) => isAd(b.label)).map((b) => b.key));
  const mvK = new Set(s.blocks.filter((b) => !isAd(b.label)).map((b) => b.key));
  if (adK.size && mvK.size && [...adK].join() !== [...mvK].join()) console.log('  ', s.url.split('/')[2], 'adKey=' + [...adK], 'otherKey=' + [...mvK]);
}
console.log('\nper-feature false positives (first 6):');
for (const [k, v] of Object.entries(perStreamFP)) if (k.startsWith('F1') || k.startsWith('F2') || k.startsWith('F3')) console.log(k, v.slice(0, 6).join(', '), v.length > 6 ? '… +' + (v.length - 6) : '');
