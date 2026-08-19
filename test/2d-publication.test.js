import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { createApp } from '../src/http/app.js';
import { createStorageAdapter } from '../src/adapters/storage/index.js';

const config = loadConfig();
const pool = getPool(config);
const storageAdapter = createStorageAdapter(config);
const silentLogger = { info() {}, warn() {}, error() {} };

let app, server, baseUrl;
let ids = {};

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

test.before(async () => {
  await runMigrations();
  await cleanAll();

  const { rows: [tenantA] } = await pool.query("insert into tenants (name) values ('Tenant Publication A') returning id");
  const { rows: [editor] } = await pool.query("insert into users (email, display_name) values ('editor@publication.local','Editor Publication') returning id");
  const { rows: [viewer] } = await pool.query("insert into users (email, display_name) values ('viewer@publication.local','Viewer Publication') returning id");

  await pool.query('insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1,$2,$3)', [tenantA.id, editor.id, 'member']);
  await pool.query('insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1,$2,$3)', [tenantA.id, viewer.id, 'member']);

  const { rows: [project] } = await pool.query('insert into projects (tenant_id, name) values ($1,$2) returning id', [tenantA.id, 'Projet Publication']);
  // editor : bundle contient publication.publish. viewer : bundle
  // pilot, VIEW + PILOTAGE_VIEW seulement, jamais PUBLICATION_PUBLISH
  // ni CONTENT_EDIT — exactement le cas "a une relation légitime avec
  // le projet mais pas la capability requise" (403, pas 404).
  await pool.query('insert into project_memberships (tenant_id, project_id, user_id, permission_bundle) values ($1,$2,$3,$4)', [tenantA.id, project.id, editor.id, 'editor']);
  await pool.query('insert into project_memberships (tenant_id, project_id, user_id, permission_bundle) values ($1,$2,$3,$4)', [tenantA.id, project.id, viewer.id, 'pilot']);

  await pool.query(
    "insert into project_identity (tenant_id, project_id, theme, primary_color) values ($1,$2,'ivory','#1E1D1E')",
    [tenantA.id, project.id]
  );

  ids = { tenantA: tenantA.id, editor: editor.id, viewer: viewer.id, project: project.id };

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

// ── Slice 0 : pipeline complet Snapshot -> Candidate -> Compiler -> Manifest -> activation ──

test('Publication : pipeline complet réussit et produit un manifest V0 valide (Home uniquement)', async () => {
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  await fetch(`${baseUrl}/api/projects/${ids.project}/studio/section-content/homepage`, {
    method: 'PATCH', ...withUser(ids.editor),
    body: jsonBody({ fields: { message: 'Bienvenue', featuredArticleMode: 'latest', featuredArticleId: null, showMilestones: true, showAskPrompt: true, askPrompt: 'Une question ?' } })
  });

  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/publications`, { method: 'POST', ...withUser(ids.editor) });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.status, 'active');
  assert.equal(body.manifest.schemaVersion, 1);
  assert.equal(body.manifest.project.name, 'Projet Publication');
  assert.equal(body.manifest.edition.id, 'ivory');
  assert.deepEqual(body.manifest.modules, { home: true, timeline: false, spaces: false, news: false, questions: false, ambassadors: false, team: false });
  assert.deepEqual(body.manifest.navigation, []);
  assert.equal(body.manifest.content.home.message, 'Bienvenue');
  assert.equal(body.manifest.content.home.askPrompt, 'Une question ?');
  assert.equal(body.manifest.content.home.now, null);
  assert.equal(body.manifest.content.home.next, null);
  assert.equal(body.manifest.content.home.featured, null);

  const row = await pool.query('select status, snapshot, candidate, manifest from project_publications where id=$1', [body.id]);
  assert.equal(row.rows[0].status, 'active');
  assert.ok(row.rows[0].snapshot, 'le snapshot doit être conservé, pas seulement le manifest final');
  assert.ok(row.rows[0].candidate, 'le candidate doit être conservé pour diagnostic');
  // Invariant d'atomicité : le Snapshot capture TOUS les 6 domaines
  // Studio dès ce slice, même si le Candidate V0 n'en sélectionne qu'un.
  const snapshotKeys = Object.keys(row.rows[0].snapshot).sort();
  assert.deepEqual(snapshotKeys, ['ambassadors', 'articles', 'homepage', 'identity', 'leProjet', 'project', 'questions', 'spaces'].sort());

  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
});

test('Publication : askPrompt vide retombe sur le défaut, jamais une chaîne vide publiée', async () => {
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  await pool.query("delete from project_section_content where project_id=$1 and section_key='homepage'", [ids.project]);
  const patchRes = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/section-content/homepage`, {
    method: 'PATCH', ...withUser(ids.editor),
    body: jsonBody({ fields: { message: '', askPrompt: '', showMilestones: true, showAskPrompt: true, featuredArticleMode: 'latest', featuredArticleId: null } })
  });
  assert.equal(patchRes.status, 200, 'le PATCH de préparation doit réellement réussir avant de publier');

  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/publications`, { method: 'POST', ...withUser(ids.editor) });
  const body = await res.json();
  assert.equal(body.manifest.content.home.askPrompt, 'Une question sur le projet ?');

  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
});

test('Publication : révision entière séquentielle par projet, jamais réutilisée', async () => {
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  const r1 = await (await fetch(`${baseUrl}/api/projects/${ids.project}/publications`, { method: 'POST', ...withUser(ids.editor) })).json();
  const r2 = await (await fetch(`${baseUrl}/api/projects/${ids.project}/publications`, { method: 'POST', ...withUser(ids.editor) })).json();
  assert.equal(r1.revision, 1);
  assert.equal(r2.revision, 2);

  const rows = await pool.query('select revision, status from project_publications where project_id=$1 order by revision', [ids.project]);
  assert.deepEqual(rows.rows.map(r => r.status), ['superseded', 'active']);

  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
});

test('Publication : une seule publication active par projet — garanti par la DB, pas seulement l\'application', async () => {
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  await fetch(`${baseUrl}/api/projects/${ids.project}/publications`, { method: 'POST', ...withUser(ids.editor) });
  const activeRow = await pool.query("select id from project_publications where project_id=$1 and status='active'", [ids.project]);
  const activeId = activeRow.rows[0].id;

  // Tenter de forcer une deuxième ligne 'active' directement en base -> doit être refusé par l'index unique partiel.
  await assert.rejects(
    pool.query(
      `insert into project_publications (tenant_id, project_id, revision, status, created_by_user_id)
       values ($1,$2,999,'active',$3)`,
      [ids.tenantA, ids.project, ids.editor]
    ),
    /idx_project_publications_one_active_per_project/
  );

  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
});

test('Publication : concurrence réelle — 5 publications simultanées, aucune collision de révision, une seule active à la fin', async () => {
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);

  const results = await Promise.all(
    Array.from({ length: 5 }, () => fetch(`${baseUrl}/api/projects/${ids.project}/publications`, { method: 'POST', ...withUser(ids.editor) }).then(r => r.json()))
  );
  assert.equal(results.filter(r => r.status === 'active').length, 5, 'chaque requête doit réussir individuellement');
  const revisions = results.map(r => r.revision).sort((a, b) => a - b);
  assert.deepEqual(revisions, [1, 2, 3, 4, 5], 'les 5 révisions doivent être distinctes et consécutives, sans collision');

  const activeCount = await pool.query("select count(*)::int c from project_publications where project_id=$1 and status='active'", [ids.project]);
  assert.equal(activeCount.rows[0].c, 1, 'une seule publication active doit subsister après la concurrence');

  const supersededCount = await pool.query("select count(*)::int c from project_publications where project_id=$1 and status='superseded'", [ids.project]);
  assert.equal(supersededCount.rows[0].c, 4);

  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
});

test('Publication : édition non supportée -> failed, l\'ancienne publication active ne bouge jamais', async () => {
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  const first = await (await fetch(`${baseUrl}/api/projects/${ids.project}/publications`, { method: 'POST', ...withUser(ids.editor) })).json();
  assert.equal(first.status, 'active');

  await pool.query("update project_identity set theme='midnight' where project_id=$1", [ids.project]);

  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/publications`, { method: 'POST', ...withUser(ids.editor) });
  assert.equal(res.status, 422);
  const body = await res.json();
  assert.equal(body.status, 'failed');
  assert.equal(body.failureCode, 'EDITION_UNSUPPORTED');

  const rows = await pool.query('select revision, status from project_publications where project_id=$1 order by revision', [ids.project]);
  assert.deepEqual(rows.rows, [{ revision: 1, status: 'active' }, { revision: 2, status: 'failed' }]);

  await pool.query("update project_identity set theme='ivory' where project_id=$1", [ids.project]);
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
});

test('Publication : capability publication.publish requise — un pilot (VIEW seul) reçoit 403', async () => {
  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/publications`, { method: 'POST', ...withUser(ids.viewer) });
  assert.equal(res.status, 403);
});

test('Publication : GET publications/active reflète bien la publication en cours, 404 sinon', async () => {
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);

  const before = await fetch(`${baseUrl}/api/projects/${ids.project}/publications/active`, { headers: { 'X-Storm-Dev-User': ids.editor } });
  assert.equal(before.status, 404);

  const created = await (await fetch(`${baseUrl}/api/projects/${ids.project}/publications`, { method: 'POST', ...withUser(ids.editor) })).json();

  const after = await fetch(`${baseUrl}/api/projects/${ids.project}/publications/active`, { headers: { 'X-Storm-Dev-User': ids.editor } });
  assert.equal(after.status, 200);
  const activeBody = await after.json();
  assert.equal(activeBody.id, created.id);
  assert.equal(activeBody.revision, created.revision);

  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
});

test('Publication : isolation tenant/projet — un utilisateur sans membership reçoit 404, pas 403', async () => {
  const { rows: [otherUser] } = await pool.query("insert into users (email, display_name) values ('stranger@publication.local','Stranger') returning id");
  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/publications`, { method: 'POST', ...withUser(otherUser.id) });
  assert.equal(res.status, 404);
  await pool.query('delete from users where id=$1', [otherUser.id]);
});
