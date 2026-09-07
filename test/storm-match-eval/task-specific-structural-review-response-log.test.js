import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { canonicalJson, fingerprint } from './task-specific/human-review/review-packets.js';
import {
  appendStructuralReviewEvent,
  constructStructuralReviewLogWithEvent,
  createEmptyStructuralReviewResponseLog,
  createStructuralReviewerSeal,
  evaluateStructuralReviewCompleteness,
  getEffectiveStructuralDecisions,
  persistStructuralReviewerSeal,
  serialiseStructuralReviewResponseArtifact,
  structuralReviewerSealPathForJournal,
  validateStructuralReviewerSeal,
  validateStructuralReviewPacketContract,
  validateStructuralReviewResponseLog
} from './task-specific/human-review/structural-review-response-log.js';

const REVIEWER_IDENTITY = 'reviewer-a';
const GENERATED_REVIEW_DIRECTORY = join(
  import.meta.dirname,
  'task-specific',
  'human-review',
  'generated-structural-review'
);

const DECISIONS = Object.freeze({
  EQUIVALENCE_AND_PREFERRED: [
    {
      decisionType: 'substantiveEquivalencePartition',
      phase: 1,
      allowedValues: ['oneEquivalentGroup', 'multipleNonEquivalentGroups', 'insufficientEvidence'],
      rationaleRequired: true
    },
    {
      decisionType: 'preferredEntrySelection',
      phase: 2,
      prerequisiteDecisionType: 'substantiveEquivalencePartition',
      condition: 'required only for each reviewer-confirmed multi-entry equivalent group',
      allowedValues: ['chooseOneDisplayedKnowledgeRef', 'insufficientEvidence'],
      rationaleRequired: true,
      automaticSelectionAllowed: false
    }
  ],
  KNOWLEDGE_BOUNDARIES: [
    {
      decisionType: 'knowledgeComponentBoundary',
      allowedValues: ['sameConnectedComponent', 'separateComponents', 'partitionRequired', 'insufficientEvidence'],
      rationaleRequired: true
    },
    {
      decisionType: 'futureCoverageBoundaryRules',
      allowedValues: ['rulesDocumented', 'insufficientEvidence'],
      rationaleRequired: true
    }
  ],
  AMBIGUITY_CAPACITY_FAMILIES: [
    {
      decisionType: 'ambiguityFamilyDisposition',
      allowedValues: ['structuralAmbiguity', 'notCovered', 'artificialOrMalformed', 'blockedTemporalInstability', 'insufficientEvidence'],
      rationaleRequired: true
    },
    {
      decisionType: 'ambiguityMechanism',
      condition: 'required only when disposition is structuralAmbiguity',
      allowedValues: ['underspecifiedReference', 'competingPublishedKnowledge', 'alternativeIntentReadings'],
      rationaleRequired: true
    },
    {
      decisionType: 'substantiallyDifferentCoveredGroups',
      condition: 'required only when disposition is structuralAmbiguity',
      allowedValues: ['reviewerDefinedPartitionOfDisplayedKnowledge', 'insufficientEvidence'],
      rationaleRequired: true
    }
  ],
  SCENARIO_FAMILY_PREFLIGHT: [
    {
      decisionType: 'reviewerScenarioFamilyPartition',
      allowedValues: ['reviewerDefinedFamilyGroups', 'insufficientEvidence'],
      rationaleRequired: true
    },
    {
      decisionType: 'fragmentationAssessment',
      allowedValues: ['distinct', 'mergeWithAnotherDisplayedBrief', 'tooBroad', 'artificiallyFragmented', 'insufficientEvidence'],
      rationaleRequired: true
    }
  ]
});

function syntheticPacket(packetKind) {
  const withoutFingerprint = {
    schemaVersion: 1,
    packetKind,
    packetId: `synthetic-${packetKind.toLocaleLowerCase('en-US')}`,
    reviewerSlot: 'A',
    languageStratum: 'fr',
    reviewStatus: 'NOT_STARTED',
    humanQualityGateStatus: 'PENDING_HUMAN_REVIEW',
    generationAuthorized: false,
    decisionsRequired: structuredClone(DECISIONS[packetKind]),
    reviewItems: [
      {
        reviewItemRef: 'synthetic-item-001',
        title: 'Synthetic item',
        businessContext: 'Synthetic business context',
        knowledgeRefs: ['synthetic-knowledge-001', 'synthetic-knowledge-002']
      }
    ],
    knowledgeItems: [
      {
        knowledgeRef: 'synthetic-knowledge-001',
        canonicalQuestion: 'Question 1',
        canonicalAnswer: 'Answer 1'
      },
      {
        knowledgeRef: 'synthetic-knowledge-002',
        canonicalQuestion: 'Question 2',
        canonicalAnswer: 'Answer 2'
      }
    ]
  };
  return {
    ...withoutFingerprint,
    packetFingerprint: fingerprint(withoutFingerprint)
  };
}

function input(decisionType, decisionValue, overrides = {}) {
  return {
    reviewItemRef: 'synthetic-item-001',
    decisionType,
    decisionValue,
    rationale: `Rationale for ${decisionType}`,
    reviewerIdentity: REVIEWER_IDENTITY,
    languageCompetenceAttested: true,
    ...overrides
  };
}

function deterministicOptions() {
  return {
    eventIdFactory: ({ sequence }) => `synthetic-event-${String(sequence).padStart(3, '0')}`,
    clock: ({ sequence }) => `2026-09-07T00:00:${String(sequence).padStart(2, '0')}.000Z`
  };
}

function append(log, packet, decision) {
  return constructStructuralReviewLogWithEvent(log, packet, decision, deterministicOptions());
}

function completeBoundaryLog() {
  const packet = syntheticPacket('KNOWLEDGE_BOUNDARIES');
  let log = createEmptyStructuralReviewResponseLog(packet);
  log = append(log, packet, input('knowledgeComponentBoundary', 'partitionRequired'));
  log = append(log, packet, input('futureCoverageBoundaryRules', 'rulesDocumented'));
  return { packet, log };
}

function completeScenarioLog() {
  const packet = syntheticPacket('SCENARIO_FAMILY_PREFLIGHT');
  let log = createEmptyStructuralReviewResponseLog(packet);
  log = append(log, packet, input('reviewerScenarioFamilyPartition', 'reviewerDefinedFamilyGroups'));
  log = append(log, packet, input('fragmentationAssessment', 'distinct'));
  return { packet, log };
}

test('canonical SHA-256 ignores object key order and preserves array order', () => {
  assert.equal(fingerprint({ b: 2, a: { d: 4, c: 3 } }), fingerprint({ a: { c: 3, d: 4 }, b: 2 }));
  assert.notEqual(fingerprint({ values: ['a', 'b'] }), fingerprint({ values: ['b', 'a'] }));
});

test('first event starts at sequence 1 with a null previous hash', () => {
  const packet = syntheticPacket('KNOWLEDGE_BOUNDARIES');
  const empty = createEmptyStructuralReviewResponseLog(packet);
  const log = append(empty, packet, input('knowledgeComponentBoundary', 'partitionRequired'));
  assert.equal(log.events[0].sequence, 1);
  assert.equal(log.events[0].previousEventHash, null);
  assert.match(log.events[0].eventHash, /^[a-f0-9]{64}$/);
  assert.equal(empty.events.length, 0);
});

test('second event is chained to the first event hash', () => {
  const { packet, log } = completeBoundaryLog();
  assert.equal(log.events[1].sequence, 2);
  assert.equal(log.events[1].previousEventHash, log.events[0].eventHash);
  assert.equal(validateStructuralReviewResponseLog(log, packet).ok, true);
});

test('tampered event content is detected without rewriting its history', () => {
  const { packet, log } = completeBoundaryLog();
  const tampered = structuredClone(log);
  tampered.events[0].rationale = 'Tampered rationale';
  const result = validateStructuralReviewResponseLog(tampered, packet);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.code === 'INVALID_STRUCTURAL_EVENT_HASH'));
});

test('tampered previous event hash is detected', () => {
  const { packet, log } = completeBoundaryLog();
  const tampered = structuredClone(log);
  tampered.events[1].previousEventHash = '0'.repeat(64);
  const result = validateStructuralReviewResponseLog(tampered, packet);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.code === 'INVALID_STRUCTURAL_PREVIOUS_EVENT_HASH'));
});

test('sequence gaps and duplicate sequence numbers are detected', () => {
  const { packet, log } = completeBoundaryLog();
  for (const invalidSequence of [1, 3]) {
    const tampered = structuredClone(log);
    tampered.events[1].sequence = invalidSequence;
    const { eventHash: _ignored, ...withoutHash } = tampered.events[1];
    tampered.events[1].eventHash = fingerprint(withoutHash);
    const result = validateStructuralReviewResponseLog(tampered, packet);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(error => error.code === 'INVALID_STRUCTURAL_EVENT_SEQUENCE'));
  }
});

test('unknown review item, decision type and decision value are rejected', () => {
  const packet = syntheticPacket('KNOWLEDGE_BOUNDARIES');
  const log = createEmptyStructuralReviewResponseLog(packet);
  assert.throws(
    () => append(log, packet, input('knowledgeComponentBoundary', 'partitionRequired', { reviewItemRef: 'unknown-item' })),
    /Unknown structural reviewItemRef/
  );
  assert.throws(
    () => append(log, packet, input('unknownDecisionType', 'partitionRequired')),
    /Unknown structural decisionType/
  );
  assert.throws(
    () => append(log, packet, input('knowledgeComponentBoundary', 'unknownValue')),
    /Invalid structural decisionValue/
  );
});

test('empty rationale, empty reviewer identity and non-boolean language attestation are rejected', () => {
  const packet = syntheticPacket('KNOWLEDGE_BOUNDARIES');
  const log = createEmptyStructuralReviewResponseLog(packet);
  assert.throws(
    () => append(log, packet, input('knowledgeComponentBoundary', 'partitionRequired', { rationale: '   ' })),
    /rationale must be non-empty/
  );
  assert.throws(
    () => append(log, packet, input('knowledgeComponentBoundary', 'partitionRequired', { reviewerIdentity: '' })),
    /reviewerIdentity must be a non-empty opaque string/
  );
  assert.throws(
    () => append(log, packet, input('knowledgeComponentBoundary', 'partitionRequired', {
      languageCompetenceAttested: 'true'
    })),
    /languageCompetenceAttested must be a boolean/
  );
});

test('an unknown future decision condition fails closed', () => {
  const packet = syntheticPacket('AMBIGUITY_CAPACITY_FAMILIES');
  const unknown = structuredClone(packet);
  unknown.decisionsRequired[1].condition = 'required when a future condition is guessed';
  const { packetFingerprint: _ignored, ...withoutFingerprint } = unknown;
  unknown.packetFingerprint = fingerprint(withoutFingerprint);
  const result = validateStructuralReviewPacketContract(unknown);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.code === 'UNSUPPORTED_STRUCTURAL_DECISION_CONDITION'));
});

test('append-only correction preserves the first event and makes the second effective', () => {
  const packet = syntheticPacket('KNOWLEDGE_BOUNDARIES');
  let log = createEmptyStructuralReviewResponseLog(packet);
  log = append(log, packet, input('knowledgeComponentBoundary', 'sameConnectedComponent'));
  const firstEvent = structuredClone(log.events[0]);
  log = append(log, packet, input('knowledgeComponentBoundary', 'partitionRequired', {
    rationale: 'Superseding append-only correction.'
  }));
  assert.deepEqual(log.events[0], firstEvent);
  assert.equal(log.events.length, 2);
  assert.equal(
    getEffectiveStructuralDecisions(log)['synthetic-item-001'].knowledgeComponentBoundary.decisionValue,
    'partitionRequired'
  );
});

test('ambiguity-family conditional decisions are required only for structural ambiguity', () => {
  const packet = syntheticPacket('AMBIGUITY_CAPACITY_FAMILIES');
  let notCovered = createEmptyStructuralReviewResponseLog(packet);
  notCovered = append(notCovered, packet, input('ambiguityFamilyDisposition', 'notCovered'));
  assert.equal(evaluateStructuralReviewCompleteness(notCovered, packet).complete, true);

  let structural = createEmptyStructuralReviewResponseLog(packet);
  structural = append(structural, packet, input('ambiguityFamilyDisposition', 'structuralAmbiguity'));
  const incomplete = evaluateStructuralReviewCompleteness(structural, packet);
  assert.equal(incomplete.valid, true);
  assert.equal(incomplete.complete, false);
  assert.deepEqual(incomplete.conditionalMissingDecisions, [
    { reviewItemRef: 'synthetic-item-001', decisionType: 'ambiguityMechanism' },
    { reviewItemRef: 'synthetic-item-001', decisionType: 'substantiallyDifferentCoveredGroups' }
  ]);
  structural = append(structural, packet, input('ambiguityMechanism', 'alternativeIntentReadings'));
  structural = append(
    structural,
    packet,
    input('substantiallyDifferentCoveredGroups', 'reviewerDefinedPartitionOfDisplayedKnowledge')
  );
  assert.equal(evaluateStructuralReviewCompleteness(structural, packet).complete, true);
});

test('equivalence preferred-entry phase follows the reviewer-confirmed partition', () => {
  const packet = syntheticPacket('EQUIVALENCE_AND_PREFERRED');
  let log = createEmptyStructuralReviewResponseLog(packet);
  assert.throws(
    () => append(log, packet, input('preferredEntrySelection', 'chooseOneDisplayedKnowledgeRef')),
    /requires a prior reviewer-confirmed equivalence partition/
  );
  log = append(log, packet, input('substantiveEquivalencePartition', 'oneEquivalentGroup'));
  assert.deepEqual(evaluateStructuralReviewCompleteness(log, packet).conditionalMissingDecisions, [
    { reviewItemRef: 'synthetic-item-001', decisionType: 'preferredEntrySelection' }
  ]);
  log = append(log, packet, input('preferredEntrySelection', 'chooseOneDisplayedKnowledgeRef'));
  assert.equal(evaluateStructuralReviewCompleteness(log, packet).complete, true);
});

test('cryptographically valid but incomplete journal is not sealable', () => {
  const packet = syntheticPacket('KNOWLEDGE_BOUNDARIES');
  let log = createEmptyStructuralReviewResponseLog(packet);
  log = append(log, packet, input('knowledgeComponentBoundary', 'partitionRequired'));
  const result = evaluateStructuralReviewCompleteness(log, packet);
  assert.equal(result.valid, true);
  assert.equal(result.complete, false);
  assert.throws(
    () => createStructuralReviewerSeal({
      reviewerSlot: 'A',
      reviewerIdentity: REVIEWER_IDENTITY,
      sealedAt: '2026-09-07T01:00:00.000Z',
      journals: [{ packet, log, journalPath: 'responses/reviewer-a/boundaries.json' }]
    }),
    /Cannot seal incomplete or invalid structural journal/
  );
});

test('global reviewer seal fails when one journal in its expected set is incomplete', () => {
  const complete = completeBoundaryLog();
  const incompletePacket = syntheticPacket('SCENARIO_FAMILY_PREFLIGHT');
  let incompleteLog = createEmptyStructuralReviewResponseLog(incompletePacket);
  incompleteLog = append(
    incompleteLog,
    incompletePacket,
    input('reviewerScenarioFamilyPartition', 'reviewerDefinedFamilyGroups')
  );
  assert.throws(
    () => createStructuralReviewerSeal({
      reviewerSlot: 'A',
      reviewerIdentity: REVIEWER_IDENTITY,
      sealedAt: '2026-09-07T01:00:00.000Z',
      journals: [
        { packet: complete.packet, log: complete.log, journalPath: 'responses/reviewer-a/boundaries.json' },
        { packet: incompletePacket, log: incompleteLog, journalPath: 'responses/reviewer-a/scenarios.json' }
      ]
    }),
    /Cannot seal incomplete or invalid structural journal/
  );
});

test('complete valid journal is sealable and remains separate from the seal', () => {
  const { packet, log } = completeBoundaryLog();
  const beforeSeal = canonicalJson(log);
  const journals = [{ packet, log, journalPath: 'responses/reviewer-a/boundaries.json' }];
  const seal = createStructuralReviewerSeal({
    reviewerSlot: 'A',
    reviewerIdentity: REVIEWER_IDENTITY,
    sealedAt: '2026-09-07T01:00:00.000Z',
    journals
  });
  assert.equal(validateStructuralReviewerSeal(seal, journals).ok, true);
  assert.equal(seal.packetSeals[0].eventCount, 2);
  assert.equal(seal.packetSeals[0].finalEventHash, log.events[1].eventHash);
  assert.equal(seal.packetSeals[0].journalCanonicalSha256, fingerprint(log));
  assert.equal(canonicalJson(log), beforeSeal);
});

test('global reviewer seal binds multiple complete journals independently', () => {
  const boundary = completeBoundaryLog();
  const scenario = completeScenarioLog();
  const journals = [
    { packet: boundary.packet, log: boundary.log, journalPath: 'responses/reviewer-a/boundaries.json' },
    { packet: scenario.packet, log: scenario.log, journalPath: 'responses/reviewer-a/scenarios.json' }
  ];
  const seal = createStructuralReviewerSeal({
    reviewerSlot: 'A',
    reviewerIdentity: REVIEWER_IDENTITY,
    sealedAt: '2026-09-07T01:00:00.000Z',
    journals
  });
  assert.equal(seal.packetSeals.length, 2);
  assert.equal(validateStructuralReviewerSeal(seal, journals).ok, true);
});

test('seal requires positive language competence attestation for every event', () => {
  const { packet, log } = completeBoundaryLog();
  const falseAttestation = structuredClone(log);
  falseAttestation.events[0].languageCompetenceAttested = false;
  const { eventHash: _ignored, ...withoutEventHash } = falseAttestation.events[0];
  falseAttestation.events[0].eventHash = fingerprint(withoutEventHash);
  falseAttestation.events[1].previousEventHash = falseAttestation.events[0].eventHash;
  const { eventHash: _ignoredSecond, ...withoutSecondHash } = falseAttestation.events[1];
  falseAttestation.events[1].eventHash = fingerprint(withoutSecondHash);
  assert.equal(validateStructuralReviewResponseLog(falseAttestation, packet).ok, true);
  assert.throws(
    () => createStructuralReviewerSeal({
      reviewerSlot: 'A',
      reviewerIdentity: REVIEWER_IDENTITY,
      sealedAt: '2026-09-07T01:00:00.000Z',
      journals: [{ packet, log: falseAttestation, journalPath: 'responses/reviewer-a/boundaries.json' }]
    }),
    /Reviewer identity mismatch/
  );
});

test('response log bound to the wrong packet fingerprint is rejected', () => {
  const { packet, log } = completeBoundaryLog();
  const wrong = structuredClone(log);
  wrong.packetFingerprint = '0'.repeat(64);
  const result = validateStructuralReviewResponseLog(wrong, packet);
  assert.equal(result.ok, false);
  assert.equal(result.bindingValid, false);
  assert.ok(result.errors.some(error => error.code === 'STRUCTURAL_RESPONSE_PACKET_MISMATCH'));
});

test('seal tampering is detected', () => {
  const { packet, log } = completeBoundaryLog();
  const seal = createStructuralReviewerSeal({
    reviewerSlot: 'A',
    reviewerIdentity: REVIEWER_IDENTITY,
    sealedAt: '2026-09-07T01:00:00.000Z',
    journals: [{ packet, log, journalPath: 'responses/reviewer-a/boundaries.json' }]
  });
  const tampered = structuredClone(seal);
  tampered.packetSeals[0].eventCount = 3;
  const result = validateStructuralReviewerSeal(tampered);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.code === 'INVALID_STRUCTURAL_SEAL_HASH'));
});

test('persistent append derives seal state and cannot be bypassed by omitting a seal argument', () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'storm-structural-review-'));
  try {
    const reviewerDirectory = join(temporaryRoot, 'reviewer-a');
    const packetPath = join(temporaryRoot, 'packet.json');
    const journalPath = join(reviewerDirectory, 'boundaries.response-log.json');
    mkdirSync(reviewerDirectory, { recursive: true });
    const packet = syntheticPacket('KNOWLEDGE_BOUNDARIES');
    writeFileSync(packetPath, serialiseStructuralReviewResponseArtifact(packet), 'utf8');
    writeFileSync(
      journalPath,
      serialiseStructuralReviewResponseArtifact(createEmptyStructuralReviewResponseLog(packet)),
      'utf8'
    );

    const appendPersisted = decision => appendStructuralReviewEvent({
      journalPath,
      packetPath,
      input: decision,
      ...deterministicOptions()
    });

    const first = appendPersisted(input('knowledgeComponentBoundary', 'partitionRequired'));
    assert.equal(first.events.length, 1);
    const complete = appendPersisted(input('futureCoverageBoundaryRules', 'rulesDocumented'));
    assert.equal(evaluateStructuralReviewCompleteness(complete, packet).complete, true);

    const { sealPath, seal } = persistStructuralReviewerSeal({
      reviewerDirectory,
      reviewerSlot: 'A',
      reviewerIdentity: REVIEWER_IDENTITY,
      sealedAt: '2026-09-07T01:00:00.000Z',
      journals: [{ packetPath, journalPath }]
    });
    assert.equal(sealPath, structuralReviewerSealPathForJournal(journalPath));
    assert.equal(validateStructuralReviewerSeal(seal).ok, true);

    const journalBeforeRejectedAppend = readFileSync(journalPath, 'utf8');
    const parsedBeforeRejectedAppend = JSON.parse(journalBeforeRejectedAppend);
    const canonicalHashBefore = fingerprint(parsedBeforeRejectedAppend);
    const finalEventHashBefore = parsedBeforeRejectedAppend.events.at(-1).eventHash;

    assert.throws(
      () => appendPersisted(input('knowledgeComponentBoundary', 'separateComponents', {
        rationale: 'Attempted post-seal correction without passing any seal argument.'
      })),
      /covered by a valid reviewer seal/
    );
    assert.equal(readFileSync(journalPath, 'utf8'), journalBeforeRejectedAppend);

    const tamperedSeal = structuredClone(seal);
    tamperedSeal.packetSeals[0].eventCount += 1;
    writeFileSync(sealPath, serialiseStructuralReviewResponseArtifact(tamperedSeal), 'utf8');
    assert.throws(
      () => appendPersisted(input('knowledgeComponentBoundary', 'sameConnectedComponent', {
        rationale: 'Attempted append while the persisted seal is tampered.'
      })),
      /seal is invalid; append fails closed/
    );

    const parsedAfterRejectedAppends = JSON.parse(readFileSync(journalPath, 'utf8'));
    assert.equal(fingerprint(parsedAfterRejectedAppends), canonicalHashBefore);
    assert.equal(parsedAfterRejectedAppends.events.at(-1).eventHash, finalEventHashBefore);
    assert.equal(readFileSync(journalPath, 'utf8'), journalBeforeRejectedAppend);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test('operations never mutate the source packet', () => {
  const packet = syntheticPacket('SCENARIO_FAMILY_PREFLIGHT');
  const before = canonicalJson(packet);
  let log = createEmptyStructuralReviewResponseLog(packet);
  log = append(log, packet, input('reviewerScenarioFamilyPartition', 'reviewerDefinedFamilyGroups'));
  log = append(log, packet, input('fragmentationAssessment', 'distinct'));
  evaluateStructuralReviewCompleteness(log, packet);
  assert.equal(canonicalJson(packet), before);
});

test('all four real Reviewer A journals are complete and covered by their persisted seal', () => {
  const expected = [
    ['01-equivalence-preferred.fr', '0c9db08b70360d9ec942208bae0856809e304014513fc800a21d11a98102a6a0', 10],
    ['02-knowledge-boundaries.fr', 'e56af278f61e6876755b607a281b31a3d6bde517d377fc4f3b406eab9b8d79d0', 8],
    ['03-ambiguity-families.fr', 'cc1442bd1262061e9159ff273a3389d5bb377f0e33da064044f5e60b5887982c', 96],
    ['04-scenario-family-preflight.fr', '247973df424adea4d41e48fa32cad7d7bfc0cbc9be73bf6376477b5671a9ccbd', 68]
  ];
  const sealPath = join(
    GENERATED_REVIEW_DIRECTORY,
    'responses',
    'reviewer-a',
    'structural-reviewer-seal.json'
  );
  const seal = JSON.parse(readFileSync(sealPath, 'utf8'));
  const descriptors = [];
  for (const [name, packetFingerprint, eventCount] of expected) {
    const packet = JSON.parse(readFileSync(join(GENERATED_REVIEW_DIRECTORY, 'reviewer-a', `${name}.json`), 'utf8'));
    const journalPath = join(GENERATED_REVIEW_DIRECTORY, 'responses', 'reviewer-a', `${name}.response-log.json`);
    const log = JSON.parse(readFileSync(
      journalPath,
      'utf8'
    ));
    assert.deepEqual(validateStructuralReviewPacketContract(packet), { ok: true, errors: [] });
    assert.equal(packet.packetFingerprint, packetFingerprint);
    assert.equal(packet.generationAuthorized, false);
    assert.equal(packet.humanQualityGateStatus, 'PENDING_HUMAN_REVIEW');
    assert.equal(log.packetFingerprint, packetFingerprint);
    assert.equal(log.status, 'IN_PROGRESS');
    assert.equal(log.events.length, eventCount);
    const validation = evaluateStructuralReviewCompleteness(log, packet);
    assert.equal(validation.valid, true);
    assert.equal(validation.complete, true);
    assert.equal(validation.eventCount, eventCount);
    assert.match(validation.finalEventHash, /^[a-f0-9]{64}$/);
    descriptors.push({ packet, log, journalPath: `${name}.response-log.json` });
  }
  assert.equal(seal.reviewerSlot, 'A');
  assert.equal(seal.reviewerIdentity, REVIEWER_IDENTITY);
  assert.equal(seal.packetSeals.length, 4);
  assert.deepEqual(validateStructuralReviewerSeal(seal, descriptors), { ok: true, errors: [] });
});
