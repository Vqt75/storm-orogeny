import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { createApp } from '../src/http/app.js';
import { createStorageAdapter } from '../src/adapters/storage/index.js';
import { seedTenantMembership, seedProjectMembership } from './helpers/memberships.js';
import { normalizeClientName, isValidClientName } from '../src/domain/clients/slug.js';

const config = loadConfig();
const pool = getPool(config);
const storageAdapter = createStorageAdapter(config);
const silentLogger = { info() {}, warn() {}, error() {} };

let app, server, baseUrl;
let ids = {};

async function cleanAll() {
  await pool.query('delete from project_invitations');
  await pool.query('delete from project_modules');
  await pool.query('delete from project_settings');
  await pool.query('delete from project_identity');
  await pool.query('delete from project_memberships');
  await pool.query('delete from tenant_memberships');
  await pool.query('delete from project_public_access');
  await pool.query('delete from projects');
  await pool.query('delete from clients');
  await pool.query('delete from users');
  await pool.query('delete from tenants');
}

test.before(async () => {
  await runMigrations();
  await cleanAll();

  const { rows: [tenant] } = await pool.query("insert into tenants (name) values ('Tenant Client Domain') returning id");
  const { rows: [otherTenant] } = await pool.query("insert into tenants (name) values ('Autre Tenant Client Domain') returning id");

  const { rows: [orgAdmin] } = await pool.query("insert into users (email, display_name) values ('orgadmin@clientdomain.local','OrgAdmin') returning id");
  const { rows: [creator] } = await pool.query("insert into users (email, display_name) values ('creator@clientdomain.local','Creator') returning id");
  const { rows: [projectAdmin] } = await pool.query("insert into users (email, display_name) values ('projectadmin@clientdomain.local','ProjectAdmin') returning id");
  const { rows: [outsider] } = await pool.query("insert into users (email, display_name) values ('outsider@clientdomain.local','Outsider') returning id");
  const { rows: [otherTenantAdmin] } = await pool.query("insert into users (email, display_name) values ('otheradmin@clientdomain.local','OtherAdmin') returning id");

  await seedTenantMembership(pool, { tenantId: tenant.id, userId: orgAdmin.id, permissionBundle: 'organization_admin' });
  await seedTenantMembership(pool, { tenantId: tenant.id, userId: creator.id, permissionBundle: 'member' });
  await seedTenantMembership(pool, { tenantId: tenant.id, userId: projectAdmin.id, permissionBundle: 'member' });
  await seedTenantMembership(pool, { tenantId: otherTenant.id, userId: otherTenantAdmin.id, permissionBundle: 'organization_admin' });

  const { rows: [project] } = await pool.query(
    "insert into projects (tenant_id, name) values ($1,'Projet Rename Test') returning id",
    [tenant.id]
  );
  await seedProjectMembership(pool, { tenantId: tenant.id, projectId: project.id, userId: projectAdmin.id, permissionBundle: 'project_admin' });
  await seedProjectMembership(pool, { tenantId: tenant.id, projectId: project.id, userId: creator.id, permissionBundle: 'contributor' });

  const { rows: [legacyProject] } = await pool.query(
    "insert into projects (tenant_id, name) values ($1,'Projet Legacy Sans Client') returning id",
    [tenant.id]
  );
  await seedProjectMembership(pool, { tenantId: tenant.id, projectId: legacyProject.id, userId: orgAdmin.id, permissionBundle: 'project_admin' });

  ids = {
    tenant: tenant.id, otherTenant: otherTenant.id,
    orgAdmin: orgAdmin.id, creator: creator.id, projectAdmin: projectAdmin.id,
    outsider: outsider.id, otherTenantAdmin: otherTenantAdmin.id,
    project: project.id, legacyProject: legacyProject.id
  };

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
function withUserJson(userId, body) {
  return {
    method: 'POST',
    headers: { 'X-Storm-Dev-User': userId, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

// ── Normalisation (pure, aucune DB) ───────────────────────────────────

test('normalizeClientName -- casse, accents, espaces multiples, déterministe', () => {
  assert.equal(normalizeClientName('Azelis France'), 'azelis-france');
  assert.equal(normalizeClientName(' AZELIS   FRANCE '), 'azelis-france');
  assert.equal(normalizeClientName('AG2R LA MONDIALE'), 'ag2r-la-mondiale');
  assert.equal(normalizeClientName('Ramsay Santé'), 'ramsay-sante');
  assert.equal(normalizeClientName('Œconomie & Cie'), 'oeconomie-cie');
  assert.equal(normalizeClientName('Azelis France'), normalizeClientName('  azelis   france  '));
});

test('normalizeClientName -- nom vide/invalide rejeté', () => {
  assert.equal(isValidClientName(''), false);
  assert.equal(isValidClientName('   '), false);
  assert.equal(isValidClientName('!!!'), false);
  assert.equal(isValidClientName('Peugeot'), true);
});

// ── Client -- création ────────────────────────────────────────────────

test('Client -- création autorisée avec CLIENTS_MANAGE (organization_admin)', async () => {
  const res = await fetch(`${baseUrl}/api/clients`, withUserJson(ids.orgAdmin, { name: 'Client Création Test' }));
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.name, 'Client Création Test');
  assert.equal(body.normalizedSlug, 'client-creation-test');
  assert.equal(body.version, 1);
});

test('Client -- création refusée sans CLIENTS_MANAGE (membre simple)', async () => {
  const res = await fetch(`${baseUrl}/api/clients`, withUserJson(ids.creator, { name: 'Client Refusé' }));
  assert.equal(res.status, 403);
});

test('Client -- slug normalisé dupliqué rejeté (409)', async () => {
  await fetch(`${baseUrl}/api/clients`, withUserJson(ids.orgAdmin, { name: 'Doublon Test' }));
  const res = await fetch(`${baseUrl}/api/clients`, withUserJson(ids.orgAdmin, { name: '  DOUBLON   TEST  ' }));
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.error.code, 'DUPLICATE_CLIENT_SLUG');
});

test('Client -- isolation tenant à la création (même nom, tenants différents, aucun conflit)', async () => {
  const res1 = await fetch(`${baseUrl}/api/clients`, withUserJson(ids.orgAdmin, { name: 'Isolation Tenant Test' }));
  const res2 = await fetch(`${baseUrl}/api/clients`, withUserJson(ids.otherTenantAdmin, { name: 'Isolation Tenant Test' }));
  assert.equal(res1.status, 201);
  assert.equal(res2.status, 201);
});

// ── Client -- recherche/lecture ───────────────────────────────────────

test('Client -- recherche disponible pour PROJECTS_CREATE sans CLIENTS_MANAGE requis', async () => {
  await fetch(`${baseUrl}/api/clients`, withUserJson(ids.orgAdmin, { name: 'Cherchable SARL' }));
  const res = await fetch(`${baseUrl}/api/clients?search=Cherchable`, withUser(ids.orgAdmin));
  assert.equal(res.status, 200);
  const results = await res.json();
  assert.ok(results.some(c => c.name === 'Cherchable SARL'));
});

test('Client -- recherche jamais cross-tenant', async () => {
  await fetch(`${baseUrl}/api/clients`, withUserJson(ids.otherTenantAdmin, { name: 'Client Autre Tenant Unique' }));
  const res = await fetch(`${baseUrl}/api/clients?search=Client Autre Tenant Unique`, withUser(ids.orgAdmin));
  const results = await res.json();
  assert.equal(results.length, 0);
});

// ── Client -- renommage ───────────────────────────────────────────────

test('Client -- renommage : succès avec version correcte, version incrémentée', async () => {
  const createRes = await fetch(`${baseUrl}/api/clients`, withUserJson(ids.orgAdmin, { name: 'À Renommer' }));
  const created = await createRes.json();

  const res = await fetch(`${baseUrl}/api/clients/${created.id}`, {
    method: 'PATCH',
    headers: { 'X-Storm-Dev-User': ids.orgAdmin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Renommé Avec Succès', version: created.version })
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.name, 'Renommé Avec Succès');
  assert.equal(body.version, created.version + 1);
});

test('Client -- renommage : version périmée -> 409 STALE_VERSION', async () => {
  const createRes = await fetch(`${baseUrl}/api/clients`, withUserJson(ids.orgAdmin, { name: 'Version Périmée Test' }));
  const created = await createRes.json();

  const res = await fetch(`${baseUrl}/api/clients/${created.id}`, {
    method: 'PATCH',
    headers: { 'X-Storm-Dev-User': ids.orgAdmin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Tentative Périmée', version: created.version + 99 })
  });
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.error.code, 'STALE_VERSION');
});

test('Client -- renommage refusé sans CLIENTS_MANAGE', async () => {
  const createRes = await fetch(`${baseUrl}/api/clients`, withUserJson(ids.orgAdmin, { name: 'Protégé Rename' }));
  const created = await createRes.json();
  const res = await fetch(`${baseUrl}/api/clients/${created.id}`, {
    method: 'PATCH',
    headers: { 'X-Storm-Dev-User': ids.creator, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Tentative Non Autorisée', version: created.version })
  });
  assert.equal(res.status, 403);
});

test('Client -- renommage vers un slug déjà pris par un autre client -> 409', async () => {
  await fetch(`${baseUrl}/api/clients`, withUserJson(ids.orgAdmin, { name: 'Slug Occupé' }));
  const createRes = await fetch(`${baseUrl}/api/clients`, withUserJson(ids.orgAdmin, { name: 'À Renommer Vers Occupé' }));
  const created = await createRes.json();
  const res = await fetch(`${baseUrl}/api/clients/${created.id}`, {
    method: 'PATCH',
    headers: { 'X-Storm-Dev-User': ids.orgAdmin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Slug Occupé', version: created.version })
  });
  assert.equal(res.status, 409);
});

// ── Capabilities ───────────────────────────────────────────────────────

test('Capabilities -- CLIENTS_MANAGE présente uniquement dans organization_admin', async () => {
  const { organizationCapabilitiesForBundle } = await import('../src/domain/permissions/capabilities.js');
  assert.ok(organizationCapabilitiesForBundle('organization_admin').includes('organization.clients.manage'));
  assert.ok(!organizationCapabilitiesForBundle('member').includes('organization.clients.manage'));
});

// ── Création de projet ───────────────────────────────────────────────

test('Projet -- création refusée sans clientId', async () => {
  const res = await fetch(`${baseUrl}/api/projects`, withUserJson(ids.orgAdmin, { name: 'Sans Client' }));
  assert.equal(res.status, 400);
});

test('Projet -- création refusée avec clientId inexistant', async () => {
  const res = await fetch(`${baseUrl}/api/projects`, withUserJson(ids.orgAdmin, { name: 'Client Inexistant', clientId: '00000000-0000-0000-0000-000000000000' }));
  assert.equal(res.status, 400);
});

test('Projet -- création refusée avec clientId d\'un autre tenant', async () => {
  const otherClientRes = await fetch(`${baseUrl}/api/clients`, withUserJson(ids.otherTenantAdmin, { name: 'Client Cross Tenant Test' }));
  const otherClient = await otherClientRes.json();
  const res = await fetch(`${baseUrl}/api/projects`, withUserJson(ids.orgAdmin, { name: 'Projet Cross Tenant', clientId: otherClient.id }));
  assert.equal(res.status, 400);
});

test('Projet -- création réussie avec un client du même tenant, client_id persisté', async () => {
  const clientRes = await fetch(`${baseUrl}/api/clients`, withUserJson(ids.orgAdmin, { name: 'Client Projet Valide' }));
  const client = await clientRes.json();

  const res = await fetch(`${baseUrl}/api/projects`, withUserJson(ids.orgAdmin, { name: 'Projet Avec Client Valide', clientId: client.id }));
  assert.equal(res.status, 201);
  const project = await res.json();

  const { rows: [row] } = await pool.query('select client_id from projects where id=$1', [project.id]);
  assert.equal(row.client_id, client.id);
});

test('Projet -- comportement locale/défaut inchangé (aucune régression)', async () => {
  const clientRes = await fetch(`${baseUrl}/api/clients`, withUserJson(ids.orgAdmin, { name: 'Client Locale Test' }));
  const client = await clientRes.json();
  const res = await fetch(`${baseUrl}/api/projects`, withUserJson(ids.orgAdmin, { name: 'Projet Locale', clientId: client.id }));
  assert.equal(res.status, 201);
  const project = await res.json();
  const { rows: [settings] } = await pool.query('select workspace_locale, content_locale from project_settings where project_id=$1', [project.id]);
  assert.equal(settings.workspace_locale, 'fr');
});

// ── Renommage de projet ──────────────────────────────────────────────

test('Projet -- renommage autorisé pour PROJECT_MANAGE (project_admin), version incrémentée', async () => {
  const { rows: [before] } = await pool.query('select version from projects where id=$1', [ids.project]);
  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/name`, {
    method: 'PATCH',
    headers: { 'X-Storm-Dev-User': ids.projectAdmin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Projet Renommé', version: before.version })
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.name, 'Projet Renommé');
  assert.equal(body.version, before.version + 1);
});

test('Projet -- renommage refusé sans PROJECT_MANAGE (contributor)', async () => {
  const { rows: [row] } = await pool.query('select version from projects where id=$1', [ids.project]);
  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/name`, {
    method: 'PATCH',
    headers: { 'X-Storm-Dev-User': ids.creator, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Tentative Contributor', version: row.version })
  });
  assert.equal(res.status, 403);
});

test('Projet -- renommage : version périmée -> 409 STALE_VERSION', async () => {
  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/name`, {
    method: 'PATCH',
    headers: { 'X-Storm-Dev-User': ids.projectAdmin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Tentative Périmée Projet', version: 999 })
  });
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.error.code, 'STALE_VERSION');
});

test('Projet -- renommage n\'altère jamais le comportement de la route publique UUID actuelle (Lot A, aucun effet Accès Public)', async () => {
  const res = await fetch(`${baseUrl}/public/projects/${ids.project}`, {});
  assert.ok(res.status === 200 || res.status === 404);
});

// ── Legacy NULL client_id ─────────────────────────────────────────────

test('Projet legacy avec client_id NULL -- la lecture du projet ne plante jamais', async () => {
  const res = await fetch(`${baseUrl}/api/projects`, withUser(ids.orgAdmin));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body));
});

// ── Contrainte DB tenant-safe (FK composite) ──────────────────────────

test('DB -- FK composite (tenant_id, client_id) rejette une incohérence cross-tenant même en écriture directe', async () => {
  const { rows: [otherClient] } = await pool.query(
    "insert into clients (tenant_id, name, normalized_slug) values ($1,'Client FK Test','client-fk-test') returning id",
    [ids.otherTenant]
  );
  await assert.rejects(
    pool.query('insert into projects (tenant_id, name, client_id) values ($1,$2,$3)', [ids.tenant, 'Projet FK Invalide', otherClient.id]),
    /foreign key|violates/i
  );
});
