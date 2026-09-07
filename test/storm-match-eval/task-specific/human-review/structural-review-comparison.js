import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { canonicalJson, fingerprint } from './review-packets.js';
import {
  evaluateStructuralReviewCompleteness,
  getEffectiveStructuralDecisions,
  validateStructuralReviewerSeal,
  validateStructuralReviewResponseLog
} from './structural-review-response-log.js';

export const STRUCTURAL_REVIEW_COMPARISON_STATUS = 'PENDING_HUMAN_REVIEW';
export const STRUCTURAL_REVIEW_COMPARISON_TYPE = 'STRUCTURAL_REVIEW_AB_COMPARISON';

export const EXPECTED_STRUCTURAL_REVIEW_CHECKPOINTS = Object.freeze({
  A: Object.freeze({
    commit: 'ad75cabfd411ba31c7546c56948ed25bb6b825b8',
    eventCount: 182,
    sealHash: '79ea358a594c5b91eee9e5fe453582cb515f11d542571816981b2b2155fde5a8'
  }),
  B: Object.freeze({
    commit: '1846c5b858c9b8b02a2dc52334f59872d56a1695',
    eventCount: 164,
    sealHash: '3b24eefdf1b200fc94ebbd83003a796aa3fc1593d55efbbf0a4cf86749438549'
  })
});

const SECTION_DEFINITIONS = Object.freeze([
  Object.freeze({
    basename: '01-equivalence-preferred',
    packetKind: 'EQUIVALENCE_AND_PREFERRED',
    sectionKey: 'equivalencePreferred',
    primaryDecisionType: 'substantiveEquivalencePartition'
  }),
  Object.freeze({
    basename: '02-knowledge-boundaries',
    packetKind: 'KNOWLEDGE_BOUNDARIES',
    sectionKey: 'knowledgeBoundaries',
    primaryDecisionType: 'knowledgeComponentBoundary'
  }),
  Object.freeze({
    basename: '03-ambiguity-families',
    packetKind: 'AMBIGUITY_CAPACITY_FAMILIES',
    sectionKey: 'ambiguityFamilies',
    primaryDecisionType: 'ambiguityFamilyDisposition'
  }),
  Object.freeze({
    basename: '04-scenario-family-preflight',
    packetKind: 'SCENARIO_FAMILY_PREFLIGHT',
    sectionKey: 'scenarioFamilyPreflight',
    primaryDecisionType: 'fragmentationAssessment'
  })
]);

const STATUS_PRECEDENCE = Object.freeze([
  'CROSSWALK_UNRESOLVED',
  'DECISION_VALUE_DISAGREEMENT',
  'PARTITION_DISAGREEMENT',
  'MECHANISM_DISAGREEMENT',
  'PREFERRED_SELECTION_DISAGREEMENT',
  'CONDITIONAL_STRUCTURE_DISAGREEMENT'
]);

const PARTITION_DECISION_VALUES = new Set([
  'multipleNonEquivalentGroups',
  'partitionRequired',
  'reviewerDefinedPartitionOfDisplayedKnowledge',
  'reviewerDefinedFamilyGroups'
]);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function withoutField(value, field) {
  const { [field]: _ignored, ...rest } = value;
  return rest;
}

function addFinding(findings, field, status, detail = null) {
  if (!findings.some(finding => finding.field === field && finding.status === status)) {
    findings.push({ field, status, ...(detail === null ? {} : { detail }) });
  }
}

function canonicalEqual(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

export function canonicalisePartition(groups) {
  if (groups === null) return null;
  return groups
    .map(group => [...group].sort())
    .sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
}

function knowledgeRefsIn(text) {
  return [...text.matchAll(/storm-\d{2}-[ab]-knowledge-\d{3}/g)].map(match => match[0]);
}

function bracketedKnowledgeGroups(text) {
  return [...text.matchAll(/\[([^\]]*storm-\d{2}-[ab]-knowledge-\d{3}[^\]]*)\]/g)]
    .map(match => knowledgeRefsIn(match[1]));
}

function normaliseKnowledgeRef(localRef, knowledgeMap, errors, field) {
  const canonical = knowledgeMap.get(localRef);
  if (!canonical) {
    errors.push({ code: 'UNKNOWN_LOCAL_KNOWLEDGE_REF', field, localRef });
    return null;
  }
  return canonical;
}

function normalisePartition({ event, item, knowledgeMap, field, errors }) {
  if (!event || event.decisionValue === 'insufficientEvidence') return null;

  let localGroups;
  if (event.decisionValue === 'oneEquivalentGroup'
    || event.decisionValue === 'sameConnectedComponent') {
    localGroups = [item.knowledgeRefs];
  } else if (PARTITION_DECISION_VALUES.has(event.decisionValue)) {
    localGroups = bracketedKnowledgeGroups(event.rationale);
  } else if (event.decisionValue === 'separateComponents') {
    localGroups = bracketedKnowledgeGroups(event.rationale);
    if (localGroups.length === 0) localGroups = item.knowledgeRefs.map(ref => [ref]);
  } else {
    errors.push({ code: 'UNSUPPORTED_PARTITION_DECISION', field, decisionValue: event.decisionValue });
    return null;
  }

  if (localGroups.length === 0) {
    errors.push({ code: 'MISSING_EXPLICIT_PARTITION', field });
    return null;
  }

  const flattened = localGroups.flat();
  const displayed = [...item.knowledgeRefs].sort();
  if (!canonicalEqual([...flattened].sort(), displayed)
    || new Set(flattened).size !== flattened.length) {
    errors.push({
      code: 'PARTITION_DOES_NOT_COVER_DISPLAYED_SCOPE',
      field,
      displayedKnowledgeRefs: displayed,
      partitionKnowledgeRefs: [...flattened].sort()
    });
  }

  const canonicalGroups = localGroups.map(group => group
    .map(ref => normaliseKnowledgeRef(ref, knowledgeMap, errors, field))
    .filter(Boolean));
  return canonicalisePartition(canonicalGroups);
}

function preferredEntryId(event, knowledgeMap, errors) {
  if (!event || event.decisionValue !== 'chooseOneDisplayedKnowledgeRef') return null;
  const refs = knowledgeRefsIn(event.rationale);
  const explicit = event.rationale.match(/preferredKnowledgeRef\s*=\s*(storm-\d{2}-[ab]-knowledge-\d{3})/u)?.[1];
  if (!explicit) {
    errors.push({ code: 'MISSING_EXPLICIT_PREFERRED_KNOWLEDGE_REF', field: 'preferredEntrySelection', observedRefs: refs });
    return null;
  }
  return normaliseKnowledgeRef(explicit, knowledgeMap, errors, 'preferredEntrySelection');
}

function localReviewItemRefsIn(text, packet, errors) {
  const direct = [...text.matchAll(/storm-04-[ab]-item-\d{3}/g)].map(match => match[0]);
  const abbreviated = [...text.matchAll(/\bl['’]item\s+(\d{3})\b/giu)]
    .map(match => `storm-04-${packet.reviewerSlot.toLowerCase()}-item-${match[1]}`);
  const refs = [...new Set([...direct, ...abbreviated])];
  const displayedRefs = new Set(packet.reviewItems.map(item => item.reviewItemRef));
  for (const ref of refs) {
    if (!displayedRefs.has(ref)) errors.push({ code: 'UNKNOWN_LOCAL_REVIEW_ITEM_REF', field: 'fragmentationAssessment', localRef: ref });
  }
  return refs;
}

function normaliseMergeTargets(event, packet, itemMap, errors) {
  if (!event || event.decisionValue !== 'mergeWithAnotherDisplayedBrief') return [];
  const refs = localReviewItemRefsIn(event.rationale, packet, errors);
  if (refs.length === 0) {
    errors.push({ code: 'MISSING_EXPLICIT_MERGE_TARGET', field: 'fragmentationAssessment' });
    return [];
  }
  return refs.map(ref => {
    const canonical = itemMap.get(ref);
    if (!canonical) errors.push({ code: 'UNKNOWN_LOCAL_REVIEW_ITEM_REF', field: 'fragmentationAssessment', localRef: ref });
    return canonical;
  }).filter(Boolean).sort();
}

function eventRationales(effective) {
  return Object.fromEntries(Object.entries(effective)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([decisionType, event]) => [decisionType, event.rationale]));
}

function normaliseReviewerDecision({ packet, item, effective, knowledgeMap, itemMap }) {
  const errors = [];
  let decisions;
  if (packet.packetKind === 'EQUIVALENCE_AND_PREFERRED') {
    const partition = effective.substantiveEquivalencePartition ?? null;
    const preferred = effective.preferredEntrySelection ?? null;
    decisions = {
      substantiveEquivalencePartition: {
        value: partition?.decisionValue ?? null,
        canonicalPartition: normalisePartition({
          event: partition,
          item,
          knowledgeMap,
          field: 'substantiveEquivalencePartition.canonicalPartition',
          errors
        })
      },
      preferredEntrySelection: {
        value: preferred?.decisionValue ?? null,
        preferredEntryId: preferredEntryId(preferred, knowledgeMap, errors)
      }
    };
  } else if (packet.packetKind === 'KNOWLEDGE_BOUNDARIES') {
    const boundary = effective.knowledgeComponentBoundary ?? null;
    const rules = effective.futureCoverageBoundaryRules ?? null;
    decisions = {
      knowledgeComponentBoundary: {
        value: boundary?.decisionValue ?? null,
        canonicalPartition: normalisePartition({
          event: boundary,
          item,
          knowledgeMap,
          field: 'knowledgeComponentBoundary.canonicalPartition',
          errors
        })
      },
      futureCoverageBoundaryRules: {
        value: rules?.decisionValue ?? null,
        text: rules?.rationale ?? null
      }
    };
  } else if (packet.packetKind === 'AMBIGUITY_CAPACITY_FAMILIES') {
    const disposition = effective.ambiguityFamilyDisposition ?? null;
    const mechanism = effective.ambiguityMechanism ?? null;
    const groups = effective.substantiallyDifferentCoveredGroups ?? null;
    decisions = {
      ambiguityFamilyDisposition: { value: disposition?.decisionValue ?? null },
      ambiguityMechanism: { value: mechanism?.decisionValue ?? null },
      substantiallyDifferentCoveredGroups: {
        value: groups?.decisionValue ?? null,
        canonicalPartition: normalisePartition({
          event: groups,
          item,
          knowledgeMap,
          field: 'substantiallyDifferentCoveredGroups.canonicalPartition',
          errors
        })
      }
    };
  } else if (packet.packetKind === 'SCENARIO_FAMILY_PREFLIGHT') {
    const partition = effective.reviewerScenarioFamilyPartition ?? null;
    const fragmentation = effective.fragmentationAssessment ?? null;
    decisions = {
      reviewerScenarioFamilyPartition: {
        value: partition?.decisionValue ?? null,
        canonicalPartition: normalisePartition({
          event: partition,
          item,
          knowledgeMap,
          field: 'reviewerScenarioFamilyPartition.canonicalPartition',
          errors
        })
      },
      fragmentationAssessment: {
        value: fragmentation?.decisionValue ?? null,
        mergeCanonicalReviewItemIds: normaliseMergeTargets(fragmentation, packet, itemMap, errors)
      }
    };
  } else {
    errors.push({ code: 'UNSUPPORTED_PACKET_KIND', packetKind: packet.packetKind });
    decisions = {};
  }
  return { decisions, rationales: eventRationales(effective), errors };
}

function compareDecisionValue(findings, field, left, right) {
  if (left !== right) addFinding(findings, field, 'DECISION_VALUE_DISAGREEMENT');
}

function comparePartition(findings, field, left, right) {
  if (!canonicalEqual(left, right)) addFinding(findings, field, 'PARTITION_DISAGREEMENT');
}

function compareNormalisedDecisions(packetKind, left, right, crosswalkErrors) {
  const findings = [];
  for (const error of crosswalkErrors) addFinding(findings, error.field ?? 'crosswalk', 'CROSSWALK_UNRESOLVED', error);

  if (packetKind === 'EQUIVALENCE_AND_PREFERRED') {
    compareDecisionValue(findings, 'substantiveEquivalencePartition.value', left.substantiveEquivalencePartition.value, right.substantiveEquivalencePartition.value);
    comparePartition(findings, 'substantiveEquivalencePartition.canonicalPartition', left.substantiveEquivalencePartition.canonicalPartition, right.substantiveEquivalencePartition.canonicalPartition);
    if (!canonicalEqual(left.preferredEntrySelection, right.preferredEntrySelection)) {
      addFinding(findings, 'preferredEntrySelection', 'PREFERRED_SELECTION_DISAGREEMENT');
    }
  } else if (packetKind === 'KNOWLEDGE_BOUNDARIES') {
    compareDecisionValue(findings, 'knowledgeComponentBoundary.value', left.knowledgeComponentBoundary.value, right.knowledgeComponentBoundary.value);
    comparePartition(findings, 'knowledgeComponentBoundary.canonicalPartition', left.knowledgeComponentBoundary.canonicalPartition, right.knowledgeComponentBoundary.canonicalPartition);
    compareDecisionValue(findings, 'futureCoverageBoundaryRules.value', left.futureCoverageBoundaryRules.value, right.futureCoverageBoundaryRules.value);
  } else if (packetKind === 'AMBIGUITY_CAPACITY_FAMILIES') {
    const leftStructural = left.ambiguityFamilyDisposition.value === 'structuralAmbiguity';
    const rightStructural = right.ambiguityFamilyDisposition.value === 'structuralAmbiguity';
    compareDecisionValue(findings, 'ambiguityFamilyDisposition.value', left.ambiguityFamilyDisposition.value, right.ambiguityFamilyDisposition.value);
    if (leftStructural !== rightStructural) {
      addFinding(findings, 'ambiguityFamilyDisposition.conditionalDecisions', 'CONDITIONAL_STRUCTURE_DISAGREEMENT');
    }
    if (leftStructural && rightStructural) {
      if (left.ambiguityMechanism.value !== right.ambiguityMechanism.value) {
        addFinding(findings, 'ambiguityMechanism.value', 'MECHANISM_DISAGREEMENT');
      }
      compareDecisionValue(findings, 'substantiallyDifferentCoveredGroups.value', left.substantiallyDifferentCoveredGroups.value, right.substantiallyDifferentCoveredGroups.value);
      comparePartition(findings, 'substantiallyDifferentCoveredGroups.canonicalPartition', left.substantiallyDifferentCoveredGroups.canonicalPartition, right.substantiallyDifferentCoveredGroups.canonicalPartition);
    }
  } else if (packetKind === 'SCENARIO_FAMILY_PREFLIGHT') {
    const leftPartitioned = left.reviewerScenarioFamilyPartition.value === 'reviewerDefinedFamilyGroups';
    const rightPartitioned = right.reviewerScenarioFamilyPartition.value === 'reviewerDefinedFamilyGroups';
    compareDecisionValue(findings, 'reviewerScenarioFamilyPartition.value', left.reviewerScenarioFamilyPartition.value, right.reviewerScenarioFamilyPartition.value);
    if (leftPartitioned !== rightPartitioned) {
      addFinding(findings, 'reviewerScenarioFamilyPartition.conditionalGroups', 'CONDITIONAL_STRUCTURE_DISAGREEMENT');
    }
    if (leftPartitioned && rightPartitioned) {
      comparePartition(findings, 'reviewerScenarioFamilyPartition.canonicalPartition', left.reviewerScenarioFamilyPartition.canonicalPartition, right.reviewerScenarioFamilyPartition.canonicalPartition);
    }
    compareDecisionValue(findings, 'fragmentationAssessment.value', left.fragmentationAssessment.value, right.fragmentationAssessment.value);
    const leftMerge = left.fragmentationAssessment.value === 'mergeWithAnotherDisplayedBrief';
    const rightMerge = right.fragmentationAssessment.value === 'mergeWithAnotherDisplayedBrief';
    if (leftMerge !== rightMerge
      || (leftMerge && rightMerge && !canonicalEqual(left.fragmentationAssessment.mergeCanonicalReviewItemIds, right.fragmentationAssessment.mergeCanonicalReviewItemIds))) {
      addFinding(findings, 'fragmentationAssessment.mergeCanonicalReviewItemIds', 'CONDITIONAL_STRUCTURE_DISAGREEMENT');
    }
  }

  findings.sort((leftFinding, rightFinding) => {
    const statusDifference = STATUS_PRECEDENCE.indexOf(leftFinding.status) - STATUS_PRECEDENCE.indexOf(rightFinding.status);
    return statusDifference || leftFinding.field.localeCompare(rightFinding.field);
  });
  return findings;
}

function firstLevelValue(packetKind, decisions) {
  if (packetKind === 'EQUIVALENCE_AND_PREFERRED') return decisions.substantiveEquivalencePartition.value;
  if (packetKind === 'KNOWLEDGE_BOUNDARIES') return decisions.knowledgeComponentBoundary.value;
  if (packetKind === 'AMBIGUITY_CAPACITY_FAMILIES') return decisions.ambiguityFamilyDisposition.value;
  if (packetKind === 'SCENARIO_FAMILY_PREFLIGHT') return decisions.fragmentationAssessment.value;
  return null;
}

function loadReviewer(root, definition, slot, linkage) {
  const lowerSlot = slot.toLowerCase();
  const packet = readJson(join(root, `reviewer-${lowerSlot}`, `${definition.basename}.fr.json`));
  const log = readJson(join(root, 'responses', `reviewer-${lowerSlot}`, `${definition.basename}.fr.response-log.json`));
  const side = linkage[`reviewer${slot}`];
  const itemMap = new Map(side.itemRefs.map(mapping => [mapping.reviewItemRef, mapping.sourceItemId]));
  const knowledgeMap = new Map(side.knowledgeRefs.map(mapping => [mapping.knowledgeRef, mapping.entryId]));
  return { packet, log, side, itemMap, knowledgeMap };
}

function validateSectionInputs(definition, linkage, reviewerA, reviewerB) {
  const errors = [];
  if (linkage.sectionKey !== definition.sectionKey
    || linkage.linkageFingerprint !== fingerprint(withoutField(linkage, 'linkageFingerprint'))) {
    errors.push({ code: 'INVALID_CURATOR_LINKAGE', sectionKey: definition.sectionKey });
  }
  for (const [slot, reviewer] of [['A', reviewerA], ['B', reviewerB]]) {
    const validation = validateStructuralReviewResponseLog(reviewer.log, reviewer.packet);
    const completeness = evaluateStructuralReviewCompleteness(reviewer.log, reviewer.packet);
    if (!validation.ok || !completeness.complete) {
      errors.push({ code: 'INVALID_OR_INCOMPLETE_REVIEW_LOG', sectionKey: definition.sectionKey, reviewerSlot: slot });
    }
    if (reviewer.packet.packetKind !== definition.packetKind
      || reviewer.packet.generationAuthorized !== false
      || reviewer.packet.humanQualityGateStatus !== STRUCTURAL_REVIEW_COMPARISON_STATUS
      || reviewer.packet.packetFingerprint !== reviewer.side.packetFingerprint) {
      errors.push({ code: 'INVALID_REVIEW_PACKET_BINDING', sectionKey: definition.sectionKey, reviewerSlot: slot });
    }
  }
  return errors;
}

function compareSection(root, definition) {
  const linkage = readJson(join(root, 'curator-only', `${definition.basename}.linkage.json`));
  const reviewerA = loadReviewer(root, definition, 'A', linkage);
  const reviewerB = loadReviewer(root, definition, 'B', linkage);
  const inputErrors = validateSectionInputs(definition, linkage, reviewerA, reviewerB);
  if (inputErrors.length > 0) throw new Error(`Structural comparison input failure: ${canonicalJson(inputErrors)}`);

  const aByCanonical = new Map(linkage.reviewerA.itemRefs.map(mapping => [mapping.sourceItemId, mapping.reviewItemRef]));
  const bByCanonical = new Map(linkage.reviewerB.itemRefs.map(mapping => [mapping.sourceItemId, mapping.reviewItemRef]));
  const canonicalIds = [...new Set([...aByCanonical.keys(), ...bByCanonical.keys()])].sort();
  const effectiveA = getEffectiveStructuralDecisions(reviewerA.log);
  const effectiveB = getEffectiveStructuralDecisions(reviewerB.log);

  return canonicalIds.map(canonicalReviewItemId => {
    const crosswalkErrors = [];
    const reviewItemRefA = aByCanonical.get(canonicalReviewItemId) ?? null;
    const reviewItemRefB = bByCanonical.get(canonicalReviewItemId) ?? null;
    if (!reviewItemRefA || !reviewItemRefB) {
      crosswalkErrors.push({ code: 'MISSING_REVIEW_ITEM_CROSSWALK', field: 'canonicalReviewItemId', canonicalReviewItemId });
    }
    const itemA = reviewerA.packet.reviewItems.find(item => item.reviewItemRef === reviewItemRefA) ?? { knowledgeRefs: [] };
    const itemB = reviewerB.packet.reviewItems.find(item => item.reviewItemRef === reviewItemRefB) ?? { knowledgeRefs: [] };
    const canonicalScopeA = itemA.knowledgeRefs.map(ref => normaliseKnowledgeRef(ref, reviewerA.knowledgeMap, crosswalkErrors, 'canonicalKnowledgeScope')).filter(Boolean).sort();
    const canonicalScopeB = itemB.knowledgeRefs.map(ref => normaliseKnowledgeRef(ref, reviewerB.knowledgeMap, crosswalkErrors, 'canonicalKnowledgeScope')).filter(Boolean).sort();
    if (!canonicalEqual(canonicalScopeA, canonicalScopeB)) {
      crosswalkErrors.push({ code: 'CANONICAL_KNOWLEDGE_SCOPE_MISMATCH', field: 'canonicalKnowledgeScope', reviewerA: canonicalScopeA, reviewerB: canonicalScopeB });
    }

    const normalisedA = normaliseReviewerDecision({
      packet: reviewerA.packet,
      item: itemA,
      effective: effectiveA[reviewItemRefA] ?? {},
      knowledgeMap: reviewerA.knowledgeMap,
      itemMap: reviewerA.itemMap
    });
    const normalisedB = normaliseReviewerDecision({
      packet: reviewerB.packet,
      item: itemB,
      effective: effectiveB[reviewItemRefB] ?? {},
      knowledgeMap: reviewerB.knowledgeMap,
      itemMap: reviewerB.itemMap
    });
    crosswalkErrors.push(...normalisedA.errors, ...normalisedB.errors);
    const findings = compareNormalisedDecisions(definition.packetKind, normalisedA.decisions, normalisedB.decisions, crosswalkErrors);
    const firstLevelAgreement = firstLevelValue(definition.packetKind, normalisedA.decisions)
      === firstLevelValue(definition.packetKind, normalisedB.decisions);
    const comparisonStatus = findings[0]?.status ?? 'EXACT_AGREEMENT';

    const reviewerView = (slot, reviewer, item, reviewItemRef, normalised) => ({
      packetId: reviewer.packet.packetId,
      reviewItemRef,
      knowledgeRefMappings: item.knowledgeRefs.map(localKnowledgeRef => ({
        localKnowledgeRef,
        entryId: reviewer.knowledgeMap.get(localKnowledgeRef) ?? null
      })),
      decisions: normalised.decisions,
      rationales: normalised.rationales,
      reviewerSlot: slot
    });

    return {
      packetKind: definition.packetKind,
      canonicalReviewItemId,
      canonicalKnowledgeScope: canonicalScopeA,
      reviewerA: reviewerView('A', reviewerA, itemA, reviewItemRefA, normalisedA),
      reviewerB: reviewerView('B', reviewerB, itemB, reviewItemRefB, normalisedB),
      firstLevelAgreement,
      completeAgreement: comparisonStatus === 'EXACT_AGREEMENT',
      comparisonStatus,
      comparisonFindings: findings,
      requiresAdjudication: comparisonStatus !== 'EXACT_AGREEMENT'
    };
  });
}

function validateSealedReviewer(root, slot) {
  const lowerSlot = slot.toLowerCase();
  const descriptors = SECTION_DEFINITIONS.map(definition => ({
    packet: readJson(join(root, `reviewer-${lowerSlot}`, `${definition.basename}.fr.json`)),
    log: readJson(join(root, 'responses', `reviewer-${lowerSlot}`, `${definition.basename}.fr.response-log.json`)),
    journalPath: `${definition.basename}.fr.response-log.json`
  }));
  const seal = readJson(join(root, 'responses', `reviewer-${lowerSlot}`, 'structural-reviewer-seal.json'));
  const validation = validateStructuralReviewerSeal(seal, descriptors);
  const eventCount = descriptors.reduce((sum, descriptor) => sum + descriptor.log.events.length, 0);
  const expected = EXPECTED_STRUCTURAL_REVIEW_CHECKPOINTS[slot];
  if (!validation.ok || seal.sealHash !== expected.sealHash || eventCount !== expected.eventCount
    || seal.packetSeals.length !== SECTION_DEFINITIONS.length) {
    throw new Error(`Reviewer ${slot} sealed checkpoint validation failed: ${canonicalJson({
      validation,
      actualSealHash: seal.sealHash,
      expectedSealHash: expected.sealHash,
      eventCount,
      expectedEventCount: expected.eventCount,
      packetSealCount: seal.packetSeals.length
    })}`);
  }
  return {
    checkpointCommit: expected.commit,
    eventCount,
    packetSealCount: seal.packetSeals.length,
    sealHash: seal.sealHash,
    valid: true
  };
}

function countBy(items, selector) {
  const result = {};
  for (const item of items) {
    const key = selector(item);
    result[key] = (result[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(result).sort(([left], [right]) => left.localeCompare(right)));
}

function createSummary(items) {
  const byPacket = {};
  for (const definition of SECTION_DEFINITIONS) {
    const packetItems = items.filter(item => item.packetKind === definition.packetKind);
    byPacket[definition.packetKind] = {
      totalItems: packetItems.length,
      firstLevelAgreements: packetItems.filter(item => item.firstLevelAgreement).length,
      completeAgreements: packetItems.filter(item => item.completeAgreement).length,
      requiresAdjudication: packetItems.filter(item => item.requiresAdjudication).length,
      crosswalkUnresolved: packetItems.filter(item => item.comparisonStatus === 'CROSSWALK_UNRESOLVED').length,
      primaryComparisonStatuses: countBy(packetItems, item => item.comparisonStatus)
    };
  }
  return {
    totalItems: items.length,
    firstLevelAgreements: items.filter(item => item.firstLevelAgreement).length,
    completeAgreements: items.filter(item => item.completeAgreement).length,
    requiresAdjudication: items.filter(item => item.requiresAdjudication).length,
    crosswalkUnresolved: items.filter(item => item.comparisonStatus === 'CROSSWALK_UNRESOLVED').length,
    primaryComparisonStatuses: countBy(items, item => item.comparisonStatus),
    findingStatuses: countBy(items.flatMap(item => item.comparisonFindings), finding => finding.status),
    byPacket
  };
}

export function buildStructuralReviewComparison({ generatedRoot }) {
  const reviewerA = validateSealedReviewer(generatedRoot, 'A');
  const reviewerB = validateSealedReviewer(generatedRoot, 'B');
  const items = SECTION_DEFINITIONS.flatMap(definition => compareSection(generatedRoot, definition));
  const artifact = {
    schemaVersion: 1,
    artifactType: STRUCTURAL_REVIEW_COMPARISON_TYPE,
    status: STRUCTURAL_REVIEW_COMPARISON_STATUS,
    generationAuthorized: false,
    adjudicationPerformed: false,
    sourceReviews: { reviewerA, reviewerB },
    crosswalkMethod: {
      reviewItemIdentity: 'curator linkage sourceItemId',
      knowledgeIdentity: 'curator linkage entryId',
      localReferencesComparedDirectly: false,
      rationaleUse: 'Explicit local knowledge/item references are parsed only to recover reviewer-authored partitions, preferred selections, and merge targets; prose is display-only.'
    },
    normalization: {
      partitionElementOrderSignificant: false,
      partitionGroupOrderSignificant: false,
      rationalesAffectAgreement: false,
      firstLevelDecisionTypes: Object.fromEntries(SECTION_DEFINITIONS.map(definition => [definition.packetKind, definition.primaryDecisionType]))
    },
    summary: createSummary(items),
    items
  };
  return Object.freeze({ ...artifact, matrixFingerprint: fingerprint(artifact) });
}

function displayJson(value) {
  return `\`${canonicalJson(value)}\``;
}

export function renderStructuralReviewComparisonReport(matrix) {
  const lines = [
    '# Storm Match — concordance/divergence structurelle Reviewer A ↔ Reviewer B',
    '',
    `- Statut : \`${matrix.status}\``,
    `- Autorisation de génération : \`${matrix.generationAuthorized}\``,
    `- Adjudication effectuée : \`${matrix.adjudicationPerformed}\``,
    `- Fingerprint matrice : \`${matrix.matrixFingerprint}\``,
    `- Seal A : \`${matrix.sourceReviews.reviewerA.sealHash}\` (${matrix.sourceReviews.reviewerA.eventCount} événements)`,
    `- Seal B : \`${matrix.sourceReviews.reviewerB.sealHash}\` (${matrix.sourceReviews.reviewerB.eventCount} événements)`,
    '',
    '## Méthode',
    '',
    'Les items sont reliés exclusivement par le `sourceItemId` du linkage curator-only et les connaissances par leur `entryId`. Les références locales A/B ne sont jamais comparées directement. Les partitions sont des ensembles de groupes : l’ordre des groupes et l’ordre interne sont ignorés. Les rationales sont conservées pour affichage ; seules leurs références locales explicitement structurées servent à reconstruire partitions, sélections préférées et cibles de fusion.',
    '',
    'L’accord de premier niveau porte sur `substantiveEquivalencePartition`, `knowledgeComponentBoundary`, `ambiguityFamilyDisposition` et `fragmentationAssessment` selon le paquet. L’accord complet exige l’égalité de toutes les décisions normalisées applicables ; le texte libre des rationales et des règles de frontière n’est pas interprété sémantiquement.',
    '',
    '## Synthèse',
    '',
    `- Items comparés : **${matrix.summary.totalItems}**`,
    `- Accords de premier niveau : **${matrix.summary.firstLevelAgreements}**`,
    `- Accords complets : **${matrix.summary.completeAgreements}**`,
    `- Items nécessitant adjudication : **${matrix.summary.requiresAdjudication}**`,
    `- Crosswalk non résolus : **${matrix.summary.crosswalkUnresolved}**`,
    `- Statuts primaires : ${displayJson(matrix.summary.primaryComparisonStatuses)}`,
    `- Constats de divergence (non exclusifs) : ${displayJson(matrix.summary.findingStatuses)}`,
    '',
    '## Détail par paquet',
    ''
  ];

  for (const [packetKind, summary] of Object.entries(matrix.summary.byPacket)) {
    lines.push(`### ${packetKind}`, '');
    lines.push(`- Items : ${summary.totalItems}`);
    lines.push(`- Accords de premier niveau : ${summary.firstLevelAgreements}`);
    lines.push(`- Accords complets : ${summary.completeAgreements}`);
    lines.push(`- À adjudicer : ${summary.requiresAdjudication}`);
    lines.push(`- Crosswalk non résolus : ${summary.crosswalkUnresolved}`);
    lines.push(`- Statuts primaires : ${displayJson(summary.primaryComparisonStatuses)}`, '');
  }

  lines.push('## Items nécessitant adjudication', '');
  for (const item of matrix.items.filter(candidate => candidate.requiresAdjudication)) {
    lines.push(`### ${item.canonicalReviewItemId} — ${item.comparisonStatus}`, '');
    lines.push(`- Paquet : \`${item.packetKind}\``);
    lines.push(`- Références : A \`${item.reviewerA.reviewItemRef}\` · B \`${item.reviewerB.reviewItemRef}\``);
    lines.push(`- Connaissances canoniques : ${displayJson(item.canonicalKnowledgeScope)}`);
    lines.push(`- Constats : ${displayJson(item.comparisonFindings)}`);
    lines.push(`- Décision normalisée A : ${displayJson(item.reviewerA.decisions)}`);
    lines.push(`- Décision normalisée B : ${displayJson(item.reviewerB.decisions)}`);
    if (item.packetKind === 'KNOWLEDGE_BOUNDARIES') {
      lines.push(`- Règles de frontière A : ${item.reviewerA.decisions.futureCoverageBoundaryRules.text}`);
      lines.push(`- Règles de frontière B : ${item.reviewerB.decisions.futureCoverageBoundaryRules.text}`);
    }
    lines.push('- Rationales A :');
    for (const [type, rationale] of Object.entries(item.reviewerA.rationales)) lines.push(`  - \`${type}\` : ${rationale}`);
    lines.push('- Rationales B :');
    for (const [type, rationale] of Object.entries(item.reviewerB.rationales)) lines.push(`  - \`${type}\` : ${rationale}`);
    lines.push('');
  }

  if (matrix.summary.crosswalkUnresolved === 0) {
    lines.push('## Crosswalk non résolus', '', 'Aucun.', '');
  }
  lines.push('## Garde-fous', '', '- Aucune décision A ou B n’est modifiée.', '- Aucun champ d’adjudication ou de gold n’est produit.', '- `generationAuthorized=false`.', '- Statut maintenu à `PENDING_HUMAN_REVIEW`.', '');
  return `${lines.join('\n').replace(/\n+$/u, '')}\n`;
}
