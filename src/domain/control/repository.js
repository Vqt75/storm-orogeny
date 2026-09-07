// Repository Storm Control — vues transverses de l'organisation,
// jamais scopées par project_membership (contrairement à
// domain/projects/repository.js). Toujours filtrées par tenant_id
// explicite, jamais un SELECT global — voir docs/contracts/permissions.md,
// invariant central (projects.view_all != accès au contenu des projets).

export async function listAllProjectsForTenant(pool, tenantId) {
  const { rows } = await pool.query(
    `select p.id, p.name, p.status, p.previous_status, p.created_at,
            pi.logo_asset_id, pi.primary_color,
            coalesce(access.people_count, 0) as people_count,
            coalesce(inv.pending_count, 0) as pending_invitations_count
     from projects p
     left join project_identity pi on pi.project_id = p.id and pi.tenant_id = p.tenant_id
     left join lateral (
       select count(distinct pm.user_id) as people_count
       from project_grants pg
       join project_memberships pm on pm.id = pg.project_membership_id
       where pg.project_id = p.id and pg.status = 'active' and pm.status = 'active'
     ) access on true
     left join lateral (
       select count(*) as pending_count
       from project_invitations
       where project_id = p.id and status = 'pending'
     ) inv on true
     where p.tenant_id = $1
     order by p.name asc`,
    [tenantId]
  );
  return rows;
}

// Transition de lifecycle — scopée par tenant_id explicite, jamais un
// UPDATE par id seul (même invariant que listAllProjectsForTenant
// ci-dessus). Retourne la ligne mise à jour, ou null si le projet
// n'existe pas dans ce tenant précisément.
//
// toStatus attend 'active' | 'stabilization' | 'archived', ou le mot
// réservé 'restore' -- restauration fidèle vers previous_status
// (jamais systématiquement vers 'active', voir décision produit
// validée). previous_status n'est écrit QUE lors d'un archivage (il
// mémorise l'état dont on archive) et effacé lors d'une restauration
// (consommé). Chaque transition, quelle qu'elle soit, est journalisée
// dans project_lifecycle_events -- indépendamment de previous_status,
// jamais confondu avec lui (l'audit trail répond à "qu'est-ce qui
// s'est passé", previous_status répond seulement à "où revenir").
export async function transitionProjectLifecycle(pool, { tenantId, projectId, toStatus, actorUserId }) {
  const { rows: [current] } = await pool.query(
    'select status, previous_status from projects where tenant_id = $1 and id = $2',
    [tenantId, projectId]
  );
  if (!current) return null;

  let actualToStatus = toStatus;
  let nextPreviousStatus = current.previous_status;

  if (toStatus === 'archived') {
    nextPreviousStatus = current.status;
  } else if (toStatus === 'restore') {
    actualToStatus = current.previous_status || 'active';
    nextPreviousStatus = null;
  }

  const { rows: [updated] } = await pool.query(
    `update projects set status = $3, previous_status = $4
     where tenant_id = $1 and id = $2
     returning id, name, status, previous_status, created_at`,
    [tenantId, projectId, actualToStatus, nextPreviousStatus]
  );
  if (!updated) return null;

  await pool.query(
    `insert into project_lifecycle_events (tenant_id, project_id, from_status, to_status, actor_user_id)
     values ($1, $2, $3, $4, $5)`,
    [tenantId, projectId, current.status, actualToStatus, actorUserId]
  );

  return updated;
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
