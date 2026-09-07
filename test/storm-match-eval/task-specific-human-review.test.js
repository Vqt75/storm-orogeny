import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createIndependentReviewPackets,
  fingerprint,
  HUMAN_REVIEW_STATUS,
  REVIEW_DECISION_GRID,
  STRUCTURAL_REVIEW_PACKET_SCHEMA,
  validateIndependentReviewPackets
} from './task-specific/human-review/review-packets.js';
import {
  appendReviewerResponseRecord,
  createEmptyReviewerResponseLog,
  sealReviewerResponseLog,
  validateSealedReviewerSubmission
} from './task-specific/human-review/review-response-log.js';
import {
  appendAdjudicationRecord,
  createEmptyAdjudicationLog,
  validateAdjudicationLog
} from './task-specific/human-review/adjudication-log.js';

const neutralSource = {
  sourceFingerprint: 'a'.repeat(64),
  knowledgeEntries: [
    {
      entryId: 'fixture-q001',
      canonicalQuestion: 'Question alpha ?',
      canonicalAnswer: 'Réponse alpha.',
      preferredTieBreakRank: 1
    },
    {
      entryId: 'fixture-q002',
      canonicalQuestion: 'Question bêta ?',
      canonicalAnswer: 'Réponse bêta.',
      preferredTieBreakRank: 2
    },
    {
      entryId: 'fixture-q003',
      canonicalQuestion: 'Question gamma ?',
      canonicalAnswer: 'Réponse gamma.',
      preferredTieBreakRank: 3
    },
    {
      entryId: 'fixture-q004',
      canonicalQuestion: 'Question delta ?',
      canonicalAnswer: 'Réponse delta.',
      preferredTieBreakRank: 4
    }
  ],
  queryItems: [
    {
      caseId: 'fixture-case-001',
      query: 'Demande synthétique une ?',
      candidateEntryIds: ['fixture-q001', 'fixture-q002'],
      businessContext: 'Contexte synthétique sans décision.',
      language: 'fr'
    },
    {
      caseId: 'fixture-case-002',
      query: 'Demande synthétique deux ?',
      candidateEntryIds: ['fixture-q002', 'fixture-q003'],
      businessContext: null,
      language: 'fr'
    },
    {
      caseId: 'fixture-case-003',
      query: 'Demande synthétique trois ?',
      candidateEntryIds: ['fixture-q003', 'fixture-q004'],
      businessContext: null,
      language: 'fr'
    }
  ]
};

const seeds = {
  reviewerASeed: 'reviewer-a-fixture-seed-2026',
  reviewerBSeed: 'reviewer-b-fixture-seed-2026'
};

function withoutField(value, field) {
  const { [field]: _ignored, ...rest } = value;
  return rest;
}

function resolveCandidateOrders(bundle, reviewerKey) {
  const packet = bundle[reviewerKey].packet;
  const slot = reviewerKey === 'reviewerA' ? 'reviewerA' : 'reviewerB';
  const entryIdByRef = new Map(bundle.curatorLinkage.knowledgeRefs.map(item => [item[slot], item.entryId]));
  const caseIdByRef = new Map(bundle.curatorLinkage.queryRefs.map(item => [item[slot], item.caseId]));
  return new Map(packet.queryItems.map(item => [
    caseIdByRef.get(item.reviewItemRef),
    item.candidateKnowledgeRefs.map(ref => entryIdByRef.get(ref))
  ]));
}

function buildSealedSyntheticSubmission(packet, reviewerId, prefix, { coveredPair = null } = {}) {
  let log = createEmptyReviewerResponseLog(packet, { reviewerId });
  let sequence = 0;
  const groupRefByKnowledgeRef = new Map(
    packet.knowledgeItems.map((knowledge, index) => [
      knowledge.knowledgeRef,
      `${prefix}-group-${String(index + 1).padStart(3, '0')}`
    ])
  );
  const append = (eventType, payload) => {
    sequence += 1;
    log = appendReviewerResponseRecord(log, {
      eventId: `${prefix}-event-${String(sequence).padStart(3, '0')}`,
      eventType,
      recordedAt: `2026-09-06T00:${String(sequence).padStart(2, '0')}:00.000Z`,
      payload
    });
  };

  for (const query of packet.queryItems) {
    for (const knowledgeRef of query.candidateKnowledgeRefs) {
      append('candidateDecision', {
        reviewItemRef: query.reviewItemRef,
        knowledgeRef,
        decision: coveredPair?.reviewItemRef === query.reviewItemRef
          && coveredPair?.knowledgeRef === knowledgeRef ? 'covered' : 'notCovered',
        rationale: 'Jugement synthétique servant uniquement au test du format.'
      });
    }
  }
  for (const [index, knowledge] of packet.knowledgeItems.entries()) {
    append('answerEquivalenceGroup', {
      reviewerGroupRef: groupRefByKnowledgeRef.get(knowledge.knowledgeRef),
      memberKnowledgeRefs: [knowledge.knowledgeRef],
      preferredKnowledgeRef: knowledge.knowledgeRef,
      rationale: 'Singleton synthétique servant uniquement au test du format.'
    });
  }
  for (const query of packet.queryItems) {
    const coveredKnowledgeRef = coveredPair?.reviewItemRef === query.reviewItemRef
      ? coveredPair.knowledgeRef
      : null;
    append('systemOutcome', {
      reviewItemRef: query.reviewItemRef,
      outcome: coveredKnowledgeRef ? 'covered' : 'notCovered',
      coveredReviewerGroupRef: coveredKnowledgeRef ? groupRefByKnowledgeRef.get(coveredKnowledgeRef) : null,
      rationale: 'Outcome synthétique servant uniquement au test du format.'
    });
    append('dangerousFalsePositiveOpportunity', {
      reviewItemRef: query.reviewItemRef,
      isOpportunity: false,
      consequenceCategory: 'none',
      rationale: 'Risque synthétique servant uniquement au test du format.'
    });
  }

  return sealReviewerResponseLog(log, packet, {
    sealedAt: '2026-09-06T01:00:00.000Z',
    attestation: {
      reviewerId,
      statement: 'Fixture technique : complétude et scellement vérifiés manuellement pour ce test.',
      languageStratum: packet.reviewerIdentity.languageStratum,
      languageCompetenceAttested: true
    }
  });
}

test('review packets are deterministic, independent, blind and reproducible', () => {
  const first = createIndependentReviewPackets(neutralSource, seeds);
  const second = createIndependentReviewPackets(neutralSource, seeds);
  assert.deepEqual(first, second);
  assert.deepEqual(validateIndependentReviewPackets(first, seeds), { ok: true, errors: [] });

  const a = first.reviewerA.packet;
  const b = first.reviewerB.packet;
  assert.equal(first.qualityGateManifest.holdoutQualityGateStatus, HUMAN_REVIEW_STATUS);
  assert.equal(first.qualityGateManifest.adjudicationStatus, 'BLOCKED_WAITING_FOR_BOTH');
  assert.equal(first.qualityGateManifest.automaticCompletionAllowed, false);
  assert.notEqual(a.packetFingerprint, b.packetFingerprint);
  assert.notEqual(a.blindNamespace, b.blindNamespace);
  assert.deepEqual(a.decisionGrid, REVIEW_DECISION_GRID);
  assert.deepEqual(b.decisionGrid, REVIEW_DECISION_GRID);
  assert.deepEqual(a.reviewerIdentity, {
    reviewerRole: 'A',
    assignmentScope: 'PER_LANGUAGE_STRATUM',
    languageStratum: 'fr',
    physicalReviewerPreassigned: false,
    languageCompetenceRequired: true
  });
  assert.deepEqual(b.reviewerIdentity, {
    reviewerRole: 'B',
    assignmentScope: 'PER_LANGUAGE_STRATUM',
    languageStratum: 'fr',
    physicalReviewerPreassigned: false,
    languageCompetenceRequired: true
  });
  assert.equal(a.isolation.prefilledJudgmentsIncluded, false);
  assert.equal(b.isolation.otherReviewerResponsesIncluded, false);
  assert.equal(JSON.stringify(a).includes(seeds.reviewerASeed), false);
  assert.equal(JSON.stringify(b).includes(seeds.reviewerBSeed), false);
  assert.equal(JSON.stringify(a).includes('fixture-q001'), false);
  assert.equal(JSON.stringify(b).includes('fixture-case-001'), false);

  const candidatesA = resolveCandidateOrders(first, 'reviewerA');
  const candidatesB = resolveCandidateOrders(first, 'reviewerB');
  for (const [caseId, orderA] of candidatesA) assert.notDeepEqual(orderA, candidatesB.get(caseId));
});

test('review packet builder rejects labels, scores, source metadata and ambiguous tie-break ranks', () => {
  assert.throws(
    () => createIndependentReviewPackets({
      ...neutralSource,
      queryItems: [{ ...neutralSource.queryItems[0], expectedEntryId: 'fixture-q001' }, ...neutralSource.queryItems.slice(1)]
    }, seeds),
    /forbidden or unexpected fields: expectedEntryId/
  );
  assert.throws(
    () => createIndependentReviewPackets({
      ...neutralSource,
      knowledgeEntries: [{ ...neutralSource.knowledgeEntries[0], score: 0.99 }, ...neutralSource.knowledgeEntries.slice(1)]
    }, seeds),
    /forbidden or unexpected fields: score/
  );
  assert.throws(
    () => createIndependentReviewPackets({
      ...neutralSource,
      knowledgeEntries: neutralSource.knowledgeEntries.map(item => ({ ...item, preferredTieBreakRank: 1 }))
    }, seeds),
    /preferredTieBreakRank values must be unique/
  );
  assert.throws(
    () => createIndependentReviewPackets({
      ...neutralSource,
      knowledgeEntries: [
        { ...neutralSource.knowledgeEntries[0], canonicalQuestion: { peerOpinion: 'Reviewer B chose covered' } },
        ...neutralSource.knowledgeEntries.slice(1)
      ]
    }, seeds),
    /needs an id, question and answer/
  );
});

test('review packet builder requires independent seeds', () => {
  assert.throws(
    () => createIndependentReviewPackets(neutralSource, {
      reviewerASeed: 'same-seed',
      reviewerBSeed: 'same-seed'
    }),
    /Two distinct non-empty reviewer seeds/
  );
});

test('review packet builder enforces one supported language stratum per bundle', () => {
  assert.throws(
    () => createIndependentReviewPackets({
      ...neutralSource,
      queryItems: [neutralSource.queryItems[0], { ...neutralSource.queryItems[1], language: 'en' }]
    }, seeds),
    /exactly one language stratum/
  );
  assert.throws(
    () => createIndependentReviewPackets({
      ...neutralSource,
      queryItems: neutralSource.queryItems.map(item => ({ ...item, language: 'xx' }))
    }, seeds),
    /language must be one of/
  );
});

test('structure-review schema supports blind monolingual equivalence, preferred and cluster decisions', () => {
  const schema = STRUCTURAL_REVIEW_PACKET_SCHEMA;
  assert.equal(schema.reviewStatus, HUMAN_REVIEW_STATUS);
  assert.equal(schema.languageMode, 'EXACTLY_ONE_LANGUAGE_PER_PACKET');
  assert.deepEqual(schema.supportedLanguageStrata, ['fr', 'en', 'de', 'es', 'it', 'nl']);
  assert.deepEqual(schema.reviewerRoles, ['A', 'B']);
  assert.equal(schema.independentDecisionSections.equivalencePartition.preferredEntryIncluded, false);
  assert.equal(schema.independentDecisionSections.preferredEntrySelection.separateFromEquivalenceDecision, true);
  assert.deepEqual(schema.independentDecisionSections.knowledgeBoundaryDecision.allowedValues, [
    'sameConnectedComponent',
    'separateComponents'
  ]);
  assert.equal(schema.responsePolicy.twoIndependentHumanSubmissionsRequired, true);
  assert.equal(schema.responsePolicy.appendOnlyAdjudicationRequired, true);
  assert.equal(schema.responsePolicy.originalReviewerDecisionsPreserved, true);
  assert.equal(schema.finalPacketGenerationAuthorized, false);
  for (const value of Object.values(schema.isolation)) assert.equal(value, false);
  const serialised = JSON.stringify(schema);
  for (const forbidden of ['DistilUSE', 'cosineSimilarity']) {
    assert.equal(serialised.includes(forbidden), false);
  }
});

test('static gate detects injected output and forged packet order', () => {
  const original = createIndependentReviewPackets(neutralSource, seeds);
  const contaminated = structuredClone(original);
  contaminated.reviewerA.packet.queryItems[0].modelOutput = { score: 0.9 };
  let result = validateIndependentReviewPackets(contaminated, seeds);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.code === 'PREFILLED_MODEL_OR_SOURCE_FIELD'));
  assert.ok(result.errors.some(error => error.code === 'PACKET_FINGERPRINT_MISMATCH'));

  const peerLeak = structuredClone(original);
  peerLeak.reviewerA.packet.queryItems[0].peerOpinion = 'Reviewer B chose covered';
  peerLeak.reviewerA.packet.packetFingerprint = fingerprint(withoutField(peerLeak.reviewerA.packet, 'packetFingerprint'));
  peerLeak.curatorLinkage.packetFingerprints.reviewerA = peerLeak.reviewerA.packet.packetFingerprint;
  peerLeak.curatorLinkage.linkageFingerprint = fingerprint(withoutField(peerLeak.curatorLinkage, 'linkageFingerprint'));
  result = validateIndependentReviewPackets(peerLeak, seeds);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.code === 'INVALID_QUERY_ITEM_SCHEMA'));

  const reordered = structuredClone(original);
  reordered.reviewerA.packet.queryItems.reverse();
  reordered.reviewerA.packet.packetFingerprint = fingerprint(withoutField(reordered.reviewerA.packet, 'packetFingerprint'));
  reordered.curatorLinkage.packetFingerprints.reviewerA = reordered.reviewerA.packet.packetFingerprint;
  reordered.curatorLinkage.linkageFingerprint = fingerprint(withoutField(reordered.curatorLinkage, 'linkageFingerprint'));
  result = validateIndependentReviewPackets(reordered, seeds);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.code === 'QUERY_ORDER_FINGERPRINT_MISMATCH'));
  assert.ok(result.errors.some(error => error.code === 'QUERY_ORDER_NOT_REPRODUCIBLE'));
});

test('review response logs are distinct, empty by default and independently sealable', () => {
  const packets = createIndependentReviewPackets(neutralSource, seeds);
  const emptyA = createEmptyReviewerResponseLog(packets.reviewerA.packet, { reviewerId: 'vivien' });
  const emptyB = createEmptyReviewerResponseLog(packets.reviewerB.packet, { reviewerId: 'independent-human-b' });
  assert.deepEqual(emptyA.records, []);
  assert.deepEqual(emptyB.records, []);
  assert.notEqual(emptyA.packetFingerprint, emptyB.packetFingerprint);
  assert.equal(JSON.stringify(emptyA).includes(emptyB.packetFingerprint), false);
  assert.equal(JSON.stringify(emptyB).includes(emptyA.packetFingerprint), false);

  const sealedA = buildSealedSyntheticSubmission(packets.reviewerA.packet, 'vivien', 'a');
  const sealedB = buildSealedSyntheticSubmission(packets.reviewerB.packet, 'independent-human-b', 'b');
  assert.deepEqual(validateSealedReviewerSubmission(sealedA, packets.reviewerA.packet), { ok: true, errors: [] });
  assert.deepEqual(validateSealedReviewerSubmission(sealedB, packets.reviewerB.packet), { ok: true, errors: [] });
  assert.notEqual(sealedA.submissionFingerprint, sealedB.submissionFingerprint);

  const anonymousB = structuredClone(sealedB);
  anonymousB.reviewerId = null;
  anonymousB.humanAttestation.reviewerId = null;
  anonymousB.submissionFingerprint = fingerprint(withoutField(anonymousB, 'submissionFingerprint'));
  const anonymousValidation = validateSealedReviewerSubmission(anonymousB, packets.reviewerB.packet);
  assert.equal(anonymousValidation.ok, false);
  assert.ok(anonymousValidation.errors.some(error => error.code === 'MISSING_REVIEWER_ID'));
});

test('adjudication is blocked until two sealed submissions and remains append-only', () => {
  assert.throws(
    () => createEmptyAdjudicationLog({}),
    /two complete sealed human submissions/
  );

  const packets = createIndependentReviewPackets(neutralSource, seeds);
  const sourceQuery = packets.curatorLinkage.queryRefs.find(item => item.caseId === 'fixture-case-001');
  const sourceKnowledge = packets.curatorLinkage.knowledgeRefs.find(item => item.entryId === 'fixture-q001');
  const sealedA = buildSealedSyntheticSubmission(packets.reviewerA.packet, 'vivien', 'a');
  const sealedB = buildSealedSyntheticSubmission(
    packets.reviewerB.packet,
    'independent-human-b',
    'b',
    { coveredPair: { reviewItemRef: sourceQuery.reviewerB, knowledgeRef: sourceKnowledge.reviewerB } }
  );
  const samePhysicalReviewerB = buildSealedSyntheticSubmission(
    packets.reviewerB.packet,
    'vivien',
    'same-human-b'
  );
  assert.throws(
    () => createEmptyAdjudicationLog({
      reviewerASubmission: sealedA,
      reviewerBSubmission: samePhysicalReviewerB,
      reviewerAPacket: packets.reviewerA.packet,
      reviewerBPacket: packets.reviewerB.packet,
      curatorLinkage: packets.curatorLinkage
    }),
    /independent human reviewers/
  );
  const candidateEventA = sealedA.records.find(record => record.eventType === 'candidateDecision'
    && record.payload.reviewItemRef === sourceQuery.reviewerA
    && record.payload.knowledgeRef === sourceKnowledge.reviewerA);
  const candidateEventB = sealedB.records.find(record => record.eventType === 'candidateDecision'
    && record.payload.reviewItemRef === sourceQuery.reviewerB
    && record.payload.knowledgeRef === sourceKnowledge.reviewerB);
  const systemEventA = sealedA.records.find(record => record.eventType === 'systemOutcome'
    && record.payload.reviewItemRef === sourceQuery.reviewerA);
  const systemEventB = sealedB.records.find(record => record.eventType === 'systemOutcome'
    && record.payload.reviewItemRef === sourceQuery.reviewerB);
  const forgedIncompleteA = structuredClone(sealedA);
  forgedIncompleteA.records = [];
  forgedIncompleteA.submissionFingerprint = fingerprint(withoutField(forgedIncompleteA, 'submissionFingerprint'));
  assert.throws(
    () => createEmptyAdjudicationLog({
      reviewerASubmission: forgedIncompleteA,
      reviewerBSubmission: sealedB,
      reviewerAPacket: packets.reviewerA.packet,
      reviewerBPacket: packets.reviewerB.packet,
      curatorLinkage: packets.curatorLinkage
    }),
    /two complete sealed human submissions/
  );
  const incompleteLinkage = structuredClone(packets.curatorLinkage);
  incompleteLinkage.knowledgeRefs.pop();
  incompleteLinkage.linkageFingerprint = fingerprint(withoutField(incompleteLinkage, 'linkageFingerprint'));
  assert.throws(
    () => createEmptyAdjudicationLog({
      reviewerASubmission: sealedA,
      reviewerBSubmission: sealedB,
      reviewerAPacket: packets.reviewerA.packet,
      reviewerBPacket: packets.reviewerB.packet,
      curatorLinkage: incompleteLinkage
    }),
    /mapping is not unique and exhaustive/
  );
  const empty = createEmptyAdjudicationLog({
    reviewerASubmission: sealedA,
    reviewerBSubmission: sealedB,
    reviewerAPacket: packets.reviewerA.packet,
    reviewerBPacket: packets.reviewerB.packet,
    curatorLinkage: packets.curatorLinkage
  });
  assert.throws(
    () => appendAdjudicationRecord(empty, {
      eventId: 'invalid-null-resolution',
      eventStatus: 'RESOLVED',
      disagreementId: 'invalid-null-resolution',
      subjectType: 'candidateLevel',
      reviewerAResponseEventIds: [candidateEventA.eventId],
      reviewerBResponseEventIds: [candidateEventB.eventId],
      adjudicatedDecision: null,
      adjudicatorId: 'human-adjudicator',
      rationale: 'Fixture négative.',
      decidedAt: '2026-09-06T01:58:00.000Z',
      supersedesEventId: null
    }),
    /typed non-null decision/
  );
  const mismatchedEventB = sealedB.records.find(record => record.eventType === 'candidateDecision'
    && (record.payload.reviewItemRef !== sourceQuery.reviewerB
      || record.payload.knowledgeRef !== sourceKnowledge.reviewerB));
  assert.throws(
    () => appendAdjudicationRecord(empty, {
      eventId: 'invalid-cross-subject-event',
      eventStatus: 'OPEN',
      disagreementId: 'invalid-cross-subject-disagreement',
      subjectType: 'candidateLevel',
      reviewerAResponseEventIds: [candidateEventA.eventId],
      reviewerBResponseEventIds: [mismatchedEventB.eventId],
      adjudicatedDecision: null,
      adjudicatorId: 'human-adjudicator',
      rationale: 'Fixture négative.',
      decidedAt: '2026-09-06T01:59:00.000Z',
      supersedesEventId: null
    }),
    /same source subject/
  );
  const alignedB = buildSealedSyntheticSubmission(packets.reviewerB.packet, 'independent-human-b', 'aligned-b');
  const alignedCandidateEventB = alignedB.records.find(record => record.eventType === 'candidateDecision'
    && record.payload.reviewItemRef === sourceQuery.reviewerB
    && record.payload.knowledgeRef === sourceKnowledge.reviewerB);
  const alignedLog = createEmptyAdjudicationLog({
    reviewerASubmission: sealedA,
    reviewerBSubmission: alignedB,
    reviewerAPacket: packets.reviewerA.packet,
    reviewerBPacket: packets.reviewerB.packet,
    curatorLinkage: packets.curatorLinkage
  });
  assert.throws(
    () => appendAdjudicationRecord(alignedLog, {
      eventId: 'invalid-no-disagreement-event',
      eventStatus: 'OPEN',
      disagreementId: 'invalid-no-disagreement',
      subjectType: 'candidateLevel',
      reviewerAResponseEventIds: [candidateEventA.eventId],
      reviewerBResponseEventIds: [alignedCandidateEventB.eventId],
      adjudicatedDecision: null,
      adjudicatorId: 'human-adjudicator',
      rationale: 'Fixture négative.',
      decidedAt: '2026-09-06T01:59:30.000Z',
      supersedesEventId: null
    }),
    /substantive reviewer disagreement/
  );
  const first = appendAdjudicationRecord(empty, {
    eventId: 'adjudication-event-0001',
    eventStatus: 'RESOLVED',
    disagreementId: 'disagreement-0001',
    subjectType: 'candidateLevel',
    reviewerAResponseEventIds: [candidateEventA.eventId],
    reviewerBResponseEventIds: [candidateEventB.eventId],
    adjudicatedDecision: { decision: 'covered' },
    adjudicatorId: 'human-adjudicator',
    rationale: 'Décision motivée sur la connaissance publiée.',
    decidedAt: '2026-09-06T02:00:00.000Z',
    supersedesEventId: null
  });
  assert.throws(
    () => appendAdjudicationRecord(first, {
      eventId: 'invalid-cross-subject-supersession',
      eventStatus: 'RESOLVED',
      disagreementId: 'disagreement-0001',
      subjectType: 'systemOutcome',
      reviewerAResponseEventIds: [systemEventA.eventId],
      reviewerBResponseEventIds: [systemEventB.eventId],
      adjudicatedDecision: { outcome: 'notCovered', coveredEntryId: null },
      adjudicatorId: 'human-adjudicator',
      rationale: 'Fixture négative.',
      decidedAt: '2026-09-06T02:00:10.000Z',
      supersedesEventId: 'adjudication-event-0001'
    }),
    /preserve subjectType and subjectRef/
  );
  const correctedFirst = appendAdjudicationRecord(first, {
    eventId: 'adjudication-event-0001-correction',
    eventStatus: 'RESOLVED',
    disagreementId: 'disagreement-0001',
    subjectType: 'candidateLevel',
    reviewerAResponseEventIds: [candidateEventA.eventId],
    reviewerBResponseEventIds: [candidateEventB.eventId],
    adjudicatedDecision: { decision: 'notCovered' },
    adjudicatorId: 'human-adjudicator',
    rationale: 'Correction append-only de la décision arbitrée.',
    decidedAt: '2026-09-06T02:00:20.000Z',
    supersedesEventId: 'adjudication-event-0001'
  });
  assert.throws(
    () => appendAdjudicationRecord(correctedFirst, {
      eventId: 'invalid-parallel-supersession',
      eventStatus: 'RESOLVED',
      disagreementId: 'disagreement-0001',
      subjectType: 'candidateLevel',
      reviewerAResponseEventIds: [candidateEventA.eventId],
      reviewerBResponseEventIds: [candidateEventB.eventId],
      adjudicatedDecision: { decision: 'covered' },
      adjudicatorId: 'human-adjudicator',
      rationale: 'Fixture négative.',
      decidedAt: '2026-09-06T02:00:30.000Z',
      supersedesEventId: 'adjudication-event-0001'
    }),
    /current linear head/
  );
  const second = appendAdjudicationRecord(first, {
    eventId: 'adjudication-event-0002',
    eventStatus: 'REPLACEMENT_REQUIRED',
    disagreementId: 'disagreement-0002',
    subjectType: 'systemOutcome',
    reviewerAResponseEventIds: [systemEventA.eventId],
    reviewerBResponseEventIds: [systemEventB.eventId],
    adjudicatedDecision: { action: 'replaceCaseAndReviewAgain' },
    adjudicatorId: 'human-adjudicator',
    rationale: 'Le désaccord ne peut pas être résolu sans remplacer le cas.',
    decidedAt: '2026-09-06T02:01:00.000Z',
    supersedesEventId: null
  });

  assert.equal(empty.records.length, 0);
  assert.equal(first.records.length, 1);
  assert.equal(second.records.length, 2);
  assert.equal(second.records[1].previousEventSha256, second.records[0].eventSha256);
  assert.equal(second.holdoutQualityGateStatus, HUMAN_REVIEW_STATUS);
  assert.deepEqual(validateAdjudicationLog(second), { ok: true, errors: [] });

  const tampered = structuredClone(second);
  tampered.records[0].reviewerA.responseEvents[0].judgment.decision = 'covered';
  const validation = validateAdjudicationLog(tampered);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some(error => error.code === 'REVIEWER_A_JUDGMENT_HASH_MISMATCH'));
});
