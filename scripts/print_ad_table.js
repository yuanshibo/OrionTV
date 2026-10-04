const fs = require('fs');
const rows = JSON.parse(fs.readFileSync('scripts/ad_dataset_labeled.json', 'utf8'));
let k = 0;
for (const s of rows) {
  const ads = s.blocks.filter((b) => b.label.startsWith('ad_'));
  k++;
  const desc = ads.map((b) => `#${b.idx}${b.label === 'ad_tail_break' ? '(tail)' : b.label === 'ad_head_break' ? '(head)' : ''}:${b.dur}s/${b.n}片/pts${b.pts}`).join('; ');
  console.log(`| ${k} | ${s.url.replace(/^https?:\/\//, '')} | ${s.blocks.length} | ${ads.length} | ${desc || '-'} |`);
}
