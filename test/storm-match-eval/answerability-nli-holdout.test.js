import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { evaluationCases, selectedEntryIds } from './evaluation-corpus.js';
import { decisionCases } from './verifier/decision-corpus.js';
import { answerabilityHoldoutCases, answerabilityHoldoutContract } from './answerability-nli/holdout-corpus.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const snapshot = JSON.parse(readFileSync(join(HERE, 'equinoxe-corpus.snapshot.json'), 'utf8'));
const seal = JSON.parse(readFileSync(join(HERE, 'answerability-nli', 'holdout-seal.json'), 'utf8'));
const normalise = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

test('answerability holdout is sealed at 96 balanced cases', () => {
  assert.equal(answerabilityHoldoutCases.length, 96);
  for (const [label, count] of Object.entries(answerabilityHoldoutContract.labels)) {
    assert.equal(answerabilityHoldoutCases.filter(item => item.label === label).length, count);
  }
  assert.equal(new Set(answerabilityHoldoutCases.map(item => item.id)).size, 96);
  assert.equal(new Set(answerabilityHoldoutCases.map(item => normalise(item.formulation))).size, 96);
  assert.ok(answerabilityHoldoutCases.every(item => item.intentId === null));
  const fingerprint = createHash('sha256').update(JSON.stringify(answerabilityHoldoutCases)).digest('hex');
  assert.equal(fingerprint, seal.answerabilityHoldoutFingerprint);
  assert.equal(fingerprint, 'f157f8ec0e15d2bb2ef3f8c9dd25e3225a86a656a14a9c24e7c174dcdb0c10ff');
});

test('covered sources and formulations are independent from prior corpora', () => {
  const known = new Set(snapshot.entries.map(item => item.entryId));
  const priorPositiveSources = new Set([
    ...selectedEntryIds,
    ...decisionCases.filter(item => item.expectedEntryId).map(item => item.expectedEntryId)
  ]);
  const covered = answerabilityHoldoutCases.filter(item => item.label === 'covered');
  assert.equal(new Set(covered.map(item => item.expectedEntryId)).size, 32);
  assert.ok(covered.every(item => known.has(item.expectedEntryId)));
  assert.ok(covered.every(item => !priorPositiveSources.has(item.expectedEntryId)));
  const priorFormulations = new Set([...evaluationCases, ...decisionCases].map(item => normalise(item.formulation)));
  assert.ok(answerabilityHoldoutCases.every(item => !priorFormulations.has(normalise(item.formulation))));
});

test('holdout type balance matches the sealed contract', () => {
  for (const group of ['coveredTypes', 'notCoveredTypes', 'ambiguousTypes']) {
    for (const [type, count] of Object.entries(answerabilityHoldoutContract[group])) {
      assert.equal(answerabilityHoldoutCases.filter(item => item.type === type).length, count);
    }
  }
  assert.equal(answerabilityHoldoutCases.filter(item => item.risk === 'dangerous').length, 56);
  assert.equal(answerabilityHoldoutCases.filter(item => item.risk === 'weak').length, 8);
});
