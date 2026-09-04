import { createHash } from 'node:crypto';
import { evaluationCases } from '../evaluation-corpus.js';
import { evaluateBenchmark, loadSnapshot } from '../evaluate.js';

const snapshot = loadSnapshot();
const heuristic = evaluateBenchmark({ entries: snapshot.entries, cases: evaluationCases });
const corpusFingerprint = createHash('sha256')
  .update(JSON.stringify({ entries: snapshot.entries, cases: evaluationCases }))
  .digest('hex');

const payload = {
  schemaVersion: 1,
  corpusFingerprint,
  sourceGitCommit: snapshot.source.gitCommit,
  entries: snapshot.entries.map(({ entryId, question }) => ({ entryId, question })),
  cases: heuristic.results.map(result => ({
    ...result.case,
    heuristic: {
      outcome: result.outcome,
      matchedEntryId: result.matchedEntryId,
      top1Correct: result.top1Correct
    }
  }))
};

process.stdout.write(JSON.stringify(payload));
