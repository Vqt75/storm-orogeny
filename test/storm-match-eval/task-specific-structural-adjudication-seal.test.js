import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { fingerprint } from './task-specific/human-review/review-packets.js';
import {
  appendStructuralAdjudicationEvent,
  constructStructuralAdjudicationLogWithEvent,
  HUMAN_ADJUDICATION_PROVENANCE,
  structuralAdjudicationSealPathForJournal,
  validateStructuralAdjudicationSeal
} from './task-specific/human-review/structural-adjudication-log.js';
import {
  DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_01_LOG_PATH,
  STRUCTURAL_ADJUDICATION_BATCH_01_EVENTS
} from './task-specific/human-review/record-structural-adjudication-batch-01.js';
import {
  DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_02_LOG_PATH,
  STRUCTURAL_ADJUDICATION_BATCH_02_EVENTS
} from './task-specific/human-review/record-structural-adjudication-batch-02.js';
import {
  DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_03_LOG_PATH,
  STRUCTURAL_ADJUDICATION_BATCH_03_EVENTS
} from './task-specific/human-review/record-structural-adjudication-batch-03.js';
import {
  buildStructuralAdjudicationBatch01Seal,
  DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_01_SEAL_PATH,
  DEFAULT_STRUCTURAL_COMPARISON_MATRIX_PATH,
  materialiseStructuralAdjudicationBatch01Seal
} from './task-specific/human-review/seal-structural-adjudication-batch-01.js';
import {
  buildStructuralAdjudicationBatch02Seal,
  DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_02_SEAL_PATH,
  materialiseStructuralAdjudicationBatch02Seal,
  STRUCTURAL_ADJUDICATION_BATCH_02_SEALED_AT
} from './task-specific/human-review/seal-structural-adjudication-batch-02.js';
import {
  buildStructuralAdjudicationBatch03Seal,
  DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_03_SEAL_PATH,
  materialiseStructuralAdjudicationBatch03Seal,
  STRUCTURAL_ADJUDICATION_BATCH_03_SEALED_AT
} from './task-specific/human-review/seal-structural-adjudication-batch-03.js';

const EXPECTED_SEAL_HASH = '1adf0fb5526aea6fc8837328a8dff5f56eb44d9d010a7d29f1f0deb4df33f704';
const EXPECTED_JOURNAL_FINGERPRINT = 'fb334571e0fdc4b8d982a1d4d2640f5c6b7ab67cd0cdb65ba931d4faf186de76';
const EXPECTED_FINAL_EVENT_HASH = 'd84d9de36ec940c4ba1f700a579a7ea9c85db063ff09e0a5f1100a2cff386c32';
const EXPECTED_BATCH_02_SEAL_HASH = '16d36d728b8bc809d0f5e21bfad487bfeeb7fbc6a688f26e060bec618ce06159';
const EXPECTED_BATCH_02_JOURNAL_FINGERPRINT = '5b21e15c178661c29a498e43484eea5ae95680f6b28a5ab6dac027740ac83547';
const EXPECTED_BATCH_02_FINAL_EVENT_HASH = '47df16e1d24c43916d4f2fb6a7d1e923df290b02de196358e799debae748e516';
const EXPECTED_BATCH_03_SEAL_HASH = 'e6faea3199d937230007e7f51c66c99c19010bbafdfbc599450c4b583ab810f4';
const EXPECTED_BATCH_03_JOURNAL_FINGERPRINT = '76c955070ab59038780f086e9d338d25e8bfe42c310df81351d9207cdffcd1e3';
const EXPECTED_BATCH_03_FINAL_EVENT_HASH = 'ba01a92f34236acaa1f21a9aa87721bdc8548fd3dc65636e69f4ca9fb5b1c652';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function withoutField(value, field) {
  const { [field]: _ignored, ...rest } = value;
  return rest;
}

test('Batch 01 seal binds exactly the validated eight-event journal', () => {
  const log = readJson(DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_01_LOG_PATH);
  const matrix = readJson(DEFAULT_STRUCTURAL_COMPARISON_MATRIX_PATH);
  const seal = readJson(DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_01_SEAL_PATH);
  assert.deepEqual(seal, buildStructuralAdjudicationBatch01Seal());
  assert.deepEqual(validateStructuralAdjudicationSeal(seal, {
    log,
    sourceMatrix: matrix,
    journalPath: DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_01_LOG_PATH
  }), { ok: true, errors: [] });
  assert.equal(seal.eventCount, 8);
  assert.equal(seal.journalFingerprint, EXPECTED_JOURNAL_FINGERPRINT);
  assert.equal(seal.finalEventHash, EXPECTED_FINAL_EVENT_HASH);
  assert.equal(seal.sealHash, EXPECTED_SEAL_HASH);
});

test('public persistent append derives the adjacent seal and rejects omission-based bypass', () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'storm-sealed-adjudication-'));
  try {
    const journalPath = join(temporaryRoot, 'adjudication-batch-01-equivalence-boundaries.human-adjudication-log.json');
    const matrixPath = join(temporaryRoot, 'reviewer-ab-comparison-matrix.json');
    const sealPath = structuralAdjudicationSealPathForJournal(journalPath);
    writeFileSync(journalPath, readFileSync(DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_01_LOG_PATH));
    writeFileSync(matrixPath, readFileSync(DEFAULT_STRUCTURAL_COMPARISON_MATRIX_PATH));
    const localSeal = buildStructuralAdjudicationBatch01Seal({ journalPath, sourceMatrixPath: matrixPath });
    writeFileSync(sealPath, `${JSON.stringify(localSeal, null, 2)}\n`, 'utf8');
    const journalBefore = readFileSync(journalPath, 'utf8');
    const hashBefore = sha256(journalPath);
    assert.throws(() => appendStructuralAdjudicationEvent({
      journalPath,
      sourceMatrixPath: matrixPath,
      input: {
        eventId: 'post-seal-event',
        sourceItemId: 'equivalence-comparison-01',
        decision: STRUCTURAL_ADJUDICATION_BATCH_01_EVENTS[0].decision,
        humanRationale: 'Must never be persisted.',
        recordedAt: '2026-09-07T15:32:52.000Z',
        provenance: HUMAN_ADJUDICATION_PROVENANCE
      }
    }), /covered by a valid seal/u);
    assert.equal(readFileSync(journalPath, 'utf8'), journalBefore);
    assert.equal(sha256(journalPath), hashBefore);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test('event mutation invalidates the Batch 01 seal', () => {
  const log = readJson(DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_01_LOG_PATH);
  const matrix = readJson(DEFAULT_STRUCTURAL_COMPARISON_MATRIX_PATH);
  const seal = readJson(DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_01_SEAL_PATH);
  log.events[0].humanRationale = 'tampered';
  assert.equal(validateStructuralAdjudicationSeal(seal, {
    log,
    sourceMatrix: matrix,
    journalPath: DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_01_LOG_PATH
  }).ok, false);
});

test('matrix fingerprint and seal finalEventHash tampering are rejected', () => {
  const log = readJson(DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_01_LOG_PATH);
  const matrix = readJson(DEFAULT_STRUCTURAL_COMPARISON_MATRIX_PATH);
  const seal = readJson(DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_01_SEAL_PATH);
  const changedMatrix = structuredClone(matrix);
  changedMatrix.matrixFingerprint = '0'.repeat(64);
  assert.equal(validateStructuralAdjudicationSeal(seal, {
    log,
    sourceMatrix: changedMatrix,
    journalPath: DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_01_LOG_PATH
  }).ok, false);
  const changedSeal = structuredClone(seal);
  changedSeal.finalEventHash = '0'.repeat(64);
  assert.equal(validateStructuralAdjudicationSeal(changedSeal, {
    log,
    sourceMatrix: matrix,
    journalPath: DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_01_LOG_PATH
  }).ok, false);
});

test('non-human provenance and a seven-event journal are rejected', () => {
  const log = readJson(DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_01_LOG_PATH);
  const matrix = readJson(DEFAULT_STRUCTURAL_COMPARISON_MATRIX_PATH);
  const seal = readJson(DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_01_SEAL_PATH);
  assert.throws(() => constructStructuralAdjudicationLogWithEvent(log, {
    eventId: 'non-human-event',
    sourceItemId: 'equivalence-comparison-01',
    decision: STRUCTURAL_ADJUDICATION_BATCH_01_EVENTS[0].decision,
    humanRationale: 'Invalid provenance.',
    recordedAt: '2026-09-07T15:32:52.000Z',
    provenance: 'AUTOMATED'
  }, matrix), /provenance must be HUMAN_ADJUDICATION/u);

  const shortened = structuredClone(log);
  shortened.events = shortened.events.slice(0, 7);
  shortened.logFingerprint = fingerprint(withoutField(shortened, 'logFingerprint'));
  assert.equal(validateStructuralAdjudicationSeal(seal, {
    log: shortened,
    sourceMatrix: matrix,
    journalPath: DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_01_LOG_PATH
  }).ok, false);
});

test('versioned Batch 01 seal is deterministic and current', () => {
  const result = materialiseStructuralAdjudicationBatch01Seal({ checkOnly: true });
  assert.equal(result.checkOnly, true);
  assert.equal(result.eventCount, 8);
  assert.equal(result.sealHash, EXPECTED_SEAL_HASH);
  assert.equal(result.journalFingerprint, EXPECTED_JOURNAL_FINGERPRINT);
  assert.equal(result.finalEventHash, EXPECTED_FINAL_EVENT_HASH);
});

test('Batch 02 seal binds exactly ten HUMAN_ADJUDICATION events and all immutable content', () => {
  const log = readJson(DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_02_LOG_PATH);
  const matrix = readJson(DEFAULT_STRUCTURAL_COMPARISON_MATRIX_PATH);
  const seal = readJson(DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_02_SEAL_PATH);
  assert.deepEqual(seal, buildStructuralAdjudicationBatch02Seal());
  assert.deepEqual(validateStructuralAdjudicationSeal(seal, {
    log,
    sourceMatrix: matrix,
    journalPath: DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_02_LOG_PATH
  }), { ok: true, errors: [] });
  assert.equal(seal.schemaVersion, 2);
  assert.equal(seal.eventCount, 10);
  assert.equal(seal.provenance, HUMAN_ADJUDICATION_PROVENANCE);
  assert.equal(seal.journalFingerprint, EXPECTED_BATCH_02_JOURNAL_FINGERPRINT);
  assert.equal(seal.finalEventHash, EXPECTED_BATCH_02_FINAL_EVENT_HASH);
  assert.equal(seal.sealHash, EXPECTED_BATCH_02_SEAL_HASH);
  assert.equal(seal.sealedAt, STRUCTURAL_ADJUDICATION_BATCH_02_SEALED_AT);
});

test('Batch 02 public append derives its seal and rejects omission-based bypass', () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'storm-sealed-adjudication-02-'));
  try {
    const journalPath = join(temporaryRoot, 'adjudication-batch-02-ambiguities-01.human-adjudication-log.json');
    const matrixPath = join(temporaryRoot, 'reviewer-ab-comparison-matrix.json');
    const sealPath = structuralAdjudicationSealPathForJournal(journalPath);
    writeFileSync(journalPath, readFileSync(DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_02_LOG_PATH));
    writeFileSync(matrixPath, readFileSync(DEFAULT_STRUCTURAL_COMPARISON_MATRIX_PATH));
    const localSeal = buildStructuralAdjudicationBatch02Seal({ journalPath, sourceMatrixPath: matrixPath });
    writeFileSync(sealPath, `${JSON.stringify(localSeal, null, 2)}\n`, 'utf8');
    const journalBefore = readFileSync(journalPath, 'utf8');
    const hashBefore = sha256(journalPath);
    const first = STRUCTURAL_ADJUDICATION_BATCH_02_EVENTS[0];
    assert.throws(() => appendStructuralAdjudicationEvent({
      journalPath,
      sourceMatrixPath: matrixPath,
      input: {
        eventId: 'post-seal-batch-02-event',
        sourceItemId: first.sourceItemId,
        decision: first.decision,
        humanRationale: first.humanRationale,
        futureRule: first.futureRule,
        recordedAt: '2026-09-08T10:04:13.000Z',
        provenance: HUMAN_ADJUDICATION_PROVENANCE
      }
    }), /covered by a valid seal/u);
    assert.equal(readFileSync(journalPath, 'utf8'), journalBefore);
    assert.equal(sha256(journalPath), hashBefore);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test('Batch 02 decision, rationale and futureRule tampering each invalidate the seal', () => {
  const originalLog = readJson(DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_02_LOG_PATH);
  const matrix = readJson(DEFAULT_STRUCTURAL_COMPARISON_MATRIX_PATH);
  const seal = readJson(DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_02_SEAL_PATH);
  const mutations = [
    log => { log.events[0].decision.ambiguityMechanism.value = 'alternativeIntentReadings'; },
    log => { log.events[0].humanRationale = 'tampered rationale'; },
    log => { log.events[0].futureRule = 'tampered future rule'; }
  ];
  for (const mutate of mutations) {
    const changedLog = structuredClone(originalLog);
    mutate(changedLog);
    assert.equal(validateStructuralAdjudicationSeal(seal, {
      log: changedLog,
      sourceMatrix: matrix,
      journalPath: DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_02_LOG_PATH
    }).ok, false);
  }
});

test('Batch 02 matrix fingerprint, finalEventHash and provenance tampering are rejected', () => {
  const log = readJson(DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_02_LOG_PATH);
  const matrix = readJson(DEFAULT_STRUCTURAL_COMPARISON_MATRIX_PATH);
  const seal = readJson(DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_02_SEAL_PATH);
  const changedMatrix = structuredClone(matrix);
  changedMatrix.matrixFingerprint = '0'.repeat(64);
  assert.equal(validateStructuralAdjudicationSeal(seal, {
    log,
    sourceMatrix: changedMatrix,
    journalPath: DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_02_LOG_PATH
  }).ok, false);
  for (const [field, value] of [
    ['finalEventHash', '0'.repeat(64)],
    ['provenance', 'AUTOMATED']
  ]) {
    const changedSeal = structuredClone(seal);
    changedSeal[field] = value;
    assert.equal(validateStructuralAdjudicationSeal(changedSeal, {
      log,
      sourceMatrix: matrix,
      journalPath: DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_02_LOG_PATH
    }).ok, false);
  }
});

test('Batch 02 seal rejects a journal with fewer than ten events', () => {
  const log = readJson(DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_02_LOG_PATH);
  const matrix = readJson(DEFAULT_STRUCTURAL_COMPARISON_MATRIX_PATH);
  const seal = readJson(DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_02_SEAL_PATH);
  const shortened = structuredClone(log);
  shortened.events = shortened.events.slice(0, 9);
  shortened.logFingerprint = fingerprint(withoutField(shortened, 'logFingerprint'));
  assert.equal(validateStructuralAdjudicationSeal(seal, {
    log: shortened,
    sourceMatrix: matrix,
    journalPath: DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_02_LOG_PATH
  }).ok, false);
});

test('versioned Batch 02 seal is deterministic and current while Batch 01 remains valid', () => {
  const result = materialiseStructuralAdjudicationBatch02Seal({ checkOnly: true });
  assert.equal(result.checkOnly, true);
  assert.equal(result.eventCount, 10);
  assert.equal(result.provenance, HUMAN_ADJUDICATION_PROVENANCE);
  assert.equal(result.sealHash, EXPECTED_BATCH_02_SEAL_HASH);
  assert.equal(result.journalFingerprint, EXPECTED_BATCH_02_JOURNAL_FINGERPRINT);
  assert.equal(result.finalEventHash, EXPECTED_BATCH_02_FINAL_EVENT_HASH);
  const batch01 = materialiseStructuralAdjudicationBatch01Seal({ checkOnly: true });
  assert.equal(batch01.sealHash, EXPECTED_SEAL_HASH);
  assert.equal(batch01.eventCount, 8);
});

test('Batch 03 seal binds exactly ten HUMAN_ADJUDICATION events and all immutable content', () => {
  const log = readJson(DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_03_LOG_PATH);
  const matrix = readJson(DEFAULT_STRUCTURAL_COMPARISON_MATRIX_PATH);
  const seal = readJson(DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_03_SEAL_PATH);
  assert.deepEqual(seal, buildStructuralAdjudicationBatch03Seal());
  assert.deepEqual(validateStructuralAdjudicationSeal(seal, {
    log,
    sourceMatrix: matrix,
    journalPath: DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_03_LOG_PATH
  }), { ok: true, errors: [] });
  assert.equal(seal.schemaVersion, 2);
  assert.equal(seal.eventCount, 10);
  assert.equal(seal.provenance, HUMAN_ADJUDICATION_PROVENANCE);
  assert.equal(seal.journalFingerprint, EXPECTED_BATCH_03_JOURNAL_FINGERPRINT);
  assert.equal(seal.finalEventHash, EXPECTED_BATCH_03_FINAL_EVENT_HASH);
  assert.equal(seal.sealHash, EXPECTED_BATCH_03_SEAL_HASH);
  assert.equal(seal.sealedAt, STRUCTURAL_ADJUDICATION_BATCH_03_SEALED_AT);
});

test('Batch 03 public append derives its seal and rejects omission-based bypass', () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'storm-sealed-adjudication-03-'));
  try {
    const journalPath = join(temporaryRoot, 'adjudication-batch-03-ambiguities-02.human-adjudication-log.json');
    const matrixPath = join(temporaryRoot, 'reviewer-ab-comparison-matrix.json');
    const sealPath = structuralAdjudicationSealPathForJournal(journalPath);
    writeFileSync(journalPath, readFileSync(DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_03_LOG_PATH));
    writeFileSync(matrixPath, readFileSync(DEFAULT_STRUCTURAL_COMPARISON_MATRIX_PATH));
    const localSeal = buildStructuralAdjudicationBatch03Seal({ journalPath, sourceMatrixPath: matrixPath });
    writeFileSync(sealPath, `${JSON.stringify(localSeal, null, 2)}\n`, 'utf8');
    const journalBefore = readFileSync(journalPath, 'utf8');
    const hashBefore = sha256(journalPath);
    const first = STRUCTURAL_ADJUDICATION_BATCH_03_EVENTS[0];
    assert.throws(() => appendStructuralAdjudicationEvent({
      journalPath,
      sourceMatrixPath: matrixPath,
      input: {
        eventId: 'post-seal-batch-03-event',
        sourceItemId: first.sourceItemId,
        decision: first.decision,
        humanRationale: first.humanRationale,
        futureRule: first.futureRule,
        recordedAt: '2026-09-08T11:45:14.000Z',
        provenance: HUMAN_ADJUDICATION_PROVENANCE
      }
    }), /covered by a valid seal/u);
    assert.equal(readFileSync(journalPath, 'utf8'), journalBefore);
    assert.equal(sha256(journalPath), hashBefore);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test('Batch 03 decision, rationale and futureRule tampering each invalidate the seal', () => {
  const originalLog = readJson(DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_03_LOG_PATH);
  const matrix = readJson(DEFAULT_STRUCTURAL_COMPARISON_MATRIX_PATH);
  const seal = readJson(DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_03_SEAL_PATH);
  const mutations = [
    log => { log.events[0].decision.ambiguityFamilyDisposition.value = 'structuralAmbiguity'; },
    log => { log.events[0].humanRationale = 'tampered rationale'; },
    log => { log.events[0].futureRule = 'tampered future rule'; }
  ];
  for (const mutate of mutations) {
    const changedLog = structuredClone(originalLog);
    mutate(changedLog);
    assert.equal(validateStructuralAdjudicationSeal(seal, {
      log: changedLog,
      sourceMatrix: matrix,
      journalPath: DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_03_LOG_PATH
    }).ok, false);
  }
});

test('Batch 03 matrix fingerprint, finalEventHash, provenance and event count tampering are rejected', () => {
  const log = readJson(DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_03_LOG_PATH);
  const matrix = readJson(DEFAULT_STRUCTURAL_COMPARISON_MATRIX_PATH);
  const seal = readJson(DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_03_SEAL_PATH);
  const changedMatrix = structuredClone(matrix);
  changedMatrix.matrixFingerprint = '0'.repeat(64);
  assert.equal(validateStructuralAdjudicationSeal(seal, {
    log,
    sourceMatrix: changedMatrix,
    journalPath: DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_03_LOG_PATH
  }).ok, false);
  for (const [field, value] of [
    ['finalEventHash', '0'.repeat(64)],
    ['provenance', 'AUTOMATED']
  ]) {
    const changedSeal = structuredClone(seal);
    changedSeal[field] = value;
    assert.equal(validateStructuralAdjudicationSeal(changedSeal, {
      log,
      sourceMatrix: matrix,
      journalPath: DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_03_LOG_PATH
    }).ok, false);
  }
  const shortened = structuredClone(log);
  shortened.events = shortened.events.slice(0, 9);
  shortened.logFingerprint = fingerprint(withoutField(shortened, 'logFingerprint'));
  assert.equal(validateStructuralAdjudicationSeal(seal, {
    log: shortened,
    sourceMatrix: matrix,
    journalPath: DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_03_LOG_PATH
  }).ok, false);
});

test('versioned Batch 03 seal is deterministic and current while Batches 01/02 remain valid', () => {
  const result = materialiseStructuralAdjudicationBatch03Seal({ checkOnly: true });
  assert.equal(result.checkOnly, true);
  assert.equal(result.eventCount, 10);
  assert.equal(result.provenance, HUMAN_ADJUDICATION_PROVENANCE);
  assert.equal(result.sealHash, EXPECTED_BATCH_03_SEAL_HASH);
  assert.equal(result.journalFingerprint, EXPECTED_BATCH_03_JOURNAL_FINGERPRINT);
  assert.equal(result.finalEventHash, EXPECTED_BATCH_03_FINAL_EVENT_HASH);
  assert.equal(materialiseStructuralAdjudicationBatch01Seal({ checkOnly: true }).sealHash, EXPECTED_SEAL_HASH);
  assert.equal(materialiseStructuralAdjudicationBatch02Seal({ checkOnly: true }).sealHash, EXPECTED_BATCH_02_SEAL_HASH);
});
