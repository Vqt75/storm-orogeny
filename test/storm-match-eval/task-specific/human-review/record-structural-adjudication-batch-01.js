import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ADJUDICATION_BATCH_01_ITEM_IDS,
  DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
  EXPECTED_COMPARISON_MATRIX_FINGERPRINT
} from './generate-structural-adjudication-batch.js';
import { canonicalJson } from './review-packets.js';
import {
  constructStructuralAdjudicationLogWithEvent,
  createEmptyStructuralAdjudicationLog,
  HUMAN_ADJUDICATION_PROVENANCE,
  validateStructuralAdjudicationLog
} from './structural-adjudication-log.js';

export const STRUCTURAL_ADJUDICATION_BATCH_01_RECORDED_AT = '2026-09-07T15:20:25.766Z';
export const DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_01_LOG_PATH = join(
  DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
  'adjudication',
  'records',
  'adjudication-batch-01-equivalence-boundaries.human-adjudication-log.json'
);

export const STRUCTURAL_ADJUDICATION_BATCH_01_DOCTRINE = Object.freeze({
  provenance: HUMAN_ADJUDICATION_PROVENANCE,
  preferredEntrySelectionMeaning: 'BEST_CANONICAL_REPRESENTATION_OF_THE_SAME_SUBSTANTIVE_FACT',
  preferredEntrySelectionCriteria: Object.freeze([
    'generality',
    'standaloneWording',
    'contextualCompleteness',
    'wholeEquivalentGroupRepresentation'
  ]),
  externalBusinessPreferenceRuleRequired: false
});

const SOURCE_REVIEWER_SEALS = Object.freeze({
  reviewerA: '79ea358a594c5b91eee9e5fe453582cb515f11d542571816981b2b2155fde5a8',
  reviewerB: '3b24eefdf1b200fc94ebbd83003a796aa3fc1593d55efbbf0a4cf86749438549'
});

function equivalenceDecision(memberEntryIds, preferredEntryId) {
  return {
    substantiveEquivalencePartition: {
      value: 'oneEquivalentGroup',
      canonicalPartition: [[...memberEntryIds]]
    },
    preferredEntrySelection: {
      value: 'chooseOneDisplayedKnowledgeRef',
      preferredEntryId
    }
  };
}

function boundaryDecision(canonicalPartition, futureCoverageBoundaryRules) {
  return {
    knowledgeComponentBoundary: {
      value: 'partitionRequired',
      canonicalPartition
    },
    futureCoverageBoundaryRules
  };
}

export const STRUCTURAL_ADJUDICATION_BATCH_01_EVENTS = Object.freeze([
  Object.freeze({
    sourceItemId: 'equivalence-comparison-01',
    decision: equivalenceDecision(['equinoxe-q001', 'equinoxe-q002'], 'equinoxe-q002'),
    humanRationale: 'Même fait métier et même date. equinoxe-q002 est la représentation canonique la plus autonome et contextualisée : elle nomme explicitement l’emménagement à Cobalt ainsi que la date.'
  }),
  Object.freeze({
    sourceItemId: 'equivalence-comparison-02',
    decision: equivalenceDecision(['equinoxe-q019', 'equinoxe-q053'], 'equinoxe-q019'),
    humanRationale: 'equinoxe-q019 formule la règle générale de réservation des salles de réunion et précise que l’outil habituel reste inchangé. equinoxe-q053 est un cas particulier appliqué à un entretien annuel.'
  }),
  Object.freeze({
    sourceItemId: 'equivalence-comparison-03',
    decision: equivalenceDecision(['equinoxe-q050', 'equinoxe-q051', 'equinoxe-q099'], 'equinoxe-q050'),
    humanRationale: 'equinoxe-q050 exprime la règle générale et autonome relative aux échanges confidentiels. Les cas RH et appel client sont des instanciations de cette même règle.'
  }),
  Object.freeze({
    sourceItemId: 'equivalence-comparison-04',
    decision: equivalenceDecision(['equinoxe-q066', 'equinoxe-q069'], 'equinoxe-q069'),
    humanRationale: 'equinoxe-q069 formule explicitement la règle générale : les circuits RH/santé sont le point d’entrée pour toute demande d’adaptation de poste. Elle représente mieux l’ensemble du groupe.'
  }),
  Object.freeze({
    sourceItemId: 'equivalence-comparison-05',
    decision: equivalenceDecision(['equinoxe-q078', 'equinoxe-q085'], 'equinoxe-q078'),
    humanRationale: 'equinoxe-q078 représente le besoin général de suivi de l’avancement du projet. equinoxe-q085 est une formulation plus spécifique portant sur l’existence de points d’étape réguliers.'
  }),
  Object.freeze({
    sourceItemId: 'boundary-arrival-preparation',
    decision: boundaryDecision([
      { componentId: 'ARRIVAL', memberEntryIds: ['equinoxe-q001', 'equinoxe-q002', 'equinoxe-q009'] },
      { componentId: 'PREPARATION', memberEntryIds: ['equinoxe-q004', 'equinoxe-q005', 'equinoxe-q007', 'equinoxe-q108'] },
      { componentId: 'CALENDAR_STABILITY', memberEntryIds: ['equinoxe-q003'] }
    ], [
      { componentId: 'ARRIVAL', rule: 'date, timing ou phasage d’arrivée' },
      { componentId: 'PREPARATION', rule: 'visites, semaine, guide, accompagnement ou étapes préparatoires' },
      { componentId: 'CALENDAR_STABILITY', rule: 'caractère stabilisé, ajustable ou susceptible de changer du calendrier' },
      { componentId: 'AMBIGUITY', rule: 'une formulation insuffisamment précise peut rester ambiguë entre ces composantes' }
    ]),
    humanRationale: [
      'Le fait que ces connaissances appartiennent toutes au calendrier d’arrivée à Cobalt ne constitue pas un besoin métier unique.',
      'La date, le timing et le phasage de l’emménagement forment un besoin ARRIVAL.',
      'Les visites, la semaine de préparation, le guide et les étapes précédant l’arrivée forment un besoin PREPARATION.',
      'La stabilité ou la possibilité d’évolution du calendrier constitue un besoin distinct CALENDAR_STABILITY : equinoxe-q003 porte sur la fiabilité du calendrier dans son ensemble et ne doit pas être artificiellement absorbée par PREPARATION.'
    ].join('\n\n')
  }),
  Object.freeze({
    sourceItemId: 'boundary-communication-pilot',
    decision: boundaryDecision([
      { componentId: 'EXPERIMENT_FEEDBACK', memberEntryIds: ['equinoxe-q006', 'equinoxe-q079', 'equinoxe-q110', 'equinoxe-q111', 'equinoxe-q112'] },
      { componentId: 'INFO_QUESTIONS', memberEntryIds: ['equinoxe-q008', 'equinoxe-q078', 'equinoxe-q085'] },
      { componentId: 'AMBASSADORS_CONTACTS', memberEntryIds: ['equinoxe-q077', 'equinoxe-q083', 'equinoxe-q106', 'equinoxe-q107'] }
    ], [
      { componentId: 'INFO_QUESTIONS', rule: 'information / questions projet' },
      { componentId: 'AMBASSADORS_CONTACTS', rule: 'acteurs humains / ambassadeurs / contacts' },
      { componentId: 'EXPERIMENT_FEEDBACK', rule: 'expérimentation / retours / contribution / évolution du projet' }
    ]),
    humanRationale: [
      'Conserver la structure Reviewer A.',
      'equinoxe-q083 appartient à AMBASSADORS_CONTACTS : la demande porte explicitement sur la personne à contacter lorsqu’une réponse n’est pas disponible, et la connaissance désigne un ambassadeur ou l’équipe projet.',
      'Ne pas la rattacher au simple canal d’information au motif qu’elle contient le mot « question ».'
    ].join('\n\n')
  }),
  Object.freeze({
    sourceItemId: 'boundary-rooms-focus',
    decision: boundaryDecision([
      { componentId: 'MEETING_ROOMS', memberEntryIds: ['equinoxe-q019', 'equinoxe-q028', 'equinoxe-q053', 'equinoxe-q089'] },
      { componentId: 'PROJECT_ROOMS', memberEntryIds: ['equinoxe-q022', 'equinoxe-q031', 'equinoxe-q052', 'equinoxe-q090'] },
      { componentId: 'BUBBLES', memberEntryIds: ['equinoxe-q023', 'equinoxe-q027'] },
      { componentId: 'FORUM', memberEntryIds: ['equinoxe-q024', 'equinoxe-q029', 'equinoxe-q105'] },
      { componentId: 'FOCUS_LIBRARY', memberEntryIds: ['equinoxe-q020', 'equinoxe-q025', 'equinoxe-q026', 'equinoxe-q091'] },
      { componentId: 'CONFIDENTIALITY', memberEntryIds: ['equinoxe-q050', 'equinoxe-q051', 'equinoxe-q099'] }
    ], [
      { componentId: 'IDENTIFIED_SPACE', rule: 'si un type d’espace est explicitement identifié, rattacher la demande à sa famille d’espace' },
      { componentId: 'CONFIDENTIALITY', rule: 'besoin fonctionnel portant sur un échange confidentiel, lorsque plusieurs types d’espaces peuvent satisfaire ce besoin' },
      { componentId: 'AMBIGUITY', rule: 'une demande vague sur le fait de « s’isoler », « être au calme » ou « trouver un espace » peut rester ambiguë lorsque l’activité recherchée ne permet pas de distinguer Focus/Library, bulle, salle ou autre espace' }
    ]),
    humanRationale: [
      'Les différents types d’espaces ont des finalités, capacités et règles d’accès/réservation suffisamment distinctes pour ne pas être fusionnés dans un grand composant « espaces de collaboration ».',
      'La confidentialité constitue en revanche un besoin fonctionnel transverse : les connaissances equinoxe-q050, equinoxe-q051 et equinoxe-q099 couvrent explicitement à la fois salles de réunion et bulles.',
      'Elles ne doivent donc pas être rangées artificiellement dans le composant MEETING_ROOMS uniquement.'
    ].join('\n\n')
  })
]);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function buildStructuralAdjudicationBatch01Log({ generatedRoot = DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT } = {}) {
  const matrix = readJson(join(generatedRoot, 'adjudication', 'reviewer-ab-comparison-matrix.json'));
  if (matrix.matrixFingerprint !== EXPECTED_COMPARISON_MATRIX_FINGERPRINT) {
    throw new Error('Unexpected structural comparison matrix fingerprint');
  }
  let log = createEmptyStructuralAdjudicationLog({
    batchId: 'adjudication-batch-01-equivalence-boundaries',
    sourceMatrix: matrix,
    sourceReviewerSeals: SOURCE_REVIEWER_SEALS,
    authorizedSourceItemIds: ADJUDICATION_BATCH_01_ITEM_IDS,
    humanDoctrine: STRUCTURAL_ADJUDICATION_BATCH_01_DOCTRINE
  });
  for (let index = 0; index < STRUCTURAL_ADJUDICATION_BATCH_01_EVENTS.length; index += 1) {
    const source = STRUCTURAL_ADJUDICATION_BATCH_01_EVENTS[index];
    log = constructStructuralAdjudicationLogWithEvent(log, {
      eventId: `adjudication-batch-01-event-${String(index + 1).padStart(3, '0')}`,
      sourceItemId: source.sourceItemId,
      decision: source.decision,
      humanRationale: source.humanRationale,
      recordedAt: STRUCTURAL_ADJUDICATION_BATCH_01_RECORDED_AT,
      provenance: HUMAN_ADJUDICATION_PROVENANCE
    }, matrix);
  }
  const validation = validateStructuralAdjudicationLog(log, matrix);
  if (!validation.ok) throw new Error(`Generated structural adjudication log is invalid: ${canonicalJson(validation.errors)}`);
  return log;
}

export function materialiseStructuralAdjudicationBatch01Log({
  generatedRoot = DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
  outputPath = DEFAULT_STRUCTURAL_ADJUDICATION_BATCH_01_LOG_PATH,
  checkOnly = false
} = {}) {
  const expectedLog = buildStructuralAdjudicationBatch01Log({ generatedRoot });
  const expected = `${JSON.stringify(expectedLog, null, 2)}\n`;
  if (existsSync(outputPath)) {
    const actual = readFileSync(outputPath, 'utf8').replace(/\r\n/g, '\n');
    if (actual !== expected.replace(/\r\n/g, '\n')) throw new Error(`Existing structural adjudication log differs from expected transcription: ${outputPath}`);
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
    sourceMatrixFingerprint: expectedLog.sourceMatrixFingerprint,
    status: expectedLog.status
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = materialiseStructuralAdjudicationBatch01Log({ checkOnly: process.argv.includes('--check') });
  process.stdout.write(`${canonicalJson(result)}\n`);
}
