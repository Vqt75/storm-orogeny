import { createHash } from 'node:crypto';

import { validateAnswerEquivalenceQualityGate } from './equivalence-quality-gate.js';
import {
  CANDIDATE_STRUCTURE_STATUS,
  HOLDOUT_QUALITY_GATE_STATUS,
  fingerprint
} from './candidate-corpus-structure.js';

const SPLITS = ['train', 'development', 'calibration', 'holdout'];
const OUTCOMES = ['covered', 'notCovered', 'ambiguous'];
const LANGUAGES = ['fr', 'en', 'de', 'es', 'it', 'nl'];
const EXPECTED_LANGUAGE_TOTALS = { fr: 942, en: 204, de: 168, es: 132, it: 132, nl: 102 };
const FORBIDDEN_CASE_FIELDS = new Set([
  'query',
  'formulation',
  'expectedEntryId',
  'expectedSystemOutcome',
  'goldCoveredCandidateIds',
  'goldCoveredAnswerEquivalenceGroupIds',
  'candidatePairs',
  'candidateDecision',
  'systemOutcome',
  'label',
  'score',
  'probability',
  'prediction',
  'modelOutput'
]);

function add(errors, code, details = {}) {
  errors.push({ code, ...details });
}

function withoutField(value, field) {
  const { [field]: _ignored, ...rest } = value;
  return rest;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function collectForbiddenFields(value, path = '$', hits = []) {
  if (Array.isArray(value)) {
    value.forEach((child, index) => collectForbiddenFields(child, `${path}[${index}]`, hits));
    return hits;
  }
  if (!value || typeof value !== 'object') return hits;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (FORBIDDEN_CASE_FIELDS.has(key)) hits.push({ key, path: childPath });
    collectForbiddenFields(child, childPath, hits);
  }
  return hits;
}

function validateSnapshot(snapshotBytes, snapshot, structure, errors) {
  const source = structure.canonicalSource;
  const actualSha256 = createHash('sha256').update(snapshotBytes).digest('hex');
  if (actualSha256 !== source.snapshotSha256) {
    add(errors, 'SNAPSHOT_SHA256_MISMATCH', { expected: source.snapshotSha256, actual: actualSha256 });
  }
  if (snapshot.schemaVersion !== source.snapshotSchemaVersion
    || snapshot.source?.path !== source.sourcePath
    || snapshot.source?.symbol !== source.sourceSymbol
    || snapshot.source?.gitCommit !== source.sourceGitCommit) {
    add(errors, 'SNAPSHOT_PROVENANCE_MISMATCH');
  }
  if (snapshot.entries?.length !== source.entryCount || source.entryCount !== 112) {
    add(errors, 'SNAPSHOT_ENTRY_COUNT_MISMATCH', {
      expected: source.entryCount,
      actual: snapshot.entries?.length ?? null
    });
  }

  const expectedIds = Array.from(
    { length: source.entryCount },
    (_, index) => `equinoxe-q${String(index + 1).padStart(3, '0')}`
  );
  const actualIds = snapshot.entries?.map(entry => entry.entryId) ?? [];
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
    add(errors, 'SYNTHETIC_ENTRY_ID_SEQUENCE_MISMATCH');
  }
  if ((snapshot.entries ?? []).some(entry => entry.intentId !== null)) {
    add(errors, 'NON_NULL_INTENT_ID');
  }
  if (source.fixtureIdPolicy !== 'synthetic-test-only-ordinal' || source.runtimeSeedDependency !== false) {
    add(errors, 'INVALID_FIXTURE_OR_SEED_INDEPENDENCE_POLICY');
  }

  const provenance = structure.entryProvenance ?? [];
  if (provenance.length !== source.entryCount) add(errors, 'ENTRY_PROVENANCE_COUNT_MISMATCH');
  const provenanceIds = new Set();
  for (const [index, item] of provenance.entries()) {
    const expectedEntryId = expectedIds[index];
    if (item.entryId !== expectedEntryId || item.sourceOrdinal !== index + 1
      || item.provenanceRef !== source.provenanceRef
      || item.snapshotSha256 !== source.snapshotSha256
      || item.fixtureIdPolicy !== source.fixtureIdPolicy) {
      add(errors, 'INVALID_ENTRY_PROVENANCE', { index, entryId: item.entryId ?? null });
    }
    if (provenanceIds.has(item.entryId)) add(errors, 'DUPLICATE_ENTRY_PROVENANCE', { entryId: item.entryId });
    provenanceIds.add(item.entryId);
  }
}

function validateEquivalence(snapshot, structure, errors) {
  const result = validateAnswerEquivalenceQualityGate({
    entries: snapshot.entries,
    groups: structure.answerEquivalenceGroups,
    cases: []
  });
  for (const error of result.errors) {
    const { code, ...details } = error;
    add(errors, `EQUIVALENCE_${code}`, details);
  }

  for (const group of structure.answerEquivalenceGroups ?? []) {
    if (!group.businessRationale || group.preferredRuleVersion !== structure.preferredEntryRule.version
      || group.snapshotVersion !== structure.canonicalSource.provenanceRef) {
      add(errors, 'INCOMPLETE_EQUIVALENCE_CANDIDATE_METADATA', {
        answerEquivalenceGroupId: group.answerEquivalenceGroupId
      });
    }
    if (group.review?.status !== HOLDOUT_QUALITY_GATE_STATUS
      || group.review?.humanValidated !== false
      || group.review?.reviewerRoleA !== 'UNASSIGNED_PER_LANGUAGE_STRATUM'
      || group.review?.reviewerRoleB !== 'UNASSIGNED_PER_LANGUAGE_STRATUM'
      || group.review?.languageCompetenceRequired !== true
      || group.review?.samePhysicalReviewerForBothRolesAllowed !== false
      || group.review?.adjudication !== 'BLOCKED_WAITING_FOR_BOTH') {
      add(errors, 'EQUIVALENCE_REVIEW_PREMATURELY_COMPLETED', {
        answerEquivalenceGroupId: group.answerEquivalenceGroupId
      });
    }
    const payload = {
      answerEquivalenceGroupId: group.answerEquivalenceGroupId,
      entryIds: group.entryIds,
      preferredEntryId: group.preferredEntryId,
      businessRationale: group.businessRationale,
      preferredRuleVersion: group.preferredRuleVersion,
      snapshotVersion: group.snapshotVersion
    };
    if (group.candidateFingerprint !== fingerprint(payload)) {
      add(errors, 'EQUIVALENCE_CANDIDATE_FINGERPRINT_MISMATCH', {
        answerEquivalenceGroupId: group.answerEquivalenceGroupId
      });
    }
  }
}

function validateEquivalenceDossiers(snapshot, structure, errors) {
  const entryById = new Map(snapshot.entries.map(entry => [entry.entryId, entry]));
  const dossiers = structure.equivalenceReviewDossiers ?? [];
  if (dossiers.length !== 5) add(errors, 'EQUIVALENCE_DOSSIER_COUNT_MISMATCH', { actual: dossiers.length });
  const seenIds = new Set();
  for (const dossier of dossiers) {
    if (!dossier.dossierId || seenIds.has(dossier.dossierId)) {
      add(errors, 'INVALID_OR_DUPLICATE_EQUIVALENCE_DOSSIER_ID', { dossierId: dossier.dossierId ?? null });
    }
    seenIds.add(dossier.dossierId);
    if (dossier.judgmentsIncluded !== false || !dossier.reviewInstruction
      || !Array.isArray(dossier.comparisonEntryIds) || dossier.comparisonEntryIds.length < 2
      || !Array.isArray(dossier.canonicalKnowledge)
      || dossier.canonicalKnowledge.length !== dossier.comparisonEntryIds.length) {
      add(errors, 'INVALID_EQUIVALENCE_DOSSIER_STRUCTURE', { dossierId: dossier.dossierId ?? null });
      continue;
    }
    const dossierIds = dossier.canonicalKnowledge.map(item => item.entryId);
    if (JSON.stringify(dossierIds) !== JSON.stringify(dossier.comparisonEntryIds)) {
      add(errors, 'EQUIVALENCE_DOSSIER_ENTRY_ORDER_MISMATCH', { dossierId: dossier.dossierId });
    }
    for (const item of dossier.canonicalKnowledge) {
      const source = entryById.get(item.entryId);
      if (!source || item.canonicalQuestion !== source.question || item.canonicalAnswer !== source.answer) {
        add(errors, 'EQUIVALENCE_DOSSIER_CANONICAL_TEXT_MISMATCH', {
          dossierId: dossier.dossierId,
          entryId: item.entryId
        });
      }
      const forbiddenDecisionKeys = Object.keys(item).filter(key => /decision|judg|preferred|group|label|gold|score|prediction/i.test(key));
      if (forbiddenDecisionKeys.length > 0) {
        add(errors, 'EQUIVALENCE_DOSSIER_PREFILLED_JUDGMENT', {
          dossierId: dossier.dossierId,
          keys: forbiddenDecisionKeys
        });
      }
    }
  }

  const expectedComparisons = [
    ['equinoxe-q001', 'equinoxe-q002'],
    ['equinoxe-q019', 'equinoxe-q053'],
    ['equinoxe-q050', 'equinoxe-q051', 'equinoxe-q099'],
    ['equinoxe-q066', 'equinoxe-q069'],
    ['equinoxe-q078', 'equinoxe-q085']
  ];
  if (JSON.stringify(dossiers.map(item => item.comparisonEntryIds)) !== JSON.stringify(expectedComparisons)) {
    add(errors, 'EQUIVALENCE_DOSSIER_SCOPE_MISMATCH');
  }
}

function validateSemanticNeighbourAudit(snapshot, structure, errors) {
  const audit = structure.semanticNeighbourAudit;
  if (!audit || audit.status !== 'COMPLETED_CURATOR_ONLY_PENDING_HUMAN_GRAPH_REVIEW'
    || audit.runtime?.device !== 'cpu' || audit.runtime?.strictOffline !== true
    || audit.runtime?.downloadPerformed !== false
    || audit.source?.snapshotSha256 !== structure.canonicalSource.snapshotSha256
    || audit.source?.entryCount !== 112 || audit.source?.representation !== 'canonicalQuestion'
    || audit.model?.modelId !== 'sentence-transformers/distiluse-base-multilingual-cased-v2'
    || !/^[a-f0-9]{40}$/.test(audit.model?.revision ?? '')
    || !/^[a-f0-9]{64}$/.test(audit.model?.artifactFingerprint ?? '')) {
    add(errors, 'SEMANTIC_NEIGHBOUR_AUDIT_METADATA_INVALID');
    return;
  }
  if (audit.auditFingerprint !== fingerprint(withoutField(audit, 'auditFingerprint'))) {
    add(errors, 'SEMANTIC_NEIGHBOUR_AUDIT_FINGERPRINT_MISMATCH');
  }
  for (const [flag, value] of Object.entries(audit.prohibitions ?? {})) {
    if (value !== false) add(errors, 'SEMANTIC_NEIGHBOUR_AUDIT_PROHIBITION_BREACH', { flag });
  }
  const knownIds = new Set(snapshot.entries.map(entry => entry.entryId));
  const clusterByEntryId = new Map(
    (structure.knowledgeClusters ?? []).flatMap(cluster => cluster.entryIds.map(entryId => [entryId, cluster.knowledgeClusterId]))
  );
  if (audit.crossClusterSignalsAtOrAbove065?.length !== 16) {
    add(errors, 'SEMANTIC_CROSS_CLUSTER_SIGNAL_COUNT_MISMATCH');
  }
  for (const signal of audit.crossClusterSignalsAtOrAbove065 ?? []) {
    if (!Array.isArray(signal.entryIds) || signal.entryIds.length !== 2
      || signal.entryIds.some(entryId => !knownIds.has(entryId))
      || !(signal.cosineSimilarity >= 0.65 && signal.cosineSimilarity <= 1)) {
      add(errors, 'INVALID_SEMANTIC_NEIGHBOUR_SIGNAL', { entryIds: signal.entryIds ?? null });
      continue;
    }
    if (clusterByEntryId.get(signal.entryIds[0]) === clusterByEntryId.get(signal.entryIds[1])) {
      add(errors, 'SEMANTIC_SIGNAL_NOT_CROSS_CLUSTER', { entryIds: signal.entryIds });
    }
  }
  if (audit.candidateEquivalencePairDiagnostics?.length !== 7) {
    add(errors, 'SEMANTIC_EQUIVALENCE_DIAGNOSTIC_COUNT_MISMATCH');
  }
}

function validateSourceAnomalies(structure, errors) {
  const byId = new Map((structure.sourceAnomalies ?? []).map(item => [item.anomalyId, item]));
  const locker = byId.get('locker-reservation-date-conflict');
  if (!locker
    || JSON.stringify(locker.snapshotEntryIds) !== JSON.stringify(['equinoxe-q035', 'equinoxe-q036', 'equinoxe-q039'])
    || locker.sourceEvidence?.length !== 4
    || new Set(locker.sourceEvidence.map(item => item.introducedByCommit)).size !== 1
    || locker.distinctBusinessTruthsSupported !== false
    || !locker.evolutionAssessment?.includes('No temporal evolution')
    || !locker.handling?.includes('silent normalisation')
    || locker.authoringPolicy?.exactDateCasesAllowedBeforeAdjudication !== false
    || locker.authoringPolicy?.genericDateNeutralCasesAllowedConditionally !== true
    || !locker.authoringPolicy?.genericCaseCondition?.includes('gold must remain identical')
    || locker.authoringPolicy?.adjudicationStatus !== HOLDOUT_QUALITY_GATE_STATUS) {
    add(errors, 'LOCKER_DATE_ANOMALY_NOT_RESOLVED_METHODICALLY');
  }
  const mixed = byId.get('prior-mixed-intent-label-conflict');
  if (!mixed || mixed.priorCaseIds?.verifierNotCovered?.length !== 10
    || mixed.priorCaseIds?.nliAmbiguous?.length !== 16
    || !mixed.v0Rule?.includes('notCovered') || !mixed.v0Rule?.includes('ambiguous')
    || !mixed.handling?.includes('never import a prior label')) {
    add(errors, 'MIXED_INTENT_ANOMALY_NOT_RESOLVED_METHODICALLY');
  }
}

function validateClusters(snapshot, structure, errors) {
  const knownIds = new Set(snapshot.entries.map(entry => entry.entryId));
  const clusterByEntryId = new Map();
  const clusterIds = new Set();
  const actualSplitCounts = Object.fromEntries(SPLITS.map(split => [split, 0]));

  for (const cluster of structure.knowledgeClusters ?? []) {
    if (!cluster.knowledgeClusterId || clusterIds.has(cluster.knowledgeClusterId)) {
      add(errors, 'INVALID_OR_DUPLICATE_CLUSTER_ID', { knowledgeClusterId: cluster.knowledgeClusterId });
      continue;
    }
    clusterIds.add(cluster.knowledgeClusterId);
    if (!SPLITS.includes(cluster.splitReservation)) {
      add(errors, 'INVALID_CLUSTER_SPLIT', { knowledgeClusterId: cluster.knowledgeClusterId });
    } else {
      actualSplitCounts[cluster.splitReservation] += cluster.entryIds?.length ?? 0;
    }
    if (!Array.isArray(cluster.entryIds) || cluster.entryIds.length === 0 || !cluster.businessRationale) {
      add(errors, 'INCOMPLETE_CLUSTER_CANDIDATE', { knowledgeClusterId: cluster.knowledgeClusterId });
      continue;
    }
    for (const entryId of cluster.entryIds) {
      if (!knownIds.has(entryId)) add(errors, 'UNKNOWN_CLUSTER_ENTRY_ID', { entryId });
      if (clusterByEntryId.has(entryId)) {
        add(errors, 'ENTRY_IN_MULTIPLE_CLUSTERS', {
          entryId,
          knowledgeClusterIds: [clusterByEntryId.get(entryId), cluster.knowledgeClusterId]
        });
      }
      clusterByEntryId.set(entryId, cluster.knowledgeClusterId);
    }
    if (cluster.graphReview?.status !== HOLDOUT_QUALITY_GATE_STATUS
      || cluster.graphReview?.humanValidated !== false
      || cluster.graphReview?.reviewerRoleA !== 'UNASSIGNED_PER_LANGUAGE_STRATUM'
      || cluster.graphReview?.reviewerRoleB !== 'UNASSIGNED_PER_LANGUAGE_STRATUM') {
      add(errors, 'CLUSTER_REVIEW_PREMATURELY_COMPLETED', { knowledgeClusterId: cluster.knowledgeClusterId });
    }
    const payload = {
      knowledgeClusterId: cluster.knowledgeClusterId,
      entryIds: cluster.entryIds,
      splitReservation: cluster.splitReservation,
      businessRationale: cluster.businessRationale
    };
    if (cluster.candidateFingerprint !== fingerprint(payload)) {
      add(errors, 'CLUSTER_CANDIDATE_FINGERPRINT_MISMATCH', {
        knowledgeClusterId: cluster.knowledgeClusterId
      });
    }
  }

  for (const entryId of knownIds) {
    if (!clusterByEntryId.has(entryId)) add(errors, 'ENTRY_WITHOUT_CLUSTER', { entryId });
  }
  for (const group of structure.answerEquivalenceGroups ?? []) {
    const groupClusterIds = new Set(group.entryIds.map(entryId => clusterByEntryId.get(entryId)));
    if (groupClusterIds.size !== 1 || groupClusterIds.has(undefined)) {
      add(errors, 'EQUIVALENCE_GROUP_SPLIT_ACROSS_CLUSTERS', {
        answerEquivalenceGroupId: group.answerEquivalenceGroupId,
        knowledgeClusterIds: [...groupClusterIds]
      });
    }
  }

  if (JSON.stringify(actualSplitCounts) !== JSON.stringify(structure.knowledgePartition.reservedEntryCounts)) {
    add(errors, 'RESERVED_SPLIT_COUNT_MISMATCH', {
      declared: structure.knowledgePartition.reservedEntryCounts,
      actual: actualSplitCounts
    });
  }
  if (sum(Object.values(actualSplitCounts)) !== 112) add(errors, 'PARTITION_DOES_NOT_COVER_112_ENTRIES');
  if (structure.knowledgePartition.graphConstructionStatus !== 'PENDING_TWO_INDEPENDENT_HUMAN_REVIEWS'
    || structure.knowledgePartition.semanticNeighbourAuditStatus !== 'COMPLETED_CURATOR_ONLY_PENDING_HUMAN_GRAPH_REVIEW'
    || structure.knowledgePartition.curatorFlagsRequireHumanResolution !== true) {
    add(errors, 'KNOWLEDGE_GRAPH_STATUS_NOT_HONEST');
  }
}

function validateScenarioReservations(structure, errors) {
  const plan = structure.scenarioFamilyIdReservations;
  const expectedCapacity = { train: 900, development: 240, calibration: 240, holdout: 300 };
  const ids = new Set();
  for (const range of plan.ranges ?? []) {
    const calculatedCapacity = range.lastOrdinal - range.firstOrdinal + 1;
    if (calculatedCapacity !== range.reservedIdCapacity
      || range.reservedIdCapacity !== expectedCapacity[range.split]) {
      add(errors, 'INVALID_SCENARIO_FAMILY_RANGE', { split: range.split });
    }
    for (let ordinal = range.firstOrdinal; ordinal <= range.lastOrdinal; ordinal += 1) {
      const id = `storm-tsaf-v1-${range.splitCode}-${String(ordinal).padStart(4, '0')}`;
      if (ids.has(id)) add(errors, 'DUPLICATE_SCENARIO_FAMILY_ID_RESERVATION', { scenarioFamilyId: id });
      ids.add(id);
    }
  }
  if (ids.size !== 1680) add(errors, 'SCENARIO_FAMILY_ID_CAPACITY_MISMATCH', { actual: ids.size });
  if (plan.generationAuthorized !== false || plan.semanticBindingsCreated === true) {
    add(errors, 'SCENARIO_GENERATION_PREMATURELY_AUTHORISED');
  }
  const expectedMinimumFamilies = { train: 113, development: 30, calibration: 30, holdout: 38, total: 211 };
  const expectedDiversityFloor = { train: 129, development: 35, calibration: 35, holdout: 43, total: 242 };
  if (plan.maximumQueryCasesPerScenarioFamily !== 8
    || plan.candidatePairsConsumeFamilyCap !== false
    || JSON.stringify(plan.minimumDistinctFamiliesAtFullComposition) !== JSON.stringify(expectedMinimumFamilies)
    || JSON.stringify(plan.diversityFloorForAverageAtMostSeven) !== JSON.stringify(expectedDiversityFloor)
    || plan.maximumShareOfCorpusPerFamily !== 8 / 1680
    || plan.formerMaximumQueryCasesPerScenarioFamily !== 4
    || plan.formerMinimumDistinctFamiliesRejected?.total !== 420) {
    add(errors, 'INVALID_SCENARIO_FAMILY_CAP_POLICY');
  }
}

function validateComposition(composition, structure, errors) {
  const actualLanguageTotals = Object.fromEntries(LANGUAGES.map(language => [language, 0]));
  for (const split of SPLITS) {
    const volumes = composition.splitVolumes?.[split];
    if (!volumes || sum(OUTCOMES.map(outcome => volumes[outcome])) !== volumes.total) {
      add(errors, 'SPLIT_OUTCOME_TOTAL_MISMATCH', { split });
      continue;
    }
    for (const outcome of OUTCOMES) {
      const categoryTotal = sum(
        Object.values(composition.primaryCategoryVolumes?.[outcome] ?? {})
          .map(counts => counts[split])
      );
      if (categoryTotal !== volumes[outcome]) {
        add(errors, 'PRIMARY_CATEGORY_TOTAL_MISMATCH', { split, outcome, expected: volumes[outcome], actual: categoryTotal });
      }
      const languageCounts = composition.languageVolumesBySplitAndOutcome?.[split]?.[outcome];
      if (!languageCounts || JSON.stringify(Object.keys(languageCounts)) !== JSON.stringify(LANGUAGES)
        || LANGUAGES.some(language => !Number.isInteger(languageCounts[language]) || languageCounts[language] <= 0)
        || sum(LANGUAGES.map(language => languageCounts[language])) !== volumes[outcome]) {
        add(errors, 'LANGUAGE_VOLUME_MISMATCH', { split, outcome });
      } else {
        for (const language of LANGUAGES) actualLanguageTotals[language] += languageCounts[language];
      }
    }
  }

  if (sum(SPLITS.map(split => composition.splitVolumes?.[split]?.total ?? 0)) !== 1680) {
    add(errors, 'TOTAL_QUERY_VOLUME_MISMATCH');
  }
  const expectedSplitVolumes = {
    train: { covered: 526, notCovered: 350, ambiguous: 24, total: 900 },
    development: { covered: 110, notCovered: 110, ambiguous: 20, total: 240 },
    calibration: { covered: 112, notCovered: 112, ambiguous: 16, total: 240 },
    holdout: { covered: 140, notCovered: 140, ambiguous: 20, total: 300 }
  };
  if (JSON.stringify(composition.splitVolumes) !== JSON.stringify(expectedSplitVolumes)) {
    add(errors, 'AUDITED_SPLIT_CLASS_VOLUME_MISMATCH');
  }
  const holdout = composition.splitVolumes?.holdout;
  if (holdout?.covered !== 140 || holdout?.notCovered !== 140 || holdout?.ambiguous !== 20
    || holdout?.total !== 300) {
    add(errors, 'HOLDOUT_CLASS_VOLUME_MISMATCH');
  }

  if (JSON.stringify(actualLanguageTotals) !== JSON.stringify(EXPECTED_LANGUAGE_TOTALS)
    || JSON.stringify(composition.languagePolicy?.corpusTargets)
      !== JSON.stringify({ ...EXPECTED_LANGUAGE_TOTALS, total: 1680 })
    || JSON.stringify(composition.languagePolicy?.languages) !== JSON.stringify(LANGUAGES)
    || composition.languagePolicy?.everyLanguageRequiredPerSplitOutcome !== true
    || composition.languagePolicy?.languagesForcedPerPrimaryMicroCategory !== false
    || composition.languagePolicy?.minimumLanguagesPerPrimaryCategoryAcrossCorpus !== 3
    || composition.languagePolicy?.nativeAuthoringRequired !== true
    || composition.languagePolicy?.mechanicalTranslationAllowed !== false
    || composition.languagePolicy?.reviewerRoleAssignedPerLanguageStratum !== true
    || composition.languagePolicy?.reviewerLanguageCompetenceRequired !== true) {
    add(errors, 'CORPUS_LANGUAGE_POLICY_MISMATCH', { actualLanguageTotals });
  }

  const dangerous = composition.dangerousOpportunityReviewSlots?.holdout;
  if (!dangerous || dangerous.coveredWrongGroupRisk < 10 || dangerous.notCovered < 40
    || dangerous.ambiguous < 10 || dangerous.total < 60
    || dangerous.total !== dangerous.coveredWrongGroupRisk + dangerous.notCovered + dangerous.ambiguous) {
    add(errors, 'HOLDOUT_DANGEROUS_REVIEW_SLOT_MISMATCH');
  }
  for (const split of SPLITS) {
    const slots = composition.dangerousOpportunityReviewSlots?.[split];
    const volumes = composition.splitVolumes?.[split];
    if (!slots || slots.total !== slots.coveredWrongGroupRisk + slots.notCovered + slots.ambiguous
      || slots.coveredWrongGroupRisk > volumes.covered
      || slots.notCovered > volumes.notCovered
      || slots.ambiguous > volumes.ambiguous) {
      add(errors, 'DANGEROUS_REVIEW_SLOT_EXCEEDS_OUTCOME', { split });
    }
  }

  const floors = composition.candidateLevelFloors;
  for (const split of SPLITS) {
    const expected = composition.splitVolumes[split].covered + (2 * composition.splitVolumes[split].ambiguous);
    if (floors.coveredAnswerGroupOccurrences[split] !== expected) {
      add(errors, 'COVERED_CANDIDATE_FLOOR_MISMATCH', { split, expected });
    }
  }
  if (floors.coveredAnswerGroupOccurrences.total !== sum(SPLITS.map(split => floors.coveredAnswerGroupOccurrences[split]))) {
    add(errors, 'COVERED_ANSWER_GROUP_TOTAL_MISMATCH');
  }
  if (floors.trainHardNegativeGroupOccurrences.minimum !== 2 * floors.coveredAnswerGroupOccurrences.train
    || floors.trainHardNegativeGroupOccurrences.unit !== '(query, hardNegativeAnswerEquivalenceGroupId)'
    || floors.trainHardNegativeGroupOccurrences.multiEntryAliasInflatesQuota !== false) {
    add(errors, 'TRAIN_HARD_NEGATIVE_FLOOR_MISMATCH');
  }

  const scenario = composition.scenarioFamilyPlanning;
  if (scenario.maximumQueryCasesPerFamily !== 8 || scenario.candidatePairsConsumeCap !== false
    || scenario.maximumCorpusShareOfOneFamily !== 8 / 1680
    || scenario.ambiguityCapacityPlanningCasesPerFamily !== 4
    || JSON.stringify(scenario.diversityFloorForAverageAtMostSeven)
      !== JSON.stringify({ train: 129, development: 35, calibration: 35, holdout: 43, total: 242 })
    || JSON.stringify(scenario.querySlotsRequiringDistinctFamiliesAtCap)
      !== JSON.stringify({ train: 113, development: 30, calibration: 30, holdout: 38, total: 211 })) {
    add(errors, 'COMPOSITION_SCENARIO_FAMILY_CAP_MISMATCH');
  }

  const capacity = composition.ambiguityCapacityAudit;
  const expectedCapacity = {
    train: { entries: 58, groups: 57, clusters: 4, pairs: 1596, within: 418, candidates: 8, prudent: 6, former: 150, recommended: 24 },
    development: { entries: 20, groups: 19, clusters: 2, pairs: 171, within: 93, candidates: 8, prudent: 5, former: 80, recommended: 20 },
    calibration: { entries: 12, groups: 11, clusters: 2, pairs: 55, within: 27, candidates: 6, prudent: 4, former: 80, recommended: 16 },
    holdout: { entries: 22, groups: 19, clusters: 3, pairs: 171, within: 85, candidates: 12, prudent: 5, former: 100, recommended: 20 }
  };
  const knownGroupIds = new Set((structure.answerEquivalenceGroups ?? []).map(group => group.answerEquivalenceGroupId));
  for (const split of SPLITS) {
    const audit = capacity?.splitAudits?.[split];
    const expected = expectedCapacity[split];
    const splitEntryIds = new Set(
      (structure.knowledgeClusters ?? [])
        .filter(cluster => cluster.splitReservation === split)
        .flatMap(cluster => cluster.entryIds)
    );
    const splitGroupCount = (structure.answerEquivalenceGroups ?? [])
      .filter(group => group.entryIds.some(entryId => splitEntryIds.has(entryId)))
      .length;
    const splitGroupIds = new Set(
      (structure.answerEquivalenceGroups ?? [])
        .filter(group => group.entryIds.some(entryId => splitEntryIds.has(entryId)))
        .map(group => group.answerEquivalenceGroupId)
    );
    const plausibleSets = audit?.plausibleCompetingGroupSets ?? [];
    if (!audit
      || audit.entryCount !== expected.entries
      || audit.answerEquivalenceGroupCount !== expected.groups
      || audit.entryCount !== splitEntryIds.size
      || audit.answerEquivalenceGroupCount !== splitGroupCount
      || audit.clustersWithMultipleNonEquivalentGroups !== expected.clusters
      || audit.clusterGroupCounts?.length !== expected.clusters
      || sum(audit.clusterGroupCounts ?? []) !== expected.groups
      || audit.totalPairCount !== expected.pairs
      || audit.withinClusterPairCount !== expected.within
      || audit.candidateDistinctFamilyCount !== expected.candidates
      || audit.prudentDistinctFamilyCount !== expected.prudent
      || plausibleSets.length !== expected.candidates
      || JSON.stringify(audit.mechanismTypesAvailable) !== JSON.stringify(capacity?.mechanismTypesRequired)
      || plausibleSets.some(item => !item.mechanismId
        || !capacity?.mechanismTypesRequired?.includes(item.mechanismType)
        || item.humanDecisionIncluded !== false
        || !Array.isArray(item.answerEquivalenceGroupIds)
        || item.answerEquivalenceGroupIds.length < 2
        || item.answerEquivalenceGroupIds.some(groupId => !knownGroupIds.has(groupId) || !splitGroupIds.has(groupId)))
      || audit.naiveAllPairCaseCapacityAtCap4 !== expected.pairs * 4
      || audit.naiveWithinClusterCaseCapacityAtCap4 !== expected.within * 4
      || audit.candidateCaseCapacityAtCap4 !== expected.candidates * 4
      || audit.prudentCaseCapacityAtCap4 !== expected.prudent * 4
      || audit.formerAmbiguousSlots !== expected.former
      || audit.recommendedAmbiguousSlots !== expected.recommended
      || audit.recommendedAmbiguousSlots !== composition.splitVolumes[split].ambiguous
      || audit.formerQuotaSupported !== false
      || audit.recommendationSupportedPendingHumanReview !== true) {
      add(errors, 'AMBIGUITY_CAPACITY_AUDIT_MISMATCH', { split });
    }
  }
  if (capacity?.planningCasesPerAmbiguityFamily !== 4
    || JSON.stringify(capacity?.mechanismTypesRequired)
      !== JSON.stringify(['underspecifiedReference', 'competingPublishedKnowledge', 'alternativeIntentReadings'])
    || capacity?.allFormerQuotasSupported !== false
    || capacity?.totalRecommendedAmbiguousSlots !== 80
    || capacity?.quotasRemainBlockedOnHumanStructureReview !== true) {
    add(errors, 'AMBIGUITY_CAPACITY_POLICY_MISMATCH');
  }

  const diversity = composition.scenarioFamilyDiversityAudit;
  const plausiblePlan = diversity?.plausiblePlanBySplitAndAnchorOutcome;
  if (diversity?.formerHardCap !== 4
    || diversity?.formerMinimumDistinctFamilies?.total !== 420
    || diversity?.formerHardCapSupported !== false
    || diversity?.plausibleIndependentFamilyRange?.minimum !== 230
    || diversity?.plausibleIndependentFamilyRange?.maximum !== 280
    || diversity?.planningCentreRange?.minimum !== 250
    || diversity?.planningCentreRange?.maximum !== 260
    || diversity?.recommendedHardCap !== 8
    || JSON.stringify(diversity?.minimumDistinctFamiliesAtRecommendedCap)
      !== JSON.stringify({ train: 113, development: 30, calibration: 30, holdout: 38, total: 211 })
    || JSON.stringify(diversity?.diversityFloorForAverageAtMostSeven)
      !== JSON.stringify({ train: 129, development: 35, calibration: 35, holdout: 43, total: 242 })
    || plausiblePlan?.total?.total !== 254
    || SPLITS.some(split => plausiblePlan?.[split]?.total
      !== plausiblePlan?.[split]?.covered + plausiblePlan?.[split]?.notCovered + plausiblePlan?.[split]?.ambiguous)
    || plausiblePlan?.total?.covered !== sum(SPLITS.map(split => plausiblePlan?.[split]?.covered ?? 0))
    || plausiblePlan?.total?.notCovered !== sum(SPLITS.map(split => plausiblePlan?.[split]?.notCovered ?? 0))
    || plausiblePlan?.total?.ambiguous !== sum(SPLITS.map(split => plausiblePlan?.[split]?.ambiguous ?? 0))
    || SPLITS.some(split => plausiblePlan?.[split]?.covered * 8 < composition.splitVolumes[split].covered
      || plausiblePlan?.[split]?.notCovered * 8 < composition.splitVolumes[split].notCovered
      || plausiblePlan?.[split]?.ambiguous * 4 < composition.splitVolumes[split].ambiguous)
    || diversity?.saturationGate?.maximumShareOfApprovedFamiliesAtHardCap !== 0.5
    || diversity?.saturationGate?.maximumCasesPerLanguageAndPrimaryCategoryWithinFamily !== 2
    || diversity?.modelOutputsUsed !== false
    || diversity?.humanDecisionIncluded !== false) {
    add(errors, 'SCENARIO_FAMILY_DIVERSITY_AUDIT_MISMATCH');
  }

  const reviewPolicy = composition.reviewPolicy;
  if (reviewPolicy?.reviewerAAndBAreRolesPerLanguageStratum !== true
    || reviewPolicy?.samePhysicalPeopleRequiredAcrossLanguages !== false
    || reviewPolicy?.calibrationAndHoldoutDoubleReviewRequired !== true
    || reviewPolicy?.trainAndDevelopmentPrimaryReviewRequired !== true
    || reviewPolicy?.trainAndDevelopmentSecondReviewExhaustive !== false
    || reviewPolicy?.peerJudgmentsVisible !== false
    || reviewPolicy?.modelInformationVisible !== false
    || reviewPolicy?.appendOnlyAdjudicationPreservesBothOriginals !== true
    || reviewPolicy?.structureDoubleReviewAndAdjudicationRequired !== true) {
    add(errors, 'HUMAN_REVIEW_POLICY_MISMATCH');
  }
  const workload = composition.reviewWorkload;
  const expectedAssignmentsByLanguage = Object.fromEntries(LANGUAGES.map(language => [
    language,
    sum(OUTCOMES.map(outcome => composition.languageVolumesBySplitAndOutcome.train[outcome][language]))
      + sum(OUTCOMES.map(outcome => composition.languageVolumesBySplitAndOutcome.development[outcome][language]))
      + 2 * sum(OUTCOMES.map(outcome => composition.languageVolumesBySplitAndOutcome.calibration[outcome][language]))
      + 2 * sum(OUTCOMES.map(outcome => composition.languageVolumesBySplitAndOutcome.holdout[outcome][language]))
  ]));
  const expectedMandatoryAssignments = {
    trainPrimary: composition.splitVolumes.train.total,
    developmentPrimary: composition.splitVolumes.development.total,
    calibrationDouble: 2 * composition.splitVolumes.calibration.total,
    holdoutDouble: 2 * composition.splitVolumes.holdout.total,
    total: 2220
  };
  const expectedTargetedDangerousCapacity = composition.dangerousOpportunityReviewSlots.train.total
    + composition.dangerousOpportunityReviewSlots.development.total;
  if (JSON.stringify(workload?.mandatoryQueryReviewAssignments) !== JSON.stringify(expectedMandatoryAssignments)
    || workload?.mandatoryAssignmentsByLanguage?.total !== 2220
    || LANGUAGES.some(language => workload?.mandatoryAssignmentsByLanguage?.[language] !== expectedAssignmentsByLanguage[language])
    || sum(LANGUAGES.map(language => workload?.mandatoryAssignmentsByLanguage?.[language] ?? 0)) !== 2220
    || workload?.targetedSecondReview?.exhaustiveForTrainOrDevelopment !== false
    || workload?.targetedSecondReview?.dangerousSlotCapacityIfAllSelected !== expectedTargetedDangerousCapacity
    || workload?.targetedSecondReview?.resultingAssignmentCountIfAllDangerousSlotsSelected
      !== 2220 + expectedTargetedDangerousCapacity
    || workload?.structureReview?.independentHumanReviews !== 2
    || workload?.structureReview?.adjudicationRequired !== true) {
    add(errors, 'HUMAN_REVIEW_WORKLOAD_MISMATCH');
  }

  if (composition.generationAuthorized !== false || composition.formulationsIncluded !== false
    || composition.labelsIncluded !== false || composition.modelOutputsIncluded !== false
    || composition.automaticQualityGateStatus !== 'STRUCTURAL_OK'
    || composition.humanQualityGateStatus !== HOLDOUT_QUALITY_GATE_STATUS
    || composition.holdout?.status !== HOLDOUT_QUALITY_GATE_STATUS
    || composition.holdout?.executable !== false || composition.holdout?.contentCreated !== false) {
    add(errors, 'COMPOSITION_PREMATURELY_EXECUTABLE_OR_LABELLED');
  }
  if (composition.proposalFingerprint !== fingerprint(withoutField(composition, 'proposalFingerprint'))) {
    add(errors, 'COMPOSITION_FINGERPRINT_MISMATCH');
  }
}

export function validateCandidateCorpusQualityGate({ snapshotBytes, snapshot, structure, composition }) {
  const errors = [];
  if (structure.status !== CANDIDATE_STRUCTURE_STATUS
    || structure.holdoutQualityGateStatus !== HOLDOUT_QUALITY_GATE_STATUS
    || structure.generationAuthorized !== false) {
    add(errors, 'INVALID_CANDIDATE_STRUCTURE_STATUS');
  }

  validateSnapshot(snapshotBytes, snapshot, structure, errors);
  validateEquivalence(snapshot, structure, errors);
  validateEquivalenceDossiers(snapshot, structure, errors);
  validateClusters(snapshot, structure, errors);
  validateSemanticNeighbourAudit(snapshot, structure, errors);
  validateSourceAnomalies(structure, errors);
  validateScenarioReservations(structure, errors);
  validateComposition(composition, structure, errors);

  for (const hit of collectForbiddenFields({ structure, composition })) {
    add(errors, 'PREFILLED_CASE_OR_MODEL_FIELD', hit);
  }
  for (const source of structure.priorObservedCorpora ?? []) {
    if (source.holdoutPermitted !== false || source.priorLabelsReusable !== false
      || source.permittedSplits.includes('holdout')) {
      add(errors, 'OBSERVED_CORPUS_CAN_CONTAMINATE_HOLDOUT', { provenanceId: source.provenanceId });
    }
  }
  if (structure.structureFingerprint !== fingerprint(withoutField(structure, 'structureFingerprint'))) {
    add(errors, 'STRUCTURE_FINGERPRINT_MISMATCH');
  }

  return {
    ok: errors.length === 0,
    status: errors.length === 0 ? 'STRUCTURAL_OK' : 'STRUCTURAL_FAILURE',
    humanReviewStatus: HOLDOUT_QUALITY_GATE_STATUS,
    generationAuthorized: false,
    errors
  };
}

export function assertCandidateCorpusQualityGate(input) {
  const result = validateCandidateCorpusQualityGate(input);
  if (!result.ok) {
    const error = new Error(`Candidate corpus Quality Gate failed with ${result.errors.length} error(s)`);
    error.details = result.errors;
    throw error;
  }
  return result;
}
