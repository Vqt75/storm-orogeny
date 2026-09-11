import { projectCapabilitiesForBundle } from '../permissions/capabilities.js';
import { normalizeSlug } from '../shared/slug.js';
import { findCurrentAccess, rotateAccess } from '../publicAccess/repository.js';

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

// reassignProjectClient -- corrige le Client d'un Projet (erreur de
// création, ou legacy client_id NULL). Distinct d'un renommage de
// Client : ici c'est l'ASSOCIATION structurelle qui change. Si aucun
// Accès Public courant n'existe, mutation directe. Sinon, rotation
// TOUJOURS déclenchée (même si le slug lisible résultant serait
// identique par coïncidence) -- l'identité structurelle a changé, pas
// seulement du texte d'affichage.
export async function reassignProjectClient(pool, { tenantId, projectId, newClientId, encryptionKey }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [targetClient] } = await client.query(
      'select id, normalized_slug from clients where id=$1 and tenant_id=$2',
      [newClientId, tenantId]
    );
    if (!targetClient) {
      await client.query('ROLLBACK');
      return { conflict: 'CLIENT_NOT_FOUND' };
    }
    const { rows: [project] } = await client.query(
      'update projects set client_id=$1 where id=$2 and tenant_id=$3 returning id, name',
      [newClientId, projectId, tenantId]
    );
    if (!project) {
      await client.query('ROLLBACK');
      return { conflict: 'PROJECT_NOT_FOUND' };
    }

    const currentAccess = await findCurrentAccess(client, projectId);
    let rotated = null;
    if (currentAccess) {
      rotated = await rotateAccess(client, {
        tenantId, projectId,
        clientSlug: targetClient.normalized_slug,
        projectSlug: currentAccess.project_slug,
        reason: 'client_reassigned', encryptionKey
      });
    }

    await client.query('COMMIT');
    return { conflict: null, project, rotated: Boolean(rotated) };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
// du Projet changerait, et si un Accès Public courant existe (publié,
// actif ou dépublié -- les deux comptent, doctrine G).
export async function previewProjectRename(pool, { tenantId, projectId, name }) {
  const newSlug = normalizeSlug(name);
  const { rows: [project] } = await pool.query(
    'select id, name, version, client_id from projects where id=$1 and tenant_id=$2',
    [projectId, tenantId]
  );
  if (!project) return null;
  const currentSlug = normalizeSlug(project.name);
  const access = await findCurrentAccess(pool, projectId);
  return {
    project, newSlug,
    slugChanges: currentSlug !== newSlug,
    hasCurrentAccess: Boolean(access)
  };
}

// renameProjectAtomic -- renomme toujours le Projet. Si le slug lisible
// change ET qu'un Accès Public courant existe, fait tourner cet accès
// dans la MÊME transaction (succès entier ou rollback entier). Si le
// Projet n'a jamais eu d'Accès Public, ou si le slug ne change pas,
// aucune rotation -- renommage direct, jamais un effet de bord public
// silencieux dans un sens comme dans l'autre.
export async function renameProjectAtomic(pool, { tenantId, projectId, name, expectedVersion, encryptionKey }) {
  const newSlug = normalizeSlug(name);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [row] } = await client.query(
      `update projects set name=$1, version=version+1
       where id=$2 and tenant_id=$3 and version=$4
       returning id, name, version, client_id`,
      [name, projectId, tenantId, expectedVersion]
    );
    if (!row) {
      await client.query('ROLLBACK');
      return { project: null, conflict: 'STALE_VERSION' };
    }

    const currentAccess = await findCurrentAccess(client, projectId);
    let rotated = null;
    if (currentAccess && currentAccess.project_slug !== newSlug) {
      rotated = await rotateAccess(client, {
        tenantId, projectId, clientSlug: currentAccess.client_slug, projectSlug: newSlug,
        reason: 'project_renamed', encryptionKey
      });
    }
    await client.query('COMMIT');
    return { project: row, conflict: null, rotated: Boolean(rotated) };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
