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
  buildStructuralAdjudicationBatch01Seal,
  DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_01_SEAL_PATH,
  DEFAULT_STRUCTURAL_COMPARISON_MATRIX_PATH,
  materialiseStructuralAdjudicationBatch01Seal
} from './task-specific/human-review/seal-structural-adjudication-batch-01.js';

const EXPECTED_SEAL_HASH = '1adf0fb5526aea6fc8837328a8dff5f56eb44d9d010a7d29f1f0deb4df33f704';
const EXPECTED_JOURNAL_FINGERPRINT = 'fb334571e0fdc4b8d982a1d4d2640f5c6b7ab67cd0cdb65ba931d4faf186de76';
const EXPECTED_FINAL_EVENT_HASH = 'd84d9de36ec940c4ba1f700a579a7ea9c85db063ff09e0a5f1100a2cff386c32';

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
