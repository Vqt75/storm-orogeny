import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { insertQuestion } from '../src/domain/studio/repository.js';
import { insertProjectIdentity } from '../src/domain/project-setup/repository.js';
import { createPublication, findActivePublication } from '../src/domain/publication/repository.js';
import { matchFaq } from '../public/ivory/faq-engine.js';

// Bug trouvé en production (Product Integrity Pass #3) : des
// questions publiées dans Studio restaient introuvables par Storm
// Match dans Ivory, quelle que soit la proximité de la formulation.
// Audit complet du pipeline (Studio -> Candidate -> Compiler ->
// Manifest -> publication active) confirmé SAIN à chaque étape par
// test direct -- la vraie cause : scoreEntry() (faq-engine.js) ne
// calculait un score qu'à partir de keywords/phrases/intentSignals,
// des champs que le Compiler Orogeny ne produit JAMAIS (arbitrage
// documenté : "ne jamais fabriquer de keywords artificiels"). Score
// structurellement à 0 pour tout contenu réel, confirmé par test
// direct avant correctif. Corrigé par une extension bornée de
// scoreEntry (recouvrement de tokens avec entry.title, réutilisant
// normalize/tokenize déjà existants -- jamais un nouveau moteur).
//
// Ce test verifie le VRAI pipeline de bout en bout -- jamais un score
// calculé en isolation -- pour garantir que ce bug ne revient jamais
// silencieusement si le Compiler ou faq-engine.js changent de forme
// l'un sans l'autre.

const config = loadConfig();
const pool = getPool(config);
let ids = {};

async function cleanAll() {
  await pool.query('delete from project_publications');
  await pool.query('delete from project_questions');
  await pool.query('delete from project_identity');
  await pool.query('delete from project_memberships');
  await pool.query('delete from tenant_memberships');
  await pool.query('delete from project_public_access');
  await pool.query('delete from projects');
  await pool.query('delete from users');
  await pool.query('delete from clients');
  await pool.query('delete from tenants');
}

test.before(async () => {
  await runMigrations();
  await cleanAll();

  const { rows: [tenant] } = await pool.query("insert into tenants (name) values ('Tenant Storm Match Fix') returning id");
  const { rows: [user] } = await pool.query("insert into users (email, display_name) values ('fix@stormmatch.local','Fix') returning id");
  const { rows: [client] } = await pool.query(
    "insert into clients (tenant_id, name, normalized_slug) values ($1,'Client Storm Match Fix','client-storm-match-fix') returning id", [tenant.id]
  );
  const { rows: [project] } = await pool.query("insert into projects (tenant_id, name, client_id) values ($1,'Projet Storm Match Fix',$2) returning id", [tenant.id, client.id]);
  await insertProjectIdentity(pool, { tenantId: tenant.id, projectId: project.id, identity: {} });

  ids = { tenantId: tenant.id, userId: user.id, projectId: project.id };
});

test.after(async () => {
  await cleanAll();
  await closePool();
});

// Récupère le vrai Manifest actif via le même mécanisme que la route
// publique (findActivePublication -> compiled_manifest), jamais une
// relecture directe des tables Studio -- ce test doit échouer si le
// Compiler cesse un jour de propager les questions correctement.
async function fetchActiveManifestQuestions(projectId) {
  const publication = await findActivePublication(pool, projectId);
  assert.ok(publication, 'une publication active doit exister après createPublication()');
  return publication.manifest.content.questions.items;
}

test('question créée dans Studio -> publiée -> présente dans le Manifest actif -> trouvée par Storm Match sur une reformulation proche', async () => {
  await insertQuestion(pool, {
    tenantId: ids.tenantId, projectId: ids.projectId, position: 0, userId: ids.userId,
    question: 'Aurai-je un bureau attitré ?',
    answerRuns: [{ text: 'Non, vous aurez un quartier d\u2019équipe mais pas de poste nominatif.' }]
  });

  const publication = await createPublication(pool, { tenantId: ids.tenantId, projectId: ids.projectId, userId: ids.userId, encryptionKey: config.publicAccessEncryptionKey });
  assert.ok(publication, 'la publication doit réussir');

  const items = await fetchActiveManifestQuestions(ids.projectId);
  assert.equal(items.length, 1, 'la question doit être présente dans le Manifest actif publié');
  assert.equal(items[0].title, 'Aurai-je un bureau attitré ?');

  // Recherche Storm Match RÉELLE sur le contenu RÉELLEMENT publié --
  // jamais une liste construite à la main pour le test.
  const result = matchFaq('j\'aurai un bureau ?', items);
  assert.ok(result, 'une reformulation proche d\'une question publiée doit trouver une réponse, jamais "aucune réponse disponible"');
  assert.equal(result.id, items[0].id);
  assert.match(result.answer, /quartier/);
});

test('question sans correspondance dans le Manifest -> abstained (aucune réponse), jamais une réponse inventée', async () => {
  const items = await fetchActiveManifestQuestions(ids.projectId);
  const result = matchFaq('quelle est la météo à Paris demain', items);
  assert.equal(result, null, 'une question sans rapport avec le contenu publié doit abstenir, jamais halluciner une correspondance');
});

test('modifier les Questions dans Studio sans republier laisse l\'ancien Manifest actif inchangé (jamais une désynchronisation silencieuse)', async () => {
  const beforeItems = await fetchActiveManifestQuestions(ids.projectId);
  assert.equal(beforeItems.length, 1);

  await insertQuestion(pool, {
    tenantId: ids.tenantId, projectId: ids.projectId, position: 1, userId: ids.userId,
    question: 'Y aura-t-il un restaurant ?',
    answerRuns: [{ text: 'Oui.' }]
  });

  // Sans nouvelle publication, le Manifest ACTIF doit rester
  // exactement celui d'avant -- jamais refléter un contenu Studio non
  // publié (ce serait le vrai défaut de synchronisation que l'audit
  // devait exclure, pas un comportement à tolérer silencieusement).
  const stillOldItems = await fetchActiveManifestQuestions(ids.projectId);
  assert.equal(stillOldItems.length, 1, 'le Manifest actif ne doit jamais changer sans une nouvelle publication explicite');

  await createPublication(pool, { tenantId: ids.tenantId, projectId: ids.projectId, userId: ids.userId, encryptionKey: config.publicAccessEncryptionKey });
  const afterItems = await fetchActiveManifestQuestions(ids.projectId);
  assert.equal(afterItems.length, 2, 'après republication, le Manifest actif doit refléter les deux questions');
});
