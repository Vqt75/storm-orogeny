import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import {
  insertProject, insertProjectIdentity, insertProjectSettings,
  insertProjectModules, insertProjectMembership, insertProjectInvitation,
  listSupportedLocales
} from '../src/domain/project-setup/repository.js';

const config = loadConfig();
const pool = getPool(config);

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
});

test.after(async () => {
  await cleanAll();
  await closePool();
});

test('registre des locales supportées — source unique interrogeable', async () => {
  const locales = await listSupportedLocales(pool);
  assert.deepEqual(locales.sort(), ['de', 'en', 'es', 'fr', 'it', 'nl'].sort());
});

test('project_identity : une membership cross-tenant est refusée par PostgreSQL, pas seulement par le code', async () => {
  const { rows: [tenantA] } = await pool.query("insert into tenants (name) values ('Tenant A Setup') returning id");
  const { rows: [tenantB] } = await pool.query("insert into tenants (name) values ('Tenant B Setup') returning id");
  const { rows: [project] } = await pool.query('insert into projects (tenant_id, name) values ($1,$2) returning id', [tenantA.id, 'Projet Setup A']);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await assert.rejects(
      client.query(
        'insert into project_identity (tenant_id, project_id, theme) values ($1, $2, $3)',
        [tenantB.id, project.id, 'ivory']
      ),
      /foreign key constraint/
    );
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }

  await cleanAll();
});

test('project_settings : une locale hors registre est refusée par la contrainte FK', async () => {
  const { rows: [tenant] } = await pool.query("insert into tenants (name) values ('Tenant Locale Test') returning id");
  const { rows: [project] } = await pool.query('insert into projects (tenant_id, name) values ($1,$2) returning id', [tenant.id, 'Projet Locale']);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await assert.rejects(
      client.query(
        'insert into project_settings (tenant_id, project_id, workspace_locale, content_locale) values ($1, $2, $3, $4)',
        [tenant.id, project.id, 'klingon', 'fr']
      ),
      /foreign key constraint/
    );
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }

  await cleanAll();
});

test('project_settings : workspace_locale et content_locale peuvent légitimement différer', async () => {
  const { rows: [tenant] } = await pool.query("insert into tenants (name) values ('Tenant WTW') returning id");
  const { rows: [project] } = await pool.query('insert into projects (tenant_id, name) values ($1,$2) returning id', [tenant.id, 'WTW France']);

  await insertProjectSettings(pool, { tenantId: tenant.id, projectId: project.id, workspaceLocale: 'en', contentLocale: 'fr' });

  const { rows: [settings] } = await pool.query('select workspace_locale, content_locale from project_settings where project_id=$1', [project.id]);
  assert.equal(settings.workspace_locale, 'en');
  assert.equal(settings.content_locale, 'fr');

  await cleanAll();
});

test('project_invitations : un permission_bundle inconnu (ex. ancien "admin" Tectonic) est refusé', async () => {
  const { rows: [tenant] } = await pool.query("insert into tenants (name) values ('Tenant Invite Test') returning id");
  const { rows: [inviter] } = await pool.query("insert into users (email, display_name) values ('inviter@test.local','Inviter') returning id");
  const { rows: [project] } = await pool.query('insert into projects (tenant_id, name) values ($1,$2) returning id', [tenant.id, 'Projet Invite']);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await assert.rejects(
      client.query(
        `insert into project_invitations (tenant_id, project_id, email, permission_bundle, locale, invited_by_user_id)
         values ($1,$2,$3,$4,$5,$6)`,
        [tenant.id, project.id, 'tarrance@test.local', 'admin', 'nl', inviter.id]
      ),
      /check constraint/
    );
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }

  await cleanAll();
});

test('repository : une séquence complète (identity, settings, modules, membership, invitation) fonctionne bout en bout', async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [tenant] } = await client.query("insert into tenants (name) values ('Tenant Full Setup') returning id");
    const { rows: [creator] } = await client.query("insert into users (email, display_name) values ('creator@test.local','Créateur') returning id");
    // Une project_membership exige déjà (Phase 0) que l'utilisateur ait
    // une tenant_membership dans ce même tenant — cohérent avec le fait
    // que seul un membre de l'organisation peut créer/recevoir un projet.
    await client.query(
      'insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1, $2, $3)',
      [tenant.id, creator.id, 'member']
    );

    const projectId = await insertProject(client, { tenantId: tenant.id, name: 'Projet Complet' });

    await insertProjectIdentity(client, {
      tenantId: tenant.id, projectId,
      identity: { primaryColor: '#1E1D1E', secondaryColor: '#C2AF7E', fontPrimary: 'Roboto', theme: 'ivory' }
    });
    await insertProjectSettings(client, { tenantId: tenant.id, projectId, workspaceLocale: 'fr', contentLocale: 'fr' });
    await insertProjectModules(client, { tenantId: tenant.id, projectId, modules: { faq: true, actu: true, equipe: false } });
    await insertProjectMembership(client, { tenantId: tenant.id, projectId, userId: creator.id, permissionBundle: 'project_admin' });
    await insertProjectInvitation(client, {
      tenantId: tenant.id, projectId, email: 'tarrance@test.local',
      permissionBundle: 'editor', locale: 'nl', invitedByUserId: creator.id
    });

    await client.query('COMMIT');

    const { rows: [identity] } = await pool.query('select theme from project_identity where project_id=$1', [projectId]);
    assert.equal(identity.theme, 'ivory');

    const { rows: modules } = await pool.query('select module_key, enabled from project_modules where project_id=$1 order by module_key', [projectId]);
    assert.deepEqual(modules, [
      { module_key: 'actu', enabled: true },
      { module_key: 'equipe', enabled: false },
      { module_key: 'faq', enabled: true }
    ]);

    const { rows: [membership] } = await pool.query('select permission_bundle from project_memberships where project_id=$1 and user_id=$2', [projectId, creator.id]);
    assert.equal(membership.permission_bundle, 'project_admin');

    const { rows: [invitation] } = await pool.query('select email, permission_bundle, locale, status from project_invitations where project_id=$1', [projectId]);
    assert.equal(invitation.email, 'tarrance@test.local');
    assert.equal(invitation.permission_bundle, 'editor');
    assert.equal(invitation.locale, 'nl');
    assert.equal(invitation.status, 'pending');
  } finally {
    client.release();
  }

  await cleanAll();
});

test('migrations idempotentes (aucune nouvelle application sur un schéma à jour)', async () => {
  const result = await runMigrations();
  assert.equal(result.appliedCount, 0);
  assert.ok(result.total >= 3, 'au moins les 3 migrations connues à ce jour doivent être présentes');
});
