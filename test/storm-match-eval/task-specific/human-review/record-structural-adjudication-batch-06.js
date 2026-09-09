import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ADJUDICATION_BATCH_06_ITEM_IDS,
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

export const STRUCTURAL_ADJUDICATION_BATCH_06_RECORDED_AT = '2026-09-09T16:10:54.641Z';
export const DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_06_LOG_PATH = join(
  DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
  'adjudication',
  'records',
  'adjudication-batch-06-scenario-families-03.human-adjudication-log.json'
);

export const STRUCTURAL_ADJUDICATION_BATCH_06_DOCTRINE = Object.freeze({
  provenance: HUMAN_ADJUDICATION_PROVENANCE,
  decisionTask: 'STRUCTURAL_SCENARIO_FAMILY_ADJUDICATION',
  futureRuleRequired: true,
  generatedUserFormulationsAvailable: false,
  generationAuthorized: false
});

const SOURCE_REVIEWER_SEALS = Object.freeze({
  reviewerA: '79ea358a594c5b91eee9e5fe453582cb515f11d542571816981b2b2155fde5a8',
  reviewerB: '3b24eefdf1b200fc94ebbd83003a796aa3fc1593d55efbbf0a4cf86749438549'
});

function scenarioFamilyDecision(disposition, canonicalPartition, mergeCanonicalReviewItemIds = []) {
  return {
    fragmentationAssessment: {
      value: disposition,
      mergeCanonicalReviewItemIds: [...mergeCanonicalReviewItemIds]
    },
    reviewerScenarioFamilyPartition: {
      value: 'reviewerDefinedFamilyGroups',
      canonicalPartition: canonicalPartition.map(group => [...group])
    }
  };
}

export const STRUCTURAL_ADJUDICATION_BATCH_06_EVENTS = Object.freeze([
  Object.freeze({
    sourceItemId: 'scenario-family-preflight-24',
    decision: scenarioFamilyDecision('mergeWithAnotherDisplayedBrief', [
      ['equinoxe-q026'],
      ['equinoxe-q028'],
      ['equinoxe-q029'],
      ['equinoxe-q031'],
      ['equinoxe-q076']
    ], ['scenario-family-preflight-34']),
    humanRationale: 'Les deux briefs portent le même problème structurel de capacité lorsque le référent n’est pas suffisamment précisé. Le preflight-34 est retenu comme ancre canonique. Les connaissances restent toutefois séparées par objet/référent : q026 est une comparaison Focus/Bibliothèque et ne doit pas être assimilée à une demande de capacité au seul motif que sa réponse contient une valeur numérique ; q028, q029 et q031 portent des capacités de types d’espaces distincts ; q076 porte sur le nombre de collaborateurs concernés par le projet et non sur la capacité d’un espace.',
    futureRule: 'Fusionner les displayed briefs qui représentent la même ambiguïté de capacité sans référent, mais partitionner les connaissances par objet métier. Ne jamais intégrer une connaissance dans une famille de capacité uniquement parce que sa réponse contient un nombre ou une capacité incidente.'
  }),
  Object.freeze({
    sourceItemId: 'scenario-family-preflight-25',
    decision: scenarioFamilyDecision('distinct', [
      ['equinoxe-q028', 'equinoxe-q029', 'equinoxe-q031']
    ]),
    humanRationale: 'Choisir un espace pour un groupe de six à dix personnes constitue un scénario utilisateur propre : il faut confronter plusieurs espaces possibles selon leur capacité et leur finalité. Ce besoin de sélection est distinct d’une simple demande de capacité ou d’une comparaison générique entre types d’espaces.',
    futureRule: 'Conserver comme famille distincte une demande de choix d’espace fondée sur une taille de groupe lorsque plusieurs options doivent être comparées dans une même décision utilisateur. Ne pas la fusionner automatiquement avec les familles qui décrivent seulement les propriétés ou capacités individuelles de ces espaces.'
  }),
  Object.freeze({
    sourceItemId: 'scenario-family-preflight-27',
    decision: scenarioFamilyDecision('tooBroad', [
      ['equinoxe-q025'],
      ['equinoxe-q027'],
      ['equinoxe-q050', 'equinoxe-q051', 'equinoxe-q099']
    ]),
    humanRationale: 'Le brief agrège trois besoins fonctionnels différents : concentration au calme, appel rapide sans déranger, et confidentialité. Le fait que certains espaces recommandés se recouvrent ne transforme pas ces besoins en une seule situation utilisateur. q050, q051 et q099 restent ensemble conformément à leur groupe d’équivalence scellé.',
    futureRule: 'Partitionner les besoins d’espace selon l’intention fonctionnelle recherchée — concentration, appel court, confidentialité, etc. — même lorsque plusieurs intentions peuvent conduire vers certains des mêmes types d’espaces. Préserver les groupes d’équivalence scellés.'
  }),
  Object.freeze({
    sourceItemId: 'scenario-family-preflight-28',
    decision: scenarioFamilyDecision('tooBroad', [
      ['equinoxe-q050', 'equinoxe-q051', 'equinoxe-q099'],
      ['equinoxe-q052'],
      ['equinoxe-q091']
    ]),
    humanRationale: 'Le brief réunit trois dimensions métier distinctes : confidentialité d’un échange, performance d’isolation acoustique d’une Project Room et degré de fermeture physique d’un espace Focus. Leur proximité lexicale autour de l’isolation ou de l’ouverture ne constitue pas une même situation utilisateur.',
    futureRule: 'Séparer les familles portant sur la confidentialité d’usage, les propriétés acoustiques et les propriétés physiques ou de fermeture d’un espace. Ne pas créer de famille commune sur la seule proximité lexicale entre ouvert, fermé, isolé ou confidentiel.'
  }),
  Object.freeze({
    sourceItemId: 'scenario-family-preflight-30',
    decision: scenarioFamilyDecision('tooBroad', [
      ['equinoxe-q019', 'equinoxe-q053'],
      ['equinoxe-q022'],
      ['equinoxe-q089'],
      ['equinoxe-q090']
    ]),
    humanRationale: 'Créer une réservation, vérifier une disponibilité et annuler une réservation sont des opérations distinctes du cycle de réservation. La création doit en outre rester partitionnée par type de ressource lorsque les règles diffèrent. q019 et q053 restent ensemble conformément à leur groupe d’équivalence scellé.',
    futureRule: 'Structurer les familles de réservation d’abord par opération utilisateur — créer, vérifier, modifier ou annuler — puis, lorsque nécessaire, par type de ressource si les règles métier diffèrent. Préserver les équivalences déjà scellées.'
  }),
  Object.freeze({
    sourceItemId: 'scenario-family-preflight-31',
    decision: scenarioFamilyDecision('distinct', [
      ['equinoxe-q019', 'equinoxe-q028', 'equinoxe-q053'],
      ['equinoxe-q022', 'equinoxe-q031', 'equinoxe-q052']
    ]),
    humanRationale: 'La distinction entre salle de réunion générique et Project Room constitue une frontière métier réelle et suffisamment complète pour former une famille distincte. Les connaissances doivent être partitionnées selon le type d’espace : réservation et capacité côté salle générique ; réservation, capacité et isolation côté Project Room.',
    futureRule: 'Lorsqu’un brief vise explicitement à distinguer deux types d’espaces métier, conserver la famille si cette frontière est cohérente et utile, mais partitionner les connaissances par type d’espace plutôt que de les agréger en un bloc unique.'
  }),
  Object.freeze({
    sourceItemId: 'scenario-family-preflight-32',
    decision: scenarioFamilyDecision('tooBroad', [
      ['equinoxe-q025'],
      ['equinoxe-q027'],
      ['equinoxe-q029'],
      ['equinoxe-q052']
    ]),
    humanRationale: 'Un brief générique sur l’usage d’un espace agrège ici plusieurs finalités substantiellement distinctes : concentration, appel rapide, événement/prise de parole et travail de projet en petit groupe. Il ne constitue pas une situation utilisateur suffisamment homogène et ne doit pas être fusionné avec le preflight-27, lui-même trop large.',
    futureRule: 'Partitionner les usages d’espace selon l’activité ou le besoin recherché lorsque les espaces répondent à des finalités métier différentes. Ne pas fusionner deux briefs génériques simplement parce qu’ils partagent le schéma abstrait “quel espace utiliser”.'
  }),
  Object.freeze({
    sourceItemId: 'scenario-family-preflight-34',
    decision: scenarioFamilyDecision('distinct', [
      ['equinoxe-q028'],
      ['equinoxe-q029'],
      ['equinoxe-q031'],
      ['equinoxe-q076']
    ]),
    humanRationale: 'Ce brief est retenu comme ancre canonique du problème de capacité lorsque le référent n’est pas suffisamment précisé. Les connaissances restent séparées par référent : salle de réunion, Forum, Project Room et population du projet Cobalt. q076 mesure un périmètre humain et non la capacité physique d’un espace.',
    futureRule: 'Pour une demande de capacité sans référent explicite, conserver la famille d’ambiguïté mais partitionner par objet métier ou type de quantité. Distinguer explicitement capacité d’espace, capacité d’un lieu nommé et nombre de personnes concernées par un projet.'
  })
]);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function buildStructuralAdjudicationBatch06Log({ generatedRoot = DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT } = {}) {
  const matrix = readJson(join(generatedRoot, 'adjudication', 'reviewer-ab-comparison-matrix.json'));
  if (matrix.matrixFingerprint !== EXPECTED_COMPARISON_MATRIX_FINGERPRINT) {
    throw new Error('Unexpected structural comparison matrix fingerprint');
  }
  let log = createEmptyStructuralAdjudicationLog({
    batchId: 'adjudication-batch-06-scenario-families-03',
    sourceMatrix: matrix,
    sourceReviewerSeals: SOURCE_REVIEWER_SEALS,
    authorizedSourceItemIds: ADJUDICATION_BATCH_06_ITEM_IDS,
    humanDoctrine: STRUCTURAL_ADJUDICATION_BATCH_06_DOCTRINE
  });
  for (let index = 0; index < STRUCTURAL_ADJUDICATION_BATCH_06_EVENTS.length; index += 1) {
    const source = STRUCTURAL_ADJUDICATION_BATCH_06_EVENTS[index];
    log = constructStructuralAdjudicationLogWithEvent(log, {
      eventId: `adjudication-batch-06-event-${String(index + 1).padStart(3, '0')}`,
      sourceItemId: source.sourceItemId,
      decision: source.decision,
      humanRationale: source.humanRationale,
      futureRule: source.futureRule,
      recordedAt: STRUCTURAL_ADJUDICATION_BATCH_06_RECORDED_AT,
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

export function materialiseStructuralAdjudicationBatch06Log({
  generatedRoot = DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
  outputPath = DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_06_LOG_PATH,
  checkOnly = false
} = {}) {
  const expectedLog = buildStructuralAdjudicationBatch06Log({ generatedRoot });
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
    recordedAt: STRUCTURAL_ADJUDICATION_BATCH_06_RECORDED_AT,
    sourceMatrixFingerprint: expectedLog.sourceMatrixFingerprint,
    status: expectedLog.status
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = materialiseStructuralAdjudicationBatch06Log({ checkOnly: process.argv.includes('--check') });
  process.stdout.write(`${canonicalJson(result)}\n`);
}
