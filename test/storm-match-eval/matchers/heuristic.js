import { matchFaq, scoreEntry } from '../../../public/ivory/faq-engine.js';

// These are the thresholds already used by faq-engine.js and the Ivory
// renderer. They are reported, not tuned, by this harness.
export const CURRENT_THRESHOLDS = Object.freeze({
  minimumMatchScore: 12,
  mediumConfidenceScore: 18,
  highConfidenceScore: 28
});

function confidenceBucket(score) {
  if (score >= CURRENT_THRESHOLDS.highConfidenceScore) return 'high';
  if (score >= CURRENT_THRESHOLDS.mediumConfidenceScore) return 'medium';
  return 'low';
}

function toProductionEntry(entry) {
  return {
    id: entry.entryId,
    title: entry.question,
    answer: entry.answer
  };
}

export const heuristicMatcher = Object.freeze({
  id: 'storm-heuristic-current',
  match(query, entries) {
    const productionEntries = entries.map(toProductionEntry);
    const direct = matchFaq(query, productionEntries);
    const rankedCandidates = productionEntries
      .map((entry, sourceIndex) => ({
        entryId: entry.id,
        score: scoreEntry(query, entry),
        sourceIndex
      }))
      .sort((a, b) => (b.score - a.score) || (a.sourceIndex - b.sourceIndex))
      .map(({ entryId, score }) => ({
        entryId,
        score,
        confidenceBucket: confidenceBucket(score)
      }));

    if (direct) {
      return {
        outcome: 'matched',
        matchedEntryId: direct.id,
        rankedCandidates,
        disambiguationCandidates: []
      };
    }

    // Mirrors wireInteractions() in Ivory: when matchFaq() abstains, Ivory
    // exposes a choice only if at least two entries still reach the existing
    // score-12 candidate threshold.
    const disambiguationCandidates = rankedCandidates
      .filter(candidate => candidate.score >= CURRENT_THRESHOLDS.minimumMatchScore)
      .slice(0, 3);

    return {
      outcome: disambiguationCandidates.length >= 2 ? 'disambiguated' : 'abstained',
      matchedEntryId: null,
      rankedCandidates,
      disambiguationCandidates
    };
  }
});
