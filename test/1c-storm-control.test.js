import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { createApp } from '../src/http/app.js';
import { createStorageAdapter } from '../src/adapters/storage/index.js';

const config = loadConfig();
const pool = getPool(config);
const storageAdapter = createStorageAdapter(config);
const silentLogger = { info() {}, warn() {}, error() {} };

let app, server, baseUrl;
let ids = {};

async function cleanAll() {
  await pool.query('delete from project_memberships');
  await pool.query('delete from tenant_memberships');
  await pool.query('delete from projects');
  await pool.query('delete from users');
  await pool.query('delete from tenants');
}

test.before(async () => {
  await runMigrations();
  await cleanAll();

  const { rows: [tenantA] } = await pool.query("insert into tenants (name) values ('Tenant Control A') returning id");
  const { rows: [tenantB] } = await pool.query("insert into tenants (name) values ('Tenant Control B') returning id");

  const { rows: [admin] } = await pool.query("insert into users (email, display_name) values ('admin@control.local','Admin Control') returning id");
  const { rows: [member] } = await pool.query("insert into users (email, display_name) values ('member@control.local','Member Control') returning id");
  const { rows: [otherTenantAdmin] } = await pool.query("insert into users (email, display_name) values ('other@control.local','Other Tenant Admin') returning id");

  await pool.query('insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1,$2,$3)', [tenantA.id, admin.id, 'organization_admin']);
  await pool.query('insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1,$2,$3)', [tenantA.id, member.id, 'member']);
  await pool.query('insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1,$2,$3)', [tenantB.id, otherTenantAdmin.id, 'organization_admin']);

  const { rows: [projA1] } = await pool.query('insert into projects (tenant_id, name) values ($1,$2) returning id', [tenantA.id, 'Projet Tenant A 1']);
  await pool.query('insert into projects (tenant_id, name) values ($1,$2)', [tenantA.id, 'Projet Tenant A 2']);
  await pool.query('insert into projects (tenant_id, name) values ($1,$2)', [tenantB.id, 'Projet Tenant B (ne doit jamais apparaître pour A)']);

  // Membership de projet pour admin sur projA1 -- nécessaire pour
  // vérifier que /api/projects (Storm Home) reflète bien archive/
  // restore, distinct de /api/control/projects qui n'en dépend pas.
  await pool.query('insert into project_memberships (tenant_id, project_id, user_id, permission_bundle) values ($1,$2,$3,$4)', [tenantA.id, projA1.id, admin.id, 'project_admin']);

  ids = { tenantA: tenantA.id, tenantB: tenantB.id, admin: admin.id, member: member.id, otherTenantAdmin: otherTenantAdmin.id, projA1: projA1.id };

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
  return { headers: { 'X-Storm-Dev-User': userId } };
}

test('GET /control sert la page (200, HTML)', async () => {
  const res = await fetch(`${baseUrl}/control`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /html/);
});

test('organization_admin -> GET /api/control/projects retourne tous les projets du tenant, forme camelCase correcte', async () => {
  const res = await fetch(`${baseUrl}/api/control/projects`, withUser(ids.admin));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.length, 2, 'exactement les 2 projets du tenant A, jamais celui du tenant B');
  assert.ok(body.every(p => 'id' in p && 'name' in p && 'status' in p && 'createdAt' in p));
  assert.ok(!body.some(p => p.name.includes('Tenant B')), 'aucune fuite cross-tenant');
});

test('organization_admin -> GET /api/control/members retourne les membres du tenant, forme camelCase correcte', async () => {
  const res = await fetch(`${baseUrl}/api/control/members`, withUser(ids.admin));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.length, 2, 'admin + member du tenant A, jamais otherTenantAdmin');
  assert.ok(body.every(m => 'id' in m && 'email' in m && 'displayName' in m && 'permissionBundle' in m && 'status' in m && 'createdAt' in m));
  assert.ok(!body.some(m => m.email === 'other@control.local'), 'aucune fuite cross-tenant');
});

test('member (sans control.access) -> 403 sur /api/control/projects, jamais de donnée exposée', async () => {
  const res = await fetch(`${baseUrl}/api/control/projects`, withUser(ids.member));
  assert.equal(res.status, 403);
});

test('member (sans control.access) -> 403 sur /api/control/members', async () => {
  const res = await fetch(`${baseUrl}/api/control/members`, withUser(ids.member));
  assert.equal(res.status, 403);
});

test('organization_admin d\'un AUTRE tenant ne voit que ses propres projets, jamais ceux du tenant A', async () => {
  const res = await fetch(`${baseUrl}/api/control/projects`, withUser(ids.otherTenantAdmin));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.length, 1);
  assert.ok(body[0].name.includes('Tenant B'));
});

test('sans authentification -> 401, jamais 403 (AuthN avant Authorization)', async () => {
  const res = await fetch(`${baseUrl}/api/control/projects`);
  assert.equal(res.status, 401);
});

test('capability control.access vérifiée même si un jour projects.view_all seul était accordé (mécanisme, pas juste UI)', async () => {
  // Preuve du mécanisme : la vérification porte sur un TABLEAU de
  // capabilities requises, pas une seule — voir requireOrganizationCapability.
  // Aujourd'hui le système ne connaît que member ([]) et organization_admin
  // (les 6) ; aucun bundle intermédiaire n'existe encore en DB pour
  // produire un cas réel "control.access seul, sans projects.view_all".
  // Ce test documente cette limite plutôt que de la contourner.
  const { bundleHasOrganizationCapability } = await import('../src/domain/permissions/capabilities.js');
  assert.equal(bundleHasOrganizationCapability('member', 'control.access'), false);
  assert.equal(bundleHasOrganizationCapability('organization_admin', 'control.access'), true);
  assert.equal(bundleHasOrganizationCapability('organization_admin', 'projects.view_all'), true);
  assert.equal(bundleHasOrganizationCapability('organization_admin', 'organization.members.manage'), true);
});

// ── Cycle de vie des projets — archive/restore (Product Integrity Pass #2) ──

test('organization_admin -> POST /archive fait passer un projet actif à archived', async () => {
  const res = await fetch(`${baseUrl}/api/control/projects/${ids.projA1}/archive`, { method: 'POST', ...withUser(ids.admin) });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'archived');

  const listed = await (await fetch(`${baseUrl}/api/control/projects`, withUser(ids.admin))).json();
  assert.equal(listed.find(p => p.id === ids.projA1).status, 'archived', 'Storm Control continue de le lister, avec le bon statut');

  await pool.query('update projects set status=$1 where id=$2', ['active', ids.projA1]);
});

test('archiver un projet le fait disparaître de /api/projects (Storm Home), sans changement côté lecture', async () => {
  await fetch(`${baseUrl}/api/control/projects/${ids.projA1}/archive`, { method: 'POST', ...withUser(ids.admin) });
  const listed = await (await fetch(`${baseUrl}/api/projects`, withUser(ids.admin))).json();
  assert.ok(!listed.some(p => p.id === ids.projA1), 'un projet archivé ne doit plus jamais apparaître dans "mes projets"');
  await pool.query('update projects set status=$1 where id=$2', ['active', ids.projA1]);
});

test('POST /restore ramène un projet archivé à active, réapparaît dans /api/projects', async () => {
  await pool.query('update projects set status=$1 where id=$2', ['archived', ids.projA1]);
  const res = await fetch(`${baseUrl}/api/control/projects/${ids.projA1}/restore`, { method: 'POST', ...withUser(ids.admin) });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, 'active');

  const listed = await (await fetch(`${baseUrl}/api/projects`, withUser(ids.admin))).json();
  assert.ok(listed.some(p => p.id === ids.projA1), 'redevient visible dans "mes projets" après restauration');
});

test('member (sans control.access) -> 403 sur /archive et /restore, jamais un contournement', async () => {
  const archiveRes = await fetch(`${baseUrl}/api/control/projects/${ids.projA1}/archive`, { method: 'POST', ...withUser(ids.member) });
  assert.equal(archiveRes.status, 403);
  const restoreRes = await fetch(`${baseUrl}/api/control/projects/${ids.projA1}/restore`, { method: 'POST', ...withUser(ids.member) });
  assert.equal(restoreRes.status, 403);

  const row = await pool.query('select status from projects where id=$1', [ids.projA1]);
  assert.equal(row.rows[0].status, 'active', 'le refus doit être réel, jamais une simple UI masquée -- le statut ne doit pas avoir bougé');
});

test('otherTenantAdmin (tenant B) -> 404 en tentant d\'archiver un projet du tenant A, jamais un succès cross-tenant', async () => {
  const res = await fetch(`${baseUrl}/api/control/projects/${ids.projA1}/archive`, { method: 'POST', ...withUser(ids.otherTenantAdmin) });
  assert.equal(res.status, 404, 'même invariant que listAllProjectsForTenant : jamais un projet d\'un autre tenant, même par id direct');

  const row = await pool.query('select status from projects where id=$1', [ids.projA1]);
  assert.equal(row.rows[0].status, 'active', 'le statut ne doit jamais avoir bougé suite à une tentative cross-tenant');
});

test('archive/restore sur un id inexistant -> 404 propre', async () => {
  const res = await fetch(`${baseUrl}/api/control/projects/00000000-0000-0000-0000-000000000000/archive`, { method: 'POST', ...withUser(ids.admin) });
  assert.equal(res.status, 404);
});
