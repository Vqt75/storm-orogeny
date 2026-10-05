import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { createPublication } from '../src/domain/publication/repository.js';
import { insertQuestion } from '../src/domain/studio/repository.js';
import { findCurrentAccess, decryptCurrentCapability } from '../src/domain/publicAccess/repository.js';
import {
  publishedManifestToKnowledgeCorpus, CorpusState, UnavailableReason, CORPUS_SCHEMA_VERSION
} from '../src/domain/stormMatch/corpus.js';
import { resolvePublicKnowledgeCorpus, activePublicationCorpusForAccess } from '../src/domain/stormMatch/activePublicationCorpus.js';

// Storm Match — ProjectKnowledgeCorpusSnapshot (contrat V1.1).
// publication active -> Manifest -> corpus de connaissance scopé.
// Fixtures synthétiques neutres uniquement : aucun projet réel, aucun
// Gold, aucun jeu d'évaluation (test/storm-match-eval/ jamais touché).

const config = loadConfig();
const pool = getPool(config);
const STORM_MATCH_DIR = path.join(process.cwd(), 'src', 'domain', 'stormMatch');

const BINDING = { tenantId: 'tenant-1', projectId: 'project-1', publicationId: 'publication-1', publicationRevision: 3 };

function manifestFixture({ revision = 3, contentLocale = 'fr', generatedAt = '2026-01-15T10:00:00.000Z', items, home } = {}) {
  return {
    schemaVersion: 1,
    meta: { generatedAt, revision, contentLocale },
    project: { name: 'Projet Synthétique' },
    branding: { colors: { primary: '#112233' } },
    edition: { id: 'ivory' },
    content: {
      home: home ?? { message: 'Bienvenue' },
      questions: {
        items: items ?? [
          { id: 'q-b', title: 'Où se trouve le futur site ?', answer: 'Au centre-ville.' },
          { id: 'q-a', title: 'Quand commencent les travaux ?', answer: 'Au printemps.' }
        ]
      }
    }
  };
}

function corpus(overrides = {}, manifestOverrides = {}) {
  return publishedManifestToKnowledgeCorpus({ ...BINDING, manifest: manifestFixture(manifestOverrides), ...overrides });
}

// ── Fixtures DB : deux tenants, trois projets, publication réelle ──

let ids = {};

async function cleanAll() {
  await pool.query('delete from project_publications');
  await pool.query('delete from project_section_content');
  await pool.query('delete from project_identity');
  await pool.query('delete from project_memberships');
  await pool.query('delete from tenant_memberships');
  await pool.query('delete from project_public_access');
  await pool.query('delete from projects');
  await pool.query('delete from users');
  await pool.query('delete from clients');
  await pool.query('delete from tenants');
}

async function seedProject(tenantId, clientSlug, name) {
  const { rows: [client] } = await pool.query(
    'insert into clients (tenant_id, name, normalized_slug) values ($1,$2,$3) returning id', [tenantId, `Client ${name}`, clientSlug]
  );
  const { rows: [project] } = await pool.query('insert into projects (tenant_id, name, client_id) values ($1,$2,$3) returning id', [tenantId, name, client.id]);
  await pool.query("insert into project_identity (tenant_id, project_id, theme, primary_color) values ($1,$2,'ivory','#1E1D1E')", [tenantId, project.id]);
  await pool.query("insert into project_settings (tenant_id, project_id, workspace_locale, content_locale) values ($1,$2,'de','fr')", [tenantId, project.id]);
  return { tenantId, projectId: project.id };
}

async function addQuestion(p, question, answer, position) {
  return insertQuestion(pool, { tenantId: p.tenantId, projectId: p.projectId, question, answerRuns: [{ text: answer }], position, userId: ids.user });
}

async function publish(p) {
  const result = await createPublication(pool, { tenantId: p.tenantId, projectId: p.projectId, userId: ids.user, encryptionKey: config.publicAccessEncryptionKey });
  assert.equal(result.status, 'active');
  return result;
}

async function publicAccessOf(p) {
  const access = await findCurrentAccess(pool, p.projectId);
  return { clientSlug: access.client_slug, projectSlug: access.project_slug, rawCapability: decryptCurrentCapability(access, config.publicAccessEncryptionKey) };
}

async function resetProject(p) {
  await pool.query('delete from project_publications where project_id=$1', [p.projectId]);
  await pool.query('delete from project_questions where project_id=$1', [p.projectId]);
  await pool.query("update project_settings set content_locale='fr' where project_id=$1", [p.projectId]);
}

test.before(async () => {
  await runMigrations();
  await cleanAll();
  const { rows: [tenantA] } = await pool.query("insert into tenants (name) values ('Tenant Corpus A') returning id");
  const { rows: [tenantB] } = await pool.query("insert into tenants (name) values ('Tenant Corpus B') returning id");
  const { rows: [user] } = await pool.query("insert into users (email, display_name) values ('editor@corpus.local','Editor Corpus') returning id");
  ids.user = user.id;
  ids.projectA = await seedProject(tenantA.id, 'client-corpus-a', 'Projet Corpus A');
  ids.projectB = await seedProject(tenantA.id, 'client-corpus-b', 'Projet Corpus B');
  ids.projectT = await seedProject(tenantB.id, 'client-corpus-t', 'Projet Corpus T');
});

test.after(async () => {
  await cleanAll();
  await closePool();
});

// ── 1-3 : états corpus depuis la publication active réelle ──

test('1. publication active -> snapshot prêt, dérivé du Manifest de cette publication', async () => {
  await resetProject(ids.projectA);
  await addQuestion(ids.projectA, 'Quand commencent les travaux ?', 'Au printemps.', 0);
  const publication = await publish(ids.projectA);

  const result = await resolvePublicKnowledgeCorpus(pool, await publicAccessOf(ids.projectA));
  assert.equal(result.state, CorpusState.READY);
  assert.equal(result.reason, null);
  const s = result.snapshot;
  assert.equal(s.schemaVersion, CORPUS_SCHEMA_VERSION);
  assert.equal(s.tenantId, ids.projectA.tenantId);
  assert.equal(s.projectId, ids.projectA.projectId);
  assert.equal(s.publicationId, publication.id);
  assert.equal(s.publicationRevision, publication.revision);
  assert.equal(s.contentLocale, 'fr');
  assert.equal(s.generatedAt, publication.manifest.meta.generatedAt);
  assert.equal(s.entries.length, 1);
  assert.equal(s.entries[0].sourceQuestionId, publication.manifest.content.questions.items[0].id);
  assert.equal(s.entries[0].question, 'Quand commencent les travaux ?');
  assert.equal(s.entries[0].answer, 'Au printemps.');
  assert.ok(Object.isFrozen(s) && Object.isFrozen(s.entries[0]), 'le snapshot est immuable');
});

test('2. aucune publication active -> CORPUS_UNAVAILABLE (jamais notCovered)', async () => {
  await resetProject(ids.projectA);
  await publish(ids.projectA);
  const access = await publicAccessOf(ids.projectA);
  await pool.query('delete from project_publications where project_id=$1', [ids.projectA.projectId]);

  const result = await resolvePublicKnowledgeCorpus(pool, access);
  assert.equal(result.state, CorpusState.UNAVAILABLE);
  assert.equal(result.reason, UnavailableReason.NO_ACTIVE_PUBLICATION);
  assert.equal(result.snapshot, null);
  assert.notEqual(result.state, 'notCovered');

  const unknown = await resolvePublicKnowledgeCorpus(pool, { ...access, rawCapability: 'capability-inconnue' });
  assert.equal(unknown.state, CorpusState.UNAVAILABLE);
});

test('3. publication active sans Questions -> CORPUS_EMPTY (snapshot à zéro entrée, distinct de unavailable)', async () => {
  await resetProject(ids.projectA);
  const publication = await publish(ids.projectA);
  const result = await resolvePublicKnowledgeCorpus(pool, await publicAccessOf(ids.projectA));
  assert.equal(result.state, CorpusState.EMPTY);
  assert.equal(result.reason, null);
  assert.deepEqual(result.snapshot.entries, []);
  assert.equal(result.snapshot.publicationRevision, publication.revision);

  assert.equal(corpus({}, { items: [] }).state, CorpusState.EMPTY);
  const noQuestions = manifestFixture();
  delete noQuestions.content.questions;
  assert.equal(publishedManifestToKnowledgeCorpus({ ...BINDING, manifest: noQuestions }).state, CorpusState.EMPTY);
});

// ── 4-5 : binding tenant/projet/publication ──

test('4. Project A ne peut jamais obtenir le Manifest de Project B', async () => {
  await resetProject(ids.projectA);
  await resetProject(ids.projectB);
  await addQuestion(ids.projectA, 'Question du projet A', 'Réponse A', 0);
  await addQuestion(ids.projectB, 'Question du projet B', 'Réponse B', 0);
  await publish(ids.projectA);
  const pubB = await publish(ids.projectB);

  const a = await resolvePublicKnowledgeCorpus(pool, await publicAccessOf(ids.projectA));
  assert.equal(a.snapshot.projectId, ids.projectA.projectId);
  assert.deepEqual(a.snapshot.entries.map(e => e.question), ['Question du projet A']);
  assert.notEqual(a.snapshot.publicationId, pubB.id);

  // Identité projet A présentée avec les slugs du projet B -> jamais résolue.
  const accessA = await publicAccessOf(ids.projectA);
  const accessB = await publicAccessOf(ids.projectB);
  const mixed = await resolvePublicKnowledgeCorpus(pool, { ...accessB, rawCapability: accessA.rawCapability });
  assert.equal(mixed.state, CorpusState.UNAVAILABLE);
});

test('5. Tenant A ne peut jamais utiliser la publication d\'un Tenant B', async () => {
  await resetProject(ids.projectT);
  await addQuestion(ids.projectT, 'Question du tenant B', 'Réponse tenant B', 0);
  await publish(ids.projectT);

  const forged = await activePublicationCorpusForAccess(pool, { kind: 'active', tenantId: ids.projectA.tenantId, projectId: ids.projectT.projectId });
  assert.equal(forged.state, CorpusState.UNAVAILABLE);
  assert.equal(forged.reason, UnavailableReason.PUBLICATION_SCOPE_MISMATCH);
  assert.equal(forged.snapshot, null);

  const legit = await activePublicationCorpusForAccess(pool, { kind: 'active', tenantId: ids.projectT.tenantId, projectId: ids.projectT.projectId });
  assert.equal(legit.state, CorpusState.READY);
  assert.equal(legit.snapshot.tenantId, ids.projectT.tenantId);
});

test('6. publicationRevision doit égaler manifest.meta.revision (adapter et ligne active)', async () => {
  const mismatch = corpus({ publicationRevision: 4 });
  assert.equal(mismatch.state, CorpusState.UNAVAILABLE);
  assert.equal(mismatch.reason, UnavailableReason.REVISION_MISMATCH);
  assert.equal(corpus({}, { revision: '3' }).reason, UnavailableReason.REVISION_MISMATCH);

  await resetProject(ids.projectA);
  const publication = await publish(ids.projectA);
  await pool.query("update project_publications set manifest = jsonb_set(manifest, '{meta,revision}', '99') where id=$1", [publication.id]);
  const result = await resolvePublicKnowledgeCorpus(pool, await publicAccessOf(ids.projectA));
  assert.equal(result.state, CorpusState.UNAVAILABLE);
  assert.equal(result.reason, UnavailableReason.REVISION_MISMATCH);
});

// ── 7-9 : locale et generatedAt viennent du Manifest uniquement ──

test('7. contentLocale vient uniquement de manifest.meta.contentLocale, jamais de project_settings live', async () => {
  await resetProject(ids.projectA);
  await addQuestion(ids.projectA, 'Quand ?', 'Bientôt.', 0);
  await publish(ids.projectA);
  await pool.query("update project_settings set content_locale='en' where project_id=$1", [ids.projectA.projectId]);

  const result = await resolvePublicKnowledgeCorpus(pool, await publicAccessOf(ids.projectA));
  assert.equal(result.snapshot.contentLocale, 'fr', 'la locale Studio courante ne doit jamais atteindre le corpus');
  assert.ok(result.snapshot.entries.every(e => e.locale === 'fr'));
  assert.equal(corpus({}, { contentLocale: 'nl' }).snapshot.contentLocale, 'nl');
});

test('8. contentLocale absente ou malformée -> CORPUS_UNAVAILABLE', () => {
  const missing = manifestFixture();
  delete missing.meta.contentLocale;
  assert.equal(publishedManifestToKnowledgeCorpus({ ...BINDING, manifest: missing }).reason, UnavailableReason.CONTENT_LOCALE_INVALID);
  for (const contentLocale of [null, '', 'FR', 'français', 42, 'fr_FR']) {
    const result = corpus({}, { contentLocale });
    assert.equal(result.state, CorpusState.UNAVAILABLE, `contentLocale=${String(contentLocale)}`);
    assert.equal(result.reason, UnavailableReason.CONTENT_LOCALE_INVALID);
  }
  const noMeta = manifestFixture();
  delete noMeta.meta;
  assert.equal(publishedManifestToKnowledgeCorpus({ ...BINDING, manifest: noMeta }).reason, UnavailableReason.MANIFEST_UNREADABLE);
  assert.equal(publishedManifestToKnowledgeCorpus({ ...BINDING, manifest: null }).reason, UnavailableReason.MANIFEST_UNREADABLE);
  assert.equal(corpus({}, { items: [{ id: 'q', title: 'Sans réponse' }] }).reason, UnavailableReason.QUESTIONS_MALFORMED);
  assert.equal(corpus({}, { items: [{ id: 'q', title: 'A', answer: 'a' }, { id: 'q', title: 'B', answer: 'b' }] }).reason, UnavailableReason.QUESTIONS_MALFORMED);
});

test('9. generatedAt vient du Manifest, jamais recalculé', () => {
  assert.equal(corpus({}, { generatedAt: '2025-06-01T08:30:00.000Z' }).snapshot.generatedAt, '2025-06-01T08:30:00.000Z');
  assert.equal(corpus({}, { generatedAt: 'pas-une-date' }).reason, UnavailableReason.GENERATED_AT_INVALID);
});

// ── 10-19 : ordre, fingerprints, isolation ──

test('10. ordre des entries déterministe par sourceQuestionId, indépendant de l\'ordre du Manifest', () => {
  const items = [
    { id: 'q-c', title: 'C', answer: 'c' },
    { id: 'q-a', title: 'A', answer: 'a' },
    { id: 'q-b', title: 'B', answer: 'b' }
  ];
  const forward = corpus({}, { items });
  const reversed = corpus({}, { items: items.slice().reverse() });
  assert.deepEqual(forward.snapshot.entries.map(e => e.sourceQuestionId), ['q-a', 'q-b', 'q-c']);
  assert.deepEqual(reversed.snapshot.entries, forward.snapshot.entries);
  assert.equal(reversed.snapshot.corpusFingerprint, forward.snapshot.corpusFingerprint);
});

test('11. même connaissance + même locale -> même corpusFingerprint', () => {
  assert.equal(corpus().snapshot.corpusFingerprint, corpus().snapshot.corpusFingerprint);
  assert.match(corpus().snapshot.corpusFingerprint, /^sha256:[0-9a-f]{64}$/);
});

function visualOnlyChange() {
  return publishedManifestToKnowledgeCorpus({
    ...BINDING,
    manifest: { ...manifestFixture({ home: { message: 'Nouveau message d\'accueil' } }), branding: { colors: { primary: '#445566' } } }
  });
}

test('12. changement de présentation seul -> même corpusFingerprint', () => {
  assert.equal(visualOnlyChange().snapshot.corpusFingerprint, corpus().snapshot.corpusFingerprint);
});

test('13. changement de présentation -> manifestFingerprint différent, distinct du corpusFingerprint', () => {
  const base = corpus();
  assert.notEqual(visualOnlyChange().snapshot.manifestFingerprint, base.snapshot.manifestFingerprint);
  assert.notEqual(base.snapshot.manifestFingerprint, base.snapshot.corpusFingerprint);
});

test('14. question modifiée -> corpusFingerprint différent', () => {
  const changed = corpus({}, { items: [{ id: 'q-a', title: 'Quand démarrent les travaux ?', answer: 'Au printemps.' }, { id: 'q-b', title: 'Où se trouve le futur site ?', answer: 'Au centre-ville.' }] });
  assert.notEqual(changed.snapshot.corpusFingerprint, corpus().snapshot.corpusFingerprint);
});

test('15. réponse modifiée -> corpusFingerprint différent', () => {
  const changed = corpus({}, { items: [{ id: 'q-a', title: 'Quand commencent les travaux ?', answer: 'À l\'automne.' }, { id: 'q-b', title: 'Où se trouve le futur site ?', answer: 'Au centre-ville.' }] });
  assert.notEqual(changed.snapshot.corpusFingerprint, corpus().snapshot.corpusFingerprint);
});

test('16. locale modifiée -> corpusFingerprint différent', () => {
  assert.notEqual(corpus({}, { contentLocale: 'en' }).snapshot.corpusFingerprint, corpus().snapshot.corpusFingerprint);
});

test('17. tenant/project/publication/revision/generatedAt exclus du corpusFingerprint', () => {
  const base = corpus().snapshot;
  const other = publishedManifestToKnowledgeCorpus({
    tenantId: 'tenant-2', projectId: 'project-2', publicationId: 'publication-9', publicationRevision: 8,
    manifest: manifestFixture({ revision: 8, generatedAt: '2027-03-03T03:03:03.000Z' })
  }).snapshot;
  assert.equal(other.corpusFingerprint, base.corpusFingerprint);
});

test('18. tenant/project/revision inclus dans l\'isolation runtime ; publicationId dans l\'identité du snapshot', () => {
  const base = corpus().snapshot;
  const variants = [
    corpus({ tenantId: 'tenant-2' }).snapshot,
    corpus({ projectId: 'project-2' }).snapshot,
    publishedManifestToKnowledgeCorpus({ ...BINDING, publicationRevision: 4, manifest: manifestFixture({ revision: 4 }) }).snapshot
  ];
  for (const v of variants) {
    assert.equal(v.corpusFingerprint, base.corpusFingerprint);
    assert.notEqual(v.isolationKey, base.isolationKey);
    assert.notEqual(v.snapshotId, base.snapshotId);
  }
  const otherPublication = corpus({ publicationId: 'publication-2' }).snapshot;
  assert.equal(otherPublication.isolationKey, base.isolationKey, 'l\'isolation runtime reste tenant+projet+révision+connaissance');
  assert.notEqual(otherPublication.snapshotId, base.snapshotId, 'publicationId fait partie de l\'identité du snapshot');
});

test('19. mêmes IDs et mêmes formulations dans deux projets restent strictement isolés', () => {
  const p1 = corpus({ projectId: 'project-1' }).snapshot;
  const p2 = corpus({ projectId: 'project-2', publicationId: 'publication-2' }).snapshot;
  assert.equal(p1.corpusFingerprint, p2.corpusFingerprint, 'connaissance identique -> fingerprint de connaissance identique');
  assert.notEqual(p1.isolationKey, p2.isolationKey);
  assert.notEqual(p1.snapshotId, p2.snapshotId);
  p1.entries.forEach((e, i) => {
    assert.equal(e.sourceQuestionId, p2.entries[i].sourceQuestionId);
    assert.notEqual(e.knowledgeEntryId, p2.entries[i].knowledgeEntryId);
    assert.notEqual(e.entryFingerprint, p2.entries[i].entryFingerprint);
  });
});

// ── 20-24 : absence de Gold, de projet spécial, de brouillons, d'injection, de ré-entraînement ──

test('20. aucun Gold / split / métadonnée d\'évaluation dans le snapshot, même si le Manifest en portait', () => {
  const result = corpus({}, {
    items: [{ id: 'q-a', title: 'A', answer: 'a', goldLabel: 'x', split: 'holdout', scenarioFamilyId: 'f1', answerEquivalenceGroupId: 'g1', reviewState: 'approved', benchmarkRisk: 'high', authoredBy: 'someone' }]
  });
  assert.deepEqual(Object.keys(result.snapshot).sort(), [
    'contentLocale', 'corpusFingerprint', 'entries', 'generatedAt', 'isolationKey', 'manifestFingerprint',
    'projectId', 'publicationId', 'publicationRevision', 'schemaVersion', 'snapshotId', 'tenantId'
  ]);
  assert.deepEqual(Object.keys(result.snapshot.entries[0]).sort(), [
    'answer', 'entryFingerprint', 'knowledgeEntryId', 'locale', 'question', 'sourcePublicationRevision', 'sourceQuestionId'
  ]);
  assert.ok(!/gold|holdout|calibration|scenarioFamily|equivalence|review|benchmark|authored/i.test(JSON.stringify(result.snapshot)));
});

// Code vivant uniquement : les commentaires peuvent légitimement nommer
// ce que le domaine refuse de lire (brouillons, Control, Pilotage...).
function stormMatchSources() {
  return fs.readdirSync(STORM_MATCH_DIR).filter(f => f.endsWith('.js')).map(f => ({
    file: f,
    source: fs.readFileSync(path.join(STORM_MATCH_DIR, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  }));
}

test('21. domaine stormMatch : aucun projet spécial, aucun corpus codé en dur, aucun repli projet', () => {
  const sources = stormMatchSources();
  assert.deepEqual(sources.map(s => s.file).sort(), ['activePublicationCorpus.js', 'baselineMatcher.js', 'corpus.js', 'runtime.js']);
  for (const { file, source } of sources) {
    assert.ok(!/cobalt|[ée]quinoxe/i.test(source), `${file} ne doit contenir aucun literal projet spécial`);
    assert.ok(!/fallback/i.test(source), `${file} ne doit contenir aucun repli`);
  }
});

test('22. aucun accès aux brouillons Studio : une Question ajoutée après publication n\'atteint jamais le corpus', async () => {
  for (const { file, source } of stormMatchSources()) {
    assert.ok(!/project_questions|studio\/repository|section_content|memberships|control|pilotage/i.test(source), `${file} ne doit lire aucune source Studio/Control/Pilotage`);
  }
  await resetProject(ids.projectA);
  await addQuestion(ids.projectA, 'Question publiée', 'Réponse publiée', 0);
  await publish(ids.projectA);
  await addQuestion(ids.projectA, 'Brouillon jamais publié', 'Réponse brouillon', 1);

  const result = await resolvePublicKnowledgeCorpus(pool, await publicAccessOf(ids.projectA));
  assert.deepEqual(result.snapshot.entries.map(e => e.question), ['Question publiée']);
});

test('23. aucune connaissance étrangère injectable par l\'appelant', async () => {
  await resetProject(ids.projectA);
  await addQuestion(ids.projectA, 'Question légitime', 'Réponse légitime', 0);
  await publish(ids.projectA);
  const foreign = manifestFixture({ items: [{ id: 'x', title: 'Question injectée', answer: 'Réponse injectée' }] });
  const access = await publicAccessOf(ids.projectA);

  const viaAccess = await resolvePublicKnowledgeCorpus(pool, { ...access, manifest: foreign, publicationId: 'forged', publicationRevision: 1 });
  const viaResolution = await activePublicationCorpusForAccess(pool, { kind: 'active', tenantId: ids.projectA.tenantId, projectId: ids.projectA.projectId, manifest: foreign });
  for (const result of [viaAccess, viaResolution]) {
    assert.equal(result.state, CorpusState.READY);
    assert.deepEqual(result.snapshot.entries.map(e => e.question), ['Question légitime']);
    assert.notEqual(result.snapshot.publicationId, 'forged');
  }
});

test('24. republication -> nouveau binding corpus, jamais un ré-entraînement', async () => {
  for (const { file, source } of stormMatchSources()) {
    assert.ok(!/retrain|training|classifier|liquidcore|storm-match-eval/i.test(source), `${file} ne doit connaître aucun cycle d'entraînement`);
  }
  await resetProject(ids.projectA);
  await addQuestion(ids.projectA, 'Quand ?', 'Bientôt.', 0);
  await publish(ids.projectA);
  const first = (await resolvePublicKnowledgeCorpus(pool, await publicAccessOf(ids.projectA))).snapshot;
  await publish(ids.projectA);
  const second = (await resolvePublicKnowledgeCorpus(pool, await publicAccessOf(ids.projectA))).snapshot;

  assert.equal(second.publicationRevision, first.publicationRevision + 1);
  assert.equal(second.corpusFingerprint, first.corpusFingerprint, 'connaissance inchangée');
  assert.notEqual(second.isolationKey, first.isolationKey, 'nouveau binding corpus/index');
  assert.notEqual(second.snapshotId, first.snapshotId);
  assert.ok(!Object.keys(second).some(k => /model|train|index/i.test(k)), 'le snapshot ne porte aucun état de modèle');
});

test('25. fingerprints déterministes sur répétition', () => {
  const runs = Array.from({ length: 5 }, () => corpus().snapshot);
  for (const s of runs.slice(1)) {
    assert.equal(s.corpusFingerprint, runs[0].corpusFingerprint);
    assert.equal(s.manifestFingerprint, runs[0].manifestFingerprint);
    assert.equal(s.isolationKey, runs[0].isolationKey);
    assert.equal(s.snapshotId, runs[0].snapshotId);
    assert.deepEqual(s.entries, runs[0].entries);
  }
  // Ordre des clés du Manifest sans effet sur manifestFingerprint.
  const m = manifestFixture();
  const reordered = { content: m.content, edition: m.edition, branding: m.branding, project: m.project, meta: m.meta, schemaVersion: m.schemaVersion };
  assert.equal(publishedManifestToKnowledgeCorpus({ ...BINDING, manifest: reordered }).snapshot.manifestFingerprint, runs[0].manifestFingerprint);
});
