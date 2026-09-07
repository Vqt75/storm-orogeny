import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  buildStructuralReviewComparison,
  canonicalisePartition,
  EXPECTED_STRUCTURAL_REVIEW_CHECKPOINTS,
  STRUCTURAL_REVIEW_COMPARISON_STATUS,
  STRUCTURAL_REVIEW_COMPARISON_TYPE
} from './task-specific/human-review/structural-review-comparison.js';
import {
  DEFAULT_STRUCTURAL_REVIEW_COMPARISON_DIRECTORY,
  DEFAULT_STRUCTURAL_REVIEW_GENERATED_ROOT,
  materialiseStructuralReviewComparison
} from './task-specific/human-review/generate-structural-review-comparison.js';
import { canonicalJson, fingerprint } from './task-specific/human-review/review-packets.js';

const BASENAMES = [
  '01-equivalence-preferred',
  '02-knowledge-boundaries',
  '03-ambiguity-families',
  '04-scenario-family-preflight'
];

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function sealedSourcePaths() {
  return ['a', 'b'].flatMap(slot => [
    ...BASENAMES.map(basename => join(
      DEFAULT_STRUCTURAL_REVIEW_GENERATED_ROOT,
      'responses',
      `reviewer-${slot}`,
      `${basename}.fr.response-log.json`
    )),
    join(
      DEFAULT_STRUCTURAL_REVIEW_GENERATED_ROOT,
      'responses',
      `reviewer-${slot}`,
      'structural-reviewer-seal.json'
    )
  ]);
}

function findItem(matrix, canonicalReviewItemId) {
  return matrix.items.find(item => item.canonicalReviewItemId === canonicalReviewItemId);
}

function containsForbiddenDecisionField(value) {
  if (!value || typeof value !== 'object') return false;
  if (Object.keys(value).some(key => ['adjudicatedDecision', 'goldDecision', 'finalDecision'].includes(key))) return true;
  return Object.values(value).some(containsForbiddenDecisionField);
}

test('sealed A/B inputs build one deterministic canonical crosswalk', () => {
  const first = buildStructuralReviewComparison({ generatedRoot: DEFAULT_STRUCTURAL_REVIEW_GENERATED_ROOT });
  const second = buildStructuralReviewComparison({ generatedRoot: DEFAULT_STRUCTURAL_REVIEW_GENERATED_ROOT });

  assert.deepEqual(first, second);
  assert.equal(first.artifactType, STRUCTURAL_REVIEW_COMPARISON_TYPE);
  assert.equal(first.status, STRUCTURAL_REVIEW_COMPARISON_STATUS);
  assert.equal(first.generationAuthorized, false);
  assert.equal(first.adjudicationPerformed, false);
  assert.equal(first.sourceReviews.reviewerA.sealHash, EXPECTED_STRUCTURAL_REVIEW_CHECKPOINTS.A.sealHash);
  assert.equal(first.sourceReviews.reviewerB.sealHash, EXPECTED_STRUCTURAL_REVIEW_CHECKPOINTS.B.sealHash);
  assert.equal(first.sourceReviews.reviewerA.eventCount, 182);
  assert.equal(first.sourceReviews.reviewerB.eventCount, 164);
  assert.equal(first.sourceReviews.reviewerA.valid, true);
  assert.equal(first.sourceReviews.reviewerB.valid, true);
  assert.equal(first.items.length, 77);
  assert.equal(new Set(first.items.map(item => item.canonicalReviewItemId)).size, 77);
  assert.equal(first.summary.crosswalkUnresolved, 0);
  assert.equal(first.matrixFingerprint, fingerprint(Object.fromEntries(
    Object.entries(first).filter(([key]) => key !== 'matrixFingerprint')
  )));

  for (const item of first.items) {
    assert.equal(item.reviewerA.knowledgeRefMappings.every(mapping => mapping.entryId !== null), true);
    assert.equal(item.reviewerB.knowledgeRefMappings.every(mapping => mapping.entryId !== null), true);
    assert.deepEqual(
      item.reviewerA.knowledgeRefMappings.map(mapping => mapping.entryId).sort(),
      item.canonicalKnowledgeScope
    );
    assert.deepEqual(
      item.reviewerB.knowledgeRefMappings.map(mapping => mapping.entryId).sort(),
      item.canonicalKnowledgeScope
    );
  }
});

test('partition comparison is insensitive to element and group ordering', () => {
  const left = canonicalisePartition([
    ['equinoxe-q003', 'equinoxe-q001'],
    ['equinoxe-q004', 'equinoxe-q002']
  ]);
  const right = canonicalisePartition([
    ['equinoxe-q002', 'equinoxe-q004'],
    ['equinoxe-q001', 'equinoxe-q003']
  ]);
  assert.equal(canonicalJson(left), canonicalJson(right));
});

test('agreements and each requested divergence family are detected from normalized decisions', () => {
  const matrix = buildStructuralReviewComparison({ generatedRoot: DEFAULT_STRUCTURAL_REVIEW_GENERATED_ROOT });

  assert.equal(findItem(matrix, 'boundary-flex-telework').comparisonStatus, 'EXACT_AGREEMENT');
  assert.equal(findItem(matrix, 'boundary-arrival-preparation').comparisonStatus, 'DECISION_VALUE_DISAGREEMENT');
  assert.equal(findItem(matrix, 'boundary-rooms-focus').comparisonStatus, 'PARTITION_DISAGREEMENT');
  assert.equal(findItem(matrix, 'ambiguity-capacity-01').comparisonStatus, 'MECHANISM_DISAGREEMENT');
  assert.equal(findItem(matrix, 'equivalence-comparison-01').comparisonStatus, 'PREFERRED_SELECTION_DISAGREEMENT');
  assert.equal(
    findItem(matrix, 'ambiguity-capacity-03').comparisonFindings.some(
      finding => finding.status === 'CONDITIONAL_STRUCTURE_DISAGREEMENT'
    ),
    true
  );
  assert.deepEqual(matrix.summary, {
    totalItems: 77,
    firstLevelAgreements: 46,
    completeAgreements: 23,
    requiresAdjudication: 54,
    crosswalkUnresolved: 0,
    primaryComparisonStatuses: {
      DECISION_VALUE_DISAGREEMENT: 31,
      EXACT_AGREEMENT: 23,
      MECHANISM_DISAGREEMENT: 3,
      PARTITION_DISAGREEMENT: 15,
      PREFERRED_SELECTION_DISAGREEMENT: 5
    },
    findingStatuses: {
      CONDITIONAL_STRUCTURE_DISAGREEMENT: 19,
      DECISION_VALUE_DISAGREEMENT: 32,
      MECHANISM_DISAGREEMENT: 3,
      PARTITION_DISAGREEMENT: 31,
      PREFERRED_SELECTION_DISAGREEMENT: 5
    },
    byPacket: {
      AMBIGUITY_CAPACITY_FAMILIES: {
        totalItems: 34,
        firstLevelAgreements: 21,
        completeAgreements: 14,
        requiresAdjudication: 20,
        crosswalkUnresolved: 0,
        primaryComparisonStatuses: {
          DECISION_VALUE_DISAGREEMENT: 13,
          EXACT_AGREEMENT: 14,
          MECHANISM_DISAGREEMENT: 3,
          PARTITION_DISAGREEMENT: 4
        }
      },
      EQUIVALENCE_AND_PREFERRED: {
        totalItems: 5,
        firstLevelAgreements: 5,
        completeAgreements: 0,
        requiresAdjudication: 5,
        crosswalkUnresolved: 0,
        primaryComparisonStatuses: { PREFERRED_SELECTION_DISAGREEMENT: 5 }
      },
      KNOWLEDGE_BOUNDARIES: {
        totalItems: 4,
        firstLevelAgreements: 3,
        completeAgreements: 1,
        requiresAdjudication: 3,
        crosswalkUnresolved: 0,
        primaryComparisonStatuses: {
          DECISION_VALUE_DISAGREEMENT: 1,
          EXACT_AGREEMENT: 1,
          PARTITION_DISAGREEMENT: 2
        }
      },
      SCENARIO_FAMILY_PREFLIGHT: {
        totalItems: 34,
        firstLevelAgreements: 17,
        completeAgreements: 8,
        requiresAdjudication: 26,
        crosswalkUnresolved: 0,
        primaryComparisonStatuses: {
          DECISION_VALUE_DISAGREEMENT: 17,
          EXACT_AGREEMENT: 8,
          PARTITION_DISAGREEMENT: 9
        }
      }
    }
  });
});

test('comparison contains no adjudicated, gold, or final decision', () => {
  const matrix = buildStructuralReviewComparison({ generatedRoot: DEFAULT_STRUCTURAL_REVIEW_GENERATED_ROOT });
  assert.equal(containsForbiddenDecisionField(matrix), false);
  assert.equal(matrix.items.every(item => item.requiresAdjudication === !item.completeAgreement), true);
});

test('materialization is confined to comparison outputs and cannot modify sealed sources', () => {
  const sources = sealedSourcePaths();
  const before = Object.fromEntries(sources.map(path => [path, sha256(path)]));
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'storm-structural-comparison-'));
  try {
    const result = materialiseStructuralReviewComparison({
      generatedRoot: DEFAULT_STRUCTURAL_REVIEW_GENERATED_ROOT,
      outputDirectory: temporaryRoot
    });
    assert.equal(result.artifactCount, 2);
    assert.equal(result.generationAuthorized, false);
    assert.equal(readFileSync(join(temporaryRoot, 'reviewer-ab-comparison-matrix.json'), 'utf8').includes('adjudicatedDecision'), false);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
  const after = Object.fromEntries(sources.map(path => [path, sha256(path)]));
  assert.deepEqual(after, before);
});

test('versioned comparison artifacts are deterministic and current', () => {
  const result = materialiseStructuralReviewComparison({
    generatedRoot: DEFAULT_STRUCTURAL_REVIEW_GENERATED_ROOT,
    outputDirectory: DEFAULT_STRUCTURAL_REVIEW_COMPARISON_DIRECTORY,
    checkOnly: true
  });
  assert.equal(result.checkOnly, true);
  assert.equal(result.status, STRUCTURAL_REVIEW_COMPARISON_STATUS);
  assert.equal(result.generationAuthorized, false);
});
