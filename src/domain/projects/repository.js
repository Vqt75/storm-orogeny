// Repository projects — la liste "mes projets" ne passe QUE par
// project_memberships, jamais par une capability organisationnelle.
// C'est précisément ce qui garantit qu'un organization_admin ne voit
// pas automatiquement tout le parc de projets via ce chemin — voir
// docs/contracts/permissions.md, invariant central.

export async function listProjectsForUser(pool, userId) {
  const { rows } = await pool.query(
    `select p.id, p.name, pm.permission_bundle as my_bundle,
            pi.logo_asset_id, pi.primary_color
     from project_memberships pm
     join projects p on p.id = pm.project_id and p.tenant_id = pm.tenant_id
     left join project_identity pi on pi.project_id = p.id and pi.tenant_id = p.tenant_id
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
    `select p.id, p.tenant_id, p.name, p.status, pm.permission_bundle as my_bundle
     from project_memberships pm
     join projects p on p.id = pm.project_id and p.tenant_id = pm.tenant_id
     where pm.user_id = $1 and pm.project_id = $2 and pm.status = 'active'`,
    [userId, projectId]
  );
  return rows[0] ?? null;
}

// Lectures pour le contexte projet (Phase 2A — Project Shell). Jamais
// de re-vérification tenant ici : l'appelant a déjà validé l'accès via
// requireProjectCapability avant d'appeler ces fonctions, project_id
// est donc déjà de confiance à ce stade.

export async function findProjectIdentity(pool, projectId) {
  const { rows } = await pool.query(
    `select logo_asset_id, primary_color, secondary_color, font_primary, font_secondary,
            font_primary_asset_id, font_secondary_asset_id, theme, version, updated_at
     from project_identity where project_id = $1`,
    [projectId]
  );
  return rows[0] ?? null;
}

export async function findProjectSettings(pool, projectId) {
  const { rows } = await pool.query(
    `select workspace_locale, content_locale
     from project_settings where project_id = $1`,
    [projectId]
  );
  return rows[0] ?? null;
}

export async function listProjectModules(pool, projectId) {
  const { rows } = await pool.query(
    `select module_key, enabled
     from project_modules where project_id = $1
     order by module_key asc`,
    [projectId]
  );
  return rows;
}
