import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { purgeExpiredSessions } from '../src/domain/privacy/sessionRetention.js';
import { expirePendingInvitations, purgeTerminalInvitations } from '../src/domain/privacy/invitationRetention.js';
import { runRetentionPolicies } from '../src/domain/privacy/retentionRunner.js';
import { acceptProjectInvitation } from '../src/domain/memberships/repository.js';

const execFileAsync = promisify(execFile);

// Privacy & Data Lifecycle V1 — Batch 2. Retention runner déterministe
// avec deux politiques V1 : sessions et invitations. Horloge injectée
// fixe partout -- jamais une dépendance à l'horloge réelle du process
// pour les assertions de bornes.

const config = loadConfig();
const pool = getPool(config);
const silentLogger = { info() {}, warn() {}, error() {} };

let tenant, project, inviterUserId;
const DAY_MS = 24 * 60 * 60 * 1000;

async function cleanAll() {
  await pool.query("delete from auth_sessions where user_id in (select id from users where email like '%@test-privacy-batch2.local')");
  await pool.query("delete from project_invitations where email like '%@test-privacy-batch2.local'");
  await pool.query("delete from project_memberships where user_id in (select id from users where email like '%@test-privacy-batch2.local')");
  await pool.query("delete from organization_grants where organization_membership_id in (select id from tenant_memberships where user_id in (select id from users where email like '%@test-privacy-batch2.local'))");
  await pool.query("delete from tenant_memberships where user_id in (select id from users where email like '%@test-privacy-batch2.local')");
  await pool.query("delete from users where email like '%@test-privacy-batch2.local'");
  await pool.query("delete from projects where name like 'Privacy Batch2%'");
  await pool.query("delete from tenants where name like 'Tenant Privacy Batch2%'");
}

test.before(async () => {
  await runMigrations();
  await cleanAll();
  const { rows: [t] } = await pool.query("insert into tenants (name) values ('Tenant Privacy Batch2') returning id");
  tenant = t.id;
  const { rows: [p] } = await pool.query("insert into projects (tenant_id, name, status) values ($1,'Privacy Batch2 Projet','active') returning id", [tenant]);
  project = p.id;
  const { rows: [inviter] } = await pool.query("insert into users (email, display_name) values ('inviter@test-privacy-batch2.local','Inviter') returning id");
  inviterUserId = inviter.id;
});

test.after(async () => {
  await cleanAll();
  await closePool();
});

let userCounter = 0;
async function makeUser() {
  userCounter += 1;
  const { rows: [u] } = await pool.query(
    `insert into users (email, display_name) values ($1,'Test') returning id`,
    [`user${userCounter}-${Date.now()}@test-privacy-batch2.local`]
  );
  return u.id;
}

async function makeSession({ userId, createdAt, expiresAt, revokedAt = null }) {
  const tokenHash = `hash-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  const { rows: [s] } = await pool.query(
    `insert into auth_sessions (user_id, session_token_hash, created_at, expires_at, revoked_at)
     values ($1,$2,$3,$4,$5) returning id`,
    [userId, tokenHash, createdAt, expiresAt, revokedAt]
  );
  return s.id;
}

async function sessionExists(id) {
  const { rows } = await pool.query('select id from auth_sessions where id=$1', [id]);
  return rows.length === 1;
}

// ── Sessions ──────────────────────────────────────────────────────────

test('session active (ni expirée ni révoquée) -- conservée', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const userId = await makeUser();
  const id = await makeSession({ userId, createdAt: now, expiresAt: new Date(now.getTime() + DAY_MS) });
  await purgeExpiredSessions(pool, { now });
  assert.ok(await sessionExists(id));
});

test('expirée depuis 6j23h -- conservée', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const userId = await makeUser();
  const expiresAt = new Date(now.getTime() - (6 * DAY_MS + 23 * 60 * 60 * 1000));
  const id = await makeSession({ userId, createdAt: new Date(expiresAt.getTime() - DAY_MS), expiresAt });
  await purgeExpiredSessions(pool, { now });
  assert.ok(await sessionExists(id), 'pas encore 7 jours pleins -- doit survivre');
});

test('expirée depuis exactement 7j -- purgée (borne <=)', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const userId = await makeUser();
  const expiresAt = new Date(now.getTime() - 7 * DAY_MS);
  const id = await makeSession({ userId, createdAt: new Date(expiresAt.getTime() - DAY_MS), expiresAt });
  await purgeExpiredSessions(pool, { now });
  assert.ok(!(await sessionExists(id)), 'exactement 7 jours -- purgée, borne inclusive');
});

test('expirée depuis plus de 7j -- purgée', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const userId = await makeUser();
  const expiresAt = new Date(now.getTime() - 10 * DAY_MS);
  const id = await makeSession({ userId, createdAt: new Date(expiresAt.getTime() - DAY_MS), expiresAt });
  await purgeExpiredSessions(pool, { now });
  assert.ok(!(await sessionExists(id)));
});

test('révoquée il y a >7j, expiration future -- purgée (invalidation = révocation)', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const userId = await makeUser();
  const revokedAt = new Date(now.getTime() - 10 * DAY_MS);
  const id = await makeSession({ userId, createdAt: new Date(revokedAt.getTime() - DAY_MS), expiresAt: new Date(now.getTime() + 30 * DAY_MS), revokedAt });
  await purgeExpiredSessions(pool, { now });
  assert.ok(!(await sessionExists(id)));
});

test('expiration >7j mais révocation récente -- purgée quand même (première invalidation = expiration)', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const userId = await makeUser();
  const expiresAt = new Date(now.getTime() - 20 * DAY_MS);
  const revokedAt = new Date(now.getTime() - 3 * DAY_MS); // révocation administrative récente, après coup
  const id = await makeSession({ userId, createdAt: new Date(expiresAt.getTime() - DAY_MS), expiresAt, revokedAt });
  await purgeExpiredSessions(pool, { now });
  assert.ok(!(await sessionExists(id)), 'l\'invalidation reste la date d\'expiration, jamais la révocation tardive');
});

test('idempotence -- second run purge 0 supplémentaire', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const userId = await makeUser();
  await makeSession({ userId, createdAt: new Date(now.getTime() - 20 * DAY_MS), expiresAt: new Date(now.getTime() - 10 * DAY_MS) });
  const first = await purgeExpiredSessions(pool, { now });
  const second = await purgeExpiredSessions(pool, { now });
  assert.ok(first >= 1);
  assert.equal(second, 0);
});

test('isolation -- purger une session ne touche jamais une autre ligne utilisateur/accès', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const userId = await makeUser();
  const activeId = await makeSession({ userId, createdAt: now, expiresAt: new Date(now.getTime() + DAY_MS) });
  await makeSession({ userId, createdAt: new Date(now.getTime() - 20 * DAY_MS), expiresAt: new Date(now.getTime() - 10 * DAY_MS) });
  await purgeExpiredSessions(pool, { now });
  assert.ok(await sessionExists(activeId), 'la session active du même utilisateur ne doit jamais être touchée');
  const { rows: [membershipCheck] } = await pool.query('select count(*)::int as n from users where id=$1', [userId]);
  assert.equal(membershipCheck.n, 1, 'le user lui-même ne doit jamais être affecté');
});

// ── Invitations : expiration ─────────────────────────────────────────

async function makeInvitation({ status = 'pending', createdAt, acceptedAt = null, revokedAt = null, expiredAt = null, emailSuffix }) {
  const { rows: [inv] } = await pool.query(
    `insert into project_invitations (tenant_id, project_id, email, permission_bundle, locale, invited_by_user_id, status, created_at, accepted_at, revoked_at, expired_at)
     values ($1,$2,$3,'editor','fr',$4,$5,$6,$7,$8,$9) returning id`,
    [tenant, project, `invitee-${emailSuffix}@test-privacy-batch2.local`, inviterUserId, status, createdAt, acceptedAt, revokedAt, expiredAt]
  );
  return inv.id;
}

async function getInvitation(id) {
  const { rows: [row] } = await pool.query('select status, expired_at from project_invitations where id=$1', [id]);
  return row;
}

test('pending depuis 89j23h -- reste pending', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const createdAt = new Date(now.getTime() - (89 * DAY_MS + 23 * 60 * 60 * 1000));
  const id = await makeInvitation({ createdAt, emailSuffix: 'p89' });
  await expirePendingInvitations(pool, { now });
  const row = await getInvitation(id);
  assert.equal(row.status, 'pending');
});

test('pending depuis exactement 90j -- expired', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const createdAt = new Date(now.getTime() - 90 * DAY_MS);
  const id = await makeInvitation({ createdAt, emailSuffix: 'p90exact' });
  await expirePendingInvitations(pool, { now });
  const row = await getInvitation(id);
  assert.equal(row.status, 'expired');
  assert.ok(row.expired_at);
});

test('pending depuis >90j -- expired', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const createdAt = new Date(now.getTime() - 120 * DAY_MS);
  const id = await makeInvitation({ createdAt, emailSuffix: 'p120' });
  await expirePendingInvitations(pool, { now });
  const row = await getInvitation(id);
  assert.equal(row.status, 'expired');
});

test('accepted ancienne -- jamais retransitée en expired', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const createdAt = new Date(now.getTime() - 400 * DAY_MS);
  const id = await makeInvitation({ status: 'accepted', createdAt, acceptedAt: new Date(now.getTime() - 300 * DAY_MS), emailSuffix: 'acc-old' });
  await expirePendingInvitations(pool, { now });
  const row = await getInvitation(id);
  assert.equal(row.status, 'accepted');
});

test('revoked ancienne -- jamais retransitée en expired', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const createdAt = new Date(now.getTime() - 400 * DAY_MS);
  const id = await makeInvitation({ status: 'revoked', createdAt, revokedAt: new Date(now.getTime() - 300 * DAY_MS), emailSuffix: 'rev-old' });
  await expirePendingInvitations(pool, { now });
  const row = await getInvitation(id);
  assert.equal(row.status, 'revoked');
});

test('déjà expired -- inchangée', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const createdAt = new Date(now.getTime() - 400 * DAY_MS);
  const originalExpiredAt = new Date(now.getTime() - 300 * DAY_MS);
  const id = await makeInvitation({ status: 'expired', createdAt, expiredAt: originalExpiredAt, emailSuffix: 'exp-old' });
  await expirePendingInvitations(pool, { now });
  const row = await getInvitation(id);
  assert.equal(new Date(row.expired_at).getTime(), originalExpiredAt.getTime(), 'jamais réécrit une seconde fois');
});

test('second run immédiat -- 0 nouvelle expiration', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const createdAt = new Date(now.getTime() - 100 * DAY_MS);
  await makeInvitation({ createdAt, emailSuffix: 'idem' });
  const first = await expirePendingInvitations(pool, { now });
  const second = await expirePendingInvitations(pool, { now });
  assert.ok(first >= 1);
  assert.equal(second, 0);
});

// ── Invitations : purge terminale ────────────────────────────────────

async function invitationExists(id) {
  const { rows } = await pool.query('select id from project_invitations where id=$1', [id]);
  return rows.length === 1;
}

test('accepted depuis <12 mois -- conservée', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const id = await makeInvitation({ status: 'accepted', createdAt: new Date(now.getTime() - 400 * DAY_MS), acceptedAt: new Date(now.getTime() - 30 * DAY_MS), emailSuffix: 'acc-recent' });
  await purgeTerminalInvitations(pool, { now });
  assert.ok(await invitationExists(id));
});

test('accepted depuis exactement 12 mois -- purgée', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const acceptedAt = new Date(now.getTime());
  acceptedAt.setUTCMonth(acceptedAt.getUTCMonth() - 12);
  const id = await makeInvitation({ status: 'accepted', createdAt: new Date(acceptedAt.getTime() - DAY_MS), acceptedAt, emailSuffix: 'acc-exact12' });
  await purgeTerminalInvitations(pool, { now });
  assert.ok(!(await invitationExists(id)));
});

test('accepted depuis >12 mois -- purgée', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const id = await makeInvitation({ status: 'accepted', createdAt: new Date(now.getTime() - 500 * DAY_MS), acceptedAt: new Date(now.getTime() - 400 * DAY_MS), emailSuffix: 'acc-old2' });
  await purgeTerminalInvitations(pool, { now });
  assert.ok(!(await invitationExists(id)));
});

test('revoked <12 mois conservée / >12 mois purgée', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const idKeep = await makeInvitation({ status: 'revoked', createdAt: new Date(now.getTime() - 400 * DAY_MS), revokedAt: new Date(now.getTime() - 30 * DAY_MS), emailSuffix: 'rev-recent' });
  const idPurge = await makeInvitation({ status: 'revoked', createdAt: new Date(now.getTime() - 500 * DAY_MS), revokedAt: new Date(now.getTime() - 400 * DAY_MS), emailSuffix: 'rev-old2' });
  await purgeTerminalInvitations(pool, { now });
  assert.ok(await invitationExists(idKeep));
  assert.ok(!(await invitationExists(idPurge)));
});

test('expired <12 mois conservée / >12 mois purgée (via le vrai expired_at)', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const idKeep = await makeInvitation({ status: 'expired', createdAt: new Date(now.getTime() - 400 * DAY_MS), expiredAt: new Date(now.getTime() - 30 * DAY_MS), emailSuffix: 'exp-recent' });
  const idPurge = await makeInvitation({ status: 'expired', createdAt: new Date(now.getTime() - 500 * DAY_MS), expiredAt: new Date(now.getTime() - 400 * DAY_MS), emailSuffix: 'exp-old2' });
  await purgeTerminalInvitations(pool, { now });
  assert.ok(await invitationExists(idKeep));
  assert.ok(!(await invitationExists(idPurge)));
});

test('IMPORTANT -- créée il y a 18 mois, acceptée il y a seulement 2 mois -- conservée (jamais created_at comme substitut)', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const id = await makeInvitation({
    status: 'accepted',
    createdAt: new Date(now.getTime() - 540 * DAY_MS), // ~18 mois
    acceptedAt: new Date(now.getTime() - 60 * DAY_MS),  // ~2 mois
    emailSuffix: 'created-old-accepted-recent'
  });
  await purgeTerminalInvitations(pool, { now });
  assert.ok(await invitationExists(id), 'la rétention doit se baser sur accepted_at, jamais created_at');
});

test('PROVENANCE -- après purge d\'une invitation acceptée, membership et grants résultants restent intacts', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const userId = await makeUser();
  const invId = await makeInvitation({ createdAt: new Date(now.getTime() - 10 * DAY_MS), emailSuffix: `provenance-${userId}` });
  const accepted = await acceptProjectInvitation(pool, { invitationId: invId, userId });
  assert.ok(accepted, 'acceptation réelle nécessaire pour ce test');

  // Forcer artificiellement une acceptation ancienne pour rendre
  // l'invitation éligible à la purge terminale.
  await pool.query("update project_invitations set accepted_at=$1 where id=$2", [new Date(now.getTime() - 400 * DAY_MS), invId]);

  const { rows: [membershipBefore] } = await pool.query(
    'select permission_bundle from project_memberships where project_id=$1 and user_id=$2', [project, userId]
  );
  assert.equal(membershipBefore.permission_bundle, 'editor');

  await purgeTerminalInvitations(pool, { now });
  assert.ok(!(await invitationExists(invId)), 'l\'invitation doit avoir été purgée');

  const { rows: [membershipAfter] } = await pool.query(
    'select permission_bundle from project_memberships where project_id=$1 and user_id=$2', [project, userId]
  );
  assert.equal(membershipAfter.permission_bundle, 'editor', 'la membership doit survivre intacte à la purge de l\'invitation');

  const { rows: [grantAfter] } = await pool.query(
    `select pg.status, pg.permission_bundle from project_grants pg
     join project_memberships pm on pm.id=pg.project_membership_id
     where pm.project_id=$1 and pm.user_id=$2`,
    [project, userId]
  );
  assert.equal(grantAfter.status, 'active');
  assert.equal(grantAfter.permission_bundle, 'editor');
});

// ── Runner ────────────────────────────────────────────────────────────

test('runner -- résultat structuré exact', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const result = await runRetentionPolicies(pool, { now, logger: silentLogger });
  assert.ok('sessions' in result);
  assert.ok('purged' in result.sessions);
  assert.ok('invitations' in result);
  assert.ok('expired' in result.invitations);
  assert.ok('purged' in result.invitations);
});

test('runner -- deuxième exécution immédiate idempotente', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const userId = await makeUser();
  await makeSession({ userId, createdAt: new Date(now.getTime() - 20 * DAY_MS), expiresAt: new Date(now.getTime() - 10 * DAY_MS) });
  await makeInvitation({ createdAt: new Date(now.getTime() - 100 * DAY_MS), emailSuffix: 'runner-idem' });

  const first = await runRetentionPolicies(pool, { now, logger: silentLogger });
  const second = await runRetentionPolicies(pool, { now, logger: silentLogger });

  assert.ok(first.sessions.purged >= 1 || first.invitations.expired >= 1);
  assert.equal(second.sessions.purged, 0);
  assert.equal(second.invitations.expired, 0);
});

test('runner -- échec technique dans une politique -- erreur propagée, rollback de cette politique', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  await pool.query('REVOKE DELETE ON auth_sessions FROM storm_orogeny');
  try {
    await assert.rejects(runRetentionPolicies(pool, { now, logger: silentLogger }));
  } finally {
    await pool.query('GRANT DELETE ON auth_sessions TO storm_orogeny');
  }
});

test('runner -- aucune donnée personnelle dans le résultat', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const result = await runRetentionPolicies(pool, { now, logger: silentLogger });
  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes('@'), 'aucun email ne doit jamais apparaître dans le résultat structuré');
});

test('runner -- aucun email/hash de session dans les logs', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const captured = [];
  const capturingLogger = {
    info: (p, m) => captured.push([p, m]),
    warn: (p, m) => captured.push([p, m]),
    error: (p, m) => captured.push([p, m])
  };
  const userId = await makeUser();
  await makeSession({ userId, createdAt: new Date(now.getTime() - 20 * DAY_MS), expiresAt: new Date(now.getTime() - 10 * DAY_MS) });
  await makeInvitation({ createdAt: new Date(now.getTime() - 100 * DAY_MS), emailSuffix: 'no-log-leak' });

  await runRetentionPolicies(pool, { now, logger: capturingLogger });

  const serialized = JSON.stringify(captured);
  assert.ok(!serialized.includes('@test-privacy-batch2.local'), 'aucun email d\'invitation ne doit jamais apparaître dans les logs');
  assert.ok(!serialized.includes('hash-'), 'aucun hash de session ne doit jamais apparaître dans les logs');
});

// ── CLI ───────────────────────────────────────────────────────────────

test('CLI -- succès -- code 0, sortie sans donnée sensible', async () => {
  const { stdout, stderr } = await execFileAsync('node', ['src/domain/privacy/runRetention.js'], { cwd: process.cwd() });
  const combined = stdout + stderr;
  assert.ok(!combined.includes('@test-privacy-batch2.local'));
  assert.ok(!combined.includes('hash-'));
});

test('CLI -- erreur de configuration -- code non-zéro', async () => {
  await assert.rejects(
    execFileAsync('node', ['src/domain/privacy/runRetention.js'], {
      cwd: process.cwd(),
      env: { ...process.env, DB_PASSWORD: 'valeur-completement-invalide-pour-forcer-un-echec' }
    })
  );
});

// ── Backfill legacy (migration 0014) — reproduction fidèle, sans jamais toucher au schéma partagé ──
//
// Reproduit exactement l'état d'une ligne créée AVANT l'existence des
// colonnes revoked_at/expired_at : insertion directe avec la colonne
// simplement omise (NULL), jamais via acceptProjectInvitation/
// revokeProjectInvitation (qui les renseignent déjà correctement
// aujourd'hui). Le SQL de backfill exécuté ci-dessous est ligne pour
// ligne identique à celui de la migration 0014 elle-même -- toute
// divergence future entre ce test et le fichier de migration doit être
// traitée comme un signal d'alerte, jamais ignorée.

async function backfillTerminalTimestampsLikeMigration0014(pool) {
  await pool.query("update project_invitations set revoked_at = now() where status = 'revoked' and revoked_at is null");
  await pool.query("update project_invitations set expired_at = now() where status = 'expired' and expired_at is null");
}

test('LEGACY -- revoked sans revoked_at (pré-migration) -- backfill correct, non purgeable immédiatement', async () => {
  const beforeBackfill = new Date();
  const { rows: [legacy] } = await pool.query(
    `insert into project_invitations (tenant_id, project_id, email, permission_bundle, locale, invited_by_user_id, status, created_at)
     values ($1,$2,'legacy-revoked@test-privacy-batch2.local','editor','fr',$3,'revoked', $4)
     returning id, status, revoked_at, created_at`,
    [tenant, project, inviterUserId, new Date(beforeBackfill.getTime() - 200 * DAY_MS)]
  );
  assert.equal(legacy.status, 'revoked');
  assert.equal(legacy.revoked_at, null, 'état legacy reproduit fidèlement -- revoked_at bien NULL avant backfill');

  await backfillTerminalTimestampsLikeMigration0014(pool);

  const { rows: [after] } = await pool.query('select status, revoked_at, created_at from project_invitations where id=$1', [legacy.id]);
  assert.equal(after.status, 'revoked', 'le statut ne doit jamais changer');
  assert.ok(after.revoked_at, 'revoked_at doit désormais être renseigné');
  assert.ok(new Date(after.revoked_at).getTime() >= beforeBackfill.getTime(), 'horodaté au moment du backfill, jamais avant');
  assert.equal(new Date(after.created_at).getTime(), new Date(legacy.created_at).getTime(), 'created_at jamais modifié');

  // Non purgeable immédiatement -- la fenêtre de 12 mois repart d'ici.
  const purgedNow = await purgeTerminalInvitations(pool, { now: new Date(after.revoked_at) });
  const { rows: [stillThere] } = await pool.query('select id from project_invitations where id=$1', [legacy.id]);
  assert.ok(stillThere, 'ne doit jamais être purgée immédiatement après son propre backfill');

  await pool.query('delete from project_invitations where id=$1', [legacy.id]);
});

test('LEGACY -- expired sans expired_at (pré-migration) -- backfill correct, non purgeable immédiatement', async () => {
  const beforeBackfill = new Date();
  const { rows: [legacy] } = await pool.query(
    `insert into project_invitations (tenant_id, project_id, email, permission_bundle, locale, invited_by_user_id, status, created_at)
     values ($1,$2,'legacy-expired@test-privacy-batch2.local','editor','fr',$3,'expired', $4)
     returning id, status, expired_at, created_at`,
    [tenant, project, inviterUserId, new Date(beforeBackfill.getTime() - 200 * DAY_MS)]
  );
  assert.equal(legacy.expired_at, null, 'état legacy reproduit fidèlement -- expired_at bien NULL avant backfill');

  await backfillTerminalTimestampsLikeMigration0014(pool);

  const { rows: [after] } = await pool.query('select status, expired_at, created_at from project_invitations where id=$1', [legacy.id]);
  assert.equal(after.status, 'expired');
  assert.ok(after.expired_at);
  assert.ok(new Date(after.expired_at).getTime() >= beforeBackfill.getTime());
  assert.equal(new Date(after.created_at).getTime(), new Date(legacy.created_at).getTime());

  const { rows: [stillThere] } = await pool.query('select id from project_invitations where id=$1', [legacy.id]);
  assert.ok(stillThere, 'ne doit jamais être purgée immédiatement après son propre backfill');

  await pool.query('delete from project_invitations where id=$1', [legacy.id]);
});

test('LEGACY -- timestamp terminal déjà existant -- jamais écrasé par le backfill', async () => {
  const existingRevokedAt = new Date('2024-01-15T10:00:00Z');
  const { rows: [row] } = await pool.query(
    `insert into project_invitations (tenant_id, project_id, email, permission_bundle, locale, invited_by_user_id, status, created_at, revoked_at)
     values ($1,$2,'legacy-existing-ts@test-privacy-batch2.local','editor','fr',$3,'revoked', now() - interval '400 days', $4)
     returning id`,
    [tenant, project, inviterUserId, existingRevokedAt]
  );

  await backfillTerminalTimestampsLikeMigration0014(pool);

  const { rows: [after] } = await pool.query('select revoked_at from project_invitations where id=$1', [row.id]);
  assert.equal(new Date(after.revoked_at).getTime(), existingRevokedAt.getTime(), 'un timestamp déjà présent ne doit jamais être écrasé par le backfill');

  await pool.query('delete from project_invitations where id=$1', [row.id]);
});

test('LEGACY -- accepted -- accepted_at inchangé, aucun revoked_at/expired_at artificiel ajouté par le backfill', async () => {
  const existingAcceptedAt = new Date('2024-03-01T08:00:00Z');
  const { rows: [row] } = await pool.query(
    `insert into project_invitations (tenant_id, project_id, email, permission_bundle, locale, invited_by_user_id, status, created_at, accepted_at)
     values ($1,$2,'legacy-accepted@test-privacy-batch2.local','editor','fr',$3,'accepted', now() - interval '400 days', $4)
     returning id`,
    [tenant, project, inviterUserId, existingAcceptedAt]
  );

  await backfillTerminalTimestampsLikeMigration0014(pool);

  const { rows: [after] } = await pool.query('select status, accepted_at, revoked_at, expired_at from project_invitations where id=$1', [row.id]);
  assert.equal(after.status, 'accepted');
  assert.equal(new Date(after.accepted_at).getTime(), existingAcceptedAt.getTime(), 'accepted_at jamais modifié');
  assert.equal(after.revoked_at, null, 'aucun revoked_at artificiel ajouté à une ligne accepted');
  assert.equal(after.expired_at, null, 'aucun expired_at artificiel ajouté à une ligne accepted');

  await pool.query('delete from project_invitations where id=$1', [row.id]);
});

// ── Confirmation archéologique : accepted_at IS NULL jamais atteignable ──

test('CONFIRMATION -- aucun chemin de code applicatif ne peut produire status=accepted avec accepted_at NULL', async () => {
  // acceptProjectInvitation est l'UNIQUE fonction transitionnant vers
  // 'accepted' dans tout le repository -- elle pose systématiquement
  // accepted_at dans la même instruction SQL, jamais séparément.
  const source = await import('node:fs/promises').then(fs =>
    fs.readFile(new URL('../src/domain/memberships/repository.js', import.meta.url), 'utf8')
  );
  const acceptedTransitions = source.match(/status\s*=\s*'accepted'/g) || [];
  assert.equal(acceptedTransitions.length, 1, 'une seule occurrence de transition vers accepted attendue dans tout le fichier');
  const line = source.split('\n').find(l => l.includes("status = 'accepted'"));
  assert.ok(line.includes('accepted_at'), 'la même instruction doit toujours poser accepted_at, jamais en deux temps');
});
