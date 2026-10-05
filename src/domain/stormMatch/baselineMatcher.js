// Temporary adapter. Knowledge and category identity come only from entries.
// Legacy project synonyms stay outside this runtime.
import { createLexicalMatcher, normalize } from '../../../public/shared/lexicalMatcher.js';
const lexical = createLexicalMatcher();

export function matchBaseline(entries, query) {
  if (!normalize(query)) return { state: 'notCovered' };
  const items = entries.map(entry => ({
    id: entry.knowledgeEntryId, category: entry.knowledgeEntryId, title: entry.question
  }));
  const selected = lexical.matchFaq(query, items);
  if (selected) return { state: 'covered', id: selected.id };
  const candidates = items.map(entry => ({ entry, score: lexical.scoreEntry(query, entry) }))
    .filter(candidate => candidate.score >= 12)
    .sort((a, b) => b.score - a.score).slice(0, 3).map(candidate => candidate.entry.id);
  return candidates.length > 1 ? { state: 'ambiguous', ids: candidates } : { state: 'notCovered' };
}
