import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { validateAnswerEquivalenceQualityGate } from './task-specific/equivalence-quality-gate.js';

const HERE = dirname(fileURLToPath(import.meta.url));

const entries = [
  { entryId: 'fixture-q001' },
  { entryId: 'fixture-q002' },
  { entryId: 'fixture-q003' }
];
const groups = [
  {
    answerEquivalenceGroupId: 'answer-group-a',
    entryIds: ['fixture-q001', 'fixture-q002'],
    preferredEntryId: 'fixture-q001'
  },
  {
    answerEquivalenceGroupId: 'answer-group-b',
    entryIds: ['fixture-q003'],
    preferredEntryId: 'fixture-q003'
  }
];

test('answer-equivalence Quality Gate accepts same-group candidates as one covered outcome', () => {
  const result = validateAnswerEquivalenceQualityGate({
    entries,
    groups,
    cases: [{
      caseId: 'covered-equivalent-candidates',
      expectedSystemOutcome: 'covered',
      expectedEntryId: 'fixture-q001',
      goldCoveredCandidateIds: ['fixture-q001', 'fixture-q002'],
      goldCoveredAnswerEquivalenceGroupIds: ['answer-group-a'],
      candidatePairs: [
        { candidateEntryId: 'fixture-q001', answerEquivalenceGroupId: 'answer-group-a', label: 'covered' },
        { candidateEntryId: 'fixture-q002', answerEquivalenceGroupId: 'answer-group-a', label: 'covered' },
        { candidateEntryId: 'fixture-q003', answerEquivalenceGroupId: 'answer-group-b', label: 'notCovered' }
      ]
    }]
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('answer-equivalence Quality Gate rejects overlapping groups and invalid preferred entries', () => {
  const result = validateAnswerEquivalenceQualityGate({
    entries,
    groups: [
      ...groups,
      {
        answerEquivalenceGroupId: 'answer-group-invalid',
        entryIds: ['fixture-q002'],
        preferredEntryId: 'fixture-q999'
      }
    ],
    cases: []
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.code === 'ENTRY_IN_MULTIPLE_GROUPS'));
  assert.ok(result.errors.some(error => error.code === 'INVALID_PREFERRED_ENTRY_ID'));
});

test('answer-equivalence Quality Gate rejects inconsistent gold groups', () => {
  const result = validateAnswerEquivalenceQualityGate({
    entries,
    groups,
    cases: [{
      caseId: 'wrong-gold-group',
      expectedSystemOutcome: 'covered',
      expectedEntryId: 'fixture-q001',
      goldCoveredCandidateIds: ['fixture-q001'],
      goldCoveredAnswerEquivalenceGroupIds: ['answer-group-b']
    }]
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.code === 'GOLD_GROUPS_MISMATCH'));
});

test('answer-equivalence Quality Gate rejects false ambiguity inside one group', () => {
  const result = validateAnswerEquivalenceQualityGate({
    entries,
    groups,
    cases: [{
      caseId: 'false-ambiguity',
      expectedSystemOutcome: 'ambiguous',
      expectedEntryId: null,
      goldCoveredCandidateIds: ['fixture-q001', 'fixture-q002'],
      goldCoveredAnswerEquivalenceGroupIds: ['answer-group-a']
    }]
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.code === 'FALSE_AMBIGUOUS_SINGLE_GROUP'));
});

test('answer-equivalence Quality Gate rejects pair labels inconsistent with covered gold candidates', () => {
  const result = validateAnswerEquivalenceQualityGate({
    entries,
    groups,
    cases: [{
      caseId: 'wrong-pair-label',
      expectedSystemOutcome: 'covered',
      expectedEntryId: 'fixture-q001',
      goldCoveredCandidateIds: ['fixture-q001'],
      goldCoveredAnswerEquivalenceGroupIds: ['answer-group-a'],
      candidatePairs: [{
        candidateEntryId: 'fixture-q001',
        answerEquivalenceGroupId: 'answer-group-a',
        label: 'notCovered'
      }]
    }]
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.code === 'PAIR_LABEL_MISMATCH'));
});

test('protocol pre-registers equivalence aggregation and pending human review', () => {
  const protocol = readFileSync(join(HERE, 'task-specific-answerability-classifier-protocol.md'), 'utf8');
  for (const requiredText of [
    'answerEquivalenceGroupId',
    'preferredEntryId',
    'PENDING_HUMAN_REVIEW',
    'Reviewer A : Vivien',
    'Reviewer B : humain désigné ultérieurement',
    '**candidate-level**',
    '**group-level**',
    '**system-level**'
  ]) {
    assert.ok(protocol.includes(requiredText), `missing protocol clause: ${requiredText}`);
  }
});
