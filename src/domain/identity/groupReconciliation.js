// Réconciliation groupes externes -> grants -- Batch 3. Appelée après
// une connexion SSO réussie (identité déjà résolue/liée), avec le
// résultat `groups` du provider. Additif toujours sûr ; la révocation
// n'est JAMAIS appliquée si le claim n'est pas affirmé complet
// (`kind:'complete'`) -- une absence/erreur/troncature ne doit jamais
// être interprétée comme "groupes=[] donc tout révoquer" (doctrine
// validée).
//
// Doctrine organisation V1 (correction produit) : chaque mapping porte
// déjà son propre tenant_id/target -- cette réconciliation n'a JAMAIS
// besoin de résoudre "quelle organisation courante" ni de sélecteur
// multi-org. Un mapping ciblant un PROJET ne confère jamais de
// capability ORGANISATIONNELLE, quel que soit le bundle qu'il accorde
// -- un grant project_grants reste toujours un grant de projet, un
// grant organization_grants reste toujours un grant d'organisation,
// jamais mélangés. Le pont technique tenant_membership (prérequis FK)
// créé automatiquement pour un nouvel utilisateur project-scoped
// utilise TOUJOURS le bundle 'member' (zéro capability organisation-
// nelle) -- jamais une élévation implicite simplement parce que la
// personne participe à un projet.

import { projectCapabilitiesForBundle, organizationCapabilitiesForBundle } from '../permissions/capabilities.js';
import { hasAdministrativeCapabilityRemaining, ADMINISTRATIVE_CAPABILITY } from '../permissions/lastAdministrator.js';

async function ensureTenantMembershipBridge(client, { tenantId, userId }) {
  const { rows: [existing] } = await client.query(
    'select id from tenant_memberships where tenant_id = $1 and user_id = $2',
    [tenantId, userId]
  );
  if (existing) return existing.id;

  // 'member' uniquement -- jamais organization_admin implicitement.
  // Prérequis technique (FK project_memberships/project_grants),
  // jamais une autorité organisationnelle accordée par accident.
  const { rows: [created] } = await client.query(
    `insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1,$2,'member') returning id`,
    [tenantId, userId]
  );
  return created.id;
}

async function ensureProjectMembershipBridge(client, { tenantId, projectId, userId }) {
  const { rows: [existing] } = await client.query(
    'select id from project_memberships where project_id = $1 and user_id = $2',
    [projectId, userId]
  );
  if (existing) return existing.id;

  // Le bundle affiché sur la membership elle-même reste informatif
  // (legacy, voir audit) -- les permissions effectives viennent
  // toujours de l'union des grants actifs, jamais de ce champ seul.
  // 'contributor' choisi comme plancher neutre le moins privilégié ;
  // le grant réel inséré juste après porte le vrai bundle du mapping.
  const { rows: [created] } = await client.query(
    `insert into project_memberships (tenant_id, project_id, user_id, permission_bundle) values ($1,$2,$3,'contributor') returning id`,
    [tenantId, projectId, userId]
  );
  return created.id;
}

async function findActiveGrantFromMapping(client, { table, membershipColumn, membershipId, mappingId }) {
  const { rows: [row] } = await client.query(
    `select id from ${table} where ${membershipColumn} = $1 and mapping_id = $2 and status = 'active'`,
    [membershipId, mappingId]
  );
  return row ?? null;
}

async function reconcileAdditions(client, { userId, matchingMappings }) {
  const added = [];
  for (const mapping of matchingMappings) {
    if (mapping.target_type === 'project') {
      // Pont tenant obligatoire (prérequis FK), 'member' uniquement.
      await ensureTenantMembershipBridge(client, { tenantId: mapping.tenant_id, userId });
      const membershipId = await ensureProjectMembershipBridge(client, { tenantId: mapping.tenant_id, projectId: mapping.target_id, userId });
      const already = await findActiveGrantFromMapping(client, { table: 'project_grants', membershipColumn: 'project_membership_id', membershipId, mappingId: mapping.id });
      if (!already) {
        await client.query(
          `insert into project_grants (tenant_id, project_id, project_membership_id, permission_bundle, source_type, external_provider, external_group_id, mapping_id, actor_user_id)
           values ($1,$2,$3,$4,'external_group_mapping',$5,$6,$7,null)`,
          [mapping.tenant_id, mapping.target_id, membershipId, mapping.permission_bundle, mapping.provider, mapping.external_group_id, mapping.id]
        );
        added.push(mapping.id);
      }
    } else {
      // target_type === 'organization'
      const membershipId = await ensureTenantMembershipBridge(client, { tenantId: mapping.tenant_id, userId });
      const already = await findActiveGrantFromMapping(client, { table: 'organization_grants', membershipColumn: 'organization_membership_id', membershipId, mappingId: mapping.id });
      if (!already) {
        await client.query(
          `insert into organization_grants (tenant_id, organization_membership_id, permission_bundle, source_type, external_provider, external_group_id, mapping_id, actor_user_id)
           values ($1,$2,$3,'external_group_mapping',$4,$5,$6,null)`,
          [mapping.tenant_id, membershipId, mapping.permission_bundle, mapping.provider, mapping.external_group_id, mapping.id]
        );
        added.push(mapping.id);
      }
    }
  }
  return added;
}

async function reconcileRevocations(client, { userId, issuer, claimedGroupIds, hasAdministrativeCapabilityRemaining, ADMINISTRATIVE_CAPABILITY, capabilitiesForBundle }) {
  // Grants de projet actifs, source externe, dont le mapping référence
  // CET issuer, appartenant à une membership de cet utilisateur --
  // jamais un autre utilisateur.
  const { rows: projectCandidates } = await client.query(
    `select pg.id, pg.project_id, pg.permission_bundle, egm.external_group_id
     from project_grants pg
     join project_memberships pm on pm.id = pg.project_membership_id
     join external_group_mappings egm on egm.id = pg.mapping_id
     where pm.user_id = $1 and pg.status = 'active' and pg.source_type = 'external_group_mapping' and egm.issuer = $2`,
    [userId, issuer]
  );
  const { rows: orgCandidates } = await client.query(
    `select og.id, og.tenant_id, og.permission_bundle, egm.external_group_id
     from organization_grants og
     join tenant_memberships tm on tm.id = og.organization_membership_id
     join external_group_mappings egm on egm.id = og.mapping_id
     where tm.user_id = $1 and og.status = 'active' and og.source_type = 'external_group_mapping' and egm.issuer = $2`,
    [userId, issuer]
  );

  const revoked = [];
  // Anomalie MÉTIER, jamais un échec technique : le claim est fiable
  // (complete), une révocation aurait dû s'appliquer, mais le
  // garde-fou dernier administrateur l'interdit délibérément. L'état
  // DB reste cohérent (rien de partiellement révoqué), la transaction
  // continue de committer normalement -- ce signal est retourné à
  // l'appelant pour log structuré, jamais une raison d'empêcher la
  // connexion (voir arbitrage validé).
  const adminInterventionRequired = [];

  const toRevokeProject = projectCandidates.filter(g => !claimedGroupIds.has(g.external_group_id));
  const byProject = new Map();
  for (const g of toRevokeProject) {
    if (!byProject.has(g.project_id)) byProject.set(g.project_id, []);
    byProject.get(g.project_id).push(g);
  }
  for (const [projectId, grants] of byProject) {
    const revokesAdmin = grants.some(g => capabilitiesForBundle.project(g.permission_bundle).includes(ADMINISTRATIVE_CAPABILITY.project));
    if (revokesAdmin) {
      const stillAdministrable = await hasAdministrativeCapabilityRemaining(client, {
        targetType: 'project', targetId: projectId, excludingGrantIds: grants.map(g => g.id), capability: ADMINISTRATIVE_CAPABILITY.project
      });
      if (!stillAdministrable) {
        adminInterventionRequired.push({ targetType: 'project', targetId: projectId, blockedGrantIds: grants.map(g => g.id) });
        continue; // cette révocation précise est sautée, jamais toute la réconciliation.
      }
    }
    for (const g of grants) {
      await client.query("update project_grants set status = 'revoked', revoked_at = now() where id = $1", [g.id]);
      revoked.push(g.id);
    }
  }

  const toRevokeOrg = orgCandidates.filter(g => !claimedGroupIds.has(g.external_group_id));
  const byTenant = new Map();
  for (const g of toRevokeOrg) {
    if (!byTenant.has(g.tenant_id)) byTenant.set(g.tenant_id, []);
    byTenant.get(g.tenant_id).push(g);
  }
  for (const [tenantId, grants] of byTenant) {
    const revokesAdmin = grants.some(g => capabilitiesForBundle.organization(g.permission_bundle).includes(ADMINISTRATIVE_CAPABILITY.organization));
    if (revokesAdmin) {
      const stillAdministrable = await hasAdministrativeCapabilityRemaining(client, {
        targetType: 'organization', targetId: tenantId, excludingGrantIds: grants.map(g => g.id), capability: ADMINISTRATIVE_CAPABILITY.organization
      });
      if (!stillAdministrable) {
        adminInterventionRequired.push({ targetType: 'organization', targetId: tenantId, blockedGrantIds: grants.map(g => g.id) });
        continue;
      }
    }
    for (const g of grants) {
      await client.query("update organization_grants set status = 'revoked', revoked_at = now() where id = $1", [g.id]);
      revoked.push(g.id);
    }
  }

  return { revoked, adminInterventionRequired };
}

// Point d'entrée -- appelé après un login SSO réussi. `groups` est le
// résultat exact du contrat provider ({kind, groupIds?}). Retourne
// {added, revoked, adminInterventionRequired, skipped}.
//
// Distinction obligatoire, jamais mélangée (arbitrage validé) :
//   - ANOMALIE MÉTIER (ex. adminInterventionRequired non vide) : l'état
//     DB reste cohérent et voulu, la transaction committe normalement,
//     retourné à l'appelant -- ne doit JAMAIS empêcher la connexion.
//   - ÉCHEC TECHNIQUE (exception quelconque) : ROLLBACK réel, PROPAGÉ
//     par un throw -- l'appelant (routes/auth.js) doit alors fail
//     closed AVANT toute création de session, jamais un simple
//     avertissement suivi d'une session.
export async function reconcileGroupsToGrants(pool, { userId, issuer, groups }) {
  if (groups.kind === 'absent' || groups.kind === 'error') {
    // Jamais destructif, jamais additif non plus ici : sans liste
    // fiable, impossible de savoir quels mappings correspondent
    // réellement -- ne rien faire est le seul choix honnête.
    return { added: [], revoked: [], adminInterventionRequired: [], skipped: true };
  }

  const claimedGroupIds = new Set(groups.groupIds ?? []);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: matchingMappings } = await client.query(
      `select id, tenant_id, provider, issuer, external_group_id, target_type, target_id, permission_bundle
       from external_group_mappings
       where issuer = $1 and status = 'active' and external_group_id = any($2::text[])`,
      [issuer, [...claimedGroupIds]]
    );

    const added = await reconcileAdditions(client, { userId, matchingMappings });

    let revoked = [];
    let adminInterventionRequired = [];
    if (groups.kind === 'complete') {
      const result = await reconcileRevocations(client, {
        userId, issuer, claimedGroupIds,
        hasAdministrativeCapabilityRemaining, ADMINISTRATIVE_CAPABILITY,
        capabilitiesForBundle: { project: projectCapabilitiesForBundle, organization: organizationCapabilitiesForBundle }
      });
      revoked = result.revoked;
      adminInterventionRequired = result.adminInterventionRequired;
    }

    await client.query('COMMIT');
    return { added, revoked, adminInterventionRequired, skipped: false };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
