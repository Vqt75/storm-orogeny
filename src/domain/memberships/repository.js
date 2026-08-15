// Repository memberships — fonctions typées, jamais de SQL brut dans
// les routes ou les middlewares.

export async function findTenantMembershipForUser(pool, userId) {
  // Un utilisateur appartient à une seule organisation en V1 (pas de
  // multi-tenant côté utilisateur pour l'instant) — voir
  // docs/contracts/schema-and-migrations.md.
  const { rows } = await pool.query(
    `select tm.tenant_id, tm.permission_bundle, tm.status, t.name as tenant_name
     from tenant_memberships tm
     join tenants t on t.id = tm.tenant_id
     where tm.user_id = $1 and tm.status = 'active'
     limit 1`,
    [userId]
  );
  return rows[0] ?? null;
}

export async function findProjectMembership(pool, { userId, projectId }) {
  const { rows } = await pool.query(
    `select project_id, tenant_id, permission_bundle, status
     from project_memberships
     where user_id = $1 and project_id = $2 and status = 'active'`,
    [userId, projectId]
  );
  return rows[0] ?? null;
}
