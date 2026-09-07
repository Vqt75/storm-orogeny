import { fingerprint } from './candidate-corpus-structure.js';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const SPLIT_VOLUMES = {
  train: { covered: 526, notCovered: 350, ambiguous: 24, total: 900 },
  development: { covered: 110, notCovered: 110, ambiguous: 20, total: 240 },
  calibration: { covered: 112, notCovered: 112, ambiguous: 16, total: 240 },
  holdout: { covered: 140, notCovered: 140, ambiguous: 20, total: 300 }
};

const PRIMARY_CATEGORY_VOLUMES = {
  covered: {
    naturalParaphrase: { train: 132, development: 28, calibration: 28, holdout: 35 },
    synonyms: { train: 105, development: 22, calibration: 22, holdout: 28 },
    differentVocab: { train: 131, development: 27, calibration: 28, holdout: 35 },
    adjacentButResolvable: { train: 105, development: 22, calibration: 23, holdout: 28 },
    otherRobustness: { train: 53, development: 11, calibration: 11, holdout: 14 }
  },
  notCovered: {
    mixedIntents: { train: 88, development: 28, calibration: 28, holdout: 35 },
    hardNegative: { train: 70, development: 22, calibration: 22, holdout: 28 },
    lexicalCollision: { train: 53, development: 17, calibration: 17, holdout: 21 },
    nearButUnpublished: { train: 52, development: 16, calibration: 17, holdout: 21 },
    falsePremise: { train: 52, development: 16, calibration: 17, holdout: 21 },
    clearOutOfCorpus: { train: 35, development: 11, calibration: 11, holdout: 14 }
  },
  ambiguous: {
    underspecifiedReference: { train: 10, development: 8, calibration: 6, holdout: 8 },
    competingPublishedKnowledge: { train: 8, development: 7, calibration: 6, holdout: 7 },
    alternativeIntentReadings: { train: 6, development: 5, calibration: 4, holdout: 5 }
  }
};

const LANGUAGE_VOLUMES_BY_SPLIT_AND_OUTCOME = {
  train: {
    covered: { fr: 295, en: 63, de: 53, es: 42, it: 42, nl: 31 },
    notCovered: { fr: 196, en: 42, de: 35, es: 28, it: 28, nl: 21 },
    ambiguous: { fr: 13, en: 3, de: 2, es: 2, it: 2, nl: 2 }
  },
  development: {
    covered: { fr: 62, en: 14, de: 11, es: 8, it: 8, nl: 7 },
    notCovered: { fr: 62, en: 14, de: 11, es: 8, it: 8, nl: 7 },
    ambiguous: { fr: 11, en: 2, de: 2, es: 2, it: 2, nl: 1 }
  },
  calibration: {
    covered: { fr: 63, en: 14, de: 11, es: 9, it: 8, nl: 7 },
    notCovered: { fr: 63, en: 14, de: 11, es: 8, it: 9, nl: 7 },
    ambiguous: { fr: 9, en: 2, de: 2, es: 1, it: 1, nl: 1 }
  },
  // The original 100/100/100 language totals are preserved at holdout level,
  // but redistributed over the capacity-audited 140/140/20 outcomes.
  holdout: {
    covered: { fr: 79, en: 17, de: 14, es: 11, it: 11, nl: 8 },
    notCovered: { fr: 78, en: 17, de: 14, es: 11, it: 11, nl: 9 },
    ambiguous: { fr: 11, en: 2, de: 2, es: 2, it: 2, nl: 1 }
  }
};

// These are review slots, not pre-labelled risk judgments. A slot rejected by
// human review must be replaced before a final dataset can be sealed.
const DANGEROUS_OPPORTUNITY_REVIEW_SLOTS = {
  train: { coveredWrongGroupRisk: 20, notCovered: 58, ambiguous: 12, total: 90 },
  development: { coveredWrongGroupRisk: 4, notCovered: 12, ambiguous: 8, total: 24 },
  calibration: { coveredWrongGroupRisk: 12, notCovered: 36, ambiguous: 12, total: 60 },
  holdout: { coveredWrongGroupRisk: 10, notCovered: 40, ambiguous: 10, total: 60 }
};

const REVIEW_WORKLOAD = {
  mandatoryQueryReviewAssignments: {
    trainPrimary: 900,
    developmentPrimary: 240,
    calibrationDouble: 480,
    holdoutDouble: 600,
    total: 2220
  },
  mandatoryAssignmentsByLanguage: {
    fr: 1245,
    en: 270,
    de: 222,
    es: 174,
    it: 174,
    nl: 135,
    total: 2220
  },
  targetedSecondReview: {
    exhaustiveForTrainOrDevelopment: false,
    selectionMustBePreRegisteredAndModelBlind: true,
    dangerousSlotCapacityIfAllSelected: 114,
    resultingAssignmentCountIfAllDangerousSlotsSelected: 2334,
    additionalContentiousAndQaAssignments: null,
    note: 'Train and development require one primary review; a second independent review may target pre-registered dangerous, contentious or QA cases.'
  },
  structureReview: {
    scope: ['answerEquivalenceGroups', 'preferredEntryIds', 'knowledgeGraph', 'knowledgeClusters'],
    independentHumanReviews: 2,
    adjudicationRequired: true,
    pairOrEdgeCountPending: true,
    includedInQueryAssignmentCounts: false
  }
};

const AMBIGUITY_MECHANISM_TYPES = [
  'underspecifiedReference',
  'competingPublishedKnowledge',
  'alternativeIntentReadings'
];

const ambiguitySet = (mechanismId, mechanismType, answerEquivalenceGroupIds, robustnessAssessment) => ({
  mechanismId,
  mechanismType,
  answerEquivalenceGroupIds,
  robustnessAssessment,
  humanDecisionIncluded: false
});

const AMBIGUITY_CAPACITY_AUDIT = {
  status: 'CAPACITY_AUDITED_PENDING_HUMAN_CONFIRMATION',
  assessmentRule: 'Combinatorial pairs are not business capacity. Counts use independent user situations after collapsing lexical, language and category variants.',
  planningCasesPerAmbiguityFamily: 4,
  mechanismTypesRequired: AMBIGUITY_MECHANISM_TYPES,
  splitAudits: {
    train: {
      entryCount: 58,
      answerEquivalenceGroupCount: 57,
      clusterGroupCounts: [14, 18, 7, 18],
      clustersWithMultipleNonEquivalentGroups: 4,
      totalPairCount: 1596,
      withinClusterPairCount: 418,
      plausibleCompetingGroupSets: [
        ambiguitySet('spatial-permanence', 'underspecifiedReference', ['eqx-aeg-010', 'eqx-aeg-012', 'eqx-aeg-014', 'eqx-aeg-015'], 'robust'),
        ambiguitySet('presence-procedure', 'competingPublishedKnowledge', ['eqx-aeg-018', 'eqx-aeg-021'], 'robust'),
        ambiguitySet('connection-meaning', 'alternativeIntentReadings', ['eqx-aeg-047', 'eqx-aeg-048'], 'robust'),
        ambiguitySet('accessibility-meaning', 'alternativeIntentReadings', ['eqx-aeg-067', 'eqx-aeg-054', 'eqx-aeg-055', 'eqx-aeg-059', 'eqx-aeg-074', 'eqx-aeg-101'], 'robust'),
        ambiguitySet('electric-charging-target', 'underspecifiedReference', ['eqx-aeg-038', 'eqx-aeg-100'], 'robust'),
        ambiguitySet('locker-referent', 'competingPublishedKnowledge', ['eqx-aeg-035', 'eqx-aeg-036', 'eqx-aeg-094', 'eqx-aeg-095', 'eqx-aeg-037', 'eqx-aeg-073'], 'robust_date_neutral_only'),
        ambiguitySet('preparation-milestone-scope', 'underspecifiedReference', ['eqx-aeg-003', 'eqx-aeg-004', 'eqx-aeg-005', 'eqx-aeg-007', 'eqx-aeg-108'], 'conditional'),
        ambiguitySet('workplace-adaptation-scope', 'alternativeIntentReadings', ['eqx-aeg-066', 'eqx-aeg-067', 'eqx-aeg-104'], 'conditional')
      ],
      candidateDistinctFamilyCount: 8,
      prudentDistinctFamilyCount: 6,
      mechanismTypesAvailable: AMBIGUITY_MECHANISM_TYPES,
      naiveAllPairCaseCapacityAtCap4: 6384,
      naiveWithinClusterCaseCapacityAtCap4: 1672,
      candidateCaseCapacityAtCap4: 32,
      prudentCaseCapacityAtCap4: 24,
      formerAmbiguousSlots: 150,
      recommendedAmbiguousSlots: 24,
      formerQuotaSupported: false,
      recommendationSupportedPendingHumanReview: true,
      exclusions: ['equinoxe-q039 exact-date scenarios remain quarantined pending source adjudication']
    },
    development: {
      entryCount: 20,
      answerEquivalenceGroupCount: 19,
      clusterGroupCounts: [13, 6],
      clustersWithMultipleNonEquivalentGroups: 2,
      totalPairCount: 171,
      withinClusterPairCount: 93,
      plausibleCompetingGroupSets: [
        ambiguitySet('restaurant-versus-terrace-capacity', 'underspecifiedReference', ['eqx-aeg-061', 'eqx-aeg-064'], 'robust'),
        ambiguitySet('cafe-purpose-offer-access', 'alternativeIntentReadings', ['eqx-aeg-032', 'eqx-aeg-063', 'eqx-aeg-093'], 'robust'),
        ambiguitySet('terrace-purpose', 'alternativeIntentReadings', ['eqx-aeg-032', 'eqx-aeg-064'], 'conditional'),
        ambiguitySet('restaurant-existence-versus-opening', 'competingPublishedKnowledge', ['eqx-aeg-060', 'eqx-aeg-065'], 'robust'),
        ambiguitySet('food-offer-scope', 'underspecifiedReference', ['eqx-aeg-062', 'eqx-aeg-102', 'eqx-aeg-103'], 'robust'),
        ambiguitySet('where-eating-is-allowed', 'competingPublishedKnowledge', ['eqx-aeg-064', 'eqx-aeg-072', 'eqx-aeg-092'], 'conditional'),
        ambiguitySet('presence-frequency-rule', 'competingPublishedKnowledge', ['eqx-aeg-041', 'eqx-aeg-043', 'eqx-aeg-096'], 'robust'),
        ambiguitySet('presence-authority-and-calendar', 'alternativeIntentReadings', ['eqx-aeg-040', 'eqx-aeg-042', 'eqx-aeg-043', 'eqx-aeg-044'], 'conditional')
      ],
      candidateDistinctFamilyCount: 8,
      prudentDistinctFamilyCount: 5,
      mechanismTypesAvailable: AMBIGUITY_MECHANISM_TYPES,
      naiveAllPairCaseCapacityAtCap4: 684,
      naiveWithinClusterCaseCapacityAtCap4: 372,
      candidateCaseCapacityAtCap4: 32,
      prudentCaseCapacityAtCap4: 20,
      formerAmbiguousSlots: 80,
      recommendedAmbiguousSlots: 20,
      formerQuotaSupported: false,
      recommendationSupportedPendingHumanReview: true,
      exclusions: []
    },
    calibration: {
      entryCount: 12,
      answerEquivalenceGroupCount: 11,
      clusterGroupCounts: [4, 7],
      clustersWithMultipleNonEquivalentGroups: 2,
      totalPairCount: 55,
      withinClusterPairCount: 27,
      plausibleCompetingGroupSets: [
        ambiguitySet('pilot-opening-role-feedback', 'alternativeIntentReadings', ['eqx-aeg-006', 'eqx-aeg-079', 'eqx-aeg-110'], 'robust'),
        ambiguitySet('pilot-feedback-timeline', 'competingPublishedKnowledge', ['eqx-aeg-079', 'eqx-aeg-110', 'eqx-aeg-111'], 'robust'),
        ambiguitySet('ask-versus-receive-updates', 'alternativeIntentReadings', ['eqx-aeg-008', 'eqx-aeg-078'], 'robust'),
        ambiguitySet('ambassador-role-presence-selection', 'underspecifiedReference', ['eqx-aeg-077', 'eqx-aeg-106', 'eqx-aeg-107'], 'robust'),
        ambiguitySet('question-versus-improvement-channel', 'alternativeIntentReadings', ['eqx-aeg-083', 'eqx-aeg-112'], 'conditional'),
        ambiguitySet('news-feedback-evolution-contribution', 'competingPublishedKnowledge', ['eqx-aeg-078', 'eqx-aeg-110', 'eqx-aeg-111', 'eqx-aeg-112'], 'conditional_overlaps_feedback_cycle')
      ],
      candidateDistinctFamilyCount: 6,
      prudentDistinctFamilyCount: 4,
      mechanismTypesAvailable: AMBIGUITY_MECHANISM_TYPES,
      naiveAllPairCaseCapacityAtCap4: 220,
      naiveWithinClusterCaseCapacityAtCap4: 108,
      candidateCaseCapacityAtCap4: 24,
      prudentCaseCapacityAtCap4: 16,
      formerAmbiguousSlots: 80,
      recommendedAmbiguousSlots: 16,
      formerQuotaSupported: false,
      recommendationSupportedPendingHumanReview: true,
      exclusions: []
    },
    holdout: {
      entryCount: 22,
      answerEquivalenceGroupCount: 19,
      clusterGroupCounts: [13, 4, 2],
      clustersWithMultipleNonEquivalentGroups: 3,
      totalPairCount: 171,
      withinClusterPairCount: 85,
      plausibleCompetingGroupSets: [
        ambiguitySet('unspecified-space-booking-rule', 'underspecifiedReference', ['eqx-aeg-019', 'eqx-aeg-020', 'eqx-aeg-022', 'eqx-aeg-023', 'eqx-aeg-024'], 'robust_but_observed'),
        ambiguitySet('unspecified-place-capacity', 'underspecifiedReference', ['eqx-aeg-026', 'eqx-aeg-028', 'eqx-aeg-029', 'eqx-aeg-031', 'eqx-aeg-076'], 'robust_but_observed'),
        ambiguitySet('space-choice-for-six-to-ten-people', 'competingPublishedKnowledge', ['eqx-aeg-028', 'eqx-aeg-029', 'eqx-aeg-031'], 'robust_but_partly_observed'),
        ambiguitySet('forum-event-versus-ordinary-meeting', 'alternativeIntentReadings', ['eqx-aeg-024', 'eqx-aeg-029', 'eqx-aeg-105'], 'robust_boundary_but_observed'),
        ambiguitySet('quiet-call-confidentiality', 'alternativeIntentReadings', ['eqx-aeg-025', 'eqx-aeg-027', 'eqx-aeg-050'], 'robust_under_precise_context_but_observed'),
        ambiguitySet('acoustic-isolation-versus-enclosure', 'competingPublishedKnowledge', ['eqx-aeg-050', 'eqx-aeg-052', 'eqx-aeg-091'], 'robust_and_relatively_fresh'),
        ambiguitySet('free-access-availability-open-space', 'alternativeIntentReadings', ['eqx-aeg-020', 'eqx-aeg-089', 'eqx-aeg-091'], 'conditional_fragile'),
        ambiguitySet('create-check-cancel-booking', 'alternativeIntentReadings', ['eqx-aeg-019', 'eqx-aeg-022', 'eqx-aeg-089', 'eqx-aeg-090'], 'often_notCovered_instead_of_ambiguous'),
        ambiguitySet('generic-versus-named-project-room', 'underspecifiedReference', ['eqx-aeg-019', 'eqx-aeg-022', 'eqx-aeg-028', 'eqx-aeg-031', 'eqx-aeg-052'], 'conditional_lexical_boundary'),
        ambiguitySet('unspecified-space-usage', 'underspecifiedReference', ['eqx-aeg-025', 'eqx-aeg-027', 'eqx-aeg-029', 'eqx-aeg-052'], 'often_too_vague_or_partial'),
        ambiguitySet('building-levels-versus-population', 'alternativeIntentReadings', ['eqx-aeg-075', 'eqx-aeg-076'], 'conditional'),
        ambiguitySet('site-versus-room-capacity', 'underspecifiedReference', ['eqx-aeg-028', 'eqx-aeg-029', 'eqx-aeg-031', 'eqx-aeg-076'], 'easily_artificial')
      ],
      candidateDistinctFamilyCount: 12,
      prudentDistinctFamilyCount: 5,
      prudentDistinctFamilyRange: { minimum: 4, maximum: 5 },
      mechanismTypesAvailable: AMBIGUITY_MECHANISM_TYPES,
      naiveAllPairCaseCapacityAtCap4: 684,
      naiveWithinClusterCaseCapacityAtCap4: 340,
      candidateCaseCapacityAtCap4: 48,
      prudentCaseCapacityAtCap4: 20,
      formerAmbiguousSlots: 100,
      recommendedAmbiguousSlots: 20,
      formerQuotaSupported: false,
      recommendationSupportedPendingHumanReview: true,
      exclusions: []
    }
  },
  allFormerQuotasSupported: false,
  totalRecommendedAmbiguousSlots: 80,
  quotasRemainBlockedOnHumanStructureReview: true,
  residualRisk: 'Every recommended quota remains a ceiling. Reduce it before authoring if the independent structure review confirms fewer genuinely distinct families.'
};

const SCENARIO_FAMILY_DIVERSITY_AUDIT = {
  status: 'DIVERSITY_AUDITED_PENDING_HUMAN_SCENARIO_INVENTORY',
  familyDefinition: 'A substantively distinct user or business situation; language, category, register, paraphrase and surface variation never create a new family.',
  candidateAnswerEquivalenceGroupCounts: { train: 57, development: 19, calibration: 11, holdout: 19, total: 106 },
  formerHardCap: 4,
  formerMinimumDistinctFamilies: { train: 225, development: 60, calibration: 60, holdout: 75, total: 420 },
  formerHardCapSupported: false,
  plausibleIndependentFamilyRange: { minimum: 230, maximum: 280 },
  planningCentreRange: { minimum: 250, maximum: 260 },
  plausiblePlanBySplitAndAnchorOutcome: {
    train: { covered: 70, notCovered: 50, ambiguous: 6, total: 126 },
    development: { covered: 20, notCovered: 17, ambiguous: 5, total: 42 },
    calibration: { covered: 16, notCovered: 17, ambiguous: 4, total: 37 },
    holdout: { covered: 22, notCovered: 22, ambiguous: 5, total: 49 },
    total: { covered: 128, notCovered: 106, ambiguous: 20, total: 254 }
  },
  recommendedHardCap: 8,
  minimumDistinctFamiliesAtRecommendedCap: { train: 113, development: 30, calibration: 30, holdout: 38, total: 211 },
  diversityFloorForAverageAtMostSeven: { train: 129, development: 35, calibration: 35, holdout: 43, total: 242 },
  actionBelowDiversityFloor: 'REDUCE_EACH_SPLIT_TO_AT_MOST_SEVEN_TIMES_ITS_APPROVED_FAMILY_COUNT_BEFORE_AUTHORING',
  saturationGate: {
    maximumShareOfApprovedFamiliesAtHardCap: 0.5,
    maximumCasesPerLanguageAndPrimaryCategoryWithinFamily: 2,
    actionOnFailure: 'BLOCK_AND_REDUCE_OR_REDESIGN_COMPOSITION'
  },
  categoriesAtOverfragmentationRisk: [
    'naturalParaphrase',
    'synonyms',
    'differentVocab',
    'otherRobustness',
    'multilingualVariants',
    'adjacentButResolvable',
    'hardNegative',
    'lexicalCollision',
    'nearButUnpublished',
    'mixedIntents',
    'ambiguous',
    'falsePremise'
  ],
  modelOutputsUsed: false,
  humanDecisionIncluded: false
};

const PAYLOAD = {
  schemaVersion: 2,
  status: 'PROPOSED_FOR_HUMAN_APPROVAL_BEFORE_SCENARIO_AUTHORING',
  automaticQualityGateStatus: 'STRUCTURAL_OK',
  humanQualityGateStatus: 'PENDING_HUMAN_REVIEW',
  generationAuthorized: false,
  labelsIncluded: false,
  formulationsIncluded: false,
  modelOutputsIncluded: false,
  splitVolumes: SPLIT_VOLUMES,
  primaryCategoryVolumes: PRIMARY_CATEGORY_VOLUMES,
  languageVolumesBySplitAndOutcome: LANGUAGE_VOLUMES_BY_SPLIT_AND_OUTCOME,
  languagePolicy: {
    languages: ['fr', 'en', 'de', 'es', 'it', 'nl'],
    corpusTargets: { fr: 942, en: 204, de: 168, es: 132, it: 132, nl: 102, total: 1680 },
    approximateShares: { fr: 0.56, en: 0.12, de: 0.10, es: 0.08, it: 0.08, nl: 0.06 },
    everyLanguageRequiredPerSplitOutcome: true,
    languagesForcedPerPrimaryMicroCategory: false,
    minimumLanguagesPerPrimaryCategoryAcrossCorpus: 3,
    nativeAuthoringRequired: true,
    mechanicalTranslationAllowed: false,
    reviewerRoleAssignedPerLanguageStratum: true,
    reviewerLanguageCompetenceRequired: true
  },
  reviewPolicy: {
    reviewerAAndBAreRolesPerLanguageStratum: true,
    samePhysicalPeopleRequiredAcrossLanguages: false,
    blindReview: true,
    sameDecisionGrid: true,
    peerJudgmentsVisible: false,
    modelInformationVisible: false,
    calibrationAndHoldoutDoubleReviewRequired: true,
    trainAndDevelopmentPrimaryReviewRequired: true,
    trainAndDevelopmentSecondReviewExhaustive: false,
    appendOnlyAdjudicationPreservesBothOriginals: true,
    structureDoubleReviewAndAdjudicationRequired: true
  },
  reviewWorkload: REVIEW_WORKLOAD,
  dangerousOpportunityReviewSlots: DANGEROUS_OPPORTUNITY_REVIEW_SLOTS,
  candidateLevelFloors: {
    coveredAnswerGroupOccurrences: {
      train: 574,
      development: 150,
      calibration: 144,
      holdout: 180,
      total: 1048,
      derivation: 'one covered answer-equivalence group for each covered case and at least two distinct covered groups for each ambiguous case'
    },
    trainHardNegativeGroupOccurrences: {
      minimum: 1148,
      unit: '(query, hardNegativeAnswerEquivalenceGroupId)',
      derivation: 'two distinct neighbouring negative groups for each of the minimum 574 covered answer-group occurrences in train',
      multiEntryAliasInflatesQuota: false
    },
    exactPairCount: null,
    exactPairCountReason: 'Equivalence multiplicity, exhaustive plausible candidates and frozen-retriever candidates are unavailable before human structure review and query authoring.'
  },
  scenarioFamilyPlanning: {
    idNamespacesFrozen: true,
    semanticBindingsCreated: false,
    bindingRequiresApprovedScenarioBrief: true,
    bindingOccursBeforeQueryWording: true,
    variantsAndTranslationsReuseFamilyId: true,
    familyMayCrossSplits: false,
    maximumQueryCasesPerFamily: 8,
    querySlotsRequiringDistinctFamiliesAtCap: {
      train: 113,
      development: 30,
      calibration: 30,
      holdout: 38,
      total: 211
    },
    maximumCorpusShareOfOneFamily: 8 / 1680,
    candidatePairsConsumeCap: false,
    ambiguityCapacityPlanningCasesPerFamily: 4,
    diversityFloorForAverageAtMostSeven: { train: 129, development: 35, calibration: 35, holdout: 43, total: 242 },
    exactFamilyCount: null,
    exactFamilyCountReason: 'The gate can derive minimum capacity and a diversity floor, but semantic family bindings remain forbidden before approved neutral scenario briefs exist.'
  },
  ambiguityCapacityAudit: AMBIGUITY_CAPACITY_AUDIT,
  scenarioFamilyDiversityAudit: SCENARIO_FAMILY_DIVERSITY_AUDIT,
  holdout: {
    queryCases: 300,
    dangerousOpportunityMinimum: 60,
    status: 'PENDING_HUMAN_REVIEW',
    executable: false,
    contentCreated: false
  },
  approvalQuestions: [
    'Adjudicate the candidate equivalence partition, preferred entries, knowledge graph and split reservations through two independent human reviews.',
    'Confirm the audited 6/5/4/5 authentic ambiguity families by split; otherwise reduce the corresponding quota before authoring.',
    'Assign language-competent reviewer roles for French, English, German, Spanish, Italian and Dutch.',
    'Approve the hard cap of eight, the per-split diversity floor totalling 242 families, and reduce the corpus if that floor cannot be met without pseudo-scenarios.',
    'Resolve the locker-date source inconsistency before authoring any date-specific scenario.'
  ]
};

export const CANDIDATE_CORPUS_COMPOSITION = deepFreeze({
  ...PAYLOAD,
  proposalFingerprint: fingerprint(PAYLOAD)
});
