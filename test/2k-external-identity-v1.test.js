import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import {
  findExternalIdentityByIssuerSubject, createExternalIdentity,
  listExternalIdentitiesForUser, revokeExternalIdentity
} from '../src/domain/identity/repository.js';
import {
  createSession, findActiveSessionByRawToken, revokeSession,
  revokeSessionsByExternalIdentity, revokeAllSessionsForUser
} from '../src/domain/identity/sessions.js';

// SSO / External Identity V1 — Batch 1 (fondations de données
// uniquement). Aucune route /auth/*, aucun cookie, aucun changement
// d'AuthN actif dans ce batch -- ces tests couvrent exclusivement les
// primitives domaine : (issuer, subject) comme identité canonique
// (jamais l'email), sessions à hash seul, et la compatibilité
// historique des mappings de groupe externe.

const config = loadConfig();
const pool = getPool(config);

async function cleanAll() {
  await pool.query('delete from auth_sessions');
  await pool.query('delete from external_identities');
  await pool.query('delete from external_group_mappings');
  await pool.query('delete from project_memberships');
  await pool.query('delete from tenant_memberships');
  await pool.query('delete from project_public_access');
  await pool.query('delete from projects');
  await pool.query('delete from users');
  await pool.query('delete from clients');
  await pool.query('delete from tenants');
}

let ids = {};

test.before(async () => {
  await runMigrations();
  await cleanAll();

  const { rows: [tenant] } = await pool.query("insert into tenants (name) values ('Tenant External Identity V1') returning id");
  const { rows: [user] } = await pool.query("insert into users (email, display_name) values ('externalidentity@test.local','Externe V1') returning id");
  ids = { tenant: tenant.id, user: user.id };
});

test.after(async () => {
  await cleanAll();
  await closePool();
});

// ── External identities ─────────────────────────────────────────────

test('création réelle -- persiste (issuer, subject), jamais l\'email comme clé', async () => {
  const result = await createExternalIdentity(pool, {
    providerType: 'fake', issuer: 'https://fake-idp.test/issuer-a', subject: 'user-abc-123',
    userId: ids.user, emailAtLinking: 'externalidentity@test.local'
  });
  assert.equal(result.ok, true);
  assert.equal(result.identity.issuer, 'https://fake-idp.test/issuer-a');
  assert.equal(result.identity.subject, 'user-abc-123');
  assert.equal(result.identity.status, 'active');
  ids.identityA = result.identity.id;
});

test('lookup (issuer, subject) -- retrouve exactement la ligne créée', async () => {
  const found = await findExternalIdentityByIssuerSubject(pool, {
    issuer: 'https://fake-idp.test/issuer-a', subject: 'user-abc-123'
  });
  assert.ok(found);
  assert.equal(found.id, ids.identityA);
  assert.equal(found.user_id, ids.user);
});

test('lookup avec un issuer différent -- ne trouve jamais par subject seul', async () => {
  const found = await findExternalIdentityByIssuerSubject(pool, {
    issuer: 'https://autre-idp.test/issuer', subject: 'user-abc-123'
  });
  assert.equal(found, null);
});

test('même subject sous deux issuers différents -- autorisé, deux identités distinctes', async () => {
  const result = await createExternalIdentity(pool, {
    providerType: 'fake', issuer: 'https://fake-idp.test/issuer-b', subject: 'user-abc-123',
    userId: ids.user, emailAtLinking: 'externalidentity@test.local'
  });
  assert.equal(result.ok, true);
  assert.notEqual(result.identity.id, ids.identityA);
  ids.identityB = result.identity.id;
});

test('duplicate (issuer, subject) exact -- refusé proprement, jamais une exception brute', async () => {
  const result = await createExternalIdentity(pool, {
    providerType: 'fake', issuer: 'https://fake-idp.test/issuer-a', subject: 'user-abc-123',
    userId: ids.user, emailAtLinking: 'autre-email@test.local'
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'DUPLICATE');
});

test('email identique n\'est jamais utilisé comme clé de résolution -- deux identités externes différentes peuvent porter la même valeur email_at_linking sans être confondues', async () => {
  const { rows: [otherUser] } = await pool.query(
    "insert into users (email, display_name) values ('homonyme-externalidentity@test.local','Homonyme') returning id"
  );
  // emailAtLinking volontairement identique à celui déjà utilisé pour
  // ids.user plus haut -- confirme que ce champ est purement
  // informatif/audit, jamais consulté pour distinguer ou résoudre les
  // identités (seule (issuer, subject) fait foi).
  const result = await createExternalIdentity(pool, {
    providerType: 'fake', issuer: 'https://fake-idp.test/issuer-c', subject: 'user-xyz-999',
    userId: otherUser.id, emailAtLinking: 'externalidentity@test.local'
  });
  assert.equal(result.ok, true);
  assert.equal(result.identity.user_id, otherUser.id);
  assert.notEqual(result.identity.user_id, ids.user);

  // La résolution reste exclusivement par (issuer, subject) : chercher
  // avec le MÊME email_at_linking mais un issuer/subject différent
  // (celui de ids.user) doit toujours retrouver ids.user, jamais
  // otherUser -- preuve que l'email n'intervient à aucun moment dans
  // la résolution.
  const resolvedByRealKey = await findExternalIdentityByIssuerSubject(pool, {
    issuer: 'https://fake-idp.test/issuer-a', subject: 'user-abc-123'
  });
  assert.equal(resolvedByRealKey.user_id, ids.user);
});

test('listExternalIdentitiesForUser -- retourne les identités réelles de cet utilisateur, jamais celles d\'un autre', async () => {
  const list = await listExternalIdentitiesForUser(pool, ids.user);
  const issuers = list.map(i => i.issuer).sort();
  assert.deepEqual(issuers, ['https://fake-idp.test/issuer-a', 'https://fake-idp.test/issuer-b']);
});

test('révocation -- status devient revoked, revoked_at posé, lookup par (issuer, subject) reste possible (jamais supprimé)', async () => {
  const revoked = await revokeExternalIdentity(pool, { externalIdentityId: ids.identityB });
  assert.ok(revoked);
  assert.equal(revoked.status, 'revoked');
  assert.ok(revoked.revoked_at);

  const stillFindable = await findExternalIdentityByIssuerSubject(pool, {
    issuer: 'https://fake-idp.test/issuer-b', subject: 'user-abc-123'
  });
  assert.ok(stillFindable, 'jamais supprimée -- conservée pour audit/provenance');
  assert.equal(stillFindable.status, 'revoked');
});

test('révoquer une identité déjà révoquée -- no-op propre, jamais une seconde écriture', async () => {
  const result = await revokeExternalIdentity(pool, { externalIdentityId: ids.identityB });
  assert.equal(result, null);
});

// ── Sessions ─────────────────────────────────────────────────────────

test('création de session -- token brut jamais égal au hash stocké en base', async () => {
  const inOneHour = new Date(Date.now() + 60 * 60 * 1000);
  const { rawToken, session } = await createSession(pool, {
    userId: ids.user, externalIdentityId: ids.identityA, expiresAt: inOneHour
  });
  assert.ok(rawToken);
  assert.ok(session.id);

  const { rows: [stored] } = await pool.query('select session_token_hash from auth_sessions where id=$1', [session.id]);
  assert.notEqual(stored.session_token_hash, rawToken, 'le hash stocké ne doit jamais être la valeur brute');
  assert.notEqual(rawToken.length, 0);
  ids.sessionA = session.id;
  ids.rawTokenA = rawToken;
});

test('entropie/génération -- deux sessions consécutives produisent des tokens bruts distincts et suffisamment longs', async () => {
  const inOneHour = new Date(Date.now() + 60 * 60 * 1000);
  const first = await createSession(pool, { userId: ids.user, expiresAt: inOneHour });
  const second = await createSession(pool, { userId: ids.user, expiresAt: inOneHour });
  assert.notEqual(first.rawToken, second.rawToken);
  // 32 octets encodés en base64url -> 43 caractères sans padding.
  assert.ok(first.rawToken.length >= 40, 'entropie insuffisante si le token brut est anormalement court');
  await revokeSession(pool, first.session.id);
  await revokeSession(pool, second.session.id);
});

test('lookup par token brut valide -- retrouve la session active', async () => {
  const found = await findActiveSessionByRawToken(pool, ids.rawTokenA);
  assert.ok(found);
  assert.equal(found.id, ids.sessionA);
  assert.equal(found.user_id, ids.user);
});

test('lookup par token brut inconnu -- null, jamais une erreur', async () => {
  const found = await findActiveSessionByRawToken(pool, 'ce-token-ne-devrait-jamais-exister-123');
  assert.equal(found, null);
});

test('session expirée -- refusée par le lookup, même avec un token brut par ailleurs correct', async () => {
  const alreadyExpired = new Date(Date.now() - 1000);
  const { rawToken } = await createSession(pool, { userId: ids.user, expiresAt: alreadyExpired });
  const found = await findActiveSessionByRawToken(pool, rawToken);
  assert.equal(found, null);
});

test('session révoquée -- refusée par le lookup', async () => {
  const inOneHour = new Date(Date.now() + 60 * 60 * 1000);
  const { rawToken, session } = await createSession(pool, { userId: ids.user, expiresAt: inOneHour });
  await revokeSession(pool, session.id);
  const found = await findActiveSessionByRawToken(pool, rawToken);
  assert.equal(found, null);
});

test('révocation par external identity -- ne touche jamais les sessions d\'une AUTRE identité externe du même utilisateur', async () => {
  const inOneHour = new Date(Date.now() + 60 * 60 * 1000);
  // ids.identityA a déjà ids.sessionA active (créée plus haut).
  // Créer explicitement une seconde identité + session pour le MÊME
  // utilisateur, sous un issuer distinct.
  const otherIdentity = await createExternalIdentity(pool, {
    providerType: 'fake', issuer: 'https://fake-idp.test/issuer-d', subject: 'user-abc-123-bis',
    userId: ids.user
  });
  const { session: otherSession } = await createSession(pool, {
    userId: ids.user, externalIdentityId: otherIdentity.identity.id, expiresAt: inOneHour
  });

  const count = await revokeSessionsByExternalIdentity(pool, ids.identityA);
  assert.equal(count, 1, 'une seule session révoquée -- celle de identityA uniquement');

  const sessionAStillFound = await findActiveSessionByRawToken(pool, ids.rawTokenA);
  assert.equal(sessionAStillFound, null, 'la session de identityA doit désormais être révoquée');

  const { rows: [otherRow] } = await pool.query('select revoked_at from auth_sessions where id=$1', [otherSession.id]);
  assert.equal(otherRow.revoked_at, null, 'la session de l\'AUTRE identité externe ne doit jamais être touchée');
});

test('révocation globale utilisateur -- primitive séparée, fonctionne indépendamment de la révocation par identité', async () => {
  const inOneHour = new Date(Date.now() + 60 * 60 * 1000);
  const s1 = await createSession(pool, { userId: ids.user, expiresAt: inOneHour });
  const s2 = await createSession(pool, { userId: ids.user, expiresAt: inOneHour });

  const count = await revokeAllSessionsForUser(pool, ids.user);
  assert.ok(count >= 2);

  assert.equal(await findActiveSessionByRawToken(pool, s1.rawToken), null);
  assert.equal(await findActiveSessionByRawToken(pool, s2.rawToken), null);
});

test('aucune valeur brute de session exposée dans les objets persistés retournés par le repository', async () => {
  const inOneHour = new Date(Date.now() + 60 * 60 * 1000);
  const { rawToken, session } = await createSession(pool, { userId: ids.user, expiresAt: inOneHour });
  const serialized = JSON.stringify(session);
  assert.ok(!serialized.includes(rawToken), 'l\'objet session persisté ne doit jamais contenir la valeur brute');
});

// ── Compatibilité mapping (issuer/status) ───────────────────────────

test('legacy issuer=null -- toujours accepté en stockage, status par défaut actif', async () => {
  const { rows: [row] } = await pool.query(
    `insert into external_group_mappings (tenant_id, provider, external_group_id, target_type, target_id, permission_bundle)
     values ($1, 'legacy-provider', 'grp-legacy', 'organization', $1, 'member')
     returning id, issuer, status`,
    [ids.tenant]
  );
  assert.equal(row.issuer, null);
  assert.equal(row.status, 'active');
});

test('status invalide -- refusé par la contrainte check', async () => {
  await assert.rejects(
    pool.query(
      `insert into external_group_mappings (tenant_id, provider, external_group_id, target_type, target_id, permission_bundle, status)
       values ($1, 'legacy-provider', 'grp-invalide', 'organization', $1, 'member', 'not-a-real-status')`,
      [ids.tenant]
    )
  );
});

test('mapping avec issuer explicite -- stocké et lisible normalement', async () => {
  const { rows: [row] } = await pool.query(
    `insert into external_group_mappings (tenant_id, provider, issuer, external_group_id, target_type, target_id, permission_bundle)
     values ($1, 'fake', 'https://fake-idp.test/issuer-a', 'grp-reel', 'organization', $1, 'organization_admin')
     returning id, issuer, status`,
    [ids.tenant]
  );
  assert.equal(row.issuer, 'https://fake-idp.test/issuer-a');
  assert.equal(row.status, 'active');
});
