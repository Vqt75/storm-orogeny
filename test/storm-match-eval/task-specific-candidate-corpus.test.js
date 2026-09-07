import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { answerabilityHoldoutCases } from './answerability-nli/holdout-corpus.js';
import { evaluationCases } from './evaluation-corpus.js';
import {
  ANSWER_EQUIVALENCE_GROUPS,
  CANDIDATE_CORPUS_STRUCTURE,
  CANONICAL_ENTRY_PROVENANCE,
  EQUIVALENCE_REVIEW_DOSSIERS,
  KNOWLEDGE_CLUSTERS,
  PRIOR_OBSERVED_CORPORA,
  SEMANTIC_NEIGHBOUR_AUDIT,
  SOURCE_ANOMALIES
} from './task-specific/candidate-corpus-structure.js';
import { CANDIDATE_CORPUS_COMPOSITION } from './task-specific/candidate-corpus-composition.js';
import { validateCandidateCorpusQualityGate } from './task-specific/candidate-corpus-quality-gate.js';
import { decisionCases } from './verifier/decision-corpus.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const snapshotBytes = readFileSync(join(HERE, 'equinoxe-corpus.snapshot.json'));
const snapshot = JSON.parse(snapshotBytes);

function validate(structure = CANDIDATE_CORPUS_STRUCTURE, composition = CANDIDATE_CORPUS_COMPOSITION) {
  return validateCandidateCorpusQualityGate({ snapshotBytes, snapshot, structure, composition });
}

test('candidate corpus structure passes its static pre-annotation Quality Gate', () => {
  assert.deepEqual(validate(), {
    ok: true,
    status: 'STRUCTURAL_OK',
    humanReviewStatus: 'PENDING_HUMAN_REVIEW',
    generationAuthorized: false,
    errors: []
  });
  assert.equal(snapshot.entries.length, 112);
  assert.equal(CANONICAL_ENTRY_PROVENANCE.length, 112);
  assert.equal(ANSWER_EQUIVALENCE_GROUPS.length, 106);
  assert.equal(EQUIVALENCE_REVIEW_DOSSIERS.length, 5);
  assert.equal(KNOWLEDGE_CLUSTERS.length, 11);
  assert.deepEqual(CANDIDATE_CORPUS_STRUCTURE.knowledgePartition.reservedEntryCounts, {
    train: 58,
    development: 20,
    calibration: 12,
    holdout: 22
  });
});

test('proposal contains no query, annotation, gold, model output or executable holdout', () => {
  const serialised = JSON.stringify({
    structure: CANDIDATE_CORPUS_STRUCTURE,
    composition: CANDIDATE_CORPUS_COMPOSITION
  });
  for (const forbidden of [
    '"query":',
    '"formulation":',
    '"expectedEntryId":',
    '"expectedSystemOutcome":',
    '"goldCoveredCandidateIds":',
    '"candidatePairs":',
    '"score":',
    '"probability":',
    '"prediction":',
    '"modelOutput":'
  ]) {
    assert.equal(serialised.includes(forbidden), false, `unexpected prefilled field ${forbidden}`);
  }
  assert.equal(CANDIDATE_CORPUS_STRUCTURE.generationAuthorized, false);
  assert.equal(CANDIDATE_CORPUS_COMPOSITION.holdout.contentCreated, false);
  assert.equal(CANDIDATE_CORPUS_COMPOSITION.holdout.executable, false);
});

test('static gate detects an equivalence overlap and a cluster split', () => {
  const tampered = structuredClone(CANDIDATE_CORPUS_STRUCTURE);
  const sourceGroup = tampered.answerEquivalenceGroups.find(group => group.entryIds.includes('equinoxe-q001'));
  const targetGroup = tampered.answerEquivalenceGroups.find(group => group.entryIds.includes('equinoxe-q003'));
  targetGroup.entryIds.push('equinoxe-q001');
  targetGroup.preferredEntryId = 'equinoxe-q001';
  const q001Cluster = tampered.knowledgeClusters.find(cluster => cluster.entryIds.includes('equinoxe-q001'));
  const q002Cluster = tampered.knowledgeClusters.find(cluster => cluster.entryIds.includes('equinoxe-q002'));
  q002Cluster.entryIds = q002Cluster.entryIds.filter(entryId => entryId !== 'equinoxe-q002');
  const otherCluster = tampered.knowledgeClusters.find(cluster => cluster.knowledgeClusterId !== q001Cluster.knowledgeClusterId);
  otherCluster.entryIds.push('equinoxe-q002');

  const result = validate(tampered);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.code === 'EQUIVALENCE_ENTRY_IN_MULTIPLE_GROUPS'));
  assert.ok(result.errors.some(error => error.code === 'EQUIVALENCE_GROUP_SPLIT_ACROSS_CLUSTERS'));
  assert.ok(sourceGroup);
});

test('static gate detects premature review completion and forbidden case content', () => {
  const tampered = structuredClone(CANDIDATE_CORPUS_STRUCTURE);
  tampered.answerEquivalenceGroups[0].review.humanValidated = true;
  tampered.generatedCase = {
    query: 'This text must never exist at the structural stage.',
    expectedSystemOutcome: 'covered',
    modelOutput: { score: 1 }
  };

  const result = validate(tampered);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.code === 'EQUIVALENCE_REVIEW_PREMATURELY_COMPLETED'));
  assert.ok(result.errors.some(error => error.code === 'PREFILLED_CASE_OR_MODEL_FIELD' && error.key === 'query'));
  assert.ok(result.errors.some(error => error.code === 'PREFILLED_CASE_OR_MODEL_FIELD' && error.key === 'modelOutput'));
});

test('composition gate detects quota, language and dangerous-opportunity drift', () => {
  const tampered = structuredClone(CANDIDATE_CORPUS_COMPOSITION);
  tampered.primaryCategoryVolumes.covered.naturalParaphrase.holdout -= 1;
  tampered.languageVolumesBySplitAndOutcome.holdout.covered.nl = 0;
  tampered.dangerousOpportunityReviewSlots.holdout.notCovered = 39;

  const result = validate(CANDIDATE_CORPUS_STRUCTURE, tampered);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.code === 'PRIMARY_CATEGORY_TOTAL_MISMATCH'));
  assert.ok(result.errors.some(error => error.code === 'LANGUAGE_VOLUME_MISMATCH'));
  assert.ok(result.errors.some(error => error.code === 'HOLDOUT_DANGEROUS_REVIEW_SLOT_MISMATCH'));
});

test('six-language quotas, review workload and audited family cap are exact', () => {
  assert.deepEqual(CANDIDATE_CORPUS_COMPOSITION.languagePolicy.languages, ['fr', 'en', 'de', 'es', 'it', 'nl']);
  assert.deepEqual(CANDIDATE_CORPUS_COMPOSITION.languagePolicy.corpusTargets, {
    fr: 942,
    en: 204,
    de: 168,
    es: 132,
    it: 132,
    nl: 102,
    total: 1680
  });
  assert.deepEqual(CANDIDATE_CORPUS_COMPOSITION.splitVolumes.holdout, {
    covered: 140,
    notCovered: 140,
    ambiguous: 20,
    total: 300
  });
  assert.deepEqual(CANDIDATE_CORPUS_COMPOSITION.splitVolumes.train, {
    covered: 526,
    notCovered: 350,
    ambiguous: 24,
    total: 900
  });
  assert.deepEqual(CANDIDATE_CORPUS_COMPOSITION.splitVolumes.development, {
    covered: 110,
    notCovered: 110,
    ambiguous: 20,
    total: 240
  });
  assert.deepEqual(CANDIDATE_CORPUS_COMPOSITION.splitVolumes.calibration, {
    covered: 112,
    notCovered: 112,
    ambiguous: 16,
    total: 240
  });
  assert.equal(CANDIDATE_CORPUS_COMPOSITION.reviewWorkload.mandatoryQueryReviewAssignments.total, 2220);
  assert.equal(CANDIDATE_CORPUS_COMPOSITION.reviewWorkload.targetedSecondReview.exhaustiveForTrainOrDevelopment, false);
  assert.equal(CANDIDATE_CORPUS_COMPOSITION.scenarioFamilyPlanning.maximumQueryCasesPerFamily, 8);
  assert.equal(CANDIDATE_CORPUS_COMPOSITION.scenarioFamilyPlanning.querySlotsRequiringDistinctFamiliesAtCap.total, 211);
  assert.equal(CANDIDATE_CORPUS_COMPOSITION.scenarioFamilyPlanning.diversityFloorForAverageAtMostSeven.total, 242);
});

test('hard-negative quota counts answer groups rather than multi-entry aliases', () => {
  const floors = CANDIDATE_CORPUS_COMPOSITION.candidateLevelFloors;
  assert.deepEqual(floors.coveredAnswerGroupOccurrences, {
    train: 574,
    development: 150,
    calibration: 144,
    holdout: 180,
    total: 1048,
    derivation: floors.coveredAnswerGroupOccurrences.derivation
  });
  assert.equal(floors.trainHardNegativeGroupOccurrences.minimum, 1148);
  assert.equal(floors.trainHardNegativeGroupOccurrences.multiEntryAliasInflatesQuota, false);
});

test('ambiguity capacity audit rejects every old quota and keeps authoring blocked', () => {
  const audit = CANDIDATE_CORPUS_COMPOSITION.ambiguityCapacityAudit;
  assert.deepEqual(
    Object.fromEntries(Object.entries(audit.splitAudits).map(([split, item]) => [split, item.recommendedAmbiguousSlots])),
    { train: 24, development: 20, calibration: 16, holdout: 20 }
  );
  assert.deepEqual(
    Object.fromEntries(Object.entries(audit.splitAudits).map(([split, item]) => [split, item.prudentDistinctFamilyCount])),
    { train: 6, development: 5, calibration: 4, holdout: 5 }
  );
  assert.equal(audit.allFormerQuotasSupported, false);
  assert.equal(audit.totalRecommendedAmbiguousSlots, 80);
  assert.equal(CANDIDATE_CORPUS_COMPOSITION.generationAuthorized, false);
});

test('scenario diversity audit rejects cap four without inventing family bindings', () => {
  const audit = CANDIDATE_CORPUS_COMPOSITION.scenarioFamilyDiversityAudit;
  assert.equal(audit.formerHardCap, 4);
  assert.equal(audit.formerMinimumDistinctFamilies.total, 420);
  assert.equal(audit.formerHardCapSupported, false);
  assert.deepEqual(audit.plausibleIndependentFamilyRange, { minimum: 230, maximum: 280 });
  assert.equal(audit.plausiblePlanBySplitAndAnchorOutcome.total.total, 254);
  assert.equal(audit.recommendedHardCap, 8);
  assert.equal(audit.minimumDistinctFamiliesAtRecommendedCap.total, 211);
  assert.equal(audit.diversityFloorForAverageAtMostSeven.total, 242);
  assert.equal(audit.humanDecisionIncluded, false);
  assert.equal(CANDIDATE_CORPUS_STRUCTURE.scenarioFamilyIdReservations.semanticBindingsCreated, false);
});

test('curator semantic audit is offline, fingerprinted and cannot distribute model signals', () => {
  assert.equal(SEMANTIC_NEIGHBOUR_AUDIT.runtime.strictOffline, true);
  assert.equal(SEMANTIC_NEIGHBOUR_AUDIT.runtime.downloadPerformed, false);
  assert.equal(SEMANTIC_NEIGHBOUR_AUDIT.crossClusterSignalsAtOrAbove065.length, 16);
  assert.equal(SEMANTIC_NEIGHBOUR_AUDIT.candidateEquivalencePairDiagnostics.length, 7);
  assert.deepEqual(SEMANTIC_NEIGHBOUR_AUDIT.prohibitions, {
    labelsGenerated: false,
    equivalenceDecisionsGenerated: false,
    preferredEntryDecisionsGenerated: false,
    clusterDecisionsGenerated: false,
    trainingDataUseAllowed: false,
    calibrationOrHoldoutUseAllowed: false,
    reviewPacketDistributionAllowed: false,
    modelSelectionUseAllowed: false
  });
});

test('five equivalence dossiers reproduce canonical Q+A without a prefilled judgment', () => {
  const snapshotById = new Map(snapshot.entries.map(entry => [entry.entryId, entry]));
  for (const dossier of EQUIVALENCE_REVIEW_DOSSIERS) {
    assert.equal(dossier.judgmentsIncluded, false);
    for (const knowledge of dossier.canonicalKnowledge) {
      const source = snapshotById.get(knowledge.entryId);
      assert.equal(knowledge.canonicalQuestion, source.question);
      assert.equal(knowledge.canonicalAnswer, source.answer);
    }
  }
  assert.ok(EQUIVALENCE_REVIEW_DOSSIERS.some(dossier =>
    dossier.comparisonEntryIds.join(',') === 'equinoxe-q066,equinoxe-q069'));
});

test('locker-date and historical mixed-intent anomalies remain explicit', () => {
  const byId = new Map(SOURCE_ANOMALIES.map(item => [item.anomalyId, item]));
  const locker = byId.get('locker-reservation-date-conflict');
  assert.equal(locker.distinctBusinessTruthsSupported, false);
  assert.equal(new Set(locker.sourceEvidence.map(item => item.introducedByCommit)).size, 1);
  assert.equal(locker.authoringPolicy.exactDateCasesAllowedBeforeAdjudication, false);
  assert.equal(locker.authoringPolicy.genericDateNeutralCasesAllowedConditionally, true);
  assert.equal(locker.authoringPolicy.adjudicationStatus, 'PENDING_HUMAN_REVIEW');
  const mixed = byId.get('prior-mixed-intent-label-conflict');
  assert.equal(mixed.priorCaseIds.verifierNotCovered.length, 10);
  assert.equal(mixed.priorCaseIds.nliAmbiguous.length, 16);
  assert.match(mixed.v0Rule, /notCovered/);
});

test('prior observed corpus registry is complete and forbids label reuse in holdout', () => {
  assert.equal(evaluationCases.length, 320);
  assert.equal(decisionCases.length, 200);
  assert.equal(answerabilityHoldoutCases.length, 96);
  assert.deepEqual(
    PRIOR_OBSERVED_CORPORA.map(source => source.queryCaseCount),
    [320, 200, 96]
  );
  for (const source of PRIOR_OBSERVED_CORPORA) {
    assert.equal(source.holdoutPermitted, false);
    assert.equal(source.priorLabelsReusable, false);
    assert.equal(source.permittedSplits.includes('holdout'), false);
  }
});
