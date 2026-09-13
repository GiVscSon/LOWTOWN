import fs from 'node:fs';
import path from 'node:path';
import { createBlackBoxAnalysisAI } from '../src/game/ai_analysts.js';

const input = process.argv[2] || 'ai-run-artifacts/black-box.json';
const output = process.argv[3] || 'ai-run-artifacts/analysis.json';

if (!fs.existsSync(input)) {
  console.error(`BLACK BOX INPUT NOT FOUND: ${input}`);
  process.exit(2);
}

const report = JSON.parse(fs.readFileSync(input, 'utf8'));
const analysis = createBlackBoxAnalysisAI().analyze(report);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(analysis, null, 2));

console.log('LOWTOWN ANALYSIS ENSEMBLE');
console.log(`risk=${analysis.risk} confidence=${analysis.confidence.toFixed(3)}`);
for (const analyst of analysis.analysts) console.log(`${analyst.name}: findings=${analyst.findings.length} confidence=${analyst.confidence.toFixed(3)}`);
for (const f of analysis.consensus.slice(0, 8)) console.log(`[${f.severity}] ${f.code}: ${f.message}`);
console.log(`recommendation: ${analysis.recommendation}`);
