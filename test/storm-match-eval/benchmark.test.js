import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { matchFaq, normalize } from '../../public/ivory/faq-engine.js';
import {
  ambiguityReview,
  evaluationCases,
  FORMULATION_CATEGORIES,
  outOfCorpusCount,
  selectedEntryIds
} from './evaluation-corpus.js';
import {
  BASELINE_PATH,
  evaluateBenchmark,
  loadSnapshot,
  renderReport,
  REPO_ROOT
} from './evaluate.js';
import { heuristicMatcher } from './matchers/heuristic.js';
import { equinoxeSeedExists, extractEquinoxeQuestions } from './source-corpus.js';

const snapshot = loadSnapshot();

test('snapshot Équinoxe : 112 entrées stables et distinctes', () => {
  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.entries.length, 112);
  assert.equal(new Set(snapshot.entries.map(entry => entry.entryId)).size, 112);
  assert.ok(snapshot.entries.every(entry => entry.intentId === null));
});

test('snapshot Équinoxe : dérive détectée tant que le seed source existe, sans importer le module DB', t => {
  if (!equinoxeSeedExists(REPO_ROOT)) {
    t.skip('Le seed Équinoxe a été retiré ; le snapshot autonome reste la fixture autoritative.');
    return;
  }
  assert.deepEqual(snapshot.entries, extractEquinoxeQuestions(REPO_ROOT));
});

test('corpus : 30 questions sélectionnées, dix catégories chacune, plus 20 hors corpus', () => {
  assert.equal(selectedEntryIds.length, 30);
  assert.equal(new Set(selectedEntryIds).size, 30);
  assert.equal(outOfCorpusCount, 20);
  assert.equal(evaluationCases.length, 320);

  for (const entryId of selectedEntryIds) {
    const cases = evaluationCases.filter(testCase => testCase.sourceEntryId === entryId);
    assert.equal(cases.length, 10, entryId);
    assert.deepEqual(cases.map(testCase => testCase.category), FORMULATION_CATEGORIES, entryId);
  }
  assert.equal(evaluationCases.filter(testCase => testCase.category === 'hors_corpus').length, 20);
});

test('corpus : 30 ambiguïtés explicitement classées et attentes cohérentes', () => {
  assert.equal(ambiguityReview.length, 30);
  assert.equal(new Set(ambiguityReview.map(item => item.sourceEntryId)).size, 30);
  assert.deepEqual(
    new Set(ambiguityReview.map(item => item.sourceEntryId)),
    new Set(selectedEntryIds)
  );
  assert.equal(ambiguityReview.filter(item => item.classification === 'trueAmbiguous').length, 10);
  assert.equal(ambiguityReview.filter(item => item.classification === 'adjacentButResolvable').length, 20);

  for (const review of ambiguityReview) {
    const testCase = evaluationCases.find(item =>
      item.sourceEntryId === review.sourceEntryId && item.category === 'ambiguite_adjacent'
    );
    assert.ok(testCase, review.sourceEntryId);
    assert.equal(testCase.ambiguityClassification, review.classification, review.sourceEntryId);
    assert.equal(testCase.expectedEntryId, review.expectedEntryId, review.sourceEntryId);
    if (review.classification === 'trueAmbiguous') assert.equal(review.expectedEntryId, null, review.sourceEntryId);
    else assert.notEqual(review.expectedEntryId, null, review.sourceEntryId);
  }
});

test('corpus : ids uniques, synthétiques, intentId null et références présentes dans le snapshot', () => {
  const snapshotIds = new Set(snapshot.entries.map(entry => entry.entryId));
  assert.ok(snapshot.entries.every(entry => /^equinoxe-q\d{3}$/.test(entry.entryId)));
  assert.equal(new Set(evaluationCases.map(testCase => testCase.id)).size, 320);
  for (const testCase of evaluationCases) {
    assert.equal(testCase.intentId, null, testCase.id);
    assert.equal(typeof testCase.category, 'string', testCase.id);
    assert.equal(typeof testCase.formulation, 'string', testCase.id);
    assert.ok(testCase.formulation.trim().length > 0, testCase.id);
    if (testCase.sourceEntryId !== null) assert.ok(snapshotIds.has(testCase.sourceEntryId), testCase.id);
    if (testCase.expectedEntryId !== null) {
      assert.ok(snapshotIds.has(testCase.expectedEntryId), testCase.id);
    }
  }
});

test('corpus : aucune formulation dupliquée, y compris après normalisation Ivory', () => {
  const raw = evaluationCases.map(testCase => testCase.formulation);
  const normalized = raw.map(formulation => normalize(formulation));
  assert.equal(new Set(raw).size, raw.length);
  assert.equal(new Set(normalized).size, normalized.length);
});

test('adapter : le Top-1 exécute exactement matchFaq() du moteur de production', () => {
  const productionEntries = snapshot.entries.map(entry => ({
    id: entry.entryId,
    title: entry.question,
    answer: entry.answer
  }));
  for (const testCase of evaluationCases) {
    const direct = matchFaq(testCase.formulation, productionEntries);
    const adapted = heuristicMatcher.match(testCase.formulation, snapshot.entries);
    assert.equal(adapted.matchedEntryId, direct?.id ?? null, testCase.id);
  }
});

test('évaluation et rapport : déterministes dans le même état Git', () => {
  const first = evaluateBenchmark();
  const second = evaluateBenchmark();
  assert.deepEqual(first.results, second.results);
  assert.equal(renderReport(first), renderReport(second));
});

test('rapport baseline versionné : exactement à jour', () => {
  const expected = renderReport(evaluateBenchmark());
  const actual = fs.readFileSync(BASELINE_PATH, 'utf8').replace(/\r\n/g, '\n');
  assert.equal(actual, expected);
});

test('harness offline : aucun import DB, réseau ou modèle dans ses sources exécutables', () => {
  const files = [
    'evaluation-corpus.js',
    'evaluate.js',
    'source-corpus.js',
    path.join('matchers', 'heuristic.js')
  ];
  const forbidden = [
    /src[\/\\]db[\/\\]pool/,
    /from\s+['"]pg['"]/,
    /\bfetch\s*\(/,
    /https?:\/\//,
    /\bonnx\b/i,
    /hugging\s*face/i
  ];
  for (const relativePath of files) {
    const source = fs.readFileSync(path.join(path.dirname(BASELINE_PATH), relativePath), 'utf8');
    for (const pattern of forbidden) assert.doesNotMatch(source, pattern, relativePath);
  }
});
