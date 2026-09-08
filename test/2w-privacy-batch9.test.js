import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { nullifyOldEmailAtLinking, EMAIL_AT_LINKING_RETENTION_DAYS } from '../src/domain/privacy/externalIdentityRetention.js';
import { runRetentionPolicies } from '../src/domain/privacy/retentionRunner.js';
import { resolveOrLinkIdentity } from '../src/domain/identity/linking.js';
import { findExternalIdentityByIssuerSubject } from '../src/domain/identity/repository.js';
import { createSession, findActiveSessionByRawToken } from '../src/domain/identity/sessions.js';
import { deactivateUser, anonymizeUser } from '../src/domain/identity/userLifecycle.js';

// Privacy & Data Lifecycle V1 — Batch 9. Nullification déterministe de
// external_identities.email_at_linking, 90 jours après created_at
// (première création du lien, jamais remis à zéro à la reconnexion).
// Jamais la ligne elle-même, jamais issuer/subject/user_id/status.

const config = loadConfig();
const pool = getPool(config);
const silentLogger = { info() {}, warn() {}, error() {} };

let tenant, actorUserId;
const DAY_MS = 24 * 60 * 60 * 1000;
const ISSUER = 'https://fake-idp.test-privacy-batch9/issuer';

async function cleanAll() {
  await pool.query("delete from external_identities where user_id in (select id from users where email like '%@test-privacy-batch9.local' or email like 'anonymized-%@privacy.invalid')");
  await pool.query("delete from auth_sessions where user_id in (select id from users where email like '%@test-privacy-batch9.local')");
  await pool.query("delete from project_grants where project_membership_id in (select id from project_memberships where user_id in (select id from users where email like '%@test-privacy-batch9.local'))");
  await pool.query("delete from project_memberships where user_id in (select id from users where email like '%@test-privacy-batch9.local')");
  await pool.query("delete from organization_grants where organization_membership_id in (select id from tenant_memberships where user_id in (select id from users where email like '%@test-privacy-batch9.local'))");
  await pool.query("delete from tenant_memberships where user_id in (select id from users where email like '%@test-privacy-batch9.local')");
  await pool.query("delete from project_invitations where email like '%@test-privacy-batch9.local'");
  await pool.query("delete from users where email like '%@test-privacy-batch9.local' or email like 'anonymized-%@privacy.invalid'");
  await pool.query("delete from projects where name like 'Privacy Batch9%'");
  await pool.query("delete from tenants where name like 'Tenant Privacy Batch9%'");
}

test.before(async () => {
  await runMigrations();
  await cleanAll();
  const { rows: [t] } = await pool.query("insert into tenants (name) values ('Tenant Privacy Batch9') returning id");
  tenant = t.id;
  const { rows: [actor] } = await pool.query("insert into users (email, display_name) values ('actor@test-privacy-batch9.local','Actor') returning id");
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
    `insert into users (email, display_name) values ($1,'Test') returning id, email`,
    [`user${counter}-${Date.now()}@test-privacy-batch9.local`]
  );
  return u;
}

async function makeIdentity({ userId, subject, createdAt, emailAtLinking = 'lien@test-privacy-batch9.local' }) {
  const { rows: [row] } = await pool.query(
    `insert into external_identities (provider_type, issuer, subject, user_id, email_at_linking, created_at)
     values ('fake',$1,$2,$3,$4,$5) returning id`,
    [ISSUER, subject, userId, emailAtLinking, createdAt]
  );
  return row.id;
}

async function getIdentity(id) {
  const { rows: [row] } = await pool.query('select * from external_identities where id=$1', [id]);
  return row;
}

// ── Nullification ────────────────────────────────────────────────────

test('older than 90 days -- email_at_linking devient null, ligne survit', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const u = await makeUser();
  const id = await makeIdentity({ userId: u.id, subject: 'sub-old', createdAt: new Date(now.getTime() - 100 * DAY_MS) });

  await nullifyOldEmailAtLinking(pool, { now });

  const row = await getIdentity(id);
  assert.ok(row, 'la ligne doit survivre');
  assert.equal(row.email_at_linking, null);
  assert.equal(row.issuer, ISSUER, 'issuer jamais modifié');
  assert.equal(row.subject, 'sub-old', 'subject jamais modifié');
  assert.equal(row.user_id, u.id, 'user_id jamais modifié');
  assert.equal(row.status, 'active', 'status jamais modifié');
});

test('exactly cutoff -- email conservé (strictement plus vieux requis)', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const u = await makeUser();
  const createdAt = new Date(now.getTime() - EMAIL_AT_LINKING_RETENTION_DAYS * DAY_MS);
  const id = await makeIdentity({ userId: u.id, subject: 'sub-exact', createdAt });

  await nullifyOldEmailAtLinking(pool, { now });

  const row = await getIdentity(id);
  assert.notEqual(row.email_at_linking, null, 'exactement au cutoff -- jamais nullifié');
});

test('just inside retention -- 89 jours 23h -- conservé', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const u = await makeUser();
  const createdAt = new Date(now.getTime() - (89 * DAY_MS + 23 * 60 * 60 * 1000));
  const id = await makeIdentity({ userId: u.id, subject: 'sub-just-inside', createdAt });

  await nullifyOldEmailAtLinking(pool, { now });

  const row = await getIdentity(id);
  assert.notEqual(row.email_at_linking, null);
});

test('already null -- aucun changement', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const u = await makeUser();
  const id = await makeIdentity({ userId: u.id, subject: 'sub-already-null', createdAt: new Date(now.getTime() - 200 * DAY_MS), emailAtLinking: null });

  const purged = await nullifyOldEmailAtLinking(pool, { now });

  const row = await getIdentity(id);
  assert.equal(row.email_at_linking, null);
});

test('multiple identities -- uniquement les rows éligibles sont nullifiées', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const u1 = await makeUser();
  const u2 = await makeUser();
  const oldId = await makeIdentity({ userId: u1.id, subject: 'sub-multi-old', createdAt: new Date(now.getTime() - 100 * DAY_MS) });
  const recentId = await makeIdentity({ userId: u2.id, subject: 'sub-multi-recent', createdAt: new Date(now.getTime() - 5 * DAY_MS) });

  await nullifyOldEmailAtLinking(pool, { now });

  const oldRow = await getIdentity(oldId);
  const recentRow = await getIdentity(recentId);
  assert.equal(oldRow.email_at_linking, null);
  assert.notEqual(recentRow.email_at_linking, null);
});

test('active ET revoked -- la policy s\'applique aux deux statuts (aucune raison de conserver plus longtemps une identité révoquée)', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const u1 = await makeUser();
  const u2 = await makeUser();
  const activeId = await makeIdentity({ userId: u1.id, subject: 'sub-active-old', createdAt: new Date(now.getTime() - 100 * DAY_MS) });
  const revokedId = await makeIdentity({ userId: u2.id, subject: 'sub-revoked-old', createdAt: new Date(now.getTime() - 100 * DAY_MS) });
  await pool.query("update external_identities set status='revoked', revoked_at=now() where id=$1", [revokedId]);

  await nullifyOldEmailAtLinking(pool, { now });

  const activeRow = await getIdentity(activeId);
  const revokedRow = await getIdentity(revokedId);
  assert.equal(activeRow.email_at_linking, null, 'active -- nullifié');
  assert.equal(revokedRow.email_at_linking, null, 'revoked -- nullifié également, aucun filtre par statut');
});

// ── Idempotence ──────────────────────────────────────────────────────

test('idempotence -- second passage zéro nouvelle nullification', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const u = await makeUser();
  await makeIdentity({ userId: u.id, subject: 'sub-idem', createdAt: new Date(now.getTime() - 100 * DAY_MS) });

  const first = await nullifyOldEmailAtLinking(pool, { now });
  const second = await nullifyOldEmailAtLinking(pool, { now });
  assert.ok(first >= 1);
  assert.equal(second, 0);
});

// ── Runner ────────────────────────────────────────────────────────────

test('runner -- résultat structuré inclut externalIdentities, autres policies inchangées', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const result = await runRetentionPolicies(pool, { now, logger: silentLogger });
  assert.ok('sessions' in result);
  assert.ok('invitations' in result);
  assert.ok('auditEvents' in result);
  assert.ok('pilotage' in result);
  assert.ok('externalIdentities' in result);
  assert.ok('emailsNullified' in result.externalIdentities);
});

test('isolation -- échec de la policy external_identities -- rollback de cette policy, autres policies inchangées', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const u = await makeUser();
  const id = await makeIdentity({ userId: u.id, subject: 'sub-fail-isolation', createdAt: new Date(now.getTime() - 100 * DAY_MS) });

  await pool.query('REVOKE UPDATE ON external_identities FROM storm_orogeny');
  try {
    await assert.rejects(runRetentionPolicies(pool, { now, logger: silentLogger }));
  } finally {
    await pool.query('GRANT UPDATE ON external_identities TO storm_orogeny');
  }

  const row = await getIdentity(id);
  assert.notEqual(row.email_at_linking, null, 'rollback complet -- rien nullifié malgré l\'échec');
});

// ── Sécurité / AuthN non-régression ──────────────────────────────────

test('AuthN -- identité nullifiée reste retrouvable par (issuer,subject), résout le même user, session s\'ouvre normalement', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const u = await makeUser();
  const subject = 'sub-authn-check';
  await makeIdentity({ userId: u.id, subject, createdAt: new Date(now.getTime() - 100 * DAY_MS) });

  await nullifyOldEmailAtLinking(pool, { now });

  const found = await findExternalIdentityByIssuerSubject(pool, { issuer: ISSUER, subject });
  assert.ok(found, 'toujours retrouvable par (issuer,subject)');
  assert.equal(found.user_id, u.id, 'résout le même user');
  assert.equal(found.email_at_linking, null);

  const linked = await resolveOrLinkIdentity(pool, {
    providerType: 'fake', issuer: ISSUER, subject, email: u.email, emailVerified: true, issuerTrusted: true
  });
  assert.equal(linked.ok, true);
  assert.equal(linked.userId, u.id, 'callback SSO résout toujours le même user après nullification');

  const { rawToken } = await createSession(pool, { userId: u.id, expiresAt: new Date(Date.now() + DAY_MS) });
  const session = await findActiveSessionByRawToken(pool, rawToken);
  assert.ok(session, 'une session peut toujours s\'ouvrir normalement');
});

// ── Authorization non-régression ─────────────────────────────────────

test('Authorization -- aucun grant/membership modifié par la nullification', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const u = await makeUser();
  await makeIdentity({ userId: u.id, subject: 'sub-authz-check', createdAt: new Date(now.getTime() - 100 * DAY_MS) });

  const { rows: [tm] } = await pool.query(
    "insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1,$2,'member') returning id",
    [tenant, u.id]
  );
  await pool.query(
    "insert into organization_grants (tenant_id, organization_membership_id, permission_bundle, source_type, actor_user_id) values ($1,$2,'member','direct',$3)",
    [tenant, tm.id, actorUserId]
  );

  const before = await pool.query('select status, permission_bundle from organization_grants where organization_membership_id=$1', [tm.id]);

  await nullifyOldEmailAtLinking(pool, { now });

  const after = await pool.query('select status, permission_bundle from organization_grants where organization_membership_id=$1', [tm.id]);
  assert.deepEqual(after.rows, before.rows, 'aucun grant modifié par cette policy');
});

// ── Invitation bridge non-régression ─────────────────────────────────

test('invitation bridge -- nullification n\'autorise jamais un re-claim ni un relinking opportuniste', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const u = await makeUser();
  const subject = 'sub-bridge-check';
  await makeIdentity({ userId: u.id, subject, createdAt: new Date(now.getTime() - 100 * DAY_MS) });
  await nullifyOldEmailAtLinking(pool, { now });

  // Une invitation pending pour l'email de cet utilisateur, créée
  // APRÈS la nullification -- la nullification ne doit jamais changer
  // le comportement du pont invitation, qui reste conditionné à une
  // identité RÉELLEMENT nouvelle (jamais celle-ci, déjà liée).
  const { rows: [project] } = await pool.query(
    "insert into projects (tenant_id, name, status) values ($1,'Privacy Batch9 Projet Bridge','active') returning id", [tenant]
  );
  await pool.query(
    `insert into project_invitations (tenant_id, project_id, email, permission_bundle, locale, invited_by_user_id, status)
     values ($1,$2,$3,'editor','fr',$4,'pending')`,
    [tenant, project.id, u.email, actorUserId]
  );

  // Reconnexion via la MÊME identité (issuer,subject) déjà liée --
  // chemin "déjà liée", ne scanne jamais les invitations (doctrine
  // déjà en vigueur, jamais changée par ce batch).
  const linked = await resolveOrLinkIdentity(pool, {
    providerType: 'fake', issuer: ISSUER, subject, email: u.email, emailVerified: true, issuerTrusted: true
  });
  assert.equal(linked.ok, true);
  assert.equal(linked.userId, u.id);

  const { rows: [invitation] } = await pool.query('select status from project_invitations where tenant_id=$1 and project_id=$2', [tenant, project.id]);
  assert.equal(invitation.status, 'pending', 'l\'invitation ne doit jamais être réclamée via ce chemin -- identité déjà liée, jamais un nouveau linking');

  await pool.query('delete from project_invitations where project_id=$1', [project.id]);
  await pool.query('delete from projects where id=$1', [project.id]);
});

// ── Anonymisation non-régression ─────────────────────────────────────

test('anonymisation -- policy 90j peut nullifier avant anonymisation, aucun conflit, la ligne est ensuite supprimée normalement', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const u = await makeUser();
  const identityId = await makeIdentity({ userId: u.id, subject: 'sub-anon-check', createdAt: new Date(now.getTime() - 100 * DAY_MS) });

  await nullifyOldEmailAtLinking(pool, { now });
  const nullified = await getIdentity(identityId);
  assert.equal(nullified.email_at_linking, null, 'précondition -- déjà nullifiée avant anonymisation');

  const deactivated = await deactivateUser(pool, { userId: u.id, actorUserId });
  assert.equal(deactivated.ok, true);
  const anonymized = await anonymizeUser(pool, { userId: u.id, actorUserId });
  assert.equal(anonymized.ok, true, 'aucun conflit -- anonymisation réussit normalement après nullification préalable');

  const { rows } = await pool.query('select id from external_identities where id=$1', [identityId]);
  assert.equal(rows.length, 0, 'la ligne est supprimée physiquement par anonymisation, comme toujours');
});

// ── Publications explicitement non touchées ──────────────────────────

test('PUBLICATIONS -- ce batch ne touche jamais project_publications', async () => {
  const { rows: before } = await pool.query('select count(*)::int as n from project_publications');
  await nullifyOldEmailAtLinking(pool, { now: new Date('2026-06-15T12:00:00Z') });
  const { rows: after } = await pool.query('select count(*)::int as n from project_publications');
  assert.equal(after[0].n, before[0].n, 'aucun effet de bord sur project_publications');
});

// ── Aucune donnée sensible loguée ────────────────────────────────────

test('logging -- aucun ancien email/issuer/subject/user id/identity id loggé', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const u = await makeUser();
  const secretEmail = `secret-jamais-loggue-${Date.now()}@test-privacy-batch9.local`;
  await makeIdentity({ userId: u.id, subject: 'sub-log-check', createdAt: new Date(now.getTime() - 100 * DAY_MS), emailAtLinking: secretEmail });

  const captured = [];
  const capturingLogger = {
    info: (p, m) => captured.push([p, m]),
    warn: (p, m) => captured.push([p, m]),
    error: (p, m) => captured.push([p, m])
  };
  await runRetentionPolicies(pool, { now, logger: capturingLogger });

  const serialized = JSON.stringify(captured);
  assert.ok(!serialized.includes(secretEmail), 'aucun email ne doit jamais apparaître dans les logs');
  assert.ok(!serialized.includes(ISSUER), 'aucun issuer ne doit jamais apparaître dans les logs');
  assert.ok(!serialized.includes('sub-log-check'), 'aucun subject ne doit jamais apparaître dans les logs');
  assert.ok(!serialized.includes(u.id), 'aucun user id ne doit jamais apparaître dans les logs');
});
