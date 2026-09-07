import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

import { canonicalJson, fingerprint } from './review-packets.js';

export const STRUCTURAL_REVIEWER_SEAL = 'STRUCTURAL_REVIEWER_SEAL';
export const STRUCTURAL_REVIEWER_SEAL_FILENAME = 'structural-reviewer-seal.json';

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const SUPPORTED_PACKET_KINDS = new Set([
  'EQUIVALENCE_AND_PREFERRED',
  'KNOWLEDGE_BOUNDARIES',
  'AMBIGUITY_CAPACITY_FAMILIES',
  'SCENARIO_FAMILY_PREFLIGHT'
]);

const EXPECTED_DECISION_CONTRACTS = Object.freeze({
  EQUIVALENCE_AND_PREFERRED: Object.freeze({
    substantiveEquivalencePartition: Object.freeze({
      allowedValues: Object.freeze([
        'oneEquivalentGroup',
        'multipleNonEquivalentGroups',
        'insufficientEvidence'
      ]),
      phase: 1
    }),
    preferredEntrySelection: Object.freeze({
      allowedValues: Object.freeze(['chooseOneDisplayedKnowledgeRef', 'insufficientEvidence']),
      phase: 2,
      prerequisiteDecisionType: 'substantiveEquivalencePartition',
      condition: 'required only for each reviewer-confirmed multi-entry equivalent group'
    })
  }),
  KNOWLEDGE_BOUNDARIES: Object.freeze({
    knowledgeComponentBoundary: Object.freeze({
      allowedValues: Object.freeze([
        'sameConnectedComponent',
        'separateComponents',
        'partitionRequired',
        'insufficientEvidence'
      ])
    }),
    futureCoverageBoundaryRules: Object.freeze({
      allowedValues: Object.freeze(['rulesDocumented', 'insufficientEvidence'])
    })
  }),
  AMBIGUITY_CAPACITY_FAMILIES: Object.freeze({
    ambiguityFamilyDisposition: Object.freeze({
      allowedValues: Object.freeze([
        'structuralAmbiguity',
        'notCovered',
        'artificialOrMalformed',
        'blockedTemporalInstability',
        'insufficientEvidence'
      ])
    }),
    ambiguityMechanism: Object.freeze({
      allowedValues: Object.freeze([
        'underspecifiedReference',
        'competingPublishedKnowledge',
        'alternativeIntentReadings'
      ]),
      condition: 'required only when disposition is structuralAmbiguity'
    }),
    substantiallyDifferentCoveredGroups: Object.freeze({
      allowedValues: Object.freeze([
        'reviewerDefinedPartitionOfDisplayedKnowledge',
        'insufficientEvidence'
      ]),
      condition: 'required only when disposition is structuralAmbiguity'
    })
  }),
  SCENARIO_FAMILY_PREFLIGHT: Object.freeze({
    reviewerScenarioFamilyPartition: Object.freeze({
      allowedValues: Object.freeze(['reviewerDefinedFamilyGroups', 'insufficientEvidence'])
    }),
    fragmentationAssessment: Object.freeze({
      allowedValues: Object.freeze([
        'distinct',
        'mergeWithAnotherDisplayedBrief',
        'tooBroad',
        'artificiallyFragmented',
        'insufficientEvidence'
      ])
    })
  })
});

const LOG_KEYS = Object.freeze([
  'appendOnly',
  'events',
  'languageStratum',
  'packetFingerprint',
  'packetId',
  'reviewerSlot',
  'schemaVersion',
  'status'
]);
const EVENT_KEYS = Object.freeze([
  'decisionType',
  'decisionValue',
  'eventHash',
  'eventId',
  'languageCompetenceAttested',
  'previousEventHash',
  'rationale',
  'recordedAt',
  'reviewerIdentity',
  'reviewItemRef',
  'sequence'
]);
const APPEND_INPUT_KEYS = Object.freeze([
  'decisionType',
  'decisionValue',
  'languageCompetenceAttested',
  'rationale',
  'reviewerIdentity',
  'reviewItemRef'
]);
const SEAL_KEYS = Object.freeze([
  'packetSeals',
  'reviewerIdentity',
  'reviewerSlot',
  'schemaVersion',
  'sealHash',
  'sealType',
  'sealedAt'
]);
const PACKET_SEAL_KEYS = Object.freeze([
  'eventCount',
  'finalEventHash',
  'journalCanonicalSha256',
  'journalPath',
  'packetFingerprint',
  'packetId'
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function withoutField(value, field) {
  const { [field]: _ignored, ...rest } = value;
  return rest;
}

function hasExactKeys(value, keys) {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function isCanonicalTimestamp(value) {
  if (!nonEmptyString(value)) return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function sameStringArray(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function packetContractErrors(packet) {
  const errors = [];
  if (!packet || typeof packet !== 'object' || Array.isArray(packet)) {
    return [{ code: 'MISSING_STRUCTURAL_PACKET' }];
  }
  if (!SUPPORTED_PACKET_KINDS.has(packet.packetKind)) {
    return [{ code: 'UNSUPPORTED_STRUCTURAL_PACKET_KIND', packetKind: packet.packetKind }];
  }
  if (!nonEmptyString(packet.packetId) || !HASH_PATTERN.test(packet.packetFingerprint ?? '')) {
    errors.push({ code: 'INVALID_STRUCTURAL_PACKET_IDENTITY' });
  } else if (fingerprint(withoutField(packet, 'packetFingerprint')) !== packet.packetFingerprint) {
    errors.push({ code: 'STRUCTURAL_PACKET_FINGERPRINT_MISMATCH' });
  }
  if (!['A', 'B'].includes(packet.reviewerSlot) || !nonEmptyString(packet.languageStratum)) {
    errors.push({ code: 'INVALID_STRUCTURAL_PACKET_REVIEWER' });
  }
  if (!Array.isArray(packet.reviewItems) || packet.reviewItems.length === 0) {
    errors.push({ code: 'MISSING_STRUCTURAL_REVIEW_ITEMS' });
  }
  if (!Array.isArray(packet.decisionsRequired)) {
    errors.push({ code: 'MISSING_STRUCTURAL_DECISIONS_REQUIRED' });
    return errors;
  }

  const expected = EXPECTED_DECISION_CONTRACTS[packet.packetKind];
  const actualTypes = packet.decisionsRequired.map(decision => decision.decisionType);
  if (!sameStringArray([...actualTypes].sort(), Object.keys(expected).sort())) {
    errors.push({ code: 'UNKNOWN_OR_MISSING_STRUCTURAL_DECISION_CONTRACT' });
    return errors;
  }
  for (const decision of packet.decisionsRequired) {
    const contract = expected[decision.decisionType];
    if (!sameStringArray(decision.allowedValues, contract.allowedValues)) {
      errors.push({ code: 'STRUCTURAL_DECISION_ENUM_MISMATCH', decisionType: decision.decisionType });
    }
    for (const field of ['condition', 'phase', 'prerequisiteDecisionType']) {
      if ((decision[field] ?? null) !== (contract[field] ?? null)) {
        errors.push({ code: 'UNSUPPORTED_STRUCTURAL_DECISION_CONDITION', decisionType: decision.decisionType, field });
      }
    }
  }
  return errors;
}

export function validateStructuralReviewPacketContract(packet) {
  const errors = packetContractErrors(packet);
  return { ok: errors.length === 0, errors };
}

function decisionContract(packet, decisionType) {
  return packet.decisionsRequired.find(decision => decision.decisionType === decisionType);
}

function validateEventShape(event, packet, index, previousEventHash, seenEventIds) {
  const errors = [];
  const sequence = index + 1;
  if (!hasExactKeys(event, EVENT_KEYS)) {
    errors.push({ code: 'INVALID_STRUCTURAL_EVENT_SCHEMA', sequence: event?.sequence ?? sequence });
    return errors;
  }
  if (!Number.isInteger(event.sequence) || event.sequence !== sequence) {
    errors.push({ code: 'INVALID_STRUCTURAL_EVENT_SEQUENCE', sequence: event.sequence, expected: sequence });
  }
  if (!nonEmptyString(event.eventId) || seenEventIds.has(event.eventId)) {
    errors.push({ code: seenEventIds.has(event.eventId) ? 'DUPLICATE_STRUCTURAL_EVENT_ID' : 'MISSING_STRUCTURAL_EVENT_ID', eventId: event.eventId });
  }
  seenEventIds.add(event.eventId);
  if (!packet.reviewItems.some(item => item.reviewItemRef === event.reviewItemRef)) {
    errors.push({ code: 'UNKNOWN_STRUCTURAL_REVIEW_ITEM', reviewItemRef: event.reviewItemRef });
  }
  const contract = decisionContract(packet, event.decisionType);
  if (!contract) {
    errors.push({ code: 'UNKNOWN_STRUCTURAL_DECISION_TYPE', decisionType: event.decisionType });
  } else if (!contract.allowedValues.includes(event.decisionValue)) {
    errors.push({ code: 'INVALID_STRUCTURAL_DECISION_VALUE', decisionType: event.decisionType, decisionValue: event.decisionValue });
  }
  if (!nonEmptyString(event.rationale)) errors.push({ code: 'EMPTY_STRUCTURAL_RATIONALE', sequence });
  if (!nonEmptyString(event.reviewerIdentity)) errors.push({ code: 'EMPTY_STRUCTURAL_REVIEWER_IDENTITY', sequence });
  if (typeof event.languageCompetenceAttested !== 'boolean') {
    errors.push({ code: 'INVALID_STRUCTURAL_LANGUAGE_ATTESTATION', sequence });
  }
  if (!isCanonicalTimestamp(event.recordedAt)) errors.push({ code: 'INVALID_STRUCTURAL_RECORDED_AT', sequence });
  if (event.previousEventHash !== previousEventHash) {
    errors.push({ code: 'INVALID_STRUCTURAL_PREVIOUS_EVENT_HASH', sequence });
  }
  if (!HASH_PATTERN.test(event.eventHash ?? '')
    || fingerprint(withoutField(event, 'eventHash')) !== event.eventHash) {
    errors.push({ code: 'INVALID_STRUCTURAL_EVENT_HASH', sequence });
  }
  return errors;
}

function effectiveDecisionObject(events) {
  const effective = {};
  for (const event of events) {
    effective[event.reviewItemRef] ??= {};
    effective[event.reviewItemRef][event.decisionType] = structuredClone(event);
  }
  return effective;
}

export function getEffectiveStructuralDecisions(log) {
  if (!log || !Array.isArray(log.events)) return {};
  return effectiveDecisionObject(log.events);
}

export function createEmptyStructuralReviewResponseLog(packet) {
  const packetValidation = validateStructuralReviewPacketContract(packet);
  if (!packetValidation.ok) {
    throw new Error(`Cannot create structural response log: ${canonicalJson(packetValidation.errors)}`);
  }
  return deepFreeze({
    schemaVersion: 1,
    packetId: packet.packetId,
    packetFingerprint: packet.packetFingerprint,
    reviewerSlot: packet.reviewerSlot,
    languageStratum: packet.languageStratum,
    status: 'NOT_STARTED',
    appendOnly: true,
    events: []
  });
}

export function validateStructuralReviewResponseLog(log, packet) {
  const errors = [...packetContractErrors(packet)];
  let chainValid = true;
  let bindingValid = true;
  if (!hasExactKeys(log, LOG_KEYS)) {
    errors.push({ code: 'INVALID_STRUCTURAL_RESPONSE_LOG_SCHEMA' });
  }
  if (!log || typeof log !== 'object') {
    return {
      ok: false,
      chainValid: false,
      bindingValid: false,
      errors,
      eventCount: 0,
      finalEventHash: null,
      effectiveDecisions: {}
    };
  }
  if (log.schemaVersion !== 1 || log.appendOnly !== true || !['NOT_STARTED', 'IN_PROGRESS'].includes(log.status)) {
    errors.push({ code: 'INVALID_STRUCTURAL_RESPONSE_LOG_HEADER' });
  }
  if (log.packetId !== packet?.packetId || log.packetFingerprint !== packet?.packetFingerprint
    || log.reviewerSlot !== packet?.reviewerSlot || log.languageStratum !== packet?.languageStratum) {
    errors.push({ code: 'STRUCTURAL_RESPONSE_PACKET_MISMATCH' });
    bindingValid = false;
  }
  if (!Array.isArray(log.events)) {
    errors.push({ code: 'MISSING_STRUCTURAL_RESPONSE_EVENTS' });
    return {
      ok: false,
      chainValid: false,
      bindingValid,
      errors,
      eventCount: 0,
      finalEventHash: null,
      effectiveDecisions: {}
    };
  }
  if ((log.events.length === 0 && log.status !== 'NOT_STARTED')
    || (log.events.length > 0 && log.status !== 'IN_PROGRESS')) {
    errors.push({ code: 'STRUCTURAL_RESPONSE_STATUS_MISMATCH' });
  }

  const seenEventIds = new Set();
  let previousEventHash = null;
  const eventErrors = [];
  for (let index = 0; index < log.events.length; index += 1) {
    const event = log.events[index];
    eventErrors.push(...validateEventShape(event, packet, index, previousEventHash, seenEventIds));
    if (event?.eventHash) previousEventHash = event.eventHash;
  }
  const reviewerIdentities = new Set(log.events
    .map(event => event?.reviewerIdentity)
    .filter(nonEmptyString));
  if (reviewerIdentities.size > 1) {
    eventErrors.push({ code: 'MIXED_STRUCTURAL_REVIEWER_IDENTITIES' });
  }
  if (eventErrors.length > 0) chainValid = false;
  errors.push(...eventErrors);

  if (packet?.packetKind === 'EQUIVALENCE_AND_PREFERRED') {
    const currentPartitions = new Map();
    for (const event of log.events) {
      if (event.decisionType === 'substantiveEquivalencePartition') {
        currentPartitions.set(event.reviewItemRef, event.decisionValue);
      }
      if (event.decisionType === 'preferredEntrySelection'
        && !['oneEquivalentGroup', 'multipleNonEquivalentGroups'].includes(currentPartitions.get(event.reviewItemRef))) {
        errors.push({ code: 'STRUCTURAL_DECISION_PREREQUISITE_MISSING', sequence: event.sequence });
      }
    }
  }

  return {
    ok: errors.length === 0,
    chainValid,
    bindingValid,
    errors,
    eventCount: log.events.length,
    finalEventHash: log.events.at(-1)?.eventHash ?? null,
    effectiveDecisions: effectiveDecisionObject(log.events)
  };
}

function requiredDecisionsForItem(packet, effectiveForItem) {
  if (packet.packetKind === 'EQUIVALENCE_AND_PREFERRED') {
    const required = ['substantiveEquivalencePartition'];
    const partition = effectiveForItem?.substantiveEquivalencePartition?.decisionValue;
    if (partition === 'oneEquivalentGroup' || partition === 'multipleNonEquivalentGroups') {
      required.push('preferredEntrySelection');
    }
    return required;
  }
  if (packet.packetKind === 'KNOWLEDGE_BOUNDARIES') {
    return ['knowledgeComponentBoundary', 'futureCoverageBoundaryRules'];
  }
  if (packet.packetKind === 'AMBIGUITY_CAPACITY_FAMILIES') {
    const required = ['ambiguityFamilyDisposition'];
    if (effectiveForItem?.ambiguityFamilyDisposition?.decisionValue === 'structuralAmbiguity') {
      required.push('ambiguityMechanism', 'substantiallyDifferentCoveredGroups');
    }
    return required;
  }
  if (packet.packetKind === 'SCENARIO_FAMILY_PREFLIGHT') {
    return ['reviewerScenarioFamilyPartition', 'fragmentationAssessment'];
  }
  throw new Error(`Unsupported structural packet kind: ${packet.packetKind}`);
}

export function evaluateStructuralReviewCompleteness(log, packet) {
  const validation = validateStructuralReviewResponseLog(log, packet);
  const missingDecisions = [];
  const conditionalMissingDecisions = [];
  if (validation.bindingValid && validateStructuralReviewPacketContract(packet).ok) {
    for (const item of packet.reviewItems) {
      const effectiveForItem = validation.effectiveDecisions[item.reviewItemRef] ?? {};
      const required = requiredDecisionsForItem(packet, effectiveForItem);
      for (const decisionType of required) {
        if (!effectiveForItem[decisionType]) {
          const contract = decisionContract(packet, decisionType);
          const target = contract?.condition ? conditionalMissingDecisions : missingDecisions;
          target.push({ reviewItemRef: item.reviewItemRef, decisionType });
        }
      }
    }
  }
  return {
    valid: validation.ok,
    chainValid: validation.chainValid,
    bindingValid: validation.bindingValid,
    complete: validation.ok && missingDecisions.length === 0 && conditionalMissingDecisions.length === 0,
    errors: validation.errors,
    missingDecisions,
    conditionalMissingDecisions,
    effectiveDecisions: validation.effectiveDecisions,
    eventCount: validation.eventCount,
    finalEventHash: validation.finalEventHash
  };
}

function validateAppendInput(input, packet) {
  if (!hasExactKeys(input, APPEND_INPUT_KEYS)) throw new Error('Structural append input fields differ from contract');
  if (!packet.reviewItems.some(item => item.reviewItemRef === input.reviewItemRef)) {
    throw new Error(`Unknown structural reviewItemRef: ${input.reviewItemRef}`);
  }
  const contract = decisionContract(packet, input.decisionType);
  if (!contract) throw new Error(`Unknown structural decisionType: ${input.decisionType}`);
  if (!contract.allowedValues.includes(input.decisionValue)) {
    throw new Error(`Invalid structural decisionValue for ${input.decisionType}: ${input.decisionValue}`);
  }
  if (!nonEmptyString(input.rationale)) throw new Error('Structural rationale must be non-empty');
  if (!nonEmptyString(input.reviewerIdentity)) throw new Error('reviewerIdentity must be a non-empty opaque string');
  if (typeof input.languageCompetenceAttested !== 'boolean') {
    throw new Error('languageCompetenceAttested must be a boolean');
  }
}

function validateSealShape(seal) {
  const errors = [];
  if (!hasExactKeys(seal, SEAL_KEYS)) return [{ code: 'INVALID_STRUCTURAL_SEAL_SCHEMA' }];
  if (seal.schemaVersion !== 1 || seal.sealType !== STRUCTURAL_REVIEWER_SEAL) {
    errors.push({ code: 'INVALID_STRUCTURAL_SEAL_HEADER' });
  }
  if (!['A', 'B'].includes(seal.reviewerSlot) || !nonEmptyString(seal.reviewerIdentity)
    || !isCanonicalTimestamp(seal.sealedAt)) {
    errors.push({ code: 'INVALID_STRUCTURAL_SEAL_REVIEWER' });
  }
  if (!Array.isArray(seal.packetSeals) || seal.packetSeals.length === 0) {
    errors.push({ code: 'MISSING_STRUCTURAL_PACKET_SEALS' });
  } else {
    const packetIds = new Set();
    const journalPaths = new Set();
    for (const entry of seal.packetSeals) {
      if (!hasExactKeys(entry, PACKET_SEAL_KEYS)) {
        errors.push({ code: 'INVALID_STRUCTURAL_PACKET_SEAL_SCHEMA' });
        continue;
      }
      if (!nonEmptyString(entry.packetId) || !HASH_PATTERN.test(entry.packetFingerprint ?? '')
        || !nonEmptyString(entry.journalPath) || !Number.isInteger(entry.eventCount) || entry.eventCount < 1
        || !HASH_PATTERN.test(entry.finalEventHash ?? '') || !HASH_PATTERN.test(entry.journalCanonicalSha256 ?? '')) {
        errors.push({ code: 'INVALID_STRUCTURAL_PACKET_SEAL' });
      }
      if (packetIds.has(entry.packetId) || journalPaths.has(entry.journalPath)) {
        errors.push({ code: 'DUPLICATE_STRUCTURAL_PACKET_SEAL' });
      }
      packetIds.add(entry.packetId);
      journalPaths.add(entry.journalPath);
    }
  }
  if (!HASH_PATTERN.test(seal.sealHash ?? '')
    || fingerprint(withoutField(seal, 'sealHash')) !== seal.sealHash) {
    errors.push({ code: 'INVALID_STRUCTURAL_SEAL_HASH' });
  }
  return errors;
}

export function validateStructuralReviewerSeal(seal, journals = null) {
  const errors = validateSealShape(seal);
  if (journals !== null) {
    if (!Array.isArray(journals) || journals.length !== seal?.packetSeals?.length) {
      errors.push({ code: 'STRUCTURAL_SEAL_JOURNAL_SET_MISMATCH' });
    } else {
      const byPacketId = new Map(journals.map(item => [item.packet?.packetId, item]));
      for (const packetSeal of seal.packetSeals) {
        const descriptor = byPacketId.get(packetSeal.packetId);
        if (!descriptor) {
          errors.push({ code: 'STRUCTURAL_SEAL_JOURNAL_MISSING', packetId: packetSeal.packetId });
          continue;
        }
        const completeness = evaluateStructuralReviewCompleteness(descriptor.log, descriptor.packet);
        if (!completeness.complete) errors.push({ code: 'STRUCTURAL_SEAL_JOURNAL_INCOMPLETE', packetId: packetSeal.packetId });
        if (descriptor.packet.reviewerSlot !== seal.reviewerSlot
          || descriptor.log.events.some(event => event.reviewerIdentity !== seal.reviewerIdentity
            || event.languageCompetenceAttested !== true)) {
          errors.push({ code: 'STRUCTURAL_SEAL_REVIEWER_MISMATCH', packetId: packetSeal.packetId });
        }
        if (packetSeal.packetFingerprint !== descriptor.packet.packetFingerprint
          || packetSeal.journalPath !== descriptor.journalPath
          || packetSeal.eventCount !== completeness.eventCount
          || packetSeal.finalEventHash !== completeness.finalEventHash
          || packetSeal.journalCanonicalSha256 !== fingerprint(descriptor.log)) {
          errors.push({ code: 'STRUCTURAL_SEAL_CONTENT_MISMATCH', packetId: packetSeal.packetId });
        }
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

export function isStructuralReviewJournalSealed(seal, packet) {
  if (!seal) return false;
  if (!validateStructuralReviewerSeal(seal).ok) throw new Error('Invalid structural reviewer seal');
  return seal.packetSeals.some(entry => entry.packetId === packet.packetId
    && entry.packetFingerprint === packet.packetFingerprint);
}

export function constructStructuralReviewLogWithEvent(log, packet, input, {
  clock = () => new Date(),
  eventIdFactory = () => randomUUID()
} = {}) {
  const validation = validateStructuralReviewResponseLog(log, packet);
  if (!validation.ok) throw new Error(`Cannot append to invalid structural log: ${canonicalJson(validation.errors)}`);
  validateAppendInput(input, packet);
  if (log.events.some(event => event.reviewerIdentity !== input.reviewerIdentity)) {
    throw new Error('A structural response log cannot mix reviewer identities');
  }

  if (packet.packetKind === 'EQUIVALENCE_AND_PREFERRED' && input.decisionType === 'preferredEntrySelection') {
    const effective = getEffectiveStructuralDecisions(log)[input.reviewItemRef] ?? {};
    if (!['oneEquivalentGroup', 'multipleNonEquivalentGroups'].includes(
      effective.substantiveEquivalencePartition?.decisionValue
    )) {
      throw new Error('preferredEntrySelection requires a prior reviewer-confirmed equivalence partition');
    }
  }

  const sequence = log.events.length + 1;
  const generatedEventId = eventIdFactory({ sequence, packet, input: structuredClone(input) });
  if (!nonEmptyString(generatedEventId) || log.events.some(event => event.eventId === generatedEventId)) {
    throw new Error('eventIdFactory must generate a unique non-empty eventId');
  }
  const instant = clock({ sequence, packet, input: structuredClone(input) });
  const recordedAt = instant instanceof Date ? instant.toISOString() : instant;
  if (!isCanonicalTimestamp(recordedAt)) throw new Error('clock must return a Date or canonical ISO timestamp');

  const eventWithoutHash = {
    eventId: generatedEventId,
    sequence,
    reviewItemRef: input.reviewItemRef,
    decisionType: input.decisionType,
    decisionValue: input.decisionValue,
    rationale: input.rationale,
    reviewerIdentity: input.reviewerIdentity,
    languageCompetenceAttested: input.languageCompetenceAttested,
    recordedAt,
    previousEventHash: log.events.at(-1)?.eventHash ?? null
  };
  const event = deepFreeze({
    ...eventWithoutHash,
    eventHash: fingerprint(eventWithoutHash)
  });
  return deepFreeze({
    ...log,
    status: 'IN_PROGRESS',
    events: [...log.events, event]
  });
}

export function createStructuralReviewerSeal({
  reviewerSlot,
  reviewerIdentity,
  sealedAt,
  journals
}) {
  if (!['A', 'B'].includes(reviewerSlot)) throw new Error('reviewerSlot must be A or B');
  if (!nonEmptyString(reviewerIdentity)) throw new Error('reviewerIdentity must be a non-empty opaque string');
  if (!isCanonicalTimestamp(sealedAt)) throw new Error('sealedAt must be a canonical ISO timestamp');
  if (!Array.isArray(journals) || journals.length === 0) throw new Error('At least one structural journal is required');

  const packetSeals = journals.map(({ packet, log, journalPath }) => {
    if (!nonEmptyString(journalPath)) throw new Error('journalPath is required for every sealed journal');
    const completeness = evaluateStructuralReviewCompleteness(log, packet);
    if (!completeness.complete) {
      throw new Error(`Cannot seal incomplete or invalid structural journal ${packet?.packetId}: ${canonicalJson(completeness)}`);
    }
    if (packet.reviewerSlot !== reviewerSlot
      || log.events.some(event => event.reviewerIdentity !== reviewerIdentity
        || event.languageCompetenceAttested !== true)) {
      throw new Error(`Reviewer identity mismatch for structural journal ${packet.packetId}`);
    }
    return {
      packetId: packet.packetId,
      packetFingerprint: packet.packetFingerprint,
      journalPath,
      eventCount: completeness.eventCount,
      finalEventHash: completeness.finalEventHash,
      journalCanonicalSha256: fingerprint(log)
    };
  }).sort((left, right) => left.packetId.localeCompare(right.packetId));
  if (new Set(packetSeals.map(entry => entry.packetId)).size !== packetSeals.length
    || new Set(packetSeals.map(entry => entry.journalPath)).size !== packetSeals.length) {
    throw new Error('A reviewer seal cannot contain duplicate packets or journal paths');
  }

  const sealWithoutHash = {
    schemaVersion: 1,
    sealType: STRUCTURAL_REVIEWER_SEAL,
    reviewerSlot,
    reviewerIdentity,
    sealedAt,
    packetSeals
  };
  return deepFreeze({
    ...sealWithoutHash,
    sealHash: fingerprint(sealWithoutHash)
  });
}

export function serialiseStructuralReviewResponseArtifact(value) {
  return `${JSON.stringify(JSON.parse(canonicalJson(value)), null, 2)}\n`;
}

function readJsonArtifact(path, subject) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (error) {
    throw new Error(`Cannot read ${subject}: ${path}`, { cause: error });
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${subject}: ${path}`, { cause: error });
  }
}

function manifestJournalPath(sealDirectory, journalPath) {
  const normalised = relative(sealDirectory, resolve(journalPath)).replaceAll('\\', '/');
  if (normalised === '' || normalised === '.' || normalised.startsWith('../')
    || normalised.includes('/') || isAbsolute(normalised)) {
    throw new Error('A sealed journal must be located directly inside its reviewer seal directory');
  }
  return normalised;
}

export function structuralReviewerSealPathForJournal(journalPath) {
  if (!nonEmptyString(journalPath)) throw new Error('journalPath is required');
  return join(dirname(resolve(journalPath)), STRUCTURAL_REVIEWER_SEAL_FILENAME);
}

export function appendStructuralReviewEvent({
  journalPath,
  packetPath,
  input,
  clock = () => new Date(),
  eventIdFactory = () => randomUUID()
}) {
  if (!nonEmptyString(journalPath) || !nonEmptyString(packetPath)) {
    throw new Error('Persistent structural append requires journalPath and packetPath');
  }
  const resolvedJournalPath = resolve(journalPath);
  const packet = readJsonArtifact(resolve(packetPath), 'structural review packet');
  const log = readJsonArtifact(resolvedJournalPath, 'structural response journal');
  const sealPath = structuralReviewerSealPathForJournal(resolvedJournalPath);

  if (existsSync(sealPath)) {
    const seal = readJsonArtifact(sealPath, 'structural reviewer seal');
    const sealValidation = validateStructuralReviewerSeal(seal);
    if (!sealValidation.ok) {
      throw new Error(`Structural reviewer seal is invalid; append fails closed: ${canonicalJson(sealValidation.errors)}`);
    }
    if (isStructuralReviewJournalSealed(seal, packet)) {
      throw new Error('Cannot append to a structural journal covered by a valid reviewer seal');
    }
  }

  const nextLog = constructStructuralReviewLogWithEvent(log, packet, input, { clock, eventIdFactory });
  writeFileSync(resolvedJournalPath, serialiseStructuralReviewResponseArtifact(nextLog), 'utf8');
  return nextLog;
}

export function persistStructuralReviewerSeal({
  reviewerDirectory,
  reviewerSlot,
  reviewerIdentity,
  sealedAt,
  journals
}) {
  if (!nonEmptyString(reviewerDirectory)) throw new Error('reviewerDirectory is required');
  if (!Array.isArray(journals) || journals.length === 0) throw new Error('At least one structural journal is required');
  const sealDirectory = resolve(reviewerDirectory);
  const sealPath = join(sealDirectory, STRUCTURAL_REVIEWER_SEAL_FILENAME);
  if (existsSync(sealPath)) throw new Error(`Structural reviewer seal already exists: ${sealPath}`);

  const loadedJournals = journals.map(({ packetPath, journalPath }) => {
    if (!nonEmptyString(packetPath) || !nonEmptyString(journalPath)) {
      throw new Error('Every persisted seal journal requires packetPath and journalPath');
    }
    return {
      packet: readJsonArtifact(resolve(packetPath), 'structural review packet'),
      log: readJsonArtifact(resolve(journalPath), 'structural response journal'),
      journalPath: manifestJournalPath(sealDirectory, journalPath)
    };
  });
  const seal = createStructuralReviewerSeal({
    reviewerSlot,
    reviewerIdentity,
    sealedAt,
    journals: loadedJournals
  });
  writeFileSync(sealPath, serialiseStructuralReviewResponseArtifact(seal), { encoding: 'utf8', flag: 'wx' });
  return { sealPath, seal };
}
