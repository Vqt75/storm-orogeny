import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { createApp } from '../src/http/app.js';
import { createStorageAdapter } from '../src/adapters/storage/index.js';

const TEST_STORAGE_DIR = path.join(process.cwd(), '.test-storage-3a');
const config = { ...loadConfig(), storage: { localDir: TEST_STORAGE_DIR } };
const pool = getPool(config);
const storageAdapter = createStorageAdapter(config);
const silentLogger = { info() {}, warn() {}, error() {} };

let app, server, baseUrl;
let ids = {};

async function cleanAll() {
  await pool.query('delete from assets');
  await pool.query('delete from project_invitations');
  await pool.query('delete from project_modules');
  await pool.query('delete from project_settings');
  await pool.query('delete from project_identity');
  await pool.query('delete from project_memberships');
  await pool.query('delete from tenant_memberships');
  await pool.query('delete from projects');
  await pool.query('delete from users');
  await pool.query('delete from tenants');
}

test.before(async () => {
  await runMigrations();
  await cleanAll();
  await fs.rm(TEST_STORAGE_DIR, { recursive: true, force: true });

  const { rows: [tenantA] } = await pool.query("insert into tenants (name) values ('Tenant Assets A') returning id");
  const { rows: [tenantB] } = await pool.query("insert into tenants (name) values ('Tenant Assets B') returning id");
  const { rows: [creator] } = await pool.query("insert into users (email, display_name) values ('creator@assets.local','Créateur') returning id");
  const { rows: [outsider] } = await pool.query("insert into users (email, display_name) values ('outsider@assets.local','Étranger') returning id");

  await pool.query('insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1,$2,$3)', [tenantA.id, creator.id, 'organization_admin']);
  await pool.query('insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1,$2,$3)', [tenantB.id, outsider.id, 'organization_admin']);

  const { rows: [project] } = await pool.query('insert into projects (tenant_id, name) values ($1,$2) returning id', [tenantA.id, 'Projet Assets']);
  await pool.query('insert into project_identity (tenant_id, project_id) values ($1,$2)', [tenantA.id, project.id]);
  await pool.query('insert into project_memberships (tenant_id, project_id, user_id, permission_bundle) values ($1,$2,$3,$4)', [tenantA.id, project.id, creator.id, 'project_admin']);

  ids = { tenantA: tenantA.id, tenantB: tenantB.id, creator: creator.id, outsider: outsider.id, project: project.id };

  app = createApp({ logger: silentLogger, pool, config, storageAdapter });
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await cleanAll();
  server.close();
  await closePool();
  await fs.rm(TEST_STORAGE_DIR, { recursive: true, force: true });
});

function tinyPngBuffer() {
  // 1x1 PNG valide minimal.
  return Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a4944415478da6360000002000155' +
    '7f6e5c0000000049454e44ae426082', 'hex'
  );
}

test('upload réel du logo — fichier réellement persisté sur disque, pas un object URL éphémère', async () => {
  const form = new FormData();
  form.append('logo', new Blob([tinyPngBuffer()], { type: 'image/png' }), 'logo.png');

  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/logo`, {
    method: 'POST',
    headers: { 'X-Storm-Dev-User': ids.creator },
    body: form
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.ok(body.assetId);

  const { rows: [asset] } = await pool.query('select storage_key, content_type, byte_size, project_id, tenant_id from assets where id=$1', [body.assetId]);
  assert.equal(asset.content_type, 'image/png');
  assert.equal(asset.project_id, ids.project);
  assert.equal(asset.tenant_id, ids.tenantA);

  // Le fichier existe réellement sur disque, pas seulement en mémoire navigateur.
  const fileOnDisk = await fs.readFile(path.join(TEST_STORAGE_DIR, asset.storage_key));
  assert.ok(fileOnDisk.length > 0);

  const { rows: [identity] } = await pool.query('select logo_asset_id from project_identity where project_id=$1', [ids.project]);
  assert.equal(identity.logo_asset_id, body.assetId, 'project_identity.logo_asset_id est bien lié');
});

test('un type de fichier non autorisé est refusé (400), rien n\'est écrit', async () => {
  const before = await pool.query('select count(*)::int from assets');
  const form = new FormData();
  form.append('logo', new Blob([Buffer.from('not an image')], { type: 'application/pdf' }), 'doc.pdf');

  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/logo`, {
    method: 'POST', headers: { 'X-Storm-Dev-User': ids.creator }, body: form
  });
  assert.equal(res.status, 400);
  const after = await pool.query('select count(*)::int from assets');
  assert.equal(after.rows[0].count, before.rows[0].count);
});

test('un Content-Type PNG mensonger (contenu réel non-image) est refusé par la vérification de signature', async () => {
  const before = await pool.query('select count(*)::int from assets');
  const form = new FormData();
  form.append('logo', new Blob([Buffer.from('ceci n\'est pas un PNG du tout')], { type: 'image/png' }), 'faux.png');

  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/logo`, {
    method: 'POST', headers: { 'X-Storm-Dev-User': ids.creator }, body: form
  });
  assert.equal(res.status, 400);
  const after = await pool.query('select count(*)::int from assets');
  assert.equal(after.rows[0].count, before.rows[0].count, 'rien ne doit être persisté malgré le Content-Type mensonger');
});

test('SVG est refusé (exclu de Phase 1B, jamais accepté même avec le bon Content-Type)', async () => {
  const form = new FormData();
  form.append('logo', new Blob([Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')], { type: 'image/svg+xml' }), 'logo.svg');

  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/logo`, {
    method: 'POST', headers: { 'X-Storm-Dev-User': ids.creator }, body: form
  });
  assert.equal(res.status, 400);
});

test('un utilisateur sans membership sur ce projet ne peut pas uploader (404, existence non révélée)', async () => {
  const form = new FormData();
  form.append('logo', new Blob([tinyPngBuffer()], { type: 'image/png' }), 'logo.png');

  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/logo`, {
    method: 'POST', headers: { 'X-Storm-Dev-User': ids.outsider }, body: form
  });
  assert.equal(res.status, 404);
});

test('le fichier est bien servi via GET /api/assets/:id, pour un utilisateur ayant accès', async () => {
  const form = new FormData();
  form.append('logo', new Blob([tinyPngBuffer()], { type: 'image/png' }), 'logo2.png');
  const uploadRes = await fetch(`${baseUrl}/api/projects/${ids.project}/logo`, {
    method: 'POST', headers: { 'X-Storm-Dev-User': ids.creator }, body: form
  });
  const { assetId } = await uploadRes.json();

  const res = await fetch(`${baseUrl}/api/assets/${assetId}`, { headers: { 'X-Storm-Dev-User': ids.creator } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
  const bytes = Buffer.from(await res.arrayBuffer());
  assert.deepEqual(bytes, tinyPngBuffer());
});

test('un utilisateur d\'un autre tenant ne peut jamais récupérer le fichier (404, isolation même sur les assets)', async () => {
  const form = new FormData();
  form.append('logo', new Blob([tinyPngBuffer()], { type: 'image/png' }), 'logo3.png');
  const uploadRes = await fetch(`${baseUrl}/api/projects/${ids.project}/logo`, {
    method: 'POST', headers: { 'X-Storm-Dev-User': ids.creator }, body: form
  });
  const { assetId } = await uploadRes.json();

  const res = await fetch(`${baseUrl}/api/assets/${assetId}`, { headers: { 'X-Storm-Dev-User': ids.outsider } });
  assert.equal(res.status, 404);
});

test('UUID d\'asset inexistant -> 404', async () => {
  const res = await fetch(`${baseUrl}/api/assets/00000000-0000-0000-0000-000000000000`, { headers: { 'X-Storm-Dev-User': ids.creator } });
  assert.equal(res.status, 404);
});

test('régression : uploader sur un projet SANS project_identity échoue bruyamment (500), jamais un succès silencieux sans effet', async () => {
  // Reproduit précisément le bug trouvé manuellement : un projet créé
  // sans project_identity (ex. ancien seed pré-1B) ne doit jamais
  // laisser croire que le logo a été lié alors que l'UPDATE n'a
  // affecté aucune ligne.
  const { rows: [projectWithoutIdentity] } = await pool.query(
    'insert into projects (tenant_id, name) values ($1,$2) returning id',
    [ids.tenantA, 'Projet sans identité']
  );
  await pool.query(
    'insert into project_memberships (tenant_id, project_id, user_id, permission_bundle) values ($1,$2,$3,$4)',
    [ids.tenantA, projectWithoutIdentity.id, ids.creator, 'project_admin']
  );

  const form = new FormData();
  form.append('logo', new Blob([tinyPngBuffer()], { type: 'image/png' }), 'logo.png');
  const res = await fetch(`${baseUrl}/api/projects/${projectWithoutIdentity.id}/logo`, {
    method: 'POST', headers: { 'X-Storm-Dev-User': ids.creator }, body: form
  });
  assert.equal(res.status, 500, 'doit échouer explicitement, jamais un 201 trompeur');

  await pool.query('delete from project_memberships where project_id=$1', [projectWithoutIdentity.id]);
  await pool.query('delete from projects where id=$1', [projectWithoutIdentity.id]);
});
