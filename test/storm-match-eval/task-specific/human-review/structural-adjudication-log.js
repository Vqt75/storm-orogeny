import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

import { canonicalJson, fingerprint } from './review-packets.js';

export const STRUCTURAL_HUMAN_ADJUDICATION_LOG = 'STRUCTURAL_HUMAN_ADJUDICATION_LOG';
export const HUMAN_ADJUDICATION_PROVENANCE = 'HUMAN_ADJUDICATION';
export const STRUCTURAL_ADJUDICATION_BATCH_SEAL = 'STRUCTURAL_ADJUDICATION_BATCH_SEAL';

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const LOG_KEYS = Object.freeze([
  'appendOnly',
  'authorizedSourceItemIds',
  'batchId',
  'events',
  'generationAuthorized',
  'humanDoctrine',
  'logFingerprint',
  'logType',
  'schemaVersion',
  'sourceMatrixFingerprint',
  'sourceReviewerSeals',
  'status'
]);
const EVENT_KEYS = Object.freeze([
  'batchId',
  'decision',
  'eventHash',
  'eventId',
  'humanRationale',
  'previousEventHash',
  'provenance',
  'recordedAt',
  'sequence',
  'sourceComparisonItemFingerprint',
  'sourceItemId'
]);
const FUTURE_RULE_EVENT_KEYS = Object.freeze([...EVENT_KEYS, 'futureRule']);
const INPUT_KEYS = Object.freeze([
  'decision',
  'eventId',
  'humanRationale',
  'provenance',
  'recordedAt',
  'sourceItemId'
]);
const FUTURE_RULE_INPUT_KEYS = Object.freeze([...INPUT_KEYS, 'futureRule']);
const SEAL_KEYS = Object.freeze([
  'batchId',
  'eventCount',
  'finalEventHash',
  'journalCanonicalSha256',
  'journalFingerprint',
  'journalPath',
  'schemaVersion',
  'sealHash',
  'sealType',
  'sealedAt',
  'sourceMatrixFingerprint',
  'sourceReviewerSeals'
]);
const HUMAN_PROVENANCE_SEAL_KEYS = Object.freeze([...SEAL_KEYS, 'provenance']);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function withoutField(value, field) {
  const { [field]: _ignored, ...rest } = value;
  return rest;
}

function hasExactKeys(value, expected) {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...expected].sort());
}

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${field} is required`);
}

function canonicalEqual(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function isCanonicalTimestamp(value) {
  if (typeof value !== 'string') return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

export function canonicaliseAdjudicatedPartition(partition) {
  return partition
    .map(group => ({
      componentId: group.componentId,
      memberEntryIds: [...group.memberEntryIds].sort()
    }))
    .sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
}

function assertPartitionCoversScope(partition, sourceScope) {
  if (!Array.isArray(partition) || partition.length === 0) throw new Error('Decision requires a non-empty canonicalPartition');
  const componentIds = [];
  const memberEntryIds = [];
  for (const group of partition) {
    if (!hasExactKeys(group, ['componentId', 'memberEntryIds'])) throw new Error('Invalid canonicalPartition group schema');
    requiredString(group.componentId, 'componentId');
    if (!Array.isArray(group.memberEntryIds) || group.memberEntryIds.length === 0
      || new Set(group.memberEntryIds).size !== group.memberEntryIds.length
      || group.memberEntryIds.some(entryId => typeof entryId !== 'string' || entryId.trim() === '')) {
      throw new Error('Invalid canonicalPartition memberEntryIds');
    }
    componentIds.push(group.componentId);
    memberEntryIds.push(...group.memberEntryIds);
  }
  if (new Set(componentIds).size !== componentIds.length
    || new Set(memberEntryIds).size !== memberEntryIds.length
    || canonicalJson([...memberEntryIds].sort()) !== canonicalJson([...sourceScope].sort())) {
    throw new Error('canonicalPartition must partition the complete source knowledge scope');
  }
}

function assertEquivalenceDecision(decision, sourceScope) {
  if (!hasExactKeys(decision, ['preferredEntrySelection', 'substantiveEquivalencePartition'])) {
    throw new Error('Invalid equivalence adjudication decision schema');
  }
  const partition = decision.substantiveEquivalencePartition;
  if (!hasExactKeys(partition, ['canonicalPartition', 'value'])
    || partition.value !== 'oneEquivalentGroup'
    || !Array.isArray(partition.canonicalPartition)
    || partition.canonicalPartition.length !== 1
    || canonicalJson([...partition.canonicalPartition[0]].sort()) !== canonicalJson([...sourceScope].sort())) {
    throw new Error('Invalid equivalence adjudication partition');
  }
  const preferred = decision.preferredEntrySelection;
  if (!hasExactKeys(preferred, ['preferredEntryId', 'value'])
    || preferred.value !== 'chooseOneDisplayedKnowledgeRef'
    || !sourceScope.includes(preferred.preferredEntryId)) {
    throw new Error('Invalid equivalence preferred entry selection');
  }
}

function assertBoundaryDecision(decision, sourceScope) {
  if (!hasExactKeys(decision, ['futureCoverageBoundaryRules', 'knowledgeComponentBoundary'])) {
    throw new Error('Invalid knowledge-boundary adjudication decision schema');
  }
  const boundary = decision.knowledgeComponentBoundary;
  if (!hasExactKeys(boundary, ['canonicalPartition', 'value']) || boundary.value !== 'partitionRequired') {
    throw new Error('Invalid knowledge-boundary decision value');
  }
  assertPartitionCoversScope(boundary.canonicalPartition, sourceScope);
  const rules = decision.futureCoverageBoundaryRules;
  if (!Array.isArray(rules) || rules.length === 0) throw new Error('Future coverage boundary rules are required');
  for (const rule of rules) {
    if (!hasExactKeys(rule, ['componentId', 'rule'])) throw new Error('Invalid future coverage rule schema');
    requiredString(rule.componentId, 'futureCoverageBoundaryRules.componentId');
    requiredString(rule.rule, 'futureCoverageBoundaryRules.rule');
  }
  if (new Set(rules.map(rule => rule.componentId)).size !== rules.length) {
    throw new Error('Future coverage rule componentIds must be unique');
  }
}

function assertAmbiguityPartitionCoversScope(partition, sourceScope) {
  if (!Array.isArray(partition) || partition.length < 2) {
    throw new Error('Structural ambiguity requires at least two covered groups');
  }
  const memberEntryIds = [];
  for (const group of partition) {
    if (!Array.isArray(group) || group.length === 0
      || new Set(group).size !== group.length
      || group.some(entryId => typeof entryId !== 'string' || entryId.trim() === '')) {
      throw new Error('Invalid ambiguity canonicalPartition group');
    }
    memberEntryIds.push(...group);
  }
  if (new Set(memberEntryIds).size !== memberEntryIds.length
    || canonicalJson([...memberEntryIds].sort()) !== canonicalJson([...sourceScope].sort())) {
    throw new Error('Ambiguity canonicalPartition must partition the complete source knowledge scope');
  }
}

function assertAmbiguityDecision(decision, sourceScope) {
  if (!hasExactKeys(decision, [
    'ambiguityFamilyDisposition',
    'ambiguityMechanism',
    'substantiallyDifferentCoveredGroups'
  ])) {
    throw new Error('Invalid ambiguity adjudication decision schema');
  }
  const disposition = decision.ambiguityFamilyDisposition;
  const mechanism = decision.ambiguityMechanism;
  const groups = decision.substantiallyDifferentCoveredGroups;
  if (!hasExactKeys(disposition, ['value'])
    || !hasExactKeys(mechanism, ['value'])
    || !hasExactKeys(groups, ['canonicalPartition', 'value'])) {
    throw new Error('Invalid ambiguity adjudication decision fields');
  }
  const allowedDispositions = new Set([
    'structuralAmbiguity',
    'notCovered',
    'artificialOrMalformed',
    'blockedTemporalInstability',
    'insufficientEvidence'
  ]);
  if (!allowedDispositions.has(disposition.value)) {
    throw new Error('Invalid ambiguity disposition');
  }
  if (disposition.value === 'structuralAmbiguity') {
    const allowedMechanisms = new Set([
      'underspecifiedReference',
      'competingPublishedKnowledge',
      'alternativeIntentReadings'
    ]);
    if (!allowedMechanisms.has(mechanism.value)
      || groups.value !== 'reviewerDefinedPartitionOfDisplayedKnowledge') {
      throw new Error('Structural ambiguity requires one supported mechanism and explicit covered groups');
    }
    assertAmbiguityPartitionCoversScope(groups.canonicalPartition, sourceScope);
    return;
  }
  if (mechanism.value !== null || groups.value !== null || groups.canonicalPartition !== null) {
    throw new Error('Non-structural ambiguity disposition cannot carry mechanism or covered groups');
  }
}

function assertScenarioPartitionCoversScope(partition, sourceScope) {
  if (!Array.isArray(partition) || partition.length === 0) {
    throw new Error('Scenario-family adjudication requires at least one family group');
  }
  const memberEntryIds = [];
  for (const group of partition) {
    if (!Array.isArray(group) || group.length === 0
      || new Set(group).size !== group.length
      || group.some(entryId => typeof entryId !== 'string' || entryId.trim() === '')) {
      throw new Error('Invalid scenario-family canonicalPartition group');
    }
    memberEntryIds.push(...group);
  }
  if (new Set(memberEntryIds).size !== memberEntryIds.length
    || canonicalJson([...memberEntryIds].sort()) !== canonicalJson([...sourceScope].sort())) {
    throw new Error('Scenario-family canonicalPartition must partition the complete source knowledge scope');
  }
}

function assertScenarioFamilyDecision(decision, sourceScope) {
  if (!hasExactKeys(decision, [
    'fragmentationAssessment',
    'reviewerScenarioFamilyPartition'
  ])) {
    throw new Error('Invalid scenario-family adjudication decision schema');
  }
  const fragmentation = decision.fragmentationAssessment;
  const partition = decision.reviewerScenarioFamilyPartition;
  if (!hasExactKeys(fragmentation, ['mergeCanonicalReviewItemIds', 'value'])
    || !hasExactKeys(partition, ['canonicalPartition', 'value'])) {
    throw new Error('Invalid scenario-family adjudication decision fields');
  }
  const allowedDispositions = new Set([
    'distinct',
    'mergeWithAnotherDisplayedBrief',
    'tooBroad',
    'artificiallyFragmented',
    'insufficientEvidence'
  ]);
  if (!allowedDispositions.has(fragmentation.value)
    || !Array.isArray(fragmentation.mergeCanonicalReviewItemIds)
    || new Set(fragmentation.mergeCanonicalReviewItemIds).size !== fragmentation.mergeCanonicalReviewItemIds.length
    || fragmentation.mergeCanonicalReviewItemIds.some(itemId => typeof itemId !== 'string' || itemId.trim() === '')) {
    throw new Error('Invalid scenario-family fragmentation assessment');
  }
  if (fragmentation.value === 'mergeWithAnotherDisplayedBrief') {
    if (fragmentation.mergeCanonicalReviewItemIds.length === 0) {
      throw new Error('Scenario-family merge disposition requires merge candidates');
    }
  } else if (fragmentation.mergeCanonicalReviewItemIds.length !== 0) {
    throw new Error('Scenario-family non-merge disposition cannot carry merge candidates');
  }
  if (partition.value === 'reviewerDefinedFamilyGroups') {
    assertScenarioPartitionCoversScope(partition.canonicalPartition, sourceScope);
    return;
  }
  if (partition.value !== 'insufficientEvidence' || partition.canonicalPartition !== null
    || fragmentation.value !== 'insufficientEvidence') {
    throw new Error('Invalid scenario-family partition');
  }
}

function assertDecision(decision, comparisonItem) {
  if (comparisonItem.packetKind === 'EQUIVALENCE_AND_PREFERRED') {
    assertEquivalenceDecision(decision, comparisonItem.canonicalKnowledgeScope);
    return;
  }
  if (comparisonItem.packetKind === 'KNOWLEDGE_BOUNDARIES') {
    assertBoundaryDecision(decision, comparisonItem.canonicalKnowledgeScope);
    return;
  }
  if (comparisonItem.packetKind === 'AMBIGUITY_CAPACITY_FAMILIES') {
    assertAmbiguityDecision(decision, comparisonItem.canonicalKnowledgeScope);
    return;
  }
  if (comparisonItem.packetKind === 'SCENARIO_FAMILY_PREFLIGHT') {
    assertScenarioFamilyDecision(decision, comparisonItem.canonicalKnowledgeScope);
    return;
  }
  throw new Error(`Structural adjudication packet kind is not supported: ${comparisonItem.packetKind}`);
}

function validateMatrix(matrix, expectedFingerprint) {
  if (!matrix || matrix.matrixFingerprint !== expectedFingerprint
    || fingerprint(withoutField(matrix, 'matrixFingerprint')) !== matrix.matrixFingerprint) {
    throw new Error('Structural adjudication source matrix fingerprint mismatch');
  }
  if (matrix.status !== 'PENDING_HUMAN_REVIEW'
    || matrix.generationAuthorized !== false
    || matrix.adjudicationPerformed !== false) {
    throw new Error('Structural adjudication source matrix guard fields are invalid');
  }
}

function withLogFingerprint(logWithoutFingerprint) {
  return deepFreeze({
    ...logWithoutFingerprint,
    logFingerprint: fingerprint(logWithoutFingerprint)
  });
}

export function createEmptyStructuralAdjudicationLog({
  batchId,
  sourceMatrix,
  sourceReviewerSeals,
  authorizedSourceItemIds,
  humanDoctrine
}) {
  requiredString(batchId, 'batchId');
  validateMatrix(sourceMatrix, sourceMatrix.matrixFingerprint);
  if (!hasExactKeys(sourceReviewerSeals, ['reviewerA', 'reviewerB'])
    || Object.values(sourceReviewerSeals).some(value => !HASH_PATTERN.test(value))
    || sourceReviewerSeals.reviewerA !== sourceMatrix.sourceReviews?.reviewerA?.sealHash
    || sourceReviewerSeals.reviewerB !== sourceMatrix.sourceReviews?.reviewerB?.sealHash) {
    throw new Error('Two valid reviewer seal hashes are required');
  }
  if (!Array.isArray(authorizedSourceItemIds) || authorizedSourceItemIds.length === 0
    || new Set(authorizedSourceItemIds).size !== authorizedSourceItemIds.length
    || authorizedSourceItemIds.some(sourceItemId => !sourceMatrix.items.some(item => item.canonicalReviewItemId === sourceItemId))) {
    throw new Error('authorizedSourceItemIds must be unique known matrix items');
  }
  if (!humanDoctrine || typeof humanDoctrine !== 'object' || Array.isArray(humanDoctrine)) {
    throw new Error('Human adjudication doctrine is required');
  }
  return withLogFingerprint({
    schemaVersion: 1,
    logType: STRUCTURAL_HUMAN_ADJUDICATION_LOG,
    batchId,
    sourceMatrixFingerprint: sourceMatrix.matrixFingerprint,
    sourceReviewerSeals: structuredClone(sourceReviewerSeals),
    status: 'PENDING_HUMAN_REVIEW',
    generationAuthorized: false,
    appendOnly: true,
    authorizedSourceItemIds: [...authorizedSourceItemIds],
    humanDoctrine: structuredClone(humanDoctrine),
    events: []
  });
}

export function constructStructuralAdjudicationLogWithEvent(log, input, sourceMatrix) {
  const validation = validateStructuralAdjudicationLog(log, sourceMatrix);
  if (!validation.ok) throw new Error(`Cannot append to invalid structural adjudication log: ${canonicalJson(validation.errors)}`);
  if (!hasExactKeys(input, INPUT_KEYS) && !hasExactKeys(input, FUTURE_RULE_INPUT_KEYS)) {
    throw new Error('Structural adjudication input fields differ from contract');
  }
  requiredString(input.eventId, 'eventId');
  requiredString(input.sourceItemId, 'sourceItemId');
  requiredString(input.humanRationale, 'humanRationale');
  if (input.provenance !== HUMAN_ADJUDICATION_PROVENANCE) throw new Error('Structural adjudication provenance must be HUMAN_ADJUDICATION');
  if (!isCanonicalTimestamp(input.recordedAt)) throw new Error('Structural adjudication recordedAt must be canonical ISO-8601');
  if (!log.authorizedSourceItemIds.includes(input.sourceItemId)) throw new Error('sourceItemId is outside the authorized adjudication batch');
  if (log.events.some(event => event.eventId === input.eventId)) throw new Error(`Duplicate structural adjudication eventId: ${input.eventId}`);
  if (log.events.some(event => event.sourceItemId === input.sourceItemId)) throw new Error(`Duplicate structural adjudication sourceItemId: ${input.sourceItemId}`);
  const comparisonItem = sourceMatrix.items.find(item => item.canonicalReviewItemId === input.sourceItemId);
  if (!comparisonItem || !comparisonItem.requiresAdjudication) throw new Error('sourceItemId is not an unresolved matrix item');
  const requiresFutureRule = comparisonItem.packetKind === 'AMBIGUITY_CAPACITY_FAMILIES'
    || comparisonItem.packetKind === 'SCENARIO_FAMILY_PREFLIGHT';
  if (requiresFutureRule) {
    if (!hasExactKeys(input, FUTURE_RULE_INPUT_KEYS)) throw new Error('This adjudication input requires futureRule');
    requiredString(input.futureRule, 'futureRule');
  } else if (!hasExactKeys(input, INPUT_KEYS)) {
    throw new Error('This adjudication input cannot carry futureRule');
  }
  assertDecision(input.decision, comparisonItem);
  const previousEventHash = log.events.at(-1)?.eventHash ?? null;
  const eventWithoutHash = {
    sequence: log.events.length + 1,
    eventId: input.eventId,
    batchId: log.batchId,
    sourceItemId: input.sourceItemId,
    sourceComparisonItemFingerprint: fingerprint(comparisonItem),
    decision: structuredClone(input.decision),
    humanRationale: input.humanRationale,
    ...(requiresFutureRule ? { futureRule: input.futureRule } : {}),
    recordedAt: input.recordedAt,
    provenance: input.provenance,
    previousEventHash
  };
  const event = deepFreeze({ ...eventWithoutHash, eventHash: fingerprint(eventWithoutHash) });
  return withLogFingerprint({
    ...withoutField(log, 'logFingerprint'),
    events: [...log.events, event]
  });
}

export function validateStructuralAdjudicationLog(log, sourceMatrix) {
  const errors = [];
  if (!hasExactKeys(log, LOG_KEYS)) return { ok: false, errors: [{ code: 'INVALID_STRUCTURAL_ADJUDICATION_LOG_SCHEMA' }] };
  try {
    validateMatrix(sourceMatrix, log.sourceMatrixFingerprint);
  } catch (error) {
    errors.push({ code: 'INVALID_SOURCE_MATRIX', message: error.message });
  }
  if (log.schemaVersion !== 1 || log.logType !== STRUCTURAL_HUMAN_ADJUDICATION_LOG || log.appendOnly !== true) {
    errors.push({ code: 'INVALID_STRUCTURAL_ADJUDICATION_LOG_HEADER' });
  }
  if (log.status !== 'PENDING_HUMAN_REVIEW' || log.generationAuthorized !== false) {
    errors.push({ code: 'INVALID_STRUCTURAL_ADJUDICATION_GUARDS' });
  }
  if (!hasExactKeys(log.sourceReviewerSeals, ['reviewerA', 'reviewerB'])
    || Object.values(log.sourceReviewerSeals).some(value => !HASH_PATTERN.test(value))
    || log.sourceReviewerSeals.reviewerA !== sourceMatrix?.sourceReviews?.reviewerA?.sealHash
    || log.sourceReviewerSeals.reviewerB !== sourceMatrix?.sourceReviews?.reviewerB?.sealHash) {
    errors.push({ code: 'INVALID_SOURCE_REVIEWER_SEALS' });
  }
  if (!Array.isArray(log.authorizedSourceItemIds)
    || new Set(log.authorizedSourceItemIds).size !== log.authorizedSourceItemIds.length) {
    errors.push({ code: 'INVALID_AUTHORIZED_SOURCE_ITEMS' });
  }
  if (!Array.isArray(log.events)) errors.push({ code: 'MISSING_STRUCTURAL_ADJUDICATION_EVENTS' });
  const eventIds = new Set();
  const sourceItemIds = new Set();
  let previousEventHash = null;
  for (let index = 0; index < (log.events ?? []).length; index += 1) {
    const event = log.events[index];
    if (!hasExactKeys(event, EVENT_KEYS) && !hasExactKeys(event, FUTURE_RULE_EVENT_KEYS)) {
      errors.push({ code: 'INVALID_STRUCTURAL_ADJUDICATION_EVENT_SCHEMA', sequence: index + 1 });
      continue;
    }
    const comparisonItem = sourceMatrix?.items?.find(item => item.canonicalReviewItemId === event.sourceItemId);
    const requiresFutureRule = comparisonItem?.packetKind === 'AMBIGUITY_CAPACITY_FAMILIES'
      || comparisonItem?.packetKind === 'SCENARIO_FAMILY_PREFLIGHT';
    if ((requiresFutureRule && !hasExactKeys(event, FUTURE_RULE_EVENT_KEYS))
      || (!requiresFutureRule && !hasExactKeys(event, EVENT_KEYS))) {
      errors.push({ code: 'STRUCTURAL_ADJUDICATION_EVENT_SCHEMA_KIND_MISMATCH', sequence: event.sequence });
    }
    if (event.sequence !== index + 1) errors.push({ code: 'INVALID_EVENT_SEQUENCE', sequence: event.sequence });
    if (event.batchId !== log.batchId) errors.push({ code: 'EVENT_BATCH_MISMATCH', sequence: event.sequence });
    if (eventIds.has(event.eventId)) errors.push({ code: 'DUPLICATE_EVENT_ID', eventId: event.eventId });
    if (sourceItemIds.has(event.sourceItemId)) errors.push({ code: 'DUPLICATE_SOURCE_ITEM_ID', sourceItemId: event.sourceItemId });
    if (!log.authorizedSourceItemIds.includes(event.sourceItemId)) errors.push({ code: 'UNAUTHORIZED_SOURCE_ITEM_ID', sourceItemId: event.sourceItemId });
    if (!comparisonItem || event.sourceComparisonItemFingerprint !== fingerprint(comparisonItem)) {
      errors.push({ code: 'SOURCE_COMPARISON_ITEM_MISMATCH', sourceItemId: event.sourceItemId });
    }
    if (event.provenance !== HUMAN_ADJUDICATION_PROVENANCE) errors.push({ code: 'INVALID_HUMAN_PROVENANCE', sequence: event.sequence });
    if (!isCanonicalTimestamp(event.recordedAt)) errors.push({ code: 'INVALID_RECORDED_AT', sequence: event.sequence });
    if (typeof event.humanRationale !== 'string' || event.humanRationale.trim() === '') errors.push({ code: 'MISSING_HUMAN_RATIONALE', sequence: event.sequence });
    if (requiresFutureRule && (typeof event.futureRule !== 'string' || event.futureRule.trim() === '')) {
      errors.push({ code: 'MISSING_FUTURE_RULE', sequence: event.sequence });
    }
    if (event.previousEventHash !== previousEventHash) errors.push({ code: 'PREVIOUS_EVENT_HASH_MISMATCH', sequence: event.sequence });
    if (!HASH_PATTERN.test(event.eventHash ?? '') || fingerprint(withoutField(event, 'eventHash')) !== event.eventHash) {
      errors.push({ code: 'INVALID_EVENT_HASH', sequence: event.sequence });
    }
    if (comparisonItem) {
      try {
        assertDecision(event.decision, comparisonItem);
      } catch (error) {
        errors.push({ code: 'INVALID_STRUCTURED_DECISION', sequence: event.sequence, message: error.message });
      }
    }
    eventIds.add(event.eventId);
    sourceItemIds.add(event.sourceItemId);
    previousEventHash = event.eventHash;
  }
  if (!HASH_PATTERN.test(log.logFingerprint ?? '')
    || fingerprint(withoutField(log, 'logFingerprint')) !== log.logFingerprint) {
    errors.push({ code: 'INVALID_LOG_FINGERPRINT' });
  }
  return {
    ok: errors.length === 0,
    errors,
    eventCount: log.events?.length ?? 0,
    finalEventHash: log.events?.at(-1)?.eventHash ?? null
  };
}

function completeBatch(log) {
  return canonicalJson([...log.events.map(event => event.sourceItemId)].sort())
    === canonicalJson([...log.authorizedSourceItemIds].sort());
}

export function evaluateStructuralAdjudicationCompleteness(log, sourceMatrix) {
  const validation = validateStructuralAdjudicationLog(log, sourceMatrix);
  const recordedSourceItemIds = new Set((log.events ?? []).map(event => event.sourceItemId));
  const missingSourceItemIds = (log.authorizedSourceItemIds ?? [])
    .filter(sourceItemId => !recordedSourceItemIds.has(sourceItemId));
  return {
    complete: validation.ok && missingSourceItemIds.length === 0
      && recordedSourceItemIds.size === (log.authorizedSourceItemIds ?? []).length,
    validation,
    missingSourceItemIds
  };
}

export function createStructuralAdjudicationSeal({
  log,
  sourceMatrix,
  journalPath,
  sealedAt
}) {
  const validation = validateStructuralAdjudicationLog(log, sourceMatrix);
  if (!validation.ok || !completeBatch(log)) {
    throw new Error(`Cannot seal incomplete or invalid structural adjudication log: ${canonicalJson(validation)}`);
  }
  requiredString(journalPath, 'journalPath');
  if (!isCanonicalTimestamp(sealedAt)) throw new Error('sealedAt must be a canonical ISO-8601 timestamp');
  const bindsHumanProvenance = log.events.some(event => Object.hasOwn(event, 'futureRule'));
  const sealWithoutHash = {
    schemaVersion: bindsHumanProvenance ? 2 : 1,
    sealType: STRUCTURAL_ADJUDICATION_BATCH_SEAL,
    batchId: log.batchId,
    sourceMatrixFingerprint: log.sourceMatrixFingerprint,
    sourceReviewerSeals: structuredClone(log.sourceReviewerSeals),
    journalPath: basename(journalPath),
    journalFingerprint: log.logFingerprint,
    journalCanonicalSha256: fingerprint(log),
    eventCount: validation.eventCount,
    finalEventHash: validation.finalEventHash,
    ...(bindsHumanProvenance ? { provenance: HUMAN_ADJUDICATION_PROVENANCE } : {}),
    sealedAt
  };
  return deepFreeze({ ...sealWithoutHash, sealHash: fingerprint(sealWithoutHash) });
}

export function validateStructuralAdjudicationSeal(seal, {
  log = null,
  sourceMatrix = null,
  journalPath = null
} = {}) {
  const errors = [];
  const legacySchema = hasExactKeys(seal, SEAL_KEYS);
  const humanProvenanceSchema = hasExactKeys(seal, HUMAN_PROVENANCE_SEAL_KEYS);
  if (!legacySchema && !humanProvenanceSchema) {
    return { ok: false, errors: [{ code: 'INVALID_STRUCTURAL_ADJUDICATION_SEAL_SCHEMA' }] };
  }
  if ((legacySchema && seal.schemaVersion !== 1)
    || (humanProvenanceSchema && (seal.schemaVersion !== 2 || seal.provenance !== HUMAN_ADJUDICATION_PROVENANCE))
    || seal.sealType !== STRUCTURAL_ADJUDICATION_BATCH_SEAL
    || typeof seal.batchId !== 'string' || seal.batchId.trim() === ''
    || !HASH_PATTERN.test(seal.sourceMatrixFingerprint ?? '')
    || !hasExactKeys(seal.sourceReviewerSeals, ['reviewerA', 'reviewerB'])
    || Object.values(seal.sourceReviewerSeals).some(value => !HASH_PATTERN.test(value))
    || typeof seal.journalPath !== 'string' || seal.journalPath.trim() === ''
    || !HASH_PATTERN.test(seal.journalFingerprint ?? '')
    || !HASH_PATTERN.test(seal.journalCanonicalSha256 ?? '')
    || !Number.isInteger(seal.eventCount) || seal.eventCount < 1
    || !HASH_PATTERN.test(seal.finalEventHash ?? '')
    || !isCanonicalTimestamp(seal.sealedAt)) {
    errors.push({ code: 'INVALID_STRUCTURAL_ADJUDICATION_SEAL_HEADER' });
  }
  if (!HASH_PATTERN.test(seal.sealHash ?? '')
    || fingerprint(withoutField(seal, 'sealHash')) !== seal.sealHash) {
    errors.push({ code: 'INVALID_STRUCTURAL_ADJUDICATION_SEAL_HASH' });
  }

  if (log !== null || sourceMatrix !== null || journalPath !== null) {
    if (!log || !sourceMatrix || !journalPath) {
      errors.push({ code: 'INCOMPLETE_STRUCTURAL_ADJUDICATION_SEAL_CONTEXT' });
    } else {
      const validation = validateStructuralAdjudicationLog(log, sourceMatrix);
      if (!validation.ok || !completeBatch(log)) errors.push({ code: 'SEALED_ADJUDICATION_LOG_INVALID_OR_INCOMPLETE' });
      const logRequiresHumanProvenanceSeal = (log.events ?? []).some(event => Object.hasOwn(event, 'futureRule'));
      if (logRequiresHumanProvenanceSeal !== humanProvenanceSchema) {
        errors.push({ code: 'STRUCTURAL_ADJUDICATION_SEAL_PROVENANCE_SCHEMA_MISMATCH' });
      }
      if (seal.batchId !== log.batchId
        || seal.sourceMatrixFingerprint !== log.sourceMatrixFingerprint
        || !canonicalEqual(seal.sourceReviewerSeals, log.sourceReviewerSeals)
        || seal.journalPath !== basename(journalPath)
        || seal.journalFingerprint !== log.logFingerprint
        || seal.journalCanonicalSha256 !== fingerprint(log)
        || seal.eventCount !== validation.eventCount
        || seal.finalEventHash !== validation.finalEventHash) {
        errors.push({ code: 'STRUCTURAL_ADJUDICATION_SEAL_CONTENT_MISMATCH' });
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

export function isStructuralAdjudicationLogSealed(seal, log) {
  if (!seal) return false;
  const validation = validateStructuralAdjudicationSeal(seal);
  if (!validation.ok) throw new Error(`Invalid structural adjudication seal: ${canonicalJson(validation.errors)}`);
  return seal.batchId === log.batchId
    && seal.sourceMatrixFingerprint === log.sourceMatrixFingerprint
    && seal.journalFingerprint === log.logFingerprint;
}

function readJsonArtifact(path, subject) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read valid ${subject}: ${path}`, { cause: error });
  }
}

function serialiseArtifact(value) {
  return `${JSON.stringify(JSON.parse(canonicalJson(value)), null, 2)}\n`;
}

export function structuralAdjudicationSealPathForJournal(journalPath) {
  requiredString(journalPath, 'journalPath');
  const resolved = resolve(journalPath);
  const suffix = '.human-adjudication-log.json';
  if (resolved.endsWith(suffix)) {
    return `${resolved.slice(0, -suffix.length)}.human-adjudication-seal.json`;
  }
  return `${resolved}.seal.json`;
}

// Public persistent append: seal discovery is path-derived and cannot be omitted by callers.
export function appendStructuralAdjudicationEvent({ journalPath, sourceMatrixPath, input }) {
  requiredString(journalPath, 'journalPath');
  requiredString(sourceMatrixPath, 'sourceMatrixPath');
  const resolvedJournalPath = resolve(journalPath);
  const sourceMatrix = readJsonArtifact(resolve(sourceMatrixPath), 'structural comparison matrix');
  const log = readJsonArtifact(resolvedJournalPath, 'structural adjudication log');
  const sealPath = structuralAdjudicationSealPathForJournal(resolvedJournalPath);
  if (existsSync(sealPath)) {
    const seal = readJsonArtifact(sealPath, 'structural adjudication seal');
    const sealValidation = validateStructuralAdjudicationSeal(seal, {
      log,
      sourceMatrix,
      journalPath: resolvedJournalPath
    });
    if (!sealValidation.ok) {
      throw new Error(`Structural adjudication seal is invalid; append fails closed: ${canonicalJson(sealValidation.errors)}`);
    }
    if (isStructuralAdjudicationLogSealed(seal, log)) {
      throw new Error('Cannot append to a structural adjudication log covered by a valid seal');
    }
  }
  const nextLog = constructStructuralAdjudicationLogWithEvent(log, input, sourceMatrix);
  writeFileSync(resolvedJournalPath, serialiseArtifact(nextLog), 'utf8');
  return nextLog;
}

export function persistStructuralAdjudicationSeal({
  journalPath,
  sourceMatrixPath,
  sealedAt
}) {
  requiredString(journalPath, 'journalPath');
  requiredString(sourceMatrixPath, 'sourceMatrixPath');
  const resolvedJournalPath = resolve(journalPath);
  const sealPath = structuralAdjudicationSealPathForJournal(resolvedJournalPath);
  if (existsSync(sealPath)) throw new Error(`Structural adjudication seal already exists: ${sealPath}`);
  const sourceMatrix = readJsonArtifact(resolve(sourceMatrixPath), 'structural comparison matrix');
  const log = readJsonArtifact(resolvedJournalPath, 'structural adjudication log');
  const seal = createStructuralAdjudicationSeal({
    log,
    sourceMatrix,
    journalPath: resolvedJournalPath,
    sealedAt
  });
  writeFileSync(sealPath, serialiseArtifact(seal), { encoding: 'utf8', flag: 'wx' });
  return { seal, sealPath };
}
