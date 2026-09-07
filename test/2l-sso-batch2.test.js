import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { parse as parseCookieHeader } from 'cookie';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { createApp } from '../src/http/app.js';

// SSO / External Identity V1 — Batch 2. Squelette AuthN entièrement
// testable avec le fake provider, aucun réseau, aucun secret
// Microsoft. devAuth reste seul mécanisme réellement actif ailleurs
// dans l'app — ces tests couvrent exclusivement les routes /auth/*
// nouvellement ajoutées, jamais un changement d'AuthN existant.

const config = loadConfig();
const pool = getPool(config);
const silentLogger = { info() {}, warn() {}, error() {} };

let app, server, baseUrl;

async function cleanAll() {
  await pool.query('delete from auth_sessions');
  await pool.query('delete from external_identities');
  await pool.query("delete from users where email like '%@test-batch2.local'");
}

test.before(async () => {
  await runMigrations();
  await cleanAll();
  // Port fixe, jamais éphémère (listen(0)) : l'issuer du fake provider
  // (config.sso.fakeProviderIssuer) doit pointer vers CETTE instance
  // précise -- une valeur figée à la construction de la config, tandis
  // qu'un port éphémère ne serait connu qu'après démarrage. Port
  // dédié à ce fichier de test, distinct de tout autre usage.
  const port = 4591;
  config.sso.fakeProviderIssuer = `http://127.0.0.1:${port}/auth/fake-provider`;
  baseUrl = `http://127.0.0.1:${port}`;
  config.sso.allowedOrigins.push(baseUrl);

  app = createApp({ logger: silentLogger, pool, config });
  server = http.createServer(app);
  await new Promise(resolve => server.listen(port, resolve));
});

test.after(async () => {
  await cleanAll();
  server.close();
  await closePool();
});

// Extrait la valeur d'UN cookie précis depuis les en-têtes Set-Cookie
// (possiblement multiples) d'une réponse fetch.
function extractCookie(res, name) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
  for (const line of raw) {
    const parsed = parseCookieHeader(line);
    if (parsed[name] !== undefined) return parsed[name];
  }
  return undefined;
}

function cookieHeader(pairs) {
  return Object.entries(pairs).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${v}`).join('; ');
}

// Exécute la chaîne complète login -> fake-provider -> callback,
// avec les paramètres de simulation donnés. Retourne la réponse finale
// du callback ainsi que les cookies observés à chaque étape.
async function runLoginFlow(params = {}) {
  const query = new URLSearchParams({ scenario: 'success', subject: 'sub-default', email: 'defaut@test-batch2.local', emailVerified: 'true', ...params }).toString();

  const loginRes = await fetch(`${baseUrl}/auth/login?${query}`, { redirect: 'manual' });
  const txCookie = extractCookie(loginRes, config.sso.transactionCookieName);
  const fakeAuthorizeUrl = loginRes.headers.get('location');

  const fakeRes = await fetch(fakeAuthorizeUrl, {
    redirect: 'manual',
    headers: { cookie: cookieHeader({ [config.sso.transactionCookieName]: txCookie }) }
  });
  const callbackUrl = fakeRes.headers.get('location');

  const callbackRes = await fetch(callbackUrl, {
    redirect: 'manual',
    headers: { cookie: cookieHeader({ [config.sso.transactionCookieName]: txCookie }) }
  });

  return { loginRes, txCookie, callbackUrl, callbackRes };
}

// ── Provider / registre ──────────────────────────────────────────────

test('provider par défaut -- login redirige vers le fake provider configuré, jamais un issuer arbitraire', async () => {
  const res = await fetch(`${baseUrl}/auth/login?scenario=success`, { redirect: 'manual' });
  assert.equal(res.status, 302);
  const location = res.headers.get('location');
  assert.ok(location.startsWith(config.sso.fakeProviderIssuer), 'doit rediriger vers l\'issuer configuré, jamais autre chose');
});

// ── Transaction ──────────────────────────────────────────────────────

test('state correct -- callback progresse jusqu\'à la résolution d\'identité', async () => {
  const { callbackRes } = await runLoginFlow({ subject: 'sub-state-ok', email: 'state-ok@test-batch2.local' });
  assert.equal(callbackRes.status, 302, 'succès attendu -- redirection vers /');
  assert.equal(callbackRes.headers.get('location'), '/');
});

test('state incorrect -- callback refusé, transaction jamais consommée pour créer une session', async () => {
  const query = new URLSearchParams({ scenario: 'success', subject: 'sub-bad-state', email: 'badstate@test-batch2.local', emailVerified: 'true' }).toString();
  const loginRes = await fetch(`${baseUrl}/auth/login?${query}`, { redirect: 'manual' });
  const txCookie = extractCookie(loginRes, config.sso.transactionCookieName);
  const fakeAuthorizeUrl = loginRes.headers.get('location');
  const fakeRes = await fetch(fakeAuthorizeUrl, { redirect: 'manual', headers: { cookie: cookieHeader({ [config.sso.transactionCookieName]: txCookie }) } });
  const callbackUrl = new URL(fakeRes.headers.get('location'));
  callbackUrl.searchParams.set('state', 'un-state-totalement-different');

  const callbackRes = await fetch(callbackUrl.toString(), { redirect: 'manual', headers: { cookie: cookieHeader({ [config.sso.transactionCookieName]: txCookie }) } });
  assert.equal(callbackRes.status, 400);
  const body = await callbackRes.json();
  assert.equal(body.error.code, 'STATE_MISMATCH');
});

test('transaction absente -- callback refusé immédiatement', async () => {
  const res = await fetch(`${baseUrl}/auth/callback?state=x&code=y`, { redirect: 'manual' });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, 'TRANSACTION_MISSING');
});

test('signature de transaction invalide -- refusée', async () => {
  const res = await fetch(`${baseUrl}/auth/callback?state=x&code=y`, {
    redirect: 'manual',
    headers: { cookie: cookieHeader({ [config.sso.transactionCookieName]: 'valeur.forgee-jamais-signee-correctement' }) }
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, 'TRANSACTION_BAD_SIGNATURE');
});

test('transaction supprimée après succès -- le cookie de transaction est effacé (Max-Age=0)', async () => {
  const { callbackRes } = await runLoginFlow({ subject: 'sub-cleanup-ok', email: 'cleanup-ok@test-batch2.local' });
  const setCookies = callbackRes.headers.getSetCookie ? callbackRes.headers.getSetCookie() : [];
  const txSetCookie = setCookies.find(c => c.startsWith(config.sso.transactionCookieName));
  assert.ok(txSetCookie, 'le cookie de transaction doit être explicitement effacé');
  assert.match(txSetCookie, /Max-Age=0/);
});

test('transaction supprimée après échec également (collision email)', async () => {
  const { rows: [existing] } = await pool.query(
    "insert into users (email, display_name) values ('collision-cleanup@test-batch2.local','Existant') returning id"
  );
  const { callbackRes } = await runLoginFlow({ subject: 'sub-collision-cleanup', email: 'collision-cleanup@test-batch2.local' });
  assert.equal(callbackRes.status, 403);
  const setCookies = callbackRes.headers.getSetCookie ? callbackRes.headers.getSetCookie() : [];
  const txSetCookie = setCookies.find(c => c.startsWith(config.sso.transactionCookieName));
  assert.ok(txSetCookie);
  assert.match(txSetCookie, /Max-Age=0/);
  await pool.query('delete from users where id=$1', [existing.id]);
});

// ── Login / callback -- linking ─────────────────────────────────────

test('flow complet réussi -- nouvelle identité, aucune collision -> user créé, session posée', async () => {
  const { callbackRes } = await runLoginFlow({ subject: 'sub-nouveau', email: 'nouveau-batch2@test-batch2.local', displayName: 'Nouveau Batch2' });
  assert.equal(callbackRes.status, 302);
  const sessionCookie = extractCookie(callbackRes, config.sso.sessionCookieName);
  assert.ok(sessionCookie, 'une session doit être posée après succès');

  const { rows: [user] } = await pool.query("select id from users where email='nouveau-batch2@test-batch2.local'");
  assert.ok(user);
  const { rows: [identity] } = await pool.query('select issuer, subject, status from external_identities where user_id=$1', [user.id]);
  assert.equal(identity.subject, 'sub-nouveau');
  assert.equal(identity.status, 'active');
});

test('identity déjà liée -- seconde connexion résout le même user, ne recrée jamais', async () => {
  await runLoginFlow({ subject: 'sub-repeat', email: 'repeat@test-batch2.local' });
  await runLoginFlow({ subject: 'sub-repeat', email: 'repeat@test-batch2.local' });
  const { rows } = await pool.query("select id from users where email='repeat@test-batch2.local'");
  assert.equal(rows.length, 1, 'un seul user, jamais un doublon');
});

test('collision email avec user existant non lié -- fail closed, jamais de fusion, jamais de session', async () => {
  const { rows: [existing] } = await pool.query(
    "insert into users (email, display_name) values ('collision@test-batch2.local','Déjà Existant') returning id"
  );
  const { callbackRes } = await runLoginFlow({ subject: 'sub-collision', email: 'collision@test-batch2.local', emailVerified: 'true' });
  assert.equal(callbackRes.status, 403);
  const body = await callbackRes.json();
  assert.equal(body.error.code, 'EMAIL_COLLISION');
  const sessionCookie = extractCookie(callbackRes, config.sso.sessionCookieName);
  assert.equal(sessionCookie, undefined, 'aucune session ne doit être créée sur un refus');
  const { rows: [identity] } = await pool.query(
    "select count(*)::int as n from external_identities where issuer=$1 and subject='sub-collision'",
    [config.sso.fakeProviderIssuer]
  );
  assert.equal(identity.n, 0, 'aucune identité externe créée sur un refus');
  await pool.query('delete from users where id=$1', [existing.id]);
});

test('email non vérifié -- fail closed même sans collision, jamais de création de compte', async () => {
  const { callbackRes } = await runLoginFlow({ subject: 'sub-unverified', email: 'unverified@test-batch2.local', emailVerified: 'false', scenario: 'email-unverified' });
  assert.equal(callbackRes.status, 403);
  const body = await callbackRes.json();
  assert.equal(body.error.code, 'EMAIL_NOT_VERIFIED');
  const { rows } = await pool.query("select count(*)::int as n from users where email='unverified@test-batch2.local'");
  assert.equal(rows[0].n, 0);
});

test('callback invalide -- refusé proprement', async () => {
  const query = new URLSearchParams({ scenario: 'success', subject: 'sub-invalid-cb', email: 'invalidcb@test-batch2.local', emailVerified: 'true' }).toString();
  const loginRes = await fetch(`${baseUrl}/auth/login?${query}`, { redirect: 'manual' });
  const txCookie = extractCookie(loginRes, config.sso.transactionCookieName);
  const loginLocation = new URL(loginRes.headers.get('location'));
  const state = loginLocation.searchParams.get('state');

  const callbackRes = await fetch(`${baseUrl}/auth/callback?state=${state}&code=un-code-completement-invalide-jamais-decodable`, {
    redirect: 'manual',
    headers: { cookie: cookieHeader({ [config.sso.transactionCookieName]: txCookie }) }
  });
  assert.equal(callbackRes.status, 400);
  const body = await callbackRes.json();
  assert.equal(body.error.code, 'INVALID_CALLBACK');
});

test('groupes -- complete/absent/incomplete/error tous représentables sans faire échouer le login lui-même', async () => {
  for (const scenario of ['success', 'groups-absent', 'groups-incomplete', 'groups-error']) {
    const { callbackRes } = await runLoginFlow({ scenario, subject: `sub-${scenario}`, email: `${scenario}@test-batch2.local` });
    assert.equal(callbackRes.status, 302, `scenario ${scenario} doit réussir le login (réconciliation groupes hors scope Batch 2)`);
  }
});

// ── Session ──────────────────────────────────────────────────────────

test('logout -- révoque uniquement la session courante, idempotent', async () => {
  const { callbackRes } = await runLoginFlow({ subject: 'sub-logout', email: 'logout@test-batch2.local' });
  const sessionCookie = extractCookie(callbackRes, config.sso.sessionCookieName);

  const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
    method: 'POST',
    headers: { cookie: cookieHeader({ [config.sso.sessionCookieName]: sessionCookie }), origin: baseUrl }
  });
  assert.equal(logoutRes.status, 200);

  const { rows: [user] } = await pool.query("select id from users where email='logout@test-batch2.local'");
  const { rows: [session] } = await pool.query('select revoked_at from auth_sessions where user_id=$1', [user.id]);
  assert.ok(session.revoked_at);

  // Idempotent -- rejouer le logout ne doit jamais échouer.
  const secondLogout = await fetch(`${baseUrl}/auth/logout`, {
    method: 'POST',
    headers: { cookie: cookieHeader({ [config.sso.sessionCookieName]: sessionCookie }), origin: baseUrl }
  });
  assert.equal(secondLogout.status, 200);
});

test('session révoquée -- ssoAuth refuse une requête protégée avec ce cookie', async () => {
  const { ssoAuth } = await import('../src/http/middleware/ssoAuth.js');
  const { callbackRes } = await runLoginFlow({ subject: 'sub-ssoauth', email: 'ssoauth@test-batch2.local' });
  const sessionCookie = extractCookie(callbackRes, config.sso.sessionCookieName);

  await fetch(`${baseUrl}/auth/logout`, { method: 'POST', headers: { cookie: cookieHeader({ [config.sso.sessionCookieName]: sessionCookie }), origin: baseUrl } });

  const middleware = ssoAuth({ pool, config });
  let calledNextWithError = null;
  const fakeReq = { headers: { cookie: cookieHeader({ [config.sso.sessionCookieName]: sessionCookie }) } };
  await middleware(fakeReq, {}, (err) => { calledNextWithError = err; });
  assert.ok(calledNextWithError, 'doit appeler next(err) -- jamais authentifié après révocation');
  assert.equal(calledNextWithError.code, 'UNAUTHENTICATED');
});

test('aucune valeur brute de session dans les logs applicatifs', async () => {
  const logs = [];
  const capturingLogger = { info: (p, m) => logs.push([p, m]), warn: (p, m) => logs.push([p, m]), error: (p, m) => logs.push([p, m]) };
  const capturingConfig = { ...config, sso: { ...config.sso } };
  const capturingPort = 4593;
  capturingConfig.sso.fakeProviderIssuer = `http://127.0.0.1:${capturingPort}/auth/fake-provider`;
  const capturingBaseUrl = `http://127.0.0.1:${capturingPort}`;
  capturingConfig.sso.allowedOrigins = [...capturingConfig.sso.allowedOrigins, capturingBaseUrl];
  const capturingApp = createApp({ logger: capturingLogger, pool, config: capturingConfig });
  const capturingServer = http.createServer(capturingApp);
  await new Promise(resolve => capturingServer.listen(capturingPort, resolve));

  const query = new URLSearchParams({ scenario: 'success', subject: 'sub-nolog', email: 'nolog@test-batch2.local', emailVerified: 'true' }).toString();
  const loginRes = await fetch(`${capturingBaseUrl}/auth/login?${query}`, { redirect: 'manual' });
  const txCookie = extractCookie(loginRes, config.sso.transactionCookieName);
  const fakeRes = await fetch(loginRes.headers.get('location'), { redirect: 'manual', headers: { cookie: cookieHeader({ [config.sso.transactionCookieName]: txCookie }) } });
  const callbackRes = await fetch(fakeRes.headers.get('location'), { redirect: 'manual', headers: { cookie: cookieHeader({ [config.sso.transactionCookieName]: txCookie }) } });
  const sessionCookie = extractCookie(callbackRes, config.sso.sessionCookieName);

  const serialized = JSON.stringify(logs);
  assert.ok(!serialized.includes(sessionCookie), 'la valeur brute du cookie de session ne doit jamais apparaître dans les logs');
  assert.ok(!serialized.includes(txCookie), 'la valeur brute du cookie de transaction ne doit jamais apparaître dans les logs');

  capturingServer.close();
});

// ── CSRF / Origin ────────────────────────────────────────────────────

test('mutation same-origin (Origin correct) -- acceptée', async () => {
  const res = await fetch(`${baseUrl}/auth/logout`, { method: 'POST', headers: { origin: baseUrl } });
  assert.equal(res.status, 200);
});

test('Origin étranger sur une méthode mutante -- refusé (403)', async () => {
  const res = await fetch(`${baseUrl}/auth/logout`, { method: 'POST', headers: { origin: 'http://evil.example' } });
  assert.equal(res.status, 403);
  const body = await res.json();
  assert.equal(body.error.code, 'ORIGIN_REJECTED');
});

test('callback OIDC (GET) jamais bloqué par la validation Origin', async () => {
  // GET n'est jamais dans UNSAFE_METHODS -- confirmé qu'un callback
  // sans Origin (cas réel d'un retour depuis un IdP) n'est jamais
  // rejeté par ce middleware, quel que soit son propre résultat métier.
  const res = await fetch(`${baseUrl}/auth/callback?state=x&code=y`, { redirect: 'manual' });
  assert.notEqual(res.status, 403);
});

// ── Security headers ────────────────────────────────────────────────

test('baseline de sécurité présente sur toute réponse', async () => {
  const res = await fetch(`${baseUrl}/auth/login?scenario=success`, { redirect: 'manual' });
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.ok(res.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
});

test('HSTS absent en développement (jamais envoyé hors production)', async () => {
  const res = await fetch(`${baseUrl}/auth/login?scenario=success`, { redirect: 'manual' });
  assert.equal(res.headers.get('strict-transport-security'), null);
});

// ── Rate limiting ────────────────────────────────────────────────────

test('rate limiting -- appliqué effectivement sur /auth/login au-delà du seuil configuré', async () => {
  // Instance isolée, config clonée avec une limite volontairement
  // basse -- jamais le budget partagé avec le reste de la suite (qui
  // a besoin de nombreux appels /auth/login légitimes par ailleurs).
  const isolatedConfig = { ...config, sso: { ...config.sso, authRateLimitMax: 3, authRateLimitWindowMs: 60_000 } };
  const isolatedPort = 4592;
  isolatedConfig.sso.fakeProviderIssuer = `http://127.0.0.1:${isolatedPort}/auth/fake-provider`;
  const isolatedBaseUrl = `http://127.0.0.1:${isolatedPort}`;
  isolatedConfig.sso.allowedOrigins = [...isolatedConfig.sso.allowedOrigins, isolatedBaseUrl];
  const isolatedApp = createApp({ logger: silentLogger, pool, config: isolatedConfig });
  const isolatedServer = http.createServer(isolatedApp);
  await new Promise(resolve => isolatedServer.listen(isolatedPort, resolve));

  let sawLimit = false;
  for (let i = 0; i < 6; i++) {
    const res = await fetch(`${isolatedBaseUrl}/auth/login?scenario=success&subject=rl-${i}`, { redirect: 'manual' });
    if (res.status === 429) { sawLimit = true; break; }
  }
  assert.ok(sawLimit, 'la limite doit se déclencher rapidement avec un budget volontairement bas');
  isolatedServer.close();
});

// ── Non-régression ───────────────────────────────────────────────────

test('devAuth toujours fonctionnel -- /api/me répond normalement avec X-Storm-Dev-User', async () => {
  const { rows: [vivien] } = await pool.query("select id from users where email='vivien@parella.example'");
  if (!vivien) return; // seed non chargé dans cet environnement de test isolé -- non bloquant ici.
  const res = await fetch(`${baseUrl}/api/me`, { headers: { 'X-Storm-Dev-User': vivien.id } });
  assert.equal(res.status, 200);
});

test('aucun fallback -- ssoAuth n\'accepte jamais X-Storm-Dev-User à la place d\'un cookie de session', async () => {
  const { ssoAuth } = await import('../src/http/middleware/ssoAuth.js');
  const { rows: [vivien] } = await pool.query("select id from users where email='vivien@parella.example'");
  const middleware = ssoAuth({ pool, config });
  let calledNextWithError = null;
  const fakeReq = { headers: { 'x-storm-dev-user': vivien ? vivien.id : 'nimporte-quoi' } };
  await middleware(fakeReq, {}, (err) => { calledNextWithError = err; });
  assert.ok(calledNextWithError, 'doit refuser -- aucun cookie de session présent, X-Storm-Dev-User ignoré');
});
