const fs = require('fs');
let code = fs.readFileSync('services/m3u8AdFilter.ts', 'utf8');

// 1. Scoring loop replacement (robust regex)
code = code.replace(
  /\/\/ 3\.2 Scoring pass[\s\S]*?(?=\/\/ 4\. Post-process ad intervals)/,
  `// 3.2 Scoring pass & Candidate Collection
  const AD_SCORE_THRESHOLD = 100;
  let filterResultCandidates = [];
  for (let idx = 0; idx < blocks.length; idx++) {
    const b = blocks[idx];
    if (options.verifiedAdIndices?.has(idx)) {
      isAdBlock[idx] = true;
      logger.debug(\`Flagged block #\${idx} as ad: score=100, reasons=pts_verified_inserted_ad\`);
      continue;
    }
    const { score, reasons } = calculateBlockAdScore(b, idx, blocks, stats, standardAdDurs, isPodBlock[idx]);
    if (score >= AD_SCORE_THRESHOLD) {
      isAdBlock[idx] = true;
      logger.debug(
        \`Flagged block #\${idx} as ad: score=\${score}, reasons=\${reasons.join(', ')}\`
      );
    } else if (score >= 30) {
      // Add to suspicion candidates pool
      const prevBlock = idx > 0 ? blocks[idx - 1] : null;
      const nextBlock = idx < blocks.length - 1 ? blocks[idx + 1] : null;
      if (prevBlock && nextBlock && prevBlock.urls.length > 0 && b.urls.length > 0 && nextBlock.urls.length > 0) {
        filterResultCandidates.push({
          idx,
          duration: b.duration,
          prevUrl: prevBlock.urls[prevBlock.urls.length - 1],
          curUrl: b.urls[0],
          nextUrl: nextBlock.urls[0],
          prevDur: prevBlock.durs[prevBlock.durs.length - 1] || 2,
          score: score
        });
      }
    }
  }

  `
);

// 2. Return replacement
code = code.replace(
  /candidates,[\s\S]*?blocks,/g,
  'candidates: filterResultCandidates,\n    blocks,'
);

fs.writeFileSync('services/m3u8AdFilter.ts', code);
console.log('Successfully patched scoring loop and return');
