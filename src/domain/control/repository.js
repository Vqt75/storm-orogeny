// Repository Storm Control — vues transverses de l'organisation,
// jamais scopées par project_membership (contrairement à
// domain/projects/repository.js). Toujours filtrées par tenant_id
// explicite, jamais un SELECT global — voir docs/contracts/permissions.md,
// invariant central (projects.view_all != accès au contenu des projets).

export async function listAllProjectsForTenant(pool, tenantId) {
  const { rows } = await pool.query(
    `select id, name, status, created_at
     from projects
     where tenant_id = $1
     order by name asc`,
    [tenantId]
  );
  return rows;
}

export async function listTenantMembers(pool, tenantId) {
  const { rows } = await pool.query(
    `select u.id, u.email, u.display_name, tm.permission_bundle, tm.status, tm.created_at
     from tenant_memberships tm
     join users u on u.id = tm.user_id
     where tm.tenant_id = $1
     order by u.display_name asc`,
    [tenantId]
  );
  return rows;
}
