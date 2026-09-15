import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { createApp } from '../src/http/app.js';
import { createStorageAdapter } from '../src/adapters/storage/index.js';
import { seedTenantMembership, seedProjectMembership } from './helpers/memberships.js';
import { findCurrentAccess } from '../src/domain/publicAccess/repository.js';
import { seedDemo, DEMO_CLIENT_NAME, DEMO_TENANT_NAME, DEMO_PROJECT_NAME } from '../src/db/seedDemo.js';
import { createPublication } from '../src/domain/publication/repository.js';

const config = loadConfig();
const pool = getPool(config);
const storageAdapter = createStorageAdapter(config);
const silentLogger = { info() {}, warn() {}, error() {} };

let app, server, baseUrl;
let ids = {};

async function cleanAll() {
  await pool.query('delete from project_public_access');
  await pool.query('delete from project_publications');
  await pool.query('delete from project_memberships');
  await pool.query('delete from tenant_memberships');
  await pool.query('delete from projects');
  await pool.query('delete from clients');
  await pool.query('delete from users');
  await pool.query('delete from tenants');
}

test.before(async () => {
  await runMigrations();
  await cleanAll();

  const { rows: [tenant] } = await pool.query("insert into tenants (name) values ('Tenant Bugfix 422') returning id");
  const { rows: [editor] } = await pool.query("insert into users (email, display_name) values ('editor@bugfix422.local','Editor') returning id");
  await seedTenantMembership(pool, { tenantId: tenant.id, userId: editor.id, permissionBundle: 'member' });

  const { rows: [noClientProject] } = await pool.query(
    "insert into projects (tenant_id, name) values ($1,'Projet Sans Client Bugfix') returning id", [tenant.id]
  );
  await seedProjectMembership(pool, { tenantId: tenant.id, projectId: noClientProject.id, userId: editor.id, permissionBundle: 'editor' });

  ids = { tenant: tenant.id, editor: editor.id, noClientProject: noClientProject.id };

  app = createApp({ logger: silentLogger, pool, config, storageAdapter });
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await cleanAll();
  server.close();
  await closePool();
});

function withUser(userId) {
  return { method: 'POST', headers: { 'X-Storm-Dev-User': userId } };
}

// ── Contrat de réponse 422 -- ce que la nouvelle logique Studio doit distinguer ──

test('Publication sans Client -- 422, forme "error.code" (prérequis), jamais "failureDetail" (compilation), aucune révision consommée', async () => {
  const { rows: [before] } = await pool.query(
    'select coalesce(max(revision),0) as r from project_publications where project_id=$1', [ids.noClientProject]
  );

  const res = await fetch(`${baseUrl}/api/projects/${ids.noClientProject}/publications`, withUser(ids.editor));
  assert.equal(res.status, 422);
  const body = await res.json();

  // Forme A (prérequis bloquant) -- jamais la forme B (échec compilateur).
  assert.equal(body.error?.code, 'NO_CLIENT_ASSIGNED');
  assert.equal(typeof body.error?.message, 'string');
  assert.ok(body.error.message.length > 0);
  assert.equal('failureDetail' in body, false, 'jamais la forme "échec de compilation" pour un prérequis manquant -- Studio ne doit jamais confondre les deux');
  assert.equal('failureCode' in body, false);

  const { rows: [after] } = await pool.query(
    'select coalesce(max(revision),0) as r from project_publications where project_id=$1', [ids.noClientProject]
  );
  assert.equal(after.r, before.r, 'aucune révision ne doit être consommée par un blocage de prérequis');

  const access = await findCurrentAccess(pool, ids.noClientProject);
  assert.equal(access, null, 'aucun Accès Public ne doit être créé quand la publication est bloquée');
});

test('Studio -- les 7 pages distinguent désormais data.error (prérequis) de data.failureDetail (compilation) dans leur gestion du 422', () => {
  const files = [
    'public/studio-homepage.html', 'public/studio-le-projet.html', 'public/studio-espaces.html',
    'public/studio-actualites.html', 'public/studio-ambassadeurs.html', 'public/studio-questions.html',
    'public/studio-identite.html'
  ];
  for (const f of files) {
    const src = fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    assert.match(src, /if\(res\.status===422\)\{if\(data\.error\)/, `${f} doit distinguer data.error avant de retomber sur data.failureDetail`);
    assert.match(src, /Publication impossible/, `${f} doit afficher "Publication impossible" pour un prérequis, jamais "Compilation impossible"`);
    assert.match(src, /Compilation impossible/, `${f} doit conserver "Compilation impossible" pour un vrai échec de compilation`);
    assert.doesNotMatch(src.match(/if\(data\.error\)[^}]*\}/)[0], /erreur inconnue/, `${f} ne doit jamais afficher "erreur inconnue" pour un prérequis -- le message backend réel doit être utilisé`);
  }
});

// ── Fixture démo -- Client explicite, jamais de repli synthétique ──

test('Seed démo -- Équinoxe a désormais un Client explicite (Asteria), la première publication réussit, un Accès Public actif est créé', async () => {
  const { pool: demoPool, tenantId, projectId, userId } = await seedDemo();
  try {
    const { rows: [project] } = await demoPool.query('select client_id from projects where id=$1', [projectId]);
    assert.notEqual(project.client_id, null, 'Équinoxe ne doit plus avoir client_id NULL');

    const { rows: [client] } = await demoPool.query('select name from clients where id=$1', [project.client_id]);
    assert.equal(client.name, DEMO_CLIENT_NAME);

    // Reproduit exactement l'appel du bloc CLI réel (seedDemo() ne
    // publie pas elle-même -- voir isMain dans src/db/seedDemo.js).
    const publication = await createPublication(demoPool, { tenantId, projectId, userId, encryptionKey: config.publicAccessEncryptionKey });
    assert.notEqual(publication?.status, 'blocked', 'la première publication doit réussir pour le projet démo, jamais bloquée');

    const access = await findCurrentAccess(demoPool, projectId);
    assert.ok(access, 'un Accès Public courant doit exister pour le projet démo');
    assert.equal(access.status, 'active');
  } finally {
    // Nettoyage scopé au tenant démo -- jamais toucher aux autres
    // tenants de test, jamais laisser une pollution inter-fichiers.
    await demoPool.query('delete from project_public_access where tenant_id=$1', [tenantId]);
    await demoPool.query('delete from project_publications where project_id=$1', [projectId]);
  }
});

test('Seed démo -- exactement un Client "Asteria" après plusieurs exécutions (idempotent, jamais de doublon)', async () => {
  const { rows } = await pool.query(
    "select count(*)::int as n from clients c join tenants t on t.id=c.tenant_id where t.name=$1 and c.name=$2",
    [DEMO_TENANT_NAME, DEMO_CLIENT_NAME]
  );
  assert.equal(rows[0].n, 1);
});

// ── Projets legacy ordinaires -- aucun repli, jamais de Client fabriqué ──

test('Projet ordinaire sans Client -- reste bloqué, aucun Client synthétique n\u2019est jamais créé automatiquement', async () => {
  const { rows } = await pool.query(
    "select count(*)::int as n from clients where name ilike '%non attribué%' or name ilike '%unassigned%'"
  );
  assert.equal(rows[0].n, 0, 'aucun Client générique de repli ne doit jamais exister');
});
