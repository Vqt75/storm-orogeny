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
// (mis à jour Slice 1 : news/questions désormais réellement actifs, jamais figé à l'état Slice 0)

test('Publication : pipeline complet réussit et produit un manifest valide (Home + Actualités + Questions)', async () => {
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  await pool.query("delete from project_articles where project_id=$1", [ids.project]);
  await pool.query("delete from project_questions where project_id=$1", [ids.project]);
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
  assert.deepEqual(body.manifest.modules, { home: true, timeline: false, spaces: true, news: true, questions: true, ambassadors: true, team: false });
  assert.deepEqual(body.manifest.navigation.map(n => n.module), ['questions', 'news', 'spaces', 'ambassadors']);
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
  assert.deepEqual(snapshotKeys, ['ambassadors', 'articles', 'assetContentTypes', 'homepage', 'identity', 'leProjet', 'project', 'questions', 'spaces'].sort());

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

// ── Slice 1 : Actualités + Questions dans le Candidate/Manifest ──

async function uploadTestImage() {
  const fd = new FormData();
  fd.append('kind', 'article_image');
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a4944415478da63600000020001557f6e5c0000000049454e44ae426082', 'hex');
  fd.append('file', new Blob([png], { type: 'image/png' }), 'x.png');
  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/assets`, { method: 'POST', headers: { 'X-Storm-Dev-User': ids.editor }, body: fd });
  const { assetId } = await res.json();
  return assetId;
}

test('Publication Slice 1 : mapping exact des Actualités — tag/date/title/summary/blocks/asset', async () => {
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  const assetId = await uploadTestImage();

  const article = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/articles`, {
    method: 'POST', ...withUser(ids.editor),
    body: jsonBody({
      title: 'Lancement du chantier', tag: 'Chantier', publicationDate: '2026-08-01',
      chapeauRuns: [{ text: 'Un chapeau ' }, { text: 'important', bold: true }],
      position: 0,
      blocks: [
        { blockType: 'paragraph', runs: [{ text: 'Un texte ' }, { text: 'souligné', underline: true }], position: 0 },
        { blockType: 'heading', runs: [{ text: 'Un titre' }], position: 1 },
        { blockType: 'image', imageAssetId: assetId, position: 2 }
      ]
    })
  })).json();

  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/publications`, { method: 'POST', ...withUser(ids.editor) });
  const body = await res.json();
  assert.equal(res.status, 201);

  const item = body.manifest.content.news.items[0];
  assert.equal(item.id, article.id);
  assert.equal(item.tag, 'Chantier');
  assert.equal(item.date, '2026-08-01');
  assert.equal(item.title, 'Lancement du chantier');
  assert.equal(item.summary, 'Un chapeau **important**', 'runs -> syntaxe Ivory (**gras**), jamais des runs structurés pour un champ aplati');
  assert.equal(item.blocks.length, 3);
  assert.deepEqual(item.blocks[0].runs, [{ text: 'Un texte ' }, { text: 'souligné', underline: true }], 'les blocs gardent des runs structurés, jamais aplatis');
  assert.equal(item.blocks[2].type, 'image');
  assert.equal(item.blocks[2].asset.url, `/public/projects/${ids.project}/assets/${assetId}.png`);
  assert.ok(item.asset, 'asset de couverture dérivé du premier bloc image');
  assert.equal(item.asset.url, `/public/projects/${ids.project}/assets/${assetId}.png`);
  assert.equal(typeof item.readingMinutes, 'number');
  assert.ok(item.readingMinutes >= 1);

  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  await pool.query('delete from project_articles where id=$1', [article.id]);
  await pool.query('delete from assets where id=$1', [assetId]);
});

test('Publication Slice 1 : temps de lecture recalculé depuis le texte réel des blocs', async () => {
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  const longText = Array.from({ length: 250 }, (_, i) => `mot${i}`).join(' ');
  const article = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/articles`, {
    method: 'POST', ...withUser(ids.editor),
    body: jsonBody({ title: 'Article Long', chapeauRuns: [], position: 0, blocks: [{ blockType: 'paragraph', runs: [{ text: longText }], position: 0 }] })
  })).json();

  const body = await (await fetch(`${baseUrl}/api/projects/${ids.project}/publications`, { method: 'POST', ...withUser(ids.editor) })).json();
  const item = body.manifest.content.news.items.find(i => i.id === article.id);
  assert.equal(item.readingMinutes, 2, '250 mots / 220 mots par minute -> arrondi à 2 minutes');

  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  await pool.query('delete from project_articles where id=$1', [article.id]);
});

test('Publication Slice 1 : tri publicationDate DESC puis position ASC', async () => {
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  const older = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/articles`, {
    method: 'POST', ...withUser(ids.editor), body: jsonBody({ title: 'Plus ancien', chapeauRuns: [], position: 0, publicationDate: '2026-01-01', blocks: [] })
  })).json();
  const sameDataA = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/articles`, {
    method: 'POST', ...withUser(ids.editor), body: jsonBody({ title: 'Même date A', chapeauRuns: [], position: 5, publicationDate: '2026-06-01', blocks: [] })
  })).json();
  const sameDataB = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/articles`, {
    method: 'POST', ...withUser(ids.editor), body: jsonBody({ title: 'Même date B', chapeauRuns: [], position: 2, publicationDate: '2026-06-01', blocks: [] })
  })).json();
  const newest = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/articles`, {
    method: 'POST', ...withUser(ids.editor), body: jsonBody({ title: 'Plus récent', chapeauRuns: [], position: 1, publicationDate: '2026-12-01', blocks: [] })
  })).json();

  const body = await (await fetch(`${baseUrl}/api/projects/${ids.project}/publications`, { method: 'POST', ...withUser(ids.editor) })).json();
  const titles = body.manifest.content.news.items.map(i => i.title);
  assert.deepEqual(titles, ['Plus récent', 'Même date B', 'Même date A', 'Plus ancien'], 'DESC par date, ASC par position en départage sur une date identique');

  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  await pool.query('delete from project_articles where id = ANY($1)', [[older.id, sameDataA.id, sameDataB.id, newest.id]]);
});

test('Publication Slice 1 : asset public — 200 si référencé par la publication active, 404 sinon', async () => {
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  const assetId = await uploadTestImage();
  const article = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/articles`, {
    method: 'POST', ...withUser(ids.editor),
    body: jsonBody({ title: 'Avec image', chapeauRuns: [], position: 0, blocks: [{ blockType: 'image', imageAssetId: assetId, position: 0 }] })
  })).json();
  await fetch(`${baseUrl}/api/projects/${ids.project}/publications`, { method: 'POST', ...withUser(ids.editor) });

  const okRes = await fetch(`${baseUrl}/public/projects/${ids.project}/assets/${assetId}.png`);
  assert.equal(okRes.status, 200);
  assert.equal(okRes.headers.get('content-type'), 'image/png');

  const notReferenced = await uploadTestImage();
  const koRes = await fetch(`${baseUrl}/public/projects/${ids.project}/assets/${notReferenced}.png`);
  assert.equal(koRes.status, 404, 'un asset qui existe en DB mais non référencé par la publication active reste 404 -- jamais Studio vivant qui décide');

  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  await pool.query('delete from project_articles where id=$1', [article.id]);
  await pool.query('delete from assets where id = ANY($1)', [[assetId, notReferenced]]);
});

test('Publication Slice 1 : Questions compilées sans aucun signal de scoring, cliquables directement', async () => {
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  const question = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/questions`, {
    method: 'POST', ...withUser(ids.editor),
    body: jsonBody({ question: 'Quand ?', answerRuns: [{ text: 'Bientôt, ' }, { text: 'vraiment', italic: true }], position: 0 })
  })).json();

  const body = await (await fetch(`${baseUrl}/api/projects/${ids.project}/publications`, { method: 'POST', ...withUser(ids.editor) })).json();
  const item = body.manifest.content.questions.items[0];
  assert.equal(item.id, question.id);
  assert.equal(item.title, 'Quand ?');
  assert.equal(item.answer, 'Bientôt, //vraiment//');
  // Aucun signal de scoring fabriqué -- arbitrage explicite.
  assert.equal(item.keywords, undefined);
  assert.equal(item.phrases, undefined);
  assert.equal(item.intentSignals, undefined);
  assert.equal(item.priority, undefined);
  // Le parcours par clic (findById côté Ivory) ne dépend que de id/title/answer -- tous présents.
  assert.ok(item.id && item.title && item.answer);

  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  await pool.query('delete from project_questions where id=$1', [question.id]);
});

test('Publication Slice 1 : aucun champ Studio interne (version/updatedAt) ne fuite dans le Manifest', async () => {
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  await fetch(`${baseUrl}/api/projects/${ids.project}/studio/articles`, {
    method: 'POST', ...withUser(ids.editor), body: jsonBody({ title: 'Article Test Fuite', chapeauRuns: [], position: 0, blocks: [] })
  });
  await fetch(`${baseUrl}/api/projects/${ids.project}/studio/questions`, {
    method: 'POST', ...withUser(ids.editor), body: jsonBody({ question: 'Q Test Fuite', answerRuns: [], position: 0 })
  });

  const body = await (await fetch(`${baseUrl}/api/projects/${ids.project}/publications`, { method: 'POST', ...withUser(ids.editor) })).json();
  const newsItem = body.manifest.content.news.items.find(i => i.title === 'Article Test Fuite');
  const questionItem = body.manifest.content.questions.items.find(i => i.title === 'Q Test Fuite');
  for (const item of [newsItem, questionItem]) {
    assert.equal(item.version, undefined);
    assert.equal(item.updatedAt, undefined);
    assert.equal(item.position, undefined);
    assert.equal(item.clientKey, undefined);
  }

  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  await pool.query("delete from project_articles where title='Article Test Fuite'");
  await pool.query("delete from project_questions where question='Q Test Fuite'");
});

test('Publication Slice 1 : featured latest par défaut, manual avec article réel, fallback + warning si obsolète', async () => {
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  await pool.query("delete from project_section_content where project_id=$1 and section_key='homepage'", [ids.project]);

  const a1 = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/articles`, {
    method: 'POST', ...withUser(ids.editor), body: jsonBody({ title: 'Article Un', chapeauRuns: [], position: 0, publicationDate: '2026-01-01', blocks: [] })
  })).json();
  const a2 = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/articles`, {
    method: 'POST', ...withUser(ids.editor), body: jsonBody({ title: 'Article Deux', chapeauRuns: [], position: 1, publicationDate: '2026-06-01', blocks: [] })
  })).json();

  // 1. latest par défaut (mode absent) -> le plus récent, jamais un warning.
  const latestBody = await (await fetch(`${baseUrl}/api/projects/${ids.project}/publications`, { method: 'POST', ...withUser(ids.editor) })).json();
  assert.equal(latestBody.manifest.content.home.featured.source.id, a2.id, 'latest doit être le plus récent par date');
  assert.deepEqual(latestBody.warnings, []);
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);

  // 2. manual avec un article réel -> exactement celui choisi, jamais un warning.
  await fetch(`${baseUrl}/api/projects/${ids.project}/studio/section-content/homepage`, {
    method: 'PATCH', ...withUser(ids.editor), body: jsonBody({ fields: { featuredArticleMode: 'manual', featuredArticleId: a1.id } })
  });
  const manualBody = await (await fetch(`${baseUrl}/api/projects/${ids.project}/publications`, { method: 'POST', ...withUser(ids.editor) })).json();
  assert.equal(manualBody.manifest.content.home.featured.source.id, a1.id, 'manual doit respecter le choix explicite, même si ce n\'est pas le plus récent');
  assert.deepEqual(manualBody.warnings, []);
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);

  // 3. manual avec référence devenue obsolète (article supprimé après coup) -> fallback latest + warning explicite.
  const versionRes = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/articles`, { headers: { 'X-Storm-Dev-User': ids.editor } });
  const currentArticles = await versionRes.json();
  const a1Current = currentArticles.find(a => a.id === a1.id);
  await fetch(`${baseUrl}/api/projects/${ids.project}/studio/articles/${a1.id}?version=${a1Current.version}`, { method: 'DELETE', headers: { 'X-Storm-Dev-User': ids.editor } });

  const fallbackBody = await (await fetch(`${baseUrl}/api/projects/${ids.project}/publications`, { method: 'POST', ...withUser(ids.editor) })).json();
  assert.equal(fallbackBody.manifest.content.home.featured.source.id, a2.id, 'fallback doit retomber sur le plus récent restant');
  assert.equal(fallbackBody.warnings.length, 1);
  assert.equal(fallbackBody.warnings[0].code, 'FEATURED_ARTICLE_MISSING');

  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  await pool.query('delete from project_articles where id=$1', [a2.id]);
  await pool.query("delete from project_section_content where project_id=$1 and section_key='homepage'", [ids.project]);
});

test('Publication Slice 1 : modifier/supprimer une Actualité après publication laisse la publication déjà active inchangée', async () => {
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  const article = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/articles`, {
    method: 'POST', ...withUser(ids.editor), body: jsonBody({ title: 'Titre Original', chapeauRuns: [], position: 0, blocks: [] })
  })).json();

  const published = await (await fetch(`${baseUrl}/api/projects/${ids.project}/publications`, { method: 'POST', ...withUser(ids.editor) })).json();
  const originalTitle = published.manifest.content.news.items.find(i => i.id === article.id).title;
  assert.equal(originalTitle, 'Titre Original');

  await fetch(`${baseUrl}/api/projects/${ids.project}/studio/articles/${article.id}`, {
    method: 'PATCH', ...withUser(ids.editor), body: jsonBody({ title: 'Titre Modifié Après Publication', chapeauRuns: [], blocks: [], version: article.version })
  });

  const stillActive = await pool.query('select manifest from project_publications where id=$1', [published.id]);
  const stillTitle = stillActive.rows[0].manifest.content.news.items.find(i => i.id === article.id).title;
  assert.equal(stillTitle, 'Titre Original', 'la publication déjà active ne doit jamais refléter une modification Studio survenue après coup');

  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  await pool.query('delete from project_articles where id=$1', [article.id]);
});

test('Publication Slice 1 : modules/navigation cohérents — home+news+questions actifs, les 4 autres désactivés sans content', async () => {
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  const body = await (await fetch(`${baseUrl}/api/projects/${ids.project}/publications`, { method: 'POST', ...withUser(ids.editor) })).json();
  assert.deepEqual(body.manifest.modules, { home: true, timeline: false, spaces: true, news: true, questions: true, ambassadors: true, team: false });
  assert.deepEqual(Object.keys(body.manifest.content).sort(), ['ambassadors', 'home', 'news', 'questions', 'spaces']);
  assert.deepEqual(body.manifest.navigation.map(n => n.module), ['questions', 'news', 'spaces', 'ambassadors']);
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
});

// ── Slice 2 : Espaces + Ambassadeurs dans le Candidate/Manifest, extension de fichier dans l'URL publique ──

async function uploadTestAsset(kind, buffer, mimeType, filename) {
  const fd = new FormData();
  fd.append('kind', kind);
  fd.append('file', new Blob([buffer], { type: mimeType }), filename);
  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/assets`, { method: 'POST', headers: { 'X-Storm-Dev-User': ids.editor }, body: fd });
  const { assetId } = await res.json();
  return assetId;
}
const TEST_PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a4944415478da63600000020001557f6e5c0000000049454e44ae426082', 'hex');
const TEST_PDF = Buffer.from('%PDF-1.4\n%fake pdf for signature test\n', 'ascii');

test('Publication Slice 2 : URL publique porte l\'extension réelle (png/jpg/pdf) dérivée du content_type', async () => {
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  const pngAsset = await uploadTestAsset('space_media', TEST_PNG, 'image/png', 'x.png');
  const pdfAsset = await uploadTestAsset('space_media', TEST_PDF, 'application/pdf', 'x.pdf');

  const space = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/spaces`, {
    method: 'POST', ...withUser(ids.editor),
    body: jsonBody({ name: 'Espace Test', position: 0, media: [
      { kind: 'view', assetId: pngAsset, position: 0 },
      { kind: 'document', assetId: pdfAsset, label: 'Plan', position: 1 }
    ] })
  })).json();

  const body = await (await fetch(`${baseUrl}/api/projects/${ids.project}/publications`, { method: 'POST', ...withUser(ids.editor) })).json();
  const item = body.manifest.content.spaces.items[0];
  assert.equal(item.media[0].url, `/public/projects/${ids.project}/assets/${pngAsset}.png`);
  assert.equal(item.media[1].url, `/public/projects/${ids.project}/assets/${pdfAsset}.pdf`);
  assert.match(item.media[1].url, /\.pdf($|\?)/i, 'doit matcher exactement la regex isPdfUrl() d\'Ivory');

  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  await pool.query('delete from project_spaces where id=$1', [space.id]);
  await pool.query('delete from assets where id = ANY($1)', [[pngAsset, pdfAsset]]);
});

test('Publication Slice 2 : asset public — extension incohérente avec le MIME réel est rejetée (404)', async () => {
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  const pngAsset = await uploadTestAsset('space_media', TEST_PNG, 'image/png', 'x.png');
  const space = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/spaces`, {
    method: 'POST', ...withUser(ids.editor), body: jsonBody({ name: 'Espace', position: 0, media: [{ kind: 'view', assetId: pngAsset, position: 0 }] })
  })).json();
  await fetch(`${baseUrl}/api/projects/${ids.project}/publications`, { method: 'POST', ...withUser(ids.editor) });

  const correct = await fetch(`${baseUrl}/public/projects/${ids.project}/assets/${pngAsset}.png`);
  assert.equal(correct.status, 200);

  const wrongExt = await fetch(`${baseUrl}/public/projects/${ids.project}/assets/${pngAsset}.pdf`);
  assert.equal(wrongExt.status, 404, 'un PNG réel demandé avec .pdf ne doit jamais être servi -- extension vérifiée contre le MIME réel, pas simplement acceptée depuis l\'URL');

  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  await pool.query('delete from project_spaces where id=$1', [space.id]);
  await pool.query('delete from assets where id=$1', [pngAsset]);
});

test('Publication Slice 2 : mapping exact des Espaces — status/statusBody exacts, usages, ordre par position', async () => {
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  const s1 = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/spaces`, {
    method: 'POST', ...withUser(ids.editor),
    body: jsonBody({ name: 'Second', location: 'R+1', description: 'Une description', status: 'delivered', usages: ['Se concentrer', 'Collaborer'], position: 1 })
  })).json();
  const s0 = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/spaces`, {
    method: 'POST', ...withUser(ids.editor), body: jsonBody({ name: 'Premier', status: 'designing', position: 0 })
  })).json();

  const body = await (await fetch(`${baseUrl}/api/projects/${ids.project}/publications`, { method: 'POST', ...withUser(ids.editor) })).json();
  const items = body.manifest.content.spaces.items;
  assert.deepEqual(items.map(i => i.title), ['Premier', 'Second'], 'ordre par position, pas par date de création');

  const second = items.find(i => i.title === 'Second');
  assert.equal(second.location, 'R+1');
  assert.equal(second.comment, 'Une description');
  assert.equal(second.status, 'Livré');
  assert.equal(second.statusBody, "Cet espace est livré et peut désormais être découvert tel qu'il sera utilisé au quotidien.");
  assert.deepEqual(second.usages, ['Se concentrer', 'Collaborer']);
  assert.deepEqual(second.usageTags, ['Se concentrer', 'Collaborer']);

  const first = items.find(i => i.title === 'Premier');
  assert.equal(first.status, 'En cours de conception');
  assert.equal(first.statusBody, 'Cet espace est encore en cours de conception. Son organisation et certains détails peuvent évoluer.');

  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  await pool.query('delete from project_spaces where id = ANY($1)', [[s0.id, s1.id]]);
});

test('Publication Slice 2 : kind view/plan/document préservé dans le Manifest', async () => {
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  const asset = await uploadTestAsset('space_media', TEST_PNG, 'image/png', 'x.png');
  const space = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/spaces`, {
    method: 'POST', ...withUser(ids.editor),
    body: jsonBody({ name: 'Espace Kinds', position: 0, media: [
      { kind: 'view', assetId: asset, position: 0 },
      { kind: 'plan', assetId: asset, position: 1 }
    ] })
  })).json();

  const body = await (await fetch(`${baseUrl}/api/projects/${ids.project}/publications`, { method: 'POST', ...withUser(ids.editor) })).json();
  const media = body.manifest.content.spaces.items[0].media;
  assert.equal(media[0].kind, 'view');
  assert.equal(media[1].kind, 'plan');

  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  await pool.query('delete from project_spaces where id=$1', [space.id]);
  await pool.query('delete from assets where id=$1', [asset]);
});

test('Publication Slice 2 : Ambassadeurs — avec photo, sans photo, contact email/Teams/lien', async () => {
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  const photo = await uploadTestAsset('ambassador_photo', TEST_PNG, 'image/png', 'x.png');

  const withPhoto = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/ambassadors`, {
    method: 'POST', ...withUser(ids.editor),
    body: jsonBody({ name: 'Julie Martin', role: 'RH', photoAssetId: photo, contactable: true, contactChannel: 'email', contactValue: 'julie@test.fr', position: 0 })
  })).json();
  const withoutPhoto = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/ambassadors`, {
    method: 'POST', ...withUser(ids.editor), body: jsonBody({ name: 'Marc Dubois', position: 1 })
  })).json();
  const teamsContact = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/ambassadors`, {
    method: 'POST', ...withUser(ids.editor),
    body: jsonBody({ name: 'Sophie Leroux', contactable: true, contactChannel: 'teams', contactValue: 'https://teams.microsoft.com/l/chat/x', position: 2 })
  })).json();
  const linkContact = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/ambassadors`, {
    method: 'POST', ...withUser(ids.editor),
    body: jsonBody({ name: 'Karim Haddad', contactable: true, contactChannel: 'link', contactValue: 'https://example.com/karim', position: 3 })
  })).json();
  const invalidEmail = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/ambassadors`, {
    method: 'POST', ...withUser(ids.editor),
    body: jsonBody({ name: 'Email Invalide', contactable: true, contactChannel: 'email', contactValue: 'pas-un-email', position: 4 })
  })).json();

  const body = await (await fetch(`${baseUrl}/api/projects/${ids.project}/publications`, { method: 'POST', ...withUser(ids.editor) })).json();
  const roster = body.manifest.content.ambassadors.roster;

  const jm = roster.find(r => r.id === withPhoto.id);
  assert.equal(jm.photo.url, `/public/projects/${ids.project}/assets/${photo}.png`);
  assert.equal(jm.photo.alt, 'Julie Martin — RH');
  assert.equal(jm.contactHref, 'mailto:julie@test.fr');

  const md = roster.find(r => r.id === withoutPhoto.id);
  assert.equal(md.photo, null, 'un ambassadeur sans photo doit avoir photo:null, jamais une URL cassée');

  const sl = roster.find(r => r.id === teamsContact.id);
  assert.equal(sl.contactHref, 'https://teams.microsoft.com/l/chat/x');

  const kh = roster.find(r => r.id === linkContact.id);
  assert.equal(kh.contactHref, 'https://example.com/karim');

  const ei = roster.find(r => r.id === invalidEmail.id);
  assert.equal(ei.contactHref, '', 'un email malformé ne doit jamais produire un mailto: invalide -- validation réelle, pas une confiance aveugle');

  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  await pool.query('delete from project_ambassadors where id = ANY($1)', [[withPhoto.id, withoutPhoto.id, teamsContact.id, linkContact.id, invalidEmail.id]]);
  await pool.query('delete from assets where id=$1', [photo]);
});

test('Publication Slice 2 : intro/contact/join Ambassadeurs neutres, aucune microcopy inventée', async () => {
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  const body = await (await fetch(`${baseUrl}/api/projects/${ids.project}/publications`, { method: 'POST', ...withUser(ids.editor) })).json();
  const ambassadors = body.manifest.content.ambassadors;
  assert.deepEqual(ambassadors.intro, { title: '', body: '', rosterLabel: '' });
  assert.deepEqual(ambassadors.contact, { enabled: false, defaultHref: null, label: '' });
  assert.deepEqual(ambassadors.join, { enabled: false, mode: null, title: '', body: '', label: '', href: null });
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
});

test('Publication Slice 2 : invariants modules/content/navigation avec spaces+ambassadors actifs', async () => {
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  const body = await (await fetch(`${baseUrl}/api/projects/${ids.project}/publications`, { method: 'POST', ...withUser(ids.editor) })).json();
  assert.deepEqual(body.manifest.modules, { home: true, timeline: false, spaces: true, news: true, questions: true, ambassadors: true, team: false });
  assert.deepEqual(Object.keys(body.manifest.content).sort(), ['ambassadors', 'home', 'news', 'questions', 'spaces']);
  assert.deepEqual(body.manifest.navigation.map(n => n.module), ['questions', 'news', 'spaces', 'ambassadors']);
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
});

test('Publication Slice 2 : aucun champ Studio interne (version/updatedAt/position) ne fuite pour Espaces/Ambassadeurs', async () => {
  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  const space = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/spaces`, {
    method: 'POST', ...withUser(ids.editor), body: jsonBody({ name: 'Espace Fuite Test', position: 0 })
  })).json();
  const amb = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/ambassadors`, {
    method: 'POST', ...withUser(ids.editor), body: jsonBody({ name: 'Ambassadeur Fuite Test', position: 0 })
  })).json();

  const body = await (await fetch(`${baseUrl}/api/projects/${ids.project}/publications`, { method: 'POST', ...withUser(ids.editor) })).json();
  const spaceItem = body.manifest.content.spaces.items.find(i => i.title === 'Espace Fuite Test');
  const ambItem = body.manifest.content.ambassadors.roster.find(r => r.name === 'Ambassadeur Fuite Test');
  for (const item of [spaceItem, ambItem]) {
    assert.equal(item.version, undefined);
    assert.equal(item.updatedAt, undefined);
    assert.equal(item.position, undefined);
  }

  await pool.query('delete from project_publications where project_id=$1', [ids.project]);
  await pool.query('delete from project_spaces where id=$1', [space.id]);
  await pool.query('delete from project_ambassadors where id=$1', [amb.id]);
});

