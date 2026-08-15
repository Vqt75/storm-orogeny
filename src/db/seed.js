// Seed — volontairement conçu pour prouver les frontières d'isolation
// et de permissions, pas pour peupler joliment une démo.
//
// Parella
// ├── Vivien  (organization_admin — PROUVE que ça ne donne PAS accès à Peugeot)
// ├── Alice   (member)
// └── Bob     (member)
// Autre Organisation
// └── Charlie (member — PROUVE l'isolation cross-tenant)
//
// Clermont : Vivien -> project_admin, Alice -> editor
// Tours    : Vivien -> contributor,   Bob   -> pilot
// Peugeot  : Alice  -> contributor    (Vivien n'y a AUCUNE membership)
import { loadConfig } from '../config/env.js';
import { getPool, closePool } from './pool.js';
import { logger } from '../logger.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

async function clearAll(client) {
  await client.query('delete from project_memberships');
  await client.query('delete from tenant_memberships');
  await client.query('delete from projects');
  await client.query('delete from users');
  await client.query('delete from tenants');
}

async function insertTenant(client, name) {
  const { rows: [row] } = await client.query('insert into tenants (name) values ($1) returning id', [name]);
  return row.id;
}

async function insertUser(client, email, displayName) {
  const { rows: [row] } = await client.query(
    'insert into users (email, display_name) values ($1, $2) returning id',
    [email, displayName]
  );
  return row.id;
}

async function insertTenantMembership(client, tenantId, userId, bundle) {
  await client.query(
    'insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1, $2, $3)',
    [tenantId, userId, bundle]
  );
}

async function insertProject(client, tenantId, name) {
  const { rows: [row] } = await client.query(
    'insert into projects (tenant_id, name) values ($1, $2) returning id',
    [tenantId, name]
  );
  return row.id;
}

async function insertProjectMembership(client, tenantId, projectId, userId, bundle) {
  await client.query(
    'insert into project_memberships (tenant_id, project_id, user_id, permission_bundle) values ($1, $2, $3, $4)',
    [tenantId, projectId, userId, bundle]
  );
}

// Depuis Phase 1B (Project Setup), tout projet créé via POST /api/projects
// possède réellement une project_identity et des project_settings. Le
// seed doit rester représentatif de cet état — sinon un projet seedé
// se comporte différemment d'un projet réellement créé (découvert
// concrètement : l'upload de logo échouait silencieusement sur un
// projet seedé sans project_identity).
async function insertProjectIdentityAndSettings(client, tenantId, projectId, { workspaceLocale, contentLocale }) {
  await client.query(
    'insert into project_identity (tenant_id, project_id, theme) values ($1, $2, $3)',
    [tenantId, projectId, 'ivory']
  );
  await client.query(
    'insert into project_settings (tenant_id, project_id, workspace_locale, content_locale) values ($1, $2, $3, $4)',
    [tenantId, projectId, workspaceLocale, contentLocale]
  );
}

export async function seed() {
  const config = loadConfig();
  const pool = getPool(config);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await clearAll(client);

    const parella = await insertTenant(client, 'Parella');
    const autreOrg = await insertTenant(client, 'Autre Organisation');

    const vivien = await insertUser(client, 'vivien@parella.example', 'Vivien');
    const alice = await insertUser(client, 'alice@parella.example', 'Alice');
    const bob = await insertUser(client, 'bob@parella.example', 'Bob');
    const charlie = await insertUser(client, 'charlie@autre-organisation.example', 'Charlie');

    await insertTenantMembership(client, parella, vivien, 'organization_admin');
    await insertTenantMembership(client, parella, alice, 'member');
    await insertTenantMembership(client, parella, bob, 'member');
    await insertTenantMembership(client, autreOrg, charlie, 'member');

    const clermont = await insertProject(client, parella, 'Clermont-Ferrand');
    const tours = await insertProject(client, parella, 'Tours');
    const peugeot = await insertProject(client, parella, 'Peugeot');

    await insertProjectIdentityAndSettings(client, parella, clermont, { workspaceLocale: 'fr', contentLocale: 'fr' });
    await insertProjectIdentityAndSettings(client, parella, tours, { workspaceLocale: 'fr', contentLocale: 'fr' });
    await insertProjectIdentityAndSettings(client, parella, peugeot, { workspaceLocale: 'fr', contentLocale: 'fr' });

    await insertProjectMembership(client, parella, clermont, vivien, 'project_admin');
    await insertProjectMembership(client, parella, clermont, alice, 'editor');
    await insertProjectMembership(client, parella, tours, vivien, 'contributor');
    await insertProjectMembership(client, parella, tours, bob, 'pilot');
    await insertProjectMembership(client, parella, peugeot, alice, 'contributor');
    // Vivien n'a délibérément AUCUNE project_membership sur Peugeot —
    // c'est le cas qui prouve que organization_admin ne vaut pas accès
    // implicite à tous les projets.

    await client.query('COMMIT');

    const ids = { parella, autreOrg, vivien, alice, bob, charlie, clermont, tours, peugeot };
    logger.info(ids, 'Seed appliqué');
    return ids;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  seed()
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch(err => {
      logger.error({ err }, 'Echec du seed');
      closePool().finally(() => process.exit(1));
    });
}
