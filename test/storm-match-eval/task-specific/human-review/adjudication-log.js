import {
  canonicalJson,
  fingerprint,
  HUMAN_REVIEW_STATUS,
  REVIEW_DECISION_GRID
} from './review-packets.js';
import { validateSealedReviewerSubmission } from './review-response-log.js';

const ADJUDICATION_EVENT_STATUSES = new Set(['OPEN', 'RESOLVED', 'REPLACEMENT_REQUIRED']);
const EXPECTED_RESPONSE_EVENT_TYPE = new Map([
  ['candidateLevel', 'candidateDecision'],
  ['answerEquivalence', 'answerEquivalenceGroup'],
  ['preferredEntry', 'answerEquivalenceGroup'],
  ['systemOutcome', 'systemOutcome'],
  ['dangerousFalsePositiveOpportunity', 'dangerousFalsePositiveOpportunity']
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${field} is required`);
  return value;
}

function normaliseReviewerId(value) {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase('fr-FR') : value;
}

function withoutField(value, field) {
  const { [field]: _ignored, ...rest } = value;
  return rest;
}

function withLogFingerprint(logWithoutFingerprint) {
  return deepFreeze({
    ...logWithoutFingerprint,
    logFingerprint: fingerprint(logWithoutFingerprint)
  });
}

function assertExactKeys(value, allowedKeys, subject) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${subject} must be an object`);
  const unexpected = Object.keys(value).filter(key => !allowedKeys.includes(key));
  const missing = allowedKeys.filter(key => !Object.hasOwn(value, key));
  if (unexpected.length > 0 || missing.length > 0) {
    throw new Error(`${subject} fields differ from contract: unexpected=${unexpected.join(',')} missing=${missing.join(',')}`);
  }
}

function hasExactKeys(value, allowedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return canonicalJson(Object.keys(value).sort()) === canonicalJson([...allowedKeys].sort());
}

function assertSealedPair({ reviewerASubmission, reviewerBSubmission, reviewerAPacket, reviewerBPacket }) {
  const a = validateSealedReviewerSubmission(reviewerASubmission, reviewerAPacket);
  const b = validateSealedReviewerSubmission(reviewerBSubmission, reviewerBPacket);
  if (!a.ok || !b.ok) {
    throw new Error(`Adjudication requires two complete sealed human submissions: ${canonicalJson({ a: a.errors, b: b.errors })}`);
  }
  if (reviewerASubmission.reviewerSlot !== 'A' || reviewerBSubmission.reviewerSlot !== 'B') {
    throw new Error('Adjudication submissions must be bound to Reviewer A and Reviewer B');
  }
  if (normaliseReviewerId(reviewerASubmission.reviewerId) === normaliseReviewerId(reviewerBSubmission.reviewerId)) {
    throw new Error('Adjudication requires two independent human reviewers');
  }
  if (reviewerASubmission.sourceFingerprint !== reviewerBSubmission.sourceFingerprint
    || reviewerASubmission.contentSetFingerprint !== reviewerBSubmission.contentSetFingerprint) {
    throw new Error('Adjudication submissions must cover the same source content');
  }
  if (reviewerASubmission.packetFingerprint === reviewerBSubmission.packetFingerprint) {
    throw new Error('Adjudication submissions must originate from distinct packets');
  }
}

function assertCuratorLinkage(curatorLinkage, reviewerAPacket, reviewerBPacket) {
  if (!curatorLinkage || curatorLinkage.linkageFingerprint !== fingerprint(withoutField(curatorLinkage, 'linkageFingerprint'))) {
    throw new Error('A valid curator linkage is required for adjudication');
  }
  if (curatorLinkage.packetFingerprints?.reviewerA !== reviewerAPacket.packetFingerprint
    || curatorLinkage.packetFingerprints?.reviewerB !== reviewerBPacket.packetFingerprint
    || curatorLinkage.sourceFingerprint !== reviewerAPacket.sourceFingerprint
    || curatorLinkage.contentSetFingerprint !== reviewerAPacket.contentSetFingerprint) {
    throw new Error('Curator linkage does not match the sealed review packets');
  }
  if (!Array.isArray(curatorLinkage.knowledgeRefs) || !Array.isArray(curatorLinkage.queryRefs)) {
    throw new Error('Curator linkage must contain knowledge and query mappings');
  }
  const mappings = [
    {
      source: curatorLinkage.knowledgeRefs.map(item => item.entryId),
      reviewerA: curatorLinkage.knowledgeRefs.map(item => item.reviewerA),
      reviewerB: curatorLinkage.knowledgeRefs.map(item => item.reviewerB),
      expectedA: reviewerAPacket.knowledgeItems.map(item => item.knowledgeRef),
      expectedB: reviewerBPacket.knowledgeItems.map(item => item.knowledgeRef),
      subject: 'knowledge'
    },
    {
      source: curatorLinkage.queryRefs.map(item => item.caseId),
      reviewerA: curatorLinkage.queryRefs.map(item => item.reviewerA),
      reviewerB: curatorLinkage.queryRefs.map(item => item.reviewerB),
      expectedA: reviewerAPacket.queryItems.map(item => item.reviewItemRef),
      expectedB: reviewerBPacket.queryItems.map(item => item.reviewItemRef),
      subject: 'query'
    }
  ];
  for (const mapping of mappings) {
    if (new Set(mapping.source).size !== mapping.source.length
      || new Set(mapping.reviewerA).size !== mapping.reviewerA.length
      || new Set(mapping.reviewerB).size !== mapping.reviewerB.length
      || mapping.reviewerA.some(ref => mapping.reviewerB.includes(ref))
      || canonicalJson([...mapping.reviewerA].sort()) !== canonicalJson([...mapping.expectedA].sort())
      || canonicalJson([...mapping.reviewerB].sort()) !== canonicalJson([...mapping.expectedB].sort())) {
      throw new Error(`Curator linkage ${mapping.subject} mapping is not unique and exhaustive`);
    }
  }
}

function packetScope(packet) {
  return {
    packetId: packet.packetId,
    packetFingerprint: packet.packetFingerprint,
    reviewerSlot: packet.reviewerSlot,
    sourceFingerprint: packet.sourceFingerprint,
    contentSetFingerprint: packet.contentSetFingerprint,
    knowledgeRefsSha256: fingerprint(packet.knowledgeItems.map(item => item.knowledgeRef).sort()),
    queryRefsSha256: fingerprint(packet.queryItems.map(item => item.reviewItemRef).sort()),
    candidatePairsSha256: fingerprint(
      packet.queryItems
        .flatMap(item => item.candidateKnowledgeRefs.map(knowledgeRef => `${item.reviewItemRef}\0${knowledgeRef}`))
        .sort()
    )
  };
}

export function createEmptyAdjudicationLog({
  reviewerASubmission,
  reviewerBSubmission,
  reviewerAPacket,
  reviewerBPacket,
  curatorLinkage
}) {
  assertSealedPair({ reviewerASubmission, reviewerBSubmission, reviewerAPacket, reviewerBPacket });
  assertCuratorLinkage(curatorLinkage, reviewerAPacket, reviewerBPacket);
  return withLogFingerprint({
    schemaVersion: 1,
    holdoutQualityGateStatus: HUMAN_REVIEW_STATUS,
    adjudicationStatus: 'READY_AFTER_TWO_SEALED_SUBMISSIONS',
    sourceFingerprint: reviewerASubmission.sourceFingerprint,
    contentSetFingerprint: reviewerASubmission.contentSetFingerprint,
    curatorLinkage: structuredClone(curatorLinkage),
    reviewerSubmissions: {
      reviewerA: structuredClone(reviewerASubmission),
      reviewerB: structuredClone(reviewerBSubmission)
    },
    packetScopes: {
      reviewerA: packetScope(reviewerAPacket),
      reviewerB: packetScope(reviewerBPacket)
    },
    records: []
  });
}

function snapshotResponseEvents(submission, eventIds, reviewerSlot) {
  if (!Array.isArray(eventIds) || eventIds.length === 0 || new Set(eventIds).size !== eventIds.length) {
    throw new Error(`${reviewerSlot} responseEventIds must be a non-empty unique list`);
  }
  return eventIds.map(eventId => {
    const record = submission.records.find(item => item.eventId === eventId);
    if (!record) throw new Error(`${reviewerSlot} response event does not exist: ${eventId}`);
    return {
      eventId: record.eventId,
      eventType: record.eventType,
      eventSha256: record.eventSha256,
      judgment: structuredClone(record.payload)
    };
  });
}

function sourceMaps(linkage, reviewerKey) {
  return {
    entryIdByKnowledgeRef: new Map(linkage.knowledgeRefs.map(item => [item[reviewerKey], item.entryId])),
    caseIdByReviewItemRef: new Map(linkage.queryRefs.map(item => [item[reviewerKey], item.caseId]))
  };
}

function groupMembersByRef(submission, maps) {
  return new Map(
    submission.records
      .filter(record => record.eventType === 'answerEquivalenceGroup')
      .map(record => [
        record.payload.reviewerGroupRef,
        record.payload.memberKnowledgeRefs.map(ref => maps.entryIdByKnowledgeRef.get(ref)).sort()
      ])
  );
}

function resolveSourceScope(subjectType, responseEvents, maps) {
  const expectedEventType = EXPECTED_RESPONSE_EVENT_TYPE.get(subjectType);
  if (!expectedEventType || responseEvents.some(event => event.eventType !== expectedEventType)) {
    throw new Error(`Response event type does not match adjudication subject ${subjectType}`);
  }
  if (!['answerEquivalence', 'preferredEntry'].includes(subjectType) && responseEvents.length !== 1) {
    throw new Error(`${subjectType} adjudication requires exactly one response event per reviewer`);
  }

  if (subjectType === 'candidateLevel') {
    const payload = responseEvents[0].judgment;
    const caseId = maps.caseIdByReviewItemRef.get(payload.reviewItemRef);
    const entryId = maps.entryIdByKnowledgeRef.get(payload.knowledgeRef);
    if (!caseId || !entryId) throw new Error('Candidate judgment contains an unknown blind reference');
    return { caseIds: [caseId], entryIds: [entryId] };
  }
  if (subjectType === 'systemOutcome' || subjectType === 'dangerousFalsePositiveOpportunity') {
    const caseId = maps.caseIdByReviewItemRef.get(responseEvents[0].judgment.reviewItemRef);
    if (!caseId) throw new Error('Query judgment contains an unknown blind reference');
    return { caseIds: [caseId], entryIds: [] };
  }
  const entryIds = responseEvents
    .flatMap(event => event.judgment.memberKnowledgeRefs.map(ref => maps.entryIdByKnowledgeRef.get(ref)));
  if (entryIds.some(entryId => !entryId)) throw new Error('Equivalence judgment contains an unknown blind reference');
  return { caseIds: [], entryIds: [...new Set(entryIds)].sort() };
}

function normaliseDecision(subjectType, responseEvents, maps, submission) {
  if (subjectType === 'candidateLevel') return { decision: responseEvents[0].judgment.decision };
  if (subjectType === 'dangerousFalsePositiveOpportunity') {
    const { isOpportunity, consequenceCategory } = responseEvents[0].judgment;
    return { isOpportunity, consequenceCategory };
  }
  if (subjectType === 'systemOutcome') {
    const { outcome, coveredReviewerGroupRef } = responseEvents[0].judgment;
    const groupMembers = groupMembersByRef(submission, maps);
    return {
      outcome,
      coveredEntryIds: outcome === 'covered' ? groupMembers.get(coveredReviewerGroupRef) : null
    };
  }
  const groups = responseEvents.map(event => ({
    memberEntryIds: event.judgment.memberKnowledgeRefs.map(ref => maps.entryIdByKnowledgeRef.get(ref)).sort(),
    ...(subjectType === 'preferredEntry'
      ? { preferredEntryId: maps.entryIdByKnowledgeRef.get(event.judgment.preferredKnowledgeRef) }
      : {})
  }));
  groups.sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
  return { groups };
}

function deriveAdjudicationSubject(log, subjectType, reviewerAEvents, reviewerBEvents) {
  const mapsA = sourceMaps(log.curatorLinkage, 'reviewerA');
  const mapsB = sourceMaps(log.curatorLinkage, 'reviewerB');
  const scopeA = resolveSourceScope(subjectType, reviewerAEvents, mapsA);
  const scopeB = resolveSourceScope(subjectType, reviewerBEvents, mapsB);
  if (canonicalJson(scopeA) !== canonicalJson(scopeB)) {
    throw new Error('Reviewer response events do not refer to the same source subject');
  }
  const normalisedA = normaliseDecision(subjectType, reviewerAEvents, mapsA, log.reviewerSubmissions.reviewerA);
  const normalisedB = normaliseDecision(subjectType, reviewerBEvents, mapsB, log.reviewerSubmissions.reviewerB);
  if (canonicalJson(normalisedA) === canonicalJson(normalisedB)) {
    throw new Error('Adjudication requires a substantive reviewer disagreement');
  }
  return {
    sourceScope: scopeA,
    subjectRef: `${subjectType}:${fingerprint(scopeA)}`,
    normalisedA,
    normalisedB
  };
}

function assertAdjudicatedDecision(log, subjectType, eventStatus, decision, sourceScope) {
  if (eventStatus === 'OPEN') {
    if (decision !== null) throw new Error('An OPEN adjudication event must have a null decision');
    return;
  }
  if (eventStatus === 'REPLACEMENT_REQUIRED') {
    if (!hasExactKeys(decision, ['action']) || decision.action !== 'replaceCaseAndReviewAgain') {
      throw new Error('A REPLACEMENT_REQUIRED event must request replaceCaseAndReviewAgain');
    }
    return;
  }
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) {
    throw new Error('A RESOLVED adjudication event needs a typed non-null decision');
  }

  if (subjectType === 'candidateLevel') {
    if (!hasExactKeys(decision, ['decision'])
      || !REVIEW_DECISION_GRID.candidateLevel.allowedValues.includes(decision.decision)) {
      throw new Error('Resolved candidateLevel decision is invalid');
    }
    return;
  }
  if (subjectType === 'answerEquivalence') {
    if (!hasExactKeys(decision, ['groups']) || !Array.isArray(decision.groups) || decision.groups.length === 0) {
      throw new Error('Resolved answerEquivalence decision needs non-empty groups');
    }
    const decidedEntryIds = [];
    for (const group of decision.groups) {
      if (!hasExactKeys(group, ['memberEntryIds']) || !Array.isArray(group.memberEntryIds)
        || group.memberEntryIds.length === 0 || new Set(group.memberEntryIds).size !== group.memberEntryIds.length
        || group.memberEntryIds.some(entryId => typeof entryId !== 'string' || entryId.trim() === '')) {
        throw new Error('Resolved answerEquivalence group is invalid');
      }
      decidedEntryIds.push(...group.memberEntryIds);
    }
    if (new Set(decidedEntryIds).size !== decidedEntryIds.length
      || canonicalJson([...decidedEntryIds].sort()) !== canonicalJson([...sourceScope.entryIds].sort())) {
      throw new Error('Resolved answerEquivalence groups must partition the adjudicated source scope');
    }
    return;
  }
  if (subjectType === 'preferredEntry') {
    if (!hasExactKeys(decision, ['preferredEntryId'])
      || !sourceScope.entryIds.includes(decision.preferredEntryId)) {
      throw new Error('Resolved preferredEntry must select an entry from the adjudicated group');
    }
    return;
  }
  if (subjectType === 'systemOutcome') {
    if (!hasExactKeys(decision, ['outcome', 'coveredEntryId'])
      || !REVIEW_DECISION_GRID.systemLevel.allowedValues.includes(decision.outcome)) {
      throw new Error('Resolved systemOutcome decision is invalid');
    }
    if (decision.outcome === 'covered') {
      if (typeof decision.coveredEntryId !== 'string'
        || !log.curatorLinkage.knowledgeRefs.some(item => item.entryId === decision.coveredEntryId)) {
        throw new Error('Resolved covered systemOutcome needs a known source entry');
      }
    } else if (decision.coveredEntryId !== null) {
      throw new Error('Non-covered systemOutcome must have a null coveredEntryId');
    }
    return;
  }
  if (subjectType === 'dangerousFalsePositiveOpportunity') {
    if (!hasExactKeys(decision, ['isOpportunity', 'consequenceCategory'])
      || typeof decision.isOpportunity !== 'boolean'
      || !REVIEW_DECISION_GRID.dangerousFalsePositiveOpportunity.consequenceCategories
        .includes(decision.consequenceCategory)
      || (decision.isOpportunity && decision.consequenceCategory === 'none')
      || (!decision.isOpportunity && decision.consequenceCategory !== 'none')) {
      throw new Error('Resolved dangerousFalsePositiveOpportunity decision is invalid');
    }
  }
}

export function appendAdjudicationRecord(log, input) {
  const validation = validateAdjudicationLog(log);
  if (!validation.ok) throw new Error(`Cannot append to invalid adjudication log: ${canonicalJson(validation.errors)}`);
  if (log.holdoutQualityGateStatus !== HUMAN_REVIEW_STATUS) {
    throw new Error('Holdout Quality Gate must remain pending during adjudication');
  }
  if (log.adjudicationStatus !== 'READY_AFTER_TWO_SEALED_SUBMISSIONS') throw new Error('Adjudication is not authorized');
  assertExactKeys(input, [
    'eventId',
    'eventStatus',
    'disagreementId',
    'subjectType',
    'reviewerAResponseEventIds',
    'reviewerBResponseEventIds',
    'adjudicatedDecision',
    'adjudicatorId',
    'rationale',
    'decidedAt',
    'supersedesEventId'
  ], 'adjudication event');
  requiredString(input.eventId, 'eventId');
  requiredString(input.disagreementId, 'disagreementId');
  requiredString(input.subjectType, 'subjectType');
  if (!EXPECTED_RESPONSE_EVENT_TYPE.has(input.subjectType)) throw new Error('Invalid adjudication subjectType');
  requiredString(input.adjudicatorId, 'adjudicatorId');
  requiredString(input.rationale, 'rationale');
  requiredString(input.decidedAt, 'decidedAt');
  if (!ADJUDICATION_EVENT_STATUSES.has(input.eventStatus)) throw new Error('Invalid adjudication eventStatus');
  if (input.adjudicatedDecision === undefined) throw new Error('adjudicatedDecision is required');
  if (log.records.some(record => record.eventId === input.eventId)) throw new Error(`Duplicate eventId: ${input.eventId}`);

  const superseded = input.supersedesEventId === null
    ? null
    : log.records.find(record => record.eventId === input.supersedesEventId);
  if (input.supersedesEventId !== null && !superseded) {
    throw new Error('supersedesEventId must reference an existing adjudication event');
  }
  if (superseded && superseded.disagreementId !== input.disagreementId) {
    throw new Error('A superseding event must preserve disagreementId');
  }
  if (!superseded && log.records.some(record => record.disagreementId === input.disagreementId)) {
    throw new Error('A repeated disagreementId must explicitly supersede an earlier event');
  }

  const reviewerAEvents = snapshotResponseEvents(
    log.reviewerSubmissions.reviewerA,
    input.reviewerAResponseEventIds,
    'Reviewer A'
  );
  const reviewerBEvents = snapshotResponseEvents(
    log.reviewerSubmissions.reviewerB,
    input.reviewerBResponseEventIds,
    'Reviewer B'
  );
  const subject = deriveAdjudicationSubject(log, input.subjectType, reviewerAEvents, reviewerBEvents);
  assertAdjudicatedDecision(log, input.subjectType, input.eventStatus, input.adjudicatedDecision, subject.sourceScope);
  if (superseded && (superseded.subjectType !== input.subjectType || superseded.subjectRef !== subject.subjectRef)) {
    throw new Error('A superseding event must preserve subjectType and subjectRef');
  }
  if (superseded) {
    const latestForDisagreement = [...log.records].reverse()
      .find(record => record.disagreementId === input.disagreementId);
    if (latestForDisagreement?.eventId !== superseded.eventId
      || log.records.some(record => record.supersedesEventId === superseded.eventId)) {
      throw new Error('Adjudication supersession must extend the current linear head');
    }
  }
  const previousEventSha256 = log.records.at(-1)?.eventSha256 ?? null;
  const recordWithoutHash = {
    sequence: log.records.length + 1,
    eventId: input.eventId,
    eventStatus: input.eventStatus,
    disagreementId: input.disagreementId,
    subjectType: input.subjectType,
    subjectRef: subject.subjectRef,
    subjectSourceScope: subject.sourceScope,
    reviewerA: {
      submissionFingerprint: log.reviewerSubmissions.reviewerA.submissionFingerprint,
      responseEvents: reviewerAEvents,
      normalisedDecision: subject.normalisedA,
      judgmentSha256: fingerprint(reviewerAEvents)
    },
    reviewerB: {
      submissionFingerprint: log.reviewerSubmissions.reviewerB.submissionFingerprint,
      responseEvents: reviewerBEvents,
      normalisedDecision: subject.normalisedB,
      judgmentSha256: fingerprint(reviewerBEvents)
    },
    adjudicatedDecision: structuredClone(input.adjudicatedDecision),
    adjudicatorId: input.adjudicatorId,
    rationale: input.rationale,
    decidedAt: input.decidedAt,
    supersedesEventId: input.supersedesEventId,
    previousEventSha256
  };
  const record = deepFreeze({
    ...recordWithoutHash,
    eventSha256: fingerprint(recordWithoutHash)
  });
  return withLogFingerprint({
    ...withoutField(log, 'logFingerprint'),
    records: [...log.records, record]
  });
}

function responseEventSnapshotsMatch(submission, snapshots) {
  if (!Array.isArray(snapshots) || snapshots.length === 0) return false;
  return snapshots.every(snapshot => {
    const source = submission.records.find(record => record.eventId === snapshot.eventId);
    return source
      && snapshot.eventType === source.eventType
      && snapshot.eventSha256 === source.eventSha256
      && canonicalJson(snapshot.judgment) === canonicalJson(source.payload);
  });
}

export function validateAdjudicationLog(log) {
  const errors = [];
  if (!log || typeof log !== 'object') return { ok: false, errors: [{ code: 'MISSING_ADJUDICATION_LOG' }] };
  if (!hasExactKeys(log, [
    'schemaVersion',
    'holdoutQualityGateStatus',
    'adjudicationStatus',
    'sourceFingerprint',
    'contentSetFingerprint',
    'curatorLinkage',
    'reviewerSubmissions',
    'packetScopes',
    'records',
    'logFingerprint'
  ])) errors.push({ code: 'INVALID_ADJUDICATION_LOG_SCHEMA' });
  if (!hasExactKeys(log.reviewerSubmissions, ['reviewerA', 'reviewerB'])) {
    errors.push({ code: 'INVALID_REVIEW_SUBMISSIONS_SCHEMA' });
  }
  if (!hasExactKeys(log.packetScopes, ['reviewerA', 'reviewerB'])) errors.push({ code: 'INVALID_PACKET_SCOPES_SCHEMA' });
  for (const [reviewerSlot, scope] of Object.entries(log.packetScopes ?? {})) {
    if (!hasExactKeys(scope, [
      'packetId',
      'packetFingerprint',
      'reviewerSlot',
      'sourceFingerprint',
      'contentSetFingerprint',
      'knowledgeRefsSha256',
      'queryRefsSha256',
      'candidatePairsSha256'
    ])) errors.push({ code: 'INVALID_PACKET_SCOPE_SCHEMA', reviewerSlot });
  }
  if (log.holdoutQualityGateStatus !== HUMAN_REVIEW_STATUS) errors.push({ code: 'INVALID_HOLDOUT_GATE_STATUS' });
  if (log.adjudicationStatus !== 'READY_AFTER_TWO_SEALED_SUBMISSIONS') errors.push({ code: 'ADJUDICATION_NOT_READY' });
  const sealedA = validateSealedReviewerSubmission(log.reviewerSubmissions?.reviewerA);
  const sealedB = validateSealedReviewerSubmission(log.reviewerSubmissions?.reviewerB);
  if (!sealedA.ok || !sealedB.ok) errors.push({ code: 'INVALID_EMBEDDED_REVIEW_SUBMISSION' });
  if (log.curatorLinkage?.linkageFingerprint !== fingerprint(withoutField(log.curatorLinkage ?? {}, 'linkageFingerprint'))) {
    errors.push({ code: 'INVALID_EMBEDDED_CURATOR_LINKAGE' });
  }
  if (log.sourceFingerprint !== log.reviewerSubmissions?.reviewerA?.sourceFingerprint
    || log.sourceFingerprint !== log.reviewerSubmissions?.reviewerB?.sourceFingerprint
    || log.sourceFingerprint !== log.curatorLinkage?.sourceFingerprint
    || log.contentSetFingerprint !== log.reviewerSubmissions?.reviewerA?.contentSetFingerprint
    || log.contentSetFingerprint !== log.reviewerSubmissions?.reviewerB?.contentSetFingerprint
    || log.contentSetFingerprint !== log.curatorLinkage?.contentSetFingerprint) {
    errors.push({ code: 'ADJUDICATION_SOURCE_MISMATCH' });
  }
  if (normaliseReviewerId(log.reviewerSubmissions?.reviewerA?.reviewerId)
    === normaliseReviewerId(log.reviewerSubmissions?.reviewerB?.reviewerId)) {
    errors.push({ code: 'REVIEWERS_NOT_INDEPENDENT' });
  }
  if (log.reviewerSubmissions?.reviewerA?.packetFingerprint === log.reviewerSubmissions?.reviewerB?.packetFingerprint) {
    errors.push({ code: 'PACKET_FINGERPRINTS_NOT_DISTINCT' });
  }
  if (log.packetScopes?.reviewerA?.packetFingerprint !== log.reviewerSubmissions?.reviewerA?.packetFingerprint
    || log.packetScopes?.reviewerB?.packetFingerprint !== log.reviewerSubmissions?.reviewerB?.packetFingerprint
    || log.curatorLinkage?.packetFingerprints?.reviewerA !== log.reviewerSubmissions?.reviewerA?.packetFingerprint
    || log.curatorLinkage?.packetFingerprints?.reviewerB !== log.reviewerSubmissions?.reviewerB?.packetFingerprint) {
    errors.push({ code: 'PACKET_SCOPE_MISMATCH' });
  }
  if (log.logFingerprint !== fingerprint(withoutField(log, 'logFingerprint'))) {
    errors.push({ code: 'ADJUDICATION_LOG_FINGERPRINT_MISMATCH' });
  }
  if (!Array.isArray(log.records)) return { ok: false, errors: [...errors, { code: 'MISSING_RECORDS' }] };

  const eventIds = new Set();
  const initialDisagreements = new Set();
  const supersededEventIds = new Set();
  const latestEventIdByDisagreement = new Map();
  let previousEventSha256 = null;
  for (let index = 0; index < log.records.length; index += 1) {
    const record = log.records[index];
    if (!hasExactKeys(record, [
      'sequence',
      'eventId',
      'eventStatus',
      'disagreementId',
      'subjectType',
      'subjectRef',
      'subjectSourceScope',
      'reviewerA',
      'reviewerB',
      'adjudicatedDecision',
      'adjudicatorId',
      'rationale',
      'decidedAt',
      'supersedesEventId',
      'previousEventSha256',
      'eventSha256'
    ])) errors.push({ code: 'INVALID_ADJUDICATION_EVENT_SCHEMA', sequence: record.sequence });
    for (const [reviewerSlot, reviewer] of [['A', record.reviewerA], ['B', record.reviewerB]]) {
      if (!hasExactKeys(reviewer, ['submissionFingerprint', 'responseEvents', 'normalisedDecision', 'judgmentSha256'])) {
        errors.push({ code: 'INVALID_ADJUDICATION_REVIEWER_SNAPSHOT_SCHEMA', reviewerSlot, sequence: record.sequence });
      }
      for (const snapshot of reviewer?.responseEvents ?? []) {
        if (!hasExactKeys(snapshot, ['eventId', 'eventType', 'eventSha256', 'judgment'])) {
          errors.push({ code: 'INVALID_RESPONSE_EVENT_SNAPSHOT_SCHEMA', reviewerSlot, sequence: record.sequence });
        }
      }
    }
    if (record.sequence !== index + 1) errors.push({ code: 'INVALID_SEQUENCE', sequence: record.sequence });
    if (record.previousEventSha256 !== previousEventSha256) errors.push({ code: 'PREVIOUS_HASH_MISMATCH', sequence: record.sequence });
    if (eventIds.has(record.eventId)) errors.push({ code: 'DUPLICATE_EVENT_ID', eventId: record.eventId });
    if (!ADJUDICATION_EVENT_STATUSES.has(record.eventStatus)) errors.push({ code: 'INVALID_EVENT_STATUS', eventId: record.eventId });
    if (!EXPECTED_RESPONSE_EVENT_TYPE.has(record.subjectType)) errors.push({ code: 'INVALID_SUBJECT_TYPE', eventId: record.eventId });
    if (record.supersedesEventId === null) {
      if (initialDisagreements.has(record.disagreementId)) {
        errors.push({ code: 'DUPLICATE_UNSUPERSEDED_DISAGREEMENT', disagreementId: record.disagreementId });
      }
      initialDisagreements.add(record.disagreementId);
      latestEventIdByDisagreement.set(record.disagreementId, record.eventId);
    } else {
      const superseded = log.records.slice(0, index).find(item => item.eventId === record.supersedesEventId);
      if (!superseded || superseded.disagreementId !== record.disagreementId
        || superseded.subjectType !== record.subjectType || superseded.subjectRef !== record.subjectRef
        || supersededEventIds.has(record.supersedesEventId)
        || latestEventIdByDisagreement.get(record.disagreementId) !== record.supersedesEventId) {
        errors.push({ code: 'INVALID_SUPERSEDES_EVENT', eventId: record.eventId });
      }
      supersededEventIds.add(record.supersedesEventId);
      latestEventIdByDisagreement.set(record.disagreementId, record.eventId);
    }
    if (record.reviewerA.submissionFingerprint !== log.reviewerSubmissions.reviewerA.submissionFingerprint
      || record.reviewerB.submissionFingerprint !== log.reviewerSubmissions.reviewerB.submissionFingerprint) {
      errors.push({ code: 'REVIEW_SUBMISSION_REFERENCE_MISMATCH', sequence: record.sequence });
    }
    if (!responseEventSnapshotsMatch(log.reviewerSubmissions.reviewerA, record.reviewerA.responseEvents)) {
      errors.push({ code: 'REVIEWER_A_JUDGMENT_NOT_FROM_SUBMISSION', sequence: record.sequence });
    }
    if (!responseEventSnapshotsMatch(log.reviewerSubmissions.reviewerB, record.reviewerB.responseEvents)) {
      errors.push({ code: 'REVIEWER_B_JUDGMENT_NOT_FROM_SUBMISSION', sequence: record.sequence });
    }
    if (record.reviewerA.judgmentSha256 !== fingerprint(record.reviewerA.responseEvents)) {
      errors.push({ code: 'REVIEWER_A_JUDGMENT_HASH_MISMATCH', sequence: record.sequence });
    }
    if (record.reviewerB.judgmentSha256 !== fingerprint(record.reviewerB.responseEvents)) {
      errors.push({ code: 'REVIEWER_B_JUDGMENT_HASH_MISMATCH', sequence: record.sequence });
    }
    try {
      const subject = deriveAdjudicationSubject(log, record.subjectType, record.reviewerA.responseEvents, record.reviewerB.responseEvents);
      if (record.subjectRef !== subject.subjectRef || canonicalJson(record.subjectSourceScope) !== canonicalJson(subject.sourceScope)) {
        errors.push({ code: 'ADJUDICATION_SUBJECT_MISMATCH', sequence: record.sequence });
      }
      if (canonicalJson(record.reviewerA.normalisedDecision) !== canonicalJson(subject.normalisedA)
        || canonicalJson(record.reviewerB.normalisedDecision) !== canonicalJson(subject.normalisedB)) {
        errors.push({ code: 'NORMALISED_DECISION_MISMATCH', sequence: record.sequence });
      }
      try {
        assertAdjudicatedDecision(log, record.subjectType, record.eventStatus, record.adjudicatedDecision, subject.sourceScope);
      } catch (error) {
        errors.push({ code: 'INVALID_ADJUDICATED_DECISION', sequence: record.sequence, message: error.message });
      }
    } catch (error) {
      errors.push({ code: 'INVALID_ADJUDICATION_SUBJECT', sequence: record.sequence, message: error.message });
    }
    if (record.eventSha256 !== fingerprint(withoutField(record, 'eventSha256'))) {
      errors.push({ code: 'EVENT_HASH_MISMATCH', sequence: record.sequence });
    }
    eventIds.add(record.eventId);
    previousEventSha256 = record.eventSha256;
  }
  return { ok: errors.length === 0, errors };
}
