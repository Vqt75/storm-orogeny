import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  DEFAULT_STRUCTURAL_REVIEW_OUTPUT,
  materialiseStructuralReviewPackages
} from './task-specific/human-review/generate-structural-review-packages.js';
import {
  EXPECTED_COMPOSITION_FINGERPRINT,
  EXPECTED_STRUCTURE_FINGERPRINT,
  STRUCTURAL_REVIEW_PACKET_PAIRS,
  STRUCTURAL_REVIEW_QUALITY_GATE_MANIFEST,
  STRUCTURAL_REVIEW_SOURCE_PLAN
} from './task-specific/human-review/structural-review-packages.js';

const EXPECTED_ITEM_COUNTS = {
  equivalencePreferred: 5,
  knowledgeBoundaries: 4,
  ambiguityFamilies: 34,
  scenarioFamilyPreflight: 34
};

function normalisedKnowledge(packet) {
  return packet.knowledgeItems
    .map(item => ({
      question: item.canonicalQuestion,
      answer: item.canonicalAnswer,
      ...(item.preRegisteredTieBreakRank === undefined ? {} : { tieBreakRank: item.preRegisteredTieBreakRank })
    }))
    .sort((left, right) => left.question.localeCompare(right.question));
}

function visibleItemContent(packet) {
  const knowledgeByRef = new Map(packet.knowledgeItems.map(item => [item.knowledgeRef, item]));
  return packet.reviewItems
    .map(item => ({
      title: item.title,
      businessContext: item.businessContext,
      questions: item.knowledgeRefs
        .map(ref => knowledgeByRef.get(ref).canonicalQuestion)
        .sort()
    }))
    .sort((left, right) => left.title.localeCompare(right.title));
}

function visibleKnowledgeOrderByTitle(packet) {
  const knowledgeByRef = new Map(packet.knowledgeItems.map(item => [item.knowledgeRef, item]));
  return new Map(packet.reviewItems.map(item => [
    item.title,
    item.knowledgeRefs.map(ref => knowledgeByRef.get(ref).canonicalQuestion)
  ]));
}

function collectExactKeys(value, keys = []) {
  if (Array.isArray(value)) {
    value.forEach(item => collectExactKeys(item, keys));
    return keys;
  }
  if (!value || typeof value !== 'object') return keys;
  for (const [key, child] of Object.entries(value)) {
    keys.push({ key, value: child });
    collectExactKeys(child, keys);
  }
  return keys;
}

test('materialised structural review artifacts are deterministic and current', () => {
  const result = materialiseStructuralReviewPackages({ checkOnly: true });
  assert.equal(result.artifactCount, 22);
  assert.equal(result.manifestFingerprint, STRUCTURAL_REVIEW_QUALITY_GATE_MANIFEST.manifestFingerprint);
});

test('four paired French packets carry the approved fingerprints and no judgments', () => {
  assert.equal(STRUCTURAL_REVIEW_QUALITY_GATE_MANIFEST.status, 'PENDING_HUMAN_REVIEW');
  assert.equal(STRUCTURAL_REVIEW_QUALITY_GATE_MANIFEST.automaticQualityGateStatus, 'STRUCTURAL_OK');
  assert.equal(STRUCTURAL_REVIEW_QUALITY_GATE_MANIFEST.generationAuthorized, false);
  assert.equal(STRUCTURAL_REVIEW_QUALITY_GATE_MANIFEST.finalDatasetGenerated, false);
  assert.equal(STRUCTURAL_REVIEW_QUALITY_GATE_MANIFEST.holdoutOpened, false);
  assert.equal(STRUCTURAL_REVIEW_QUALITY_GATE_MANIFEST.structureFingerprint, EXPECTED_STRUCTURE_FINGERPRINT);
  assert.equal(STRUCTURAL_REVIEW_QUALITY_GATE_MANIFEST.compositionFingerprint, EXPECTED_COMPOSITION_FINGERPRINT);

  for (const [sectionKey, pair] of Object.entries(STRUCTURAL_REVIEW_PACKET_PAIRS)) {
    const { reviewerA: a, reviewerB: b } = pair;
    assert.equal(a.languageStratum, 'fr');
    assert.equal(b.languageStratum, 'fr');
    assert.equal(a.reviewerSlot, 'A');
    assert.equal(b.reviewerSlot, 'B');
    assert.equal(a.reviewItems.length, EXPECTED_ITEM_COUNTS[sectionKey]);
    assert.equal(b.reviewItems.length, EXPECTED_ITEM_COUNTS[sectionKey]);
    assert.deepEqual(normalisedKnowledge(a), normalisedKnowledge(b));
    assert.deepEqual(visibleItemContent(a), visibleItemContent(b));
    assert.deepEqual(a.instructions, b.instructions);
    assert.deepEqual(a.decisionsRequired, b.decisionsRequired);
    assert.deepEqual(a.responseContract, b.responseContract);
    assert.notDeepEqual(
      a.reviewItems.map(item => item.title),
      b.reviewItems.map(item => item.title),
      `${sectionKey} reviewer order must differ`
    );
    assert.notDeepEqual(
      a.knowledgeItems.map(item => item.canonicalQuestion),
      b.knowledgeItems.map(item => item.canonicalQuestion),
      `${sectionKey} knowledge order must differ`
    );
    const itemOrdersA = visibleKnowledgeOrderByTitle(a);
    const itemOrdersB = visibleKnowledgeOrderByTitle(b);
    for (const [title, orderA] of itemOrdersA) {
      if (orderA.length > 1) {
        assert.notDeepEqual(orderA, itemOrdersB.get(title), `${sectionKey}/${title} internal order must differ`);
      }
    }
    for (const packet of [a, b]) {
      assert.equal(packet.generationAuthorized, false);
      assert.equal(packet.humanQualityGateStatus, 'PENDING_HUMAN_REVIEW');
      assert.equal(packet.reviewStatus, 'NOT_STARTED');
      assert.equal(packet.traceability.structureFingerprint, EXPECTED_STRUCTURE_FINGERPRINT);
      assert.equal(packet.traceability.compositionFingerprint, EXPECTED_COMPOSITION_FINGERPRINT);
      assert.equal(packet.responseContract.appendOnly, true);
      assert.equal(packet.responseContract.emptyAtGeneration, true);
      for (const included of Object.values(packet.isolation)) assert.equal(included, false);

      const serialised = JSON.stringify(packet);
      assert.equal(/DistilUSE|cosineSimilarity|semanticScore|semanticRank/.test(serialised), false);
      assert.equal(/equinoxe-q\d{3}|eqx-aeg-|eqx-kc-/.test(serialised), false);
      const forbiddenExactKeys = new Set([
        'score',
        'modelOutput',
        'prediction',
        'gold',
        'expectedSystemOutcome',
        'expectedEntryId',
        'preferredEntryId',
        'answerEquivalenceGroupId',
        'scenarioFamilyId',
        'entryId'
      ]);
      assert.deepEqual(
        collectExactKeys(packet).filter(item => forbiddenExactKeys.has(item.key)),
        []
      );
    }
    assert.equal(JSON.stringify(a).includes('reviewer-b'), false);
    assert.equal(JSON.stringify(b).includes('reviewer-a'), false);
  }
});

test('equivalence and preferred decisions are separate and never preselected', () => {
  const packet = STRUCTURAL_REVIEW_PACKET_PAIRS.equivalencePreferred.reviewerA;
  assert.deepEqual(packet.decisionsRequired.map(item => item.decisionType), [
    'substantiveEquivalencePartition',
    'preferredEntrySelection'
  ]);
  assert.equal(packet.decisionsRequired[1].automaticSelectionAllowed, false);
  assert.equal(packet.decisionsRequired[0].phase, 1);
  assert.equal(packet.decisionsRequired[1].phase, 2);
  assert.equal(packet.responseContract.decisionPhaseOrderEnforced, true);
  assert.equal(packet.reviewItems.length, 5);
});

test('ambiguity review exposes all three mechanisms and excludes exact-date q039', () => {
  const packet = STRUCTURAL_REVIEW_PACKET_PAIRS.ambiguityFamilies.reviewerA;
  const mechanism = packet.decisionsRequired.find(item => item.decisionType === 'ambiguityMechanism');
  assert.deepEqual(mechanism.allowedValues, [
    'underspecifiedReference',
    'competingPublishedKnowledge',
    'alternativeIntentReadings'
  ]);
  for (const sectionKey of ['ambiguityFamilies', 'scenarioFamilyPreflight']) {
    const sourceItems = STRUCTURAL_REVIEW_SOURCE_PLAN.sections[sectionKey].sourceItems;
    assert.equal(sourceItems.some(item => item.entryIds.includes('equinoxe-q039')), false);
  }
});

test('scenario-family packet is an honest partial preflight, not a bound inventory', () => {
  const packet = STRUCTURAL_REVIEW_PACKET_PAIRS.scenarioFamilyPreflight.reviewerA;
  assert.equal(packet.reviewItems.length, 34);
  assert.ok(packet.limitations.some(value => value.includes('not the future 250–260-family inventory')));
  assert.ok(packet.limitations.some(value => value.includes('cannot be audited empirically')));
  assert.ok(packet.limitations.some(value => value.includes('No scenarioFamilyId is assigned')));
});

test('persisted response logs are separate, bound and never reset by package checks', () => {
  const filename = '01-equivalence-preferred.fr.response-log.json';
  const aPath = join(DEFAULT_STRUCTURAL_REVIEW_OUTPUT, 'responses', 'reviewer-a', filename);
  const bPath = join(DEFAULT_STRUCTURAL_REVIEW_OUTPUT, 'responses', 'reviewer-b', filename);
  const aBefore = readFileSync(aPath, 'utf8');
  const bBefore = readFileSync(bPath, 'utf8');
  const a = JSON.parse(aBefore);
  const b = JSON.parse(bBefore);
  assert.equal(a.events.length, 10);
  assert.equal(b.events.length, 10);
  assert.equal(a.status, 'IN_PROGRESS');
  assert.equal(b.status, 'IN_PROGRESS');
  assert.equal(a.reviewerSlot, 'A');
  assert.equal(b.reviewerSlot, 'B');
  assert.notEqual(a.packetFingerprint, b.packetFingerprint);
  materialiseStructuralReviewPackages({ checkOnly: true });
  assert.equal(readFileSync(aPath, 'utf8'), aBefore);
  assert.equal(readFileSync(bPath, 'utf8'), bBefore);
});

test('materialisation bootstraps missing response logs but preserves existing journals', () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'storm-structural-packages-'));
  try {
    materialiseStructuralReviewPackages({ outputDirectory: temporaryRoot });
    const journalPath = join(
      temporaryRoot,
      'responses',
      'reviewer-a',
      '01-equivalence-preferred.fr.response-log.json'
    );
    const existing = JSON.parse(readFileSync(journalPath, 'utf8'));
    const preserved = `${JSON.stringify(existing)}\n`;
    writeFileSync(journalPath, preserved, 'utf8');

    materialiseStructuralReviewPackages({ outputDirectory: temporaryRoot });
    assert.equal(readFileSync(journalPath, 'utf8'), preserved);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
