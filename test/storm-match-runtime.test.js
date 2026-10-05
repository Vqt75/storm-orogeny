import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { publishedManifestToKnowledgeCorpus, CorpusState } from '../src/domain/stormMatch/corpus.js';
import { prepareCorpus, match } from '../src/domain/stormMatch/runtime.js';
import { matchFaq, scoreEntry, tokenize } from '../public/ivory/faq-engine.js';

const binding = { tenantId: 'tenant-a', projectId: 'project-a', publicationId: 'publication-a', publicationRevision: 1 };
const items = [{ id: 'q1', title: 'Tisser une étoffe', answer: '  Première ligne.\nSeconde ligne.  ' }];
function snapshot(rows = items, changes = {}) {
  const identity = { ...binding, ...changes };
  return publishedManifestToKnowledgeCorpus({ ...identity, manifest: {
    meta: { revision: identity.publicationRevision, contentLocale: 'fr', generatedAt: '2026-01-01T00:00:00Z' },
    content: { questions: { items: rows } }
  } }).snapshot;
}
function request(corpus, query = 'Tisser une étoffe') {
  return { corpus, query, locale: 'fr', caller: Object.fromEntries(
    ['tenantId', 'projectId', 'publicationRevision', 'corpusFingerprint'].map(key => [key, corpus[key]])) };
}
const ready = () => prepareCorpus(snapshot()).corpus;
const code = expected => error => error.code === expected;

test('1. adapter-issued ready snapshot prepares scoped corpus', () => {
  const s = snapshot(); const result = prepareCorpus(s);
  assert.equal(result.state, CorpusState.READY);
  assert.equal(result.corpus.entryCount, 1);
  assert.equal(result.corpus.isolationKey, s.isolationKey);
  assert.ok(Object.isFrozen(result.corpus));
});
test('2. blank question is excluded', () => {
  const c = prepareCorpus(snapshot([...items, { id: 'blank', title: ' \n ', answer: 'Hidden answer' }])).corpus;
  assert.equal(c.entryCount, 1);
  assert.deepEqual(match(request(c, 'Hidden answer')), { state: 'notCovered' });
});
test('3. blank answer is excluded', () => {
  const c = prepareCorpus(snapshot([...items, { id: 'blank', title: 'Sculpter le bois', answer: '\t ' }])).corpus;
  assert.equal(c.entryCount, 1);
  assert.deepEqual(match(request(c, 'Sculpter le bois')), { state: 'notCovered' });
});
test('4. all ineligible entries and zero entries are CORPUS_EMPTY, never notCovered', () => {
  for (const rows of [[], [{ id: 'a', title: '', answer: 'A' }, { id: 'b', title: 'B', answer: '' }]]) {
    assert.deepEqual(prepareCorpus(snapshot(rows)), { state: CorpusState.EMPTY, reason: null, corpus: null });
  }
});
test('5. preparation leaves published snapshot immutable and byte-identical', () => {
  const s = snapshot([...items, { id: 'b', title: '', answer: 'A' }]);const before = JSON.stringify(s);
  prepareCorpus(s);assert.equal(JSON.stringify(s), before);assert.equal(s.entries.length, 2);
  assert.throws(() => { s.entries[0].answer = 'Injected'; }, TypeError);
});
test('6. tenant/project/revision/fingerprint isolation enforced even for identical knowledge', () => {
  const a = ready();
  for (const changes of [{ tenantId: 'tenant-b' }, { projectId: 'project-b' }, { publicationRevision: 2 }]) {
    const b = prepareCorpus(snapshot(items, changes)).corpus;
    assert.equal(a.corpusFingerprint, b.corpusFingerprint);
    assert.notEqual(a.isolationKey, b.isolationKey);
    assert.throws(() => match({ ...request(b), caller: request(a).caller }), code('CALLER_SCOPE_MISMATCH'));
  }
  assert.throws(() => match({ ...request(a), caller: { ...request(a).caller, corpusFingerprint: 'foreign' } }), code('CALLER_SCOPE_MISMATCH'));
});
test('7. constructed, copied, serialized and foreign prepared corpora are rejected', () => {
  const c = ready();
  for (const foreign of [{}, { ...c }, JSON.parse(JSON.stringify(c)), Object.create(c)]) {
    assert.throws(() => match({ ...request(c), corpus: foreign }), code('CORPUS_UNTRUSTED'));
  }
});
test('8. caller cannot inject answer or selected entry or project facts', () => {
  for (const key of ['answer', 'selectedEntry', 'facts']) {
    const r = request(ready());assert.throws(() => match({ ...r, [key]: 'Injected' }), code('MATCH_INPUT_INVALID'));
    assert.throws(() => match({ ...r, caller: { ...r.caller, [key]: 'Injected' } }), code('CALLER_SCOPE_MISMATCH'));
  }
});
test('9. caller cannot inject decision', () => {
  const r = request(ready());
  assert.throws(() => match({ ...r, decision: 'covered' }), code('MATCH_INPUT_INVALID'));
  assert.throws(() => match({ ...r, caller: { ...r.caller, decision: 'covered' } }), code('CALLER_SCOPE_MISMATCH'));
});
test('10. covered copies exact corpus answer and selected scoped identity', () => {
  const s = snapshot();const result = match(request(prepareCorpus(s).corpus));
  assert.deepEqual(result, { state: 'covered', knowledgeEntryId: s.entries[0].knowledgeEntryId,
    sourceQuestionId: 'q1', answer: items[0].answer });assert.ok(Object.isFrozen(result));
});
test('11. genuine tie returns distinct identities/questions without any answers', () => {
  const s = snapshot([{ id: 'a', title: 'Tisser une étoffe bleue', answer: 'Bleu' },
    { id: 'b', title: 'Tisser une étoffe rouge', answer: 'Rouge' }]);
  const result = match(request(prepareCorpus(s).corpus));
  assert.equal(result.state, 'ambiguous');assert.equal(result.candidates.length, 2);
  assert.equal(new Set(result.candidates.map(c => c.knowledgeEntryId)).size, 2);
  assert.deepEqual(result.candidates.map(c => c.question), s.entries.map(e => e.question));
  assert.ok(!JSON.stringify(result).includes('answer'));assert.ok(Object.isFrozen(result.candidates[0]));
});
test('12. unrelated query returns no answer', () => assert.deepEqual(match(request(ready(), 'astronomie galaxies')), { state: 'notCovered' }));
test('13. locale mismatch rejected, no guessed locale', () => {
  for (const locale of ['en', undefined, 'fr-FR']) assert.throws(() => match({ ...request(ready()), locale }), code('LOCALE_MISMATCH'));
});
test('14. repeated preparation deterministic, independent immutable handles', () => {
  const s = snapshot();const a = prepareCorpus(s), b = prepareCorpus(s);
  assert.deepEqual(a, b);assert.notEqual(a.corpus, b.corpus);assert.deepEqual(match(request(a.corpus)), match(request(b.corpus)));
});
test('15. republication refreshes binding and exact facts without model/training state', () => {
  const a = ready();const b = prepareCorpus(snapshot(items, { publicationId: 'publication-b', publicationRevision: 2 })).corpus;
  assert.notEqual(a.snapshotId, b.snapshotId);assert.notEqual(a.isolationKey, b.isolationKey);
  assert.notEqual(match(request(a)).knowledgeEntryId, match(request(b)).knowledgeEntryId);
  const c = prepareCorpus(snapshot([{ ...items[0], answer: 'New published fact' }], { publicationRevision: 3 })).corpus;
  assert.notEqual(a.corpusFingerprint, c.corpusFingerprint);assert.equal(match(request(c)).answer, 'New published fact');
  assert.equal(match(request(a)).answer, items[0].answer);
  assert.ok(!/train|weights|model/i.test(JSON.stringify(b)));
});
test('16. Gold, scoring and presentation metadata never enter prepared corpus/results', () => {
  const c = prepareCorpus(snapshot([{ ...items[0], gold: 'SECRET', decision: 'covered', keywords: ['galaxies'], priority: 999, category: 'SECRET' }])).corpus;
  assert.deepEqual(match(request(c, 'galaxies')), { state: 'notCovered' });
  assert.ok(!/gold|SECRET|priority|keywords/.test(JSON.stringify({ c, result: match(request(c)) })));
});
test('17. runtime is generic, with no project vocabulary, corpus fixtures or model dependency', () => {
  const sources = ['src/domain/stormMatch/runtime.js', 'src/domain/stormMatch/baselineMatcher.js', 'public/shared/lexicalMatcher.js']
    .map(file => fs.readFileSync(file, 'utf8')).join('\n');
  assert.ok(!/cobalt|[ée]quinoxe|passage|trame|parella|demenagement|teletravail|synonymMap|onnx/i.test(sources));
});
test('18. generic lexical engine behind boundary; legacy behavior and synonyms retained only in facade', () => {
  assert.equal(tokenize('cantine')[0], 'restauration');
  assert.equal(scoreEntry('cantine', { keywords: ['repas'] }), 3);
  const rows = [{ id: 'a', title: 'Réserver la salle', answer: 'A' }];
  assert.equal(matchFaq('Réserver la salle', rows), rows[0]);
  assert.equal(matchFaq('galaxies', rows), null);
  assert.equal(match(request(ready())).state, 'covered');
  assert.ok(fs.readFileSync('public/ivory/faq-engine.js', 'utf8').includes('../shared/lexicalMatcher.js'));
});
test('19. domain runtime has no renderer/browser/DB dependency', () => {
  for (const file of ['runtime.js', 'baselineMatcher.js']) {
    const s = fs.readFileSync(`src/domain/stormMatch/${file}`, 'utf8').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/ivory|document|window|express|repository|pool/.test(s));
  }
});
test('20. unavailable and forged snapshots remain CORPUS_UNAVAILABLE', () => {
  for (const s of [null, undefined, { ...snapshot() }, JSON.parse(JSON.stringify(snapshot()))]) {
    assert.deepEqual(prepareCorpus(s), { state: CorpusState.UNAVAILABLE, reason: 'SNAPSHOT_UNTRUSTED', corpus: null });
  }
});
test('21. blank/invalid queries rejected; unsupported lexical text never chooses arbitrary facts', () => {
  for (const q of ['', ' \n ', null, 42]) assert.throws(() => match(request(ready(), q)), code('QUERY_INVALID'));
  assert.deepEqual(match(request(ready(), '🌱')), { state: 'notCovered' });
});

test('22. legacy extraction preserves weighted scoring, refusal and priority decisions', () => {
  assert.equal(scoreEntry('alpha beta', { title: 'alpha', keywords: ['alpha'], phrases: ['alpha beta'],
    intentSignals: ['alpha'], emotionSignals: ['beta'], negativeSignals: ['beta'], priority: 4 }), 46);
  const tied = [{ id: 'a', title: 'alpha beta', category: 'a' }, { id: 'b', title: 'alpha beta', category: 'b' }];
  assert.equal(matchFaq('alpha beta', tied), null);
  const preferred = { ...tied[0], priority: 1 };
  assert.equal(matchFaq('alpha beta', [preferred, tied[1]]), preferred);
  const broad = ['a', 'b', 'c'].map(id => ({ id, title: 'alpha beta gamma', category: id }));
  assert.equal(matchFaq('alpha beta gamma', broad), null);
});
