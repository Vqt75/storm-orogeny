import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  ADJUDICATION_BATCH_01_ITEM_IDS,
  buildStructuralAdjudicationBatch01,
  DEFAULT_ADJUDICATION_BATCH_01_PATH,
  DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
  EXPECTED_COMPARISON_MATRIX_FINGERPRINT,
  materialiseStructuralAdjudicationBatch01,
  renderStructuralAdjudicationBatch01
} from './task-specific/human-review/generate-structural-adjudication-batch.js';

const RESPONSE_BASENAMES = [
  '01-equivalence-preferred.fr.response-log.json',
  '02-knowledge-boundaries.fr.response-log.json',
  '03-ambiguity-families.fr.response-log.json',
  '04-scenario-family-preflight.fr.response-log.json',
  'structural-reviewer-seal.json'
];

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function immutableSourcePaths() {
  return [
    ...['a', 'b'].flatMap(slot => RESPONSE_BASENAMES.map(filename => join(
      DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
      'responses',
      `reviewer-${slot}`,
      filename
    ))),
    join(
      DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
      'adjudication',
      'reviewer-ab-comparison-matrix.json'
    )
  ];
}

test('batch 01 contains exactly the eight requested canonical items', () => {
  const batch = buildStructuralAdjudicationBatch01();
  assert.equal(batch.itemCount, 8);
  assert.deepEqual(batch.items.map(item => item.sourceItemId), ADJUDICATION_BATCH_01_ITEM_IDS);
  assert.equal(batch.items.filter(item => item.packetKind === 'EQUIVALENCE_AND_PREFERRED').length, 5);
  assert.equal(batch.items.filter(item => item.packetKind === 'KNOWLEDGE_BOUNDARIES').length, 3);
  assert.equal(batch.items.some(item => item.packetKind.includes('AMBIGUITY')), false);
  assert.equal(batch.items.some(item => item.packetKind.includes('SCENARIO')), false);
});

test('batch 01 is read-only, pending and contains no adjudicated or gold fields', () => {
  const batch = buildStructuralAdjudicationBatch01();
  const serialised = JSON.stringify(batch);
  const rendered = renderStructuralAdjudicationBatch01(batch);
  assert.equal(batch.sourceMatrixFingerprint, EXPECTED_COMPARISON_MATRIX_FINGERPRINT);
  assert.equal(batch.status, 'PENDING_HUMAN_REVIEW');
  assert.equal(batch.generationAuthorized, false);
  assert.equal(batch.adjudicationPerformed, false);
  assert.doesNotMatch(serialised, /adjudicatedDecision|goldDecision|finalDecision/u);
  assert.doesNotMatch(rendered, /adjudicatedDecision|goldDecision|finalDecision/u);
  assert.equal(batch.items.every(item => item.knowledge.every(knowledge => knowledge.canonicalQuestion && knowledge.canonicalAnswer)), true);
});

test('batch 01 exposes partitions, preferred selections, full rationales and exact divergent fields', () => {
  const batch = buildStructuralAdjudicationBatch01();
  for (const item of batch.items) {
    assert.equal(item.fieldsRequiringAdjudication.length > 0, true);
    assert.equal(Object.keys(item.reviewerA.rationales).length > 0, true);
    assert.equal(Object.keys(item.reviewerB.rationales).length > 0, true);
    assert.notEqual(
      item.reviewerA.decisions.substantiveEquivalencePartition?.canonicalPartition
        ?? item.reviewerA.decisions.knowledgeComponentBoundary?.canonicalPartition,
      undefined
    );
    assert.notEqual(
      item.reviewerB.decisions.substantiveEquivalencePartition?.canonicalPartition
        ?? item.reviewerB.decisions.knowledgeComponentBoundary?.canonicalPartition,
      undefined
    );
  }
  const equivalence = batch.items.find(item => item.sourceItemId === 'equivalence-comparison-01');
  assert.equal(equivalence.reviewerA.decisions.preferredEntrySelection.preferredEntryId !== null, true);
  assert.equal(equivalence.reviewerB.decisions.preferredEntrySelection.preferredEntryId, null);
});

test('batch generation is deterministic and cannot modify sealed reviews or source matrix', () => {
  const first = renderStructuralAdjudicationBatch01(buildStructuralAdjudicationBatch01());
  const second = renderStructuralAdjudicationBatch01(buildStructuralAdjudicationBatch01());
  assert.equal(first, second);
  const sourcePaths = immutableSourcePaths();
  const before = Object.fromEntries(sourcePaths.map(path => [path, sha256(path)]));
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'storm-adjudication-batch-'));
  try {
    const outputPath = join(temporaryRoot, 'batch.md');
    const result = materialiseStructuralAdjudicationBatch01({ outputPath });
    assert.equal(result.itemCount, 8);
    assert.equal(readFileSync(outputPath, 'utf8'), first);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
  const after = Object.fromEntries(sourcePaths.map(path => [path, sha256(path)]));
  assert.deepEqual(after, before);
});

test('versioned batch is deterministic and current', () => {
  const result = materialiseStructuralAdjudicationBatch01({
    outputPath: DEFAULT_ADJUDICATION_BATCH_01_PATH,
    checkOnly: true
  });
  assert.equal(result.checkOnly, true);
  assert.equal(result.itemCount, 8);
  assert.equal(result.generationAuthorized, false);
});
