// Repository memberships — fonctions typées, jamais de SQL brut dans
// les routes ou les middlewares.

export async function findTenantMembershipForUser(pool, userId) {
  // Le schéma autorise déjà plusieurs OrganizationMembership par
  // utilisateur (aucune contrainte "un seul tenant" en base -- voir
  // audit Storm Control) ; l'UX complète de sélection multi-organisation
  // reste hors scope de cette passe. En attendant, le contexte
  // organisationnel courant DOIT rester déterministe -- jamais un ordre
  // SQL implicite (un `limit 1` sans `order by` n'est pas garanti par
  // PostgreSQL). Choix explicite et documenté : la organisation
  // rejointe en premier (created_at le plus ancien), tenant_id en
  // départage pur pour une égalité de timestamp -- reproductible à
  // chaque appel, jamais dépendant du plan de requête.
  const { rows } = await pool.query(
    `select tm.tenant_id, tm.permission_bundle, tm.status, t.name as tenant_name
     from tenant_memberships tm
     join tenants t on t.id = tm.tenant_id
     where tm.user_id = $1 and tm.status = 'active'
     order by tm.created_at asc, tm.tenant_id asc
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

// Personnes ayant un accès effectif à un projet, AVEC le détail de
// CHAQUE source indépendante (jamais fusionnées en une seule ligne
// muette) -- alimente l'onglet "Accès" de Storm Control. Une même
// personne avec plusieurs grants actifs apparaît UNE fois, avec
// plusieurs entrées dans "sources". Scopé par tenant_id explicite --
// jamais un id de projet seul, même invariant que le reste du repo.
export async function listProjectAccessSources(pool, { tenantId, projectId }) {
  const { rows } = await pool.query(
    `select u.id as user_id, u.display_name, u.email,
            pg.id as grant_id, pg.permission_bundle, pg.source_type,
            pg.external_provider, pg.external_group_id, pg.created_at
     from project_grants pg
     join project_memberships pm on pm.id = pg.project_membership_id
     join users u on u.id = pm.user_id
     where pg.project_id = $1 and pg.tenant_id = $2 and pg.status = 'active' and pm.status = 'active'
     order by u.display_name asc, pg.created_at asc`,
    [projectId, tenantId]
  );

  const byUser = new Map();
  for (const r of rows) {
    if (!byUser.has(r.user_id)) {
      byUser.set(r.user_id, { userId: r.user_id, displayName: r.display_name, email: r.email, sources: [] });
    }
    byUser.get(r.user_id).sources.push({
      grantId: r.grant_id,
      permissionBundle: r.permission_bundle,
      sourceType: r.source_type,
      externalProvider: r.external_provider,
      externalGroupId: r.external_group_id,
      createdAt: r.created_at
    });
  }
  return [...byUser.values()];
}

// Nombre de personnes DISTINCTES ayant un accès effectif (jamais un
// compte de grants ou de memberships) + invitations en attente --
// synthèse exacte demandée pour les cartes projet ("N personnes ont
// accès · N invitations en attente").
export async function projectAccessSummary(pool, { tenantId, projectId }) {
  const { rows: [row] } = await pool.query(
    `select
       (select count(distinct pm.user_id) from project_grants pg
        join project_memberships pm on pm.id = pg.project_membership_id
        where pg.project_id = $1 and pg.tenant_id = $2 and pg.status = 'active' and pm.status = 'active') as people_count,
       (select count(*) from project_invitations where project_id = $1 and tenant_id = $2 and status = 'pending') as pending_count`,
    [projectId, tenantId]
  );
  return { peopleCount: Number(row.people_count), pendingInvitationsCount: Number(row.pending_count) };
}

export async function listProjectInvitations(pool, { tenantId, projectId }) {
  const { rows } = await pool.query(
    `select id, email, permission_bundle, status, created_at, accepted_at
     from project_invitations where project_id = $1 and tenant_id = $2
     order by created_at desc`,
    [projectId, tenantId]
  );
  return rows;
}

export async function revokeProjectInvitation(pool, { tenantId, projectId, invitationId }) {
  const { rows } = await pool.query(
    `update project_invitations set status = 'revoked'
     where id = $1 and project_id = $2 and tenant_id = $3 and status = 'pending'
     returning id, status`,
    [invitationId, projectId, tenantId]
  );
  return rows[0] ?? null;
}

// Acceptation -- crée/réutilise la membership puis un grant
// (sourceType='direct'), jamais l'inverse. L'invitation devient
// purement historique dès cet instant (voir modèle Invitation/Grant
// validé : l'invitation est un mécanisme d'entrée, le grant est la
// justification durable après acceptation).
export async function acceptProjectInvitation(pool, { invitationId, userId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [invitation] } = await client.query(
      `select id, tenant_id, project_id, permission_bundle, status
       from project_invitations where id = $1 for update`,
      [invitationId]
    );
    if (!invitation || invitation.status !== 'pending') {
      await client.query('ROLLBACK');
      return null;
    }

    // Un invité qui accepte sa toute première invitation projet peut
    // ne pas encore appartenir à l'organisation elle-même -- la
    // contrainte FK project_memberships->tenant_memberships l'exige.
    // Créer une tenant_membership de base ('member') si nécessaire,
    // jamais organization_admin par surprise -- accueil naturel,
    // jamais un contournement de la contrainte.
    const { rows: [existingTm] } = await client.query(
      'select id from tenant_memberships where tenant_id = $1 and user_id = $2',
      [invitation.tenant_id, userId]
    );
    if (!existingTm) {
      const { rows: [newTm] } = await client.query(
        `insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1,$2,'member') returning id`,
        [invitation.tenant_id, userId]
      );
      await client.query(
        `insert into organization_grants (tenant_id, organization_membership_id, permission_bundle, source_type, actor_user_id)
         values ($1,$2,'member','direct',null)`,
        [invitation.tenant_id, newTm.id]
      );
    }

    let membershipId;
    const { rows: [existing] } = await client.query(
      'select id from project_memberships where project_id = $1 and user_id = $2',
      [invitation.project_id, userId]
    );
    if (existing) {
      membershipId = existing.id;
    } else {
      const { rows: [created] } = await client.query(
        `insert into project_memberships (tenant_id, project_id, user_id, permission_bundle)
         values ($1,$2,$3,$4) returning id`,
        [invitation.tenant_id, invitation.project_id, userId, invitation.permission_bundle]
      );
      membershipId = created.id;
    }

    await client.query(
      `insert into project_grants (tenant_id, project_id, project_membership_id, permission_bundle, source_type, actor_user_id)
       values ($1,$2,$3,$4,'direct',null)`,
      [invitation.tenant_id, invitation.project_id, membershipId, invitation.permission_bundle]
    );

    await client.query(
      "update project_invitations set status = 'accepted', accepted_at = now() where id = $1",
      [invitationId]
    );

    await client.query('COMMIT');
    return { membershipId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Révoque UN grant précis -- jamais toute la membership. Garde-fou
// dernier project_admin : bloque si cette révocation laisserait le
// projet sans plus aucun grant actif portant project_admin (calculé en
// direct à chaque révocation, jamais un compteur mis en cache). Scopé
// par tenant_id explicite -- même invariant que le reste du repo.
export async function revokeProjectGrant(pool, { tenantId, projectId, grantId }) {
  const { rows: [grant] } = await pool.query(
    "select permission_bundle from project_grants where id = $1 and project_id = $2 and tenant_id = $3 and status = 'active'",
    [grantId, projectId, tenantId]
  );
  if (!grant) return { ok: false, code: 'NOT_FOUND' };

  if (grant.permission_bundle === 'project_admin') {
    const { rows: [{ count }] } = await pool.query(
      `select count(*)::int as count from project_grants
       where project_id = $1 and tenant_id = $2 and status = 'active' and permission_bundle = 'project_admin' and id != $3`,
      [projectId, tenantId, grantId]
    );
    if (Number(count) === 0) {
      return { ok: false, code: 'LAST_ADMIN' };
    }
  }

  await pool.query("update project_grants set status = 'revoked', revoked_at = now() where id = $1", [grantId]);
  return { ok: true };
}

// Accès d'UN membre à travers TOUS ses projets du tenant -- alimente
// la fiche membre de Storm Control. Même principe que
// listProjectAccessSources, pivoté par utilisateur plutôt que par
// projet. Scopé par tenant_id explicite.
export async function listMemberProjectAccess(pool, { tenantId, userId }) {
  const { rows } = await pool.query(
    `select p.id as project_id, p.name as project_name,
            pg.id as grant_id, pg.permission_bundle, pg.source_type,
            pg.external_provider, pg.external_group_id
     from project_grants pg
     join project_memberships pm on pm.id = pg.project_membership_id
     join projects p on p.id = pm.project_id and p.tenant_id = pm.tenant_id
     where pg.tenant_id = $1 and pm.user_id = $2 and pg.status = 'active' and pm.status = 'active'
     order by p.name asc`,
    [tenantId, userId]
  );

  const byProject = new Map();
  for (const r of rows) {
    if (!byProject.has(r.project_id)) {
      byProject.set(r.project_id, { projectId: r.project_id, projectName: r.project_name, sources: [] });
    }
    byProject.get(r.project_id).sources.push({
      grantId: r.grant_id,
      permissionBundle: r.permission_bundle,
      sourceType: r.source_type,
      externalProvider: r.external_provider,
      externalGroupId: r.external_group_id
    });
  }
  return [...byProject.values()];
}

export async function listExternalGroupMappings(pool, tenantId) {
  const { rows } = await pool.query(
    `select id, provider, external_group_id, target_type, target_id, permission_bundle, created_at
     from external_group_mappings where tenant_id = $1
     order by created_at asc`,
    [tenantId]
  );
  return rows;
}

// Invitations en attente, tous projets du tenant confondus -- alimente
// la vue "Accès" globale de Storm Control (jamais scopée à un seul
// projet, contrairement à listProjectInvitations).
export async function listPendingInvitationsForTenant(pool, tenantId) {
  const { rows } = await pool.query(
    `select pi.id, pi.email, pi.permission_bundle, pi.created_at, p.id as project_id, p.name as project_name
     from project_invitations pi
     join projects p on p.id = pi.project_id
     where pi.tenant_id = $1 and pi.status = 'pending'
     order by pi.created_at desc`,
    [tenantId]
  );
  return rows;
}
