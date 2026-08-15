// Repository projects — la liste "mes projets" ne passe QUE par
// project_memberships, jamais par une capability organisationnelle.
// C'est précisément ce qui garantit qu'un organization_admin ne voit
// pas automatiquement tout le parc de projets via ce chemin — voir
// docs/contracts/permissions.md, invariant central.

export async function listProjectsForUser(pool, userId) {
  const { rows } = await pool.query(
    `select p.id, p.name, pm.permission_bundle as my_bundle
     from project_memberships pm
     join projects p on p.id = pm.project_id and p.tenant_id = pm.tenant_id
     where pm.user_id = $1 and pm.status = 'active' and p.status = 'active'
     order by p.name asc`,
    [userId]
  );
  return rows;
}

// Retourne le projet UNIQUEMENT si l'utilisateur a une project_membership
// active dessus — sinon null, indistinctement pour "projet inexistant",
// "projet d'un autre tenant" ou "projet du même tenant sans membership".
// L'appelant (route HTTP) traduit null en 404 : ne jamais révéler
// l'existence d'un projet à quelqu'un qui n'a aucune relation avec lui.
export async function findAccessibleProjectForUser(pool, { userId, projectId }) {
  const { rows } = await pool.query(
    `select p.id, p.name, p.status, pm.permission_bundle as my_bundle
     from project_memberships pm
     join projects p on p.id = pm.project_id and p.tenant_id = pm.tenant_id
     where pm.user_id = $1 and pm.project_id = $2 and pm.status = 'active'`,
    [userId, projectId]
  );
  return rows[0] ?? null;
}
