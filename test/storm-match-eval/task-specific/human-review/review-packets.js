import { createHash } from 'node:crypto';

export const HUMAN_REVIEW_STATUS = 'PENDING_HUMAN_REVIEW';
export const PROTOCOL_COMMIT = '1e1a08d17f9e387b0ea62e9bfd46ed2d02e49131';
export const SUPPORTED_REVIEW_LANGUAGES = Object.freeze(['fr', 'en', 'de', 'es', 'it', 'nl']);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export const REVIEW_DECISION_GRID = deepFreeze({
  schemaVersion: 1,
  candidateLevel: {
    field: 'decision',
    allowedValues: ['covered', 'notCovered'],
    rule: 'covered only when the candidate Q+A answers the complete user query without adding unpublished truth'
  },
  answerEquivalence: {
    field: 'reviewerGroupRef',
    rule: 'group only answers that are materially interchangeable; thematic proximity is insufficient',
    requiresRationale: true
  },
  preferredEntry: {
    field: 'preferredKnowledgeRef',
    rule: 'choose the most explicit autonomous Q+A without broader scope; break a strict tie by the lowest pre-registered tie-break rank',
    exactlyOnePerGroup: true
  },
  systemLevel: {
    field: 'outcome',
    allowedValues: ['notCovered', 'covered', 'ambiguous'],
    rule: 'zero covered groups means notCovered; one means covered; multiple substantively different competing groups mean ambiguous'
  },
  dangerousFalsePositiveOpportunity: {
    field: 'isOpportunity',
    allowedValues: [true, false],
    consequenceCategories: [
      'eligibility_or_right',
      'payment_or_price',
      'deadline',
      'access',
      'safety',
      'confidentiality',
      'contractual_commitment',
      'hard_to_reverse_operation',
      'none'
    ],
    requiresRationale: true
  }
});

export const REVIEW_RESPONSE_CONTRACT = deepFreeze({
  schemaVersion: 1,
  requiredDecisionTypes: [
    'candidateDecision',
    'answerEquivalenceGroup',
    'systemOutcome',
    'dangerousFalsePositiveOpportunity'
  ],
  candidateDecision: {
    requiredFields: ['reviewItemRef', 'knowledgeRef', 'decision', 'rationale'],
    allowedDecisions: ['covered', 'notCovered']
  },
  answerEquivalenceGroup: {
    requiredFields: ['reviewerGroupRef', 'memberKnowledgeRefs', 'preferredKnowledgeRef', 'rationale']
  },
  systemOutcome: {
    requiredFields: ['reviewItemRef', 'outcome', 'coveredReviewerGroupRef', 'rationale'],
    allowedOutcomes: ['notCovered', 'covered', 'ambiguous']
  },
  dangerousFalsePositiveOpportunity: {
    requiredFields: ['reviewItemRef', 'isOpportunity', 'consequenceCategory', 'rationale']
  },
  noDefaultJudgments: true
});

// Schema-only contract for the future business-structure packets. No final
// packet is built at this stage because the reviewed comparison sets and
// cluster boundaries are not yet frozen. The contract deliberately separates
// equivalence, preferred-entry and graph decisions.
export const STRUCTURAL_REVIEW_PACKET_SCHEMA = deepFreeze({
  schemaVersion: 1,
  packetKind: 'KNOWLEDGE_STRUCTURE',
  reviewStatus: HUMAN_REVIEW_STATUS,
  supportedLanguageStrata: [...SUPPORTED_REVIEW_LANGUAGES],
  languageMode: 'EXACTLY_ONE_LANGUAGE_PER_PACKET',
  reviewerRoles: ['A', 'B'],
  physicalReviewerAssignmentScope: 'PER_LANGUAGE_STRATUM',
  input: {
    canonicalKnowledgeItemFields: ['knowledgeRef', 'canonicalQuestion', 'canonicalAnswer', 'preRegisteredTieBreakRank'],
    equivalenceComparisonFields: ['comparisonRef', 'knowledgeRefs'],
    knowledgeBoundaryFields: ['boundaryRef', 'knowledgeRefs'],
    currentEquivalenceGroupIncluded: false,
    proposedPreferredEntryIncluded: false,
    currentKnowledgeClusterIncluded: false
  },
  independentDecisionSections: {
    equivalencePartition: {
      requiredFields: ['comparisonRef', 'reviewerGroupRefs', 'rationale'],
      preferredEntryIncluded: false
    },
    preferredEntrySelection: {
      requiredFields: ['reviewerGroupRef', 'preferredKnowledgeRef', 'rationale'],
      separateFromEquivalenceDecision: true
    },
    knowledgeClusterPartition: {
      requiredFields: ['reviewerClusterRef', 'memberKnowledgeRefs', 'rationale'],
      connectedComponentRuleRequired: true
    },
    knowledgeBoundaryDecision: {
      requiredFields: ['boundaryRef', 'decision', 'rationale'],
      allowedValues: ['sameConnectedComponent', 'separateComponents']
    }
  },
  isolation: {
    modelOutputsIncluded: false,
    scoresIncluded: false,
    semanticNeighbourRanksIncluded: false,
    proposedEquivalenceJudgmentsIncluded: false,
    proposedClusterJudgmentsIncluded: false,
    otherReviewerResponsesIncluded: false,
    curatorMappingIncluded: false
  },
  responsePolicy: {
    noDefaultJudgments: true,
    twoIndependentHumanSubmissionsRequired: true,
    appendOnlyAdjudicationRequired: true,
    originalReviewerDecisionsPreserved: true
  },
  finalPacketGenerationAuthorized: false
});

function canonicalise(value) {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map(key => [key, canonicalise(value[key])])
    );
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalise(value));
}

export function fingerprint(value) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function sha256Text(value) {
  return createHash('sha256').update(value).digest('hex');
}

function assertExactKeys(value, allowedKeys, subject) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${subject} must be an object`);
  }
  const unexpected = Object.keys(value).filter(key => !allowedKeys.includes(key));
  if (unexpected.length > 0) {
    throw new Error(`${subject} contains forbidden or unexpected fields: ${unexpected.join(', ')}`);
  }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function assertNeutralSource(source) {
  assertExactKeys(source, ['sourceFingerprint', 'knowledgeEntries', 'queryItems'], 'neutral source');
  if (!/^[a-f0-9]{64}$/.test(source.sourceFingerprint ?? '')) {
    throw new Error('sourceFingerprint must be a lowercase SHA-256');
  }
  if (!Array.isArray(source.knowledgeEntries) || source.knowledgeEntries.length < 2) {
    throw new Error('At least two neutral knowledge entries are required');
  }
  if (!Array.isArray(source.queryItems) || source.queryItems.length < 2) {
    throw new Error('At least two neutral query items are required');
  }

  for (const item of source.knowledgeEntries) {
    assertExactKeys(
      item,
      ['entryId', 'canonicalQuestion', 'canonicalAnswer', 'preferredTieBreakRank'],
      `knowledge ${item?.entryId ?? '<missing>'}`
    );
    if (!isNonEmptyString(item.entryId) || !isNonEmptyString(item.canonicalQuestion)
      || !isNonEmptyString(item.canonicalAnswer)) {
      throw new Error('Every neutral knowledge entry needs an id, question and answer');
    }
    if (!Number.isInteger(item.preferredTieBreakRank) || item.preferredTieBreakRank < 1) {
      throw new Error(`Knowledge ${item.entryId} needs a positive integer preferredTieBreakRank`);
    }
  }
  const knownEntryIds = new Set(source.knowledgeEntries.map(item => item.entryId));
  if (knownEntryIds.size !== source.knowledgeEntries.length) {
    throw new Error('Neutral knowledge entry ids must be unique');
  }
  const tieBreakRanks = new Set(source.knowledgeEntries.map(item => item.preferredTieBreakRank));
  if (tieBreakRanks.size !== source.knowledgeEntries.length) {
    throw new Error('preferredTieBreakRank values must be unique');
  }

  for (const item of source.queryItems) {
    assertExactKeys(
      item,
      ['caseId', 'query', 'candidateEntryIds', 'businessContext', 'language'],
      `query ${item?.caseId ?? '<missing>'}`
    );
    if (!isNonEmptyString(item.caseId) || !isNonEmptyString(item.query)
      || !Array.isArray(item.candidateEntryIds) || item.candidateEntryIds.length === 0
      || item.candidateEntryIds.some(entryId => !isNonEmptyString(entryId))) {
      throw new Error('Every neutral query item needs an id, query and candidate ids');
    }
    if (item.businessContext !== null && item.businessContext !== undefined && !isNonEmptyString(item.businessContext)) {
      throw new Error(`Query ${item.caseId} businessContext must be a non-empty string or null`);
    }
    if (!SUPPORTED_REVIEW_LANGUAGES.includes(item.language)) {
      throw new Error(`Query ${item.caseId} language must be one of ${SUPPORTED_REVIEW_LANGUAGES.join(', ')}`);
    }
    if (new Set(item.candidateEntryIds).size !== item.candidateEntryIds.length) {
      throw new Error(`Query ${item.caseId} contains duplicate candidate ids`);
    }
    for (const entryId of item.candidateEntryIds) {
      if (!knownEntryIds.has(entryId)) throw new Error(`Unknown candidate entry id: ${entryId}`);
    }
  }
  const languageStrata = new Set(source.queryItems.map(item => item.language));
  if (languageStrata.size !== 1) {
    throw new Error('Each independent review bundle must contain exactly one language stratum');
  }
  if (new Set(source.queryItems.map(item => item.caseId)).size !== source.queryItems.length) {
    throw new Error('Neutral query item ids must be unique');
  }
}

function ranked(items, seed, namespace, idSelector = value => value) {
  return [...items]
    .map(item => ({
      item,
      rank: sha256Text(`${seed}\0${namespace}\0${idSelector(item)}`)
    }))
    .sort((left, right) => left.rank.localeCompare(right.rank) || idSelector(left.item).localeCompare(idSelector(right.item)))
    .map(({ item }) => item);
}

function sameOrder(left, right, idSelector = value => value) {
  return left.length === right.length && left.every((item, index) => idSelector(item) === idSelector(right[index]));
}

function rotate(items) {
  return items.length < 2 ? [...items] : [...items.slice(1), items[0]];
}

function canonicalContent(source) {
  return {
    knowledgeEntries: [...source.knowledgeEntries]
      .sort((left, right) => left.entryId.localeCompare(right.entryId))
      .map(item => ({ ...item })),
    queryItems: [...source.queryItems]
      .sort((left, right) => left.caseId.localeCompare(right.caseId))
      .map(item => ({
        ...item,
        businessContext: item.businessContext ?? null,
        language: item.language ?? null,
        candidateEntryIds: [...item.candidateEntryIds].sort()
      }))
  };
}

function candidateOrderFingerprint(candidateOrderByCaseId) {
  return fingerprint(
    [...candidateOrderByCaseId.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([caseId, entryIds]) => ({ caseId, entryIds }))
  );
}

function buildPacket({
  source,
  contentSetFingerprint,
  reviewerIdentity,
  reviewerKey,
  seed,
  knowledgeOrder,
  queryOrder,
  candidateOrderByCaseId
}) {
  const blindNamespace = `review-${reviewerKey}`;
  const knowledgeRefByEntryId = new Map();
  const knowledgeItems = knowledgeOrder.map((item, index) => {
    const knowledgeRef = `${blindNamespace}-knowledge-${String(index + 1).padStart(4, '0')}`;
    knowledgeRefByEntryId.set(item.entryId, knowledgeRef);
    return {
      knowledgeRef,
      canonicalQuestion: item.canonicalQuestion,
      canonicalAnswer: item.canonicalAnswer,
      preRegisteredTieBreakRank: item.preferredTieBreakRank
    };
  });

  const queryItems = queryOrder.map((item, index) => ({
    reviewItemRef: `${blindNamespace}-query-${String(index + 1).padStart(4, '0')}`,
    query: item.query,
    language: item.language ?? null,
    businessContext: item.businessContext ?? null,
    candidateKnowledgeRefs: candidateOrderByCaseId
      .get(item.caseId)
      .map(entryId => knowledgeRefByEntryId.get(entryId))
  }));

  const decisionGrid = structuredClone(REVIEW_DECISION_GRID);
  const responseContract = structuredClone(REVIEW_RESPONSE_CONTRACT);
  const packetWithoutFingerprint = {
    schemaVersion: 1,
    protocolCommit: PROTOCOL_COMMIT,
    packetId: `storm-answerability-reviewer-${reviewerKey}`,
    reviewerSlot: reviewerKey.toUpperCase(),
    reviewerIdentity,
    reviewStatus: 'NOT_STARTED',
    sourceFingerprint: source.sourceFingerprint,
    contentSetFingerprint,
    blindNamespace,
    isolation: {
      modelOutputsIncluded: false,
      scoresIncluded: false,
      prefilledJudgmentsIncluded: false,
      otherReviewerResponsesIncluded: false,
      curatorMappingIncluded: false
    },
    randomization: {
      algorithm: 'sha256-rank-v1',
      seedCommitmentSha256: sha256Text(seed),
      knowledgeOrderSha256: fingerprint(knowledgeOrder.map(item => item.entryId)),
      queryOrderSha256: fingerprint(queryOrder.map(item => item.caseId)),
      candidateOrdersSha256: candidateOrderFingerprint(candidateOrderByCaseId)
    },
    decisionGrid,
    decisionGridSha256: fingerprint(decisionGrid),
    responseContract,
    responseContractSha256: fingerprint(responseContract),
    knowledgeItems,
    queryItems
  };
  const packet = deepFreeze({
    ...packetWithoutFingerprint,
    packetFingerprint: fingerprint(packetWithoutFingerprint)
  });

  return {
    packet,
    knowledgeRefByEntryId,
    reviewItemRefByCaseId: new Map(queryOrder.map((item, index) => [item.caseId, queryItems[index].reviewItemRef]))
  };
}

function createCandidateOrders(source, reviewerASeed, reviewerBSeed) {
  const reviewerA = new Map();
  const reviewerB = new Map();
  for (const item of source.queryItems) {
    const candidateA = ranked(item.candidateEntryIds, reviewerASeed, `candidates:${item.caseId}`);
    let candidateB = ranked(item.candidateEntryIds, reviewerBSeed, `candidates:${item.caseId}`);
    if (candidateB.length > 1 && sameOrder(candidateA, candidateB)) candidateB = rotate(candidateB);
    reviewerA.set(item.caseId, candidateA);
    reviewerB.set(item.caseId, candidateB);
  }
  return { reviewerA, reviewerB };
}

function createQualityGateManifest(sourceFingerprint, contentSetFingerprint) {
  const manifestWithoutFingerprint = {
    schemaVersion: 1,
    protocolCommit: PROTOCOL_COMMIT,
    sourceFingerprint,
    contentSetFingerprint,
    holdoutQualityGateStatus: HUMAN_REVIEW_STATUS,
    reviewerAStatus: 'ROLE_READY_ASSIGNMENTS_PENDING_BY_LANGUAGE',
    reviewerBStatus: 'ROLE_READY_ASSIGNMENTS_PENDING_BY_LANGUAGE',
    adjudicationStatus: 'BLOCKED_WAITING_FOR_BOTH',
    automaticCompletionAllowed: false
  };
  return deepFreeze({
    ...manifestWithoutFingerprint,
    manifestFingerprint: fingerprint(manifestWithoutFingerprint)
  });
}

export function createIndependentReviewPackets(source, { reviewerASeed, reviewerBSeed }) {
  assertNeutralSource(source);
  if (!reviewerASeed || !reviewerBSeed || reviewerASeed === reviewerBSeed) {
    throw new Error('Two distinct non-empty reviewer seeds are required');
  }

  const contentSetFingerprint = fingerprint(canonicalContent(source));
  const knowledgeA = ranked(source.knowledgeEntries, reviewerASeed, 'knowledge', item => item.entryId);
  let knowledgeB = ranked(source.knowledgeEntries, reviewerBSeed, 'knowledge', item => item.entryId);
  const queriesA = ranked(source.queryItems, reviewerASeed, 'queries', item => item.caseId);
  let queriesB = ranked(source.queryItems, reviewerBSeed, 'queries', item => item.caseId);
  if (sameOrder(knowledgeA, knowledgeB, item => item.entryId)) knowledgeB = rotate(knowledgeB);
  if (sameOrder(queriesA, queriesB, item => item.caseId)) queriesB = rotate(queriesB);
  const candidateOrders = createCandidateOrders(source, reviewerASeed, reviewerBSeed);

  const reviewerA = buildPacket({
    source,
    contentSetFingerprint,
    reviewerKey: 'a',
    seed: reviewerASeed,
    knowledgeOrder: knowledgeA,
    queryOrder: queriesA,
    candidateOrderByCaseId: candidateOrders.reviewerA,
    reviewerIdentity: {
      reviewerRole: 'A',
      assignmentScope: 'PER_LANGUAGE_STRATUM',
      languageStratum: source.queryItems[0].language,
      physicalReviewerPreassigned: false,
      languageCompetenceRequired: true
    }
  });
  const reviewerB = buildPacket({
    source,
    contentSetFingerprint,
    reviewerKey: 'b',
    seed: reviewerBSeed,
    knowledgeOrder: knowledgeB,
    queryOrder: queriesB,
    candidateOrderByCaseId: candidateOrders.reviewerB,
    reviewerIdentity: {
      reviewerRole: 'B',
      assignmentScope: 'PER_LANGUAGE_STRATUM',
      languageStratum: source.queryItems[0].language,
      physicalReviewerPreassigned: false,
      languageCompetenceRequired: true
    }
  });

  const linkageWithoutFingerprint = {
    schemaVersion: 1,
    protocolCommit: PROTOCOL_COMMIT,
    sourceFingerprint: source.sourceFingerprint,
    contentSetFingerprint,
    packetFingerprints: {
      reviewerA: reviewerA.packet.packetFingerprint,
      reviewerB: reviewerB.packet.packetFingerprint
    },
    knowledgeRefs: [...source.knowledgeEntries]
      .sort((left, right) => left.entryId.localeCompare(right.entryId))
      .map(item => ({
        entryId: item.entryId,
        reviewerA: reviewerA.knowledgeRefByEntryId.get(item.entryId),
        reviewerB: reviewerB.knowledgeRefByEntryId.get(item.entryId)
      })),
    queryRefs: [...source.queryItems]
      .sort((left, right) => left.caseId.localeCompare(right.caseId))
      .map(item => ({
        caseId: item.caseId,
        reviewerA: reviewerA.reviewItemRefByCaseId.get(item.caseId),
        reviewerB: reviewerB.reviewItemRefByCaseId.get(item.caseId)
      }))
  };
  const curatorLinkage = deepFreeze({
    ...linkageWithoutFingerprint,
    linkageFingerprint: fingerprint(linkageWithoutFingerprint)
  });

  return deepFreeze({
    qualityGateManifest: createQualityGateManifest(source.sourceFingerprint, contentSetFingerprint),
    reviewerA: { packet: reviewerA.packet },
    reviewerB: { packet: reviewerB.packet },
    curatorLinkage
  });
}

function collectKeys(value, keys = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      keys.push(key);
      collectKeys(child, keys);
    }
  }
  return keys;
}

function collectStringValues(value, values = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectStringValues(item, values);
  } else if (value && typeof value === 'object') {
    for (const child of Object.values(value)) collectStringValues(child, values);
  } else if (typeof value === 'string') {
    values.push(value);
  }
  return values;
}

function withoutField(value, field) {
  const { [field]: _ignored, ...rest } = value;
  return rest;
}

function validateExactKeys(errors, value, allowedKeys, code, context = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push({ code, ...context, reason: 'NOT_AN_OBJECT' });
    return;
  }
  const actual = Object.keys(value).sort();
  const expected = [...allowedKeys].sort();
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    errors.push({ code, ...context, actual, expected });
  }
}

function buildLinkageMaps(linkage) {
  return {
    entryIdByARef: new Map(linkage.knowledgeRefs.map(item => [item.reviewerA, item.entryId])),
    entryIdByBRef: new Map(linkage.knowledgeRefs.map(item => [item.reviewerB, item.entryId])),
    caseIdByARef: new Map(linkage.queryRefs.map(item => [item.reviewerA, item.caseId])),
    caseIdByBRef: new Map(linkage.queryRefs.map(item => [item.reviewerB, item.caseId]))
  };
}

function resolvePacketContent(packet, entryIdByRef, caseIdByRef) {
  const knowledgeEntries = packet.knowledgeItems.map(item => ({
    entryId: entryIdByRef.get(item.knowledgeRef),
    canonicalQuestion: item.canonicalQuestion,
    canonicalAnswer: item.canonicalAnswer,
    preferredTieBreakRank: item.preRegisteredTieBreakRank
  }));
  const queryItems = packet.queryItems.map(item => ({
    caseId: caseIdByRef.get(item.reviewItemRef),
    query: item.query,
    candidateEntryIds: item.candidateKnowledgeRefs.map(ref => entryIdByRef.get(ref)),
    businessContext: item.businessContext,
    language: item.language
  }));
  return { knowledgeEntries, queryItems };
}

function orderFingerprints(resolved) {
  return {
    knowledge: fingerprint(resolved.knowledgeEntries.map(item => item.entryId)),
    queries: fingerprint(resolved.queryItems.map(item => item.caseId)),
    candidates: candidateOrderFingerprint(new Map(resolved.queryItems.map(item => [item.caseId, item.candidateEntryIds])))
  };
}

function compareActualOrders(resolvedA, resolvedB, errors) {
  if (sameOrder(resolvedA.knowledgeEntries, resolvedB.knowledgeEntries, item => item.entryId)) {
    errors.push({ code: 'KNOWLEDGE_ORDER_NOT_DISTINCT' });
  }
  if (sameOrder(resolvedA.queryItems, resolvedB.queryItems, item => item.caseId)) {
    errors.push({ code: 'QUERY_ORDER_NOT_DISTINCT' });
  }
  const candidatesA = new Map(resolvedA.queryItems.map(item => [item.caseId, item.candidateEntryIds]));
  const candidatesB = new Map(resolvedB.queryItems.map(item => [item.caseId, item.candidateEntryIds]));
  for (const [caseId, orderA] of candidatesA) {
    const orderB = candidatesB.get(caseId);
    if (orderA.length > 1 && orderB && sameOrder(orderA, orderB)) {
      errors.push({ code: 'CANDIDATE_ORDER_NOT_DISTINCT', caseId });
    }
  }
}

function validateReproducibleOrders(resolvedA, resolvedB, seeds, errors) {
  if (!seeds) return;
  const { reviewerASeed, reviewerBSeed } = seeds;
  if (!reviewerASeed || !reviewerBSeed) {
    errors.push({ code: 'MISSING_VALIDATION_SEEDS' });
    return;
  }
  const entries = [...resolvedA.knowledgeEntries];
  const queries = [...resolvedA.queryItems];
  const expectedKnowledgeA = ranked(entries, reviewerASeed, 'knowledge', item => item.entryId);
  let expectedKnowledgeB = ranked(entries, reviewerBSeed, 'knowledge', item => item.entryId);
  const expectedQueriesA = ranked(queries, reviewerASeed, 'queries', item => item.caseId);
  let expectedQueriesB = ranked(queries, reviewerBSeed, 'queries', item => item.caseId);
  if (sameOrder(expectedKnowledgeA, expectedKnowledgeB, item => item.entryId)) expectedKnowledgeB = rotate(expectedKnowledgeB);
  if (sameOrder(expectedQueriesA, expectedQueriesB, item => item.caseId)) expectedQueriesB = rotate(expectedQueriesB);

  const checks = [
    ['A', resolvedA.knowledgeEntries, expectedKnowledgeA, item => item.entryId, 'KNOWLEDGE_ORDER_NOT_REPRODUCIBLE'],
    ['B', resolvedB.knowledgeEntries, expectedKnowledgeB, item => item.entryId, 'KNOWLEDGE_ORDER_NOT_REPRODUCIBLE'],
    ['A', resolvedA.queryItems, expectedQueriesA, item => item.caseId, 'QUERY_ORDER_NOT_REPRODUCIBLE'],
    ['B', resolvedB.queryItems, expectedQueriesB, item => item.caseId, 'QUERY_ORDER_NOT_REPRODUCIBLE']
  ];
  for (const [reviewerSlot, actual, expected, selector, code] of checks) {
    if (!sameOrder(actual, expected, selector)) errors.push({ code, reviewerSlot });
  }

  const queryByCaseId = new Map(queries.map(item => [item.caseId, item]));
  const actualCandidatesA = new Map(resolvedA.queryItems.map(item => [item.caseId, item.candidateEntryIds]));
  const actualCandidatesB = new Map(resolvedB.queryItems.map(item => [item.caseId, item.candidateEntryIds]));
  for (const [caseId, query] of queryByCaseId) {
    const expectedA = ranked(query.candidateEntryIds, reviewerASeed, `candidates:${caseId}`);
    let expectedB = ranked(query.candidateEntryIds, reviewerBSeed, `candidates:${caseId}`);
    if (expectedB.length > 1 && sameOrder(expectedA, expectedB)) expectedB = rotate(expectedB);
    if (!sameOrder(actualCandidatesA.get(caseId), expectedA)) {
      errors.push({ code: 'CANDIDATE_ORDER_NOT_REPRODUCIBLE', reviewerSlot: 'A', caseId });
    }
    if (!sameOrder(actualCandidatesB.get(caseId), expectedB)) {
      errors.push({ code: 'CANDIDATE_ORDER_NOT_REPRODUCIBLE', reviewerSlot: 'B', caseId });
    }
  }
}

export function validateIndependentReviewPackets(bundle, seeds) {
  const errors = [];
  const a = bundle?.reviewerA?.packet;
  const b = bundle?.reviewerB?.packet;
  const linkage = bundle?.curatorLinkage;
  const gate = bundle?.qualityGateManifest;
  if (!a || !b || !linkage || !gate) {
    return { ok: false, errors: [{ code: 'INCOMPLETE_REVIEW_BUNDLE' }] };
  }

  validateExactKeys(errors, bundle, ['qualityGateManifest', 'reviewerA', 'reviewerB', 'curatorLinkage'], 'INVALID_REVIEW_BUNDLE_SCHEMA');
  validateExactKeys(errors, bundle.reviewerA, ['packet'], 'INVALID_REVIEWER_CONTAINER_SCHEMA', { reviewerSlot: 'A' });
  validateExactKeys(errors, bundle.reviewerB, ['packet'], 'INVALID_REVIEWER_CONTAINER_SCHEMA', { reviewerSlot: 'B' });
  validateExactKeys(errors, gate, [
    'schemaVersion',
    'protocolCommit',
    'sourceFingerprint',
    'contentSetFingerprint',
    'holdoutQualityGateStatus',
    'reviewerAStatus',
    'reviewerBStatus',
    'adjudicationStatus',
    'automaticCompletionAllowed',
    'manifestFingerprint'
  ], 'INVALID_QUALITY_GATE_MANIFEST_SCHEMA');
  validateExactKeys(errors, linkage, [
    'schemaVersion',
    'protocolCommit',
    'sourceFingerprint',
    'contentSetFingerprint',
    'packetFingerprints',
    'knowledgeRefs',
    'queryRefs',
    'linkageFingerprint'
  ], 'INVALID_CURATOR_LINKAGE_SCHEMA');
  validateExactKeys(errors, linkage.packetFingerprints, ['reviewerA', 'reviewerB'], 'INVALID_LINKAGE_PACKET_FINGERPRINT_SCHEMA');

  const packetKeys = [
    'schemaVersion',
    'protocolCommit',
    'packetId',
    'reviewerSlot',
    'reviewerIdentity',
    'reviewStatus',
    'sourceFingerprint',
    'contentSetFingerprint',
    'blindNamespace',
    'isolation',
    'randomization',
    'decisionGrid',
    'decisionGridSha256',
    'responseContract',
    'responseContractSha256',
    'knowledgeItems',
    'queryItems',
    'packetFingerprint'
  ];
  const identityKeys = [
    'reviewerRole',
    'assignmentScope',
    'languageStratum',
    'physicalReviewerPreassigned',
    'languageCompetenceRequired'
  ];
  const isolationKeys = [
    'modelOutputsIncluded',
    'scoresIncluded',
    'prefilledJudgmentsIncluded',
    'otherReviewerResponsesIncluded',
    'curatorMappingIncluded'
  ];
  const randomizationKeys = [
    'algorithm',
    'seedCommitmentSha256',
    'knowledgeOrderSha256',
    'queryOrderSha256',
    'candidateOrdersSha256'
  ];
  for (const packet of [a, b]) {
    validateExactKeys(errors, packet, packetKeys, 'INVALID_PACKET_SCHEMA', { packetId: packet.packetId });
    validateExactKeys(errors, packet.reviewerIdentity, identityKeys, 'INVALID_REVIEWER_IDENTITY_SCHEMA', { packetId: packet.packetId });
    validateExactKeys(errors, packet.isolation, isolationKeys, 'INVALID_ISOLATION_SCHEMA', { packetId: packet.packetId });
    validateExactKeys(errors, packet.randomization, randomizationKeys, 'INVALID_RANDOMIZATION_SCHEMA', { packetId: packet.packetId });
    if (!Array.isArray(packet.knowledgeItems) || !Array.isArray(packet.queryItems)) {
      return { ok: false, errors: [...errors, { code: 'PACKET_ITEMS_NOT_ARRAYS', packetId: packet.packetId }] };
    }
    for (const item of packet.knowledgeItems) {
      validateExactKeys(errors, item, [
        'knowledgeRef',
        'canonicalQuestion',
        'canonicalAnswer',
        'preRegisteredTieBreakRank'
      ], 'INVALID_KNOWLEDGE_ITEM_SCHEMA', { packetId: packet.packetId });
      if (!isNonEmptyString(item.knowledgeRef) || !isNonEmptyString(item.canonicalQuestion)
        || !isNonEmptyString(item.canonicalAnswer)
        || !Number.isInteger(item.preRegisteredTieBreakRank) || item.preRegisteredTieBreakRank < 1) {
        errors.push({ code: 'INVALID_KNOWLEDGE_ITEM_VALUE', packetId: packet.packetId });
      }
    }
    for (const item of packet.queryItems) {
      validateExactKeys(errors, item, [
        'reviewItemRef',
        'query',
        'language',
        'businessContext',
        'candidateKnowledgeRefs'
      ], 'INVALID_QUERY_ITEM_SCHEMA', { packetId: packet.packetId });
      if (!isNonEmptyString(item.reviewItemRef) || !isNonEmptyString(item.query)
        || !SUPPORTED_REVIEW_LANGUAGES.includes(item.language)
        || (item.businessContext !== null && !isNonEmptyString(item.businessContext))
        || !Array.isArray(item.candidateKnowledgeRefs) || item.candidateKnowledgeRefs.length === 0
        || item.candidateKnowledgeRefs.some(ref => !isNonEmptyString(ref))
        || new Set(item.candidateKnowledgeRefs).size !== item.candidateKnowledgeRefs.length) {
        errors.push({ code: 'INVALID_QUERY_ITEM_VALUE', packetId: packet.packetId });
      }
    }
  }
  if (!Array.isArray(linkage.knowledgeRefs) || !Array.isArray(linkage.queryRefs)) {
    return { ok: false, errors: [...errors, { code: 'LINKAGE_ITEMS_NOT_ARRAYS' }] };
  }
  for (const item of linkage.knowledgeRefs) {
    validateExactKeys(errors, item, ['entryId', 'reviewerA', 'reviewerB'], 'INVALID_LINKAGE_KNOWLEDGE_ITEM_SCHEMA');
    if (!isNonEmptyString(item.entryId) || !isNonEmptyString(item.reviewerA) || !isNonEmptyString(item.reviewerB)) {
      errors.push({ code: 'INVALID_LINKAGE_KNOWLEDGE_ITEM_VALUE' });
    }
  }
  for (const item of linkage.queryRefs) {
    validateExactKeys(errors, item, ['caseId', 'reviewerA', 'reviewerB'], 'INVALID_LINKAGE_QUERY_ITEM_SCHEMA');
    if (!isNonEmptyString(item.caseId) || !isNonEmptyString(item.reviewerA) || !isNonEmptyString(item.reviewerB)) {
      errors.push({ code: 'INVALID_LINKAGE_QUERY_ITEM_VALUE' });
    }
  }

  if (gate.holdoutQualityGateStatus !== HUMAN_REVIEW_STATUS) errors.push({ code: 'INVALID_HOLDOUT_GATE_STATUS' });
  if (gate.protocolCommit !== PROTOCOL_COMMIT) errors.push({ code: 'QUALITY_GATE_PROTOCOL_COMMIT_MISMATCH' });
  if (gate.sourceFingerprint !== a.sourceFingerprint || gate.contentSetFingerprint !== a.contentSetFingerprint) {
    errors.push({ code: 'QUALITY_GATE_SOURCE_MISMATCH' });
  }
  if (gate.reviewerAStatus !== 'ROLE_READY_ASSIGNMENTS_PENDING_BY_LANGUAGE') {
    errors.push({ code: 'REVIEWER_A_STATUS_NOT_INITIAL' });
  }
  if (gate.reviewerBStatus !== 'ROLE_READY_ASSIGNMENTS_PENDING_BY_LANGUAGE') {
    errors.push({ code: 'REVIEWER_B_STATUS_NOT_INITIAL' });
  }
  if (gate.adjudicationStatus !== 'BLOCKED_WAITING_FOR_BOTH') errors.push({ code: 'ADJUDICATION_NOT_BLOCKED' });
  if (gate.automaticCompletionAllowed !== false) errors.push({ code: 'AUTOMATIC_GATE_COMPLETION_ALLOWED' });
  if (gate.manifestFingerprint !== fingerprint(withoutField(gate, 'manifestFingerprint'))) {
    errors.push({ code: 'QUALITY_GATE_MANIFEST_FINGERPRINT_MISMATCH' });
  }

  for (const packet of [a, b]) {
    if (packet.protocolCommit !== PROTOCOL_COMMIT) errors.push({ code: 'PROTOCOL_COMMIT_MISMATCH', packetId: packet.packetId });
    if (packet.reviewStatus !== 'NOT_STARTED') errors.push({ code: 'REVIEW_STATUS_NOT_INITIAL', packetId: packet.packetId });
    if (packet.packetFingerprint !== fingerprint(withoutField(packet, 'packetFingerprint'))) {
      errors.push({ code: 'PACKET_FINGERPRINT_MISMATCH', packetId: packet.packetId });
    }
    if (packet.decisionGridSha256 !== fingerprint(packet.decisionGrid)) {
      errors.push({ code: 'GRID_FINGERPRINT_MISMATCH', packetId: packet.packetId });
    }
    if (packet.responseContractSha256 !== fingerprint(packet.responseContract)) {
      errors.push({ code: 'RESPONSE_CONTRACT_FINGERPRINT_MISMATCH', packetId: packet.packetId });
    }
    if (canonicalJson(packet.decisionGrid) !== canonicalJson(REVIEW_DECISION_GRID)) {
      errors.push({ code: 'DECISION_GRID_MISMATCH', packetId: packet.packetId });
    }
    if (canonicalJson(packet.responseContract) !== canonicalJson(REVIEW_RESPONSE_CONTRACT)) {
      errors.push({ code: 'RESPONSE_CONTRACT_MISMATCH', packetId: packet.packetId });
    }
    for (const flag of isolationKeys) {
      if (packet.isolation?.[flag] !== false) errors.push({ code: 'ISOLATION_FLAG_NOT_FALSE', packetId: packet.packetId, flag });
    }
    if (packet.randomization?.algorithm !== 'sha256-rank-v1') {
      errors.push({ code: 'RANDOMIZATION_ALGORITHM_MISMATCH', packetId: packet.packetId });
    }
    for (const field of ['seedCommitmentSha256', 'knowledgeOrderSha256', 'queryOrderSha256', 'candidateOrdersSha256']) {
      if (!/^[a-f0-9]{64}$/.test(packet.randomization?.[field] ?? '')) {
        errors.push({ code: 'INVALID_RANDOMIZATION_FINGERPRINT', packetId: packet.packetId, field });
      }
    }
    const forbiddenContentKeys = collectKeys([packet.knowledgeItems, packet.queryItems])
      .filter(key => /(^|_)(entryId|caseId|split|cluster|scenarioFamilyId|risk|provenance)$|label|expected|gold|score|probability|prediction|modelOutput|judgment|decision|answerEquivalenceGroup|preferredEntry/i.test(key));
    if (forbiddenContentKeys.length > 0) {
      errors.push({ code: 'PREFILLED_MODEL_OR_SOURCE_FIELD', packetId: packet.packetId, keys: forbiddenContentKeys });
    }
    if (collectKeys(packet).some(key => key === 'seed')) {
      errors.push({ code: 'RAW_SEED_EXPOSED', packetId: packet.packetId });
    }
  }

  if (a.packetId === b.packetId || a.packetFingerprint === b.packetFingerprint) {
    errors.push({ code: 'PACKETS_NOT_DISTINCT' });
  }
  if (a.blindNamespace === b.blindNamespace) errors.push({ code: 'BLIND_NAMESPACES_NOT_DISTINCT' });
  if (a.sourceFingerprint !== b.sourceFingerprint || a.sourceFingerprint !== linkage.sourceFingerprint) {
    errors.push({ code: 'SOURCE_FINGERPRINT_MISMATCH' });
  }
  if (a.contentSetFingerprint !== b.contentSetFingerprint || a.contentSetFingerprint !== linkage.contentSetFingerprint) {
    errors.push({ code: 'CONTENT_SET_FINGERPRINT_MISMATCH' });
  }
  if (a.randomization.seedCommitmentSha256 === b.randomization.seedCommitmentSha256) {
    errors.push({ code: 'ORDER_SEEDS_NOT_DISTINCT' });
  }
  if (canonicalJson(a.decisionGrid) !== canonicalJson(b.decisionGrid)) errors.push({ code: 'REVIEW_GRIDS_DIFFER' });
  if (canonicalJson(a.responseContract) !== canonicalJson(b.responseContract)) errors.push({ code: 'RESPONSE_CONTRACTS_DIFFER' });
  for (const [packet, expectedRole] of [[a, 'A'], [b, 'B']]) {
    if (packet.reviewerSlot !== expectedRole
      || packet.reviewerIdentity.reviewerRole !== expectedRole
      || packet.reviewerIdentity.assignmentScope !== 'PER_LANGUAGE_STRATUM'
      || !SUPPORTED_REVIEW_LANGUAGES.includes(packet.reviewerIdentity.languageStratum)
      || packet.reviewerIdentity.physicalReviewerPreassigned !== false
      || packet.reviewerIdentity.languageCompetenceRequired !== true) {
      errors.push({ code: 'INVALID_LANGUAGE_STRATUM_REVIEWER_ROLE', reviewerSlot: expectedRole });
    }
  }
  if (a.reviewerIdentity.languageStratum !== b.reviewerIdentity.languageStratum
    || a.queryItems.some(item => item.language !== a.reviewerIdentity.languageStratum)
    || b.queryItems.some(item => item.language !== b.reviewerIdentity.languageStratum)) {
    errors.push({ code: 'REVIEW_PACKET_LANGUAGE_STRATUM_MISMATCH' });
  }

  if (linkage.protocolCommit !== PROTOCOL_COMMIT) errors.push({ code: 'LINKAGE_PROTOCOL_COMMIT_MISMATCH' });
  if (linkage.linkageFingerprint !== fingerprint(withoutField(linkage, 'linkageFingerprint'))) {
    errors.push({ code: 'CURATOR_LINKAGE_FINGERPRINT_MISMATCH' });
  }
  if (linkage.packetFingerprints?.reviewerA !== a.packetFingerprint || linkage.packetFingerprints?.reviewerB !== b.packetFingerprint) {
    errors.push({ code: 'LINKAGE_PACKET_FINGERPRINT_MISMATCH' });
  }

  const refsA = new Set(a.knowledgeItems.map(item => item.knowledgeRef));
  const refsB = new Set(b.knowledgeItems.map(item => item.knowledgeRef));
  const queryRefsA = new Set(a.queryItems.map(item => item.reviewItemRef));
  const queryRefsB = new Set(b.queryItems.map(item => item.reviewItemRef));
  if (refsA.size !== a.knowledgeItems.length || refsB.size !== b.knowledgeItems.length) {
    errors.push({ code: 'DUPLICATE_KNOWLEDGE_ALIAS' });
  }
  if (queryRefsA.size !== a.queryItems.length || queryRefsB.size !== b.queryItems.length) {
    errors.push({ code: 'DUPLICATE_QUERY_ALIAS' });
  }
  if ([...refsA].some(ref => refsB.has(ref))) errors.push({ code: 'KNOWLEDGE_ALIASES_NOT_ISOLATED' });
  if ([...queryRefsA].some(ref => queryRefsB.has(ref))) errors.push({ code: 'QUERY_ALIASES_NOT_ISOLATED' });

  const linkageEntryIds = linkage.knowledgeRefs.map(item => item.entryId);
  const linkageARefs = linkage.knowledgeRefs.map(item => item.reviewerA);
  const linkageBRefs = linkage.knowledgeRefs.map(item => item.reviewerB);
  const linkageCaseIds = linkage.queryRefs.map(item => item.caseId);
  const linkageAQueryRefs = linkage.queryRefs.map(item => item.reviewerA);
  const linkageBQueryRefs = linkage.queryRefs.map(item => item.reviewerB);
  for (const [values, code] of [
    [linkageEntryIds, 'DUPLICATE_LINKAGE_ENTRY_ID'],
    [linkageARefs, 'DUPLICATE_LINKAGE_A_KNOWLEDGE_REF'],
    [linkageBRefs, 'DUPLICATE_LINKAGE_B_KNOWLEDGE_REF'],
    [linkageCaseIds, 'DUPLICATE_LINKAGE_CASE_ID'],
    [linkageAQueryRefs, 'DUPLICATE_LINKAGE_A_QUERY_REF'],
    [linkageBQueryRefs, 'DUPLICATE_LINKAGE_B_QUERY_REF']
  ]) {
    if (new Set(values).size !== values.length) errors.push({ code });
  }
  if (canonicalJson([...refsA].sort()) !== canonicalJson([...linkageARefs].sort())
    || canonicalJson([...refsB].sort()) !== canonicalJson([...linkageBRefs].sort())) {
    errors.push({ code: 'LINKAGE_KNOWLEDGE_REFS_NOT_EXHAUSTIVE' });
  }
  if (canonicalJson([...queryRefsA].sort()) !== canonicalJson([...linkageAQueryRefs].sort())
    || canonicalJson([...queryRefsB].sort()) !== canonicalJson([...linkageBQueryRefs].sort())) {
    errors.push({ code: 'LINKAGE_QUERY_REFS_NOT_EXHAUSTIVE' });
  }
  const sourceIds = new Set([...linkageEntryIds, ...linkageCaseIds]);
  for (const packet of [a, b]) {
    if (collectStringValues(packet).some(value => sourceIds.has(value))) {
      errors.push({ code: 'SOURCE_IDENTIFIER_EXPOSED', packetId: packet.packetId });
    }
  }

  const maps = buildLinkageMaps(linkage);
  const resolvedA = resolvePacketContent(a, maps.entryIdByARef, maps.caseIdByARef);
  const resolvedB = resolvePacketContent(b, maps.entryIdByBRef, maps.caseIdByBRef);
  const hasUnresolved = [...resolvedA.knowledgeEntries, ...resolvedB.knowledgeEntries].some(item => !item.entryId)
    || [...resolvedA.queryItems, ...resolvedB.queryItems].some(item => !item.caseId || item.candidateEntryIds.some(id => !id));
  if (hasUnresolved) errors.push({ code: 'CURATOR_LINKAGE_INCOMPLETE' });

  const contentA = canonicalContent(resolvedA);
  const contentB = canonicalContent(resolvedB);
  if (canonicalJson(contentA) !== canonicalJson(contentB)) errors.push({ code: 'REVIEW_CONTENT_SETS_DIFFER' });
  if (fingerprint(contentA) !== a.contentSetFingerprint || fingerprint(contentB) !== b.contentSetFingerprint) {
    errors.push({ code: 'RESOLVED_CONTENT_FINGERPRINT_MISMATCH' });
  }

  const orderA = orderFingerprints(resolvedA);
  const orderB = orderFingerprints(resolvedB);
  for (const [packet, actual] of [[a, orderA], [b, orderB]]) {
    if (packet.randomization.knowledgeOrderSha256 !== actual.knowledge) {
      errors.push({ code: 'KNOWLEDGE_ORDER_FINGERPRINT_MISMATCH', packetId: packet.packetId });
    }
    if (packet.randomization.queryOrderSha256 !== actual.queries) {
      errors.push({ code: 'QUERY_ORDER_FINGERPRINT_MISMATCH', packetId: packet.packetId });
    }
    if (packet.randomization.candidateOrdersSha256 !== actual.candidates) {
      errors.push({ code: 'CANDIDATE_ORDER_FINGERPRINT_MISMATCH', packetId: packet.packetId });
    }
  }
  compareActualOrders(resolvedA, resolvedB, errors);
  validateReproducibleOrders(resolvedA, resolvedB, seeds, errors);

  for (const packet of [a, b]) {
    const knownRefs = new Set(packet.knowledgeItems.map(item => item.knowledgeRef));
    for (const item of packet.queryItems) {
      if (item.candidateKnowledgeRefs.some(ref => !knownRefs.has(ref))) {
        errors.push({ code: 'QUERY_REFERENCES_UNKNOWN_KNOWLEDGE', packetId: packet.packetId, reviewItemRef: item.reviewItemRef });
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
