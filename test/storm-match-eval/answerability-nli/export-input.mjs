import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluationCases } from '../evaluation-corpus.js';
import { loadSnapshot } from '../evaluate.js';
import { decisionCases } from '../verifier/decision-corpus.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const phase = process.argv[2] ?? 'development';
if (!['development', 'holdout'].includes(phase)) throw new Error('phase must be development or holdout');

const snapshot = loadSnapshot();
const corpusFingerprint = createHash('sha256')
  .update(JSON.stringify({ entries: snapshot.entries, cases: evaluationCases }))
  .digest('hex');
const priorDecisionFingerprint = createHash('sha256').update(JSON.stringify(decisionCases)).digest('hex');
const classifyDevelopment = item => {
  if (item.expectedEntryId) return 'covered';
  return ['trueAmbiguous', 'mixedIntents'].includes(item.type) ? 'ambiguous' : 'notCovered';
};

let cases;
let answerabilityHoldoutFingerprint = null;
if (phase === 'development') {
  cases = decisionCases.map(item => ({ ...item, label: classifyDevelopment(item), originalSplit: item.split }));
} else {
  const { answerabilityHoldoutCases } = await import('./holdout-corpus.js');
  const seal = JSON.parse(readFileSync(join(HERE, 'holdout-seal.json'), 'utf8'));
  answerabilityHoldoutFingerprint = createHash('sha256')
    .update(JSON.stringify(answerabilityHoldoutCases))
    .digest('hex');
  if (answerabilityHoldoutFingerprint !== seal.answerabilityHoldoutFingerprint) {
    throw new Error('Answerability holdout no longer matches its pre-inference seal');
  }
  cases = answerabilityHoldoutCases;
}

process.stdout.write(JSON.stringify({
  schemaVersion: 1,
  phase,
  corpusFingerprint,
  priorDecisionFingerprint,
  answerabilityHoldoutFingerprint,
  sourceGitCommit: snapshot.source.gitCommit,
  entries: snapshot.entries.map(({ entryId, question, answer }) => ({ entryId, question, answer })),
  cases
}));
