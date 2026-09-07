import {
  canonicalJson,
  fingerprint,
  HUMAN_REVIEW_STATUS,
  REVIEW_DECISION_GRID
} from './review-packets.js';

export const SEALED_HUMAN_SUBMISSION = 'SEALED_HUMAN_SUBMISSION';

const EVENT_TYPES = new Set([
  'candidateDecision',
  'answerEquivalenceGroup',
  'systemOutcome',
  'dangerousFalsePositiveOpportunity'
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

function validatePayload(eventType, payload) {
  if (eventType === 'candidateDecision') {
    assertExactKeys(payload, ['reviewItemRef', 'knowledgeRef', 'decision', 'rationale'], eventType);
    requiredString(payload.reviewItemRef, 'reviewItemRef');
    requiredString(payload.knowledgeRef, 'knowledgeRef');
    requiredString(payload.rationale, 'rationale');
    if (!REVIEW_DECISION_GRID.candidateLevel.allowedValues.includes(payload.decision)) {
      throw new Error('candidateDecision decision must be covered or notCovered');
    }
    return;
  }
  if (eventType === 'answerEquivalenceGroup') {
    assertExactKeys(payload, ['reviewerGroupRef', 'memberKnowledgeRefs', 'preferredKnowledgeRef', 'rationale'], eventType);
    requiredString(payload.reviewerGroupRef, 'reviewerGroupRef');
    requiredString(payload.preferredKnowledgeRef, 'preferredKnowledgeRef');
    requiredString(payload.rationale, 'rationale');
    if (!Array.isArray(payload.memberKnowledgeRefs) || payload.memberKnowledgeRefs.length === 0) {
      throw new Error('memberKnowledgeRefs must be non-empty');
    }
    if (new Set(payload.memberKnowledgeRefs).size !== payload.memberKnowledgeRefs.length) {
      throw new Error('memberKnowledgeRefs must be unique');
    }
    if (!payload.memberKnowledgeRefs.includes(payload.preferredKnowledgeRef)) {
      throw new Error('preferredKnowledgeRef must belong to its reviewer group');
    }
    return;
  }
  if (eventType === 'systemOutcome') {
    assertExactKeys(payload, ['reviewItemRef', 'outcome', 'coveredReviewerGroupRef', 'rationale'], eventType);
    requiredString(payload.reviewItemRef, 'reviewItemRef');
    requiredString(payload.rationale, 'rationale');
    if (!REVIEW_DECISION_GRID.systemLevel.allowedValues.includes(payload.outcome)) {
      throw new Error('systemOutcome outcome is invalid');
    }
    if (payload.outcome === 'covered') requiredString(payload.coveredReviewerGroupRef, 'coveredReviewerGroupRef');
    if (payload.outcome !== 'covered' && payload.coveredReviewerGroupRef !== null) {
      throw new Error('coveredReviewerGroupRef must be null unless outcome is covered');
    }
    return;
  }
  if (eventType === 'dangerousFalsePositiveOpportunity') {
    assertExactKeys(payload, ['reviewItemRef', 'isOpportunity', 'consequenceCategory', 'rationale'], eventType);
    requiredString(payload.reviewItemRef, 'reviewItemRef');
    requiredString(payload.rationale, 'rationale');
    if (typeof payload.isOpportunity !== 'boolean') throw new Error('isOpportunity must be boolean');
    if (!REVIEW_DECISION_GRID.dangerousFalsePositiveOpportunity.consequenceCategories.includes(payload.consequenceCategory)) {
      throw new Error('consequenceCategory is invalid');
    }
    if (!payload.isOpportunity && payload.consequenceCategory !== 'none') {
      throw new Error('A non-opportunity must use the none consequence category');
    }
    if (payload.isOpportunity && payload.consequenceCategory === 'none') {
      throw new Error('A dangerous opportunity must use a substantive consequence category');
    }
    return;
  }
  throw new Error(`Unsupported response event type: ${eventType}`);
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

export function createEmptyReviewerResponseLog(packet, { reviewerId }) {
  if (!packet || !['A', 'B'].includes(packet.reviewerSlot)) throw new Error('A valid review packet is required');
  requiredString(reviewerId, 'reviewerId');
  const normalisedReviewerId = reviewerId.trim().toLocaleLowerCase('fr-FR');
  if (packet.reviewerSlot === 'A' && normalisedReviewerId !== 'vivien') throw new Error('Reviewer A must be Vivien');
  if (packet.reviewerSlot === 'B' && normalisedReviewerId === 'vivien') {
    throw new Error('Reviewer B must be independent from Reviewer A');
  }

  return withLogFingerprint({
    schemaVersion: 1,
    holdoutQualityGateStatus: HUMAN_REVIEW_STATUS,
    responseStatus: 'IN_PROGRESS',
    reviewerSlot: packet.reviewerSlot,
    reviewerId: normalisedReviewerId,
    packetId: packet.packetId,
    packetFingerprint: packet.packetFingerprint,
    sourceFingerprint: packet.sourceFingerprint,
    contentSetFingerprint: packet.contentSetFingerprint,
    records: []
  });
}

function eventIdentity(eventType, payload) {
  if (eventType === 'candidateDecision') return `${eventType}:${payload.reviewItemRef}:${payload.knowledgeRef}`;
  if (eventType === 'answerEquivalenceGroup') return `${eventType}:${payload.reviewerGroupRef}`;
  return `${eventType}:${payload.reviewItemRef}`;
}

export function appendReviewerResponseRecord(log, input) {
  const validation = validateReviewerResponseLog(log);
  if (!validation.ok) throw new Error(`Cannot append to invalid response log: ${canonicalJson(validation.errors)}`);
  if (log.responseStatus !== 'IN_PROGRESS') throw new Error('Cannot append to a sealed response log');
  assertExactKeys(input, ['eventId', 'eventType', 'recordedAt', 'payload'], 'response record');
  requiredString(input.eventId, 'eventId');
  requiredString(input.recordedAt, 'recordedAt');
  if (!EVENT_TYPES.has(input.eventType)) throw new Error(`Unsupported response event type: ${input.eventType}`);
  validatePayload(input.eventType, input.payload);

  const identity = eventIdentity(input.eventType, input.payload);
  if (log.records.some(record => record.eventId === input.eventId || record.identity === identity)) {
    throw new Error(`Duplicate append-only response record: ${input.eventId}`);
  }
  const previousEventSha256 = log.records.at(-1)?.eventSha256 ?? null;
  const recordWithoutHash = {
    sequence: log.records.length + 1,
    eventId: input.eventId,
    eventType: input.eventType,
    identity,
    recordedAt: input.recordedAt,
    payload: structuredClone(input.payload),
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

function validateCompleteness(log, packet, errors) {
  if (!packet) {
    errors.push({ code: 'PACKET_REQUIRED_FOR_COMPLETENESS' });
    return;
  }
  if (packet.packetFingerprint !== log.packetFingerprint || packet.reviewerSlot !== log.reviewerSlot
    || packet.packetId !== log.packetId || packet.sourceFingerprint !== log.sourceFingerprint
    || packet.contentSetFingerprint !== log.contentSetFingerprint) {
    errors.push({ code: 'RESPONSE_PACKET_MISMATCH' });
    return;
  }

  const knowledgeRefs = new Set(packet.knowledgeItems.map(item => item.knowledgeRef));
  const queryByRef = new Map(packet.queryItems.map(item => [item.reviewItemRef, item]));
  const candidateRecords = log.records.filter(record => record.eventType === 'candidateDecision');
  const expectedPairKeys = new Set(
    packet.queryItems.flatMap(item => item.candidateKnowledgeRefs.map(ref => `${item.reviewItemRef}:${ref}`))
  );
  const actualPairKeys = new Set(candidateRecords.map(record => `${record.payload.reviewItemRef}:${record.payload.knowledgeRef}`));
  if (canonicalJson([...actualPairKeys].sort()) !== canonicalJson([...expectedPairKeys].sort())) {
    errors.push({ code: 'CANDIDATE_DECISIONS_NOT_EXHAUSTIVE' });
  }

  const groups = log.records.filter(record => record.eventType === 'answerEquivalenceGroup');
  const groupedRefs = groups.flatMap(record => record.payload.memberKnowledgeRefs);
  if (groupedRefs.length !== knowledgeRefs.size || new Set(groupedRefs).size !== knowledgeRefs.size
    || groupedRefs.some(ref => !knowledgeRefs.has(ref))) {
    errors.push({ code: 'EQUIVALENCE_GROUPS_NOT_EXHAUSTIVE_PARTITION' });
  }
  const groupRefs = new Set(groups.map(record => record.payload.reviewerGroupRef));
  if (groupRefs.size !== groups.length) errors.push({ code: 'DUPLICATE_REVIEWER_GROUP_REF' });
  const groupRefByKnowledgeRef = new Map(
    groups.flatMap(record => record.payload.memberKnowledgeRefs.map(knowledgeRef => [
      knowledgeRef,
      record.payload.reviewerGroupRef
    ]))
  );

  for (const eventType of ['systemOutcome', 'dangerousFalsePositiveOpportunity']) {
    const records = log.records.filter(record => record.eventType === eventType);
    const refs = records.map(record => record.payload.reviewItemRef);
    if (refs.length !== queryByRef.size || new Set(refs).size !== queryByRef.size
      || refs.some(ref => !queryByRef.has(ref))) {
      errors.push({ code: `${eventType.toUpperCase()}_NOT_EXHAUSTIVE` });
    }
  }
  for (const record of log.records.filter(item => item.eventType === 'systemOutcome' && item.payload.outcome === 'covered')) {
    if (!groupRefs.has(record.payload.coveredReviewerGroupRef)) {
      errors.push({ code: 'SYSTEM_OUTCOME_REFERENCES_UNKNOWN_GROUP', reviewItemRef: record.payload.reviewItemRef });
    }
  }

  const systemOutcomeByQueryRef = new Map(
    log.records
      .filter(record => record.eventType === 'systemOutcome')
      .map(record => [record.payload.reviewItemRef, record.payload])
  );
  for (const query of packet.queryItems) {
    const coveredGroups = new Set(
      candidateRecords
        .filter(record => record.payload.reviewItemRef === query.reviewItemRef && record.payload.decision === 'covered')
        .map(record => groupRefByKnowledgeRef.get(record.payload.knowledgeRef))
        .filter(Boolean)
    );
    const systemOutcome = systemOutcomeByQueryRef.get(query.reviewItemRef);
    if (!systemOutcome) continue;
    const expectedOutcome = coveredGroups.size === 0 ? 'notCovered' : coveredGroups.size === 1 ? 'covered' : 'ambiguous';
    const expectedGroupRef = expectedOutcome === 'covered' ? [...coveredGroups][0] : null;
    if (systemOutcome.outcome !== expectedOutcome || systemOutcome.coveredReviewerGroupRef !== expectedGroupRef) {
      errors.push({ code: 'SYSTEM_OUTCOME_INCONSISTENT_WITH_CANDIDATE_GROUPS', reviewItemRef: query.reviewItemRef });
    }
  }
}

export function validateReviewerResponseLog(log, packet, { requireComplete = false } = {}) {
  const errors = [];
  if (!log || typeof log !== 'object') return { ok: false, errors: [{ code: 'MISSING_RESPONSE_LOG' }] };
  if (!hasExactKeys(log, [
    'schemaVersion',
    'holdoutQualityGateStatus',
    'responseStatus',
    'reviewerSlot',
    'reviewerId',
    'packetId',
    'packetFingerprint',
    'sourceFingerprint',
    'contentSetFingerprint',
    'records',
    'logFingerprint'
  ])) errors.push({ code: 'INVALID_RESPONSE_LOG_SCHEMA' });
  if (log.holdoutQualityGateStatus !== HUMAN_REVIEW_STATUS) errors.push({ code: 'INVALID_HOLDOUT_GATE_STATUS' });
  if (!['IN_PROGRESS', SEALED_HUMAN_SUBMISSION].includes(log.responseStatus)) errors.push({ code: 'INVALID_RESPONSE_STATUS' });
  const normalisedReviewerId = typeof log.reviewerId === 'string'
    ? log.reviewerId.trim().toLocaleLowerCase('fr-FR')
    : log.reviewerId;
  if (!['A', 'B'].includes(log.reviewerSlot)) errors.push({ code: 'INVALID_REVIEWER_SLOT' });
  if (typeof log.reviewerId !== 'string' || log.reviewerId.trim() === '') errors.push({ code: 'MISSING_REVIEWER_ID' });
  if (log.reviewerSlot === 'A' && normalisedReviewerId !== 'vivien') errors.push({ code: 'REVIEWER_A_IDENTITY_MISMATCH' });
  if (log.reviewerSlot === 'B' && normalisedReviewerId === 'vivien') errors.push({ code: 'REVIEWER_B_NOT_INDEPENDENT' });
  if (log.logFingerprint !== fingerprint(withoutField(log, 'logFingerprint'))) errors.push({ code: 'RESPONSE_LOG_FINGERPRINT_MISMATCH' });
  if (!Array.isArray(log.records)) return { ok: false, errors: [...errors, { code: 'MISSING_RESPONSE_RECORDS' }] };

  const eventIds = new Set();
  const identities = new Set();
  let previousEventSha256 = null;
  for (let index = 0; index < log.records.length; index += 1) {
    const record = log.records[index];
    if (!hasExactKeys(record, [
      'sequence',
      'eventId',
      'eventType',
      'identity',
      'recordedAt',
      'payload',
      'previousEventSha256',
      'eventSha256'
    ])) errors.push({ code: 'INVALID_RESPONSE_RECORD_SCHEMA', sequence: record.sequence });
    if (record.sequence !== index + 1) errors.push({ code: 'INVALID_RESPONSE_SEQUENCE', sequence: record.sequence });
    if (record.previousEventSha256 !== previousEventSha256) errors.push({ code: 'RESPONSE_PREVIOUS_HASH_MISMATCH', sequence: record.sequence });
    if (record.eventSha256 !== fingerprint(withoutField(record, 'eventSha256'))) {
      errors.push({ code: 'RESPONSE_EVENT_HASH_MISMATCH', sequence: record.sequence });
    }
    if (record.identity !== eventIdentity(record.eventType, record.payload)) {
      errors.push({ code: 'RESPONSE_EVENT_IDENTITY_MISMATCH', sequence: record.sequence });
    }
    if (eventIds.has(record.eventId)) errors.push({ code: 'DUPLICATE_RESPONSE_EVENT_ID', eventId: record.eventId });
    if (identities.has(record.identity)) errors.push({ code: 'DUPLICATE_RESPONSE_DECISION', identity: record.identity });
    eventIds.add(record.eventId);
    identities.add(record.identity);
    try {
      validatePayload(record.eventType, record.payload);
    } catch (error) {
      errors.push({ code: 'INVALID_RESPONSE_PAYLOAD', sequence: record.sequence, message: error.message });
    }
    previousEventSha256 = record.eventSha256;
  }

  if (requireComplete) validateCompleteness(log, packet, errors);
  return { ok: errors.length === 0, errors };
}

export function sealReviewerResponseLog(log, packet, { sealedAt, attestation }) {
  const validation = validateReviewerResponseLog(log, packet, { requireComplete: true });
  if (!validation.ok) throw new Error(`Cannot seal incomplete response log: ${canonicalJson(validation.errors)}`);
  if (log.responseStatus !== 'IN_PROGRESS') throw new Error('Response log is already sealed');
  requiredString(sealedAt, 'sealedAt');
  assertExactKeys(attestation, ['reviewerId', 'statement'], 'human attestation');
  if (attestation.reviewerId !== log.reviewerId) throw new Error('Attestation reviewer does not match response log');
  requiredString(attestation.statement, 'attestation.statement');

  const submissionWithoutFingerprint = {
    ...withoutField(log, 'logFingerprint'),
    responseStatus: SEALED_HUMAN_SUBMISSION,
    sealedAt,
    humanAttestation: structuredClone(attestation)
  };
  return deepFreeze({
    ...submissionWithoutFingerprint,
    submissionFingerprint: fingerprint(submissionWithoutFingerprint)
  });
}

export function validateSealedReviewerSubmission(submission, packet) {
  const errors = [];
  if (!submission || typeof submission !== 'object') {
    return { ok: false, errors: [{ code: 'MISSING_SEALED_SUBMISSION' }] };
  }
  if (!hasExactKeys(submission, [
    'schemaVersion',
    'holdoutQualityGateStatus',
    'responseStatus',
    'reviewerSlot',
    'reviewerId',
    'packetId',
    'packetFingerprint',
    'sourceFingerprint',
    'contentSetFingerprint',
    'records',
    'sealedAt',
    'humanAttestation',
    'submissionFingerprint'
  ])) errors.push({ code: 'INVALID_SEALED_SUBMISSION_SCHEMA' });
  if (submission?.responseStatus !== SEALED_HUMAN_SUBMISSION) errors.push({ code: 'SUBMISSION_NOT_SEALED' });
  if (typeof submission.sealedAt !== 'string' || submission.sealedAt.trim() === '') errors.push({ code: 'MISSING_SEALED_AT' });
  const attestedReviewerId = typeof submission.humanAttestation?.reviewerId === 'string'
    ? submission.humanAttestation.reviewerId.trim().toLocaleLowerCase('fr-FR')
    : submission.humanAttestation?.reviewerId;
  const submittedReviewerId = typeof submission.reviewerId === 'string'
    ? submission.reviewerId.trim().toLocaleLowerCase('fr-FR')
    : submission.reviewerId;
  if (!submission.humanAttestation || attestedReviewerId !== submittedReviewerId
    || typeof submittedReviewerId !== 'string' || submittedReviewerId === ''
    || typeof submission.humanAttestation.statement !== 'string' || submission.humanAttestation.statement.trim() === '') {
    errors.push({ code: 'INVALID_HUMAN_ATTESTATION' });
  }
  if (!hasExactKeys(submission.humanAttestation, ['reviewerId', 'statement'])) {
    errors.push({ code: 'INVALID_HUMAN_ATTESTATION_SCHEMA' });
  }
  if (submission?.submissionFingerprint !== fingerprint(withoutField(submission, 'submissionFingerprint'))) {
    errors.push({ code: 'SUBMISSION_FINGERPRINT_MISMATCH' });
  }
  const asLog = submission && {
    ...submission,
    logFingerprint: fingerprint(withoutField(withoutField(withoutField(submission, 'submissionFingerprint'), 'sealedAt'), 'humanAttestation'))
  };
  if (asLog) {
    delete asLog.submissionFingerprint;
    delete asLog.sealedAt;
    delete asLog.humanAttestation;
    const validation = validateReviewerResponseLog(asLog, packet, { requireComplete: Boolean(packet) });
    errors.push(...validation.errors.filter(error => error.code !== 'RESPONSE_LOG_FINGERPRINT_MISMATCH'));
  }
  return { ok: errors.length === 0, errors };
}
