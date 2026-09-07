import { projectCapabilitiesForBundle } from '../permissions/capabilities.js';

// Ordre de priorité PUREMENT pour l'affichage (un seul badge à montrer
// quand plusieurs grants actifs portent des bundles différents) --
// jamais utilisé pour l'autorisation elle-même, qui reste toujours
// l'union des capabilities de TOUS les bundles actifs (voir modèle
// Membership/Grant validé -- jamais un raisonnement "rôle le plus
// élevé gagne").
const PROJECT_BUNDLE_DISPLAY_PRIORITY = ['project_admin', 'editor', 'pilot', 'contributor'];

function pickDisplayBundle(bundles) {
  return PROJECT_BUNDLE_DISPLAY_PRIORITY.find(b => bundles.includes(b)) ?? bundles[0] ?? null;
}

// Repository projects — la liste "mes projets" ne passe QUE par
// project_memberships, jamais par une capability organisationnelle.
// C'est précisément ce qui garantit qu'un organization_admin ne voit
// pas automatiquement tout le parc de projets via ce chemin — voir
// docs/contracts/permissions.md, invariant central.

export async function listProjectsForUser(pool, userId) {
  const { rows } = await pool.query(
    `select p.id, p.name,
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
//
// capabilities = union des bundles de TOUS les grants actifs de cette
// membership (jamais un seul bundle lu directement) -- calcul de
// permissions effectives validé par le modèle Membership/Grant.
// my_bundle reste exposé, mais uniquement comme bundle "dominant" pour
// l'affichage -- jamais relu pour une décision d'autorisation.
export async function findAccessibleProjectForUser(pool, { userId, projectId }) {
  const { rows } = await pool.query(
    `select p.id, p.tenant_id, p.name, p.status, pm.id as membership_id,
            coalesce(array_agg(distinct pg.permission_bundle) filter (where pg.permission_bundle is not null), '{}') as active_bundles
     from project_memberships pm
     join projects p on p.id = pm.project_id and p.tenant_id = pm.tenant_id
     left join project_grants pg on pg.project_membership_id = pm.id and pg.status = 'active'
     where pm.user_id = $1 and pm.project_id = $2 and pm.status = 'active'
     group by p.id, p.tenant_id, p.name, p.status, pm.id`,
    [userId, projectId]
  );
  const row = rows[0];
  if (!row) return null;
  const capabilities = [...new Set(row.active_bundles.flatMap(b => projectCapabilitiesForBundle(b)))];
  return { ...row, my_bundle: pickDisplayBundle(row.active_bundles), capabilities };
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
