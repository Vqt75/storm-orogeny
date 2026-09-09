import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ADJUDICATION_BATCH_05_ITEM_IDS,
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

export const STRUCTURAL_ADJUDICATION_BATCH_05_RECORDED_AT = '2026-09-08T18:39:02.138Z';
export const DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_05_LOG_PATH = join(
  DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
  'adjudication',
  'records',
  'adjudication-batch-05-scenario-families-02.human-adjudication-log.json'
);

export const STRUCTURAL_ADJUDICATION_BATCH_05_DOCTRINE = Object.freeze({
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

function scenarioFamilyDecision(disposition, partition, mergeCanonicalReviewItemIds = []) {
  return {
    fragmentationAssessment: {
      value: disposition,
      mergeCanonicalReviewItemIds: [...mergeCanonicalReviewItemIds]
    },
    reviewerScenarioFamilyPartition: {
      value: 'reviewerDefinedFamilyGroups',
      canonicalPartition: partition.map(group => group.map(canonicalEntryId))
    }
  };
}

export const STRUCTURAL_ADJUDICATION_BATCH_05_EVENTS = Object.freeze([
  Object.freeze({
    sourceItemId: 'scenario-family-preflight-14',
    decision: scenarioFamilyDecision('distinct', [['q064', 'q072', 'q092']]),
    humanRationale: '`q072` couvre l’intention générale de choisir où déjeuner, `q064` en est un cas particulier concernant la Terrasse, et `q092` apporte une règle d’usage concernant les postes de travail.\n\nCes connaissances constituent une structure cohérente général → cas particulier → contrainte et peuvent appartenir à une même scenario family.\n\nCette décision est cohérente avec la décision scellée `ambiguity-capacity-14`, qui établit précisément que ces connaissances ne représentent pas trois lectures concurrentes.',
    futureRule: 'Une connaissance générale, ses raffinements contextuels et les contraintes qui l’encadrent peuvent appartenir à une même scenario family lorsqu’elles décrivent un même besoin utilisateur sans changer substantiellement l’intention.'
  }),
  Object.freeze({
    sourceItemId: 'scenario-family-preflight-16',
    decision: scenarioFamilyDecision('mergeWithAnotherDisplayedBrief', [
      ['q040', 'q042', 'q043'],
      ['q044']
    ], ['scenario-family-preflight-15']),
    humanRationale: '`q040`, `q042` et `q043` portent sur une même vérité de portée projet : Cobalt ne modifie pas les règles de télétravail et n’impose pas de présence minimale.\n\nCe noyau recouvre directement `scenario-family-preflight-15`, qui traite déjà de l’effet du projet sur la fréquence ou l’obligation de présence.\n\n`q044` reste une branche structurellement différente car elle relève de l’autorité de l’équipe ou du manager et non de la règle projet.\n\nCette partition est déjà établie par la décision scellée `ambiguity-capacity-16`.',
    futureRule: 'Fusionner les briefs qui expriment le même effet d’une règle projet sur la présence ou le télétravail, mais conserver une branche distincte lorsque la source d’autorité change — notamment projet versus équipe ou manager.'
  }),
  Object.freeze({
    sourceItemId: 'scenario-family-preflight-17',
    decision: scenarioFamilyDecision('distinct', [['q006', 'q079', 'q110']]),
    humanRationale: 'La date d’ouverture du plateau témoin, son rôle expérimental et l’organisation de la collecte des premiers retours décrivent ensemble le même dispositif pilote.\n\nIls constituent des attributs complémentaires d’une même situation métier et peuvent être générés au sein d’une même scenario family.\n\nCette décision est cohérente avec la décision scellée `ambiguity-capacity-17`, qui conclut que ces éléments peuvent être expliqués ensemble sans concurrence substantielle entre réponses.',
    futureRule: 'Les attributs complémentaires d’un même dispositif expérimental peuvent former une seule scenario family lorsqu’ils décrivent conjointement son existence, son rôle et son fonctionnement sans créer plusieurs intentions métier indépendantes.'
  }),
  Object.freeze({
    sourceItemId: 'scenario-family-preflight-18',
    decision: scenarioFamilyDecision('mergeWithAnotherDisplayedBrief', [
      ['q079', 'q110'],
      ['q111']
    ], ['scenario-family-preflight-17']),
    humanRationale: '`q079` et `q110` appartiennent déjà au scénario du plateau témoin couvert par `scenario-family-preflight-17`.\n\n`q111` prolonge ce même sujet vers une seconde phase : l’observation et les ajustements possibles après l’emménagement.\n\nLe brief ne doit donc pas créer une deuxième famille dupliquant le pilote ; il doit rejoindre la famille 17 tout en conservant la distinction temporelle entre :\n\n* phase d’essai et de feedback avant déménagement;\n* évolution possible après emménagement.\n\nCette partition reprend exactement la décision scellée `ambiguity-capacity-18`.',
    futureRule: 'Lorsque deux briefs partagent le même dispositif et une partie substantielle de leurs connaissances, les fusionner plutôt que dupliquer la scenario family; préserver toutefois des branches distinctes lorsque les mécanismes se situent à des phases métier différentes.'
  }),
  Object.freeze({
    sourceItemId: 'scenario-family-preflight-19',
    decision: scenarioFamilyDecision('tooBroad', [
      ['q008'],
      ['q078', 'q085']
    ]),
    humanRationale: '`q008` concerne la possibilité de poser une question sur le projet.\n\n`q078` et `q085` concernent la réception et le suivi des actualités ou jalons du projet et forment déjà un groupe cohérent, avec leur relation d’équivalence existante préservée.\n\nLe fait que ces fonctions utilisent toutes Storm ou relèvent de la communication projet ne suffit pas à constituer un besoin utilisateur unique.\n\nCette décision est cohérente avec `ambiguity-capacity-19`, qui établit que poser une question et recevoir des actualités sont deux flux de communication distincts.',
    futureRule: 'Une plateforme ou un canal commun ne suffit pas à former une scenario family : distinguer les actions utilisateur sortantes, comme poser une question, des besoins de réception ou de suivi d’information.'
  }),
  Object.freeze({
    sourceItemId: 'scenario-family-preflight-21',
    decision: scenarioFamilyDecision('tooBroad', [['q083'], ['q112']]),
    humanRationale: '`q083` correspond au besoin de trouver un interlocuteur lorsqu’une question n’est pas couverte.\n\n`q112` correspond à une intention de contribution : proposer une idée d’amélioration.\n\nLes deux peuvent aboutir opérationnellement à contacter un ambassadeur ou l’équipe projet, mais le besoin utilisateur initial est différent.\n\nLa décision scellée `ambiguity-capacity-21` établit que cette proximité de réponse ne crée pas une ambiguïté utile ; elle ne justifie pas non plus de fusionner les deux intentions dans une unique scenario family.',
    futureRule: 'Une réponse opérationnelle commune ne suffit pas à fusionner deux scenario families lorsque les intentions utilisateur sont substantiellement différentes; structurer d’abord par le besoin, puis par le canal ou l’action de sortie.'
  }),
  Object.freeze({
    sourceItemId: 'scenario-family-preflight-22',
    decision: scenarioFamilyDecision('tooBroad', [
      ['q078', 'q085'],
      ['q110', 'q112'],
      ['q111']
    ]),
    humanRationale: 'Le brief agrège sous un thème générique d’« interaction avec le projet » trois besoins différents :\n\n* `q078` et `q085` : suivre les actualités et jalons;\n* `q110` et `q112` : contribuer activement par feedback ou proposition d’amélioration;\n* `q111` : savoir si le projet peut encore évoluer après l’emménagement.\n\nLa décision scellée `ambiguity-capacity-22` établit déjà que cette agrégation est une catégorie thématique trop large plutôt qu’une intention unique.\n\nLa distinction `q110/q112` versus `q111` conserve également la différence entre contribution active et simple information sur l’évolutivité du projet.',
    futureRule: 'Ne pas utiliser une catégorie thématique générale comme scenario family. Séparer le suivi d’information, la contribution active et la compréhension de l’évolution future lorsqu’ils correspondent à des besoins utilisateur différents.'
  }),
  Object.freeze({
    sourceItemId: 'scenario-family-preflight-23',
    decision: scenarioFamilyDecision('distinct', [
      ['q019', 'q053'],
      ['q020'],
      ['q022'],
      ['q023'],
      ['q024']
    ]),
    humanRationale: 'Le besoin général est cohérent : comprendre la règle de réservation lorsque l’espace concerné varie.\n\nMais la connaissance applicable dépend structurellement du type d’espace :\n\n* `q019`, `q053` : salles de réunion;\n* `q020` : Bibliothèque;\n* `q022` : Project Room;\n* `q023` : bulles;\n* `q024` : Forum.\n\nLa scenario family reste donc valide, avec le type d’espace comme variable structurante.\n\nCette partition respecte les frontières déjà scellées dans `boundary-rooms-focus` et les décisions d’ambiguïté relatives aux règles d’usage/réservation des différents espaces.',
    futureRule: 'Une scenario family peut couvrir une même opération appliquée à plusieurs types de ressources, à condition de partitionner explicitement par ressource lorsque celle-ci détermine la règle applicable.'
  })
]);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function buildStructuralAdjudicationBatch05Log({ generatedRoot = DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT } = {}) {
  const matrix = readJson(join(generatedRoot, 'adjudication', 'reviewer-ab-comparison-matrix.json'));
  if (matrix.matrixFingerprint !== EXPECTED_COMPARISON_MATRIX_FINGERPRINT) {
    throw new Error('Unexpected structural comparison matrix fingerprint');
  }
  let log = createEmptyStructuralAdjudicationLog({
    batchId: 'adjudication-batch-05-scenario-families-02',
    sourceMatrix: matrix,
    sourceReviewerSeals: SOURCE_REVIEWER_SEALS,
    authorizedSourceItemIds: ADJUDICATION_BATCH_05_ITEM_IDS,
    humanDoctrine: STRUCTURAL_ADJUDICATION_BATCH_05_DOCTRINE
  });
  for (let index = 0; index < STRUCTURAL_ADJUDICATION_BATCH_05_EVENTS.length; index += 1) {
    const source = STRUCTURAL_ADJUDICATION_BATCH_05_EVENTS[index];
    log = constructStructuralAdjudicationLogWithEvent(log, {
      eventId: `adjudication-batch-05-event-${String(index + 1).padStart(3, '0')}`,
      sourceItemId: source.sourceItemId,
      decision: source.decision,
      humanRationale: source.humanRationale,
      futureRule: source.futureRule,
      recordedAt: STRUCTURAL_ADJUDICATION_BATCH_05_RECORDED_AT,
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

export function materialiseStructuralAdjudicationBatch05Log({
  generatedRoot = DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
  outputPath = DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_05_LOG_PATH,
  checkOnly = false
} = {}) {
  const expectedLog = buildStructuralAdjudicationBatch05Log({ generatedRoot });
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
    recordedAt: STRUCTURAL_ADJUDICATION_BATCH_05_RECORDED_AT,
    sourceMatrixFingerprint: expectedLog.sourceMatrixFingerprint,
    status: expectedLog.status
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = materialiseStructuralAdjudicationBatch05Log({ checkOnly: process.argv.includes('--check') });
  process.stdout.write(`${canonicalJson(result)}\n`);
}
