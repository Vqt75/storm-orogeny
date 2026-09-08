import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ADJUDICATION_BATCH_04_ITEM_IDS,
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

export const STRUCTURAL_ADJUDICATION_BATCH_04_RECORDED_AT = '2026-09-08T15:15:13.437Z';
export const DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_04_LOG_PATH = join(
  DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
  'adjudication',
  'records',
  'adjudication-batch-04-scenario-families-01.human-adjudication-log.json'
);

export const STRUCTURAL_ADJUDICATION_BATCH_04_DOCTRINE = Object.freeze({
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

function canonicalEntryId(entryId) {
  return entryId.startsWith('equinoxe-') ? entryId : `equinoxe-${entryId}`;
}

function scenarioFamilyDecision(disposition, partition) {
  return {
    fragmentationAssessment: {
      value: disposition,
      mergeCanonicalReviewItemIds: []
    },
    reviewerScenarioFamilyPartition: {
      value: 'reviewerDefinedFamilyGroups',
      canonicalPartition: partition.map(group => group.map(canonicalEntryId))
    }
  };
}

export const STRUCTURAL_ADJUDICATION_BATCH_04_EVENTS = Object.freeze([
  Object.freeze({
    sourceItemId: 'scenario-family-preflight-02',
    decision: scenarioFamilyDecision('tooBroad', [['q018'], ['q021']]),
    humanRationale: 'La réservation d’un poste et la déclaration de présence sont deux actions opérationnelles distinctes. Leur rattachement abstrait à « l’organisation de sa venue » n’est pas suffisamment spécifique pour constituer un même scénario utilisateur de génération.',
    futureRule: 'Une catégorie de parcours générale ne suffit pas à former une scenario family lorsque les formulations déclenchent des actions opérationnelles différentes.'
  }),
  Object.freeze({
    sourceItemId: 'scenario-family-preflight-03',
    decision: scenarioFamilyDecision('tooBroad', [['q047'], ['q048']]),
    humanRationale: 'La couverture wifi et le branchement physique du poste sont deux situations techniques différentes, avec des objets et des réponses opérationnelles distincts. Leur rapprochement repose principalement sur la notion générique de « connexion ».\n\nCette décision est cohérente avec la décision scellée `ambiguity-capacity-03`.',
    futureRule: 'Une proximité lexicale ou un domaine technique commun ne suffit pas à constituer une scenario family lorsque les actions, objets et réponses applicables diffèrent.'
  }),
  Object.freeze({
    sourceItemId: 'scenario-family-preflight-04',
    decision: scenarioFamilyDecision('tooBroad', [
      ['q054', 'q055', 'q059', 'q074', 'q101'],
      ['q067']
    ]),
    humanRationale: '`q054`, `q055`, `q059`, `q074` et `q101` décrivent l’accès géographique et la desserte du site. `q067` concerne l’accessibilité PMR du bâtiment. Le terme « accessible » est commun, mais les scénarios utilisateur sont distincts.',
    futureRule: 'Lorsque le même terme métier recouvre l’accès géographique et l’accessibilité fonctionnelle d’un lieu, partitionner selon la nature concrète du besoin utilisateur.'
  }),
  Object.freeze({
    sourceItemId: 'scenario-family-preflight-05',
    decision: scenarioFamilyDecision('distinct', [['q038'], ['q100']]),
    humanRationale: 'La recharge électrique constitue un besoin utilisateur suffisamment cohérent pour former une famille de scénario, mais le type de véhicule est une variable structurante qui détermine la connaissance applicable : vélo électrique pour `q038`, automobile pour `q100`.\n\nLa branche automobile reste temporellement instable conformément à la décision scellée `ambiguity-capacity-05`; cette instabilité ne doit pas être transformée en fausse équivalence avec la branche vélo.',
    futureRule: 'Une scenario family peut représenter un même besoin paramétré par un type de ressource, mais les branches doivent rester explicitement partitionnées lorsque ce paramètre change la connaissance applicable; une branche instable ne devient pas stable par simple appartenance à la famille.'
  }),
  Object.freeze({
    sourceItemId: 'scenario-family-preflight-06',
    decision: scenarioFamilyDecision('tooBroad', [
      ['q035', 'q036', 'q094', 'q095'],
      ['q037', 'q073']
    ]),
    humanRationale: 'Le premier groupe concerne les casiers personnels destinés aux effets personnels et documents. Le second concerne les casiers et équipements situés à proximité du local vélos. Il s’agit de deux objets et contextes d’usage distincts.\n\nCette frontière est déjà établie par la décision scellée `ambiguity-capacity-06`.',
    futureRule: 'Le partage d’un nom d’équipement ne suffit pas à former une scenario family lorsque l’objet physique, le lieu ou l’usage sont différents.'
  }),
  Object.freeze({
    sourceItemId: 'scenario-family-preflight-07',
    decision: scenarioFamilyDecision('tooBroad', [
      ['q003'],
      ['q004', 'q005', 'q007', 'q108']
    ]),
    humanRationale: '`q003` porte sur la stabilité générale du calendrier. `q004`, `q005`, `q007` et `q108` constituent ensemble le parcours de préparation avant déménagement.\n\nCette partition est déjà établie par les décisions scellées `boundary-arrival-preparation` et `ambiguity-capacity-07`.\n\nLes jalons individuels du parcours de préparation ne doivent pas être séparés artificiellement en autant de scenario families.',
    futureRule: 'Partitionner les scenario families au niveau du besoin métier cohérent, pas au niveau de chaque date ou jalon; un parcours de préparation peut réunir plusieurs étapes tout en restant distinct de la stabilité générale du calendrier.'
  }),
  Object.freeze({
    sourceItemId: 'scenario-family-preflight-08',
    decision: scenarioFamilyDecision('tooBroad', [
      ['q066', 'q069', 'q104'],
      ['q067']
    ]),
    humanRationale: '`q066`, `q069` et `q104` relèvent d’un besoin individuel d’adaptation, d’accompagnement ou de contact en matière d’accessibilité, via les circuits RH/santé ou les relais appropriés. `q067` porte sur l’accessibilité générale du site aux personnes à mobilité réduite.\n\nLe groupe d’équivalence scellé `q066/q069` reste inchangé.',
    futureRule: 'Séparer l’accessibilité générale d’un environnement et la démarche individuelle d’adaptation ou d’accompagnement, même lorsqu’elles appartiennent au même domaine d’inclusion.'
  }),
  Object.freeze({
    sourceItemId: 'scenario-family-preflight-09',
    decision: scenarioFamilyDecision('distinct', [['q061'], ['q064']]),
    humanRationale: 'Restaurant et Terrasse appartiennent au même univers d’usage lié au déjeuner, mais les questions portent sur deux ressources et deux besoins différents : capacité du restaurant pour `q061`, possibilité de déjeuner dehors sur la Terrasse pour `q064`.\n\nLa partition doit donc conserver le type de lieu comme variable structurante.',
    futureRule: 'Une scenario family peut regrouper des besoins appartenant au même moment d’usage, mais les branches doivent rester séparées lorsque le lieu ou la ressource modifie substantiellement la question et la réponse.'
  }),
  Object.freeze({
    sourceItemId: 'scenario-family-preflight-10',
    decision: scenarioFamilyDecision('tooBroad', [['q032'], ['q063'], ['q093']]),
    humanRationale: 'Les trois connaissances portent sur le Café central mais répondent à trois besoins utilisateur différents : sa finalité comme espace de convivialité, la possibilité ou l’offre pour manger, et son accessibilité au cours de la journée.\n\nLa décision scellée `ambiguity-capacity-10` établit que ces facettes sont compatibles, mais leur compatibilité ne signifie pas qu’elles constituent un même scénario de génération.',
    futureRule: 'Le fait que plusieurs connaissances décrivent le même lieu ou objet ne suffit pas à former une scenario family; la famille doit être structurée par le besoin utilisateur, pas seulement par l’entité concernée.'
  }),
  Object.freeze({
    sourceItemId: 'scenario-family-preflight-13',
    decision: scenarioFamilyDecision('tooBroad', [
      ['q062', 'q103'],
      ['q102']
    ]),
    humanRationale: '`q062` et `q103` concernent l’offre proposée par le Restaurant. `q102` concerne le besoin d’un snack ou d’une offre de restauration rapide/distributeur et constitue un scénario différent.\n\nLa décision scellée `ambiguity-capacity-13` reste applicable : le détail de certaines offres est encore temporellement instable et cette instabilité ne doit pas être masquée par le regroupement.',
    futureRule: 'Regrouper les formulations autour d’une même offre ou ressource lorsque le besoin utilisateur reste cohérent, mais séparer les modes de restauration substantiellement différents; l’appartenance à une scenario family ne transforme jamais une connaissance différée en connaissance stable.'
  })
]);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function buildStructuralAdjudicationBatch04Log({ generatedRoot = DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT } = {}) {
  const matrix = readJson(join(generatedRoot, 'adjudication', 'reviewer-ab-comparison-matrix.json'));
  if (matrix.matrixFingerprint !== EXPECTED_COMPARISON_MATRIX_FINGERPRINT) {
    throw new Error('Unexpected structural comparison matrix fingerprint');
  }
  let log = createEmptyStructuralAdjudicationLog({
    batchId: 'adjudication-batch-04-scenario-families-01',
    sourceMatrix: matrix,
    sourceReviewerSeals: SOURCE_REVIEWER_SEALS,
    authorizedSourceItemIds: ADJUDICATION_BATCH_04_ITEM_IDS,
    humanDoctrine: STRUCTURAL_ADJUDICATION_BATCH_04_DOCTRINE
  });
  for (let index = 0; index < STRUCTURAL_ADJUDICATION_BATCH_04_EVENTS.length; index += 1) {
    const source = STRUCTURAL_ADJUDICATION_BATCH_04_EVENTS[index];
    log = constructStructuralAdjudicationLogWithEvent(log, {
      eventId: `adjudication-batch-04-event-${String(index + 1).padStart(3, '0')}`,
      sourceItemId: source.sourceItemId,
      decision: source.decision,
      humanRationale: source.humanRationale,
      futureRule: source.futureRule,
      recordedAt: STRUCTURAL_ADJUDICATION_BATCH_04_RECORDED_AT,
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

export function materialiseStructuralAdjudicationBatch04Log({
  generatedRoot = DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
  outputPath = DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_04_LOG_PATH,
  checkOnly = false
} = {}) {
  const expectedLog = buildStructuralAdjudicationBatch04Log({ generatedRoot });
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
    recordedAt: STRUCTURAL_ADJUDICATION_BATCH_04_RECORDED_AT,
    sourceMatrixFingerprint: expectedLog.sourceMatrixFingerprint,
    status: expectedLog.status
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = materialiseStructuralAdjudicationBatch04Log({ checkOnly: process.argv.includes('--check') });
  process.stdout.write(`${canonicalJson(result)}\n`);
}
