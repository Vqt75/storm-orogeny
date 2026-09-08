import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ADJUDICATION_BATCH_02_ITEM_IDS,
  DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
  EXPECTED_COMPARISON_MATRIX_FINGERPRINT
} from './generate-structural-adjudication-batch.js';
import { canonicalJson } from './review-packets.js';
import {
  constructStructuralAdjudicationLogWithEvent,
  createEmptyStructuralAdjudicationLog,
  evaluateStructuralAdjudicationCompleteness,
  HUMAN_ADJUDICATION_PROVENANCE,
  validateStructuralAdjudicationLog
} from './structural-adjudication-log.js';

export const STRUCTURAL_ADJUDICATION_BATCH_02_RECORDED_AT = '2026-09-08T09:54:21.040Z';
export const DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_02_LOG_PATH = join(
  DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
  'adjudication',
  'records',
  'adjudication-batch-02-ambiguities-01.human-adjudication-log.json'
);

export const STRUCTURAL_ADJUDICATION_BATCH_02_DOCTRINE = Object.freeze({
  provenance: HUMAN_ADJUDICATION_PROVENANCE,
  decisionTask: 'STRUCTURAL_AMBIGUITY_FAMILY_ADJUDICATION',
  futureRuleRequired: true,
  generatedUserFormulationsAvailable: false,
  generationAuthorized: false
});

const SOURCE_REVIEWER_SEALS = Object.freeze({
  reviewerA: '79ea358a594c5b91eee9e5fe453582cb515f11d542571816981b2b2155fde5a8',
  reviewerB: '3b24eefdf1b200fc94ebbd83003a796aa3fc1593d55efbbf0a4cf86749438549'
});

function ambiguityDecision(classification, mechanism = null, partition = null) {
  const structural = classification === 'structuralAmbiguity';
  return {
    ambiguityFamilyDisposition: { value: classification },
    ambiguityMechanism: { value: structural ? mechanism : null },
    substantiallyDifferentCoveredGroups: {
      value: structural ? 'reviewerDefinedPartitionOfDisplayedKnowledge' : null,
      canonicalPartition: structural ? partition.map(group => [...group]) : null
    }
  };
}

export const STRUCTURAL_ADJUDICATION_BATCH_02_EVENTS = Object.freeze([
  Object.freeze({
    sourceItemId: 'ambiguity-capacity-01',
    decision: ambiguityDecision('structuralAmbiguity', 'underspecifiedReference', [
      ['equinoxe-q010', 'equinoxe-q012', 'equinoxe-q015'],
      ['equinoxe-q014']
    ]),
    humanRationale: 'La stabilité du quartier d’équipe et la permanence d’un poste individuel sont deux réalités distinctes. L’ambiguïté vient surtout du référent insuffisamment précisé d’une « place » ou « position stable » : le quartier est stable, le poste individuel reste non nominatif et choisi quotidiennement.',
    futureRule: 'Quand une même notion spatiale peut désigner le poste individuel ou la zone d’équipe, traiter comme `underspecifiedReference`; ne jamais confondre stabilité du quartier et attribution nominative du poste.'
  }),
  Object.freeze({
    sourceItemId: 'ambiguity-capacity-03',
    decision: ambiguityDecision('artificialOrMalformed'),
    humanRationale: 'Wifi et branchement physique du poste sont deux sujets IT distincts rapprochés principalement par le terme générique « connexion ». En l’absence d’une formulation utilisateur réelle qui crée effectivement cette hésitation, la famille fabrique une ambiguïté lexicale plutôt qu’une ambiguïté métier.',
    futureRule: 'Une proximité lexicale seule ne suffit pas à créer une famille d’ambiguïté : les lectures doivent correspondre à une ambiguïté métier plausible, pas simplement partager un mot générique.'
  }),
  Object.freeze({
    sourceItemId: 'ambiguity-capacity-05',
    decision: ambiguityDecision('blockedTemporalInstability'),
    humanRationale: 'La recharge des vélos électriques est confirmée, tandis que les modalités de stationnement/recharge automobile restent explicitement à préciser. Les deux branches ne constituent donc pas encore deux groupes métier suffisamment stabilisés pour générer une ambiguïté fiable.',
    futureRule: 'Une branche dont la connaissance substantielle est encore explicitement reportée ne constitue pas un groupe couvert stable pour générer une ambiguïté, sauf si « l’information n’est pas encore disponible » est elle-même la vérité canonique recherchée.'
  }),
  Object.freeze({
    sourceItemId: 'ambiguity-capacity-06',
    decision: ambiguityDecision('structuralAmbiguity', 'underspecifiedReference', [
      ['equinoxe-q035', 'equinoxe-q036', 'equinoxe-q094', 'equinoxe-q095'],
      ['equinoxe-q037', 'equinoxe-q073']
    ]),
    humanRationale: 'Le corpus distingue réellement deux objets : les casiers personnels associés aux effets personnels et les casiers situés à proximité du local vélos. Une référence générique à un « casier » ou rangement sans contexte peut viser l’un ou l’autre.',
    futureRule: 'Lorsqu’un même nom d’équipement désigne plusieurs objets physiques distincts selon leur localisation ou leur usage, exiger le contexte et traiter comme `underspecifiedReference`.'
  }),
  Object.freeze({
    sourceItemId: 'ambiguity-capacity-07',
    decision: ambiguityDecision('structuralAmbiguity', 'underspecifiedReference', [
      ['equinoxe-q003'],
      ['equinoxe-q004', 'equinoxe-q005', 'equinoxe-q007', 'equinoxe-q108']
    ]),
    humanRationale: '`q003` porte sur la stabilité générale du calendrier. Les quatre autres entrées décrivent ensemble le parcours de préparation avant déménagement : semaine de préparation, visites, anticipation et autres étapes. Les éclater en groupes distincts par jalon serait une granularité artificiellement fine.',
    futureRule: 'Partitionner au niveau de l’intention métier, pas automatiquement au niveau de chaque date ou jalon : plusieurs étapes peuvent constituer un même groupe « préparation », distinct de la question de stabilité générale du calendrier.'
  }),
  Object.freeze({
    sourceItemId: 'ambiguity-capacity-10',
    decision: ambiguityDecision('artificialOrMalformed'),
    humanRationale: 'Finalité conviviale, offre alimentaire et accessibilité tout au long de la journée sont des attributs complémentaires du même Café central. Ils peuvent être restitués ensemble et ne forcent pas un choix entre des réponses substantiellement différentes.',
    futureRule: 'Des facettes complémentaires d’un même lieu ne constituent pas une ambiguïté structurelle si elles peuvent être restituées ensemble sans contradiction ni choix d’intention exclusif.'
  }),
  Object.freeze({
    sourceItemId: 'ambiguity-capacity-11',
    decision: ambiguityDecision('structuralAmbiguity', 'alternativeIntentReadings', [
      ['equinoxe-q032'],
      ['equinoxe-q064']
    ]),
    humanRationale: 'La terrasse peut servir aux échanges informels et au déjeuner extérieur. Ces connaissances ne sont pas concurrentes ou contradictoires. Elles représentent deux intentions compatibles mais différentes qu’une formulation insuffisamment spécifique sur « l’usage de la terrasse » peut viser.',
    futureRule: 'Des usages compatibles ne sont jamais `competingPublishedKnowledge`; s’ils représentent des intentions distinctes sous une formulation réellement ambiguë, utiliser `alternativeIntentReadings`.'
  }),
  Object.freeze({
    sourceItemId: 'ambiguity-capacity-13',
    decision: ambiguityDecision('blockedTemporalInstability'),
    humanRationale: 'L’existence d’une offre chaude/végétarienne/rapide est confirmée, mais le détail du menu et l’offre précise de snack/restauration rapide restent explicitement reportés. La famille mélange donc un fait stable avec des branches dont la connaissance substantielle n’est pas encore stabilisée.',
    futureRule: 'Ne construire une famille multi-branche d’offre que lorsque chaque branche possède une connaissance substantielle suffisamment stabilisée ; une promesse de précision future ne vaut pas automatiquement couverture stable.'
  }),
  Object.freeze({
    sourceItemId: 'ambiguity-capacity-14',
    decision: ambiguityDecision('artificialOrMalformed'),
    humanRationale: '`q072` couvre déjà l’intention générale de choix d’un lieu de déjeuner. `q064` affine le cas spécifique du déjeuner en terrasse et `q092` ajoute une contrainte d’usage concernant les postes de travail. Il s’agit d’une structure général → cas particulier → règle, pas de trois lectures qu’il faudrait nécessairement départager.',
    futureRule: 'Lorsqu’une entrée générale couvre l’intention et que les autres sont des raffinements ou contraintes, ne pas fabriquer une ambiguïté simplement parce que plusieurs Q&A concernent le même domaine.'
  }),
  Object.freeze({
    sourceItemId: 'ambiguity-capacity-16',
    decision: ambiguityDecision('structuralAmbiguity', 'alternativeIntentReadings', [
      ['equinoxe-q040', 'equinoxe-q042', 'equinoxe-q043'],
      ['equinoxe-q044']
    ]),
    humanRationale: '`q040`, `q042` et `q043` expriment une même vérité de portée projet : Cobalt ne modifie pas les règles de télétravail ni n’impose de présence minimale. `q044` relève d’une autre source d’autorité : les règles en vigueur dans l’équipe et l’autorité managériale. La bonne partition est donc la source de la règle, pas la formulation de surface.',
    futureRule: 'Pour les règles d’organisation du travail, partitionner d’abord par source d’autorité : règle du projet vs règle de l’équipe/du manager, plutôt que par vocabulaire de surface.'
  })
]);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function buildStructuralAdjudicationBatch02Log({ generatedRoot = DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT } = {}) {
  const matrix = readJson(join(generatedRoot, 'adjudication', 'reviewer-ab-comparison-matrix.json'));
  if (matrix.matrixFingerprint !== EXPECTED_COMPARISON_MATRIX_FINGERPRINT) {
    throw new Error('Unexpected structural comparison matrix fingerprint');
  }
  let log = createEmptyStructuralAdjudicationLog({
    batchId: 'adjudication-batch-02-ambiguities-01',
    sourceMatrix: matrix,
    sourceReviewerSeals: SOURCE_REVIEWER_SEALS,
    authorizedSourceItemIds: ADJUDICATION_BATCH_02_ITEM_IDS,
    humanDoctrine: STRUCTURAL_ADJUDICATION_BATCH_02_DOCTRINE
  });
  for (let index = 0; index < STRUCTURAL_ADJUDICATION_BATCH_02_EVENTS.length; index += 1) {
    const source = STRUCTURAL_ADJUDICATION_BATCH_02_EVENTS[index];
    log = constructStructuralAdjudicationLogWithEvent(log, {
      eventId: `adjudication-batch-02-event-${String(index + 1).padStart(3, '0')}`,
      sourceItemId: source.sourceItemId,
      decision: source.decision,
      humanRationale: source.humanRationale,
      futureRule: source.futureRule,
      recordedAt: STRUCTURAL_ADJUDICATION_BATCH_02_RECORDED_AT,
      provenance: HUMAN_ADJUDICATION_PROVENANCE
    }, matrix);
  }
  const validation = validateStructuralAdjudicationLog(log, matrix);
  const completeness = evaluateStructuralAdjudicationCompleteness(log, matrix);
  if (!validation.ok || !completeness.complete) {
    throw new Error(`Generated structural adjudication log is invalid or incomplete: ${canonicalJson({ validation, completeness })}`);
  }
  return log;
}

export function materialiseStructuralAdjudicationBatch02Log({
  generatedRoot = DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
  outputPath = DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_02_LOG_PATH,
  checkOnly = false
} = {}) {
  const expectedLog = buildStructuralAdjudicationBatch02Log({ generatedRoot });
  const expected = `${JSON.stringify(expectedLog, null, 2)}\n`;
  if (existsSync(outputPath)) {
    const actual = readFileSync(outputPath, 'utf8').replace(/\r\n/g, '\n');
    if (actual !== expected.replace(/\r\n/g, '\n')) {
      throw new Error(`Existing structural adjudication log differs from expected transcription: ${outputPath}`);
    }
  } else if (checkOnly) {
    throw new Error(`Missing structural adjudication log: ${outputPath}`);
  } else {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, expected, { encoding: 'utf8', flag: 'wx' });
  }
  return {
    batchId: expectedLog.batchId,
    checkOnly,
    eventCount: expectedLog.events.length,
    finalEventHash: expectedLog.events.at(-1)?.eventHash ?? null,
    generationAuthorized: expectedLog.generationAuthorized,
    logFingerprint: expectedLog.logFingerprint,
    recordedAt: STRUCTURAL_ADJUDICATION_BATCH_02_RECORDED_AT,
    sourceMatrixFingerprint: expectedLog.sourceMatrixFingerprint,
    status: expectedLog.status
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = materialiseStructuralAdjudicationBatch02Log({ checkOnly: process.argv.includes('--check') });
  process.stdout.write(`${canonicalJson(result)}\n`);
}
