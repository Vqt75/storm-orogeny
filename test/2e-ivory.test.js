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
import { seedTenantMembership, seedProjectMembership } from './helpers/memberships.js';
import { findCurrentAccess, decryptCurrentCapability } from '../src/domain/publicAccess/repository.js';

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

async function publicUrlFor(projectId) {
  const access = await findCurrentAccess(pool, projectId);
  const raw = decryptCurrentCapability(access, config.publicAccessEncryptionKey);
  return `/public/${access.client_slug}/${access.project_slug}/${raw}`;
}

let app, server, baseUrl;
let ids = {};

const IVORY_DIR = path.join(process.cwd(), 'public', 'ivory');

async function cleanAll() {
  await pool.query('delete from project_publications');
  await pool.query('delete from project_section_content');
  await pool.query('delete from project_identity');
  await pool.query('delete from project_memberships');
  await pool.query('delete from tenant_memberships');
  await pool.query('delete from project_public_access');
  await pool.query('delete from projects');
  await pool.query('delete from users');
  await pool.query('delete from clients');
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
  await seedTenantMembership(pool, { tenantId: tenantA.id, userId: editor.id, permissionBundle: 'member' });
  const { rows: [client] } = await pool.query(
    "insert into clients (tenant_id, name, normalized_slug) values ($1,'Client Ivory E2E','client-ivory-e2e') returning id", [tenantA.id]
  );
  const { rows: [project] } = await pool.query('insert into projects (tenant_id, name, client_id) values ($1,$2,$3) returning id', [tenantA.id, 'Projet Ivory E2E', client.id]);
  await seedProjectMembership(pool, { tenantId: tenantA.id, projectId: project.id, userId: editor.id, permissionBundle: 'editor' });
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
  await fetch(`${baseUrl}/api/projects/${ids.project}/publications`, { method: 'POST', ...withUser(ids.editor) });
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  const res = await fetch(`${baseUrl}${await publicUrlFor(ids.project)}/manifest`);
  assert.equal(res.status, 404);
});

test('Ivory E2E : coquille publique se charge (200, html, contient le point de montage)', async () => {
  const res = await fetch(`${baseUrl}${await publicUrlFor(ids.project)}`);
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
  const res2 = await fetch(`${baseUrl}${await publicUrlFor(ids.project)}/manifest`);
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

  const manifest = await (await fetch(`${baseUrl}${await publicUrlFor(ids.project)}/manifest`)).json();
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

  const manifest = await (await fetch(`${baseUrl}${await publicUrlFor(ids.project)}/manifest`)).json();
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

  const imgRes = await fetch(`${baseUrl}${await publicUrlFor(ids.project)}/assets/${pngAsset}.png`);
  assert.equal(imgRes.status, 200);
  assert.equal(imgRes.headers.get('content-type'), 'image/png');

  const pdfRes = await fetch(`${baseUrl}${await publicUrlFor(ids.project)}/assets/${pdfAsset}.pdf`);
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

test('Ivory public shell has only local style/runtime dependencies',()=>{
 const html=fs.readFileSync(path.join(IVORY_DIR,'index.html'),'utf8');
 assert.match(html,/ivory\/ivory\.css/);assert.doesNotMatch(html,/googleapis|gstatic|brand-engine/);
});

async function publicKnowledgeFixture(questions=[]) {
  await pool.query('delete from project_publications where project_id=$1',[ids.project]);
  await pool.query('delete from project_questions where project_id=$1',[ids.project]);
  await pool.query(`insert into project_settings(tenant_id,project_id,workspace_locale,content_locale) values($1,$2,'en','fr') on conflict(project_id) do update set content_locale='fr'`,[ids.tenantA,ids.project]);
  for(const [index,q] of questions.entries())await pool.query('insert into project_questions(tenant_id,project_id,question,answer_runs,position) values($1,$2,$3,$4,$5)',[ids.tenantA,ids.project,q.title,JSON.stringify([{text:q.answer}]),index]);
  const response=await publish(ids.editor,ids.project);assert.equal(response.status,201);const publication=await response.json();
  return {publication,url:baseUrl+await publicUrlFor(ids.project)};
}
test('Ivory server boundary: covered exact answer, ambiguity without merged answer, notCovered',async()=>{
  const {publication,url}=await publicKnowledgeFixture([{title:'Comment participer au collectif ?',answer:'La réponse exacte.'},{title:'Réserver atelier',answer:'Atelier uniquement.'},{title:'Réserver rencontre',answer:'Rencontre uniquement.'},{title:' ',answer:'Invisible'},{title:'Sans réponse',answer:' '}]);
  const knowledge=await (await fetch(url+'/knowledge')).json();
  assert.equal(knowledge.corpusState,'CORPUS_READY');assert.equal(knowledge.entries.length,3);assert.equal(knowledge.corpus,undefined);assert.equal(knowledge.tenantId,undefined);
  const ask=query=>fetch(url+'/match',{method:'POST',headers:{'Content-Type':'application/json',Origin:baseUrl},body:jsonBody({query,locale:'fr',publicationRevision:publication.revision})}).then(r=>r.json());
  const covered=await ask('Comment participer au collectif ?');assert.equal(covered.result.state,'covered');assert.equal(covered.result.answer,'La réponse exacte.');
  const ambiguous=await ask('Réserver');assert.equal(ambiguous.result.state,'ambiguous');assert.equal(ambiguous.result.candidates.length,2);assert.equal(ambiguous.result.answer,undefined);assert.ok(ambiguous.result.candidates.every(c=>c.answer===undefined));
  const missed=await ask('astronomie quantique');assert.deepEqual(missed.result,{state:'notCovered'});
  assert.equal((await fetch(url+'/knowledge')).headers.get('Cache-Control'),'no-store');
});
test('Ivory server boundary: injected facts, foreign origin, stale publication and locale rejected',async()=>{
  const {publication,url}=await publicKnowledgeFixture([{title:'Participer',answer:'Réponse'}]);
  const payload={query:'Participer',locale:'fr',publicationRevision:publication.revision};
  const post=(body,origin=baseUrl)=>fetch(url+'/match',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:jsonBody(body)});
  for(const key of ['decision','answer','corpus','caller','selectedEntry'])assert.equal((await post({...payload,[key]:'Injected'})).status,400);
  assert.equal((await post(payload,'https://foreign.example')).status,403);
  assert.equal((await fetch(url+'/match',{method:'POST',headers:{'Content-Type':'application/json'},body:jsonBody(payload)})).status,403);
  assert.equal((await (await post({...payload,locale:'en'})).json()).corpusState,'CORPUS_UNAVAILABLE');
  assert.equal((await (await post({...payload,publicationRevision:publication.revision+1})).json()).corpusState,'CORPUS_UNAVAILABLE');
});
test('Ivory server boundary: empty distinct from unavailable, publication site remains available',async()=>{
  const {publication,url}=await publicKnowledgeFixture([{title:' ',answer:'Non éligible'},{title:'Sans réponse',answer:' '}]);
  assert.equal((await (await fetch(url+'/knowledge')).json()).corpusState,'CORPUS_EMPTY');
  await pool.query("update project_publications set manifest=jsonb_set(manifest,'{meta,generatedAt}','\"invalid\"'::jsonb) where id=$1",[publication.id]);
  assert.equal((await (await fetch(url+'/knowledge')).json()).corpusState,'CORPUS_UNAVAILABLE');
  assert.equal((await fetch(url)).status,200);assert.equal((await fetch(url+'/manifest')).status,200);
  assert.equal((await fetch(url+'/knowledge')).headers.get('X-Robots-Tag'),'noindex');
  assert.equal((await fetch(url+'/knowledge')).headers.get('Referrer-Policy'),'no-referrer');
  assert.equal((await fetch(url.replace(/\/$/, '')+'/../foreign/knowledge')).status,404);
});
