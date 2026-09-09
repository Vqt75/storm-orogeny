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
import { DEFAULT_ADJUDICATION_BATCH_05_PATH } from './generate-structural-adjudication-batch.js';
import { DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_05_LOG_PATH } from './record-structural-adjudication-batch-05.js';
import { DEFAULT_STRUCTURAL_COMPARISON_MATRIX_PATH } from './seal-structural-adjudication-batch-01.js';

export const STRUCTURAL_ADJUDICATION_BATCH_05_SEALED_AT = '2026-09-09T09:23:42.821Z';
export const DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_05_SEAL_PATH = structuralAdjudicationSealPathForJournal(
  DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_05_LOG_PATH
);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function buildStructuralAdjudicationBatch05Seal({
  journalPath = DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_05_LOG_PATH,
  sourceMatrixPath = DEFAULT_STRUCTURAL_COMPARISON_MATRIX_PATH,
  sourcePacketPath = DEFAULT_ADJUDICATION_BATCH_05_PATH
} = {}) {
  const log = readJson(journalPath);
  const sourceMatrix = readJson(sourceMatrixPath);
  const seal = createStructuralAdjudicationSeal({
    log,
    sourceMatrix,
    journalPath,
    sourcePacketPath,
    sealedAt: STRUCTURAL_ADJUDICATION_BATCH_05_SEALED_AT
  });
  const validation = validateStructuralAdjudicationSeal(seal, {
    log,
    sourceMatrix,
    journalPath,
    sourcePacketPath
  });
  if (!validation.ok) throw new Error(`Generated Batch 05 seal is invalid: ${canonicalJson(validation.errors)}`);
  if (seal.eventCount !== 8 || seal.provenance !== HUMAN_ADJUDICATION_PROVENANCE) {
    throw new Error('Batch 05 seal must bind exactly eight HUMAN_ADJUDICATION events');
  }
  return seal;
}

export function materialiseStructuralAdjudicationBatch05Seal({
  journalPath = DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_05_LOG_PATH,
  sourceMatrixPath = DEFAULT_STRUCTURAL_COMPARISON_MATRIX_PATH,
  sourcePacketPath = DEFAULT_ADJUDICATION_BATCH_05_PATH,
  checkOnly = false
} = {}) {
  const expected = buildStructuralAdjudicationBatch05Seal({ journalPath, sourceMatrixPath, sourcePacketPath });
  const sealPath = structuralAdjudicationSealPathForJournal(journalPath);
  if (existsSync(sealPath)) {
    const actual = readJson(sealPath);
    if (canonicalJson(actual) !== canonicalJson(expected)) {
      throw new Error(`Existing Batch 05 seal differs from expected immutable seal: ${sealPath}`);
    }
  } else if (checkOnly) {
    throw new Error(`Missing Batch 05 seal: ${sealPath}`);
  } else {
    persistStructuralAdjudicationSeal({
      journalPath,
      sourceMatrixPath,
      sourcePacketPath,
      sealedAt: STRUCTURAL_ADJUDICATION_BATCH_05_SEALED_AT
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
    sourceMatrixFingerprint: expected.sourceMatrixFingerprint,
    sourcePacketPath: expected.sourcePacketPath,
    sourcePacketSha256: expected.sourcePacketSha256
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = materialiseStructuralAdjudicationBatch05Seal({ checkOnly: process.argv.includes('--check') });
  process.stdout.write(`${canonicalJson(result)}\n`);
}
