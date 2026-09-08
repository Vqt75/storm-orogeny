import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalJson, fingerprint } from './review-packets.js';
import { validateStructuralAdjudicationSeal } from './structural-adjudication-log.js';

export const ADJUDICATION_BATCH_01_ITEM_IDS = Object.freeze([
  'equivalence-comparison-01',
  'equivalence-comparison-02',
  'equivalence-comparison-03',
  'equivalence-comparison-04',
  'equivalence-comparison-05',
  'boundary-arrival-preparation',
  'boundary-communication-pilot',
  'boundary-rooms-focus'
]);

export const ADJUDICATION_BATCH_02_ITEM_IDS = Object.freeze([
  'ambiguity-capacity-01',
  'ambiguity-capacity-03',
  'ambiguity-capacity-05',
  'ambiguity-capacity-06',
  'ambiguity-capacity-07',
  'ambiguity-capacity-10',
  'ambiguity-capacity-11',
  'ambiguity-capacity-13',
  'ambiguity-capacity-14',
  'ambiguity-capacity-16'
]);

export const ADJUDICATION_BATCH_03_ITEM_IDS = Object.freeze([
  'ambiguity-capacity-17',
  'ambiguity-capacity-18',
  'ambiguity-capacity-19',
  'ambiguity-capacity-20',
  'ambiguity-capacity-21',
  'ambiguity-capacity-22',
  'ambiguity-capacity-25',
  'ambiguity-capacity-29',
  'ambiguity-capacity-30',
  'ambiguity-capacity-33'
]);

export const ADJUDICATION_BATCH_04_ITEM_IDS = Object.freeze([
  'scenario-family-preflight-02',
  'scenario-family-preflight-03',
  'scenario-family-preflight-04',
  'scenario-family-preflight-05',
  'scenario-family-preflight-06',
  'scenario-family-preflight-07',
  'scenario-family-preflight-08',
  'scenario-family-preflight-09',
  'scenario-family-preflight-10',
  'scenario-family-preflight-13'
]);

export const EXPECTED_COMPARISON_MATRIX_FINGERPRINT = '2661f9530fc20272043a621cfbf43b836e883522cdc7dfae861e4a58e2db21dd';
export const DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT = join(import.meta.dirname, 'generated-structural-review');
export const DEFAULT_ADJUDICATION_BATCH_01_PATH = join(
  DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
  'adjudication',
  'batches',
  'adjudication-batch-01-equivalence-boundaries.md'
);
export const DEFAULT_ADJUDICATION_BATCH_02_PATH = join(
  DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
  'adjudication',
  'batches',
  'adjudication-batch-02-ambiguities-01.md'
);
export const DEFAULT_ADJUDICATION_BATCH_03_PATH = join(
  DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
  'adjudication',
  'batches',
  'adjudication-batch-03-ambiguities-02.md'
);
export const DEFAULT_ADJUDICATION_BATCH_04_PATH = join(
  DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
  'adjudication',
  'batches',
  'adjudication-batch-04-scenario-families-01.md'
);

const PACKET_BASENAME_BY_KIND = Object.freeze({
  EQUIVALENCE_AND_PREFERRED: '01-equivalence-preferred',
  KNOWLEDGE_BOUNDARIES: '02-knowledge-boundaries',
  AMBIGUITY_CAPACITY_FAMILIES: '03-ambiguity-families',
  SCENARIO_FAMILY_PREFLIGHT: '04-scenario-family-preflight'
});

const AMBIGUITY_DECISION_FIELDS = Object.freeze([
  'ambiguityFamilyDisposition.value',
  'ambiguityMechanism.value',
  'substantiallyDifferentCoveredGroups.value',
  'substantiallyDifferentCoveredGroups.canonicalPartition'
]);

const SCENARIO_DECISION_FIELDS = Object.freeze([
  'fragmentationAssessment.value',
  'fragmentationAssessment.mergeCanonicalReviewItemIds',
  'reviewerScenarioFamilyPartition.value',
  'reviewerScenarioFamilyPartition.canonicalPartition'
]);

const SEALED_ADJUDICATION_RECORD_BASENAMES = Object.freeze([
  'adjudication-batch-01-equivalence-boundaries',
  'adjudication-batch-02-ambiguities-01',
  'adjudication-batch-03-ambiguities-02'
]);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function withoutField(value, field) {
  const { [field]: _ignored, ...rest } = value;
  return rest;
}

function assertMatrixContract(matrix) {
  if (matrix.matrixFingerprint !== EXPECTED_COMPARISON_MATRIX_FINGERPRINT
    || fingerprint(withoutField(matrix, 'matrixFingerprint')) !== matrix.matrixFingerprint) {
    throw new Error('Adjudication batch source matrix fingerprint mismatch');
  }
  if (matrix.status !== 'PENDING_HUMAN_REVIEW'
    || matrix.generationAuthorized !== false
    || matrix.adjudicationPerformed !== false) {
    throw new Error('Adjudication batch source matrix guard fields are invalid');
  }
}

function loadPacket(generatedRoot, packetKind, reviewerSlot) {
  const basename = PACKET_BASENAME_BY_KIND[packetKind];
  if (!basename) throw new Error(`Packet kind is outside supported structural adjudication batches: ${packetKind}`);
  return readJson(join(
    generatedRoot,
    `reviewer-${reviewerSlot.toLowerCase()}`,
    `${basename}.fr.json`
  ));
}

function reviewItemMetadataForReviewer(source, packet, reviewerKey) {
  const reviewItemRef = source[reviewerKey].reviewItemRef;
  const reviewItem = packet.reviewItems.find(candidate => candidate.reviewItemRef === reviewItemRef);
  if (!reviewItem) throw new Error(`Missing source review item: ${source.canonicalReviewItemId}/${reviewerKey}/${reviewItemRef}`);
  return {
    title: reviewItem.title,
    businessContext: reviewItem.businessContext
  };
}

function valueAtPath(value, path) {
  return path.split('.').reduce((current, key) => current?.[key], value);
}

function strictAgreementFields(source) {
  return AMBIGUITY_DECISION_FIELDS.filter(path => canonicalJson(valueAtPath(source.reviewerA.decisions, path))
    === canonicalJson(valueAtPath(source.reviewerB.decisions, path)));
}

function strictScenarioAgreementFields(source) {
  return SCENARIO_DECISION_FIELDS.filter(path => canonicalJson(valueAtPath(source.reviewerA.decisions, path))
    === canonicalJson(valueAtPath(source.reviewerB.decisions, path)));
}

function knowledgeContentForReviewer(item, packet, reviewerKey) {
  const mappings = new Map(item[reviewerKey].knowledgeRefMappings
    .map(mapping => [mapping.entryId, mapping.localKnowledgeRef]));
  const byLocalRef = new Map(packet.knowledgeItems
    .map(knowledge => [knowledge.knowledgeRef, knowledge]));
  return item.canonicalKnowledgeScope.map(entryId => {
    const localRef = mappings.get(entryId);
    const knowledge = byLocalRef.get(localRef);
    if (!localRef || !knowledge) {
      throw new Error(`Missing readable knowledge content for ${item.canonicalReviewItemId}/${reviewerKey}/${entryId}`);
    }
    return {
      entryId,
      canonicalQuestion: knowledge.canonicalQuestion,
      canonicalAnswer: knowledge.canonicalAnswer
    };
  });
}

export function buildStructuralAdjudicationBatch01({ generatedRoot = DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT } = {}) {
  const matrixPath = join(
    generatedRoot,
    'adjudication',
    'reviewer-ab-comparison-matrix.json'
  );
  const matrix = readJson(matrixPath);
  assertMatrixContract(matrix);
  const byId = new Map(matrix.items.map(item => [item.canonicalReviewItemId, item]));
  const items = ADJUDICATION_BATCH_01_ITEM_IDS.map(sourceItemId => {
    const source = byId.get(sourceItemId);
    if (!source) throw new Error(`Missing adjudication batch item: ${sourceItemId}`);
    if (!source.requiresAdjudication || source.completeAgreement) {
      throw new Error(`Adjudication batch item is not marked for adjudication: ${sourceItemId}`);
    }
    const packetA = loadPacket(generatedRoot, source.packetKind, 'A');
    const packetB = loadPacket(generatedRoot, source.packetKind, 'B');
    const readableA = knowledgeContentForReviewer(source, packetA, 'reviewerA');
    const readableB = knowledgeContentForReviewer(source, packetB, 'reviewerB');
    if (canonicalJson(readableA) !== canonicalJson(readableB)) {
      throw new Error(`Reviewer source knowledge differs for ${sourceItemId}`);
    }
    return {
      sourceItemId,
      packetKind: source.packetKind,
      knowledge: readableA,
      reviewerA: {
        decisions: structuredClone(source.reviewerA.decisions),
        rationales: structuredClone(source.reviewerA.rationales)
      },
      reviewerB: {
        decisions: structuredClone(source.reviewerB.decisions),
        rationales: structuredClone(source.reviewerB.rationales)
      },
      divergenceCategories: source.comparisonFindings.map(finding => finding.status),
      firstLevelAgreement: source.firstLevelAgreement,
      completeAgreement: source.completeAgreement,
      fieldsRequiringAdjudication: source.comparisonFindings.map(finding => ({
        field: finding.field,
        category: finding.status
      }))
    };
  });
  return Object.freeze({
    batchId: 'adjudication-batch-01-equivalence-boundaries',
    sourceMatrixFingerprint: matrix.matrixFingerprint,
    status: matrix.status,
    generationAuthorized: false,
    adjudicationPerformed: false,
    itemCount: items.length,
    items
  });
}

export function buildStructuralAdjudicationBatch02({ generatedRoot = DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT } = {}) {
  return buildAmbiguityAdjudicationBatch({
    generatedRoot,
    itemIds: ADJUDICATION_BATCH_02_ITEM_IDS,
    batchId: 'adjudication-batch-02-ambiguities-01'
  });
}

function sealedEquivalenceByEntryId(generatedRoot) {
  const log = readJson(join(
    generatedRoot,
    'adjudication',
    'records',
    'adjudication-batch-01-equivalence-boundaries.human-adjudication-log.json'
  ));
  const byEntryId = new Map();
  for (const event of log.events.filter(candidate => candidate.sourceItemId.startsWith('equivalence-comparison-'))) {
    const partition = event.decision.substantiveEquivalencePartition.canonicalPartition;
    const preferredEntryId = event.decision.preferredEntrySelection.preferredEntryId;
    for (const memberEntryIds of partition) {
      const sealedGroup = Object.freeze({
        memberEntryIds: Object.freeze([...memberEntryIds]),
        preferredEntryId: memberEntryIds.includes(preferredEntryId) ? preferredEntryId : null
      });
      for (const entryId of memberEntryIds) byEntryId.set(entryId, sealedGroup);
    }
  }
  return byEntryId;
}

function loadSealedAdjudicationContexts(generatedRoot, matrix) {
  const recordsRoot = join(generatedRoot, 'adjudication', 'records');
  return SEALED_ADJUDICATION_RECORD_BASENAMES.flatMap(basename => {
    const journalPath = join(recordsRoot, `${basename}.human-adjudication-log.json`);
    const sealPath = join(recordsRoot, `${basename}.human-adjudication-seal.json`);
    const log = readJson(journalPath);
    const seal = readJson(sealPath);
    const validation = validateStructuralAdjudicationSeal(seal, {
      log,
      sourceMatrix: matrix,
      journalPath
    });
    if (!validation.ok) throw new Error(`Invalid sealed adjudication context: ${basename}`);
    return log.events.map(event => {
      const source = matrix.items.find(item => item.canonicalReviewItemId === event.sourceItemId);
      if (!source) throw new Error(`Missing comparison source for sealed adjudication: ${event.sourceItemId}`);
      return {
        batchId: log.batchId,
        sourceItemId: event.sourceItemId,
        packetKind: source.packetKind,
        sourceKnowledgeScope: [...source.canonicalKnowledgeScope],
        decision: structuredClone(event.decision),
        humanRationale: event.humanRationale,
        ...(event.futureRule ? { futureRule: event.futureRule } : {})
      };
    });
  });
}

function buildAmbiguityAdjudicationBatch({ generatedRoot, itemIds, batchId, includeSealedEquivalence = false }) {
  const matrixPath = join(
    generatedRoot,
    'adjudication',
    'reviewer-ab-comparison-matrix.json'
  );
  const matrix = readJson(matrixPath);
  assertMatrixContract(matrix);
  const byId = new Map(matrix.items.map(item => [item.canonicalReviewItemId, item]));
  const equivalenceByEntryId = includeSealedEquivalence ? sealedEquivalenceByEntryId(generatedRoot) : null;
  const items = itemIds.map(sourceItemId => {
    const source = byId.get(sourceItemId);
    if (!source) throw new Error(`Missing adjudication batch item: ${sourceItemId}`);
    if (source.packetKind !== 'AMBIGUITY_CAPACITY_FAMILIES'
      || !source.requiresAdjudication
      || source.completeAgreement) {
      throw new Error(`Ambiguity batch item is not a pending adjudication: ${sourceItemId}`);
    }
    const packetA = loadPacket(generatedRoot, source.packetKind, 'A');
    const packetB = loadPacket(generatedRoot, source.packetKind, 'B');
    const readableA = knowledgeContentForReviewer(source, packetA, 'reviewerA');
    const readableB = knowledgeContentForReviewer(source, packetB, 'reviewerB');
    if (canonicalJson(readableA) !== canonicalJson(readableB)) {
      throw new Error(`Reviewer source knowledge differs for ${sourceItemId}`);
    }
    const metadataA = reviewItemMetadataForReviewer(source, packetA, 'reviewerA');
    const metadataB = reviewItemMetadataForReviewer(source, packetB, 'reviewerB');
    if (canonicalJson(metadataA) !== canonicalJson(metadataB)) {
      throw new Error(`Reviewer source family metadata differs for ${sourceItemId}`);
    }
    return {
      sourceItemId,
      packetKind: source.packetKind,
      sourceFamily: {
        title: metadataA.title,
        businessContext: metadataA.businessContext,
        scenarioFamilyId: null
      },
      knowledge: readableA.map(knowledge => ({
        ...knowledge,
        ...(includeSealedEquivalence
          ? { sealedEquivalence: equivalenceByEntryId.get(knowledge.entryId) ?? null }
          : {})
      })),
      reviewerA: {
        decisions: structuredClone(source.reviewerA.decisions),
        rationales: structuredClone(source.reviewerA.rationales)
      },
      reviewerB: {
        decisions: structuredClone(source.reviewerB.decisions),
        rationales: structuredClone(source.reviewerB.rationales)
      },
      comparison: {
        status: source.comparisonStatus,
        firstLevelAgreement: source.firstLevelAgreement,
        completeAgreement: source.completeAgreement,
        strictAgreementFields: strictAgreementFields(source),
        findings: structuredClone(source.comparisonFindings),
        crosswalk: {
          reviewerA: {
            reviewItemRef: source.reviewerA.reviewItemRef,
            knowledgeRefMappings: structuredClone(source.reviewerA.knowledgeRefMappings)
          },
          reviewerB: {
            reviewItemRef: source.reviewerB.reviewItemRef,
            knowledgeRefMappings: structuredClone(source.reviewerB.knowledgeRefMappings)
          }
        }
      },
      humanDecision: {
        decision: 'PENDING',
        rationale: 'PENDING',
        futureRule: 'PENDING'
      }
    };
  });
  return Object.freeze({
    batchId,
    sourceMatrixFingerprint: matrix.matrixFingerprint,
    sourceReviewerSeals: {
      reviewerA: matrix.sourceReviews.reviewerA.sealHash,
      reviewerB: matrix.sourceReviews.reviewerB.sealHash
    },
    status: matrix.status,
    generationAuthorized: false,
    adjudicationPerformed: false,
    itemCount: items.length,
    items
  });
}

export function buildStructuralAdjudicationBatch03({ generatedRoot = DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT } = {}) {
  return buildAmbiguityAdjudicationBatch({
    generatedRoot,
    itemIds: ADJUDICATION_BATCH_03_ITEM_IDS,
    batchId: 'adjudication-batch-03-ambiguities-02',
    includeSealedEquivalence: true
  });
}

export function buildStructuralAdjudicationBatch04({ generatedRoot = DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT } = {}) {
  const matrix = readJson(join(generatedRoot, 'adjudication', 'reviewer-ab-comparison-matrix.json'));
  assertMatrixContract(matrix);
  const byId = new Map(matrix.items.map(item => [item.canonicalReviewItemId, item]));
  const equivalenceByEntryId = sealedEquivalenceByEntryId(generatedRoot);
  const sealedContexts = loadSealedAdjudicationContexts(generatedRoot, matrix);
  const items = ADJUDICATION_BATCH_04_ITEM_IDS.map(sourceItemId => {
    const source = byId.get(sourceItemId);
    if (!source) throw new Error(`Missing adjudication batch item: ${sourceItemId}`);
    if (source.packetKind !== 'SCENARIO_FAMILY_PREFLIGHT'
      || !source.requiresAdjudication
      || source.completeAgreement) {
      throw new Error(`Batch 04 item is not a pending scenario-family adjudication: ${sourceItemId}`);
    }
    const packetA = loadPacket(generatedRoot, source.packetKind, 'A');
    const packetB = loadPacket(generatedRoot, source.packetKind, 'B');
    const readableA = knowledgeContentForReviewer(source, packetA, 'reviewerA');
    const readableB = knowledgeContentForReviewer(source, packetB, 'reviewerB');
    if (canonicalJson(readableA) !== canonicalJson(readableB)) {
      throw new Error(`Reviewer source knowledge differs for ${sourceItemId}`);
    }
    const metadataA = reviewItemMetadataForReviewer(source, packetA, 'reviewerA');
    const metadataB = reviewItemMetadataForReviewer(source, packetB, 'reviewerB');
    if (canonicalJson(metadataA) !== canonicalJson(metadataB)) {
      throw new Error(`Reviewer source family metadata differs for ${sourceItemId}`);
    }
    const sourceScope = new Set(source.canonicalKnowledgeScope);
    const existingAdjudicationContext = sealedContexts
      .map(context => ({
        ...context,
        affectedEntryIds: context.sourceKnowledgeScope.filter(entryId => sourceScope.has(entryId))
      }))
      .filter(context => context.affectedEntryIds.length > 0);
    return {
      sourceItemId,
      packetKind: source.packetKind,
      sourceFamily: {
        title: metadataA.title,
        businessContext: metadataA.businessContext,
        scenarioFamilyId: null
      },
      knowledge: readableA.map(knowledge => ({
        ...knowledge,
        sealedEquivalence: equivalenceByEntryId.get(knowledge.entryId) ?? null,
        scenarioFamilyId: null
      })),
      reviewerA: {
        decisions: structuredClone(source.reviewerA.decisions),
        rationales: structuredClone(source.reviewerA.rationales)
      },
      reviewerB: {
        decisions: structuredClone(source.reviewerB.decisions),
        rationales: structuredClone(source.reviewerB.rationales)
      },
      comparison: {
        status: source.comparisonStatus,
        firstLevelAgreement: source.firstLevelAgreement,
        completeAgreement: source.completeAgreement,
        strictAgreementFields: strictScenarioAgreementFields(source),
        findings: structuredClone(source.comparisonFindings),
        crosswalk: {
          reviewerA: {
            reviewItemRef: source.reviewerA.reviewItemRef,
            knowledgeRefMappings: structuredClone(source.reviewerA.knowledgeRefMappings)
          },
          reviewerB: {
            reviewItemRef: source.reviewerB.reviewItemRef,
            knowledgeRefMappings: structuredClone(source.reviewerB.knowledgeRefMappings)
          }
        }
      },
      existingAdjudicationContext,
      humanDecision: {
        decision: 'PENDING',
        rationale: 'PENDING',
        futureRule: 'PENDING'
      }
    };
  });
  return Object.freeze({
    batchId: 'adjudication-batch-04-scenario-families-01',
    sourceMatrixFingerprint: matrix.matrixFingerprint,
    sourceReviewerSeals: {
      reviewerA: matrix.sourceReviews.reviewerA.sealHash,
      reviewerB: matrix.sourceReviews.reviewerB.sealHash
    },
    status: matrix.status,
    generationAuthorized: false,
    adjudicationPerformed: false,
    itemCount: items.length,
    items
  });
}

function escapeTableCell(value) {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function quotedRationale(value) {
  return value.split(/\r?\n/).map(line => `> ${line}`).join('\n');
}

function partitionFor(item, reviewerKey) {
  const decisions = item[reviewerKey].decisions;
  return decisions.substantiveEquivalencePartition?.canonicalPartition
    ?? decisions.knowledgeComponentBoundary?.canonicalPartition
    ?? null;
}

function preferredFor(item, reviewerKey) {
  return item[reviewerKey].decisions.preferredEntrySelection ?? null;
}

function renderPartition(lines, label, partition) {
  lines.push(`- Partition ${label} :`);
  if (partition === null) {
    lines.push('  - aucune partition canonique consignée');
    return;
  }
  partition.forEach((group, index) => lines.push(`  - Groupe ${index + 1} : ${group.map(entryId => `\`${entryId}\``).join(', ')}`));
}

function renderReviewer(lines, item, reviewerKey, label) {
  const reviewer = item[reviewerKey];
  lines.push(`### Reviewer ${label}`, '', 'Décision normalisée :', '', '```json', JSON.stringify(reviewer.decisions, null, 2), '```', '');
  renderPartition(lines, label, partitionFor(item, reviewerKey));
  const preferred = preferredFor(item, reviewerKey);
  if (preferred) {
    lines.push(`- Preferred selection ${label} : valeur \`${preferred.value}\` ; entry sélectionnée : ${preferred.preferredEntryId ? `\`${preferred.preferredEntryId}\`` : 'aucune'}`);
  }
  lines.push('', `Rationales Reviewer ${label} :`, '');
  for (const [decisionType, rationale] of Object.entries(reviewer.rationales)) {
    lines.push(`#### ${decisionType}`, '', quotedRationale(rationale), '');
  }
}

function renderAmbiguityGroups(lines, decision) {
  const partition = decision.substantiallyDifferentCoveredGroups.canonicalPartition;
  if (partition === null) {
    lines.push('- Groupes couverts substantiellement différents : non applicables dans cette décision.');
    return;
  }
  lines.push('- Groupes couverts substantiellement différents :');
  partition.forEach((group, index) => lines.push(`  - Groupe ${index + 1} : ${group.map(entryId => `\`${entryId}\``).join(', ')}`));
}

function renderAmbiguityReviewer(lines, item, reviewerKey, label) {
  const reviewer = item[reviewerKey];
  const decisions = reviewer.decisions;
  lines.push(`### Reviewer ${label}`, '');
  lines.push(`- Classification : \`${decisions.ambiguityFamilyDisposition.value}\``);
  lines.push(`- Mécanisme : ${decisions.ambiguityMechanism.value === null ? 'non applicable' : `\`${decisions.ambiguityMechanism.value}\``}`);
  renderAmbiguityGroups(lines, decisions);
  lines.push('', `Rationales Reviewer ${label} :`, '');
  for (const [decisionType, rationale] of Object.entries(reviewer.rationales)) {
    lines.push(`- \`${decisionType}\``, '', quotedRationale(rationale), '');
  }
}

function renderCrosswalk(lines, label, crosswalk) {
  lines.push(`- Reviewer ${label} : item local \`${crosswalk.reviewItemRef}\``);
  for (const mapping of crosswalk.knowledgeRefMappings) {
    lines.push(`  - \`${mapping.localKnowledgeRef}\` → \`${mapping.entryId}\``);
  }
}

export function renderStructuralAdjudicationBatch01(batch) {
  const lines = [
    '# Adjudication structurelle — Batch 01 : équivalence et frontières métier',
    '',
    `- Batch : \`${batch.batchId}\``,
    `- Matrice source : \`${batch.sourceMatrixFingerprint}\``,
    `- Statut : \`${batch.status}\``,
    `- Autorisation de génération : \`${batch.generationAuthorized}\``,
    `- Adjudication effectuée : \`${batch.adjudicationPerformed}\``,
    `- Items : ${batch.itemCount}`,
    '',
    '> Ce document restitue les deux revues scellées et leurs divergences. Il ne contient aucune décision finale, aucun gold et aucune recommandation.',
    ''
  ];

  batch.items.forEach((item, index) => {
    lines.push(`## ${index + 1}. ${item.sourceItemId}`, '');
    lines.push(`- Type : \`${item.packetKind}\``);
    lines.push(`- Accord de premier niveau : ${item.firstLevelAgreement ? 'oui' : 'non'}`);
    lines.push(`- Accord complet : ${item.completeAgreement ? 'oui' : 'non'}`);
    lines.push(`- Catégories de divergence : ${[...new Set(item.divergenceCategories)].map(value => `\`${value}\``).join(', ')}`);
    lines.push(`- Champs nécessitant adjudication : ${item.fieldsRequiringAdjudication.map(value => `\`${value.field}\` (${value.category})`).join(', ')}`);
    lines.push('', '### Connaissances concernées', '');
    lines.push('| entryId | Question canonique | Réponse canonique |', '|---|---|---|');
    for (const knowledge of item.knowledge) {
      lines.push(`| \`${knowledge.entryId}\` | ${escapeTableCell(knowledge.canonicalQuestion)} | ${escapeTableCell(knowledge.canonicalAnswer)} |`);
    }
    lines.push('');
    renderReviewer(lines, item, 'reviewerA', 'A');
    renderReviewer(lines, item, 'reviewerB', 'B');
  });
  return `${lines.join('\n').replace(/\n+$/u, '')}\n`;
}

export function renderStructuralAdjudicationBatch02(batch) {
  const lines = [
    '# Adjudication structurelle — Batch 02 : ambiguïtés 01',
    '',
    `- Batch : \`${batch.batchId}\``,
    `- Matrice source : \`${batch.sourceMatrixFingerprint}\``,
    `- Seal Reviewer A : \`${batch.sourceReviewerSeals.reviewerA}\``,
    `- Seal Reviewer B : \`${batch.sourceReviewerSeals.reviewerB}\``,
    `- Statut : \`${batch.status}\``,
    `- Autorisation de génération : \`${batch.generationAuthorized}\``,
    `- Adjudication effectuée : \`${batch.adjudicationPerformed}\``,
    `- Items : ${batch.itemCount}`,
    '',
    '## Doctrine de revue',
    '',
    '- Liquid Core évalue l’answerability et le retrieval à partir du contenu publié.',
    '- Liquid Core ne génère aucune vérité projet.',
    '- Une formulation peut relever d’une ambiguïté structurelle avec alternatives, être sous-spécifiée, mettre en concurrence plusieurs connaissances, être artificielle ou manquer de preuves suffisantes.',
    '- L’arbitrage humain doit établir la structure de vérité nécessaire à la future génération du corpus.',
    '- `generationAuthorized` reste `false`.',
    '',
    '> Les artefacts sources ne contiennent encore ni formulation utilisateur générée ni `scenarioFamilyId`. Chaque section restitue donc la famille candidate, son contexte métier source et ses Q&A canoniques, sans compléter ces absences.',
    '> Aucune des entries de ce batch ne relève des groupes d’équivalence ou sélections `preferredEntryId` déjà scellés dans le Batch 01.',
    '> Ce paquet ne contient aucune adjudication : les blocs de décision restent explicitement à `PENDING`.',
    ''
  ];

  batch.items.forEach((item, index) => {
    lines.push(`## ${index + 1}. ${item.sourceItemId} — ${item.sourceFamily.title}`, '');
    lines.push('### Identification', '');
    lines.push(`- Item canonique : \`${item.sourceItemId}\``);
    lines.push(`- Type : \`${item.packetKind}\``);
    lines.push(`- Famille source : ${item.sourceFamily.title}`);
    lines.push(`- Formulation source disponible — contexte métier : ${item.sourceFamily.businessContext}`);
    lines.push('- `scenarioFamilyId` : non attribué dans les artefacts sources.', '');

    renderAmbiguityReviewer(lines, item, 'reviewerA', 'A');
    renderAmbiguityReviewer(lines, item, 'reviewerB', 'B');

    lines.push('### Comparaison A/B', '');
    lines.push(`- Statut exact de la matrice : \`${item.comparison.status}\``);
    lines.push(`- Accord de premier niveau : ${item.comparison.firstLevelAgreement ? 'oui' : 'non'}`);
    lines.push(`- Accord complet : ${item.comparison.completeAgreement ? 'oui' : 'non'}`);
    lines.push(`- Dimensions strictement égales : ${item.comparison.strictAgreementFields.length === 0 ? 'aucune' : item.comparison.strictAgreementFields.map(field => `\`${field}\``).join(', ')}`);
    lines.push(`- Dimensions en désaccord consignées par la matrice : ${item.comparison.findings.map(finding => `\`${finding.field}\` (\`${finding.status}\`)`).join(', ')}`);
    lines.push('', 'Crosswalk curator-only utilisé :', '');
    renderCrosswalk(lines, 'A', item.comparison.crosswalk.reviewerA);
    renderCrosswalk(lines, 'B', item.comparison.crosswalk.reviewerB);
    lines.push('');

    lines.push('### Connaissances publiées nécessaires', '');
    lines.push('| q-id canonique | Question canonique | Réponse canonique |', '|---|---|---|');
    for (const knowledge of item.knowledge) {
      lines.push(`| \`${knowledge.entryId}\` | ${escapeTableCell(knowledge.canonicalQuestion)} | ${escapeTableCell(knowledge.canonicalAnswer)} |`);
    }
    lines.push('');

    lines.push('### Décision humaine — à remplir', '', '```text', 'HUMAN_ADJUDICATION:', 'decision: PENDING', 'rationale: PENDING', 'future_rule: PENDING', '```', '');
  });
  return `${lines.join('\n').replace(/\n+$/u, '')}\n`;
}

function renderSealedEquivalence(knowledge) {
  if (knowledge.sealedEquivalence === null) return '—';
  const members = knowledge.sealedEquivalence.memberEntryIds
    .map(entryId => `\`${entryId}\``)
    .join(', ');
  const preferred = knowledge.sealedEquivalence.preferredEntryId === null
    ? 'aucun `preferredEntryId` applicable'
    : `preferredEntryId : \`${knowledge.sealedEquivalence.preferredEntryId}\``;
  return `Groupe scellé : ${members} ; ${preferred}`;
}

export function renderStructuralAdjudicationBatch03(batch) {
  const lines = [
    '# Adjudication structurelle — Batch 03 : ambiguïtés 02',
    '',
    `- Batch : \`${batch.batchId}\``,
    `- Matrice source : \`${batch.sourceMatrixFingerprint}\``,
    `- Seal Reviewer A : \`${batch.sourceReviewerSeals.reviewerA}\``,
    `- Seal Reviewer B : \`${batch.sourceReviewerSeals.reviewerB}\``,
    `- Statut : \`${batch.status}\``,
    `- Autorisation de génération : \`${batch.generationAuthorized}\``,
    `- Adjudication effectuée : \`${batch.adjudicationPerformed}\``,
    `- Items : ${batch.itemCount}`,
    '',
    '## Doctrine de revue',
    '',
    '- Liquid Core évalue l’answerability et le retrieval à partir du contenu publié.',
    '- Liquid Core ne génère aucune vérité projet.',
    '- Catégories possibles : `structuralAmbiguity`, `artificialOrMalformed`, `blockedTemporalInstability`, `insufficientEvidence`.',
    '- Mécanismes possibles avec `structuralAmbiguity` : `alternativeIntentReadings`, `underspecifiedReference`, `competingPublishedKnowledge`.',
    '- L’arbitrage humain doit établir une structure de vérité propre pour la future génération du corpus.',
    '- `generationAuthorized` reste `false`.',
    '',
    '> Le paquet restitue uniquement le contexte réellement présent dans les sources scellées. Il ne reconstruit aucune formulation utilisateur absente et ne propose aucune décision.',
    ''
  ];

  batch.items.forEach((item, index) => {
    lines.push(`## ${index + 1}. ${item.sourceItemId} — ${item.sourceFamily.title}`, '');
    lines.push('### Identification', '');
    lines.push(`- Item canonique : \`${item.sourceItemId}\``);
    lines.push(`- Type : \`${item.packetKind}\``);
    lines.push(`- Contexte métier réellement disponible : ${item.sourceFamily.businessContext}`);
    lines.push('', 'generated user formulation: NOT AVAILABLE', '');

    renderAmbiguityReviewer(lines, item, 'reviewerA', 'A');
    renderAmbiguityReviewer(lines, item, 'reviewerB', 'B');

    lines.push('### Comparaison A/B', '');
    lines.push(`- Statut exact : \`${item.comparison.status}\``);
    lines.push(`- Accord de premier niveau : ${item.comparison.firstLevelAgreement ? 'oui' : 'non'}`);
    lines.push(`- Accord complet : ${item.comparison.completeAgreement ? 'oui' : 'non'}`);
    lines.push(`- Accords stricts : ${item.comparison.strictAgreementFields.length === 0 ? 'aucun' : item.comparison.strictAgreementFields.map(field => `\`${field}\``).join(', ')}`);
    lines.push(`- Désaccords consignés : ${item.comparison.findings.map(finding => `\`${finding.field}\` (\`${finding.status}\`)`).join(', ')}`);
    lines.push('', 'Partition / crosswalk réel :', '');
    renderCrosswalk(lines, 'A', item.comparison.crosswalk.reviewerA);
    renderCrosswalk(lines, 'B', item.comparison.crosswalk.reviewerB);
    lines.push('');

    lines.push('### Candidate knowledge', '');
    lines.push('| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente |', '|---|---|---|---|');
    for (const knowledge of item.knowledge) {
      lines.push(`| \`${knowledge.entryId}\` | ${escapeTableCell(knowledge.canonicalQuestion)} | ${escapeTableCell(knowledge.canonicalAnswer)} | ${renderSealedEquivalence(knowledge)} |`);
    }
    lines.push('');

    lines.push('### Human decision', '', '```text', 'decision: PENDING', 'rationale: PENDING', 'future_rule: PENDING', '```', '');
  });
  return `${lines.join('\n').replace(/\n+$/u, '')}\n`;
}

function renderScenarioReviewer(lines, item, reviewerKey, label) {
  const reviewer = item[reviewerKey];
  const fragmentation = reviewer.decisions.fragmentationAssessment;
  const familyPartition = reviewer.decisions.reviewerScenarioFamilyPartition;
  lines.push(`### Reviewer ${label}`, '');
  lines.push(`- Disposition : \`${fragmentation.value}\``);
  lines.push(`- Structure de partition : \`${familyPartition.value}\``);
  if (familyPartition.canonicalPartition === null) {
    lines.push('- Groupes de scénario : non établis (`insufficientEvidence`).');
  } else {
    lines.push('- Groupes de scénario :');
    familyPartition.canonicalPartition.forEach((group, index) => {
      lines.push(`  - Groupe ${index + 1} : ${group.map(entryId => `\`${entryId}\``).join(', ')}`);
    });
  }
  lines.push(`- Candidats de fusion : ${fragmentation.mergeCanonicalReviewItemIds.length === 0
    ? 'aucun'
    : fragmentation.mergeCanonicalReviewItemIds.map(itemId => `\`${itemId}\``).join(', ')}`);
  lines.push('', `Rationales Reviewer ${label} :`, '');
  lines.push(`- Disposition : ${reviewer.rationales.fragmentationAssessment}`);
  lines.push(`- Partition : ${reviewer.rationales.reviewerScenarioFamilyPartition}`, '');
}

function renderExistingAdjudicationContext(lines, context) {
  lines.push(`#### ${context.sourceItemId}`, '');
  lines.push(`- Type : \`${context.packetKind}\``);
  lines.push(`- q-ids du présent brief directement concernés : ${context.affectedEntryIds.map(entryId => `\`${entryId}\``).join(', ')}`);
  const decision = context.decision;
  if (context.packetKind === 'EQUIVALENCE_AND_PREFERRED') {
    lines.push(`- Groupe d’équivalence scellé : ${decision.substantiveEquivalencePartition.canonicalPartition[0].map(entryId => `\`${entryId}\``).join(', ')}`);
    lines.push(`- preferredEntryId scellé : \`${decision.preferredEntrySelection.preferredEntryId}\``);
  } else if (context.packetKind === 'KNOWLEDGE_BOUNDARIES') {
    lines.push('- Partition de frontière scellée :');
    for (const group of decision.knowledgeComponentBoundary.canonicalPartition) {
      lines.push(`  - \`${group.componentId}\` : ${group.memberEntryIds.map(entryId => `\`${entryId}\``).join(', ')}`);
    }
    lines.push('- Règles de frontière scellées :');
    for (const rule of decision.futureCoverageBoundaryRules) {
      lines.push(`  - \`${rule.componentId}\` : ${rule.rule}`);
    }
  } else if (context.packetKind === 'AMBIGUITY_CAPACITY_FAMILIES') {
    lines.push(`- Classification scellée : \`${decision.ambiguityFamilyDisposition.value}\``);
    lines.push(`- Mécanisme scellé : ${decision.ambiguityMechanism.value === null ? 'non applicable' : `\`${decision.ambiguityMechanism.value}\``}`);
    if (decision.substantiallyDifferentCoveredGroups.canonicalPartition !== null) {
      lines.push('- Groupes scellés :');
      decision.substantiallyDifferentCoveredGroups.canonicalPartition.forEach((group, index) => {
        lines.push(`  - Groupe ${index + 1} : ${group.map(entryId => `\`${entryId}\``).join(', ')}`);
      });
    }
  }
  lines.push(`- Rationale humaine scellée : ${context.humanRationale}`);
  if (context.futureRule) lines.push(`- Règle future scellée : ${context.futureRule}`);
  lines.push('');
}

export function renderStructuralAdjudicationBatch04(batch) {
  const lines = [
    '# Adjudication structurelle — Batch 04 : scenario families 01',
    '',
    `- Batch : \`${batch.batchId}\``,
    `- Statut : \`${batch.status}\``,
    `- Autorisation de génération : \`${batch.generationAuthorized}\``,
    `- Adjudication effectuée : \`${batch.adjudicationPerformed}\``,
    `- Items : ${batch.itemCount}`,
    '',
    '## Doctrine de revue',
    '',
    '- Une scenario family n’est pas un groupe d’équivalence de réponses.',
    '- Une scenario family peut regrouper des formulations proches sans que leurs réponses soient équivalentes.',
    '- La famille doit néanmoins représenter un même scénario métier suffisamment stable.',
    '- Une proximité seulement lexicale ou thématique ne suffit pas.',
    '- Une famille trop large ne doit pas mélanger plusieurs décisions utilisateur.',
    '- Les décisions humaines structurent la future génération du corpus.',
    '- `generationAuthorized` reste `false`.',
    '',
    '> Question d’arbitrage : ces connaissances décrivent-elles le même scénario utilisateur suffisamment cohérent pour partager une famille de génération, ou faut-il les séparer ?',
    '> Aucun `scenarioFamilyId` ni aucune formulation utilisateur générée n’existe encore dans les artefacts sources.',
    ''
  ];

  batch.items.forEach((item, index) => {
    lines.push(`## ${index + 1}. ${item.sourceItemId} — ${item.sourceFamily.title}`, '');
    lines.push('### Identification', '');
    lines.push(`- Item canonique : \`${item.sourceItemId}\``);
    lines.push(`- Contexte métier réellement disponible : ${item.sourceFamily.businessContext}`);
    lines.push('', 'generated user formulation: NOT AVAILABLE', '');

    renderScenarioReviewer(lines, item, 'reviewerA', 'A');
    renderScenarioReviewer(lines, item, 'reviewerB', 'B');

    lines.push('### Comparaison A/B', '');
    lines.push(`- Statut exact : \`${item.comparison.status}\``);
    lines.push(`- Accord de premier niveau : ${item.comparison.firstLevelAgreement ? 'oui' : 'non'}`);
    lines.push(`- Accord complet : ${item.comparison.completeAgreement ? 'oui' : 'non'}`);
    lines.push(`- Accords stricts : ${item.comparison.strictAgreementFields.length === 0 ? 'aucun' : item.comparison.strictAgreementFields.map(field => `\`${field}\``).join(', ')}`);
    lines.push(`- Désaccords consignés : ${item.comparison.findings.map(finding => `\`${finding.field}\` (\`${finding.status}\`)`).join(', ')}`);
    lines.push('', 'Partition / crosswalk réel :', '');
    renderCrosswalk(lines, 'A', item.comparison.crosswalk.reviewerA);
    renderCrosswalk(lines, 'B', item.comparison.crosswalk.reviewerB);
    lines.push('');

    lines.push('### Candidate knowledge', '');
    lines.push('| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente | Scenario family existante |', '|---|---|---|---|---|');
    for (const knowledge of item.knowledge) {
      lines.push(`| \`${knowledge.entryId}\` | ${escapeTableCell(knowledge.canonicalQuestion)} | ${escapeTableCell(knowledge.canonicalAnswer)} | ${renderSealedEquivalence(knowledge)} | non attribuée |`);
    }
    lines.push('');

    if (item.existingAdjudicationContext.length > 0) {
      lines.push('### Existing adjudication context', '');
      for (const context of item.existingAdjudicationContext) renderExistingAdjudicationContext(lines, context);
      lines.push('> Ce contexte scellé est restitué sans réinterprétation et ne préremplit pas la décision scenario-family.', '');
    }

    lines.push('### Human decision', '', '```text', 'decision: PENDING', 'rationale: PENDING', 'future_rule: PENDING', '```', '');
  });
  return `${lines.join('\n').replace(/\n+$/u, '')}\n`;
}

export function materialiseStructuralAdjudicationBatch01({
  generatedRoot = DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
  outputPath = DEFAULT_ADJUDICATION_BATCH_01_PATH,
  checkOnly = false
} = {}) {
  const batch = buildStructuralAdjudicationBatch01({ generatedRoot });
  const expected = renderStructuralAdjudicationBatch01(batch);
  if (checkOnly) {
    const actual = readFileSync(outputPath, 'utf8').replace(/\r\n/g, '\n');
    if (actual !== expected.replace(/\r\n/g, '\n')) throw new Error(`Stale adjudication batch: ${outputPath}`);
  } else {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, expected, 'utf8');
  }
  return {
    batchId: batch.batchId,
    checkOnly,
    generationAuthorized: batch.generationAuthorized,
    itemCount: batch.itemCount,
    sourceMatrixFingerprint: batch.sourceMatrixFingerprint,
    status: batch.status
  };
}

export function materialiseStructuralAdjudicationBatch02({
  generatedRoot = DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
  outputPath = DEFAULT_ADJUDICATION_BATCH_02_PATH,
  checkOnly = false
} = {}) {
  const batch = buildStructuralAdjudicationBatch02({ generatedRoot });
  const expected = renderStructuralAdjudicationBatch02(batch);
  if (checkOnly) {
    const actual = readFileSync(outputPath, 'utf8').replace(/\r\n/g, '\n');
    if (actual !== expected.replace(/\r\n/g, '\n')) throw new Error(`Stale adjudication batch: ${outputPath}`);
  } else {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, expected, 'utf8');
  }
  return {
    batchId: batch.batchId,
    checkOnly,
    generationAuthorized: batch.generationAuthorized,
    itemCount: batch.itemCount,
    sourceMatrixFingerprint: batch.sourceMatrixFingerprint,
    status: batch.status
  };
}

export function materialiseStructuralAdjudicationBatch03({
  generatedRoot = DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
  outputPath = DEFAULT_ADJUDICATION_BATCH_03_PATH,
  checkOnly = false
} = {}) {
  const batch = buildStructuralAdjudicationBatch03({ generatedRoot });
  const expected = renderStructuralAdjudicationBatch03(batch);
  if (checkOnly) {
    const actual = readFileSync(outputPath, 'utf8').replace(/\r\n/g, '\n');
    if (actual !== expected.replace(/\r\n/g, '\n')) throw new Error(`Stale adjudication batch: ${outputPath}`);
  } else {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, expected, 'utf8');
  }
  return {
    batchId: batch.batchId,
    checkOnly,
    generationAuthorized: batch.generationAuthorized,
    itemCount: batch.itemCount,
    sourceMatrixFingerprint: batch.sourceMatrixFingerprint,
    status: batch.status
  };
}

export function materialiseStructuralAdjudicationBatch04({
  generatedRoot = DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
  outputPath = DEFAULT_ADJUDICATION_BATCH_04_PATH,
  checkOnly = false
} = {}) {
  const batch = buildStructuralAdjudicationBatch04({ generatedRoot });
  const expected = renderStructuralAdjudicationBatch04(batch);
  if (checkOnly) {
    const actual = readFileSync(outputPath, 'utf8').replace(/\r\n/g, '\n');
    if (actual !== expected.replace(/\r\n/g, '\n')) throw new Error(`Stale adjudication batch: ${outputPath}`);
  } else {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, expected, 'utf8');
  }
  return {
    batchId: batch.batchId,
    checkOnly,
    generationAuthorized: batch.generationAuthorized,
    itemCount: batch.itemCount,
    sourceMatrixFingerprint: batch.sourceMatrixFingerprint,
    status: batch.status
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const batchArgument = process.argv.find(argument => argument.startsWith('--batch='))?.split('=')[1] ?? '01';
  const materialisers = {
    '01': materialiseStructuralAdjudicationBatch01,
    '02': materialiseStructuralAdjudicationBatch02,
    '03': materialiseStructuralAdjudicationBatch03,
    '04': materialiseStructuralAdjudicationBatch04
  };
  const materialise = materialisers[batchArgument];
  if (!materialise) throw new Error(`Unsupported adjudication batch: ${batchArgument}`);
  const result = materialise({ checkOnly: process.argv.includes('--check') });
  process.stdout.write(`${canonicalJson(result)}\n`);
}
