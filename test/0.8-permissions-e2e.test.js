import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { createApp } from '../src/http/app.js';
import { errorHandler, notFoundHandler } from '../src/http/errorHandler.js';
import { devAuth } from '../src/http/middleware/devAuth.js';
import { requireProjectCapability } from '../src/http/middleware/requireProjectCapability.js';
import { ProjectCapability } from '../src/domain/permissions/capabilities.js';

// Tests HTTP réels, contre une vraie instance PostgreSQL, avec un
// scénario de données isolé (pas le seed applicatif — pour que cette
// suite reste autonome et rejouable indépendamment de npm run seed).

const config = loadConfig();
const pool = getPool(config);
const silentLogger = { info() {}, warn() {}, error() {} };

let app, server, baseUrl;
let ids = {};

async function clean() {
  await pool.query('delete from project_memberships');
  await pool.query('delete from tenant_memberships');
  await pool.query('delete from projects');
  await pool.query('delete from users');
  await pool.query('delete from tenants');
}

async function insertScenario() {
  const { rows: [parella] } = await pool.query("insert into tenants (name) values ('Parella Test') returning id");
  const { rows: [autreOrg] } = await pool.query("insert into tenants (name) values ('Autre Test') returning id");

  const { rows: [vivien] } = await pool.query("insert into users (email, display_name) values ('vivien@test.local','Vivien') returning id");
  const { rows: [alice] } = await pool.query("insert into users (email, display_name) values ('alice@test.local','Alice') returning id");
  const { rows: [bob] } = await pool.query("insert into users (email, display_name) values ('bob@test.local','Bob') returning id");
  const { rows: [charlie] } = await pool.query("insert into users (email, display_name) values ('charlie@test.local','Charlie') returning id");

  await pool.query('insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1,$2,$3)', [parella.id, vivien.id, 'organization_admin']);
  await pool.query('insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1,$2,$3)', [parella.id, alice.id, 'member']);
  await pool.query('insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1,$2,$3)', [parella.id, bob.id, 'member']);
  await pool.query('insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1,$2,$3)', [autreOrg.id, charlie.id, 'member']);

  const { rows: [clermont] } = await pool.query('insert into projects (tenant_id, name) values ($1,$2) returning id', [parella.id, 'Clermont-Ferrand']);
  const { rows: [tours] } = await pool.query('insert into projects (tenant_id, name) values ($1,$2) returning id', [parella.id, 'Tours']);
  const { rows: [peugeot] } = await pool.query('insert into projects (tenant_id, name) values ($1,$2) returning id', [parella.id, 'Peugeot']);

  await pool.query('insert into project_memberships (tenant_id, project_id, user_id, permission_bundle) values ($1,$2,$3,$4)', [parella.id, clermont.id, vivien.id, 'project_admin']);
  await pool.query('insert into project_memberships (tenant_id, project_id, user_id, permission_bundle) values ($1,$2,$3,$4)', [parella.id, clermont.id, alice.id, 'editor']);
  await pool.query('insert into project_memberships (tenant_id, project_id, user_id, permission_bundle) values ($1,$2,$3,$4)', [parella.id, tours.id, vivien.id, 'contributor']);
  await pool.query('insert into project_memberships (tenant_id, project_id, user_id, permission_bundle) values ($1,$2,$3,$4)', [parella.id, tours.id, bob.id, 'pilot']);
  await pool.query('insert into project_memberships (tenant_id, project_id, user_id, permission_bundle) values ($1,$2,$3,$4)', [parella.id, peugeot.id, alice.id, 'contributor']);
  // Vivien n'a délibérément AUCUNE membership sur Peugeot.

  return { parella: parella.id, autreOrg: autreOrg.id, vivien: vivien.id, alice: alice.id, bob: bob.id, charlie: charlie.id, clermont: clermont.id, tours: tours.id, peugeot: peugeot.id };
}

test.before(async () => {
  await runMigrations();
  await clean();
  ids = await insertScenario();
  app = createApp({ logger: silentLogger, pool, config });
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await clean();
  server.close();
  await closePool();
});

function withUser(userId) {
  return { headers: { 'X-Storm-Dev-User': userId } };
}

test('GET /api/me sans header -> 401', async () => {
  const res = await fetch(`${baseUrl}/api/me`);
  assert.equal(res.status, 401);
});

test('GET /api/me avec un UUID inconnu -> 401 (pas de fuite d\'information)', async () => {
  const res = await fetch(`${baseUrl}/api/me`, withUser('00000000-0000-0000-0000-000000000000'));
  assert.equal(res.status, 401);
});

test('GET /api/me (Vivien) renvoie son identité et son organisation', async () => {
  const res = await fetch(`${baseUrl}/api/me`, withUser(ids.vivien));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.displayName, 'Vivien');
  assert.equal(body.organization.name, 'Parella Test');
});

test('Vivien -> /api/projects : Clermont + Tours, jamais Peugeot (organization_admin ne vaut pas accès implicite)', async () => {
  const res = await fetch(`${baseUrl}/api/projects`, withUser(ids.vivien));
  assert.equal(res.status, 200);
  const projects = await res.json();
  const names = projects.map(p => p.name).sort();
  assert.deepEqual(names, ['Clermont-Ferrand', 'Tours']);
});

test('Alice -> /api/projects : Clermont + Peugeot', async () => {
  const res = await fetch(`${baseUrl}/api/projects`, withUser(ids.alice));
  const projects = await res.json();
  assert.deepEqual(projects.map(p => p.name).sort(), ['Clermont-Ferrand', 'Peugeot']);
});

test('Bob -> /api/projects : Tours uniquement', async () => {
  const res = await fetch(`${baseUrl}/api/projects`, withUser(ids.bob));
  const projects = await res.json();
  assert.deepEqual(projects.map(p => p.name), ['Tours']);
});

test('Charlie (autre tenant) -> /api/projects : liste vide, même s\'il connaît des UUID de Parella', async () => {
  const res = await fetch(`${baseUrl}/api/projects`, withUser(ids.charlie));
  const projects = await res.json();
  assert.deepEqual(projects, []);
});

test('Vivien -> /api/projects/:clermont : 200', async () => {
  const res = await fetch(`${baseUrl}/api/projects/${ids.clermont}`, withUser(ids.vivien));
  assert.equal(res.status, 200);
});

test('Vivien -> /api/projects/:peugeot : 404 (aucune membership, organization_admin non pertinent ici)', async () => {
  const res = await fetch(`${baseUrl}/api/projects/${ids.peugeot}`, withUser(ids.vivien));
  assert.equal(res.status, 404);
});

test('Charlie -> /api/projects/:clermont : 404 (cross-tenant, existence jamais révélée)', async () => {
  const res = await fetch(`${baseUrl}/api/projects/${ids.clermont}`, withUser(ids.charlie));
  assert.equal(res.status, 404);
});

test('UUID de projet inexistant -> 404', async () => {
  const res = await fetch(`${baseUrl}/api/projects/00000000-0000-0000-0000-000000000000`, withUser(ids.vivien));
  assert.equal(res.status, 404);
});

test('UUID de projet malformé -> 404, jamais une erreur 500 de type PostgreSQL', async () => {
  const res = await fetch(`${baseUrl}/api/projects/pas-un-uuid-du-tout`, withUser(ids.vivien));
  assert.equal(res.status, 404);
});

// ── Preuve que le moteur capability/bundle fonctionne réellement,
// pas seulement project.view (déjà couvert ci-dessus). On monte ici
// une route de test minimale, jamais exposée par la vraie application,
// utilisant exactement le même middleware générique — aucune logique
// de publication réelle n'est nécessaire pour prouver que
// l'autorisation par capability fonctionne (Phase 3, hors périmètre).
test('editor peut ce que publication.publish autorise ; contributor non — changer uniquement le bundle en DB change l\'autorisation, sans toucher le code de la route', async () => {
  const testApp = express();
  testApp.use(devAuth({ pool, config }));
  testApp.get('/test/projects/:projectId/publish', requireProjectCapability(pool, ProjectCapability.PUBLICATION_PUBLISH), (req, res) => {
    res.status(200).json({ ok: true });
  });
  testApp.use(notFoundHandler);
  testApp.use(errorHandler(silentLogger));

  const testServer = http.createServer(testApp);
  await new Promise(resolve => testServer.listen(0, resolve));
  const testBaseUrl = `http://127.0.0.1:${testServer.address().port}`;

  try {
    // Alice est "editor" sur Clermont -> a publication.publish -> 200
    const resEditor = await fetch(`${testBaseUrl}/test/projects/${ids.clermont}/publish`, withUser(ids.alice));
    assert.equal(resEditor.status, 200);

    // Vivien est "contributor" sur Tours -> PAS publication.publish -> 403
    const resContributor = await fetch(`${testBaseUrl}/test/projects/${ids.tours}/publish`, withUser(ids.vivien));
    assert.equal(resContributor.status, 403);

    // Preuve du moteur capability/bundle : on ne change QUE le bundle en
    // DB (aucun code de route touché) et l'autorisation change en
    // conséquence, immédiatement.
    await pool.query(
      "update project_memberships set permission_bundle = 'editor' where project_id = $1 and user_id = $2",
      [ids.tours, ids.vivien]
    );
    const resAfterUpgrade = await fetch(`${testBaseUrl}/test/projects/${ids.tours}/publish`, withUser(ids.vivien));
    assert.equal(resAfterUpgrade.status, 200);

    // Remettre l'état initial pour ne pas contaminer les autres tests.
    await pool.query(
      "update project_memberships set permission_bundle = 'contributor' where project_id = $1 and user_id = $2",
      [ids.tours, ids.vivien]
    );
  } finally {
    testServer.close();
  }
});

test('en production, X-Storm-Dev-User est toujours refusé, même avec un utilisateur réel', async () => {
  const prodConfig = { ...config, isProduction: true, isDevelopment: false };
  const testApp = express();
  testApp.use(devAuth({ pool, config: prodConfig }));
  testApp.get('/test/whoami', (req, res) => res.json({ ok: true }));
  testApp.use(notFoundHandler);
  testApp.use(errorHandler(silentLogger));

  const testServer = http.createServer(testApp);
  await new Promise(resolve => testServer.listen(0, resolve));
  const testBaseUrl = `http://127.0.0.1:${testServer.address().port}`;
  try {
    const res = await fetch(`${testBaseUrl}/test/whoami`, withUser(ids.vivien));
    assert.equal(res.status, 401);
  } finally {
    testServer.close();
  }
});
