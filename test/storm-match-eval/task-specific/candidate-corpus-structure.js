import { createHash } from 'node:crypto';

export const CANDIDATE_STRUCTURE_STATUS = 'FROZEN_CANDIDATE_PENDING_HUMAN_REVIEW';
export const HOLDOUT_QUALITY_GATE_STATUS = 'PENDING_HUMAN_REVIEW';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function canonicalise(value) {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map(key => [key, canonicalise(value[key])])
    );
  }
  return value;
}

export function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(canonicalise(value))).digest('hex');
}

function fixtureEntryId(ordinal) {
  return `equinoxe-q${String(ordinal).padStart(3, '0')}`;
}

function ordinalFromEntryId(entryId) {
  return Number(entryId.slice(-3));
}

export const CANONICAL_SOURCE = deepFreeze({
  provenanceRef: 'equinoxe-canonical-snapshot-v1',
  snapshotPath: 'test/storm-match-eval/equinoxe-corpus.snapshot.json',
  snapshotSchemaVersion: 1,
  snapshotSha256: '4b8a64a58d44b8f81cbf861e9daefc594a9095b6c8516ef205ecefde82984d4b',
  entryCount: 112,
  sourcePath: 'src/db/seedDemo.js',
  sourceSymbol: 'QUESTIONS',
  sourceGitCommit: 'd0243f15c4c390098663a9d31a462e5244ee6e60',
  fixtureIdPolicy: 'synthetic-test-only-ordinal',
  runtimeSeedDependency: false,
  note: 'The versioned snapshot is autonomous; the historical seed is provenance and an optional drift check only.'
});

const ENTRY_IDS = Object.freeze(
  Array.from({ length: CANONICAL_SOURCE.entryCount }, (_, index) => fixtureEntryId(index + 1))
);

export const CANONICAL_ENTRY_PROVENANCE = deepFreeze(
  ENTRY_IDS.map((entryId, index) => ({
    entryId,
    sourceOrdinal: index + 1,
    provenanceRef: CANONICAL_SOURCE.provenanceRef,
    snapshotSha256: CANONICAL_SOURCE.snapshotSha256,
    fixtureIdPolicy: CANONICAL_SOURCE.fixtureIdPolicy
  }))
);

export const PREFERRED_ENTRY_RULE = deepFreeze({
  version: 'most-explicit-autonomous-then-lowest-fixture-ordinal-v1',
  rule: 'Choose the most explicit autonomous canonical Q+A without broadening business scope; break a strict tie with the lowest fixture ordinal.',
  modelSignalAllowed: false
});

const REVIEW_PENDING = deepFreeze({
  status: HOLDOUT_QUALITY_GATE_STATUS,
  reviewerRoleA: 'UNASSIGNED_PER_LANGUAGE_STRATUM',
  reviewerRoleB: 'UNASSIGNED_PER_LANGUAGE_STRATUM',
  languageCompetenceRequired: true,
  samePhysicalReviewerForBothRolesAllowed: false,
  adjudication: 'BLOCKED_WAITING_FOR_BOTH',
  humanValidated: false
});

// Curator-side hypothesis only. It must never be copied into either blind review
// packet: both humans construct their own partitions independently.
const MULTI_ENTRY_GROUP_CANDIDATES = [
  {
    answerEquivalenceGroupId: 'eqx-aeg-001',
    entryIds: ['equinoxe-q001', 'equinoxe-q002'],
    preferredEntryId: 'equinoxe-q002',
    businessRationale: 'Both entries publish the same move date; q002 states the subject and date autonomously.'
  },
  {
    answerEquivalenceGroupId: 'eqx-aeg-019',
    entryIds: ['equinoxe-q019', 'equinoxe-q053'],
    preferredEntryId: 'equinoxe-q019',
    businessRationale: 'Both entries prescribe the unchanged usual meeting-room booking tool; q019 is the general autonomous formulation.'
  },
  {
    answerEquivalenceGroupId: 'eqx-aeg-050',
    entryIds: ['equinoxe-q050', 'equinoxe-q051', 'equinoxe-q099'],
    preferredEntryId: 'equinoxe-q050',
    businessRationale: 'All three direct confidential conversations to a meeting room or booth; q050 expresses the rule without a scenario-specific audience.'
  },
  {
    answerEquivalenceGroupId: 'eqx-aeg-066',
    entryIds: ['equinoxe-q066', 'equinoxe-q069'],
    preferredEntryId: 'equinoxe-q069',
    businessRationale: 'Both entries use the normal HR/health route for an adapted or ergonomic workstation; q069 states action and scope most explicitly.'
  },
  {
    answerEquivalenceGroupId: 'eqx-aeg-078',
    entryIds: ['equinoxe-q078', 'equinoxe-q085'],
    preferredEntryId: 'equinoxe-q078',
    businessRationale: 'Both entries publish that project news and milestones are updated regularly in Storm; q078 names the channel autonomously.'
  }
];

const groupedEntryIds = new Set(MULTI_ENTRY_GROUP_CANDIDATES.flatMap(group => group.entryIds));
const singletonGroups = ENTRY_IDS
  .filter(entryId => !groupedEntryIds.has(entryId))
  .map(entryId => ({
    answerEquivalenceGroupId: `eqx-aeg-${String(ordinalFromEntryId(entryId)).padStart(3, '0')}`,
    entryIds: [entryId],
    preferredEntryId: entryId,
    businessRationale: 'Conservative singleton: no other canonical answer is proposed as materially interchangeable under the strict business-equivalence rule.'
  }));

export const ANSWER_EQUIVALENCE_GROUPS = deepFreeze(
  [...MULTI_ENTRY_GROUP_CANDIDATES, ...singletonGroups]
    .sort((left, right) => ordinalFromEntryId(left.entryIds[0]) - ordinalFromEntryId(right.entryIds[0]))
    .map(group => ({
      ...group,
      preferredRuleVersion: PREFERRED_ENTRY_RULE.version,
      snapshotVersion: CANONICAL_SOURCE.provenanceRef,
      candidateFingerprint: fingerprint({
        answerEquivalenceGroupId: group.answerEquivalenceGroupId,
        entryIds: group.entryIds,
        preferredEntryId: group.preferredEntryId,
        businessRationale: group.businessRationale,
        preferredRuleVersion: PREFERRED_ENTRY_RULE.version,
        snapshotVersion: CANONICAL_SOURCE.provenanceRef
      }),
      review: REVIEW_PENDING
    }))
);

// Curator-side comparison material only. These dossiers expose the complete
// canonical texts needed for independent human review, but contain no proposed
// decision, preferred choice, reviewer response or model signal. They must not
// be copied into query-label packets as a suggested grouping.
export const EQUIVALENCE_REVIEW_DOSSIERS = deepFreeze([
  {
    dossierId: 'eqx-equivalence-review-001-002',
    comparisonEntryIds: ['equinoxe-q001', 'equinoxe-q002'],
    canonicalKnowledge: [
      {
        entryId: 'equinoxe-q001',
        canonicalQuestion: 'Quand déménageons-nous ?',
        canonicalAnswer: 'Le 18 janvier 2027.'
      },
      {
        entryId: 'equinoxe-q002',
        canonicalQuestion: 'C’est prévu pour quand exactement, l’emménagement ?',
        canonicalAnswer: 'L’emménagement à Cobalt est prévu le 18 janvier 2027.'
      }
    ],
    reviewInstruction: 'Assess business-answer interchangeability and, only if one group is justified, choose its preferred entry under the pre-registered rule.',
    judgmentsIncluded: false
  },
  {
    dossierId: 'eqx-equivalence-review-019-053',
    comparisonEntryIds: ['equinoxe-q019', 'equinoxe-q053'],
    canonicalKnowledge: [
      {
        entryId: 'equinoxe-q019',
        canonicalQuestion: 'Comment je réserve une salle de réunion ?',
        canonicalAnswer: 'Via l’outil de réservation habituel, qui reste inchangé pour les salles de réunion.'
      },
      {
        entryId: 'equinoxe-q053',
        canonicalQuestion: 'Comment réserver une salle pour un entretien annuel ?',
        canonicalAnswer: 'Via l’outil de réservation habituel des salles de réunion.'
      }
    ],
    reviewInstruction: 'Assess business-answer interchangeability and, only if one group is justified, choose its preferred entry under the pre-registered rule.',
    judgmentsIncluded: false
  },
  {
    dossierId: 'eqx-equivalence-review-050-051-099',
    comparisonEntryIds: ['equinoxe-q050', 'equinoxe-q051', 'equinoxe-q099'],
    canonicalKnowledge: [
      {
        entryId: 'equinoxe-q050',
        canonicalQuestion: 'Comment garantir la confidentialité dans un open space ?',
        canonicalAnswer: 'Les salles de réunion et bulles sont prévues pour les échanges nécessitant de la confidentialité.'
      },
      {
        entryId: 'equinoxe-q051',
        canonicalQuestion: 'Puis-je passer un entretien RH confidentiel sur site ?',
        canonicalAnswer: 'Oui, utilisez une salle de réunion ou une bulle pour ce type d’échange.'
      },
      {
        entryId: 'equinoxe-q099',
        canonicalQuestion: 'Puis-je réserver une salle pour un appel client confidentiel ?',
        canonicalAnswer: 'Oui, les salles de réunion et bulles conviennent à ce type d’échange.'
      }
    ],
    reviewInstruction: 'Assess full business-answer interchangeability, including whether q099’s booking wording is actually answered, then choose a preferred entry only for a justified group.',
    judgmentsIncluded: false
  },
  {
    dossierId: 'eqx-equivalence-review-066-069',
    comparisonEntryIds: ['equinoxe-q066', 'equinoxe-q069'],
    canonicalKnowledge: [
      {
        entryId: 'equinoxe-q066',
        canonicalQuestion: 'Comment demander un poste adapté ?',
        canonicalAnswer: 'Via les circuits RH/santé habituels.'
      },
      {
        entryId: 'equinoxe-q069',
        canonicalQuestion: 'Qui contacter pour un besoin spécifique d’ergonomie ?',
        canonicalAnswer: 'Les circuits RH/santé habituels restent le point d’entrée pour toute demande d’adaptation de poste.'
      }
    ],
    reviewInstruction: 'Assess business-answer interchangeability and, only if one group is justified, choose its preferred entry under the pre-registered rule.',
    judgmentsIncluded: false
  },
  {
    dossierId: 'eqx-equivalence-review-078-085',
    comparisonEntryIds: ['equinoxe-q078', 'equinoxe-q085'],
    canonicalKnowledge: [
      {
        entryId: 'equinoxe-q078',
        canonicalQuestion: 'On peut suivre l’avancement du projet quelque part ?',
        canonicalAnswer: 'Oui, les actualités et les jalons du projet sont mis à jour régulièrement dans Storm.'
      },
      {
        entryId: 'equinoxe-q085',
        canonicalQuestion: 'Est-ce qu’il y aura des points d’étape réguliers ?',
        canonicalAnswer: 'Oui, des actualités et jalons sont publiés régulièrement dans Storm au fil de l’avancement.'
      }
    ],
    reviewInstruction: 'Assess business-answer interchangeability and, only if one group is justified, choose its preferred entry under the pre-registered rule.',
    judgmentsIncluded: false
  }
]);

export const EQUIVALENCE_BOUNDARIES_FOR_BLIND_HUMAN_REVIEW = deepFreeze([
  {
    entryIds: ['equinoxe-q013', 'equinoxe-q033'],
    reason: 'Definition of a team neighbourhood versus confirmation that it contains small rooms.'
  },
  {
    entryIds: ['equinoxe-q029', 'equinoxe-q105'],
    reason: 'Forum purpose versus explicit exclusion of ordinary team meetings.'
  },
  {
    entryIds: ['equinoxe-q030', 'equinoxe-q071'],
    reason: 'General wellbeing space including breastfeeding versus rest and recovery only.'
  },
  {
    entryIds: ['equinoxe-q035', 'equinoxe-q036', 'equinoxe-q039', 'equinoxe-q095'],
    reason: 'Personal-locker availability, usage, exact booking date and individual ownership are related but not necessarily interchangeable.'
  },
  {
    entryIds: ['equinoxe-q040', 'equinoxe-q041', 'equinoxe-q042', 'equinoxe-q043', 'equinoxe-q044', 'equinoxe-q096'],
    reason: 'Telework rules, presence frequency, fixed days, minimum presence and encouragement differ in scope despite a shared policy theme.'
  },
  {
    entryIds: ['equinoxe-q054', 'equinoxe-q055', 'equinoxe-q059', 'equinoxe-q074'],
    reason: 'Public-transport access, RER proximity, ease from Paris and exact location publish overlapping but non-identical facts.'
  },
  {
    entryIds: ['equinoxe-q077', 'equinoxe-q106', 'equinoxe-q107'],
    reason: 'Ambassador role, service presence and appointment process must not be collapsed on theme alone.'
  }
]);

const SEMANTIC_NEIGHBOUR_AUDIT_PAYLOAD = {
  schemaVersion: 1,
  status: 'COMPLETED_CURATOR_ONLY_PENDING_HUMAN_GRAPH_REVIEW',
  purpose: 'Flag possible missed knowledge-graph edges; never decide labels, equivalence or clusters.',
  model: {
    modelId: 'sentence-transformers/distiluse-base-multilingual-cased-v2',
    revision: 'bfe45d0732ca50787611c0fe107ba278c7f3f889',
    artifactFingerprint: '2beea8cfc4a634a02e235f646f3cb298ae4db96edef92b1bfe07f429ae325187',
    artifactDescriptorFingerprint: '55634ee5a09d52cb7a62ec78807e9d460a0146376630bbe26b0ca3f5d79afb4c',
    dimension: 512,
    maxSequenceLength: 128
  },
  runtime: { device: 'cpu', cpuThreads: 6, strictOffline: true, downloadPerformed: false },
  source: {
    snapshotSha256: CANONICAL_SOURCE.snapshotSha256,
    entryCount: CANONICAL_SOURCE.entryCount,
    representation: 'canonicalQuestion',
    topK: 5
  },
  summary: {
    directedTopKRelations: 560,
    directedCrossClusterRelations: 344,
    entriesWithCrossClusterTop1: 48,
    entriesWithAnyCrossClusterTop5: 110,
    mutualCrossClusterTop5Pairs: 101,
    undirectedPairsAtOrAbove: {
      '0.50': { all: 272, crossCluster: 176 },
      '0.60': { all: 74, crossCluster: 38 },
      '0.65': { all: 34, crossCluster: 16 },
      '0.70': { all: 19, crossCluster: 9 },
      '0.75': { all: 9, crossCluster: 2 },
      '0.80': { all: 3, crossCluster: 0 }
    }
  },
  crossClusterSignalsAtOrAbove065: [
    { entryIds: ['equinoxe-q082', 'equinoxe-q108'], cosineSimilarity: 0.7584683 },
    { entryIds: ['equinoxe-q012', 'equinoxe-q041'], cosineSimilarity: 0.7543780 },
    { entryIds: ['equinoxe-q012', 'equinoxe-q044'], cosineSimilarity: 0.7315341 },
    { entryIds: ['equinoxe-q010', 'equinoxe-q041'], cosineSimilarity: 0.7304868 },
    { entryIds: ['equinoxe-q078', 'equinoxe-q111'], cosineSimilarity: 0.7147306 },
    { entryIds: ['equinoxe-q034', 'equinoxe-q075'], cosineSimilarity: 0.7118729 },
    { entryIds: ['equinoxe-q002', 'equinoxe-q009'], cosineSimilarity: 0.7047254 },
    { entryIds: ['equinoxe-q018', 'equinoxe-q035'], cosineSimilarity: 0.7040383 },
    { entryIds: ['equinoxe-q022', 'equinoxe-q078'], cosineSimilarity: 0.7018632 },
    { entryIds: ['equinoxe-q018', 'equinoxe-q041'], cosineSimilarity: 0.6771278 },
    { entryIds: ['equinoxe-q009', 'equinoxe-q085'], cosineSimilarity: 0.6726788 },
    { entryIds: ['equinoxe-q002', 'equinoxe-q007'], cosineSimilarity: 0.6699077 },
    { entryIds: ['equinoxe-q032', 'equinoxe-q071'], cosineSimilarity: 0.6654899 },
    { entryIds: ['equinoxe-q043', 'equinoxe-q067'], cosineSimilarity: 0.6593208 },
    { entryIds: ['equinoxe-q009', 'equinoxe-q111'], cosineSimilarity: 0.6555927 },
    { entryIds: ['equinoxe-q061', 'equinoxe-q075'], cosineSimilarity: 0.6534454 }
  ],
  candidateEquivalencePairDiagnostics: [
    { entryIds: ['equinoxe-q001', 'equinoxe-q002'], cosineSimilarity: 0.6344512, directionalTop5Ranks: [1, 3] },
    { entryIds: ['equinoxe-q019', 'equinoxe-q053'], cosineSimilarity: 0.6458176, directionalTop5Ranks: [2, 1] },
    { entryIds: ['equinoxe-q050', 'equinoxe-q051'], cosineSimilarity: 0.3374305, directionalTop5Ranks: [null, null] },
    { entryIds: ['equinoxe-q050', 'equinoxe-q099'], cosineSimilarity: 0.4694483, directionalTop5Ranks: [2, null] },
    { entryIds: ['equinoxe-q051', 'equinoxe-q099'], cosineSimilarity: 0.6102204, directionalTop5Ranks: [1, 1] },
    { entryIds: ['equinoxe-q066', 'equinoxe-q069'], cosineSimilarity: 0.3744847, directionalTop5Ranks: [null, 3] },
    { entryIds: ['equinoxe-q078', 'equinoxe-q085'], cosineSimilarity: 0.5223250, directionalTop5Ranks: [null, null] }
  ],
  curatorFlags: [
    'Review whether arrival-food-services and preparation-guide-it are connected through q002/q007/q009.',
    'Review whether flex-team-neighbourhood and telework-presence-policy form one connected component.',
    'Review whether project-communication and pilot-feedback-change form one connected component.',
    'Review whether collaboration-rooms and focus-library form one connected component.',
    'Treat the q034/q075 numeric neighbour as a likely false semantic edge unless business review proves otherwise.',
    'Low question similarity in q066/q069 and q078/q085 is not evidence against business-answer equivalence.'
  ],
  prohibitions: {
    labelsGenerated: false,
    equivalenceDecisionsGenerated: false,
    preferredEntryDecisionsGenerated: false,
    clusterDecisionsGenerated: false,
    trainingDataUseAllowed: false,
    calibrationOrHoldoutUseAllowed: false,
    reviewPacketDistributionAllowed: false,
    modelSelectionUseAllowed: false
  }
};

export const SEMANTIC_NEIGHBOUR_AUDIT = deepFreeze({
  ...SEMANTIC_NEIGHBOUR_AUDIT_PAYLOAD,
  auditFingerprint: fingerprint(SEMANTIC_NEIGHBOUR_AUDIT_PAYLOAD)
});

const CLUSTER_DEFINITIONS = [
  {
    knowledgeClusterId: 'eqx-kc-arrival-food-services',
    entryIds: [1, 2, 32, 60, 61, 62, 63, 64, 65, 72, 92, 93, 102, 103].map(fixtureEntryId),
    splitReservation: 'development',
    businessRationale: 'Opening date and on-site food services are linked by the restaurant opening on move day and by shared Restaurant/Cafe/Terrace answers.'
  },
  {
    knowledgeClusterId: 'eqx-kc-preparation-guide-it',
    entryIds: [3, 4, 5, 7, 9, 45, 46, 47, 48, 49, 84, 97, 98, 108].map(fixtureEntryId),
    splitReservation: 'train',
    businessRationale: 'Preparation dates, visits, the usage guide and IT setup contain explicit cross-references and neighbouring pre-move procedures.'
  },
  {
    knowledgeClusterId: 'eqx-kc-pilot-feedback-change',
    entryIds: [6, 79, 110, 111].map(fixtureEntryId),
    splitReservation: 'calibration',
    businessRationale: 'The pilot floor, furniture tests, feedback and later adjustments describe the same project-learning loop.'
  },
  {
    knowledgeClusterId: 'eqx-kc-project-communication',
    entryIds: [8, 77, 78, 83, 85, 106, 107, 112].map(fixtureEntryId),
    splitReservation: 'calibration',
    businessRationale: 'Storm updates, ambassadors, project contacts and suggestions form the project communication and participation family.'
  },
  {
    knowledgeClusterId: 'eqx-kc-flex-team-neighbourhood',
    entryIds: [10, 11, 12, 13, 14, 15, 16, 17, 18, 21, 33, 80, 81, 82, 86, 87, 88, 109].map(fixtureEntryId),
    splitReservation: 'train',
    businessRationale: 'Desk allocation, flex behaviour, team neighbourhood composition, workshops, populations and orientation are mutually neighbouring workplace rules.'
  },
  {
    knowledgeClusterId: 'eqx-kc-telework-presence-policy',
    entryIds: [40, 41, 42, 43, 44, 96].map(fixtureEntryId),
    splitReservation: 'development',
    businessRationale: 'All entries concern the boundary between the Cobalt project and existing telework or presence rules, while retaining distinct answers.'
  },
  {
    knowledgeClusterId: 'eqx-kc-collaboration-rooms',
    entryIds: [19, 22, 23, 24, 27, 28, 29, 31, 50, 51, 52, 53, 89, 90, 99, 105].map(fixtureEntryId),
    splitReservation: 'holdout',
    businessRationale: 'Meeting rooms, booths, Project Rooms and Forum share booking, capacity, acoustic and confidentiality decision boundaries.'
  },
  {
    knowledgeClusterId: 'eqx-kc-focus-library',
    entryIds: [20, 25, 26, 91].map(fixtureEntryId),
    splitReservation: 'holdout',
    businessRationale: 'Library and Focus entries jointly define access and the distinctions among quiet workspaces.'
  },
  {
    knowledgeClusterId: 'eqx-kc-accessibility-wellbeing',
    entryIds: [30, 66, 67, 68, 69, 70, 71, 104].map(fixtureEntryId),
    splitReservation: 'train',
    businessRationale: 'Accessibility, workstation adaptations, acoustics, wellbeing, breastfeeding and recovery form a sensitive accommodation family.'
  },
  {
    knowledgeClusterId: 'eqx-kc-mobility-storage',
    entryIds: [34, 35, 36, 37, 38, 39, 54, 55, 56, 57, 58, 59, 73, 74, 94, 95, 100, 101].map(fixtureEntryId),
    splitReservation: 'train',
    businessRationale: 'Cycling, personal and bicycle storage, public transport, visitors, parking and charging share realistic mobility and locker collisions.'
  },
  {
    knowledgeClusterId: 'eqx-kc-building-scale',
    entryIds: [75, 76].map(fixtureEntryId),
    splitReservation: 'holdout',
    businessRationale: 'The two structural quantities for the building are close numeric questions that must remain in one partition.'
  }
];

export const KNOWLEDGE_CLUSTERS = deepFreeze(
  CLUSTER_DEFINITIONS.map(cluster => ({
    ...cluster,
    candidateFingerprint: fingerprint({
      knowledgeClusterId: cluster.knowledgeClusterId,
      entryIds: cluster.entryIds,
      splitReservation: cluster.splitReservation,
      businessRationale: cluster.businessRationale
    }),
    graphReview: REVIEW_PENDING
  }))
);

export const KNOWLEDGE_PARTITION = deepFreeze({
  status: CANDIDATE_STRUCTURE_STATUS,
  generationAuthorized: false,
  targetEntryCounts: { train: 60, development: 20, calibration: 16, holdout: 16 },
  reservedEntryCounts: { train: 58, development: 20, calibration: 12, holdout: 22 },
  deviationRationale: 'Cluster integrity and a multi-cluster holdout with enough competing published room knowledge take precedence over the indicative 60/20/16/16 target.',
  graphConstructionStatus: 'PENDING_TWO_INDEPENDENT_HUMAN_REVIEWS',
  lexicalNeighbourAuditStatus: 'NOT_REQUIRED_FOR_CURRENT_STRUCTURE_GATE',
  semanticNeighbourAuditStatus: SEMANTIC_NEIGHBOUR_AUDIT.status,
  curatorFlagsRequireHumanResolution: true,
  review: REVIEW_PENDING
});

export const SCENARIO_FAMILY_ID_RESERVATIONS = deepFreeze({
  status: 'NAMESPACE_FROZEN_BINDINGS_PENDING_HUMAN_STRUCTURE_REVIEW',
  generationAuthorized: false,
  semanticBindingsCreated: false,
  idFormat: 'storm-tsaf-v1-{splitCode}-{ordinal4}',
  allocationRule: 'After the equivalence and cluster adjudication, assign the lowest unused id in the split before wording any query. Variants, paraphrases, translations, derived negatives and mixed-intent derivatives of one semantic need reuse that id.',
  crossSplitReuseAllowed: false,
  rawSeedOrQueryTextIncluded: false,
  maximumQueryCasesPerScenarioFamily: 8,
  candidatePairsConsumeFamilyCap: false,
  minimumDistinctFamiliesAtFullComposition: { train: 113, development: 30, calibration: 30, holdout: 38, total: 211 },
  diversityFloorForAverageAtMostSeven: { train: 129, development: 35, calibration: 35, holdout: 43, total: 242 },
  maximumShareOfCorpusPerFamily: 8 / 1680,
  formerMaximumQueryCasesPerScenarioFamily: 4,
  formerMinimumDistinctFamiliesRejected: { train: 225, development: 60, calibration: 60, holdout: 75, total: 420 },
  ranges: [
    { split: 'train', splitCode: 'tr', firstOrdinal: 1, lastOrdinal: 900, reservedIdCapacity: 900 },
    { split: 'development', splitCode: 'dv', firstOrdinal: 1, lastOrdinal: 240, reservedIdCapacity: 240 },
    { split: 'calibration', splitCode: 'ca', firstOrdinal: 1, lastOrdinal: 240, reservedIdCapacity: 240 },
    { split: 'holdout', splitCode: 'ho', firstOrdinal: 1, lastOrdinal: 300, reservedIdCapacity: 300 }
  ],
  bindingGate: 'No id may be bound to a scenario brief until both human structure reviews and adjudication are complete; translation or paraphrase never creates a new family.'
});

export const PRIOR_OBSERVED_CORPORA = deepFreeze([
  {
    provenanceId: 'official-storm-match-baseline-v1',
    path: 'test/storm-match-eval/evaluation-corpus.js',
    queryCaseCount: 320,
    permittedSplits: ['train', 'development', 'calibration'],
    holdoutPermitted: false,
    priorLabelsReusable: false
  },
  {
    provenanceId: 'relevance-verifier-decision-corpus-v1',
    path: 'test/storm-match-eval/verifier/decision-corpus.js',
    queryCaseCount: 200,
    permittedSplits: ['train', 'development', 'calibration'],
    holdoutPermitted: false,
    priorLabelsReusable: false
  },
  {
    provenanceId: 'answerability-nli-holdout-now-observed-v1',
    path: 'test/storm-match-eval/answerability-nli/holdout-corpus.js',
    queryCaseCount: 96,
    permittedSplits: ['train', 'development', 'calibration'],
    holdoutPermitted: false,
    priorLabelsReusable: false
  }
]);

export const SOURCE_ANOMALIES = deepFreeze([
  {
    anomalyId: 'locker-reservation-date-conflict',
    snapshotEntryIds: ['equinoxe-q035', 'equinoxe-q036', 'equinoxe-q039'],
    sourceEvidence: [
      { source: 'src/db/seedDemo.js timeline milestone', value: '2 November 2026', introducedByCommit: 'd10d6a6' },
      { source: 'equinoxe-q035 canonical answer', value: 'booking opens early December 2026', introducedByCommit: 'd10d6a6' },
      { source: 'equinoxe-q036 canonical answer', value: 'bookable from early December 2026', introducedByCommit: 'd10d6a6' },
      { source: 'equinoxe-q039 canonical answer', value: 'booking opens 3 December 2026', introducedByCommit: 'd10d6a6' }
    ],
    finding: 'q035, q036 and q039 are mutually compatible because 3 December is early December; the timeline milestone conflicts with them.',
    evolutionAssessment: 'No temporal evolution is evidenced: all four values entered the repository in the same commit and coexist in the snapshot source commit.',
    distinctBusinessTruthsSupported: false,
    benchmarkTruth: 'The autonomous Q&A snapshot remains the evaluation source; q039 is its exact-date knowledge, without rewriting the conflicting seed milestone.',
    impact: 'Do not merge availability, storage usage and exact-date entries merely because they mention lockers; quarantine date-specific scenario authoring until human/business adjudication.',
    handling: 'Keep every source value visible, forbid silent normalisation, and require explicit business adjudication before any future date-specific case is authored.',
    authoringPolicy: {
      exactDateCasesAllowedBeforeAdjudication: false,
      genericDateNeutralCasesAllowedConditionally: true,
      genericCaseCondition: 'The candidate and system gold must remain identical for every documented source date; no reviewer may silently choose 2 November, early December or 3 December.',
      adjudicationStatus: 'PENDING_HUMAN_REVIEW'
    }
  },
  {
    anomalyId: 'prior-mixed-intent-label-conflict',
    snapshotEntryIds: [],
    priorCaseIds: {
      verifierNotCovered: Array.from({ length: 10 }, (_, index) => `decision-neg-07-${String(index + 1).padStart(2, '0')}`),
      nliAmbiguous: Array.from({ length: 16 }, (_, index) => `answerability-holdout-ambiguous-${String(index + 1).padStart(2, '0')}`)
    },
    finding: 'The verifier corpus used expectedEntryId=null/abstention for explicit conjunctions, while the NLI holdout mapped all mixedIntents to ambiguous.',
    v0Rule: 'An explicit multi-part query is notCovered when no single canonical Q+A completely answers all requested parts. It is ambiguous only when the wording itself admits multiple reasonable alternative readings, each completely covered by a different answer-equivalence group.',
    impact: 'Historical mixed-intent labels are diagnostic provenance only; none can enter a new split without fresh human review under the V0 rule.',
    handling: 'Only text provenance may be reused in observed splits after fresh human review; never import a prior label or place a prior formulation or close translation in the final holdout.'
  }
]);

const STRUCTURE_PAYLOAD = {
  schemaVersion: 1,
  status: CANDIDATE_STRUCTURE_STATUS,
  holdoutQualityGateStatus: HOLDOUT_QUALITY_GATE_STATUS,
  protocolCommit: '1e1a08d17f9e387b0ea62e9bfd46ed2d02e49131',
  humanReviewInfrastructureCommit: '330e4222cff1a5158f955789ee845408daad7695',
  canonicalSource: CANONICAL_SOURCE,
  entryProvenance: CANONICAL_ENTRY_PROVENANCE,
  preferredEntryRule: PREFERRED_ENTRY_RULE,
  answerEquivalenceGroups: ANSWER_EQUIVALENCE_GROUPS,
  equivalenceReviewDossiers: EQUIVALENCE_REVIEW_DOSSIERS,
  semanticNeighbourAudit: SEMANTIC_NEIGHBOUR_AUDIT,
  knowledgeClusters: KNOWLEDGE_CLUSTERS,
  knowledgePartition: KNOWLEDGE_PARTITION,
  scenarioFamilyIdReservations: SCENARIO_FAMILY_ID_RESERVATIONS,
  priorObservedCorpora: PRIOR_OBSERVED_CORPORA,
  sourceAnomalies: SOURCE_ANOMALIES,
  generationAuthorized: false
};

export const CANDIDATE_CORPUS_STRUCTURE = deepFreeze({
  ...STRUCTURE_PAYLOAD,
  structureFingerprint: fingerprint(STRUCTURE_PAYLOAD)
});
