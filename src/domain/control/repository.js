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

// Transition de statut — scopée par tenant_id explicite, jamais un
// UPDATE par id seul : un id de projet appartenant à un AUTRE tenant
// ne doit jamais pouvoir être touché depuis cette route, même par
// erreur applicative (même invariant que listAllProjectsForTenant
// ci-dessus). Retourne la ligne mise à jour, ou null si le projet
// n'existe pas dans ce tenant précisément.
export async function setProjectStatus(pool, tenantId, projectId, status) {
  const { rows } = await pool.query(
    `update projects set status = $3
     where tenant_id = $1 and id = $2
     returning id, name, status, created_at`,
    [tenantId, projectId, status]
  );
  return rows[0] ?? null;
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
