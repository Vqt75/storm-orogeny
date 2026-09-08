import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { deactivateUser, reactivateUser, anonymizeUser } from '../src/domain/identity/userLifecycle.js';
import { createSession, findActiveSessionByRawToken } from '../src/domain/identity/sessions.js';
import { ssoAuth } from '../src/http/middleware/ssoAuth.js';
import { devAuth } from '../src/http/middleware/devAuth.js';
import { resolveOrLinkIdentity } from '../src/domain/identity/linking.js';
import { AuditEventType } from '../src/domain/audit/auditEvents.js';

// Privacy & Data Lifecycle V1 — Batch 4. Lifecycle utilisateur complet
// (active -> deactivated -> anonymized), garde-fou dernier
// administrateur généralisé pour ignorer les utilisateurs non actifs,
// blocage runtime effectif (ssoAuth, callback SSO). Aucune route
// Control ajoutée -- audité, aucun endpoint members lifecycle
// n'existe encore, domaine + runtime testés directement.

const config = loadConfig();
const pool = getPool(config);
const ISSUER = 'https://fake-idp.test-privacy-batch4/issuer';

let tenant, project, otherProject, actorUserId;

async function cleanAll() {
  await pool.query("delete from project_grants where project_membership_id in (select id from project_memberships where user_id in (select id from users where email like '%@test-privacy-batch4.local' or email like 'anonymized-%@privacy.invalid'))");
  await pool.query("delete from organization_grants where organization_membership_id in (select id from tenant_memberships where user_id in (select id from users where email like '%@test-privacy-batch4.local' or email like 'anonymized-%@privacy.invalid'))");
  await pool.query("delete from auth_sessions where user_id in (select id from users where email like '%@test-privacy-batch4.local' or email like 'anonymized-%@privacy.invalid')");
  await pool.query("delete from external_identities where user_id in (select id from users where email like '%@test-privacy-batch4.local' or email like 'anonymized-%@privacy.invalid')");
  await pool.query("delete from project_invitations where email like '%@test-privacy-batch4.local'");
  await pool.query("delete from project_memberships where user_id in (select id from users where email like '%@test-privacy-batch4.local' or email like 'anonymized-%@privacy.invalid')");
  await pool.query("delete from tenant_memberships where user_id in (select id from users where email like '%@test-privacy-batch4.local' or email like 'anonymized-%@privacy.invalid')");
  await pool.query("delete from audit_events where target_type='user' and target_id in (select id from users where email like '%@test-privacy-batch4.local' or email like 'anonymized-%@privacy.invalid')");
  await pool.query("delete from users where email like '%@test-privacy-batch4.local' or email like 'anonymized-%@privacy.invalid'");
  await pool.query("delete from projects where name like 'Privacy Batch4%'");
  await pool.query("delete from tenants where name like 'Tenant Privacy Batch4%'");
}

test.before(async () => {
  await runMigrations();
  await cleanAll();
  const { rows: [t] } = await pool.query("insert into tenants (name) values ('Tenant Privacy Batch4') returning id");
  tenant = t.id;
  const { rows: [p] } = await pool.query("insert into projects (tenant_id, name, status) values ($1,'Privacy Batch4 Projet A','active') returning id", [tenant]);
  project = p.id;
  const { rows: [p2] } = await pool.query("insert into projects (tenant_id, name, status) values ($1,'Privacy Batch4 Projet B','active') returning id", [tenant]);
  otherProject = p2.id;
  const { rows: [actor] } = await pool.query("insert into users (email, display_name) values ('actor@test-privacy-batch4.local','Actor') returning id");
  actorUserId = actor.id;
});

test.after(async () => {
  await cleanAll();
  await closePool();
});

let counter = 0;
async function makeUser() {
  counter += 1;
  const { rows: [u] } = await pool.query(
    `insert into users (email, display_name) values ($1,'Test') returning id, email, display_name`,
    [`user${counter}-${Date.now()}@test-privacy-batch4.local`]
  );
  return u;
}

async function ensureTenantBridge(userId, tenantId) {
  const { rows } = await pool.query('select id from tenant_memberships where tenant_id=$1 and user_id=$2', [tenantId, userId]);
  if (rows.length > 0) return;
  await pool.query("insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1,$2,'member')", [tenantId, userId]);
}

async function grantProjectAdmin(userId, projectId) {
  await ensureTenantBridge(userId, tenant);
  const { rows: [pm] } = await pool.query(
    "insert into project_memberships (tenant_id, project_id, user_id, permission_bundle) values ($1,$2,$3,'project_admin') returning id",
    [tenant, projectId, userId]
  );
  await pool.query(
    "insert into project_grants (tenant_id, project_id, project_membership_id, permission_bundle, source_type, actor_user_id) values ($1,$2,$3,'project_admin','direct',$4)",
    [tenant, projectId, pm.id, actorUserId]
  );
  return pm.id;
}

// Bundle non-administratif -- pour les tests de mécanique de base
// (sessions/grants/audit) qui ne concernent jamais le garde-fou
// dernier-administrateur, jamais confondu avec grantProjectAdmin.
async function grantProjectContributor(userId, projectId) {
  await ensureTenantBridge(userId, tenant);
  const { rows: [pm] } = await pool.query(
    "insert into project_memberships (tenant_id, project_id, user_id, permission_bundle) values ($1,$2,$3,'contributor') returning id",
    [tenant, projectId, userId]
  );
  await pool.query(
    "insert into project_grants (tenant_id, project_id, project_membership_id, permission_bundle, source_type, actor_user_id) values ($1,$2,$3,'contributor','direct',$4)",
    [tenant, projectId, pm.id, actorUserId]
  );
  return pm.id;
}

async function grantOrganizationAdmin(userId, tenantId) {
  const { rows: [tm] } = await pool.query(
    "insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1,$2,'organization_admin') returning id",
    [tenantId, userId]
  );
  await pool.query(
    "insert into organization_grants (tenant_id, organization_membership_id, permission_bundle, source_type, actor_user_id) values ($1,$2,'organization_admin','direct',$3)",
    [tenantId, tm.id, actorUserId]
  );
  return tm.id;
}

async function makeSessionFor(userId) {
  const { rawToken } = await createSession(pool, { userId, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
  return rawToken;
}

async function getUser(userId) {
  const { rows: [u] } = await pool.query('select id, email, display_name, status, deactivated_at, anonymized_at from users where id=$1', [userId]);
  return u;
}

async function countAuditEvents(eventType, targetId) {
  const { rows } = await pool.query('select count(*)::int as n from audit_events where event_type=$1 and target_id=$2', [eventType, targetId]);
  return rows[0].n;
}

// ── Deactivate ────────────────────────────────────────────────────────

test('deactivate -- active -> deactivated, sessions révoquées, grants conservés, audit exact', async () => {
  const u = await makeUser();
  const membershipId = await grantProjectContributor(u.id, otherProject);
  const rawToken = await makeSessionFor(u.id);

  const result = await deactivateUser(pool, { userId: u.id, actorUserId });
  assert.equal(result.ok, true);

  const after = await getUser(u.id);
  assert.equal(after.status, 'deactivated');
  assert.ok(after.deactivated_at);

  const session = await findActiveSessionByRawToken(pool, rawToken);
  assert.equal(session, null, 'la session doit être révoquée');

  const { rows: [grant] } = await pool.query('select status from project_grants where project_membership_id=$1', [membershipId]);
  assert.equal(grant.status, 'active', 'les grants ne sont jamais touchés par une simple désactivation');

  const n = await countAuditEvents(AuditEventType.USER_DEACTIVATED, u.id);
  assert.equal(n, 1);
});

test('deactivate -- second appel refusé (INVALID_TRANSITION), jamais idempotent silencieux', async () => {
  const u = await makeUser();
  const first = await deactivateUser(pool, { userId: u.id, actorUserId });
  assert.equal(first.ok, true);
  const second = await deactivateUser(pool, { userId: u.id, actorUserId });
  assert.equal(second.ok, false);
  assert.equal(second.code, 'INVALID_TRANSITION');
});

test('deactivate -- anonymized -> deactivate impossible', async () => {
  const u = await makeUser();
  await deactivateUser(pool, { userId: u.id, actorUserId });
  await anonymizeUser(pool, { userId: u.id, actorUserId });
  const result = await deactivateUser(pool, { userId: u.id, actorUserId });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INVALID_TRANSITION');
});

test('deactivate -- actorUserId requis, fail fast sans mutation', async () => {
  const u = await makeUser();
  const result = await deactivateUser(pool, { userId: u.id });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ACTOR_REQUIRED');
  const after = await getUser(u.id);
  assert.equal(after.status, 'active');
});

// ── Last admin ────────────────────────────────────────────────────────

test('last-admin organisation -- dernier organization_admin -> désactivation refusée', async () => {
  const { rows: [dedicatedTenant] } = await pool.query("insert into tenants (name) values ('Tenant Privacy Batch4 LastAdmin Org') returning id");
  const u = await makeUser();
  await grantOrganizationAdmin(u.id, dedicatedTenant.id);

  const result = await deactivateUser(pool, { userId: u.id, actorUserId });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'LAST_ADMIN');
  const after = await getUser(u.id);
  assert.equal(after.status, 'active');

  await pool.query('delete from organization_grants where tenant_id=$1', [dedicatedTenant.id]);
  await pool.query('delete from tenant_memberships where tenant_id=$1', [dedicatedTenant.id]);
  await pool.query('delete from tenants where id=$1', [dedicatedTenant.id]);
});

test('last-admin organisation -- autre organization_admin actif restant -> désactivation autorisée', async () => {
  const { rows: [dedicatedTenant] } = await pool.query("insert into tenants (name) values ('Tenant Privacy Batch4 LastAdmin Org2') returning id");
  const u1 = await makeUser();
  const u2 = await makeUser();
  await grantOrganizationAdmin(u1.id, dedicatedTenant.id);
  await grantOrganizationAdmin(u2.id, dedicatedTenant.id);

  const result = await deactivateUser(pool, { userId: u1.id, actorUserId });
  assert.equal(result.ok, true, 'un autre admin actif reste -- désactivation sûre');

  await pool.query('delete from organization_grants where tenant_id=$1', [dedicatedTenant.id]);
  await pool.query('delete from tenant_memberships where tenant_id=$1', [dedicatedTenant.id]);
  await pool.query('delete from tenants where id=$1', [dedicatedTenant.id]);
});

test('last-admin organisation -- admin restant mais deactivated -- ne compte PAS comme backup', async () => {
  const { rows: [dedicatedTenant] } = await pool.query("insert into tenants (name) values ('Tenant Privacy Batch4 LastAdmin Org3') returning id");
  const u1 = await makeUser();
  const u2 = await makeUser();
  await grantOrganizationAdmin(u1.id, dedicatedTenant.id);
  await grantOrganizationAdmin(u2.id, dedicatedTenant.id);

  const deactivateU2 = await deactivateUser(pool, { userId: u2.id, actorUserId });
  assert.equal(deactivateU2.ok, true);

  const result = await deactivateUser(pool, { userId: u1.id, actorUserId });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'LAST_ADMIN', 'un admin désactivé ne doit jamais compter comme autorité de secours');

  await pool.query('delete from organization_grants where tenant_id=$1', [dedicatedTenant.id]);
  await pool.query('delete from tenant_memberships where tenant_id=$1', [dedicatedTenant.id]);
  await pool.query('delete from tenants where id=$1', [dedicatedTenant.id]);
});

test('last-admin projet -- dernier project_admin -> refusée / autre project_admin actif -> autorisée', async () => {
  const { rows: [dedicatedProject] } = await pool.query("insert into projects (tenant_id, name, status) values ($1,'Privacy Batch4 Projet LastAdmin','active') returning id", [tenant]);
  const u1 = await makeUser();
  await grantProjectAdmin(u1.id, dedicatedProject.id);

  const refused = await deactivateUser(pool, { userId: u1.id, actorUserId });
  assert.equal(refused.ok, false);
  assert.equal(refused.code, 'LAST_ADMIN');

  const u2 = await makeUser();
  await grantProjectAdmin(u2.id, dedicatedProject.id);
  const allowed = await deactivateUser(pool, { userId: u1.id, actorUserId });
  assert.equal(allowed.ok, true, 'un second project_admin actif rend la désactivation sûre');

  await pool.query('delete from project_grants where project_id=$1', [dedicatedProject.id]);
  await pool.query('delete from project_memberships where project_id=$1', [dedicatedProject.id]);
  await pool.query('delete from projects where id=$1', [dedicatedProject.id]);
});

test('self-deactivation -- aucun bypass spécial actor===target, même règle last-admin appliquée', async () => {
  const { rows: [dedicatedTenant] } = await pool.query("insert into tenants (name) values ('Tenant Privacy Batch4 Self') returning id");
  const u = await makeUser();
  await grantOrganizationAdmin(u.id, dedicatedTenant.id);

  const result = await deactivateUser(pool, { userId: u.id, actorUserId: u.id });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'LAST_ADMIN', 'se désactiver soi-même en tant que dernier admin doit être refusé identiquement');

  await pool.query('delete from organization_grants where tenant_id=$1', [dedicatedTenant.id]);
  await pool.query('delete from tenant_memberships where tenant_id=$1', [dedicatedTenant.id]);
  await pool.query('delete from tenants where id=$1', [dedicatedTenant.id]);
});

// ── Runtime ──────────────────────────────────────────────────────────

test('runtime -- session valide en DB pour un user deactivated -- ssoAuth refuse', async () => {
  const u = await makeUser();
  const rawToken = await makeSessionFor(u.id);
  await pool.query("update users set status='deactivated', deactivated_at=now() where id=$1", [u.id]);
  const found = await findActiveSessionByRawToken(pool, rawToken);
  assert.ok(found, 'la session existe bien encore, malgré le user non actif -- exactement le cas à couvrir');

  const middleware = ssoAuth({ pool, config });
  let calledNextWithError = null;
  const fakeReq = { headers: { cookie: `${config.sso.sessionCookieName}=${rawToken}` } };
  await middleware(fakeReq, {}, (err) => { calledNextWithError = err; });
  assert.ok(calledNextWithError, 'doit refuser malgré une session techniquement valide en base');
});

test('runtime -- active -- non-régression, ssoAuth authentifie normalement', async () => {
  const u = await makeUser();
  const rawToken = await makeSessionFor(u.id);
  const middleware = ssoAuth({ pool, config });
  const fakeReq = { headers: { cookie: `${config.sso.sessionCookieName}=${rawToken}` } };
  await middleware(fakeReq, {}, () => {});
  assert.equal(fakeReq.user?.id, u.id);
});

test('runtime -- callback SSO d\'une identité déjà liée mais user deactivated -- aucune nouvelle session', async () => {
  const u = await makeUser();
  await pool.query("insert into external_identities (provider_type, issuer, subject, user_id) values ('fake',$1,'sub-deactivated-callback',$2)", [ISSUER, u.id]);
  await pool.query("update users set status='deactivated', deactivated_at=now() where id=$1", [u.id]);

  const linked = await resolveOrLinkIdentity(pool, {
    providerType: 'fake', issuer: ISSUER, subject: 'sub-deactivated-callback', email: u.email, emailVerified: true, issuerTrusted: true
  });
  assert.equal(linked.ok, false);
  assert.equal(linked.code, 'USER_NOT_ACTIVE');
});

test('runtime -- callback SSO -- user anonymized -- identité déjà supprimée, aucune session, aucune re-liaison au tombstone', async () => {
  const u = await makeUser();
  await pool.query("insert into external_identities (provider_type, issuer, subject, user_id) values ('fake',$1,'sub-anonymized-callback',$2)", [ISSUER, u.id]);
  const membershipId = await grantProjectContributor(u.id, otherProject);
  await deactivateUser(pool, { userId: u.id, actorUserId });
  await anonymizeUser(pool, { userId: u.id, actorUserId });

  const linked = await resolveOrLinkIdentity(pool, {
    providerType: 'fake', issuer: ISSUER, subject: 'sub-anonymized-callback', email: u.email, emailVerified: true, issuerTrusted: true
  });
  assert.equal(linked.ok, true, 'un nouveau compte légitime peut être créé -- comportement attendu, jamais un blocage permanent de la personne réelle');
  assert.notEqual(linked.userId, u.id, 'jamais le tombstone réactivé');

  const tombstone = await getUser(u.id);
  assert.equal(tombstone.status, 'anonymized', 'le tombstone reste anonymized, jamais réactivé');

  // Aucun ancien grant/membership transféré au nouveau compte.
  const { rows: newUserMemberships } = await pool.query('select id from project_memberships where user_id=$1', [linked.userId]);
  assert.equal(newUserMemberships.length, 0, 'le nouveau compte ne doit hériter d\'aucune ancienne membership');
  const { rows: oldMembershipStillOwnedByTombstone } = await pool.query('select user_id from project_memberships where id=$1', [membershipId]);
  assert.equal(oldMembershipStillOwnedByTombstone[0].user_id, u.id, 'l\'ancienne membership reste rattachée au tombstone, jamais transférée');

  await pool.query('delete from external_identities where user_id=$1', [linked.userId]);
  await pool.query('delete from users where id=$1', [linked.userId]);
});

// ── Reactivate ───────────────────────────────────────────────────────

test('reactivate -- deactivated -> active, anciennes sessions restent révoquées, grants redeviennent utilisables', async () => {
  const u = await makeUser();
  const membershipId = await grantProjectContributor(u.id, otherProject);
  const rawToken = await makeSessionFor(u.id);
  await deactivateUser(pool, { userId: u.id, actorUserId });

  const result = await reactivateUser(pool, { userId: u.id, actorUserId });
  assert.equal(result.ok, true);

  const after = await getUser(u.id);
  assert.equal(after.status, 'active');
  assert.equal(after.deactivated_at, null, 'nullifié à la réactivation -- audit_events porte la chronologie');

  const oldSession = await findActiveSessionByRawToken(pool, rawToken);
  assert.equal(oldSession, null, 'aucune ancienne session révoquée ne redevient valide');

  const { rows: [grant] } = await pool.query('select status from project_grants where project_membership_id=$1', [membershipId]);
  assert.equal(grant.status, 'active', 'toujours actif -- redevient utilisable normalement');

  const n = await countAuditEvents(AuditEventType.USER_REACTIVATED, u.id);
  assert.equal(n, 1);
});

test('reactivate -- anonymized -> impossible', async () => {
  const u = await makeUser();
  await deactivateUser(pool, { userId: u.id, actorUserId });
  await anonymizeUser(pool, { userId: u.id, actorUserId });
  const result = await reactivateUser(pool, { userId: u.id, actorUserId });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INVALID_TRANSITION');
});

test('reactivate -- active -> refusé, rien à réactiver', async () => {
  const u = await makeUser();
  const result = await reactivateUser(pool, { userId: u.id, actorUserId });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INVALID_TRANSITION');
});

test('reactivate -- actorUserId requis, fail fast sans mutation', async () => {
  const u = await makeUser();
  await deactivateUser(pool, { userId: u.id, actorUserId });
  const before = await getUser(u.id);
  const result = await reactivateUser(pool, { userId: u.id });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ACTOR_REQUIRED');
  const after = await getUser(u.id);
  assert.equal(after.status, 'deactivated');
  assert.equal(after.deactivated_at.getTime?.() ?? after.deactivated_at, before.deactivated_at.getTime?.() ?? before.deactivated_at, 'aucune mutation');
});

// ── Anonymize ────────────────────────────────────────────────────────

test('anonymize -- uniquement depuis deactivated -- refus depuis active', async () => {
  const u = await makeUser();
  const result = await anonymizeUser(pool, { userId: u.id, actorUserId });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INVALID_TRANSITION');
});

test('anonymize -- transformation complète et correcte', async () => {
  const u = await makeUser();
  const originalEmail = u.email;
  await pool.query("insert into external_identities (provider_type, issuer, subject, user_id) values ('fake',$1,'sub-anonymize-full',$2)", [ISSUER, u.id]);
  const membershipId = await grantProjectContributor(u.id, otherProject);
  await makeSessionFor(u.id);

  const { rows: [invitation] } = await pool.query(
    `insert into project_invitations (tenant_id, project_id, email, permission_bundle, locale, invited_by_user_id, status)
     values ($1,$2,$3,'editor','fr',$4,'pending') returning id`,
    [tenant, project, originalEmail, actorUserId]
  );

  await deactivateUser(pool, { userId: u.id, actorUserId });
  const result = await anonymizeUser(pool, { userId: u.id, actorUserId });
  assert.equal(result.ok, true);

  const after = await getUser(u.id);
  assert.equal(after.status, 'anonymized');
  assert.ok(after.anonymized_at);
  assert.notEqual(after.email, originalEmail, 'ancien email absent');
  assert.ok(after.email.startsWith('anonymized-'), 'valeur synthétique attendue');
  assert.ok(after.email.endsWith('@privacy.invalid'));
  assert.equal(after.display_name, 'Anonymized user');

  const { rows: sessions } = await pool.query('select id from auth_sessions where user_id=$1', [u.id]);
  assert.equal(sessions.length, 0, 'sessions supprimées physiquement');

  const { rows: identities } = await pool.query('select id from external_identities where user_id=$1', [u.id]);
  assert.equal(identities.length, 0, 'identités externes supprimées physiquement');

  const { rows: [grant] } = await pool.query('select status from project_grants where project_membership_id=$1', [membershipId]);
  assert.equal(grant.status, 'revoked', 'grant actif révoqué, jamais hard-delete');

  const { rows: [membership] } = await pool.query('select id from project_memberships where id=$1', [membershipId]);
  assert.ok(membership, 'membership conservée (tombstone zéro-grant, doctrine V1)');

  const { rows: invitationCheck } = await pool.query('select id from project_invitations where id=$1', [invitation.id]);
  assert.equal(invitationCheck.length, 0, 'invitation correspondant à l\'ancien email supprimée physiquement');

  const { rows: [stillThere] } = await pool.query('select id from users where id=$1', [u.id]);
  assert.ok(stillThere, 'users.id conservé -- tombstone');

  const n = await countAuditEvents(AuditEventType.USER_ANONYMIZED, u.id);
  assert.equal(n, 1);
});

test('anonymize -- invitation terminale (accepted) correspondant à l\'ancien email également supprimée', async () => {
  const u = await makeUser();
  const originalEmail = u.email;
  const { rows: [invitation] } = await pool.query(
    `insert into project_invitations (tenant_id, project_id, email, permission_bundle, locale, invited_by_user_id, status, accepted_at)
     values ($1,$2,$3,'editor','fr',$4,'accepted', now()) returning id`,
    [tenant, project, originalEmail, actorUserId]
  );

  await deactivateUser(pool, { userId: u.id, actorUserId });
  await anonymizeUser(pool, { userId: u.id, actorUserId });

  const { rows } = await pool.query('select id from project_invitations where id=$1', [invitation.id]);
  assert.equal(rows.length, 0, 'terminale également supprimée -- memberships/grants/audit portent déjà la provenance');
});

test('anonymize -- users.id reste une cible FK valide (contenu historique jamais cassé)', async () => {
  const u = await makeUser();
  await deactivateUser(pool, { userId: u.id, actorUserId });
  await anonymizeUser(pool, { userId: u.id, actorUserId });

  await pool.query(
    "insert into project_grants (tenant_id, project_id, project_membership_id, permission_bundle, source_type, actor_user_id) select $1,$2,pm.id,'contributor','direct',$3 from project_memberships pm limit 0",
    [tenant, project, u.id]
  );
  assert.ok(true, 'la requête ne doit jamais lever d\'erreur de FK -- users.id reste une cible valide');
});

test('anonymize -- deuxième anonymize sans mutation (déjà anonymized)', async () => {
  const u = await makeUser();
  await deactivateUser(pool, { userId: u.id, actorUserId });
  const first = await anonymizeUser(pool, { userId: u.id, actorUserId });
  assert.equal(first.ok, true);

  const before = await getUser(u.id);
  const second = await anonymizeUser(pool, { userId: u.id, actorUserId });
  assert.equal(second.ok, false);
  assert.equal(second.code, 'INVALID_TRANSITION');
  const after = await getUser(u.id);
  assert.equal(after.email, before.email, 'aucune nouvelle mutation');
});

test('anonymize -- actorUserId requis, fail fast sans mutation', async () => {
  const u = await makeUser();
  await deactivateUser(pool, { userId: u.id, actorUserId });
  const result = await anonymizeUser(pool, { userId: u.id });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ACTOR_REQUIRED');
  const after = await getUser(u.id);
  assert.equal(after.status, 'deactivated');
});

// ── Audit failure atomicity ──────────────────────────────────────────

test('audit failure -- deactivate -- rollback complet, preuve exhaustive', async () => {
  const u = await makeUser();
  const membershipId = await grantProjectContributor(u.id, otherProject);
  const rawToken = await makeSessionFor(u.id);
  const before = await getUser(u.id);

  await pool.query('REVOKE INSERT ON audit_events FROM storm_orogeny');
  try {
    await assert.rejects(deactivateUser(pool, { userId: u.id, actorUserId }));
  } finally {
    await pool.query('GRANT INSERT ON audit_events TO storm_orogeny');
  }

  const after = await getUser(u.id);
  assert.equal(after.status, 'active', 'toujours active');
  assert.equal(after.deactivated_at, null, 'deactivated_at inchangé -- toujours null');
  assert.equal(after.deactivated_at, before.deactivated_at);

  const session = await findActiveSessionByRawToken(pool, rawToken);
  assert.ok(session, 'la session qui était active reste toujours active -- jamais révoquée');

  const { rows: [grant] } = await pool.query('select status from project_grants where project_membership_id=$1', [membershipId]);
  assert.equal(grant.status, 'active', 'grants inchangés');

  const n = await countAuditEvents(AuditEventType.USER_DEACTIVATED, u.id);
  assert.equal(n, 0, 'aucun event partiel');
});

test('audit failure -- reactivate -- rollback complet, preuve exhaustive', async () => {
  const u = await makeUser();
  await deactivateUser(pool, { userId: u.id, actorUserId });
  const before = await getUser(u.id);
  assert.ok(before.deactivated_at, 'précondition -- réellement deactivated avec un deactivated_at renseigné');

  await pool.query('REVOKE INSERT ON audit_events FROM storm_orogeny');
  try {
    await assert.rejects(reactivateUser(pool, { userId: u.id, actorUserId }));
  } finally {
    await pool.query('GRANT INSERT ON audit_events TO storm_orogeny');
  }

  const after = await getUser(u.id);
  assert.equal(after.status, 'deactivated', 'reste deactivated');
  assert.equal(
    after.deactivated_at.getTime?.() ?? after.deactivated_at,
    before.deactivated_at.getTime?.() ?? before.deactivated_at,
    'deactivated_at reste sa valeur précédente, jamais nullifié par une transaction avortée'
  );

  const n = await countAuditEvents(AuditEventType.USER_REACTIVATED, u.id);
  assert.equal(n, 0, 'aucun event partiel');
});

test('audit failure -- anonymize -- rollback complet, preuve exhaustive sur fixture complète (session, identity, invitation, grant, membership)', async () => {
  const u = await makeUser();
  const originalEmail = u.email;
  const originalDisplayName = u.display_name;

  await pool.query("insert into external_identities (provider_type, issuer, subject, user_id) values ('fake',$1,'sub-audit-fail-anon-full',$2)", [ISSUER, u.id]);
  const membershipId = await grantProjectContributor(u.id, otherProject);
  await makeSessionFor(u.id);
  const { rows: [invitation] } = await pool.query(
    `insert into project_invitations (tenant_id, project_id, email, permission_bundle, locale, invited_by_user_id, status)
     values ($1,$2,$3,'editor','fr',$4,'pending') returning id`,
    [tenant, project, originalEmail, actorUserId]
  );

  await deactivateUser(pool, { userId: u.id, actorUserId });
  // Session résiduelle créée après la désactivation, pour disposer
  // d'une session réellement active au moment précis de la tentative
  // d'anonymisation, comme demandé.
  const residualRawToken = await makeSessionFor(u.id);

  await pool.query('REVOKE INSERT ON audit_events FROM storm_orogeny');
  try {
    await assert.rejects(anonymizeUser(pool, { userId: u.id, actorUserId }));
  } finally {
    await pool.query('GRANT INSERT ON audit_events TO storm_orogeny');
  }

  const after = await getUser(u.id);
  assert.equal(after.status, 'deactivated', 'status toujours deactivated');
  assert.equal(after.anonymized_at, null, 'anonymized_at IS NULL');
  assert.equal(after.email, originalEmail, 'email original restauré/intact');
  assert.equal(after.display_name, originalDisplayName, 'display_name original intact');

  const { rows: residualSessions } = await pool.query('select id from auth_sessions where user_id=$1', [u.id]);
  assert.equal(residualSessions.length, 2, 'les deux lignes de session restent présentes -- deactivate révoque (revoked_at) mais ne supprime jamais la ligne, jamais un rollback qui en ferait disparaître une seule');
  const stillFound = await findActiveSessionByRawToken(pool, residualRawToken);
  assert.ok(stillFound, 'la session résiduelle (créée après la désactivation, jamais révoquée) reste active et utilisable');

  const { rows: identities } = await pool.query('select id from external_identities where user_id=$1', [u.id]);
  assert.equal(identities.length, 1, 'external identity toujours présente');

  const { rows: invitations } = await pool.query('select id from project_invitations where id=$1', [invitation.id]);
  assert.equal(invitations.length, 1, 'invitation toujours présente');

  const { rows: [grant] } = await pool.query('select status from project_grants where project_membership_id=$1', [membershipId]);
  assert.equal(grant.status, 'active', 'grant qui était actif l\'est toujours');

  const { rows: memberships } = await pool.query('select id from project_memberships where id=$1', [membershipId]);
  assert.equal(memberships.length, 1, 'membership intacte');

  const n = await countAuditEvents(AuditEventType.USER_ANONYMIZED, u.id);
  assert.equal(n, 0, 'aucun event user.anonymized -- l\'anonymisation est une unité atomique, pas seulement la dernière requête qui a échoué');
});

// ── devAuth status enforcement (fermeture) ───────────────────────────

test('devAuth -- user active -- fonctionne normalement', async () => {
  const u = await makeUser();
  const middleware = devAuth({ pool, config });
  const fakeReq = { header: (name) => name.toLowerCase() === 'x-storm-dev-user' ? u.id : undefined };
  await middleware(fakeReq, {}, () => {});
  assert.equal(fakeReq.user?.id, u.id);
});

test('devAuth -- user deactivated -- refusé', async () => {
  const u = await makeUser();
  await deactivateUser(pool, { userId: u.id, actorUserId });
  const middleware = devAuth({ pool, config });
  let calledNextWithError = null;
  const fakeReq = { header: (name) => name.toLowerCase() === 'x-storm-dev-user' ? u.id : undefined };
  await middleware(fakeReq, {}, (err) => { calledNextWithError = err; });
  assert.ok(calledNextWithError, 'un user deactivated ne doit jamais s\'authentifier via devAuth');
  assert.equal(fakeReq.user, undefined);
});

test('devAuth -- user anonymized -- refusé', async () => {
  const u = await makeUser();
  await deactivateUser(pool, { userId: u.id, actorUserId });
  await anonymizeUser(pool, { userId: u.id, actorUserId });
  const middleware = devAuth({ pool, config });
  let calledNextWithError = null;
  const fakeReq = { header: (name) => name.toLowerCase() === 'x-storm-dev-user' ? u.id : undefined };
  await middleware(fakeReq, {}, (err) => { calledNextWithError = err; });
  assert.ok(calledNextWithError, 'un user anonymized ne doit jamais s\'authentifier via devAuth');
});
