import { createHash } from 'node:crypto';
import { evaluationCases } from '../evaluation-corpus.js';
import { loadSnapshot } from '../evaluate.js';
import { decisionCases } from '../verifier/decision-corpus.js';

const PRIOR_HOLDOUT_MISS_IDS = [
  'decision-pos-equinoxe-q043-paraphrase_naturelle',
  'decision-pos-equinoxe-q043-vocabulaire_different',
  'decision-pos-equinoxe-q043-adjacentButResolvable',
  'decision-pos-equinoxe-q045-vocabulaire_different',
  'decision-pos-equinoxe-q045-adjacentButResolvable',
  'decision-pos-equinoxe-q050-vocabulaire_different',
  'decision-pos-equinoxe-q050-adjacentButResolvable',
  'decision-pos-equinoxe-q054-vocabulaire_different',
  'decision-pos-equinoxe-q054-adjacentButResolvable',
  'decision-pos-equinoxe-q060-synonymes',
  'decision-pos-equinoxe-q060-adjacentButResolvable',
  'decision-pos-equinoxe-q066-synonymes',
  'decision-pos-equinoxe-q066-vocabulaire_different',
  'decision-pos-equinoxe-q066-adjacentButResolvable',
  'decision-pos-equinoxe-q077-vocabulaire_different',
  'decision-pos-equinoxe-q077-adjacentButResolvable'
];

const snapshot = loadSnapshot();
const corpusFingerprint = createHash('sha256')
  .update(JSON.stringify({ entries: snapshot.entries, cases: evaluationCases }))
  .digest('hex');
const decisionFingerprint = createHash('sha256')
  .update(JSON.stringify(decisionCases))
  .digest('hex');
const officialCases = evaluationCases.filter(item => item.expectedEntryId !== null);
const decisionPositiveCases = decisionCases.filter(item => item.expectedEntryId !== null);
const priorMisses = decisionPositiveCases.filter(item => PRIOR_HOLDOUT_MISS_IDS.includes(item.id));

if (officialCases.length !== 290 || decisionPositiveCases.length !== 100 || priorMisses.length !== 16) {
  throw new Error('Knowledge-retrieval corpus contract mismatch');
}

process.stdout.write(JSON.stringify({
  schemaVersion: 1,
  corpusFingerprint,
  decisionFingerprint,
  entries: snapshot.entries.map(({ entryId, question, answer }) => ({ entryId, question, answer })),
  officialCases,
  decisionPositiveCases,
  priorHoldoutMissIds: PRIOR_HOLDOUT_MISS_IDS
}));
