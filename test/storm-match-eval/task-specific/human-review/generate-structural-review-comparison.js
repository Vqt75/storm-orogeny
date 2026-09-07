import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalJson } from './review-packets.js';
import {
  buildStructuralReviewComparison,
  renderStructuralReviewComparisonReport
} from './structural-review-comparison.js';

export const DEFAULT_STRUCTURAL_REVIEW_GENERATED_ROOT = join(import.meta.dirname, 'generated-structural-review');
export const DEFAULT_STRUCTURAL_REVIEW_COMPARISON_DIRECTORY = join(
  DEFAULT_STRUCTURAL_REVIEW_GENERATED_ROOT,
  'adjudication'
);

function serialiseJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function normaliseLineEndings(value) {
  return value.replace(/\r\n/g, '\n');
}

export function materialiseStructuralReviewComparison({
  generatedRoot = DEFAULT_STRUCTURAL_REVIEW_GENERATED_ROOT,
  outputDirectory = join(generatedRoot, 'adjudication'),
  checkOnly = false
} = {}) {
  const matrix = buildStructuralReviewComparison({ generatedRoot });
  const artifacts = new Map([
    [join(outputDirectory, 'reviewer-ab-comparison-matrix.json'), serialiseJson(matrix)],
    [join(outputDirectory, 'reviewer-ab-comparison-report.md'), renderStructuralReviewComparisonReport(matrix)]
  ]);

  for (const [path, expected] of artifacts) {
    if (checkOnly) {
      const actual = readFileSync(path, 'utf8');
      if (normaliseLineEndings(actual) !== normaliseLineEndings(expected)) {
        throw new Error(`Stale structural review comparison artifact: ${path}`);
      }
      continue;
    }
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, expected, 'utf8');
  }
  return {
    artifactCount: artifacts.size,
    checkOnly,
    generationAuthorized: matrix.generationAuthorized,
    matrixFingerprint: matrix.matrixFingerprint,
    status: matrix.status,
    summary: matrix.summary
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = materialiseStructuralReviewComparison({ checkOnly: process.argv.includes('--check') });
  process.stdout.write(`${canonicalJson(result)}\n`);
}
