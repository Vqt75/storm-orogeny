import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  STRUCTURAL_REVIEW_PACKET_PAIRS,
  STRUCTURAL_REVIEW_QUALITY_GATE_MANIFEST,
  STRUCTURAL_REVIEW_SOURCE_PLAN,
  serialiseStructuralReviewArtifact
} from './structural-review-packages.js';
import { validateStructuralReviewResponseLog } from './structural-review-response-log.js';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_STRUCTURAL_REVIEW_OUTPUT = join(HERE, 'generated-structural-review');

const SECTION_FILENAMES = Object.freeze({
  equivalencePreferred: '01-equivalence-preferred.fr.json',
  knowledgeBoundaries: '02-knowledge-boundaries.fr.json',
  ambiguityFamilies: '03-ambiguity-families.fr.json',
  scenarioFamilyPreflight: '04-scenario-family-preflight.fr.json'
});

function normaliseLineEndings(value) {
  return value.replaceAll('\r\n', '\n');
}

function emptyResponseLog(packet) {
  return {
    schemaVersion: 1,
    packetId: packet.packetId,
    packetFingerprint: packet.packetFingerprint,
    reviewerSlot: packet.reviewerSlot,
    languageStratum: packet.languageStratum,
    status: 'NOT_STARTED',
    appendOnly: true,
    events: []
  };
}

function immutableArtifacts(outputDirectory) {
  const result = new Map();
  for (const [sectionKey, pair] of Object.entries(STRUCTURAL_REVIEW_PACKET_PAIRS)) {
    const filename = SECTION_FILENAMES[sectionKey];
    result.set(join(outputDirectory, 'reviewer-a', filename), serialiseStructuralReviewArtifact(pair.reviewerA));
    result.set(join(outputDirectory, 'reviewer-b', filename), serialiseStructuralReviewArtifact(pair.reviewerB));
    result.set(
      join(outputDirectory, 'curator-only', filename.replace('.fr.json', '.linkage.json')),
      serialiseStructuralReviewArtifact(pair.curatorLinkage)
    );
  }
  result.set(
    join(outputDirectory, 'curator-only', 'source-plan.json'),
    serialiseStructuralReviewArtifact(STRUCTURAL_REVIEW_SOURCE_PLAN)
  );
  result.set(
    join(outputDirectory, 'curator-only', 'quality-gate-manifest.json'),
    serialiseStructuralReviewArtifact(STRUCTURAL_REVIEW_QUALITY_GATE_MANIFEST)
  );
  return result;
}

function responseLogArtifacts(outputDirectory) {
  const result = new Map();
  for (const [sectionKey, pair] of Object.entries(STRUCTURAL_REVIEW_PACKET_PAIRS)) {
    const filename = SECTION_FILENAMES[sectionKey].replace('.json', '.response-log.json');
    result.set(
      join(outputDirectory, 'responses', 'reviewer-a', filename),
      { packet: pair.reviewerA, initialContent: serialiseStructuralReviewArtifact(emptyResponseLog(pair.reviewerA)) }
    );
    result.set(
      join(outputDirectory, 'responses', 'reviewer-b', filename),
      { packet: pair.reviewerB, initialContent: serialiseStructuralReviewArtifact(emptyResponseLog(pair.reviewerB)) }
    );
  }
  return result;
}

function validateExistingResponseLog(path, packet) {
  let log;
  try {
    log = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Invalid generated structural response log: ${path}`, { cause: error });
  }
  const validation = validateStructuralReviewResponseLog(log, packet);
  if (!validation.ok) {
    throw new Error(`Invalid generated structural response log ${path}: ${JSON.stringify(validation.errors)}`);
  }
}

export function materialiseStructuralReviewPackages({
  outputDirectory = DEFAULT_STRUCTURAL_REVIEW_OUTPUT,
  checkOnly = false
} = {}) {
  const expectedImmutableArtifacts = immutableArtifacts(outputDirectory);
  const expectedResponseLogs = responseLogArtifacts(outputDirectory);
  for (const [path, content] of expectedImmutableArtifacts) {
    if (checkOnly) {
      let actual;
      try {
        actual = readFileSync(path, 'utf8');
      } catch (error) {
        throw new Error(`Missing generated structural review artifact: ${path}`, { cause: error });
      }
      if (normaliseLineEndings(actual) !== normaliseLineEndings(content)) {
        throw new Error(`Stale generated structural review artifact: ${path}`);
      }
      continue;
    }
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, 'utf8');
  }
  for (const [path, { packet, initialContent }] of expectedResponseLogs) {
    if (existsSync(path)) {
      validateExistingResponseLog(path, packet);
      continue;
    }
    if (checkOnly) throw new Error(`Missing generated structural response log: ${path}`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, initialContent, { encoding: 'utf8', flag: 'wx' });
  }
  return {
    outputDirectory,
    artifactCount: expectedImmutableArtifacts.size + expectedResponseLogs.size,
    checkOnly,
    manifestFingerprint: STRUCTURAL_REVIEW_QUALITY_GATE_MANIFEST.manifestFingerprint
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const checkOnly = process.argv.includes('--check');
  const result = materialiseStructuralReviewPackages({ checkOnly });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
