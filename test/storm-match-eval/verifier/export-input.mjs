import { createHash } from 'node:crypto';
import { evaluationCases } from '../evaluation-corpus.js';
import { evaluateBenchmark, loadSnapshot } from '../evaluate.js';
import { decisionCases, decisionCorpusContract } from './decision-corpus.js';

const phase = process.argv[2] ?? 'calibration';
if (!['calibration', 'holdout'].includes(phase)) {
  throw new Error('phase must be calibration or holdout');
}

const snapshot = loadSnapshot();
const heuristic = evaluateBenchmark({ entries: snapshot.entries, cases: evaluationCases });
const officialCases = heuristic.results.map(result => ({
  ...result.case,
  heuristic: {
    outcome: result.outcome,
    matchedEntryId: result.matchedEntryId,
    top1Correct: result.top1Correct,
    top3Correct: result.top3Correct
  }
}));
const corpusFingerprint = createHash('sha256')
  .update(JSON.stringify({ entries: snapshot.entries, cases: evaluationCases }))
  .digest('hex');
const decisionFingerprint = createHash('sha256')
  .update(JSON.stringify(decisionCases))
  .digest('hex');

const payload = {
  schemaVersion: 1,
  phase,
  corpusFingerprint,
  decisionFingerprint,
  sourceGitCommit: snapshot.source.gitCommit,
  entries: snapshot.entries.map(({ entryId, question, answer }) => ({ entryId, question, answer })),
  decisionContract: decisionCorpusContract,
  officialCases: phase === 'calibration' ? officialCases : [],
  decisionCases: decisionCases.filter(item => item.split === phase)
};

process.stdout.write(JSON.stringify(payload));
