import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT } from './generate-structural-adjudication-batch.js';
import { canonicalJson } from './review-packets.js';
import {
  createStructuralAdjudicationSeal,
  persistStructuralAdjudicationSeal,
  structuralAdjudicationSealPathForJournal,
  validateStructuralAdjudicationSeal
} from './structural-adjudication-log.js';
import { DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_01_LOG_PATH } from './record-structural-adjudication-batch-01.js';

export const STRUCTURAL_ADJUDICATION_BATCH_01_SEALED_AT = '2026-09-07T15:32:51.958Z';
export const DEFAULT_STRUCTURAL_COMPARISON_MATRIX_PATH = join(
  DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
  'adjudication',
  'reviewer-ab-comparison-matrix.json'
);
export const DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_01_SEAL_PATH = structuralAdjudicationSealPathForJournal(
  DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_01_LOG_PATH
);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function buildStructuralAdjudicationBatch01Seal({
  journalPath = DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_01_LOG_PATH,
  sourceMatrixPath = DEFAULT_STRUCTURAL_COMPARISON_MATRIX_PATH
} = {}) {
  const log = readJson(journalPath);
  const sourceMatrix = readJson(sourceMatrixPath);
  const seal = createStructuralAdjudicationSeal({
    log,
    sourceMatrix,
    journalPath,
    sealedAt: STRUCTURAL_ADJUDICATION_BATCH_01_SEALED_AT
  });
  const validation = validateStructuralAdjudicationSeal(seal, { log, sourceMatrix, journalPath });
  if (!validation.ok) throw new Error(`Generated Batch 01 seal is invalid: ${canonicalJson(validation.errors)}`);
  return seal;
}

export function materialiseStructuralAdjudicationBatch01Seal({
  journalPath = DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_01_LOG_PATH,
  sourceMatrixPath = DEFAULT_STRUCTURAL_COMPARISON_MATRIX_PATH,
  checkOnly = false
} = {}) {
  const expected = buildStructuralAdjudicationBatch01Seal({ journalPath, sourceMatrixPath });
  const sealPath = structuralAdjudicationSealPathForJournal(journalPath);
  if (existsSync(sealPath)) {
    const actual = readJson(sealPath);
    if (canonicalJson(actual) !== canonicalJson(expected)) {
      throw new Error(`Existing Batch 01 seal differs from expected immutable seal: ${sealPath}`);
    }
  } else if (checkOnly) {
    throw new Error(`Missing Batch 01 seal: ${sealPath}`);
  } else {
    persistStructuralAdjudicationSeal({
      journalPath,
      sourceMatrixPath,
      sealedAt: STRUCTURAL_ADJUDICATION_BATCH_01_SEALED_AT
    });
  }
  return {
    batchId: expected.batchId,
    checkOnly,
    eventCount: expected.eventCount,
    finalEventHash: expected.finalEventHash,
    journalFingerprint: expected.journalFingerprint,
    sealHash: expected.sealHash,
    sourceMatrixFingerprint: expected.sourceMatrixFingerprint
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = materialiseStructuralAdjudicationBatch01Seal({ checkOnly: process.argv.includes('--check') });
  process.stdout.write(`${canonicalJson(result)}\n`);
}
