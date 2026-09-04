import { createHash } from 'node:crypto';
import { evaluationCases } from '../evaluation-corpus.js';
import { evaluateBenchmark, loadSnapshot } from '../evaluate.js';
import { CURRENT_THRESHOLDS } from '../matchers/heuristic.js';

const snapshot = loadSnapshot();
const heuristic = evaluateBenchmark({ entries: snapshot.entries, cases: evaluationCases });
const entries = snapshot.entries.map(({ entryId, question }) => ({ entryId, question }));
const corpusFingerprint = createHash('sha256')
  .update(JSON.stringify({ entries: snapshot.entries, cases: evaluationCases }))
  .digest('hex');

function normalizeLexicalScore(rawScore) {
  return Math.max(0, Math.min(1, rawScore / CURRENT_THRESHOLDS.highConfidenceScore));
}

const payload = {
  schemaVersion: 1,
  corpusFingerprint,
  sourceGitCommit: snapshot.source.gitCommit,
  entries,
  lexicalNormalization: {
    formula: 'clamp(rawScore / highConfidenceScore, 0, 1)',
    minimumMatchScore: CURRENT_THRESHOLDS.minimumMatchScore,
    mediumConfidenceScore: CURRENT_THRESHOLDS.mediumConfidenceScore,
    highConfidenceScore: CURRENT_THRESHOLDS.highConfidenceScore,
    mediumSupportNormalized: normalizeLexicalScore(CURRENT_THRESHOLDS.mediumConfidenceScore)
  },
  cases: heuristic.results.map(result => ({
    ...result.case,
    heuristic: {
      outcome: result.outcome,
      matchedEntryId: result.matchedEntryId,
      top1Correct: result.top1Correct,
      top3Correct: result.top3Correct,
      topCandidateRawScore: result.rankedCandidates[0]?.score ?? 0
    },
    lexicalCandidates: result.rankedCandidates.map(candidate => ({
      entryId: candidate.entryId,
      rawScore: candidate.score,
      normalizedScore: normalizeLexicalScore(candidate.score)
    }))
  }))
};

process.stdout.write(JSON.stringify(payload));
