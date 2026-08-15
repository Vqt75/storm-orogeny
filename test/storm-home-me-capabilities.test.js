import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { createApp } from '../src/http/app.js';

// GET /api/me doit exposer les capabilities ORGANISATIONNELLES,
// calculées côté serveur — jamais le nom brut du bundle, jamais une
// agrégation avec des capabilities de projet (voir Storm Home handoff,
// docs/contracts/permissions.md).

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

test.before(async () => {
  await runMigrations();
  await clean();

  const { rows: [tenant] } = await pool.query("insert into tenants (name) values ('Org Cap Test') returning id");
  const { rows: [admin] } = await pool.query("insert into users (email, display_name) values ('admin@captest.local','Admin') returning id");
  const { rows: [member] } = await pool.query("insert into users (email, display_name) values ('member@captest.local','Member') returning id");
  await pool.query('insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1,$2,$3)', [tenant.id, admin.id, 'organization_admin']);
  await pool.query('insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1,$2,$3)', [tenant.id, member.id, 'member']);
  ids = { tenant: tenant.id, admin: admin.id, member: member.id };

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

test('organization_admin reçoit ses 6 capabilities organisationnelles, jamais le nom du bundle', async () => {
  const res = await fetch(`${baseUrl}/api/me`, { headers: { 'X-Storm-Dev-User': ids.admin } });
  const body = await res.json();
  assert.equal('permission_bundle' in body.organization, false, 'le nom brut du bundle ne doit jamais être exposé');
  assert.deepEqual(
    [...body.organization.capabilities].sort(),
    ['control.access', 'organization.members.manage', 'organization.settings.manage', 'projects.create', 'projects.manage_memberships', 'projects.view_all'].sort()
  );
});

test('member reçoit un tableau de capabilities vide, jamais absent', async () => {
  const res = await fetch(`${baseUrl}/api/me`, { headers: { 'X-Storm-Dev-User': ids.member } });
  const body = await res.json();
  assert.deepEqual(body.organization.capabilities, []);
});

test('aucune capability de projet ne fuite jamais dans organization.capabilities', async () => {
  const { rows: [project] } = await pool.query('insert into projects (tenant_id, name) values ($1,$2) returning id', [ids.tenant, 'Projet Test']);
  await pool.query(
    'insert into project_memberships (tenant_id, project_id, user_id, permission_bundle) values ($1,$2,$3,$4)',
    [ids.tenant, project.id, ids.member, 'project_admin']
  );

  const res = await fetch(`${baseUrl}/api/me`, { headers: { 'X-Storm-Dev-User': ids.member } });
  const body = await res.json();
  // Même avec un project_admin sur un vrai projet, organization.capabilities
  // reste vide — le scope ne se mélange jamais.
  assert.deepEqual(body.organization.capabilities, []);
  const projectOnlyCaps = ['content.edit', 'publication.publish', 'pilotage.view', 'members.manage', 'project.manage'];
  for (const cap of projectOnlyCaps) {
    assert.equal(body.organization.capabilities.includes(cap), false, `${cap} est une capability de PROJET, ne doit jamais apparaître ici`);
  }
});
