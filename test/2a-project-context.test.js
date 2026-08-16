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

  const { rows: [tenant] } = await pool.query("insert into tenants (name) values ('Tenant Context') returning id");
  const { rows: [otherTenant] } = await pool.query("insert into tenants (name) values ('Autre Tenant Context') returning id");

  const { rows: [admin] } = await pool.query("insert into users (email, display_name) values ('admin@context.local','Admin Context') returning id");
  const { rows: [pilotUser] } = await pool.query("insert into users (email, display_name) values ('pilot@context.local','Pilot Context') returning id");
  const { rows: [outsider] } = await pool.query("insert into users (email, display_name) values ('outsider@context.local','Outsider') returning id");

  await pool.query('insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1,$2,$3)', [tenant.id, admin.id, 'organization_admin']);
  await pool.query('insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1,$2,$3)', [tenant.id, pilotUser.id, 'member']);
  await pool.query('insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1,$2,$3)', [otherTenant.id, outsider.id, 'organization_admin']);

  // Projet complet — identité, réglages, modules, deux memberships
  // (project_admin et pilot) — noms de police neutres, jamais
  // Italiana comme valeur d'exemple/défaut.
  const { rows: [project] } = await pool.query('insert into projects (tenant_id, name) values ($1,$2) returning id', [tenant.id, 'Clermont-Ferrand Context']);
  await pool.query(
    `insert into project_identity (tenant_id, project_id, primary_color, secondary_color, font_primary, font_secondary, theme)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [tenant.id, project.id, '#7A1F2B', '#C2AF7E', 'Source Serif', 'Fraunces', 'midnight']
  );
  await pool.query(
    'insert into project_settings (tenant_id, project_id, workspace_locale, content_locale) values ($1,$2,$3,$4)',
    [tenant.id, project.id, 'en', 'fr']
  );
  await pool.query("insert into project_modules (tenant_id, project_id, module_key, enabled) values ($1,$2,'faq',true)", [tenant.id, project.id]);
  await pool.query("insert into project_modules (tenant_id, project_id, module_key, enabled) values ($1,$2,'equipe',false)", [tenant.id, project.id]);
  await pool.query('insert into project_memberships (tenant_id, project_id, user_id, permission_bundle) values ($1,$2,$3,$4)', [tenant.id, project.id, admin.id, 'project_admin']);
  await pool.query('insert into project_memberships (tenant_id, project_id, user_id, permission_bundle) values ($1,$2,$3,$4)', [tenant.id, project.id, pilotUser.id, 'pilot']);

  // Projet sans identité ni réglages (cas limite — un projet créé
  // avant Phase 1B, ou toute anomalie similaire à celle déjà trouvée
  // dans le seed initial de Phase 0).
  const { rows: [bareProject] } = await pool.query('insert into projects (tenant_id, name) values ($1,$2) returning id', [tenant.id, 'Projet Sans Config']);
  await pool.query('insert into project_memberships (tenant_id, project_id, user_id, permission_bundle) values ($1,$2,$3,$4)', [tenant.id, bareProject.id, admin.id, 'project_admin']);

  ids = { tenant: tenant.id, otherTenant: otherTenant.id, admin: admin.id, pilotUser: pilotUser.id, outsider: outsider.id, project: project.id, bareProject: bareProject.id };

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

test('project_admin -> contexte complet, toutes les données réelles, capabilities correctes', async () => {
  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/context`, withUser(ids.admin));
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.deepEqual(body.project, { id: ids.project, name: 'Clermont-Ferrand Context', status: 'active' });
  assert.equal(body.identity.primaryColor, '#7A1F2B');
  assert.equal(body.identity.theme, 'midnight');
  assert.equal(body.settings.workspaceLocale, 'en');
  assert.equal(body.settings.contentLocale, 'fr');
  assert.deepEqual(body.modules.sort((a, b) => a.key.localeCompare(b.key)), [
    { key: 'equipe', enabled: false },
    { key: 'faq', enabled: true }
  ]);
  assert.equal(body.membership.permissionBundle, 'project_admin');
  assert.deepEqual(body.membership.capabilities.sort(), [
    'content.edit', 'members.manage', 'pilotage.view', 'project.manage', 'project.view', 'publication.publish'
  ].sort());
});

test('invariant 1 : identity.logoUrl absent du contrat (auth dev ne peut pas être portée par un <img>)', async () => {
  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/context`, withUser(ids.admin));
  const body = await res.json();
  assert.equal('logoUrl' in body.identity, false);
  assert.ok('logoAssetId' in body.identity);
});

test('pilot (project.view + pilotage.view seulement) -> Shell reste utile avec une seule porte', async () => {
  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/context`, withUser(ids.pilotUser));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.membership.permissionBundle, 'pilot');
  assert.deepEqual(body.membership.capabilities.sort(), ['pilotage.view', 'project.view'].sort());
  // Le contexte reste complet même si peu de capabilities — le Shell,
  // pas le serveur, décide de la représentation.
  assert.equal(body.project.name, 'Clermont-Ferrand Context');
});

test('invariant 2 : le serveur ne renvoie aucune liste de destinations UI', async () => {
  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/context`, withUser(ids.pilotUser));
  const body = await res.json();
  assert.equal('destinations' in body, false);
  assert.equal('ui' in body, false);
  assert.equal('navigation' in body, false);
});

test('projet sans project_identity/project_settings -> null gracieux, jamais un 500', async () => {
  const res = await fetch(`${baseUrl}/api/projects/${ids.bareProject}/context`, withUser(ids.admin));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.identity, null);
  assert.equal(body.settings, null);
  assert.deepEqual(body.modules, []);
});

test('utilisateur sans membership sur ce projet -> 404 (doctrine déjà établie, respectée par la nouvelle route)', async () => {
  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/context`, withUser(ids.outsider));
  assert.equal(res.status, 404);
});

test('cross-tenant impossible même via ce nouveau contrat', async () => {
  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/context`, withUser(ids.outsider));
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal('project' in body, false, 'aucune fuite de structure, même partielle');
});
