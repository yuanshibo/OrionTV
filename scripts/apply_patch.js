const fs = require('fs');
const path = 'services/m3u8AdFilter.ts';
let code = fs.readFileSync(path, 'utf8');

// 1. Downgrade heuristic scores in calculateBlockAdScore
code = code.replace(/score \+= 80;/g, 'score += 40;');
code = code.replace(/score \+= 85;/g, 'score += 45;');
code = code.replace(/score \+= 90;/g, 'score += 50;');

// 2. Adjust AD_SCORE_THRESHOLD
code = code.replace(/const AD_SCORE_THRESHOLD = 70;/g, 'const AD_SCORE_THRESHOLD = 100;');

// 3. Collect candidates based on suspicion score (>= 30) instead of just returning isAdBlock
const originalScoringLoop = `  // 3.2 Scoring pass
  const AD_SCORE_THRESHOLD = 100;
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
    }
  }`;

const newScoringLoop = `  // 3.2 Scoring pass & Candidate Collection
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
  }`;

code = code.replace(originalScoringLoop, newScoringLoop);

// 4. Expose filterResultCandidates in filterM3U8Content's return
const newReturn = `  return { content, adIntervals, totalAdDuration, isModified, candidates: filterResultCandidates, blocks };`;
code = code.replace(/return \{\r?\n\s*content,\r?\n\s*adIntervals,\r?\n\s*totalAdDuration,\r?\n\s*isModified,\r?\n\s*\};/g, newReturn);


// 5. Rewrite processM3U8ForPlaybackInternal step 5
const oldStep5Regex = /\/\/ Step 5: If not modified by heuristics.*?(if \(!filterResult\.isModified\))/s;
const newStep5 = `// Step 5: Budgeted Physical Probing (Pass 2)
    if (filterResult.candidates && filterResult.candidates.length > 0) {
      logger.debug(
        \`[PTSProbe] Stream has \${filterResult.candidates.length} suspect blocks. Evaluating top candidates via physical PTS continuity...\`
      );
      // Sort by suspicion score (descending) and budget top 6
      const topCandidates = filterResult.candidates.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 6);
      const verifiedAdIndices = await verifyCandidateBlocksViaPTS(topCandidates, baseUrl);

      if (verifiedAdIndices && verifiedAdIndices.size > 0) {
        if (filterResult.blocks) {
          for (const vIdx of verifiedAdIndices) {
            const block = filterResult.blocks[vIdx];
            if (block) {
              await learnAdFeature({
                url: block.urls[0],
                duration: block.duration,
              });
            }
          }
        }

        // Pass 3: Final Verdict & Rewrite
        filterResult = filterM3U8Content(m3u8Text, baseUrl, {
          ...options,
          verifiedAdIndices,
        });
      }
    }

    $1`;

code = code.replace(oldStep5Regex, newStep5);

// 6. Ensure AdCandidateBlock type has 'score?: number'
code = code.replace(/prevDur: number;\r?\n\}/, 'prevDur: number;\n  score?: number;\n}');

// 7. Adjust verifyCandidateBlocksViaPTS timeout to 2000
code = code.replace(/timeoutMs = 2500/g, 'timeoutMs = 2000');

fs.writeFileSync(path, code);
console.log('Patch successfully written.');
