import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { createApp } from '../src/http/app.js';
import { createStorageAdapter } from '../src/adapters/storage/index.js';

// Branchement Ivory — suite E2E permanente, volontairement réduite.
//
// L'audit du branchement Ivory a été vérifié en conditions réelles
// avec un navigateur headless (35 vérifications Playwright, ad hoc,
// documentées dans la conversation, jamais committées) : rendu
// complet, toggles, cycle publier/republier, assets, navigation,
// mobile. Cette suite-ci ne reproduit pas ces 35 scénarios -- trop
// lourds et trop spécifiques pour tourner à chaque `npm test`. Elle
// garde uniquement les invariants structurants, plus deux garde-fous
// de régression au niveau source ciblant précisément les deux vrais
// bugs trouvés pendant l'implémentation :
//   1. des dépendances JS oubliées lors du portage (faq-engine.js/
//      mood-engine.js, découvert via une vraie 404 navigateur) ;
//   2. le contenu POC Tectonic qui pourrait réapparaître si quelqu'un
//      réintroduit fallbackProjectContent() par erreur plus tard.
//
// Délibérément SANS Playwright/navigateur, cohérent avec le reste de
// cette suite (node:test + fetch brut uniquement, aucun autre fichier
// de test du repo n'utilise de navigateur) : les invariants qui
// nécessitent une exécution JS réelle (rendu conditionnel des toggles,
// absence d'erreur JS bloquante) sont vérifiés soit via le contenu du
// Manifest lui-même (déjà couvert par les tests du Compiler), soit via
// des garde-fous au niveau du code source d'Ivory.

const config = loadConfig();
const pool = getPool(config);
const storageAdapter = createStorageAdapter(config);
const silentLogger = { info() {}, warn() {}, error() {} };

let app, server, baseUrl;
let ids = {};

const IVORY_DIR = path.join(process.cwd(), 'public', 'ivory');

async function cleanAll() {
  await pool.query('delete from project_publications');
  await pool.query('delete from project_section_content');
  await pool.query('delete from project_identity');
  await pool.query('delete from project_memberships');
  await pool.query('delete from tenant_memberships');
  await pool.query('delete from projects');
  await pool.query('delete from users');
  await pool.query('delete from tenants');
}

function withUser(userId) {
  return { headers: { 'X-Storm-Dev-User': userId, 'Content-Type': 'application/json' } };
}
function jsonBody(obj) { return JSON.stringify(obj); }

async function patchHomepage(userId, projectId, fields) {
  const current = await (await fetch(`${baseUrl}/api/projects/${projectId}/studio/section-content/homepage`, { headers: { 'X-Storm-Dev-User': userId } })).json();
  return fetch(`${baseUrl}/api/projects/${projectId}/studio/section-content/homepage`, {
    method: 'PATCH', ...withUser(userId), body: jsonBody({ fields, version: current.version ?? undefined })
  });
}
async function publish(userId, projectId) {
  return fetch(`${baseUrl}/api/projects/${projectId}/publications`, { method: 'POST', headers: { 'X-Storm-Dev-User': userId } });
}

test.before(async () => {
  await runMigrations();
  await cleanAll();

  const { rows: [tenantA] } = await pool.query("insert into tenants (name) values ('Tenant Ivory E2E') returning id");
  const { rows: [editor] } = await pool.query("insert into users (email, display_name) values ('editor@ivory-e2e.local','Editor Ivory E2E') returning id");
  await pool.query('insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1,$2,$3)', [tenantA.id, editor.id, 'member']);
  const { rows: [project] } = await pool.query('insert into projects (tenant_id, name) values ($1,$2) returning id', [tenantA.id, 'Projet Ivory E2E']);
  await pool.query('insert into project_memberships (tenant_id, project_id, user_id, permission_bundle) values ($1,$2,$3,$4)', [tenantA.id, project.id, editor.id, 'editor']);
  await pool.query("insert into project_identity (tenant_id, project_id, theme, primary_color) values ($1,$2,'ivory','#1E1D1E')", [tenantA.id, project.id]);

  ids = { tenantA: tenantA.id, editor: editor.id, project: project.id };

  app = createApp({ logger: silentLogger, pool, config, storageAdapter });
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await cleanAll();
  server.close();
  await closePool();
});

// ── Invariants HTTP structurants ──

test('Ivory E2E : aucune publication active -> manifest public 404 propre', async () => {
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  const res = await fetch(`${baseUrl}/public/projects/${ids.project}/manifest`);
  assert.equal(res.status, 404);
});

test('Ivory E2E : coquille publique se charge (200, html, contient le point de montage)', async () => {
  const res = await fetch(`${baseUrl}/public/projects/${ids.project}`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /html/);
  const body = await res.text();
  assert.match(body, /id="tectonic-root"/);
  assert.match(body, /\/ivory\/runtime\.js/);
});

test('Ivory E2E : publication active -> manifest servi avec Cache-Control: no-store', async () => {
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  const res1 = await publish(ids.editor, ids.project);
  assert.equal(res1.status, 201);
  const res2 = await fetch(`${baseUrl}/public/projects/${ids.project}/manifest`);
  assert.equal(res2.status, 200);
  assert.equal(res2.headers.get('cache-control'), 'no-store');
  const manifest = await res2.json();
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.edition.id, 'ivory');
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
});

test('Ivory E2E : modification Studio sans republier laisse le manifest public inchangé', async () => {
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  await pool.query("delete from project_section_content where project_id=$1 and section_key='homepage'", [ids.project]);
  await patchHomepage(ids.editor, ids.project, { message: 'Message original' });
  await publish(ids.editor, ids.project);

  await patchHomepage(ids.editor, ids.project, { message: 'Message modifié, jamais republié' });

  const manifest = await (await fetch(`${baseUrl}/public/projects/${ids.project}/manifest`)).json();
  assert.equal(manifest.content.home.message, 'Message original', 'une modification Studio sans republier ne doit jamais atteindre le manifest public');

  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  await pool.query("delete from project_section_content where project_id=$1 and section_key='homepage'", [ids.project]);
});

test('Ivory E2E : republier fait apparaître le nouveau contenu dans le manifest public', async () => {
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  await pool.query("delete from project_section_content where project_id=$1 and section_key='homepage'", [ids.project]);
  await patchHomepage(ids.editor, ids.project, { message: 'Avant republication' });
  await publish(ids.editor, ids.project);
  await patchHomepage(ids.editor, ids.project, { message: 'Après republication' });
  await publish(ids.editor, ids.project);

  const manifest = await (await fetch(`${baseUrl}/public/projects/${ids.project}/manifest`)).json();
  assert.equal(manifest.content.home.message, 'Après republication');

  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  await pool.query("delete from project_section_content where project_id=$1 and section_key='homepage'", [ids.project]);
});

test('Ivory E2E : asset public image et PDF référencés par la publication active se chargent réellement', async () => {
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a4944415478da63600000020001557f6e5c0000000049454e44ae426082', 'hex');
  const pdf = Buffer.from('%PDF-1.4\n%fake\n', 'ascii');

  async function upload(kind, buf, mime, filename) {
    const fd = new FormData();
    fd.append('kind', kind);
    fd.append('file', new Blob([buf], { type: mime }), filename);
    const res = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/assets`, { method: 'POST', headers: { 'X-Storm-Dev-User': ids.editor }, body: fd });
    return (await res.json()).assetId;
  }
  const pngAsset = await upload('space_media', png, 'image/png', 'x.png');
  const pdfAsset = await upload('space_media', pdf, 'application/pdf', 'x.pdf');

  const space = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/spaces`, {
    method: 'POST', ...withUser(ids.editor),
    body: jsonBody({ name: 'Espace E2E', position: 0, media: [{ kind: 'view', assetId: pngAsset, position: 0 }, { kind: 'document', assetId: pdfAsset, position: 1 }] })
  })).json();
  await publish(ids.editor, ids.project);

  const imgRes = await fetch(`${baseUrl}/public/projects/${ids.project}/assets/${pngAsset}.png`);
  assert.equal(imgRes.status, 200);
  assert.equal(imgRes.headers.get('content-type'), 'image/png');

  const pdfRes = await fetch(`${baseUrl}/public/projects/${ids.project}/assets/${pdfAsset}.pdf`);
  assert.equal(pdfRes.status, 200);
  assert.equal(pdfRes.headers.get('content-type'), 'application/pdf');

  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  await pool.query('delete from project_spaces where id=$1', [space.id]);
  await pool.query('delete from assets where id = ANY($1)', [[pngAsset, pdfAsset]]);
});

// ── Garde-fous de régression au niveau source — ciblent précisément
// les deux vrais bugs trouvés pendant l'implémentation ──

test('Ivory E2E (garde-fou) : toutes les dépendances JS statiques importées par runtime.js/ivory.js existent réellement sur disque', () => {
  // Trouvé une fois via une vraie 404 navigateur (faq-engine.js et
  // mood-engine.js oubliés lors du portage) : ce test empêche qu'une
  // dépendance manquante ne redevienne visible uniquement en ouvrant
  // un navigateur.
  const filesToCheck = [
    path.join(IVORY_DIR, 'runtime.js'),
    path.join(IVORY_DIR, 'renderers', 'ivory.js')
  ];
  for (const file of filesToCheck) {
    const source = fs.readFileSync(file, 'utf8');
    const importPaths = [...source.matchAll(/^import\s+.*?from\s+['"](\.[^'"]+)['"]/gm)].map(m => m[1]);
    for (const importPath of importPaths) {
      const resolved = path.resolve(path.dirname(file), importPath);
      assert.ok(fs.existsSync(resolved), `dépendance importée introuvable sur disque : ${importPath} (depuis ${path.basename(file)})`);
    }
  }
});

test('Ivory E2E (garde-fou) : renderHome() lit home.now/home.next/home.featured/home.latest directement, aucun recalcul current/upcoming réintroduit', () => {
  const source = fs.readFileSync(path.join(IVORY_DIR, 'renderers', 'ivory.js'), 'utf8');
  assert.ok(!/currentMilestone\s*\(/.test(source), 'currentMilestone() ne doit jamais être réintroduite -- home.now vient exclusivement du Compiler');
  assert.ok(!/nextMilestone\s*\(/.test(source), 'nextMilestone() ne doit jamais être réintroduite -- home.next vient exclusivement du Compiler');
  assert.ok(/home\.latest/.test(source), 'renderHome() doit lire home.latest, jamais recalculer "la dernière actualité hors featured" elle-même');
});

test('Ivory E2E (garde-fou) : showMilestones/showAskPrompt toujours consultés dans renderHome()', () => {
  const source = fs.readFileSync(path.join(IVORY_DIR, 'renderers', 'ivory.js'), 'utf8');
  const renderHomeMatch = source.match(/function renderHome\([^)]*\)\s*\{[\s\S]*?\n\}\n/);
  assert.ok(renderHomeMatch, 'renderHome() introuvable');
  const body = renderHomeMatch[0];
  assert.match(body, /showMilestones/, 'showMilestones doit rester consulté dans renderHome()');
  assert.match(body, /showAskPrompt/, 'showAskPrompt doit rester consulté dans renderHome()');
});

test('Ivory E2E (garde-fou) : aucun contenu POC Tectonic (fallbackProjectContent) ne doit jamais réapparaître', () => {
  const source = fs.readFileSync(path.join(IVORY_DIR, 'renderers', 'ivory.js'), 'utf8');
  assert.ok(!source.includes('fallbackProjectContent'), 'le contenu POC fabriqué ne doit jamais être réintroduit');
  // Phrase spécifique au fallback retiré -- jamais une donnée de démo
  // FAQ légitime par ailleurs présente dans le fichier (demoMode).
  assert.ok(!source.includes('Un nouvel environnement pour travailler autrement'));
});

test('Ivory E2E (garde-fou) : mécanisme d\'auth Tectonic retiré du CODE VIVANT (constante/fonction, pas un simple mot dans un commentaire)', () => {
  const source = fs.readFileSync(path.join(IVORY_DIR, 'renderers', 'ivory.js'), 'utf8');
  assert.ok(!/const\s+ADMIN_TOKEN_KEY/.test(source), 'la constante de token ne doit jamais être réintroduite');
  assert.ok(!/href="\/admin"/.test(source), 'le lien direct vers /admin (mécanisme Tectonic) ne doit jamais être réintroduit');
  assert.ok(!/function\s+ensureAdminAuthOverlay/.test(source), 'l\'overlay de connexion Tectonic ne doit jamais être réintroduit');
  assert.match(source, /studioUrlFromLocation/, 'le lien Administration doit passer par le calcul d\'URL Studio Orogeny réelle');
});
