import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { createApp } from '../src/http/app.js';
import { createProviderRegistry } from '../src/domain/providers/providerRegistry.js';

// SSO / External Identity V1 — fermeture technique Batch 2 : fake
// provider jamais actif en production, secrets jamais silencieux,
// trust proxy/client IP jamais deviné. Aucun changement d'AuthN actif
// dans ce fichier -- uniquement des vérifications de durcissement.

const config = loadConfig();
const pool = getPool(config);
const silentLogger = { info() {}, warn() {}, error() {} };

test.after(async () => {
  await closePool();
});

// ── Fake provider jamais actif en production ────────────────────────

test('en développement -- /auth/fake-provider/authorize existe réellement', async () => {
  await runMigrations();
  const devConfig = { ...config, isProduction: false, sso: { ...config.sso, fakeProviderIssuer: 'http://127.0.0.1:4671/auth/fake-provider' } };
  const app = createApp({ logger: silentLogger, pool, config: devConfig });
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(4671, resolve));

  const res = await fetch('http://127.0.0.1:4671/auth/fake-provider/authorize?state=x&nonce=y&scenario=success', { redirect: 'manual' });
  assert.equal(res.status, 302, 'la route doit exister et rediriger en développement');

  server.close();
});

test('en production -- /auth/fake-provider/authorize n\'est jamais montée (404)', async () => {
  const prodConfig = {
    ...config,
    isProduction: true,
    sso: { ...config.sso, fakeProviderIssuer: 'http://127.0.0.1:4672/auth/fake-provider' },
    security: { trustProxyHops: 0 }
  };
  const app = createApp({ logger: silentLogger, pool, config: prodConfig });
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(4672, resolve));

  const res = await fetch('http://127.0.0.1:4672/auth/fake-provider/authorize?state=x&nonce=y&scenario=success', { redirect: 'manual' });
  assert.equal(res.status, 404, 'la route ne doit jamais exister en production');

  server.close();
});

test('en production -- le registre de providers ne contient jamais fake, quelle que soit la config', async () => {
  const prodConfig = { ...config, isProduction: true };
  const registry = createProviderRegistry(prodConfig);
  assert.equal(registry.getByProviderType('fake'), undefined, 'fake ne doit jamais être résolvable en production');
  assert.equal(registry.getDefaultProviderType(), undefined, 'aucun provider par défaut en production sans provider réel configuré');
  assert.equal(registry.isTrustedIssuer('fake', prodConfig.sso.fakeProviderIssuer), false, 'fake ne doit jamais devenir un issuer trusted en production');
});

test('en production, sans provider réel configuré -- /auth/login échoue proprement, jamais un repli automatique vers fake', async () => {
  const prodConfig = {
    ...config,
    isProduction: true,
    sso: { ...config.sso, fakeProviderIssuer: 'http://127.0.0.1:4673/auth/fake-provider' },
    security: { trustProxyHops: 0 }
  };
  const app = createApp({ logger: silentLogger, pool, config: prodConfig });
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(4673, resolve));

  const res = await fetch('http://127.0.0.1:4673/auth/login?scenario=success', { redirect: 'manual' });
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.equal(body.error.code, 'PROVIDER_NOT_CONFIGURED');

  server.close();
});

// ── Secrets production ───────────────────────────────────────────────

test('secret de transaction manquant en production -- le démarrage échoue (loadConfig lève), jamais une valeur générée silencieusement', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalSecret = process.env.SSO_TRANSACTION_SIGNING_SECRET;
  const originalTrustProxy = process.env.TRUST_PROXY_HOPS;
  const originalDbPassword = process.env.DB_PASSWORD;
  const originalPublicAccessKey = process.env.PUBLIC_ACCESS_ENCRYPTION_KEY;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.SSO_TRANSACTION_SIGNING_SECRET;
    process.env.TRUST_PROXY_HOPS = '1';
    process.env.DB_PASSWORD = 'peu-importe-ici';
    // Clé valide fournie -- ce test isole SSO_TRANSACTION_SIGNING_SECRET,
    // jamais PUBLIC_ACCESS_ENCRYPTION_KEY (testée séparément, voir
    // 3d-public-access.test.js).
    process.env.PUBLIC_ACCESS_ENCRYPTION_KEY = 'mzVorA0hd1WmChIuRzM9hGg/JtDgPM9OaYFzm1iu77g=';
    assert.throws(() => loadConfig(), /SSO_TRANSACTION_SIGNING_SECRET/);
  } finally {
    process.env.NODE_ENV = originalEnv;
    if (originalSecret !== undefined) process.env.SSO_TRANSACTION_SIGNING_SECRET = originalSecret; else delete process.env.SSO_TRANSACTION_SIGNING_SECRET;
    if (originalTrustProxy !== undefined) process.env.TRUST_PROXY_HOPS = originalTrustProxy; else delete process.env.TRUST_PROXY_HOPS;
    if (originalDbPassword !== undefined) process.env.DB_PASSWORD = originalDbPassword; else delete process.env.DB_PASSWORD;
    if (originalPublicAccessKey !== undefined) process.env.PUBLIC_ACCESS_ENCRYPTION_KEY = originalPublicAccessKey; else delete process.env.PUBLIC_ACCESS_ENCRYPTION_KEY;
  }
});

test('TRUST_PROXY_HOPS manquant en production -- le démarrage échoue, jamais une valeur devinée', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalTrustProxy = process.env.TRUST_PROXY_HOPS;
  const originalSecret = process.env.SSO_TRANSACTION_SIGNING_SECRET;
  const originalDbPassword = process.env.DB_PASSWORD;
  const originalPublicAccessKey = process.env.PUBLIC_ACCESS_ENCRYPTION_KEY;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.TRUST_PROXY_HOPS;
    process.env.SSO_TRANSACTION_SIGNING_SECRET = 'peu-importe-ici';
    process.env.DB_PASSWORD = 'peu-importe-ici';
    process.env.PUBLIC_ACCESS_ENCRYPTION_KEY = 'mzVorA0hd1WmChIuRzM9hGg/JtDgPM9OaYFzm1iu77g=';
    assert.throws(() => loadConfig(), /TRUST_PROXY_HOPS/);
  } finally {
    process.env.NODE_ENV = originalEnv;
    if (originalTrustProxy !== undefined) process.env.TRUST_PROXY_HOPS = originalTrustProxy; else delete process.env.TRUST_PROXY_HOPS;
    if (originalSecret !== undefined) process.env.SSO_TRANSACTION_SIGNING_SECRET = originalSecret; else delete process.env.SSO_TRANSACTION_SIGNING_SECRET;
    if (originalDbPassword !== undefined) process.env.DB_PASSWORD = originalDbPassword; else delete process.env.DB_PASSWORD;
    if (originalPublicAccessKey !== undefined) process.env.PUBLIC_ACCESS_ENCRYPTION_KEY = originalPublicAccessKey; else delete process.env.PUBLIC_ACCESS_ENCRYPTION_KEY;
  }
});

// ── Trust proxy / client IP réel ─────────────────────────────────────

test('trustProxyHops=0 -- X-Forwarded-For envoyé par le client est IGNORÉ, jamais utilisé comme req.ip', async () => {
  const testConfig = {
    ...config,
    security: { trustProxyHops: 0 },
    sso: { ...config.sso, authRateLimitMax: 2, authRateLimitWindowMs: 60_000, fakeProviderIssuer: 'http://127.0.0.1:4674/auth/fake-provider' }
  };
  const app = createApp({ logger: silentLogger, pool, config: testConfig });
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(4674, resolve));

  // Deux X-Forwarded-For DIFFÉRENTS, trustProxyHops=0 -- doivent
  // partager le MÊME budget (le header est ignoré, req.ip reste
  // l'adresse socket réelle, identique pour les deux appels).
  const r1 = await fetch('http://127.0.0.1:4674/auth/login?scenario=success', { redirect: 'manual', headers: { 'X-Forwarded-For': '1.2.3.4' } });
  const r2 = await fetch('http://127.0.0.1:4674/auth/login?scenario=success', { redirect: 'manual', headers: { 'X-Forwarded-For': '9.9.9.9' } });
  const r3 = await fetch('http://127.0.0.1:4674/auth/login?scenario=success', { redirect: 'manual', headers: { 'X-Forwarded-For': '5.5.5.5' } });
  assert.equal(r1.status, 302);
  assert.equal(r2.status, 302);
  assert.equal(r3.status, 429, 'le 3e appel doit être limité -- même budget malgré des X-Forwarded-For différents');

  server.close();
});

test('trustProxyHops=1 -- X-Forwarded-For fait foi, deux IP différentes ont des budgets distincts', async () => {
  const testConfig = {
    ...config,
    security: { trustProxyHops: 1 },
    sso: { ...config.sso, authRateLimitMax: 2, authRateLimitWindowMs: 60_000, fakeProviderIssuer: 'http://127.0.0.1:4675/auth/fake-provider' }
  };
  const app = createApp({ logger: silentLogger, pool, config: testConfig });
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(4675, resolve));

  // IP A : 2 appels (consomme tout son budget de 2), 3e refusé.
  const a1 = await fetch('http://127.0.0.1:4675/auth/login?scenario=success', { redirect: 'manual', headers: { 'X-Forwarded-For': '10.0.0.1' } });
  const a2 = await fetch('http://127.0.0.1:4675/auth/login?scenario=success', { redirect: 'manual', headers: { 'X-Forwarded-For': '10.0.0.1' } });
  const a3 = await fetch('http://127.0.0.1:4675/auth/login?scenario=success', { redirect: 'manual', headers: { 'X-Forwarded-For': '10.0.0.1' } });
  assert.equal(a1.status, 302);
  assert.equal(a2.status, 302);
  assert.equal(a3.status, 429);

  // IP B, différente -- doit avoir son PROPRE budget, jamais affectée
  // par la consommation de l'IP A.
  const b1 = await fetch('http://127.0.0.1:4675/auth/login?scenario=success', { redirect: 'manual', headers: { 'X-Forwarded-For': '10.0.0.2' } });
  assert.equal(b1.status, 302, 'une IP différente ne doit jamais hériter du budget épuisé d\'une autre');

  server.close();
});
