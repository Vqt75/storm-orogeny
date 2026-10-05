// Stable product boundary. No DOM, persistence, models or presentation imports.
import { CorpusState, isKnowledgeCorpusSnapshot } from './corpus.js';
import { matchBaseline } from './baselineMatcher.js';

const preparedEntries = new WeakMap();
const scopeKeys = ['tenantId', 'projectId', 'publicationRevision', 'corpusFingerprint'];

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function fail(code) {
  const error = new TypeError(code);
  error.code = code;
  throw error;
}
function exactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Reflect.ownKeys(value).length === keys.length
    && keys.every(key => Object.hasOwn(value, key));
}

// Only snapshots issued by the existing publication adapter are accepted.
// Null/unavailable/foreign inputs remain corpus states, never semantic results.
export function prepareCorpus(snapshot) {
  if (!isKnowledgeCorpusSnapshot(snapshot)) {
    return freeze({ state: CorpusState.UNAVAILABLE, reason: 'SNAPSHOT_UNTRUSTED', corpus: null });
  }
  const entries = snapshot.entries.filter(entry => entry.question.trim() && entry.answer.trim())
    .map(entry => ({ knowledgeEntryId: entry.knowledgeEntryId,
      sourceQuestionId: entry.sourceQuestionId, question: entry.question, answer: entry.answer }));
  if (!entries.length) return freeze({ state: CorpusState.EMPTY, reason: null, corpus: null });
  // No global cache: equal content in different scopes cannot share a handle.
  const corpus = freeze({ tenantId: snapshot.tenantId, projectId: snapshot.projectId,
    publicationId: snapshot.publicationId, publicationRevision: snapshot.publicationRevision,
    corpusFingerprint: snapshot.corpusFingerprint, isolationKey: snapshot.isolationKey,
    snapshotId: snapshot.snapshotId, contentLocale: snapshot.contentLocale, entryCount: entries.length });
  preparedEntries.set(corpus, freeze(entries));
  return freeze({ state: CorpusState.READY, reason: null, corpus });
}

// caller is a trusted access/publication scope supplied by the hosting service,
// not client-provided authorization. This check is defense in depth, not AuthN.
export function match(input) {
  if (!exactKeys(input, ['corpus', 'query', 'locale', 'caller'])) fail('MATCH_INPUT_INVALID');
  const { corpus, query, locale, caller } = input;
  if (!corpus || !preparedEntries.has(corpus)) fail('CORPUS_UNTRUSTED');
  if (!exactKeys(caller, scopeKeys) || scopeKeys.some(key => caller[key] !== corpus[key])) fail('CALLER_SCOPE_MISMATCH');
  if (locale !== corpus.contentLocale) fail('LOCALE_MISMATCH');
  if (typeof query !== 'string' || !query.trim()) fail('QUERY_INVALID');
  const entries = preparedEntries.get(corpus);
  const result = matchBaseline(entries, query.trim());
  if (result.state === 'covered') {
    const entry = entries.find(entry => entry.knowledgeEntryId === result.id);
    if (!entry) fail('ENGINE_RESULT_INVALID');
    return freeze({ state: 'covered', knowledgeEntryId: entry.knowledgeEntryId,
      sourceQuestionId: entry.sourceQuestionId, answer: entry.answer });
  }
  if (result.state === 'ambiguous') {
    const ids = [...new Set(result.ids)];
    const candidates = ids.map(id => {
      const entry = entries.find(entry => entry.knowledgeEntryId === id);
      if (!entry) fail('ENGINE_RESULT_INVALID');
      return { knowledgeEntryId: entry.knowledgeEntryId, sourceQuestionId: entry.sourceQuestionId, question: entry.question };
    });
    if (candidates.length < 2) fail('ENGINE_RESULT_INVALID');
    return freeze({ state: 'ambiguous', candidates });
  }
  if (result.state !== 'notCovered') fail('ENGINE_RESULT_INVALID');
  return freeze({ state: 'notCovered' });
}
