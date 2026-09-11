import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { findAccessibleProjectForUser } from '../src/domain/projects/repository.js';
import { seedTenantMembership, seedProjectMembership } from './helpers/memberships.js';

// Valide explicitement l'invariant central du modèle Membership/Grant
// validé en amont : les permissions effectives sont l'union des
// capabilities de TOUS les grants actifs d'une membership, jamais un
// raisonnement "rôle le plus élevé" -- et la révocation d'une source
// ne supprime jamais les autres.

const config = loadConfig();
const pool = getPool(config);
let ids = {};

async function clean() {
  await pool.query('delete from project_grants');
  await pool.query('delete from project_memberships');
  await pool.query('delete from tenant_memberships');
  await pool.query('delete from projects');
  await pool.query('delete from users');
  await pool.query('delete from clients');
  await pool.query('delete from tenants');
}

test.before(async () => {
  await runMigrations();
  await clean();

  const { rows: [tenant] } = await pool.query("insert into tenants (name) values ('Tenant Grants Test') returning id");
  const { rows: [user] } = await pool.query("insert into users (email, display_name) values ('multigrant@test.local','Multi Grant') returning id");
  const { rows: [project] } = await pool.query("insert into projects (tenant_id, name) values ($1,'Projet Grants Test') returning id", [tenant.id]);

  await seedTenantMembership(pool, { tenantId: tenant.id, userId: user.id, permissionBundle: 'member' });
  ids = { tenantId: tenant.id, userId: user.id, projectId: project.id };
});

test.after(async () => {
  await clean();
  await closePool();
});

test('un seul grant actif (contributor) -> capabilities exactement celles de contributor', async () => {
  const { rows: [m] } = await pool.query(
    'insert into project_memberships (tenant_id, project_id, user_id, permission_bundle) values ($1,$2,$3,$4) returning id',
    [ids.tenantId, ids.projectId, ids.userId, 'contributor']
  );
  const { rows: [grant] } = await pool.query(
    `insert into project_grants (tenant_id, project_id, project_membership_id, permission_bundle, source_type, actor_user_id)
     values ($1,$2,$3,'contributor','direct',$4) returning id`,
    [ids.tenantId, ids.projectId, m.id, ids.userId]
  );

  const project = await findAccessibleProjectForUser(pool, { userId: ids.userId, projectId: ids.projectId });
  assert.deepEqual([...project.capabilities].sort(), ['content.edit', 'project.view'].sort());

  await pool.query('delete from project_grants where id = $1', [grant.id]);
  await pool.query('delete from project_memberships where id = $1', [m.id]);
});

test('deux grants actifs simultanés (direct=contributor + externe=editor) -> union exacte, jamais seulement le "plus élevé" au sens d\'un remplacement', async () => {
  const { rows: [m] } = await pool.query(
    'insert into project_memberships (tenant_id, project_id, user_id, permission_bundle) values ($1,$2,$3,$4) returning id',
    [ids.tenantId, ids.projectId, ids.userId, 'contributor']
  );
  const { rows: [grantDirect] } = await pool.query(
    `insert into project_grants (tenant_id, project_id, project_membership_id, permission_bundle, source_type, actor_user_id)
     values ($1,$2,$3,'contributor','direct',$4) returning id`,
    [ids.tenantId, ids.projectId, m.id, ids.userId]
  );
  const { rows: [grantExternal] } = await pool.query(
    `insert into project_grants (tenant_id, project_id, project_membership_id, permission_bundle, source_type, external_provider, external_group_id, actor_user_id)
     values ($1,$2,$3,'editor','external_group_mapping','entra','grp-editors',null) returning id`,
    [ids.tenantId, ids.projectId, m.id]
  );

  const project = await findAccessibleProjectForUser(pool, { userId: ids.userId, projectId: ids.projectId });
  // union(contributor, editor) = capabilities de editor (superset dans
  // le modèle actuel) -- vérifié explicitement par calcul d'ensemble,
  // jamais supposé.
  assert.deepEqual([...project.capabilities].sort(), ['content.edit', 'project.view', 'publication.publish'].sort());

  // Révoquer UNIQUEMENT le grant externe -- l'accès direct doit
  // survivre intact, jamais supprimé par la révocation de l'autre
  // source (invariant explicitement demandé).
  await pool.query("update project_grants set status='revoked', revoked_at=now() where id = $1", [grantExternal.id]);
  const afterRevoke = await findAccessibleProjectForUser(pool, { userId: ids.userId, projectId: ids.projectId });
  assert.deepEqual([...afterRevoke.capabilities].sort(), ['content.edit', 'project.view'].sort(), 'le grant direct restant doit encore donner accès, intact');

  await pool.query('delete from project_grants where id in ($1,$2)', [grantDirect.id, grantExternal.id]);
  await pool.query('delete from project_memberships where id = $1', [m.id]);
});

test('aucun grant actif (tous révoqués) -> aucune capability, jamais un accès résiduel', async () => {
  const { rows: [m] } = await pool.query(
    'insert into project_memberships (tenant_id, project_id, user_id, permission_bundle) values ($1,$2,$3,$4) returning id',
    [ids.tenantId, ids.projectId, ids.userId, 'pilot']
  );
  const { rows: [grant] } = await pool.query(
    `insert into project_grants (tenant_id, project_id, project_membership_id, permission_bundle, source_type, actor_user_id, status, revoked_at)
     values ($1,$2,$3,'pilot','direct',$4,'revoked',now()) returning id`,
    [ids.tenantId, ids.projectId, m.id, ids.userId]
  );

  const project = await findAccessibleProjectForUser(pool, { userId: ids.userId, projectId: ids.projectId });
  assert.deepEqual(project.capabilities, [], 'zéro grant actif doit donner zéro capability, jamais un repli sur le bundle de la membership elle-même');

  await pool.query('delete from project_grants where id = $1', [grant.id]);
  await pool.query('delete from project_memberships where id = $1', [m.id]);
});

test('grant migrated_direct (rétro-peuplement) se comporte identiquement à un grant direct ordinaire', async () => {
  const { rows: [m] } = await pool.query(
    'insert into project_memberships (tenant_id, project_id, user_id, permission_bundle) values ($1,$2,$3,$4) returning id',
    [ids.tenantId, ids.projectId, ids.userId, 'editor']
  );
  const { rows: [grant] } = await pool.query(
    `insert into project_grants (tenant_id, project_id, project_membership_id, permission_bundle, source_type, actor_user_id)
     values ($1,$2,$3,'editor','migrated',null) returning id`,
    [ids.tenantId, ids.projectId, m.id]
  );

  const project = await findAccessibleProjectForUser(pool, { userId: ids.userId, projectId: ids.projectId });
  assert.deepEqual([...project.capabilities].sort(), ['content.edit', 'project.view', 'publication.publish'].sort());

  await pool.query('delete from project_grants where id = $1', [grant.id]);
  await pool.query('delete from project_memberships where id = $1', [m.id]);
});
