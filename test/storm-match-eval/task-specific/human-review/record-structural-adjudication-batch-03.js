import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ADJUDICATION_BATCH_03_ITEM_IDS,
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

export const STRUCTURAL_ADJUDICATION_BATCH_03_RECORDED_AT = '2026-09-08T11:10:43.499Z';
export const DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_03_LOG_PATH = join(
  DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
  'adjudication',
  'records',
  'adjudication-batch-03-ambiguities-02.human-adjudication-log.json'
);

export const STRUCTURAL_ADJUDICATION_BATCH_03_DOCTRINE = Object.freeze({
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

export const STRUCTURAL_ADJUDICATION_BATCH_03_EVENTS = Object.freeze([
  Object.freeze({
    sourceItemId: 'ambiguity-capacity-17',
    decision: ambiguityDecision('artificialOrMalformed'),
    humanRationale: 'La date d’ouverture, le rôle expérimental du plateau témoin et la collecte des retours sont des propriétés complémentaires du même dispositif. Elles peuvent être expliquées ensemble et ne forcent pas un choix entre plusieurs réponses substantiellement concurrentes.',
    futureRule: 'Des attributs complémentaires d’un même dispositif ne forment pas une ambiguïté structurelle lorsqu’ils peuvent être expliqués ensemble sans contradiction ni choix exclusif.'
  }),
  Object.freeze({
    sourceItemId: 'ambiguity-capacity-18',
    decision: ambiguityDecision('structuralAmbiguity', 'alternativeIntentReadings', [
      ['equinoxe-q079', 'equinoxe-q110'],
      ['equinoxe-q111']
    ]),
    humanRationale: '`q079` et `q110` décrivent la phase d’essai et de collecte des retours avant le déménagement définitif. `q111` décrit l’observation et les ajustements possibles après l’emménagement. Une demande générale sur la possibilité de tester ou faire évoluer le projet peut donc viser deux phases métier différentes.',
    futureRule: 'Quand une possibilité d’ajustement existe à plusieurs phases du projet, partitionner par phase métier si les mécanismes et temporalités de décision diffèrent substantiellement.'
  }),
  Object.freeze({
    sourceItemId: 'ambiguity-capacity-19',
    decision: ambiguityDecision('artificialOrMalformed'),
    humanRationale: 'Poser une question à tout moment et recevoir les actualités ou jalons sont deux flux de communication distincts dans Storm. Leur rapprochement provient du thème général de la communication projet, mais ils ne constituent pas des réponses concurrentes à une même lecture métier.',
    futureRule: 'Le fait que plusieurs fonctions passent par le même canal ou outil ne suffit pas à créer une ambiguïté entre elles.'
  }),
  Object.freeze({
    sourceItemId: 'ambiguity-capacity-20',
    decision: ambiguityDecision('artificialOrMalformed'),
    humanRationale: 'Le rôle des ambassadeurs, leur présence au sein des services et leur mode de désignation décrivent de manière compatible le même dispositif. Ces informations sont complémentaires et peuvent être restituées conjointement.',
    futureRule: 'Des informations complémentaires décrivant identité, localisation, rôle ou mode de désignation d’un même acteur ne doivent pas être séparées en lectures concurrentes.'
  }),
  Object.freeze({
    sourceItemId: 'ambiguity-capacity-21',
    decision: ambiguityDecision('artificialOrMalformed'),
    humanRationale: 'Poser une question non couverte et proposer une amélioration sont deux intentions différentes, mais elles conduisent ici à la même orientation opérationnelle : contacter un ambassadeur du service ou l’équipe projet. La bifurcation n’entraîne donc pas de réponse substantiellement différente.',
    futureRule: 'Deux intentions lexicalement différentes ne forment pas une ambiguïté utile si elles conduisent à la même action ou réponse canonique.'
  }),
  Object.freeze({
    sourceItemId: 'ambiguity-capacity-22',
    decision: ambiguityDecision('artificialOrMalformed'),
    humanRationale: 'Suivre les actualités, donner du feedback, constater l’évolution du projet et proposer une idée sont plusieurs formes d’interaction avec le projet agrégées sous un thème très large. Aucun référent ou intention unique ne crée ici une hésitation plausible entre réponses substantiellement différentes.',
    futureRule: 'Ne pas transformer une catégorie thématique large en famille d’ambiguïté : il faut une formulation plausible pouvant réellement hésiter entre plusieurs réponses substantielles.'
  }),
  Object.freeze({
    sourceItemId: 'ambiguity-capacity-25',
    decision: ambiguityDecision('structuralAmbiguity', 'alternativeIntentReadings', [
      ['equinoxe-q028'],
      ['equinoxe-q029'],
      ['equinoxe-q031']
    ]),
    humanRationale: 'Un groupe de six à dix personnes entre dans la capacité d’une salle de réunion, d’une Project Room et d’un Forum. Ces connaissances ne sont pas concurrentes ou contradictoires : le bon choix dépend de la finalité du groupe — réunion, travail projet ou événement/prise de parole — qui n’est pas exprimée par la seule taille.',
    futureRule: 'Quand plusieurs espaces satisfont une contrainte quantitative, l’ambiguïté porte sur l’usage recherché ; des capacités qui se recouvrent ne constituent pas une contradiction de connaissance.'
  }),
  Object.freeze({
    sourceItemId: 'ambiguity-capacity-29',
    decision: ambiguityDecision('artificialOrMalformed'),
    humanRationale: 'Le terme « libre/ouvert » recouvre ici trois significations portant sur trois objets différents : accès sans réservation à la Bibliothèque, disponibilité instantanée d’une salle, et degré d’ouverture physique d’un espace Focus. La proximité est lexicale, pas métier.',
    futureRule: 'La polysémie d’un mot générique ne constitue pas une ambiguïté structurelle lorsque chaque sens porte sur un objet métier différent et clairement identifiable.'
  }),
  Object.freeze({
    sourceItemId: 'ambiguity-capacity-30',
    decision: ambiguityDecision('structuralAmbiguity', 'alternativeIntentReadings', [
      ['equinoxe-q019', 'equinoxe-q053'],
      ['equinoxe-q022'],
      ['equinoxe-q089'],
      ['equinoxe-q090']
    ]),
    humanRationale: 'Le domaine réservation comprend plusieurs opérations distinctes : créer, vérifier une disponibilité et annuler. En outre, la création d’une réservation n’obéit pas aux mêmes règles pour une salle de réunion (`q019/q053`) et une Project Room (`q022`). La partition doit donc conserver cette différence métier plutôt que fusionner toutes les créations.',
    futureRule: 'Dans un domaine transactionnel, partitionner d’abord par opération puis, si nécessaire, par type de ressource lorsque les règles opérationnelles diffèrent.'
  }),
  Object.freeze({
    sourceItemId: 'ambiguity-capacity-33',
    decision: ambiguityDecision('artificialOrMalformed'),
    humanRationale: 'Le nombre de niveaux du bâtiment et le nombre de collaborateurs concernés sont deux quantités portant sur des objets métier sans rapport. Leur seule similarité est la structure interrogative de comptage.',
    futureRule: 'Une structure interrogative ou quantitative commune ne suffit jamais à créer une ambiguïté lorsque les objets mesurés sont métierment distincts.'
  })
]);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function buildStructuralAdjudicationBatch03Log({ generatedRoot = DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT } = {}) {
  const matrix = readJson(join(generatedRoot, 'adjudication', 'reviewer-ab-comparison-matrix.json'));
  if (matrix.matrixFingerprint !== EXPECTED_COMPARISON_MATRIX_FINGERPRINT) {
    throw new Error('Unexpected structural comparison matrix fingerprint');
  }
  let log = createEmptyStructuralAdjudicationLog({
    batchId: 'adjudication-batch-03-ambiguities-02',
    sourceMatrix: matrix,
    sourceReviewerSeals: SOURCE_REVIEWER_SEALS,
    authorizedSourceItemIds: ADJUDICATION_BATCH_03_ITEM_IDS,
    humanDoctrine: STRUCTURAL_ADJUDICATION_BATCH_03_DOCTRINE
  });
  for (let index = 0; index < STRUCTURAL_ADJUDICATION_BATCH_03_EVENTS.length; index += 1) {
    const source = STRUCTURAL_ADJUDICATION_BATCH_03_EVENTS[index];
    log = constructStructuralAdjudicationLogWithEvent(log, {
      eventId: `adjudication-batch-03-event-${String(index + 1).padStart(3, '0')}`,
      sourceItemId: source.sourceItemId,
      decision: source.decision,
      humanRationale: source.humanRationale,
      futureRule: source.futureRule,
      recordedAt: STRUCTURAL_ADJUDICATION_BATCH_03_RECORDED_AT,
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

export function materialiseStructuralAdjudicationBatch03Log({
  generatedRoot = DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
  outputPath = DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_03_LOG_PATH,
  checkOnly = false
} = {}) {
  const expectedLog = buildStructuralAdjudicationBatch03Log({ generatedRoot });
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
    recordedAt: STRUCTURAL_ADJUDICATION_BATCH_03_RECORDED_AT,
    sourceMatrixFingerprint: expectedLog.sourceMatrixFingerprint,
    status: expectedLog.status
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = materialiseStructuralAdjudicationBatch03Log({ checkOnly: process.argv.includes('--check') });
  process.stdout.write(`${canonicalJson(result)}\n`);
}
