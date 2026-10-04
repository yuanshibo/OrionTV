const fs = require('fs');
const path = 'services/m3u8AdFilter.ts';
let code = fs.readFileSync(path, 'utf8');

const newRule = `
    // Base suspicion for ANY exact integer or standard commercial duration (e.g. 20.0s, 15.0s)
    if (isExactIntegerDur && b.duration <= 90) {
      score += 35;
      reasons.push('exact_integer_base_suspicion');
    } else if (matchesStandardDur && b.duration <= 90) {
      score += 30;
      reasons.push('standard_dur_base_suspicion');
    }
`;

// Insert the new rule right before Feature A
code = code.replace(/\/\/ Feature A: Zero dominant ratio/g, newRule + '\n    // Feature A: Zero dominant ratio');

fs.writeFileSync(path, code);
