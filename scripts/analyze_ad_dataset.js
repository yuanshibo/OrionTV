// Relabel the saved dataset with corrected logic and print ad features per stream.
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('scripts/ad_dataset.json', 'utf8'));

function relabel(bl) {
  const n = bl.length;
  const lab = bl.map(() => 'movie');
  const ok = (i) => bl[i].pstatus === 'OK';
  const cont = (a, c) => Math.abs(bl[c].pts - (bl[a].pts + bl[a].dur)) <= 2.0;
  if (!bl.every((b) => b.pstatus === 'OK')) {
    bl.forEach((b, i) => { if (!ok(i)) lab[i] = 'unknown'; });
  }
  // head: block0 is ad if it does not continue into 1 but 1 continues into 2
  let last = 0;
  let start = 1;
  if (n > 2 && ok(0) && ok(1) && ok(2) && !cont(0, 1) && cont(1, 2)) {
    lab[0] = 'ad_head_break';
    last = 1; start = 2;
  }
  for (let i = start; i < n; ) {
    if (!ok(i)) { i++; continue; }
    if (ok(last) && cont(last, i)) { last = i; i++; continue; }
    let found = false;
    for (let m = 1; m <= 4 && i + m < n; m++) {
      if (!ok(i + m)) break;
      let removed = 0;
      for (let q = 0; q < m; q++) removed += bl[i + q].dur;
      if (cont(last, i + m) && removed >= 4) {
        for (let q = 0; q < m; q++) lab[i + q] = 'ad_bridged';
        last = i + m; i += m + 1; found = true; break;
      }
    }
    if (!found) {
      lab[i] = i === n - 1 ? 'ad_tail_break' : 'break_unbridged';
      if (i !== n - 1) last = i;
      i++;
    }
  }
  return lab;
}

const rows = [];
for (const s of data) {
  if (s.error) { console.log('ERR', s.url, s.error); continue; }
  const bl = s.blocks;
  const lab = relabel(bl);
  bl.forEach((b, i) => (b.label = lab[i]));
  const c = {};
  lab.forEach((x) => (c[x] = (c[x] || 0) + 1));
  console.log('\n== ' + s.url.replace(/^https?:\/\//, '') + (s.encrypted ? ' [ENC]' : ''));
  console.log('   blocks=' + bl.length, JSON.stringify(c));
  const hostCount = {};
  bl.forEach((b) => (hostCount[b.host] = (hostCount[b.host] || 0) + 1));
  bl.forEach((b, i) => {
    if (b.label !== 'movie') {
      const prev = bl[i - 1], next = bl[i + 1];
      console.log(
        `   #${i} ${b.label} dur=${b.dur} n=${b.n} durs=[${b.durs.slice(0, 8).join(',')}${b.n > 8 ? ',…' : ''}] pts=${b.pts}` +
          ` hostDiff=${prev && prev.host !== b.host || next && next.host !== b.host} name=${b.name}`
      );
    }
  });
  rows.push({ url: s.url, blocks: bl });
}
fs.writeFileSync('scripts/ad_dataset_labeled.json', JSON.stringify(rows));
