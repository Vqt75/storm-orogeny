import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  ANSWER_EQUIVALENCE_GROUPS,
  CANDIDATE_CORPUS_STRUCTURE,
  EQUIVALENCE_REVIEW_DOSSIERS
} from '../candidate-corpus-structure.js';
import { CANDIDATE_CORPUS_COMPOSITION } from '../candidate-corpus-composition.js';
import {
  HUMAN_REVIEW_STATUS,
  STRUCTURAL_REVIEW_PACKET_SCHEMA,
  canonicalJson,
  fingerprint
} from './review-packets.js';

export const EXPECTED_STRUCTURE_FINGERPRINT = '7645715532702ea42599151243126e63abcfcb6015ad711673d9e12111da361e';
export const EXPECTED_COMPOSITION_FINGERPRINT = '2951ff970fe1e274e9ed250e25dfef95a6d9425a900b8f8b09e086d2cef5a652';

const snapshot = JSON.parse(readFileSync(new URL('../../equinoxe-corpus.snapshot.json', import.meta.url), 'utf8'));
const entryById = new Map(snapshot.entries.map(entry => [entry.entryId, entry]));
const groupById = new Map(ANSWER_EQUIVALENCE_GROUPS.map(group => [group.answerEquivalenceGroupId, group]));

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function sha256Text(value) {
  return createHash('sha256').update(value).digest('hex');
}

function ranked(items, seed, namespace, idSelector) {
  return [...items]
    .map(item => ({
      item,
      rank: sha256Text(`${seed}\0${namespace}\0${idSelector(item)}`)
    }))
    .sort((left, right) => left.rank.localeCompare(right.rank)
      || idSelector(left.item).localeCompare(idSelector(right.item)))
    .map(({ item }) => item);
}

function sameOrder(left, right, idSelector) {
  return left.length === right.length
    && left.every((item, index) => idSelector(item) === idSelector(right[index]));
}

function rotate(items) {
  return items.length < 2 ? [...items] : [...items.slice(1), items[0]];
}

function expandGroupIds(groupIds) {
  return [...new Set(groupIds.flatMap(groupId => {
    const group = groupById.get(groupId);
    if (!group) throw new Error(`Unknown answer-equivalence group ${groupId}`);
    return group.entryIds;
  }))];
}

function assertCurrentFingerprints() {
  if (CANDIDATE_CORPUS_STRUCTURE.structureFingerprint !== EXPECTED_STRUCTURE_FINGERPRINT) {
    throw new Error('Structural review packages require the approved structure fingerprint');
  }
  if (CANDIDATE_CORPUS_COMPOSITION.proposalFingerprint !== EXPECTED_COMPOSITION_FINGERPRINT) {
    throw new Error('Structural review packages require the approved composition fingerprint');
  }
}

assertCurrentFingerprints();

const AMBIGUITY_SCOPE_LABELS = Object.freeze({
  'spatial-permanence': 'Permanence du poste, position quotidienne et quartier stable',
  'presence-procedure': 'Réservation du poste et déclaration de présence',
  'connection-meaning': 'Connexion réseau sans fil et branchement physique du poste',
  'accessibility-meaning': 'Accessibilité PMR et accessibilité géographique ou transport',
  'electric-charging-target': 'Recharge électrique pour vélo ou automobile',
  'locker-referent': 'Casier personnel et équipement de rangement du local vélos',
  'preparation-milestone-scope': 'Portée des jalons de préparation au déménagement',
  'workplace-adaptation-scope': 'Adaptation du poste, accessibilité et équipement spécifique',
  'restaurant-versus-terrace-capacity': 'Capacité du restaurant et capacité de la terrasse',
  'cafe-purpose-offer-access': 'Finalité, offre et accès du Café',
  'terrace-purpose': 'Usages possibles de la terrasse',
  'restaurant-existence-versus-opening': 'Existence du restaurant et date de son ouverture',
  'food-offer-scope': 'Portée de l’offre alimentaire, snacks et menu',
  'where-eating-is-allowed': 'Lieux de restauration et permission d’usage',
  'presence-frequency-rule': 'Fréquence, minimum et encouragement de présence',
  'presence-authority-and-calendar': 'Règle projet, calendrier et autorité managériale de présence',
  'pilot-opening-role-feedback': 'Ouverture, rôle expérimental et collecte de retours du pilote',
  'pilot-feedback-timeline': 'Essai, feedback avant déménagement et évolution ultérieure',
  'ask-versus-receive-updates': 'Poser une question et recevoir les actualités projet',
  'ambassador-role-presence-selection': 'Rôle, présence locale et désignation des ambassadeurs',
  'question-versus-improvement-channel': 'Canal de question et canal de proposition d’amélioration',
  'news-feedback-evolution-contribution': 'Actualités, feedback, évolution et contribution au projet',
  'unspecified-space-booking-rule': 'Règle de réservation lorsque l’espace n’est pas précisé',
  'unspecified-place-capacity': 'Capacité lorsque le lieu n’est pas précisé',
  'space-choice-for-six-to-ten-people': 'Choix d’espace pour un groupe de six à dix personnes',
  'forum-event-versus-ordinary-meeting': 'Événement au Forum et réunion ordinaire',
  'quiet-call-confidentiality': 'Travail calme, appel rapide et confidentialité',
  'acoustic-isolation-versus-enclosure': 'Isolation acoustique et fermeture physique',
  'free-access-availability-open-space': 'Accès libre, disponibilité et espace ouvert',
  'create-check-cancel-booking': 'Créer, vérifier ou annuler une réservation',
  'generic-versus-named-project-room': 'Salle projet générique et espaces nommés Project Room',
  'unspecified-space-usage': 'Usage d’un espace non précisé',
  'building-levels-versus-population': 'Nombre de niveaux du bâtiment et population accueillie',
  'site-versus-room-capacity': 'Capacité du site et capacité d’une salle'
});

const BOUNDARY_SOURCE_ITEMS = [
  {
    sourceItemId: 'boundary-arrival-preparation',
    title: 'Arrivée / préparation',
    businessContext: 'Évaluer si les connaissances sur la date d’arrivée et la préparation constituent une même composante métier ou deux composantes séparées.',
    entryIds: ['equinoxe-q001', 'equinoxe-q002', 'equinoxe-q003', 'equinoxe-q004', 'equinoxe-q005', 'equinoxe-q007', 'equinoxe-q009', 'equinoxe-q108']
  },
  {
    sourceItemId: 'boundary-flex-telework',
    title: 'Flex / télétravail',
    businessContext: 'Évaluer la frontière entre organisation en flex office, quartier d’équipe et règles de présence ou télétravail.',
    entryIds: ['equinoxe-q010', 'equinoxe-q012', 'equinoxe-q014', 'equinoxe-q018', 'equinoxe-q021', 'equinoxe-q040', 'equinoxe-q041', 'equinoxe-q042', 'equinoxe-q043', 'equinoxe-q044', 'equinoxe-q096']
  },
  {
    sourceItemId: 'boundary-communication-pilot',
    title: 'Communication / pilote',
    businessContext: 'Évaluer la frontière entre information projet, questions, ambassadeurs, expérimentation pilote et collecte de feedback.',
    entryIds: ['equinoxe-q006', 'equinoxe-q008', 'equinoxe-q077', 'equinoxe-q078', 'equinoxe-q079', 'equinoxe-q083', 'equinoxe-q085', 'equinoxe-q106', 'equinoxe-q107', 'equinoxe-q110', 'equinoxe-q111', 'equinoxe-q112']
  },
  {
    sourceItemId: 'boundary-rooms-focus',
    title: 'Salles / Focus',
    businessContext: 'Évaluer si les espaces de collaboration et les espaces Focus ou Bibliothèque relèvent d’une même composante métier et préciser leurs frontières de couverture.',
    entryIds: ['equinoxe-q019', 'equinoxe-q020', 'equinoxe-q022', 'equinoxe-q023', 'equinoxe-q024', 'equinoxe-q025', 'equinoxe-q026', 'equinoxe-q027', 'equinoxe-q028', 'equinoxe-q029', 'equinoxe-q031', 'equinoxe-q050', 'equinoxe-q051', 'equinoxe-q052', 'equinoxe-q053', 'equinoxe-q089', 'equinoxe-q090', 'equinoxe-q091', 'equinoxe-q099', 'equinoxe-q105']
  }
];

const EQUIVALENCE_SOURCE_ITEMS = EQUIVALENCE_REVIEW_DOSSIERS.map((dossier, index) => ({
  sourceItemId: `equivalence-comparison-${String(index + 1).padStart(2, '0')}`,
  title: `Comparaison d’équivalence ${String(index + 1).padStart(2, '0')}`,
  businessContext: 'Comparer les réponses métier complètes. La proximité thématique ou lexicale ne suffit pas à établir une équivalence.',
  entryIds: [...dossier.comparisonEntryIds]
}));

const AMBIGUITY_SOURCE_ITEMS = Object.values(CANDIDATE_CORPUS_COMPOSITION.ambiguityCapacityAudit.splitAudits)
  .flatMap(audit => audit.plausibleCompetingGroupSets)
  .map((candidate, index) => ({
    sourceItemId: `ambiguity-capacity-${String(index + 1).padStart(2, '0')}`,
    title: `Famille candidate ${String(index + 1).padStart(2, '0')}`,
    businessContext: AMBIGUITY_SCOPE_LABELS[candidate.mechanismId],
    entryIds: expandGroupIds(candidate.answerEquivalenceGroupIds)
  }));

if (AMBIGUITY_SOURCE_ITEMS.some(item => item.entryIds.includes('equinoxe-q039'))) {
  throw new Error('Exact-date locker knowledge q039 must stay excluded from ambiguity review');
}

const SCENARIO_PREFLIGHT_SOURCE_ITEMS = AMBIGUITY_SOURCE_ITEMS.map((item, index) => ({
  sourceItemId: `scenario-family-preflight-${String(index + 1).padStart(2, '0')}`,
  title: `Brief de famille ${String(index + 1).padStart(2, '0')}`,
  businessContext: item.businessContext,
  entryIds: [...item.entryIds]
}));

const SECTION_SPECS = deepFreeze({
  equivalencePreferred: {
    order: 1,
    packetKind: 'EQUIVALENCE_AND_PREFERRED',
    includeTieBreakRank: true,
    sourceItems: EQUIVALENCE_SOURCE_ITEMS,
    instructions: [
      'Décider d’abord si les réponses sont substantiellement interchangeables, sans consulter ni supposer le regroupement curator-side.',
      'Former une partition explicite si plusieurs groupes de réponses sont nécessaires.',
      'Seulement après cette décision, choisir un préféré dans chaque groupe multi-entry selon la règle préenregistrée et justifier le choix.'
    ],
    decisionsRequired: [
      {
        decisionType: 'substantiveEquivalencePartition',
        phase: 1,
        allowedValues: ['oneEquivalentGroup', 'multipleNonEquivalentGroups', 'insufficientEvidence'],
        rationaleRequired: true
      },
      {
        decisionType: 'preferredEntrySelection',
        phase: 2,
        prerequisiteDecisionType: 'substantiveEquivalencePartition',
        condition: 'required only for each reviewer-confirmed multi-entry equivalent group',
        allowedValues: ['chooseOneDisplayedKnowledgeRef', 'insufficientEvidence'],
        rationaleRequired: true,
        automaticSelectionAllowed: false
      }
    ],
    limitations: []
  },
  knowledgeBoundaries: {
    order: 2,
    packetKind: 'KNOWLEDGE_BOUNDARIES',
    includeTieBreakRank: false,
    sourceItems: BOUNDARY_SOURCE_ITEMS,
    instructions: [
      'Décider si les connaissances appartiennent à une même composante métier ou à des composantes séparées.',
      'Décrire les conditions métier qui rendraient une future demande couverte, non couverte ou réellement ambiguë.',
      'Ne créer aucun gold de cas : aucune formulation utilisateur n’existe à cette étape.'
    ],
    decisionsRequired: [
      {
        decisionType: 'knowledgeComponentBoundary',
        allowedValues: ['sameConnectedComponent', 'separateComponents', 'partitionRequired', 'insufficientEvidence'],
        rationaleRequired: true
      },
      {
        decisionType: 'futureCoverageBoundaryRules',
        allowedValues: ['rulesDocumented', 'insufficientEvidence'],
        rationaleRequired: true
      }
    ],
    limitations: ['No query-level covered/notCovered/ambiguous gold can be assigned before user formulations exist.']
  },
  ambiguityFamilies: {
    order: 3,
    packetKind: 'AMBIGUITY_CAPACITY_FAMILIES',
    includeTieBreakRank: false,
    sourceItems: AMBIGUITY_SOURCE_ITEMS,
    instructions: [
      'Évaluer si le brief peut soutenir une ambiguïté structurelle réelle entre au moins deux réponses substantiellement différentes.',
      'Reclasser explicitement le brief comme notCovered, artificiel, temporellement instable ou insuffisamment documenté si nécessaire.',
      'Si une ambiguïté est défendable, choisir exactement son mécanisme sans reprendre une suggestion curator-side.'
    ],
    decisionsRequired: [
      {
        decisionType: 'ambiguityFamilyDisposition',
        allowedValues: ['structuralAmbiguity', 'notCovered', 'artificialOrMalformed', 'blockedTemporalInstability', 'insufficientEvidence'],
        rationaleRequired: true
      },
      {
        decisionType: 'ambiguityMechanism',
        condition: 'required only when disposition is structuralAmbiguity',
        allowedValues: ['underspecifiedReference', 'competingPublishedKnowledge', 'alternativeIntentReadings'],
        rationaleRequired: true
      },
      {
        decisionType: 'substantiallyDifferentCoveredGroups',
        condition: 'required only when disposition is structuralAmbiguity',
        allowedValues: ['reviewerDefinedPartitionOfDisplayedKnowledge', 'insufficientEvidence'],
        rationaleRequired: true
      }
    ],
    limitations: ['This reviews family capacity, not query cases; no query formulation or system gold exists yet.']
  },
  scenarioFamilyPreflight: {
    order: 4,
    packetKind: 'SCENARIO_FAMILY_PREFLIGHT',
    includeTieBreakRank: false,
    sourceItems: SCENARIO_PREFLIGHT_SOURCE_ITEMS,
    instructions: [
      'Partitionner les briefs affichés en situations utilisateur ou métier substantiellement distinctes.',
      'Fusionner les briefs qui décrivent le même besoin malgré un angle, une catégorie ou un vocabulaire différent.',
      'Signaler les briefs trop larges, artificiellement atomisés ou insuffisamment documentés. Aucun nombre cible ne doit être atteint mécaniquement.'
    ],
    decisionsRequired: [
      {
        decisionType: 'reviewerScenarioFamilyPartition',
        allowedValues: ['reviewerDefinedFamilyGroups', 'insufficientEvidence'],
        rationaleRequired: true
      },
      {
        decisionType: 'fragmentationAssessment',
        allowedValues: ['distinct', 'mergeWithAnotherDisplayedBrief', 'tooBroad', 'artificiallyFragmented', 'insufficientEvidence'],
        rationaleRequired: true
      }
    ],
    limitations: [
      'The sample contains the 34 current ambiguity-family candidates only; it is not the future 250–260-family inventory.',
      'Paraphrase, translation, hard-negative, lexical-collision and mixed-intent fragmentation cannot be audited empirically until neutral scenario briefs exist.',
      'No scenarioFamilyId is assigned or semantically bound by this packet.'
    ]
  }
});

const REVIEW_SEEDS = deepFreeze({
  equivalencePreferred: {
    A: 'storm-structural-review-v1-equivalence-a-9eb0e7',
    B: 'storm-structural-review-v1-equivalence-b-577db8'
  },
  knowledgeBoundaries: {
    A: 'storm-structural-review-v1-boundaries-a-39da0c',
    B: 'storm-structural-review-v1-boundaries-b-bf1d29'
  },
  ambiguityFamilies: {
    A: 'storm-structural-review-v1-ambiguity-a-acde61',
    B: 'storm-structural-review-v1-ambiguity-b-8f5a4b'
  },
  scenarioFamilyPreflight: {
    A: 'storm-structural-review-v1-family-a-4d951f',
    B: 'storm-structural-review-v1-family-b-78ab33'
  }
});

function getKnowledge(entryIds) {
  return [...new Set(entryIds)].map(entryId => {
    const entry = entryById.get(entryId);
    if (!entry) throw new Error(`Unknown canonical entry ${entryId}`);
    return {
      entryId,
      canonicalQuestion: entry.question,
      canonicalAnswer: entry.answer,
      preRegisteredTieBreakRank: Number(entryId.slice(-3))
    };
  });
}

function buildRolePacket(sectionKey, spec, reviewerSlot, seed, itemOrder, knowledgeOrder, entryOrderByItemId) {
  const role = reviewerSlot.toLowerCase();
  const prefix = `storm-${String(spec.order).padStart(2, '0')}-${role}`;
  const knowledgeRefByEntryId = new Map(knowledgeOrder.map((item, index) => [
    item.entryId,
    `${prefix}-knowledge-${String(index + 1).padStart(3, '0')}`
  ]));
  const knowledgeItems = knowledgeOrder.map(item => ({
    knowledgeRef: knowledgeRefByEntryId.get(item.entryId),
    canonicalQuestion: item.canonicalQuestion,
    canonicalAnswer: item.canonicalAnswer,
    ...(spec.includeTieBreakRank ? { preRegisteredTieBreakRank: item.preRegisteredTieBreakRank } : {})
  }));
  const reviewItems = itemOrder.map((item, index) => ({
    reviewItemRef: `${prefix}-item-${String(index + 1).padStart(3, '0')}`,
    title: item.title,
    businessContext: item.businessContext,
    knowledgeRefs: entryOrderByItemId.get(item.sourceItemId).map(entryId => knowledgeRefByEntryId.get(entryId))
  }));
  const packetWithoutFingerprint = {
    schemaVersion: STRUCTURAL_REVIEW_PACKET_SCHEMA.schemaVersion,
    packetKind: spec.packetKind,
    packetId: `${prefix}-${sectionKey}-fr`,
    reviewerSlot,
    languageStratum: 'fr',
    reviewStatus: 'NOT_STARTED',
    humanQualityGateStatus: HUMAN_REVIEW_STATUS,
    generationAuthorized: false,
    traceability: {
      structureFingerprint: EXPECTED_STRUCTURE_FINGERPRINT,
      compositionFingerprint: EXPECTED_COMPOSITION_FINGERPRINT,
      canonicalSnapshotSha256: CANDIDATE_CORPUS_STRUCTURE.canonicalSource.snapshotSha256
    },
    isolation: {
      modelOutputsIncluded: false,
      scoresIncluded: false,
      predictionsIncluded: false,
      semanticNeighbourRanksIncluded: false,
      prefilledJudgmentsIncluded: false,
      proposedEquivalenceGroupsIncluded: false,
      proposedPreferredEntriesIncluded: false,
      proposedKnowledgeClustersIncluded: false,
      otherReviewerResponsesIncluded: false,
      curatorMappingIncluded: false
    },
    randomization: {
      algorithm: 'sha256-rank-v1',
      seedCommitmentSha256: sha256Text(seed),
      knowledgeOrderSha256: fingerprint(knowledgeOrder.map(item => item.entryId)),
      reviewItemOrderSha256: fingerprint(itemOrder.map(item => item.sourceItemId)),
      knowledgeOrderByItemSha256: fingerprint([...entryOrderByItemId.entries()])
    },
    instructions: [...spec.instructions],
    decisionsRequired: structuredClone(spec.decisionsRequired),
    responseContract: {
      appendOnly: true,
      emptyAtGeneration: true,
      decisionPhaseOrderEnforced: spec.packetKind === 'EQUIVALENCE_AND_PREFERRED',
      requiredEventFields: [
        'eventId',
        'sequence',
        'reviewItemRef',
        'decisionType',
        'decisionValue',
        'rationale',
        'reviewerIdentity',
        'languageCompetenceAttested',
        'recordedAt',
        'previousEventHash',
        'eventHash'
      ],
      correctionPolicy: 'Append a superseding event; never edit or delete an earlier event.',
      peerResponsesAllowedBeforeSeal: false
    },
    limitations: [...spec.limitations],
    knowledgeItems,
    reviewItems
  };
  return deepFreeze({
    ...packetWithoutFingerprint,
    packetFingerprint: fingerprint(packetWithoutFingerprint)
  });
}

function buildPacketPair(sectionKey, spec) {
  const knowledge = getKnowledge(spec.sourceItems.flatMap(item => item.entryIds));
  const seedA = REVIEW_SEEDS[sectionKey].A;
  const seedB = REVIEW_SEEDS[sectionKey].B;
  const itemsA = ranked(spec.sourceItems, seedA, `${sectionKey}:items`, item => item.sourceItemId);
  let itemsB = ranked(spec.sourceItems, seedB, `${sectionKey}:items`, item => item.sourceItemId);
  const knowledgeA = ranked(knowledge, seedA, `${sectionKey}:knowledge`, item => item.entryId);
  let knowledgeB = ranked(knowledge, seedB, `${sectionKey}:knowledge`, item => item.entryId);
  if (sameOrder(itemsA, itemsB, item => item.sourceItemId)) itemsB = rotate(itemsB);
  if (sameOrder(knowledgeA, knowledgeB, item => item.entryId)) knowledgeB = rotate(knowledgeB);

  const entryOrdersA = new Map();
  const entryOrdersB = new Map();
  for (const item of spec.sourceItems) {
    const orderA = ranked(item.entryIds, seedA, `${sectionKey}:${item.sourceItemId}:knowledge`, value => value);
    let orderB = ranked(item.entryIds, seedB, `${sectionKey}:${item.sourceItemId}:knowledge`, value => value);
    if (sameOrder(orderA, orderB, value => value)) orderB = rotate(orderB);
    entryOrdersA.set(item.sourceItemId, orderA);
    entryOrdersB.set(item.sourceItemId, orderB);
  }

  const reviewerA = buildRolePacket(sectionKey, spec, 'A', seedA, itemsA, knowledgeA, entryOrdersA);
  const reviewerB = buildRolePacket(sectionKey, spec, 'B', seedB, itemsB, knowledgeB, entryOrdersB);
  const refsFor = (packet, orderedItems, orderedKnowledge) => ({
    packetFingerprint: packet.packetFingerprint,
    itemRefs: orderedItems.map((item, index) => ({
      sourceItemId: item.sourceItemId,
      reviewItemRef: packet.reviewItems[index].reviewItemRef
    })),
    knowledgeRefs: orderedKnowledge.map((item, index) => ({
      entryId: item.entryId,
      knowledgeRef: packet.knowledgeItems[index].knowledgeRef
    }))
  });
  const linkageWithoutFingerprint = {
    schemaVersion: 1,
    sectionKey,
    sourceItemsSha256: fingerprint(spec.sourceItems),
    reviewerA: refsFor(reviewerA, itemsA, knowledgeA),
    reviewerB: refsFor(reviewerB, itemsB, knowledgeB)
  };
  return deepFreeze({
    reviewerA,
    reviewerB,
    curatorLinkage: {
      ...linkageWithoutFingerprint,
      linkageFingerprint: fingerprint(linkageWithoutFingerprint)
    }
  });
}

const sourcePlan = {
  schemaVersion: 1,
  status: HUMAN_REVIEW_STATUS,
  generationAuthorized: false,
  formulationsIncluded: false,
  goldsIncluded: false,
  modelOutputsIncluded: false,
  structureFingerprint: EXPECTED_STRUCTURE_FINGERPRINT,
  compositionFingerprint: EXPECTED_COMPOSITION_FINGERPRINT,
  sections: Object.fromEntries(Object.entries(SECTION_SPECS).map(([key, spec]) => [key, {
    packetKind: spec.packetKind,
    reviewItemCount: spec.sourceItems.length,
    sourceItems: spec.sourceItems
  }]))
};

export const STRUCTURAL_REVIEW_SOURCE_PLAN = deepFreeze({
  ...sourcePlan,
  sourcePlanFingerprint: fingerprint(sourcePlan)
});

export const STRUCTURAL_REVIEW_PACKET_PAIRS = deepFreeze(
  Object.fromEntries(Object.entries(SECTION_SPECS).map(([key, spec]) => [key, buildPacketPair(key, spec)]))
);

const manifestWithoutFingerprint = {
  schemaVersion: 1,
  status: HUMAN_REVIEW_STATUS,
  automaticQualityGateStatus: 'STRUCTURAL_OK',
  generationAuthorized: false,
  reviewPacketsMaterialised: true,
  finalDatasetGenerated: false,
  holdoutOpened: false,
  languageStratum: 'fr',
  structureFingerprint: EXPECTED_STRUCTURE_FINGERPRINT,
  compositionFingerprint: EXPECTED_COMPOSITION_FINGERPRINT,
  sourcePlanFingerprint: STRUCTURAL_REVIEW_SOURCE_PLAN.sourcePlanFingerprint,
  packageSummary: Object.fromEntries(Object.entries(STRUCTURAL_REVIEW_PACKET_PAIRS).map(([key, pair]) => [key, {
    reviewItemCount: pair.reviewerA.reviewItems.length,
    knowledgeItemCount: pair.reviewerA.knowledgeItems.length,
    reviewerAPacketFingerprint: pair.reviewerA.packetFingerprint,
    reviewerBPacketFingerprint: pair.reviewerB.packetFingerprint,
    responsesStarted: false
  }]))
};

export const STRUCTURAL_REVIEW_QUALITY_GATE_MANIFEST = deepFreeze({
  ...manifestWithoutFingerprint,
  manifestFingerprint: fingerprint(manifestWithoutFingerprint)
});

export function serialiseStructuralReviewArtifact(value) {
  return `${JSON.stringify(JSON.parse(canonicalJson(value)), null, 2)}\n`;
}
