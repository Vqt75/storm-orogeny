import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { canonicalJson } from './review-packets.js';
import {
  createStructuralAdjudicationSeal,
  HUMAN_ADJUDICATION_PROVENANCE,
  persistStructuralAdjudicationSeal,
  structuralAdjudicationSealPathForJournal,
  validateStructuralAdjudicationSeal
} from './structural-adjudication-log.js';
import { DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_02_LOG_PATH } from './record-structural-adjudication-batch-02.js';
import { DEFAULT_STRUCTURAL_COMPARISON_MATRIX_PATH } from './seal-structural-adjudication-batch-01.js';

export const STRUCTURAL_ADJUDICATION_BATCH_02_SEALED_AT = '2026-09-08T10:04:12.877Z';
export const DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_02_SEAL_PATH = structuralAdjudicationSealPathForJournal(
  DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_02_LOG_PATH
);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function buildStructuralAdjudicationBatch02Seal({
  journalPath = DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_02_LOG_PATH,
  sourceMatrixPath = DEFAULT_STRUCTURAL_COMPARISON_MATRIX_PATH
} = {}) {
  const log = readJson(journalPath);
  const sourceMatrix = readJson(sourceMatrixPath);
  const seal = createStructuralAdjudicationSeal({
    log,
    sourceMatrix,
    journalPath,
    sealedAt: STRUCTURAL_ADJUDICATION_BATCH_02_SEALED_AT
  });
  const validation = validateStructuralAdjudicationSeal(seal, { log, sourceMatrix, journalPath });
  if (!validation.ok) throw new Error(`Generated Batch 02 seal is invalid: ${canonicalJson(validation.errors)}`);
  if (seal.eventCount !== 10 || seal.provenance !== HUMAN_ADJUDICATION_PROVENANCE) {
    throw new Error('Batch 02 seal must bind exactly ten HUMAN_ADJUDICATION events');
  }
  return seal;
}

export function materialiseStructuralAdjudicationBatch02Seal({
  journalPath = DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_02_LOG_PATH,
  sourceMatrixPath = DEFAULT_STRUCTURAL_COMPARISON_MATRIX_PATH,
  checkOnly = false
} = {}) {
  const expected = buildStructuralAdjudicationBatch02Seal({ journalPath, sourceMatrixPath });
  const sealPath = structuralAdjudicationSealPathForJournal(journalPath);
  if (existsSync(sealPath)) {
    const actual = readJson(sealPath);
    if (canonicalJson(actual) !== canonicalJson(expected)) {
      throw new Error(`Existing Batch 02 seal differs from expected immutable seal: ${sealPath}`);
    }
  } else if (checkOnly) {
    throw new Error(`Missing Batch 02 seal: ${sealPath}`);
  } else {
    persistStructuralAdjudicationSeal({
      journalPath,
      sourceMatrixPath,
      sealedAt: STRUCTURAL_ADJUDICATION_BATCH_02_SEALED_AT
    });
  }
  return {
    batchId: expected.batchId,
    checkOnly,
    eventCount: expected.eventCount,
    finalEventHash: expected.finalEventHash,
    journalFingerprint: expected.journalFingerprint,
    provenance: expected.provenance,
    sealHash: expected.sealHash,
    sealedAt: expected.sealedAt,
    sourceMatrixFingerprint: expected.sourceMatrixFingerprint
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = materialiseStructuralAdjudicationBatch02Seal({ checkOnly: process.argv.includes('--check') });
  process.stdout.write(`${canonicalJson(result)}\n`);
}
