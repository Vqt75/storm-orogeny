import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  ADJUDICATION_BATCH_01_ITEM_IDS,
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
  canonicaliseAdjudicatedPartition,
  constructStructuralAdjudicationLogWithEvent,
  HUMAN_ADJUDICATION_PROVENANCE,
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
