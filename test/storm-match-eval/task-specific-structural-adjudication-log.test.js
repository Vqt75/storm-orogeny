import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  ADJUDICATION_BATCH_01_ITEM_IDS,
  ADJUDICATION_BATCH_02_ITEM_IDS,
  ADJUDICATION_BATCH_03_ITEM_IDS,
  DEFAULT_ADJUDICATION_BATCH_01_PATH,
  DEFAULT_ADJUDICATION_BATCH_02_PATH,
  DEFAULT_ADJUDICATION_BATCH_03_PATH,
  DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
  EXPECTED_COMPARISON_MATRIX_FINGERPRINT
} from './task-specific/human-review/generate-structural-adjudication-batch.js';
import {
  buildStructuralAdjudicationBatch01Log,
  DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_01_LOG_PATH,
  materialiseStructuralAdjudicationBatch01Log,
  STRUCTURAL_ADJUDICATION_BATCH_01_EVENTS
} from './task-specific/human-review/record-structural-adjudication-batch-01.js';
import {
  buildStructuralAdjudicationBatch02Log,
  DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_02_LOG_PATH,
  materialiseStructuralAdjudicationBatch02Log,
  STRUCTURAL_ADJUDICATION_BATCH_02_EVENTS,
  STRUCTURAL_ADJUDICATION_BATCH_02_RECORDED_AT
} from './task-specific/human-review/record-structural-adjudication-batch-02.js';
import {
  buildStructuralAdjudicationBatch03Log,
  DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_03_LOG_PATH,
  materialiseStructuralAdjudicationBatch03Log,
  STRUCTURAL_ADJUDICATION_BATCH_03_EVENTS,
  STRUCTURAL_ADJUDICATION_BATCH_03_RECORDED_AT
} from './task-specific/human-review/record-structural-adjudication-batch-03.js';
import {
  canonicaliseAdjudicatedPartition,
  constructStructuralAdjudicationLogWithEvent,
  createEmptyStructuralAdjudicationLog,
  evaluateStructuralAdjudicationCompleteness,
  HUMAN_ADJUDICATION_PROVENANCE,
  structuralAdjudicationSealPathForJournal,
  validateStructuralAdjudicationLog
} from './task-specific/human-review/structural-adjudication-log.js';
import { canonicalJson } from './task-specific/human-review/review-packets.js';

const RESPONSE_FILENAMES = [
  '01-equivalence-preferred.fr.response-log.json',
  '02-knowledge-boundaries.fr.response-log.json',
  '03-ambiguity-families.fr.response-log.json',
  '04-scenario-family-preflight.fr.response-log.json',
  'structural-reviewer-seal.json'
];

const EXPECTED_PREFERRED_ENTRIES = Object.freeze({
  'equivalence-comparison-01': 'equinoxe-q002',
  'equivalence-comparison-02': 'equinoxe-q019',
  'equivalence-comparison-03': 'equinoxe-q050',
  'equivalence-comparison-04': 'equinoxe-q069',
  'equivalence-comparison-05': 'equinoxe-q078'
});

const EXPECTED_BOUNDARY_PARTITIONS = Object.freeze({
  'boundary-arrival-preparation': [
    { componentId: 'ARRIVAL', memberEntryIds: ['equinoxe-q001', 'equinoxe-q002', 'equinoxe-q009'] },
    { componentId: 'PREPARATION', memberEntryIds: ['equinoxe-q004', 'equinoxe-q005', 'equinoxe-q007', 'equinoxe-q108'] },
    { componentId: 'CALENDAR_STABILITY', memberEntryIds: ['equinoxe-q003'] }
  ],
  'boundary-communication-pilot': [
    { componentId: 'EXPERIMENT_FEEDBACK', memberEntryIds: ['equinoxe-q006', 'equinoxe-q079', 'equinoxe-q110', 'equinoxe-q111', 'equinoxe-q112'] },
    { componentId: 'INFO_QUESTIONS', memberEntryIds: ['equinoxe-q008', 'equinoxe-q078', 'equinoxe-q085'] },
    { componentId: 'AMBASSADORS_CONTACTS', memberEntryIds: ['equinoxe-q077', 'equinoxe-q083', 'equinoxe-q106', 'equinoxe-q107'] }
  ],
  'boundary-rooms-focus': [
    { componentId: 'MEETING_ROOMS', memberEntryIds: ['equinoxe-q019', 'equinoxe-q028', 'equinoxe-q053', 'equinoxe-q089'] },
    { componentId: 'PROJECT_ROOMS', memberEntryIds: ['equinoxe-q022', 'equinoxe-q031', 'equinoxe-q052', 'equinoxe-q090'] },
    { componentId: 'BUBBLES', memberEntryIds: ['equinoxe-q023', 'equinoxe-q027'] },
    { componentId: 'FORUM', memberEntryIds: ['equinoxe-q024', 'equinoxe-q029', 'equinoxe-q105'] },
    { componentId: 'FOCUS_LIBRARY', memberEntryIds: ['equinoxe-q020', 'equinoxe-q025', 'equinoxe-q026', 'equinoxe-q091'] },
    { componentId: 'CONFIDENTIALITY', memberEntryIds: ['equinoxe-q050', 'equinoxe-q051', 'equinoxe-q099'] }
  ]
});

const EXPECTED_BATCH_02_CLASSIFICATIONS = Object.freeze({
  'ambiguity-capacity-01': ['structuralAmbiguity', 'underspecifiedReference'],
  'ambiguity-capacity-03': ['artificialOrMalformed', null],
  'ambiguity-capacity-05': ['blockedTemporalInstability', null],
  'ambiguity-capacity-06': ['structuralAmbiguity', 'underspecifiedReference'],
  'ambiguity-capacity-07': ['structuralAmbiguity', 'underspecifiedReference'],
  'ambiguity-capacity-10': ['artificialOrMalformed', null],
  'ambiguity-capacity-11': ['structuralAmbiguity', 'alternativeIntentReadings'],
  'ambiguity-capacity-13': ['blockedTemporalInstability', null],
  'ambiguity-capacity-14': ['artificialOrMalformed', null],
  'ambiguity-capacity-16': ['structuralAmbiguity', 'alternativeIntentReadings']
});

const EXPECTED_BATCH_03_CLASSIFICATIONS = Object.freeze({
  'ambiguity-capacity-17': ['artificialOrMalformed', null],
  'ambiguity-capacity-18': ['structuralAmbiguity', 'alternativeIntentReadings'],
  'ambiguity-capacity-19': ['artificialOrMalformed', null],
  'ambiguity-capacity-20': ['artificialOrMalformed', null],
  'ambiguity-capacity-21': ['artificialOrMalformed', null],
  'ambiguity-capacity-22': ['artificialOrMalformed', null],
  'ambiguity-capacity-25': ['structuralAmbiguity', 'alternativeIntentReadings'],
  'ambiguity-capacity-29': ['artificialOrMalformed', null],
  'ambiguity-capacity-30': ['structuralAmbiguity', 'alternativeIntentReadings'],
  'ambiguity-capacity-33': ['artificialOrMalformed', null]
});

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function immutableSourcePaths() {
  return [
    ...['a', 'b'].flatMap(slot => RESPONSE_FILENAMES.map(filename => join(
      DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
      'responses',
      `reviewer-${slot}`,
      filename
    ))),
    join(DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT, 'adjudication', 'reviewer-ab-comparison-matrix.json')
  ];
}

function priorBatchArtifactPaths() {
  return [
    DEFAULT_ADJUDICATION_BATCH_01_PATH,
    DEFAULT_ADJUDICATION_BATCH_02_PATH,
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
    ),
    DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_02_LOG_PATH,
    join(
      DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
      'adjudication',
      'records',
      'adjudication-batch-02-ambiguities-01.human-adjudication-seal.json'
    )
  ];
}

function loadMatrix() {
  return JSON.parse(readFileSync(join(
    DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
    'adjudication',
    'reviewer-ab-comparison-matrix.json'
  ), 'utf8'));
}

test('batch 01 transcription is one valid eight-event HUMAN_ADJUDICATION chain', () => {
  const matrix = loadMatrix();
  const log = buildStructuralAdjudicationBatch01Log();
  const validation = validateStructuralAdjudicationLog(log, matrix);
  assert.equal(validation.ok, true);
  assert.equal(validation.eventCount, 8);
  assert.deepEqual(log.events.map(event => event.sourceItemId), ADJUDICATION_BATCH_01_ITEM_IDS);
  assert.equal(log.events.every(event => event.provenance === HUMAN_ADJUDICATION_PROVENANCE), true);
  assert.equal(log.sourceMatrixFingerprint, EXPECTED_COMPARISON_MATRIX_FINGERPRINT);
  assert.equal(log.status, 'PENDING_HUMAN_REVIEW');
  assert.equal(log.generationAuthorized, false);
  assert.equal(log.appendOnly, true);
});

test('the five adjudicated preferred selections are transcribed exactly', () => {
  const log = buildStructuralAdjudicationBatch01Log();
  const actual = Object.fromEntries(log.events
    .filter(event => event.sourceItemId.startsWith('equivalence-comparison-'))
    .map(event => [event.sourceItemId, event.decision.preferredEntrySelection.preferredEntryId]));
  assert.deepEqual(actual, EXPECTED_PREFERRED_ENTRIES);
  for (const event of log.events.filter(item => item.sourceItemId.startsWith('equivalence-comparison-'))) {
    assert.equal(event.decision.substantiveEquivalencePartition.value, 'oneEquivalentGroup');
    assert.equal(event.decision.preferredEntrySelection.value, 'chooseOneDisplayedKnowledgeRef');
  }
});

test('the three adjudicated boundary partitions match order-insensitively', () => {
  const log = buildStructuralAdjudicationBatch01Log();
  for (const [sourceItemId, expected] of Object.entries(EXPECTED_BOUNDARY_PARTITIONS)) {
    const event = log.events.find(item => item.sourceItemId === sourceItemId);
    assert.equal(event.decision.knowledgeComponentBoundary.value, 'partitionRequired');
    assert.equal(
      canonicalJson(canonicaliseAdjudicatedPartition(event.decision.knowledgeComponentBoundary.canonicalPartition)),
      canonicalJson(canonicaliseAdjudicatedPartition(expected))
    );
  }
});

test('structural adjudication rejects mutation, duplication and non-human provenance', () => {
  const matrix = loadMatrix();
  const log = buildStructuralAdjudicationBatch01Log();
  const tampered = structuredClone(log);
  tampered.events[0].decision.preferredEntrySelection.preferredEntryId = 'equinoxe-q001';
  assert.equal(validateStructuralAdjudicationLog(tampered, matrix).ok, false);
  assert.throws(() => constructStructuralAdjudicationLogWithEvent(log, {
    eventId: 'adjudication-batch-01-event-009',
    sourceItemId: ADJUDICATION_BATCH_01_ITEM_IDS[0],
    decision: STRUCTURAL_ADJUDICATION_BATCH_01_EVENTS[0].decision,
    humanRationale: 'Duplicate must fail.',
    recordedAt: '2026-09-07T15:20:25.766Z',
    provenance: HUMAN_ADJUDICATION_PROVENANCE
  }, matrix), /Duplicate structural adjudication sourceItemId/u);
  assert.throws(() => constructStructuralAdjudicationLogWithEvent(log, {
    eventId: 'adjudication-batch-01-event-009',
    sourceItemId: 'ambiguity-capacity-01',
    decision: STRUCTURAL_ADJUDICATION_BATCH_01_EVENTS[0].decision,
    humanRationale: 'Outside batch must fail.',
    recordedAt: '2026-09-07T15:20:25.766Z',
    provenance: 'AUTOMATED'
  }, matrix), /provenance must be HUMAN_ADJUDICATION/u);
});

test('materialization is deterministic and never mutates A, B or the source matrix', () => {
  const sourcePaths = immutableSourcePaths();
  const before = Object.fromEntries(sourcePaths.map(path => [path, sha256(path)]));
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'storm-structural-adjudication-'));
  try {
    const outputPath = join(temporaryRoot, 'log.json');
    const first = materialiseStructuralAdjudicationBatch01Log({ outputPath });
    const firstContent = readFileSync(outputPath, 'utf8');
    const second = materialiseStructuralAdjudicationBatch01Log({ outputPath });
    assert.deepEqual(second, first);
    assert.equal(readFileSync(outputPath, 'utf8'), firstContent);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
  const after = Object.fromEntries(sourcePaths.map(path => [path, sha256(path)]));
  assert.deepEqual(after, before);
});

test('the adjudication layer contains no implicit gold and the versioned log is current', () => {
  const log = buildStructuralAdjudicationBatch01Log();
  assert.doesNotMatch(JSON.stringify(log), /goldDecision|goldOutcome|generationAuthorized[^:]*:\s*true/u);
  const result = materialiseStructuralAdjudicationBatch01Log({
    outputPath: DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_01_LOG_PATH,
    checkOnly: true
  });
  assert.equal(result.checkOnly, true);
  assert.equal(result.eventCount, 8);
  assert.equal(result.generationAuthorized, false);
  assert.equal(result.status, 'PENDING_HUMAN_REVIEW');
});

test('batch 02 transcription is one valid complete ten-event HUMAN_ADJUDICATION chain', () => {
  const matrix = loadMatrix();
  const log = buildStructuralAdjudicationBatch02Log();
  const validation = validateStructuralAdjudicationLog(log, matrix);
  const completeness = evaluateStructuralAdjudicationCompleteness(log, matrix);
  assert.equal(validation.ok, true);
  assert.equal(validation.eventCount, 10);
  assert.equal(completeness.complete, true);
  assert.deepEqual(completeness.missingSourceItemIds, []);
  assert.deepEqual(log.events.map(event => event.sourceItemId), ADJUDICATION_BATCH_02_ITEM_IDS);
  assert.equal(log.events.every(event => event.provenance === HUMAN_ADJUDICATION_PROVENANCE), true);
  assert.equal(log.events.every(event => event.recordedAt === STRUCTURAL_ADJUDICATION_BATCH_02_RECORDED_AT), true);
  assert.equal(log.sourceMatrixFingerprint, EXPECTED_COMPARISON_MATRIX_FINGERPRINT);
  assert.equal(log.status, 'PENDING_HUMAN_REVIEW');
  assert.equal(log.generationAuthorized, false);
  assert.equal(log.appendOnly, true);
});

test('batch 02 effective ambiguity decisions, rationales and future rules are transcribed exactly', () => {
  const log = buildStructuralAdjudicationBatch02Log();
  const byId = new Map(log.events.map(event => [event.sourceItemId, event]));
  for (const source of STRUCTURAL_ADJUDICATION_BATCH_02_EVENTS) {
    const event = byId.get(source.sourceItemId);
    const expected = EXPECTED_BATCH_02_CLASSIFICATIONS[source.sourceItemId];
    assert.equal(event.decision.ambiguityFamilyDisposition.value, expected[0]);
    assert.equal(event.decision.ambiguityMechanism.value, expected[1]);
    assert.equal(canonicalJson(event.decision), canonicalJson(source.decision));
    assert.equal(event.humanRationale, source.humanRationale);
    assert.equal(event.futureRule, source.futureRule);
  }
  assert.deepEqual(byId.get('ambiguity-capacity-07').decision.substantiallyDifferentCoveredGroups.canonicalPartition, [
    ['equinoxe-q003'],
    ['equinoxe-q004', 'equinoxe-q005', 'equinoxe-q007', 'equinoxe-q108']
  ]);
  assert.deepEqual(byId.get('ambiguity-capacity-16').decision.substantiallyDifferentCoveredGroups.canonicalPartition, [
    ['equinoxe-q040', 'equinoxe-q042', 'equinoxe-q043'],
    ['equinoxe-q044']
  ]);
});

test('batch 02 rejects missing future rule, invalid mutation, duplication and automated provenance', () => {
  const matrix = loadMatrix();
  const completeLog = buildStructuralAdjudicationBatch02Log();
  const emptyLog = createEmptyStructuralAdjudicationLog({
    batchId: completeLog.batchId,
    sourceMatrix: matrix,
    sourceReviewerSeals: completeLog.sourceReviewerSeals,
    authorizedSourceItemIds: completeLog.authorizedSourceItemIds,
    humanDoctrine: completeLog.humanDoctrine
  });
  const first = STRUCTURAL_ADJUDICATION_BATCH_02_EVENTS[0];
  const baseInput = {
    eventId: 'adjudication-batch-02-event-001',
    sourceItemId: first.sourceItemId,
    decision: first.decision,
    humanRationale: first.humanRationale,
    recordedAt: STRUCTURAL_ADJUDICATION_BATCH_02_RECORDED_AT,
    provenance: HUMAN_ADJUDICATION_PROVENANCE
  };
  assert.throws(
    () => constructStructuralAdjudicationLogWithEvent(emptyLog, baseInput, matrix),
    /requires futureRule/u
  );
  assert.throws(
    () => constructStructuralAdjudicationLogWithEvent(emptyLog, {
      ...baseInput,
      futureRule: first.futureRule,
      provenance: 'AUTOMATED'
    }, matrix),
    /provenance must be HUMAN_ADJUDICATION/u
  );
  assert.throws(
    () => constructStructuralAdjudicationLogWithEvent(completeLog, {
      ...baseInput,
      eventId: 'adjudication-batch-02-event-011',
      futureRule: first.futureRule
    }, matrix),
    /Duplicate structural adjudication sourceItemId/u
  );
  const tampered = structuredClone(completeLog);
  tampered.events[0].decision.ambiguityMechanism.value = 'alternativeIntentReadings';
  assert.equal(validateStructuralAdjudicationLog(tampered, matrix).ok, false);
});

test('batch 02 materialization is deterministic and never mutates sealed sources or Batch 01', () => {
  const sourcePaths = [...immutableSourcePaths(), ...priorBatchArtifactPaths()];
  const before = Object.fromEntries(sourcePaths.map(path => [path, sha256(path)]));
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'storm-structural-adjudication-02-'));
  try {
    const outputPath = join(temporaryRoot, 'log.json');
    const first = materialiseStructuralAdjudicationBatch02Log({ outputPath });
    const firstContent = readFileSync(outputPath, 'utf8');
    const second = materialiseStructuralAdjudicationBatch02Log({ outputPath });
    assert.deepEqual(second, first);
    assert.equal(readFileSync(outputPath, 'utf8'), firstContent);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
  const after = Object.fromEntries(sourcePaths.map(path => [path, sha256(path)]));
  assert.deepEqual(after, before);
});

test('versioned batch 02 log is current, sealed and remains pending', () => {
  const result = materialiseStructuralAdjudicationBatch02Log({
    outputPath: DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_02_LOG_PATH,
    checkOnly: true
  });
  assert.equal(result.checkOnly, true);
  assert.equal(result.eventCount, 10);
  assert.equal(result.generationAuthorized, false);
  assert.equal(result.status, 'PENDING_HUMAN_REVIEW');
  assert.equal(existsSync(structuralAdjudicationSealPathForJournal(DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_02_LOG_PATH)), true);
});

test('batch 03 transcription is one valid complete ten-event HUMAN_ADJUDICATION chain', () => {
  const matrix = loadMatrix();
  const log = buildStructuralAdjudicationBatch03Log();
  const validation = validateStructuralAdjudicationLog(log, matrix);
  const completeness = evaluateStructuralAdjudicationCompleteness(log, matrix);
  assert.equal(validation.ok, true);
  assert.equal(validation.eventCount, 10);
  assert.equal(completeness.complete, true);
  assert.deepEqual(completeness.missingSourceItemIds, []);
  assert.deepEqual(log.events.map(event => event.sourceItemId), ADJUDICATION_BATCH_03_ITEM_IDS);
  assert.equal(log.events.every(event => event.provenance === HUMAN_ADJUDICATION_PROVENANCE), true);
  assert.equal(log.events.every(event => event.recordedAt === STRUCTURAL_ADJUDICATION_BATCH_03_RECORDED_AT), true);
  assert.equal(log.sourceMatrixFingerprint, EXPECTED_COMPARISON_MATRIX_FINGERPRINT);
  assert.equal(log.status, 'PENDING_HUMAN_REVIEW');
  assert.equal(log.generationAuthorized, false);
  assert.equal(log.appendOnly, true);
});

test('batch 03 effective decisions, rationales and future rules match the human adjudication exactly', () => {
  const log = buildStructuralAdjudicationBatch03Log();
  const byId = new Map(log.events.map(event => [event.sourceItemId, event]));
  for (const source of STRUCTURAL_ADJUDICATION_BATCH_03_EVENTS) {
    const event = byId.get(source.sourceItemId);
    const expected = EXPECTED_BATCH_03_CLASSIFICATIONS[source.sourceItemId];
    assert.equal(event.decision.ambiguityFamilyDisposition.value, expected[0]);
    assert.equal(event.decision.ambiguityMechanism.value, expected[1]);
    assert.equal(canonicalJson(event.decision), canonicalJson(source.decision));
    assert.equal(event.humanRationale, source.humanRationale);
    assert.equal(event.futureRule, source.futureRule);
  }
  assert.deepEqual(byId.get('ambiguity-capacity-18').decision.substantiallyDifferentCoveredGroups.canonicalPartition, [
    ['equinoxe-q079', 'equinoxe-q110'],
    ['equinoxe-q111']
  ]);
  assert.deepEqual(byId.get('ambiguity-capacity-25').decision.substantiallyDifferentCoveredGroups.canonicalPartition, [
    ['equinoxe-q028'],
    ['equinoxe-q029'],
    ['equinoxe-q031']
  ]);
  assert.deepEqual(byId.get('ambiguity-capacity-30').decision.substantiallyDifferentCoveredGroups.canonicalPartition, [
    ['equinoxe-q019', 'equinoxe-q053'],
    ['equinoxe-q022'],
    ['equinoxe-q089'],
    ['equinoxe-q090']
  ]);
});

test('batch 03 rejects missing future rule, invalid mutation, duplication and automated provenance', () => {
  const matrix = loadMatrix();
  const completeLog = buildStructuralAdjudicationBatch03Log();
  const emptyLog = createEmptyStructuralAdjudicationLog({
    batchId: completeLog.batchId,
    sourceMatrix: matrix,
    sourceReviewerSeals: completeLog.sourceReviewerSeals,
    authorizedSourceItemIds: completeLog.authorizedSourceItemIds,
    humanDoctrine: completeLog.humanDoctrine
  });
  const first = STRUCTURAL_ADJUDICATION_BATCH_03_EVENTS[0];
  const baseInput = {
    eventId: 'adjudication-batch-03-event-001',
    sourceItemId: first.sourceItemId,
    decision: first.decision,
    humanRationale: first.humanRationale,
    recordedAt: STRUCTURAL_ADJUDICATION_BATCH_03_RECORDED_AT,
    provenance: HUMAN_ADJUDICATION_PROVENANCE
  };
  assert.throws(
    () => constructStructuralAdjudicationLogWithEvent(emptyLog, baseInput, matrix),
    /requires futureRule/u
  );
  assert.throws(
    () => constructStructuralAdjudicationLogWithEvent(emptyLog, {
      ...baseInput,
      futureRule: first.futureRule,
      provenance: 'AUTOMATED'
    }, matrix),
    /provenance must be HUMAN_ADJUDICATION/u
  );
  assert.throws(
    () => constructStructuralAdjudicationLogWithEvent(completeLog, {
      ...baseInput,
      eventId: 'adjudication-batch-03-event-011',
      futureRule: first.futureRule
    }, matrix),
    /Duplicate structural adjudication sourceItemId/u
  );
  const tampered = structuredClone(completeLog);
  tampered.events[0].decision.ambiguityFamilyDisposition.value = 'structuralAmbiguity';
  assert.equal(validateStructuralAdjudicationLog(tampered, matrix).ok, false);
});

test('batch 03 materialization is deterministic and cannot mutate sealed sources or Batches 01/02', () => {
  const sourcePaths = [
    ...immutableSourcePaths(),
    ...priorBatchArtifactPaths(),
    DEFAULT_ADJUDICATION_BATCH_03_PATH
  ];
  const before = Object.fromEntries(sourcePaths.map(path => [path, sha256(path)]));
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'storm-structural-adjudication-03-'));
  try {
    const outputPath = join(temporaryRoot, 'log.json');
    const first = materialiseStructuralAdjudicationBatch03Log({ outputPath });
    const firstContent = readFileSync(outputPath, 'utf8');
    const second = materialiseStructuralAdjudicationBatch03Log({ outputPath });
    assert.deepEqual(second, first);
    assert.equal(readFileSync(outputPath, 'utf8'), firstContent);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
  const after = Object.fromEntries(sourcePaths.map(path => [path, sha256(path)]));
  assert.deepEqual(after, before);
});

test('versioned batch 03 log is current, sealed and remains pending', () => {
  const result = materialiseStructuralAdjudicationBatch03Log({
    outputPath: DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_03_LOG_PATH,
    checkOnly: true
  });
  assert.equal(result.checkOnly, true);
  assert.equal(result.eventCount, 10);
  assert.equal(result.generationAuthorized, false);
  assert.equal(result.status, 'PENDING_HUMAN_REVIEW');
  assert.equal(existsSync(structuralAdjudicationSealPathForJournal(DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_03_LOG_PATH)), true);
});

test('all twenty ambiguity items requiring adjudication have one effective decision across Batches 02/03', () => {
  const matrix = loadMatrix();
  const batch01 = buildStructuralAdjudicationBatch01Log();
  const batch02 = buildStructuralAdjudicationBatch02Log();
  const batch03 = buildStructuralAdjudicationBatch03Log();
  const expected = matrix.items
    .filter(item => item.packetKind === 'AMBIGUITY_CAPACITY_FAMILIES' && item.requiresAdjudication)
    .map(item => item.canonicalReviewItemId)
    .sort();
  const actual = [...batch02.events, ...batch03.events]
    .map(event => event.sourceItemId)
    .sort();
  assert.equal(expected.length, 20);
  assert.equal(new Set(actual).size, 20);
  assert.deepEqual(actual, expected);
  assert.equal(batch01.events.some(event => event.sourceItemId.startsWith('ambiguity-capacity-')), false);
  assert.equal([...batch02.events, ...batch03.events].every(event => event.provenance === HUMAN_ADJUDICATION_PROVENANCE), true);
});
