// Storm Match — ProjectKnowledgeCorpusSnapshot (contrat V1.1).
//
// Logique de domaine PURE : aucun accès DB, aucun Express, aucune
// lecture Studio. Seule entrée : l'identité de confiance de la
// publication active (résolue en amont par activePublicationCorpus.js)
// et SON Manifest publié. La connaissance collaborateur dérive
// exclusivement de manifest.content.questions.items -- jamais d'un
// brouillon, jamais d'un corpus codé en dur, jamais d'un repli projet.
//
// Une nouvelle publication produit un nouveau snapshot (nouveau
// binding corpus/index), jamais un ré-entraînement : ce module ignore
// tout du cycle d'entraînement d'un classifieur.
import { createHash } from 'node:crypto';

export const CORPUS_SCHEMA_VERSION = 'storm-match.project-knowledge-corpus/1.1';

export const CorpusState = Object.freeze({
  READY: 'CORPUS_READY',
  EMPTY: 'CORPUS_EMPTY',
  UNAVAILABLE: 'CORPUS_UNAVAILABLE'
});

// Motifs d'indisponibilité -- toujours distincts de "notCovered", qui
// sera une décision sémantique du futur moteur, jamais un état corpus.
export const UnavailableReason = Object.freeze({
  NO_ACTIVE_PUBLICATION: 'NO_ACTIVE_PUBLICATION',
  PUBLICATION_SCOPE_MISMATCH: 'PUBLICATION_SCOPE_MISMATCH',
  BINDING_INVALID: 'BINDING_INVALID',
  MANIFEST_UNREADABLE: 'MANIFEST_UNREADABLE',
  REVISION_MISMATCH: 'REVISION_MISMATCH',
  CONTENT_LOCALE_INVALID: 'CONTENT_LOCALE_INVALID',
  GENERATED_AT_INVALID: 'GENERATED_AT_INVALID',
  QUESTIONS_MALFORMED: 'QUESTIONS_MALFORMED'
});

// Tag BCP 47 simplifié (langue + sous-tags optionnels) -- une valeur
// absente ou malformée rend le corpus indisponible, jamais devinée.
const LOCALE_PATTERN = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

// JSON canonique : clés triées récursivement, valeurs undefined
// omises (comme JSON.stringify). Base de tous les fingerprints --
// jamais dépendant de l'ordre d'insertion des clés.
export function canonicalJson(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('canonicalJson : nombre non fini');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(v => (v === undefined ? 'null' : canonicalJson(v))).join(',')}]`;
  if (typeof value === 'object') {
    const keys = Object.keys(value).filter(k => value[k] !== undefined).sort();
    return `{${keys.map(k => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  throw new TypeError(`canonicalJson : type non sérialisable (${typeof value})`);
}

export function fingerprint(value) {
  return `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`;
}

// Tri déterministe par sourceQuestionId -- comparaison par unités de
// code, jamais localeCompare (dépendant de l'environnement ICU).
function compareIds(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function unavailable(reason) {
  return deepFreeze({ state: CorpusState.UNAVAILABLE, reason, snapshot: null });
}

// Connaissance uniquement : version de schéma + locale + (id, question,
// réponse) triés. Jamais tenant/projet/publication/révision/generatedAt
// ni présentation du Manifest -- deux projets à connaissance identique
// partagent ce fingerprint, jamais pour autant leur isolation runtime.
export function computeCorpusFingerprint({ contentLocale, questions }) {
  const entries = questions
    .map(q => ({ sourceQuestionId: q.sourceQuestionId, question: q.question, answer: q.answer }))
    .sort((a, b) => compareIds(a.sourceQuestionId, b.sourceQuestionId));
  return fingerprint({ kind: 'corpus', schemaVersion: CORPUS_SCHEMA_VERSION, contentLocale, entries });
}

// Manifest publié exact, complet -- distinct du corpusFingerprint : une
// republication purement visuelle le change, sans changer la
// connaissance.
export function computeManifestFingerprint(manifest) {
  return fingerprint({ kind: 'manifest', manifest });
}

// Identité scopée d'une entrée -- règle contractuelle V1.1, jamais
// simplifiée : tenant + projet + publication + révision + question
// source.
export function computeKnowledgeEntryId({ tenantId, projectId, publicationId, publicationRevision, sourceQuestionId }) {
  return fingerprint({ kind: 'knowledge-entry-id', tenantId, projectId, publicationId, publicationRevision, sourceQuestionId });
}

// Isolation runtime (prepared corpus / cache) : strictement tenant +
// projet + révision + connaissance. Un corpusFingerprint partagé entre
// deux projets ne permet donc jamais de partager un cache.
export function computeIsolationKey({ tenantId, projectId, publicationRevision, corpusFingerprint }) {
  return fingerprint({ kind: 'isolation', tenantId, projectId, publicationRevision, corpusFingerprint });
}

// Identité du snapshot : l'isolation runtime + la publication exacte.
export function computeSnapshotId({ tenantId, projectId, publicationId, publicationRevision, corpusFingerprint }) {
  return fingerprint({ kind: 'snapshot', tenantId, projectId, publicationId, publicationRevision, corpusFingerprint });
}

function readPublishedQuestions(content) {
  if (!Object.prototype.hasOwnProperty.call(content, 'questions') || content.questions === undefined || content.questions === null) {
    return { questions: [] };
  }
  if (!isPlainObject(content.questions)) return { error: true };
  const items = content.questions.items;
  if (items === undefined) return { questions: [] };
  if (!Array.isArray(items)) return { error: true };

  const seen = new Set();
  const questions = [];
  for (const item of items) {
    if (!isPlainObject(item)) return { error: true };
    if (!isNonEmptyString(item.id) || typeof item.title !== 'string' || typeof item.answer !== 'string') return { error: true };
    if (seen.has(item.id)) return { error: true };
    seen.add(item.id);
    questions.push({ sourceQuestionId: item.id, question: item.title, answer: item.answer });
  }
  return { questions };
}

// publishedManifestToKnowledgeCorpus -- adapter V1.1.
//
// tenantId/projectId : résolution d'Accès Public de confiance.
// publicationId/publicationRevision : ligne project_publications active.
// contentLocale/generatedAt : manifest.meta UNIQUEMENT.
//
// Retourne toujours { state, reason, snapshot } :
//   CORPUS_READY       -> snapshot avec au moins une entrée ;
//   CORPUS_EMPTY       -> publication et Manifest valides, aucune
//                         Question publiée (snapshot à zéro entrée) ;
//   CORPUS_UNAVAILABLE -> snapshot null, motif explicite.
export function publishedManifestToKnowledgeCorpus({ tenantId, projectId, publicationId, publicationRevision, manifest } = {}) {
  if (!isNonEmptyString(tenantId) || !isNonEmptyString(projectId) || !isNonEmptyString(publicationId)
      || !Number.isInteger(publicationRevision) || publicationRevision < 1) {
    return unavailable(UnavailableReason.BINDING_INVALID);
  }
  if (!isPlainObject(manifest) || !isPlainObject(manifest.meta) || !isPlainObject(manifest.content)) {
    return unavailable(UnavailableReason.MANIFEST_UNREADABLE);
  }

  const { meta } = manifest;
  if (meta.revision !== publicationRevision) return unavailable(UnavailableReason.REVISION_MISMATCH);

  const contentLocale = meta.contentLocale;
  if (typeof contentLocale !== 'string' || !LOCALE_PATTERN.test(contentLocale)) {
    return unavailable(UnavailableReason.CONTENT_LOCALE_INVALID);
  }

  const generatedAt = meta.generatedAt;
  if (!isNonEmptyString(generatedAt) || Number.isNaN(Date.parse(generatedAt))) {
    return unavailable(UnavailableReason.GENERATED_AT_INVALID);
  }

  const published = readPublishedQuestions(manifest.content);
  if (published.error) return unavailable(UnavailableReason.QUESTIONS_MALFORMED);

  const corpusFingerprint = computeCorpusFingerprint({ contentLocale, questions: published.questions });
  const manifestFingerprint = computeManifestFingerprint(manifest);

  const entries = published.questions
    .slice()
    .sort((a, b) => compareIds(a.sourceQuestionId, b.sourceQuestionId))
    .map(q => {
      const entry = {
        knowledgeEntryId: computeKnowledgeEntryId({ tenantId, projectId, publicationId, publicationRevision, sourceQuestionId: q.sourceQuestionId }),
        sourceQuestionId: q.sourceQuestionId,
        question: q.question,
        answer: q.answer,
        locale: contentLocale,
        sourcePublicationRevision: publicationRevision
      };
      return { ...entry, entryFingerprint: fingerprint({ kind: 'knowledge-entry', ...entry }) };
    });

  const snapshot = {
    schemaVersion: CORPUS_SCHEMA_VERSION,
    tenantId,
    projectId,
    publicationId,
    publicationRevision,
    contentLocale,
    generatedAt,
    manifestFingerprint,
    corpusFingerprint,
    isolationKey: computeIsolationKey({ tenantId, projectId, publicationRevision, corpusFingerprint }),
    snapshotId: computeSnapshotId({ tenantId, projectId, publicationId, publicationRevision, corpusFingerprint }),
    entries
  };

  return deepFreeze({
    state: entries.length ? CorpusState.READY : CorpusState.EMPTY,
    reason: null,
    snapshot
  });
}
