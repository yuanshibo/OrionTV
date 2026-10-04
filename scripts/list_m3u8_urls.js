const fs = require('fs');
const path = require('path');
const roots = ['services', 'scripts', 'docs', 'utils', 'stores', 'app', 'components'];
const files = ['AGENTS.md', 'README.md'];
function walk(d) {
  if (!fs.existsSync(d)) return;
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    const s = fs.statSync(p);
    if (s.isDirectory()) { if (f !== 'node_modules') walk(p); }
    else if (/\.(ts|tsx|js|md|json)$/.test(f)) files.push(p);
  }
}
roots.forEach(walk);
const re = /https?:\/\/[^\s'"`)\]]+\.m3u8[^\s'"`)\]]*/g;
const hits = {};
for (const f of files) {
  if (!fs.existsSync(f)) continue;
  const t = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  t.forEach((line, i) => {
    const m = line.match(re);
    if (m) m.forEach((u) => { (hits[u] = hits[u] || []).push(f + ':' + (i + 1)); });
  });
}
for (const [u, locs] of Object.entries(hits)) console.log(u, '\n   ', locs.slice(0, 4).join(', '));
console.log('total unique:', Object.keys(hits).length);
