// Lifecycle utilisateur -- Privacy & Data Lifecycle V1, Batch 4.
//
//   active ──(deactivateUser)──> deactivated ──(anonymizeUser, irréversible)──> anonymized
//              <──(reactivateUser)──
//
// Les trois primitives sont transactionnelles, exigent actorUserId
// (action administrative humaine -- jamais un événement système),
// produisent un résultat structuré, et enregistrent leur audit event
// dans la même transaction que la mutation -- même doctrine que
// disableExternalGroupMapping (Batch 3).
//
// tenant_id/project_id volontairement absents des audit events de ce
// module : un user n'appartient pas de façon non ambiguë à une seule
// organisation dans le modèle général (même si la doctrine V1 attend
// une seule organisation Parella en pratique) -- jamais une hypothèse
// risquée gravée dans l'audit. Le scope réel de l'action reste "cet
// utilisateur", pas une organisation précise.

import { recordAuditEvent, AuditEventType } from '../audit/auditEvents.js';
import { revokeAllSessionsForUser } from './sessions.js';
import { deleteExternalIdentitiesForUser } from './repository.js';
import { hasAdministrativeCapabilityRemaining, ADMINISTRATIVE_CAPABILITY } from '../permissions/lastAdministrator.js';
import { projectCapabilitiesForBundle, organizationCapabilitiesForBundle } from '../permissions/capabilities.js';

// Repère, pour un utilisateur donné, toutes les portées (projet ou
// organisation) où il détient actuellement un grant actif portant la
// capability administrative de cette portée -- utilisé pour simuler
// sa désactivation avant de l'appliquer. Jamais une seconde définition
// de "administrateur" : réutilise exactement les mêmes constantes
// ADMINISTRATIVE_CAPABILITY que le garde-fou générique.
async function findAdministrativeScopesForUser(client, userId) {
  const scopes = [];

  const { rows: projectGrants } = await client.query(
    `select pg.id, pg.project_id, pg.permission_bundle
     from project_grants pg
     join project_memberships pm on pm.id = pg.project_membership_id
     where pm.user_id = $1 and pg.status = 'active'`,
    [userId]
  );
  const byProject = new Map();
  for (const g of projectGrants) {
    if (!projectCapabilitiesForBundle(g.permission_bundle).includes(ADMINISTRATIVE_CAPABILITY.project)) continue;
    if (!byProject.has(g.project_id)) byProject.set(g.project_id, []);
    byProject.get(g.project_id).push(g.id);
  }
  for (const [projectId, grantIds] of byProject) {
    scopes.push({ targetType: 'project', targetId: projectId, grantIds });
  }

  const { rows: orgGrants } = await client.query(
    `select og.id, og.tenant_id, og.permission_bundle
     from organization_grants og
     join tenant_memberships tm on tm.id = og.organization_membership_id
     where tm.user_id = $1 and og.status = 'active'`,
    [userId]
  );
  const byTenant = new Map();
  for (const g of orgGrants) {
    if (!organizationCapabilitiesForBundle(g.permission_bundle).includes(ADMINISTRATIVE_CAPABILITY.organization)) continue;
    if (!byTenant.has(g.tenant_id)) byTenant.set(g.tenant_id, []);
    byTenant.get(g.tenant_id).push(g.id);
  }
  for (const [tenantId, grantIds] of byTenant) {
    scopes.push({ targetType: 'organization', targetId: tenantId, grantIds });
  }

  return scopes;
}

// true si la désactivation de cet utilisateur laisserait au moins une
// portée sans plus aucune autorité administrative ACTIVE -- jamais un
// bypass spécial si actor === target, le calcul est identique quel
// que soit qui demande la désactivation.
async function wouldViolateLastAdmin(client, userId) {
  const scopes = await findAdministrativeScopesForUser(client, userId);
  for (const scope of scopes) {
    const capability = ADMINISTRATIVE_CAPABILITY[scope.targetType];
    const stillAdministrable = await hasAdministrativeCapabilityRemaining(client, {
      targetType: scope.targetType, targetId: scope.targetId, excludingGrantIds: scope.grantIds, capability
    });
    if (!stillAdministrable) return true;
  }
  return false;
}

export async function deactivateUser(pool, { userId, actorUserId }) {
  if (!actorUserId) {
    return { ok: false, code: 'ACTOR_REQUIRED' };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [user] } = await client.query('select id, status from users where id = $1 for update', [userId]);
    if (!user) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'NOT_FOUND' };
    }
    if (user.status !== 'active') {
      await client.query('ROLLBACK');
      return { ok: false, code: 'INVALID_TRANSITION' };
    }

    if (await wouldViolateLastAdmin(client, userId)) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'LAST_ADMIN' };
    }

    await client.query(
      "update users set status = 'deactivated', deactivated_at = now() where id = $1",
      [userId]
    );

    // Sessions révoquées dans la même transaction -- réutilise la
    // primitive existante (Batch 1), jamais une réimplémentation.
    await revokeAllSessionsForUser(client, userId);

    // Grants/memberships JAMAIS touchés ici -- conservés pour
    // provenance et pour une réactivation fidèle (doctrine V1).

    await recordAuditEvent(client, {
      eventType: AuditEventType.USER_DEACTIVATED,
      actorUserId,
      targetType: 'user',
      targetId: userId
    });

    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function reactivateUser(pool, { userId, actorUserId }) {
  if (!actorUserId) {
    return { ok: false, code: 'ACTOR_REQUIRED' };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [user] } = await client.query('select id, status from users where id = $1 for update', [userId]);
    if (!user) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'NOT_FOUND' };
    }
    if (user.status !== 'deactivated') {
      // Couvre à la fois 'active' (rien à réactiver) et 'anonymized'
      // (transition irréversible, jamais possible) -- même code, la
      // distinction précise n'apporte rien à l'appelant.
      await client.query('ROLLBACK');
      return { ok: false, code: 'INVALID_TRANSITION' };
    }

    // deactivated_at nullifié à la réactivation -- choix délibéré :
    // audit_events (user.deactivated/user.reactivated, avec
    // occurred_at) porte déjà la chronologie faisant foi ; laisser
    // deactivated_at renseigné sur un user redevenu 'active' serait
    // trompeur pour tout futur code lisant la ligne user directement
    // ("actuellement actif" ne devrait jamais cohabiter avec un
    // vestige "désactivé depuis X" ambigu).
    await client.query(
      "update users set status = 'active', deactivated_at = null where id = $1",
      [userId]
    );

    // Aucune session révoquée ne redevient valide -- jamais touché ici,
    // la personne doit se réauthentifier (revoked_at n'est jamais
    // remis à null). Les grants préservés lors de la désactivation
    // redeviennent utilisables normalement, sans action supplémentaire
    // (ils n'avaient jamais été révoqués).

    await recordAuditEvent(client, {
      eventType: AuditEventType.USER_REACTIVATED,
      actorUserId,
      targetType: 'user',
      targetId: userId
    });

    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function anonymizeUser(pool, { userId, actorUserId }) {
  if (!actorUserId) {
    return { ok: false, code: 'ACTOR_REQUIRED' };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [user] } = await client.query('select id, email, status from users where id = $1 for update', [userId]);
    if (!user) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'NOT_FOUND' };
    }
    if (user.status !== 'deactivated') {
      // Uniquement depuis deactivated -- jamais directement depuis
      // active (la désactivation préalable garantit déjà que le
      // dernier-admin et les sessions ont été traités ; aucune
      // seconde simulation last-admin nécessaire ici, elle serait
      // redondante).
      await client.query('ROLLBACK');
      return { ok: false, code: 'INVALID_TRANSITION' };
    }

    // Email d'origine capturé AVANT tout remplacement -- nécessaire
    // pour cibler précisément les invitations correspondantes plus
    // bas, jamais après (il n'existerait plus).
    const originalEmail = user.email;

    // Sessions supprimées PHYSIQUEMENT (jamais un simple statut) et
    // AVANT les identités externes -- ordre volontaire : la FK
    // auth_sessions.external_identity_id est en ON DELETE SET NULL,
    // jamais dépendu ici puisque les sessions n'existent déjà plus au
    // moment où les identités externes sont supprimées.
    await client.query('delete from auth_sessions where user_id = $1', [userId]);

    // Identités externes supprimées PHYSIQUEMENT -- jamais un
    // tombstone issuer/subject, jamais un hash, jamais une archive
    // email_at_linking (doctrine Batch 3 : l'audit de l'action
    // elle-même suffit).
    await deleteExternalIdentitiesForUser(client, userId);

    // Invitations portant l'ancien email -- supprimées physiquement,
    // pending et terminales confondues (memberships/grants/audit
    // portent déjà la provenance nécessaire pour les terminales ; les
    // pending n'ont plus aucune finalité pour un compte anonymisé).
    // Jamais un hash, jamais une archive, jamais une valeur
    // synthétique -- la ligne entière disparaît. Correspondance email
    // exacte, cohérente avec l'absence de normalisation déjà en
    // vigueur ailleurs dans le système (jamais une recherche dans le
    // contenu métier libre -- frontière DPO déjà arbitrée).
    await client.query('delete from project_invitations where email = $1', [originalEmail]);

    // Grants actifs révoqués (projet ET organisation), jamais un hard
    // delete -- la ligne et sa provenance restent, seul le statut
    // change. Memberships conservées telles quelles (doctrine V1
    // zéro-grant déjà validée : une membership sans grant actif reste
    // simplement sans capability, jamais un état supplémentaire à
    // gérer ici).
    await client.query(
      `update project_grants set status = 'revoked', revoked_at = now()
       where status = 'active' and project_membership_id in
         (select id from project_memberships where user_id = $1)`,
      [userId]
    );
    await client.query(
      `update organization_grants set status = 'revoked', revoked_at = now()
       where status = 'active' and organization_membership_id in
         (select id from tenant_memberships where user_id = $1)`,
      [userId]
    );

    // Tombstone synthétique -- jamais dérivé de l'ancien email/nom.
    // .invalid est un TLD volontairement non délivrable (RFC 2606).
    const syntheticEmail = `anonymized-${userId}@privacy.invalid`;
    await client.query(
      "update users set email = $1, display_name = 'Anonymized user', status = 'anonymized', anonymized_at = now() where id = $2",
      [syntheticEmail, userId]
    );

    await recordAuditEvent(client, {
      eventType: AuditEventType.USER_ANONYMIZED,
      actorUserId,
      targetType: 'user',
      targetId: userId
    });

    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
