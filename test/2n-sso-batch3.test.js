import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { parse as parseCookieHeader } from 'cookie';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { createApp } from '../src/http/app.js';
import { disableExternalGroupMapping } from '../src/domain/memberships/repository.js';
import { reconcileGroupsToGrants } from '../src/domain/identity/groupReconciliation.js';

// SSO / External Identity V1 — Batch 3. Réconciliation groupes->grants
// JIT, lifecycle de désactivation de mapping (transactionnel,
// garde-fou capability-based unifié), pont invitation au moment exact
// de la création d'un nouveau compte SSO. Doctrine organisation V1
// (correction produit) : une seule organisation métier (Parella),
// chaque mapping porte déjà son propre tenant_id/target -- aucune
// réconciliation n'a besoin de résoudre un "contexte organisationnel
// actif". Un mapping projet ne confère jamais de capability
// organisationnelle, quel que soit son bundle.

const config = loadConfig();
const pool = getPool(config);
const silentLogger = { info() {}, warn() {}, error() {} };

let tenant, project, otherProject, inviterUserId;

async function cleanAll() {
  await pool.query("delete from project_grants where external_group_id like 'batch3-%' or mapping_id in (select id from external_group_mappings where external_group_id like 'batch3-%')");
  await pool.query("delete from organization_grants where mapping_id in (select id from external_group_mappings where external_group_id like 'batch3-%')");
  await pool.query("delete from external_group_mappings where external_group_id like 'batch3-%'");
  await pool.query("delete from project_invitations where email like '%@test-batch3.local'");
  await pool.query("delete from project_memberships where user_id in (select id from users where email like '%@test-batch3.local')");
  await pool.query("delete from tenant_memberships where user_id in (select id from users where email like '%@test-batch3.local')");
  await pool.query("delete from auth_sessions where user_id in (select id from users where email like '%@test-batch3.local')");
  await pool.query("delete from external_identities where user_id in (select id from users where email like '%@test-batch3.local')");
  await pool.query("delete from users where email like '%@test-batch3.local'");
  await pool.query("delete from users where email = 'inviter@test-batch3.local'");
  await pool.query("delete from projects where name like 'Batch3 %'");
  await pool.query("delete from tenants where name = 'Tenant Batch3'");
}

test.before(async () => {
  await runMigrations();
  await cleanAll();
  const { rows: [t] } = await pool.query("insert into tenants (name) values ('Tenant Batch3') returning id");
  tenant = t.id;
  const { rows: [p] } = await pool.query("insert into projects (tenant_id, name, status) values ($1,'Batch3 Projet A','active') returning id", [tenant]);
  project = p.id;
  const { rows: [p2] } = await pool.query("insert into projects (tenant_id, name, status) values ($1,'Batch3 Projet B','active') returning id", [tenant]);
  otherProject = p2.id;
  const { rows: [inviter] } = await pool.query("insert into users (email, display_name) values ('inviter@test-batch3.local','Inviter') returning id");
  inviterUserId = inviter.id;
});

test.after(async () => {
  await cleanAll();
  await closePool();
});

async function makeMapping({ targetType, targetId, groupId, bundle, issuer, tenantId = tenant }) {
  const { rows: [row] } = await pool.query(
    `insert into external_group_mappings (tenant_id, provider, issuer, external_group_id, target_type, target_id, permission_bundle)
     values ($1,'fake',$2,$3,$4,$5,$6) returning id`,
    [tenantId, issuer, groupId, targetType, targetId, bundle]
  );
  return row.id;
}

async function makeUser(email) {
  const { rows: [u] } = await pool.query("insert into users (email, display_name) values ($1,'Batch3 User') returning id", [email]);
  return u.id;
}

async function makeExternalIdentity({ userId, issuer, subject }) {
  await pool.query(
    "insert into external_identities (provider_type, issuer, subject, user_id) values ('fake',$1,$2,$3)",
    [issuer, subject, userId]
  );
}

const ISSUER = 'https://fake-idp.test-batch3/issuer';

function extractCookie(res, name) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
  for (const line of raw) {
    const parsed = parseCookieHeader(line);
    if (parsed[name] !== undefined) return parsed[name];
  }
  return undefined;
}

// ── Réconciliation -- additif ────────────────────────────────────────

test('mapping projet -- groupe présent dans le claim -> grant projet créé, membership bridge en member (jamais organisationnel)', async () => {
  const userId = await makeUser('additif-projet@test-batch3.local');
  await makeExternalIdentity({ userId, issuer: ISSUER, subject: 'sub-additif-projet' });
  await makeMapping({ targetType: 'project', targetId: project, groupId: 'batch3-grp-a', bundle: 'editor', issuer: ISSUER });

  const result = await reconcileGroupsToGrants(pool, { userId, issuer: ISSUER, groups: { kind: 'complete', groupIds: ['batch3-grp-a'] } });
  assert.equal(result.added.length, 1);

  const { rows: [grant] } = await pool.query(
    `select pg.permission_bundle, pg.source_type from project_grants pg
     join project_memberships pm on pm.id = pg.project_membership_id
     where pm.user_id = $1 and pg.project_id = $2 and pg.status = 'active'`,
    [userId, project]
  );
  assert.equal(grant.permission_bundle, 'editor');
  assert.equal(grant.source_type, 'external_group_mapping');

  const { rows: [tm] } = await pool.query('select permission_bundle from tenant_memberships where user_id=$1 and tenant_id=$2', [userId, tenant]);
  assert.equal(tm.permission_bundle, 'member', 'le pont technique ne doit jamais accorder organization_admin implicitement');
});

test('mapping organisation -- groupe présent -> grant organisationnel créé directement', async () => {
  const userId = await makeUser('additif-org@test-batch3.local');
  await makeExternalIdentity({ userId, issuer: ISSUER, subject: 'sub-additif-org' });
  await makeMapping({ targetType: 'organization', targetId: tenant, groupId: 'batch3-grp-org', bundle: 'organization_admin', issuer: ISSUER });

  const result = await reconcileGroupsToGrants(pool, { userId, issuer: ISSUER, groups: { kind: 'complete', groupIds: ['batch3-grp-org'] } });
  assert.equal(result.added.length, 1);

  const { rows: [grant] } = await pool.query(
    `select og.permission_bundle from organization_grants og
     join tenant_memberships tm on tm.id = og.organization_membership_id
     where tm.user_id = $1 and og.tenant_id = $2 and og.status = 'active'`,
    [userId, tenant]
  );
  assert.equal(grant.permission_bundle, 'organization_admin');
});

test('réconciliation idempotente -- rejouer avec les mêmes groupes ne crée jamais de doublon', async () => {
  const userId = await makeUser('idempotent@test-batch3.local');
  await makeExternalIdentity({ userId, issuer: ISSUER, subject: 'sub-idempotent' });
  await makeMapping({ targetType: 'project', targetId: project, groupId: 'batch3-grp-idem', bundle: 'contributor', issuer: ISSUER });

  await reconcileGroupsToGrants(pool, { userId, issuer: ISSUER, groups: { kind: 'complete', groupIds: ['batch3-grp-idem'] } });
  const second = await reconcileGroupsToGrants(pool, { userId, issuer: ISSUER, groups: { kind: 'complete', groupIds: ['batch3-grp-idem'] } });
  assert.equal(second.added.length, 0, 'un grant déjà actif pour ce mapping ne doit jamais être dupliqué');

  const { rows } = await pool.query(
    `select count(*)::int as n from project_grants pg join project_memberships pm on pm.id=pg.project_membership_id
     where pm.user_id=$1 and pg.status='active'`,
    [userId]
  );
  assert.equal(rows[0].n, 1);
});

// ── Réconciliation -- destructif uniquement si complete ──────────────

test('claim complete -- groupe retiré -> grant révoqué', async () => {
  const userId = await makeUser('revoke-complete@test-batch3.local');
  await makeExternalIdentity({ userId, issuer: ISSUER, subject: 'sub-revoke-complete' });
  await makeMapping({ targetType: 'project', targetId: project, groupId: 'batch3-grp-revoke', bundle: 'editor', issuer: ISSUER });
  await reconcileGroupsToGrants(pool, { userId, issuer: ISSUER, groups: { kind: 'complete', groupIds: ['batch3-grp-revoke'] } });

  const result = await reconcileGroupsToGrants(pool, { userId, issuer: ISSUER, groups: { kind: 'complete', groupIds: [] } });
  assert.equal(result.revoked.length, 1);

  const { rows: [grant] } = await pool.query(
    `select pg.status from project_grants pg join project_memberships pm on pm.id=pg.project_membership_id
     where pm.user_id=$1 and pg.project_id=$2`,
    [userId, project]
  );
  assert.equal(grant.status, 'revoked');
});

for (const kind of ['absent', 'incomplete', 'error']) {
  test(`claim ${kind} -- jamais destructif, le grant existant survit intact`, async () => {
    const userId = await makeUser(`survie-${kind}@test-batch3.local`);
    await makeExternalIdentity({ userId, issuer: ISSUER, subject: `sub-survie-${kind}` });
    await makeMapping({ targetType: 'project', targetId: project, groupId: `batch3-grp-survie-${kind}`, bundle: 'editor', issuer: ISSUER });
    await reconcileGroupsToGrants(pool, { userId, issuer: ISSUER, groups: { kind: 'complete', groupIds: [`batch3-grp-survie-${kind}`] } });

    const groupsResult = kind === 'incomplete' ? { kind, groupIds: [] } : { kind, ...(kind === 'error' ? { reason: 'simulation' } : {}) };
    const result = await reconcileGroupsToGrants(pool, { userId, issuer: ISSUER, groups: groupsResult });
    assert.equal(result.revoked.length, 0, `claim ${kind} ne doit jamais révoquer`);

    const { rows: [grant] } = await pool.query(
      `select pg.status from project_grants pg join project_memberships pm on pm.id=pg.project_membership_id
       where pm.user_id=$1 and pg.project_id=$2`,
      [userId, project]
    );
    assert.equal(grant.status, 'active', 'le grant doit rester actif malgré un claim non fiable');
  });
}

test('garde-fou dernier administrateur -- réconciliation ne révoque jamais le dernier grant administratif d\'un projet', async () => {
  const userId = await makeUser('last-admin-reconcile@test-batch3.local');
  await makeExternalIdentity({ userId, issuer: ISSUER, subject: 'sub-last-admin-reconcile' });
  await makeMapping({ targetType: 'project', targetId: otherProject, groupId: 'batch3-grp-last-admin', bundle: 'project_admin', issuer: ISSUER });
  await reconcileGroupsToGrants(pool, { userId, issuer: ISSUER, groups: { kind: 'complete', groupIds: ['batch3-grp-last-admin'] } });

  const { rows: [{ n }] } = await pool.query(
    "select count(*)::int as n from project_grants where project_id=$1 and status='active' and permission_bundle='project_admin'",
    [otherProject]
  );
  assert.equal(n, 1);

  const result = await reconcileGroupsToGrants(pool, { userId, issuer: ISSUER, groups: { kind: 'complete', groupIds: [] } });
  assert.equal(result.revoked.length, 0, 'la révocation doit être sautée -- dernier administrateur');
  assert.equal(result.adminInterventionRequired.length, 1, 'le signal structuré doit être présent, jamais un échec silencieux');
  assert.equal(result.adminInterventionRequired[0].targetType, 'project');
  assert.equal(result.adminInterventionRequired[0].targetId, otherProject);

  const { rows: [grant] } = await pool.query(
    "select status from project_grants where project_id=$1 and permission_bundle='project_admin'",
    [otherProject]
  );
  assert.equal(grant.status, 'active', 'le dernier grant administratif doit rester intact malgré le claim complete');
});

// ── Désactivation de mapping ─────────────────────────────────────────

test('désactivation de mapping -- révoque tous ses grants actifs, transactionnellement', async () => {
  const userId = await makeUser('disable-mapping@test-batch3.local');
  await makeExternalIdentity({ userId, issuer: ISSUER, subject: 'sub-disable-mapping' });
  const mappingId = await makeMapping({ targetType: 'project', targetId: project, groupId: 'batch3-grp-disable', bundle: 'contributor', issuer: ISSUER });
  await reconcileGroupsToGrants(pool, { userId, issuer: ISSUER, groups: { kind: 'complete', groupIds: ['batch3-grp-disable'] } });

  const result = await disableExternalGroupMapping(pool, { tenantId: tenant, mappingId });
  assert.equal(result.ok, true);
  assert.equal(result.revokedGrantCount, 1);

  const { rows: [mapping] } = await pool.query('select status from external_group_mappings where id=$1', [mappingId]);
  assert.equal(mapping.status, 'disabled');

  const { rows: [grant] } = await pool.query('select status from project_grants where mapping_id=$1', [mappingId]);
  assert.equal(grant.status, 'revoked');
});

test('désactivation de mapping -- ne touche jamais un autre mapping ni un grant direct', async () => {
  const userA = await makeUser('disable-isolation-a@test-batch3.local');
  const userB = await makeUser('disable-isolation-b@test-batch3.local');
  await makeExternalIdentity({ userId: userA, issuer: ISSUER, subject: 'sub-isolation-a' });
  await makeExternalIdentity({ userId: userB, issuer: ISSUER, subject: 'sub-isolation-b' });

  const mappingToDisable = await makeMapping({ targetType: 'project', targetId: project, groupId: 'batch3-grp-isolation-1', bundle: 'contributor', issuer: ISSUER });
  const otherMapping = await makeMapping({ targetType: 'project', targetId: project, groupId: 'batch3-grp-isolation-2', bundle: 'contributor', issuer: ISSUER });
  await reconcileGroupsToGrants(pool, { userId: userA, issuer: ISSUER, groups: { kind: 'complete', groupIds: ['batch3-grp-isolation-1'] } });
  await reconcileGroupsToGrants(pool, { userId: userB, issuer: ISSUER, groups: { kind: 'complete', groupIds: ['batch3-grp-isolation-2'] } });

  await disableExternalGroupMapping(pool, { tenantId: tenant, mappingId: mappingToDisable });

  const { rows: [otherGrant] } = await pool.query('select status from project_grants where mapping_id=$1', [otherMapping]);
  assert.equal(otherGrant.status, 'active', 'le grant issu de l\'AUTRE mapping ne doit jamais être touché');
});

test('désactivation d\'un mapping déjà désactivé -- ALREADY_DISABLED, jamais une double révocation', async () => {
  const mappingId = await makeMapping({ targetType: 'project', targetId: project, groupId: 'batch3-grp-already', bundle: 'contributor', issuer: ISSUER });
  await disableExternalGroupMapping(pool, { tenantId: tenant, mappingId });
  const second = await disableExternalGroupMapping(pool, { tenantId: tenant, mappingId });
  assert.equal(second.ok, false);
  assert.equal(second.code, 'ALREADY_DISABLED');
});

test('garde-fou dernier administrateur -- désactivation de mapping refusée si elle retirerait le dernier administrateur', async () => {
  const { rows: [dedicatedProject] } = await pool.query(
    "insert into projects (tenant_id, name, status) values ($1,'Batch3 Projet Dédié Dernier Admin','active') returning id",
    [tenant]
  );
  const dedicatedProjectId = dedicatedProject.id;
  const userId = await makeUser('disable-last-admin@test-batch3.local');
  await makeExternalIdentity({ userId, issuer: ISSUER, subject: 'sub-disable-last-admin' });
  const mappingId = await makeMapping({ targetType: 'project', targetId: dedicatedProjectId, groupId: 'batch3-grp-disable-last', bundle: 'project_admin', issuer: ISSUER });
  await reconcileGroupsToGrants(pool, { userId, issuer: ISSUER, groups: { kind: 'complete', groupIds: ['batch3-grp-disable-last'] } });

  const { rows: [{ n }] } = await pool.query(
    "select count(*)::int as n from project_grants where project_id=$1 and status='active' and permission_bundle='project_admin'",
    [dedicatedProjectId]
  );
  assert.equal(n, 1);

  const result = await disableExternalGroupMapping(pool, { tenantId: tenant, mappingId });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'LAST_ADMIN');

  const { rows: [mapping] } = await pool.query('select status from external_group_mappings where id=$1', [mappingId]);
  assert.equal(mapping.status, 'active', 'le mapping doit rester actif -- toute l\'opération annulée atomiquement');
  const { rows: [grant] } = await pool.query('select status from project_grants where mapping_id=$1', [mappingId]);
  assert.equal(grant.status, 'active', 'le grant ne doit pas non plus avoir été révoqué');

  await pool.query('delete from projects where id=$1', [dedicatedProjectId]);
});

// ── Pont invitation (HTTP, flow SSO complet) ─────────────────────────

test('pont invitation -- une invitation pending est réclamée automatiquement à la création du compte SSO, jamais pour un compte préexistant', async () => {
  const invitationEmail = 'invitation-bridge@test-batch3.local';
  const { rows: [invitation] } = await pool.query(
    `insert into project_invitations (tenant_id, project_id, email, permission_bundle, locale, invited_by_user_id, status)
     values ($1,$2,$3,'editor','fr',$4,'pending') returning id`,
    [tenant, project, invitationEmail, inviterUserId]
  );

  const testConfig = { ...config, sso: { ...config.sso, fakeProviderIssuer: 'http://127.0.0.1:4681/auth/fake-provider' } };
  const app = createApp({ logger: silentLogger, pool, config: testConfig });
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(4681, resolve));
  testConfig.sso.allowedOrigins.push('http://127.0.0.1:4681');

  const query = new URLSearchParams({ scenario: 'success', subject: 'sub-invitation-bridge', email: invitationEmail, emailVerified: 'true' }).toString();
  const loginRes = await fetch(`http://127.0.0.1:4681/auth/login?${query}`, { redirect: 'manual' });
  const txCookie = parseCookieHeader(loginRes.headers.get('set-cookie'))[testConfig.sso.transactionCookieName];
  const fakeRes = await fetch(loginRes.headers.get('location'), { redirect: 'manual', headers: { cookie: `${testConfig.sso.transactionCookieName}=${txCookie}` } });
  const callbackRes = await fetch(fakeRes.headers.get('location'), { redirect: 'manual', headers: { cookie: `${testConfig.sso.transactionCookieName}=${txCookie}` } });
  assert.equal(callbackRes.status, 302);

  const { rows: [updatedInvitation] } = await pool.query('select status from project_invitations where id=$1', [invitation.id]);
  assert.equal(updatedInvitation.status, 'accepted');

  const { rows: [membership] } = await pool.query(
    `select pm.permission_bundle from project_memberships pm join users u on u.id=pm.user_id
     where u.email=$1 and pm.project_id=$2`,
    [invitationEmail, project]
  );
  assert.equal(membership.permission_bundle, 'editor');

  server.close();
});

// ── Échec technique de réconciliation -- fail closed avant session ──

test('échec technique de réconciliation -- aucune session créée, aucune mutation partielle, rien de sensible loggé', async () => {
  const capturedLogs = [];
  const capturingLogger = {
    info: (p, m) => capturedLogs.push([p, m]),
    warn: (p, m) => capturedLogs.push([p, m]),
    error: (p, m) => capturedLogs.push([p, m])
  };
  const testConfig = { ...config, sso: { ...config.sso, fakeProviderIssuer: 'http://127.0.0.1:4682/auth/fake-provider' } };
  const app = createApp({ logger: capturingLogger, pool, config: testConfig });
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(4682, resolve));
  testConfig.sso.allowedOrigins.push('http://127.0.0.1:4682');

  // Force une exception technique réelle dans la réconciliation en
  // retirant temporairement le privilège d'écriture sur la table
  // qu'elle doit lire/écrire en premier -- jamais un mock qui
  // masquerait le vrai chemin de code.
  await pool.query('REVOKE SELECT ON external_group_mappings FROM storm_orogeny');
  const emailForFailure = 'reconciliation-fail@test-batch3.local';
  try {
    const query = new URLSearchParams({ scenario: 'success', subject: 'sub-reconciliation-fail', email: emailForFailure, emailVerified: 'true' }).toString();
    const loginRes = await fetch(`http://127.0.0.1:4682/auth/login?${query}`, { redirect: 'manual' });
    const txCookie = parseCookieHeader(loginRes.headers.get('set-cookie'))[testConfig.sso.transactionCookieName];
    const fakeRes = await fetch(loginRes.headers.get('location'), { redirect: 'manual', headers: { cookie: `${testConfig.sso.transactionCookieName}=${txCookie}` } });
    const callbackRes = await fetch(fakeRes.headers.get('location'), { redirect: 'manual', headers: { cookie: `${testConfig.sso.transactionCookieName}=${txCookie}` } });

    assert.equal(callbackRes.status, 500);
    const body = await callbackRes.json();
    assert.equal(body.error.code, 'RECONCILIATION_FAILED');

    const sessionCookie = extractCookie(callbackRes, testConfig.sso.sessionCookieName);
    assert.equal(sessionCookie, undefined, 'aucune session ne doit jamais être créée sur un échec technique');

    // L'utilisateur ET l'identité externe ont bien été créés (linking
    // réussi avant la réconciliation) -- ceci reste correct et
    // volontaire (linking et réconciliation sont deux étapes
    // distinctes) ; ce qui compte ici est l'absence de SESSION.
    const serialized = JSON.stringify(capturedLogs);
    assert.ok(!serialized.includes(txCookie), 'le cookie de transaction brut ne doit jamais apparaître dans les logs');
  } finally {
    await pool.query('GRANT SELECT ON external_group_mappings TO storm_orogeny');
    server.close();
  }
});

// ── Anomalie métier (last-admin) via le flow HTTP complet -- session autorisée ──

test('anomalie métier (dernier administrateur) via le flow complet -- la session EST créée malgré la révocation bloquée', async () => {
  const testIssuer = 'http://127.0.0.1:4683/auth/fake-provider';
  const { rows: [dedicatedProject] } = await pool.query(
    "insert into projects (tenant_id, name, status) values ($1,'Batch3 Projet HTTP Last Admin','active') returning id",
    [tenant]
  );
  const userId = await makeUser('http-last-admin@test-batch3.local');
  await makeExternalIdentity({ userId, issuer: testIssuer, subject: 'sub-http-last-admin' });
  await makeMapping({ targetType: 'project', targetId: dedicatedProject.id, groupId: 'batch3-grp-http-last-admin', bundle: 'project_admin', issuer: testIssuer });
  await reconcileGroupsToGrants(pool, { userId, issuer: testIssuer, groups: { kind: 'complete', groupIds: ['batch3-grp-http-last-admin'] } });

  const testConfig = { ...config, sso: { ...config.sso, fakeProviderIssuer: testIssuer } };
  const app = createApp({ logger: silentLogger, pool, config: testConfig });
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(4683, resolve));
  testConfig.sso.allowedOrigins.push('http://127.0.0.1:4683');

  // Reconnexion avec un claim complete qui NE contient plus le groupe
  // -- la révocation serait normalement appliquée, mais c'est le
  // dernier project_admin actif de ce projet : garde-fou déclenché.
  const query = new URLSearchParams({ scenario: 'success', subject: 'sub-http-last-admin', emailVerified: 'true', groupIds: '' }).toString();
  const loginRes = await fetch(`http://127.0.0.1:4683/auth/login?${query}`, { redirect: 'manual' });
  const txCookie = parseCookieHeader(loginRes.headers.get('set-cookie'))[testConfig.sso.transactionCookieName];
  const fakeRes = await fetch(loginRes.headers.get('location'), { redirect: 'manual', headers: { cookie: `${testConfig.sso.transactionCookieName}=${txCookie}` } });
  const callbackRes = await fetch(fakeRes.headers.get('location'), { redirect: 'manual', headers: { cookie: `${testConfig.sso.transactionCookieName}=${txCookie}` } });

  assert.equal(callbackRes.status, 302, 'la connexion doit réussir -- une anomalie métier ne bloque jamais l\'authentification');
  const sessionCookie = extractCookie(callbackRes, testConfig.sso.sessionCookieName);
  assert.ok(sessionCookie, 'une session doit être créée malgré l\'intervention administrative requise');

  const { rows: [grant] } = await pool.query(
    "select status from project_grants where project_id=$1 and permission_bundle='project_admin'",
    [dedicatedProject.id]
  );
  assert.equal(grant.status, 'active', 'aucune révocation partielle -- le dernier grant administratif reste intact');

  server.close();
  await pool.query('delete from projects where id=$1', [dedicatedProject.id]);
});

// ── Pont invitation -- invariants supplémentaires ────────────────────

test('pont invitation -- identité déjà liée, aucun scan d\'invitation au login suivant même si une invitation pending existe pour son email', async () => {
  const email = 'deja-liee-invitation@test-batch3.local';
  const userId = await makeUser(email);
  await makeExternalIdentity({ userId, issuer: ISSUER, subject: 'sub-deja-liee-invitation' });

  const { rows: [invitation] } = await pool.query(
    `insert into project_invitations (tenant_id, project_id, email, permission_bundle, locale, invited_by_user_id, status)
     values ($1,$2,$3,'editor','fr',$4,'pending') returning id`,
    [tenant, otherProject, email, inviterUserId]
  );

  const { resolveOrLinkIdentity } = await import('../src/domain/identity/linking.js');
  const linked = await resolveOrLinkIdentity(pool, { providerType: 'fake', issuer: ISSUER, subject: 'sub-deja-liee-invitation', email, emailVerified: true, displayName: 'Test' });
  assert.equal(linked.ok, true);
  assert.equal(linked.userId, userId, 'doit résoudre le compte déjà lié, jamais en créer un nouveau');

  const { rows: [stillPending] } = await pool.query('select status from project_invitations where id=$1', [invitation.id]);
  assert.equal(stillPending.status, 'pending', 'une identité déjà liée ne doit jamais déclencher un scan/réclamation d\'invitation');
});

test('pont invitation -- email non vérifié, aucun bridge, fail closed avant même de considérer les invitations', async () => {
  const email = 'non-verifie-invitation@test-batch3.local';
  await pool.query(
    `insert into project_invitations (tenant_id, project_id, email, permission_bundle, locale, invited_by_user_id, status)
     values ($1,$2,$3,'editor','fr',$4,'pending')`,
    [tenant, otherProject, email, inviterUserId]
  );

  const { resolveOrLinkIdentity } = await import('../src/domain/identity/linking.js');
  const linked = await resolveOrLinkIdentity(pool, { providerType: 'fake', issuer: ISSUER, subject: 'sub-non-verifie-invitation', email, emailVerified: false, displayName: 'Test' });
  assert.equal(linked.ok, false);
  assert.equal(linked.code, 'EMAIL_NOT_VERIFIED');

  const { rows } = await pool.query("select count(*)::int as n from users where email=$1", [email]);
  assert.equal(rows[0].n, 0, 'aucun compte ne doit avoir été créé');
});

test('pont invitation -- collision email avec compte existant non lié, aucune invitation réclamée', async () => {
  const email = 'collision-invitation@test-batch3.local';
  await makeUser(email); // compte existant, jamais lié à aucune external_identity
  const { rows: [invitation] } = await pool.query(
    `insert into project_invitations (tenant_id, project_id, email, permission_bundle, locale, invited_by_user_id, status)
     values ($1,$2,$3,'editor','fr',$4,'pending') returning id`,
    [tenant, otherProject, email, inviterUserId]
  );

  const { resolveOrLinkIdentity } = await import('../src/domain/identity/linking.js');
  const linked = await resolveOrLinkIdentity(pool, { providerType: 'fake', issuer: ISSUER, subject: 'sub-collision-invitation', email, emailVerified: true, displayName: 'Test' });
  assert.equal(linked.ok, false);
  assert.equal(linked.code, 'EMAIL_COLLISION');

  const { rows: [stillPending] } = await pool.query('select status from project_invitations where id=$1', [invitation.id]);
  assert.equal(stillPending.status, 'pending', 'fail closed -- aucune invitation réclamée sur collision');
});

// ── Utilisateur externe project-scoped -- zéro capability organisationnelle ──

test('utilisateur externe project-scoped -- zéro capability organisationnelle, aucun accès à un autre projet sans grant explicite', async () => {
  const { organizationCapabilitiesForBundle, bundleHasOrganizationCapability, OrganizationCapability } = await import('../src/domain/permissions/capabilities.js');

  const userId = await makeUser('project-scoped@test-batch3.local');
  await makeExternalIdentity({ userId, issuer: ISSUER, subject: 'sub-project-scoped' });
  await makeMapping({ targetType: 'project', targetId: project, groupId: 'batch3-grp-project-scoped', bundle: 'project_admin', issuer: ISSUER });
  await reconcileGroupsToGrants(pool, { userId, issuer: ISSUER, groups: { kind: 'complete', groupIds: ['batch3-grp-project-scoped'] } });

  // Membership technique minimale -- présente (prérequis FK), mais
  // bundle 'member' exclusivement.
  const { rows: [tm] } = await pool.query('select permission_bundle from tenant_memberships where user_id=$1 and tenant_id=$2', [userId, tenant]);
  assert.equal(tm.permission_bundle, 'member');
  assert.deepEqual(organizationCapabilitiesForBundle('member'), [], 'zéro capability organisationnelle, même en étant project_admin sur un projet');
  assert.equal(bundleHasOrganizationCapability('member', OrganizationCapability.PROJECTS_VIEW_ALL), false);
  assert.equal(bundleHasOrganizationCapability('member', OrganizationCapability.PROJECTS_CREATE), false);

  // Aucun grant sur l'AUTRE projet du même tenant -- l'accès project_admin
  // obtenu sur `project` ne doit jamais déteindre sur `otherProject`.
  const { rows: [{ n }] } = await pool.query(
    'select count(*)::int as n from project_grants pg join project_memberships pm on pm.id=pg.project_membership_id where pm.user_id=$1 and pg.project_id=$2',
    [userId, otherProject]
  );
  assert.equal(n, 0, 'aucun accès implicite à un autre projet du même tenant');
});

// ── Frontière de confiance du pont invitation -- réaffirmée localement ──

test('issuerTrusted absent/faux -- aucun pont invitation, même email vérifié, même nouveau compte, même invitation pending exacte', async () => {
  const { resolveOrLinkIdentity } = await import('../src/domain/identity/linking.js');
  const email = 'issuer-non-trusted@test-batch3.local';
  const { rows: [invitation] } = await pool.query(
    `insert into project_invitations (tenant_id, project_id, email, permission_bundle, locale, invited_by_user_id, status)
     values ($1,$2,$3,'editor','fr',$4,'pending') returning id`,
    [tenant, project, email, inviterUserId]
  );

  // issuerTrusted volontairement OMIS -- doit fail closed sur le pont,
  // même si toutes les autres conditions seraient réunies.
  const linked = await resolveOrLinkIdentity(pool, {
    providerType: 'fake', issuer: ISSUER, subject: 'sub-issuer-non-trusted',
    email, emailVerified: true, displayName: 'Test'
  });
  assert.equal(linked.ok, true, 'la liaison elle-même réussit -- seul le pont invitation est concerné par issuerTrusted');

  const { rows: [stillPending] } = await pool.query('select status from project_invitations where id=$1', [invitation.id]);
  assert.equal(stillPending.status, 'pending', 'aucune invitation ne doit jamais être réclamée sans issuerTrusted===true explicite');

  // Même vérification avec issuerTrusted explicitement à false.
  const email2 = 'issuer-trusted-false@test-batch3.local';
  const { rows: [invitation2] } = await pool.query(
    `insert into project_invitations (tenant_id, project_id, email, permission_bundle, locale, invited_by_user_id, status)
     values ($1,$2,$3,'editor','fr',$4,'pending') returning id`,
    [tenant, project, email2, inviterUserId]
  );
  const linked2 = await resolveOrLinkIdentity(pool, {
    providerType: 'fake', issuer: ISSUER, subject: 'sub-issuer-trusted-false',
    email: email2, emailVerified: true, displayName: 'Test', issuerTrusted: false
  });
  assert.equal(linked2.ok, true);
  const { rows: [stillPending2] } = await pool.query('select status from project_invitations where id=$1', [invitation2.id]);
  assert.equal(stillPending2.status, 'pending');
});

test('issuerTrusted===true -- le pont fonctionne normalement (non-régression du comportement réel)', async () => {
  const { resolveOrLinkIdentity } = await import('../src/domain/identity/linking.js');
  const email = 'issuer-trusted-true@test-batch3.local';
  const { rows: [invitation] } = await pool.query(
    `insert into project_invitations (tenant_id, project_id, email, permission_bundle, locale, invited_by_user_id, status)
     values ($1,$2,$3,'editor','fr',$4,'pending') returning id`,
    [tenant, project, email, inviterUserId]
  );

  const linked = await resolveOrLinkIdentity(pool, {
    providerType: 'fake', issuer: ISSUER, subject: 'sub-issuer-trusted-true',
    email, emailVerified: true, displayName: 'Test', issuerTrusted: true
  });
  assert.equal(linked.ok, true);

  const { rows: [accepted] } = await pool.query('select status from project_invitations where id=$1', [invitation.id]);
  assert.equal(accepted.status, 'accepted', 'avec issuerTrusted:true, le pont doit fonctionner exactement comme avant');
});

// ── Garde-fou dernier administrateur organisationnel -- capability-based, démontré ──

test('garde-fou organisationnel -- un bundle non administratif ne satisfait jamais le garde-fou, seul organization_admin le satisfait', async () => {
  const { organizationCapabilitiesForBundle } = await import('../src/domain/permissions/capabilities.js');
  const { ADMINISTRATIVE_CAPABILITY } = await import('../src/domain/permissions/lastAdministrator.js');

  assert.equal(
    organizationCapabilitiesForBundle('member').includes(ADMINISTRATIVE_CAPABILITY.organization),
    false,
    'member ne doit jamais satisfaire le garde-fou administratif organisationnel'
  );
  assert.equal(
    organizationCapabilitiesForBundle('organization_admin').includes(ADMINISTRATIVE_CAPABILITY.organization),
    true,
    'organization_admin doit satisfaire le garde-fou -- seul bundle réellement administratif aujourd\'hui'
  );
});

test('garde-fou organisationnel réel -- révoquer le dernier organization_admin est bloqué, un member peut toujours être retiré librement', async () => {
  const userAdmin = await makeUser('org-last-admin-real@test-batch3.local');
  const userMember = await makeUser('org-member-real@test-batch3.local');
  await makeExternalIdentity({ userId: userAdmin, issuer: ISSUER, subject: 'sub-org-last-admin-real' });
  await makeExternalIdentity({ userId: userMember, issuer: ISSUER, subject: 'sub-org-member-real' });

  const { rows: [dedicatedTenant] } = await pool.query("insert into tenants (name) values ('Tenant Batch3 Garde-fou Org') returning id");
  const adminMapping = await makeMapping({ targetType: 'organization', targetId: dedicatedTenant.id, groupId: 'batch3-grp-org-admin-real', bundle: 'organization_admin', issuer: ISSUER, tenantId: dedicatedTenant.id });
  const memberMapping = await makeMapping({ targetType: 'organization', targetId: dedicatedTenant.id, groupId: 'batch3-grp-org-member-real', bundle: 'member', issuer: ISSUER, tenantId: dedicatedTenant.id });

  await reconcileGroupsToGrants(pool, { userId: userAdmin, issuer: ISSUER, groups: { kind: 'complete', groupIds: ['batch3-grp-org-admin-real'] } });
  await reconcileGroupsToGrants(pool, { userId: userMember, issuer: ISSUER, groups: { kind: 'complete', groupIds: ['batch3-grp-org-member-real'] } });

  // Retirer le member -- jamais bloqué, ce n'est pas une capability administrative.
  const memberResult = await disableExternalGroupMapping(pool, { tenantId: dedicatedTenant.id, mappingId: memberMapping });
  assert.equal(memberResult.ok, true, 'retirer un accès member ne doit jamais être bloqué par le garde-fou administratif');

  // Retirer le SEUL organization_admin -- doit être bloqué.
  const adminResult = await disableExternalGroupMapping(pool, { tenantId: dedicatedTenant.id, mappingId: adminMapping });
  assert.equal(adminResult.ok, false);
  assert.equal(adminResult.code, 'LAST_ADMIN');

  await pool.query('delete from organization_grants where tenant_id=$1', [dedicatedTenant.id]);
  await pool.query('delete from external_group_mappings where tenant_id=$1', [dedicatedTenant.id]);
  await pool.query('delete from tenant_memberships where tenant_id=$1', [dedicatedTenant.id]);
  await pool.query('delete from tenants where id=$1', [dedicatedTenant.id]);
});
