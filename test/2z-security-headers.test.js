import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { createApp } from '../src/http/app.js';
import { createStorageAdapter } from '../src/adapters/storage/index.js';
import { seedTenantMembership, seedProjectMembership } from './helpers/memberships.js';

// Headers de sécurité -- fermeture d'un bug réel signalé par
// l'utilisateur ("les previews sont cassés à chaque fois dans Storm
// Studio"). Audit : le pattern de chargement d'assets utilisé partout
// (Studio Identité/Ambassadeurs/Actualités/Espaces/Le projet, Control,
// project-shell) assigne img.src = URL.createObjectURL(blob) pour
// contourner le fait qu'un <img src="/api/assets/:id"> classique ne
// peut jamais envoyer l'en-tête d'authentification requis (devAuth ne
// résout l'identité que via l'en-tête X-Storm-Dev-User, jamais une
// query string ni un cookie). La CSP précédente n'avait aucune
// directive img-src explicite -- retombée sur default-src 'self', qui
// n'autorise jamais les URL blob:. Le navigateur bloquait donc
// silencieusement l'affichage (violation CSP sur le chargement de la
// ressource, jamais une exception JS catchable), produisant une icône
// d'image cassée systématique -- invisible côté serveur (curl/tests
// HTTP ne déclenchent jamais de CSP) et invisible dans la suite de
// tests existante (entièrement HTTP-level).

const config = loadConfig();
const pool = getPool(config);
const storageAdapter = createStorageAdapter(config);
const silentLogger = { info() {}, warn() {}, error() {} };

let app, server, baseUrl;

test.before(async () => {
  await runMigrations();
  app = createApp({ logger: silentLogger, pool, config, storageAdapter });
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

test.after(async () => {
  server.close();
  await closePool();
});

test('CSP autorise img-src blob: -- corrige le blocage silencieux des aperçus d\'assets (logos, photos) partout dans l\'application', async () => {
  const res = await fetch(`${baseUrl}/`);
  const csp = res.headers.get('content-security-policy');
  assert.ok(csp, 'la CSP doit être présente');
  assert.match(csp, /img-src[^;]*\bblob:/, 'img-src doit explicitement autoriser blob: -- jamais une dépendance implicite à default-src');
  assert.match(csp, /img-src[^;]*'self'/, 'img-src doit aussi autoriser les images same-origin');
});

test('CSP reste appliquée de façon identique sur toutes les surfaces HTML (Studio, Control, project-shell, Home, Meet Storm)', async () => {
  const routes = ['/', '/control', '/meet'];
  for (const route of routes) {
    const res = await fetch(`${baseUrl}${route}`);
    const csp = res.headers.get('content-security-policy');
    assert.match(csp, /img-src[^;]*\bblob:/, `${route} doit recevoir la même CSP corrigée`);
  }
});

test('les autres directives CSP restent inchangées -- cette fermeture ajoute uniquement img-src, ne relâche rien d\'autre', async () => {
  const res = await fetch(`${baseUrl}/`);
  const csp = res.headers.get('content-security-policy');
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self' 'unsafe-inline'/);
  assert.match(csp, /style-src 'self' 'unsafe-inline'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
});

test('autres headers de sécurité inchangés (non-régression)', async () => {
  const res = await fetch(`${baseUrl}/`);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
});

// ── BOUT EN BOUT — reproduction exacte du scénario signalé ───────────

let e2eIds;

test('setup bout-en-bout', async () => {
  await pool.query("delete from projects where name='Projet CSP E2E'");
  await pool.query("delete from users where email='csp-e2e@test.local'");
  await pool.query("delete from tenants where name='Tenant CSP E2E'");

  const { rows: [tenant] } = await pool.query("insert into tenants (name) values ('Tenant CSP E2E') returning id");
  const { rows: [user] } = await pool.query("insert into users (email, display_name) values ('csp-e2e@test.local','CSP E2E') returning id");
  const { rows: [project] } = await pool.query("insert into projects (tenant_id, name) values ($1,'Projet CSP E2E') returning id", [tenant.id]);
  await pool.query('insert into project_identity (tenant_id, project_id) values ($1,$2)', [tenant.id, project.id]);
  await seedTenantMembership(pool, { tenantId: tenant.id, userId: user.id, permissionBundle: 'member' });
  await seedProjectMembership(pool, { tenantId: tenant.id, projectId: project.id, userId: user.id, permissionBundle: 'project_admin' });
  e2eIds = { tenantId: tenant.id, projectId: project.id, userId: user.id };
});

test('scénario réel complet -- upload logo, fetch authentifié réussi, et la CSP corrigée autoriserait désormais son affichage', async () => {
  // Un vrai PNG minimal, comme le ferait un vrai fichier uploadé --
  // jamais un mock qui court-circuite la logique de validation réelle
  // (signature de fichier vérifiée par la route).
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a4944415478da63600000020001557f6e5c0000000049454e44ae426082', 'hex');
  const form = new FormData();
  form.append('logo', new Blob([png], { type: 'image/png' }), 'logo.png');

  const uploadRes = await fetch(`${baseUrl}/api/projects/${e2eIds.projectId}/logo`, {
    method: 'POST',
    headers: { 'X-Storm-Dev-User': e2eIds.userId },
    body: form
  });
  assert.equal(uploadRes.status, 201, 'upload réel doit réussir');
  const { assetId } = await uploadRes.json();
  assert.ok(assetId);

  // Exactement le même appel que loadAssetImages()/getBlob() dans le
  // navigateur -- fetch authentifié, jamais un <img src> direct.
  const assetRes = await fetch(`${baseUrl}/api/assets/${assetId}`, {
    headers: { 'X-Storm-Dev-User': e2eIds.userId }
  });
  assert.equal(assetRes.status, 200, 'l\'asset doit être récupérable avec l\'en-tête d\'authentification');
  assert.equal(assetRes.headers.get('content-type'), 'image/png');
  const buffer = Buffer.from(await assetRes.arrayBuffer());
  assert.ok(buffer.length > 0, 'le contenu de l\'image doit être réellement présent, jamais vide/corrompu');

  // Preuve que la CSP de la page qui affichera cette image (via
  // img.src = URL.createObjectURL(blob)) autorise désormais blob: --
  // avant le correctif, cette assignation aurait été bloquée
  // silencieusement par le navigateur malgré ce fetch 200 réussi.
  const pageRes = await fetch(`${baseUrl}/`);
  const csp = pageRes.headers.get('content-security-policy');
  assert.match(csp, /img-src[^;]*\bblob:/, 'la page qui affichera cette image via blob: doit être couverte par la CSP corrigée');

  await pool.query('delete from assets where id=$1', [assetId]);
  await pool.query('delete from project_memberships where project_id=$1', [e2eIds.projectId]);
  await pool.query('delete from tenant_memberships where tenant_id=$1', [e2eIds.tenantId]);
  await pool.query('delete from projects where id=$1', [e2eIds.projectId]);
  await pool.query('delete from users where id=$1', [e2eIds.userId]);
  await pool.query('delete from tenants where id=$1', [e2eIds.tenantId]);
});
