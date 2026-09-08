import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  ADJUDICATION_BATCH_01_ITEM_IDS,
  ADJUDICATION_BATCH_02_ITEM_IDS,
  ADJUDICATION_BATCH_03_ITEM_IDS,
  ADJUDICATION_BATCH_04_ITEM_IDS,
  buildStructuralAdjudicationBatch01,
  buildStructuralAdjudicationBatch02,
  buildStructuralAdjudicationBatch03,
  buildStructuralAdjudicationBatch04,
  DEFAULT_ADJUDICATION_BATCH_01_PATH,
  DEFAULT_ADJUDICATION_BATCH_02_PATH,
  DEFAULT_ADJUDICATION_BATCH_03_PATH,
  DEFAULT_ADJUDICATION_BATCH_04_PATH,
  DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
  EXPECTED_COMPARISON_MATRIX_FINGERPRINT,
  materialiseStructuralAdjudicationBatch01,
  materialiseStructuralAdjudicationBatch02,
  materialiseStructuralAdjudicationBatch03,
  materialiseStructuralAdjudicationBatch04,
  renderStructuralAdjudicationBatch01,
  renderStructuralAdjudicationBatch02,
  renderStructuralAdjudicationBatch03,
  renderStructuralAdjudicationBatch04
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

function batch01ArtifactPaths() {
  return [
    DEFAULT_ADJUDICATION_BATCH_01_PATH,
    join(
      DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
      'adjudication',
      'records',
      'adjudication-batch-01-equivalence-boundaries.human-adjudication-log.json'
    ),
    join(
      DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
      'adjudication',
      'records',
      'adjudication-batch-01-equivalence-boundaries.human-adjudication-seal.json'
    )
  ];
}

function batch02ArtifactPaths() {
  return [
    DEFAULT_ADJUDICATION_BATCH_02_PATH,
    join(
      DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
      'adjudication',
      'records',
      'adjudication-batch-02-ambiguities-01.human-adjudication-log.json'
    ),
    join(
      DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
      'adjudication',
      'records',
      'adjudication-batch-02-ambiguities-01.human-adjudication-seal.json'
    )
  ];
}

function batch03ArtifactPaths() {
  return [
    DEFAULT_ADJUDICATION_BATCH_03_PATH,
    join(
      DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
      'adjudication',
      'records',
      'adjudication-batch-03-ambiguities-02.human-adjudication-log.json'
    ),
    join(
      DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
      'adjudication',
      'records',
      'adjudication-batch-03-ambiguities-02.human-adjudication-seal.json'
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

test('batch 02 contains exactly the ten requested ambiguity items and no scenario family', () => {
  const batch = buildStructuralAdjudicationBatch02();
  assert.equal(batch.itemCount, 10);
  assert.deepEqual(batch.items.map(item => item.sourceItemId), ADJUDICATION_BATCH_02_ITEM_IDS);
  assert.equal(batch.items.every(item => item.packetKind === 'AMBIGUITY_CAPACITY_FAMILIES'), true);
  assert.equal(batch.items.every(item => item.sourceFamily.scenarioFamilyId === null), true);
  assert.equal(batch.items.every(item => item.sourceItemId.startsWith('ambiguity-capacity-')), true);
  assert.equal(batch.items.some(item => item.packetKind.includes('SCENARIO')), false);
});

test('batch 02 remains pending and contains no adjudication event or prefilled decision', () => {
  const batch = buildStructuralAdjudicationBatch02();
  const serialised = JSON.stringify(batch);
  const rendered = renderStructuralAdjudicationBatch02(batch);
  assert.equal(batch.sourceMatrixFingerprint, EXPECTED_COMPARISON_MATRIX_FINGERPRINT);
  assert.equal(batch.status, 'PENDING_HUMAN_REVIEW');
  assert.equal(batch.generationAuthorized, false);
  assert.equal(batch.adjudicationPerformed, false);
  assert.equal(batch.items.every(item => Object.values(item.humanDecision).every(value => value === 'PENDING')), true);
  assert.doesNotMatch(serialised, /eventHash|recordedAt|provenance|goldDecision|finalDecision/u);
  assert.equal((rendered.match(/^HUMAN_ADJUDICATION:$/gmu) ?? []).length, 10);
  assert.equal((rendered.match(/^decision: PENDING$/gmu) ?? []).length, 10);
  assert.equal((rendered.match(/^rationale: PENDING$/gmu) ?? []).length, 10);
  assert.equal((rendered.match(/^future_rule: PENDING$/gmu) ?? []).length, 10);
});

test('batch 02 exposes source context, exact matrix findings, crosswalk and only relevant Q&A', () => {
  const batch = buildStructuralAdjudicationBatch02();
  for (const item of batch.items) {
    assert.equal(item.sourceFamily.title.length > 0, true);
    assert.equal(item.sourceFamily.businessContext.length > 0, true);
    assert.equal(item.knowledge.length > 0, true);
    assert.equal(item.knowledge.every(knowledge => knowledge.entryId && knowledge.canonicalQuestion && knowledge.canonicalAnswer), true);
    assert.equal(item.comparison.findings.length > 0, true);
    assert.equal(item.comparison.completeAgreement, false);
    assert.equal(item.comparison.crosswalk.reviewerA.knowledgeRefMappings.length, item.knowledge.length);
    assert.equal(item.comparison.crosswalk.reviewerB.knowledgeRefMappings.length, item.knowledge.length);
  }
  const batch01Log = JSON.parse(readFileSync(batch01ArtifactPaths()[1], 'utf8'));
  const batch02EntryIds = new Set(batch.items.flatMap(item => item.knowledge.map(knowledge => knowledge.entryId)));
  const sealedEquivalenceEntryIds = new Set(batch01Log.events
    .filter(event => event.sourceItemId.startsWith('equivalence-comparison-'))
    .flatMap(event => event.decision.substantiveEquivalencePartition.canonicalPartition.flat()));
  assert.deepEqual([...batch02EntryIds].filter(entryId => sealedEquivalenceEntryIds.has(entryId)), []);
});

test('batch 02 generation is deterministic and cannot modify A, B, matrix or Batch 01', () => {
  const first = renderStructuralAdjudicationBatch02(buildStructuralAdjudicationBatch02());
  const second = renderStructuralAdjudicationBatch02(buildStructuralAdjudicationBatch02());
  assert.equal(first, second);
  const sourcePaths = [...immutableSourcePaths(), ...batch01ArtifactPaths()];
  const before = Object.fromEntries(sourcePaths.map(path => [path, sha256(path)]));
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'storm-adjudication-batch-02-'));
  try {
    const outputPath = join(temporaryRoot, 'batch.md');
    const result = materialiseStructuralAdjudicationBatch02({ outputPath });
    assert.equal(result.itemCount, 10);
    assert.equal(readFileSync(outputPath, 'utf8'), first);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
  const after = Object.fromEntries(sourcePaths.map(path => [path, sha256(path)]));
  assert.deepEqual(after, before);
});

test('versioned batch 02 is deterministic and current', () => {
  const result = materialiseStructuralAdjudicationBatch02({
    outputPath: DEFAULT_ADJUDICATION_BATCH_02_PATH,
    checkOnly: true
  });
  assert.equal(result.checkOnly, true);
  assert.equal(result.itemCount, 10);
  assert.equal(result.generationAuthorized, false);
});

test('batch 03 contains exactly the ten requested remaining ambiguity items and no scenario family', () => {
  const batch = buildStructuralAdjudicationBatch03();
  assert.equal(batch.itemCount, 10);
  assert.deepEqual(batch.items.map(item => item.sourceItemId), ADJUDICATION_BATCH_03_ITEM_IDS);
  assert.equal(batch.items.every(item => item.packetKind === 'AMBIGUITY_CAPACITY_FAMILIES'), true);
  assert.equal(batch.items.every(item => item.sourceFamily.scenarioFamilyId === null), true);
  assert.equal(batch.items.every(item => item.sourceItemId.startsWith('ambiguity-capacity-')), true);
  assert.equal(batch.items.some(item => item.packetKind.includes('SCENARIO')), false);
});

test('batch 03 remains pending and contains no adjudication event or prefilled decision', () => {
  const batch = buildStructuralAdjudicationBatch03();
  const serialised = JSON.stringify(batch);
  const rendered = renderStructuralAdjudicationBatch03(batch);
  assert.equal(batch.sourceMatrixFingerprint, EXPECTED_COMPARISON_MATRIX_FINGERPRINT);
  assert.equal(batch.status, 'PENDING_HUMAN_REVIEW');
  assert.equal(batch.generationAuthorized, false);
  assert.equal(batch.adjudicationPerformed, false);
  assert.equal(batch.items.every(item => Object.values(item.humanDecision).every(value => value === 'PENDING')), true);
  assert.doesNotMatch(serialised, /eventHash|recordedAt|provenance|goldDecision|finalDecision/u);
  assert.doesNotMatch(rendered, /^HUMAN_ADJUDICATION:$/gmu);
  assert.equal((rendered.match(/^generated user formulation: NOT AVAILABLE$/gmu) ?? []).length, 10);
  assert.equal((rendered.match(/^decision: PENDING$/gmu) ?? []).length, 10);
  assert.equal((rendered.match(/^rationale: PENDING$/gmu) ?? []).length, 10);
  assert.equal((rendered.match(/^future_rule: PENDING$/gmu) ?? []).length, 10);
});

test('batch 03 exposes source context, exact comparison, crosswalk, Q&A and relevant sealed equivalence only', () => {
  const batch = buildStructuralAdjudicationBatch03();
  for (const item of batch.items) {
    assert.equal(item.sourceFamily.title.length > 0, true);
    assert.equal(item.sourceFamily.businessContext.length > 0, true);
    assert.equal(item.knowledge.length > 0, true);
    assert.equal(item.knowledge.every(knowledge => knowledge.entryId && knowledge.canonicalQuestion && knowledge.canonicalAnswer), true);
    assert.equal(item.comparison.findings.length > 0, true);
    assert.equal(item.comparison.completeAgreement, false);
    assert.equal(item.comparison.crosswalk.reviewerA.knowledgeRefMappings.length, item.knowledge.length);
    assert.equal(item.comparison.crosswalk.reviewerB.knowledgeRefMappings.length, item.knowledge.length);
  }
  const equivalenceByEntryId = new Map(batch.items
    .flatMap(item => item.knowledge)
    .filter(knowledge => knowledge.sealedEquivalence !== null)
    .map(knowledge => [knowledge.entryId, knowledge.sealedEquivalence]));
  assert.deepEqual([...equivalenceByEntryId.keys()].sort(), [
    'equinoxe-q019',
    'equinoxe-q053',
    'equinoxe-q078',
    'equinoxe-q085'
  ]);
  assert.deepEqual(equivalenceByEntryId.get('equinoxe-q019'), {
    memberEntryIds: ['equinoxe-q019', 'equinoxe-q053'],
    preferredEntryId: 'equinoxe-q019'
  });
  assert.deepEqual(equivalenceByEntryId.get('equinoxe-q078'), {
    memberEntryIds: ['equinoxe-q078', 'equinoxe-q085'],
    preferredEntryId: 'equinoxe-q078'
  });
});

test('batch 03 generation is deterministic and cannot modify A, B, matrix or sealed Batches 01/02', () => {
  const first = renderStructuralAdjudicationBatch03(buildStructuralAdjudicationBatch03());
  const second = renderStructuralAdjudicationBatch03(buildStructuralAdjudicationBatch03());
  assert.equal(first, second);
  const sourcePaths = [...immutableSourcePaths(), ...batch01ArtifactPaths(), ...batch02ArtifactPaths()];
  const before = Object.fromEntries(sourcePaths.map(path => [path, sha256(path)]));
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'storm-adjudication-batch-03-'));
  try {
    const outputPath = join(temporaryRoot, 'batch.md');
    const result = materialiseStructuralAdjudicationBatch03({ outputPath });
    assert.equal(result.itemCount, 10);
    assert.equal(readFileSync(outputPath, 'utf8'), first);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
  const after = Object.fromEntries(sourcePaths.map(path => [path, sha256(path)]));
  assert.deepEqual(after, before);
});

test('versioned batch 03 is deterministic and current', () => {
  const result = materialiseStructuralAdjudicationBatch03({
    outputPath: DEFAULT_ADJUDICATION_BATCH_03_PATH,
    checkOnly: true
  });
  assert.equal(result.checkOnly, true);
  assert.equal(result.itemCount, 10);
  assert.equal(result.generationAuthorized, false);
});

test('batch 04 contains exactly the first ten requested scenario-family items and no ambiguity item', () => {
  const batch = buildStructuralAdjudicationBatch04();
  assert.equal(batch.itemCount, 10);
  assert.deepEqual(batch.items.map(item => item.sourceItemId), ADJUDICATION_BATCH_04_ITEM_IDS);
  assert.equal(batch.items.every(item => item.packetKind === 'SCENARIO_FAMILY_PREFLIGHT'), true);
  assert.equal(batch.items.every(item => item.sourceFamily.scenarioFamilyId === null), true);
  assert.equal(batch.items.every(item => item.sourceItemId.startsWith('scenario-family-preflight-')), true);
  assert.equal(batch.items.some(item => item.packetKind.includes('AMBIGUITY')), false);
});

test('batch 04 remains pending and contains no adjudication event, generated formulation or prefilled decision', () => {
  const batch = buildStructuralAdjudicationBatch04();
  const serialised = JSON.stringify(batch);
  const rendered = renderStructuralAdjudicationBatch04(batch);
  assert.equal(batch.sourceMatrixFingerprint, EXPECTED_COMPARISON_MATRIX_FINGERPRINT);
  assert.equal(batch.status, 'PENDING_HUMAN_REVIEW');
  assert.equal(batch.generationAuthorized, false);
  assert.equal(batch.adjudicationPerformed, false);
  assert.equal(batch.items.every(item => Object.values(item.humanDecision).every(value => value === 'PENDING')), true);
  assert.equal(batch.items.every(item => item.knowledge.every(knowledge => knowledge.scenarioFamilyId === null)), true);
  assert.doesNotMatch(serialised, /eventHash|recordedAt|provenance|goldDecision|finalDecision/u);
  assert.doesNotMatch(rendered, /^HUMAN_ADJUDICATION:$/gmu);
  assert.equal((rendered.match(/^generated user formulation: NOT AVAILABLE$/gmu) ?? []).length, 10);
  assert.equal((rendered.match(/^decision: PENDING$/gmu) ?? []).length, 10);
  assert.equal((rendered.match(/^rationale: PENDING$/gmu) ?? []).length, 10);
  assert.equal((rendered.match(/^future_rule: PENDING$/gmu) ?? []).length, 10);
});

test('batch 04 exposes exact reviewer structure, comparison, merge candidates, crosswalk and Q&A', () => {
  const batch = buildStructuralAdjudicationBatch04();
  for (const item of batch.items) {
    assert.equal(item.sourceFamily.title.length > 0, true);
    assert.equal(item.sourceFamily.businessContext.length > 0, true);
    assert.equal(item.knowledge.length > 0, true);
    assert.equal(item.knowledge.every(knowledge => knowledge.entryId && knowledge.canonicalQuestion && knowledge.canonicalAnswer), true);
    assert.equal(item.comparison.findings.length > 0, true);
    assert.equal(item.comparison.completeAgreement, false);
    assert.equal(item.comparison.crosswalk.reviewerA.knowledgeRefMappings.length, item.knowledge.length);
    assert.equal(item.comparison.crosswalk.reviewerB.knowledgeRefMappings.length, item.knowledge.length);
    assert.equal(Array.isArray(item.reviewerA.decisions.fragmentationAssessment.mergeCanonicalReviewItemIds), true);
    assert.equal(Array.isArray(item.reviewerB.decisions.fragmentationAssessment.mergeCanonicalReviewItemIds), true);
  }
  const item08 = batch.items.find(item => item.sourceItemId === 'scenario-family-preflight-08');
  const q066 = item08.knowledge.find(knowledge => knowledge.entryId === 'equinoxe-q066');
  assert.deepEqual(q066.sealedEquivalence, {
    memberEntryIds: ['equinoxe-q066', 'equinoxe-q069'],
    preferredEntryId: 'equinoxe-q069'
  });
});

test('batch 04 includes only sealed adjudication contexts that directly overlap the candidate q-ids', () => {
  const batch = buildStructuralAdjudicationBatch04();
  const contextsByItem = Object.fromEntries(batch.items.map(item => [
    item.sourceItemId,
    item.existingAdjudicationContext.map(context => context.sourceItemId)
  ]));
  assert.deepEqual(contextsByItem, {
    'scenario-family-preflight-02': [],
    'scenario-family-preflight-03': ['ambiguity-capacity-03'],
    'scenario-family-preflight-04': [],
    'scenario-family-preflight-05': ['ambiguity-capacity-05'],
    'scenario-family-preflight-06': ['ambiguity-capacity-06'],
    'scenario-family-preflight-07': ['boundary-arrival-preparation', 'ambiguity-capacity-07'],
    'scenario-family-preflight-08': ['equivalence-comparison-04'],
    'scenario-family-preflight-09': ['ambiguity-capacity-11', 'ambiguity-capacity-14'],
    'scenario-family-preflight-10': ['ambiguity-capacity-10', 'ambiguity-capacity-11'],
    'scenario-family-preflight-13': ['ambiguity-capacity-13']
  });
  for (const item of batch.items) {
    const itemEntryIds = new Set(item.knowledge.map(knowledge => knowledge.entryId));
    for (const context of item.existingAdjudicationContext) {
      assert.equal(context.affectedEntryIds.length > 0, true);
      assert.equal(context.affectedEntryIds.every(entryId => itemEntryIds.has(entryId)), true);
    }
  }
});

test('batch 04 generation is deterministic and cannot modify sealed sources or Batches 01/02/03', () => {
  const first = renderStructuralAdjudicationBatch04(buildStructuralAdjudicationBatch04());
  const second = renderStructuralAdjudicationBatch04(buildStructuralAdjudicationBatch04());
  assert.equal(first, second);
  const sourcePaths = [
    ...immutableSourcePaths(),
    ...batch01ArtifactPaths(),
    ...batch02ArtifactPaths(),
    ...batch03ArtifactPaths()
  ];
  const before = Object.fromEntries(sourcePaths.map(path => [path, sha256(path)]));
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'storm-adjudication-batch-04-'));
  try {
    const outputPath = join(temporaryRoot, 'batch.md');
    const result = materialiseStructuralAdjudicationBatch04({ outputPath });
    assert.equal(result.itemCount, 10);
    assert.equal(readFileSync(outputPath, 'utf8'), first);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
  const after = Object.fromEntries(sourcePaths.map(path => [path, sha256(path)]));
  assert.deepEqual(after, before);
});

test('versioned batch 04 is deterministic and current', () => {
  const result = materialiseStructuralAdjudicationBatch04({
    outputPath: DEFAULT_ADJUDICATION_BATCH_04_PATH,
    checkOnly: true
  });
  assert.equal(result.checkOnly, true);
  assert.equal(result.itemCount, 10);
  assert.equal(result.generationAuthorized, false);
});
