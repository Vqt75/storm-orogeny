import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalJson, fingerprint } from './review-packets.js';

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

export const EXPECTED_COMPARISON_MATRIX_FINGERPRINT = '2661f9530fc20272043a621cfbf43b836e883522cdc7dfae861e4a58e2db21dd';
export const DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT = join(import.meta.dirname, 'generated-structural-review');
export const DEFAULT_ADJUDICATION_BATCH_01_PATH = join(
  DEFAULT_GENERATED_STRUCTURAL_REVIEW_ROOT,
  'adjudication',
  'batches',
  'adjudication-batch-01-equivalence-boundaries.md'
);

const PACKET_BASENAME_BY_KIND = Object.freeze({
  EQUIVALENCE_AND_PREFERRED: '01-equivalence-preferred',
  KNOWLEDGE_BOUNDARIES: '02-knowledge-boundaries'
});

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
  if (!basename) throw new Error(`Packet kind is outside adjudication batch 01: ${packetKind}`);
  return readJson(join(
    generatedRoot,
    `reviewer-${reviewerSlot.toLowerCase()}`,
    `${basename}.fr.json`
  ));
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

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = materialiseStructuralAdjudicationBatch01({ checkOnly: process.argv.includes('--check') });
  process.stdout.write(`${canonicalJson(result)}\n`);
}
