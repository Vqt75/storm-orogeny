import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';

// Ces tests tournent contre une vraie instance PostgreSQL (voir .env) —
// pas une simulation. L'objectif précis : prouver que l'isolation
// tenant est garantie par PostgreSQL lui-même, pas seulement par du
// code applicatif qui pourrait avoir un bug.

const config = loadConfig();
const pool = getPool(config);

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
});

test.after(async () => {
  await cleanAll();
  await closePool();
});

test('une project_membership ne peut pas mélanger un projet et un tenant_membership de tenants différents', async () => {
  const { rows: [tenantA] } = await pool.query("insert into tenants (name) values ('Tenant A') returning id");
  const { rows: [tenantB] } = await pool.query("insert into tenants (name) values ('Tenant B') returning id");
  const { rows: [user] } = await pool.query("insert into users (email, display_name) values ('cross@test.local', 'Cross Test') returning id");
  const { rows: [project] } = await pool.query('insert into projects (tenant_id, name) values ($1, $2) returning id', [tenantA.id, 'Projet A']);
  await pool.query('insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1, $2, $3)', [tenantB.id, user.id, 'member']);

  await assert.rejects(
    pool.query(
      'insert into project_memberships (tenant_id, project_id, user_id, permission_bundle) values ($1, $2, $3, $4)',
      [tenantA.id, project.id, user.id, 'contributor']
    ),
    /foreign key constraint/
  );

  await cleanAll();
});

test('une project_membership ne peut pas référencer un projet qui n\'appartient pas au tenant_id fourni', async () => {
  const { rows: [tenantA] } = await pool.query("insert into tenants (name) values ('Tenant A') returning id");
  const { rows: [tenantB] } = await pool.query("insert into tenants (name) values ('Tenant B') returning id");
  const { rows: [user] } = await pool.query("insert into users (email, display_name) values ('cross2@test.local', 'Cross Test 2') returning id");
  const { rows: [project] } = await pool.query('insert into projects (tenant_id, name) values ($1, $2) returning id', [tenantA.id, 'Projet A']);
  await pool.query('insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1, $2, $3)', [tenantB.id, user.id, 'member']);

  await assert.rejects(
    pool.query(
      'insert into project_memberships (tenant_id, project_id, user_id, permission_bundle) values ($1, $2, $3, $4)',
      [tenantB.id, project.id, user.id, 'contributor']
    ),
    /foreign key constraint/
  );

  await cleanAll();
});

test('un permission_bundle hors de la liste autorisée est refusé par la contrainte CHECK', async () => {
  const { rows: [tenant] } = await pool.query("insert into tenants (name) values ('Tenant Check') returning id");
  const { rows: [user] } = await pool.query("insert into users (email, display_name) values ('check@test.local', 'Check Test') returning id");
  const { rows: [project] } = await pool.query('insert into projects (tenant_id, name) values ($1, $2) returning id', [tenant.id, 'Projet Check']);
  await pool.query('insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1, $2, $3)', [tenant.id, user.id, 'member']);

  await assert.rejects(
    pool.query(
      'insert into project_memberships (tenant_id, project_id, user_id, permission_bundle) values ($1, $2, $3, $4)',
      [tenant.id, project.id, user.id, 'super_admin_god_mode']
    ),
    /check constraint/
  );

  await cleanAll();
});

test('un status hors de la liste autorisée est refusé par la contrainte CHECK', async () => {
  const { rows: [tenant] } = await pool.query("insert into tenants (name) values ('Tenant Status') returning id");
  await assert.rejects(
    pool.query("insert into tenants (name, status) values ($1, $2)", ['Autre', 'definitely_not_a_real_status']),
    /check constraint/
  );
  await cleanAll();
});

test('la suppression d\'un tenant avec des memberships actives est refusée (RESTRICT, pas de cascade silencieuse)', async () => {
  const { rows: [tenant] } = await pool.query("insert into tenants (name) values ('Tenant Restrict') returning id");
  const { rows: [user] } = await pool.query("insert into users (email, display_name) values ('restrict@test.local', 'Restrict Test') returning id");
  await pool.query('insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1, $2, $3)', [tenant.id, user.id, 'member']);

  await assert.rejects(
    pool.query('delete from tenants where id = $1', [tenant.id]),
    /foreign key constraint/
  );

  await cleanAll();
});

test('deux projects_memberships identiques (même project_id + user_id) sont refusés par UNIQUE', async () => {
  const { rows: [tenant] } = await pool.query("insert into tenants (name) values ('Tenant Unique') returning id");
  const { rows: [user] } = await pool.query("insert into users (email, display_name) values ('unique@test.local', 'Unique Test') returning id");
  const { rows: [project] } = await pool.query('insert into projects (tenant_id, name) values ($1, $2) returning id', [tenant.id, 'Projet Unique']);
  await pool.query('insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1, $2, $3)', [tenant.id, user.id, 'member']);
  await pool.query(
    'insert into project_memberships (tenant_id, project_id, user_id, permission_bundle) values ($1, $2, $3, $4)',
    [tenant.id, project.id, user.id, 'contributor']
  );

  await assert.rejects(
    pool.query(
      'insert into project_memberships (tenant_id, project_id, user_id, permission_bundle) values ($1, $2, $3, $4)',
      [tenant.id, project.id, user.id, 'editor']
    ),
    /unique/i
  );

  await cleanAll();
});

test('les migrations sont idempotentes : relancer runMigrations sur un schéma à jour n\'échoue pas et n\'applique rien de plus', async () => {
  const result = await runMigrations();
  assert.equal(result.appliedCount, 0);
});
