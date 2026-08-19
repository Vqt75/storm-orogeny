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
  await pool.query('delete from project_narrative_section_media');
  await pool.query('delete from project_narrative_sections');
  await pool.query('delete from project_space_media');
  await pool.query('delete from project_spaces');
  await pool.query('delete from project_ambassadors');
  await pool.query('delete from project_team_members');
  await pool.query('delete from project_milestones');
  await pool.query('delete from project_article_blocks');
  await pool.query('delete from project_articles');
  await pool.query('delete from project_questions');
  await pool.query('delete from project_section_content');
  await pool.query('delete from assets');
  await pool.query('delete from project_memberships');
  await pool.query('delete from tenant_memberships');
  await pool.query('delete from projects');
  await pool.query('delete from users');
  await pool.query('delete from tenants');
}

test.before(async () => {
  await runMigrations();
  await cleanAll();

  const { rows: [tenantA] } = await pool.query("insert into tenants (name) values ('Tenant Studio A') returning id");
  const { rows: [tenantB] } = await pool.query("insert into tenants (name) values ('Tenant Studio B') returning id");
  const { rows: [editor] } = await pool.query("insert into users (email, display_name) values ('editor@studio.local','Editor Studio') returning id");
  const { rows: [viewer] } = await pool.query("insert into users (email, display_name) values ('viewer@studio.local','Viewer Studio') returning id");

  await pool.query('insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1,$2,$3)', [tenantA.id, editor.id, 'member']);
  await pool.query('insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1,$2,$3)', [tenantA.id, viewer.id, 'member']);

  const { rows: [project] } = await pool.query('insert into projects (tenant_id, name) values ($1,$2) returning id', [tenantA.id, 'Projet Studio']);
  await pool.query('insert into project_memberships (tenant_id, project_id, user_id, permission_bundle) values ($1,$2,$3,$4)', [tenantA.id, project.id, editor.id, 'editor']);
  await pool.query('insert into project_memberships (tenant_id, project_id, user_id, permission_bundle) values ($1,$2,$3,$4)', [tenantA.id, project.id, viewer.id, 'pilot']);

  const { rows: [assetInProject] } = await pool.query(
    "insert into assets (tenant_id, project_id, kind, storage_key, content_type, byte_size) values ($1,$2,'ambassador_photo','k','image/png',10) returning id",
    [tenantA.id, project.id]
  );
  const { rows: [otherProject] } = await pool.query('insert into projects (tenant_id, name) values ($1,$2) returning id', [tenantB.id, 'Autre Projet']);
  const { rows: [assetOtherTenant] } = await pool.query(
    "insert into assets (tenant_id, project_id, kind, storage_key, content_type, byte_size) values ($1,$2,'ambassador_photo','k2','image/png',10) returning id",
    [tenantB.id, otherProject.id]
  );

  ids = { tenantA: tenantA.id, tenantB: tenantB.id, editor: editor.id, viewer: viewer.id, project: project.id, assetInProject: assetInProject.id, assetOtherTenant: assetOtherTenant.id };

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

function withUser(userId, extra = {}) {
  return { headers: { 'X-Storm-Dev-User': userId, 'Content-Type': 'application/json' }, ...extra };
}
function jsonBody(obj) { return JSON.stringify(obj); }

// ── Questions : CRUD + verrou optimiste + rejet highlight ──

test('Questions : POST puis GET, forme camelCase correcte', async () => {
  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/questions`, {
    method: 'POST', ...withUser(ids.editor), body: jsonBody({ question: 'Q1 ?', answerRuns: [{ text: 'R1', bold: true }], position: 0 })
  });
  assert.equal(res.status, 201);
  const created = await res.json();
  assert.equal(created.question, 'Q1 ?');
  assert.equal(created.version, 1);

  const listRes = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/questions`, withUser(ids.editor));
  const list = await listRes.json();
  assert.ok(list.some(q => q.id === created.id));

  await pool.query('delete from project_questions where id=$1', [created.id]);
});

test('Questions : answerRuns avec highlight -> 400, jamais toléré', async () => {
  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/questions`, {
    method: 'POST', ...withUser(ids.editor), body: jsonBody({ question: 'Q?', answerRuns: [{ text: 'R', highlight: true }], position: 0 })
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error.details.join(' '), /highlight/);
});

test('Questions : PATCH avec version périmée -> 409, jamais un écrasement silencieux', async () => {
  const createRes = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/questions`, {
    method: 'POST', ...withUser(ids.editor), body: jsonBody({ question: 'Original', answerRuns: [], position: 1 })
  });
  const created = await createRes.json();

  const patch1 = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/questions/${created.id}`, {
    method: 'PATCH', ...withUser(ids.editor), body: jsonBody({ question: 'Modifiée', answerRuns: [], version: created.version })
  });
  assert.equal(patch1.status, 200);

  const patch2 = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/questions/${created.id}`, {
    method: 'PATCH', ...withUser(ids.editor), body: jsonBody({ question: 'Conflit', answerRuns: [], version: created.version })
  });
  assert.equal(patch2.status, 409);

  await pool.query('delete from project_questions where id=$1', [created.id]);
});

test('Questions : pilot (project.view seul, sans content.edit) ne peut pas créer -> 403', async () => {
  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/questions`, {
    method: 'POST', ...withUser(ids.viewer), body: jsonBody({ question: 'Q?', answerRuns: [], position: 0 })
  });
  assert.equal(res.status, 403);
});

test('Questions : DELETE sans version -> 400 ; avec bonne version -> 204', async () => {
  const createRes = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/questions`, {
    method: 'POST', ...withUser(ids.editor), body: jsonBody({ question: 'À supprimer', answerRuns: [], position: 2 })
  });
  const created = await createRes.json();

  const noVersion = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/questions/${created.id}`, { method: 'DELETE', ...withUser(ids.editor) });
  assert.equal(noVersion.status, 400);

  const withVersion = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/questions/${created.id}?version=${created.version}`, { method: 'DELETE', ...withUser(ids.editor) });
  assert.equal(withVersion.status, 204);
});

// ── Articles : blocs, isolation asset cross-tenant ──

test('Articles : création avec blocs, mise à jour change le nombre de blocs (1 -> 2)', async () => {
  const createRes = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/articles`, {
    method: 'POST', ...withUser(ids.editor),
    body: jsonBody({ title: 'Article', chapeauRuns: [], position: 0, blocks: [{ blockType: 'paragraph', runs: [{ text: 'A' }], position: 0 }] })
  });
  const created = await createRes.json();
  assert.equal(created.blocks.length, 1);

  const patchRes = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/articles/${created.id}`, {
    method: 'PATCH', ...withUser(ids.editor),
    body: jsonBody({
      title: 'Article modifié', chapeauRuns: [], version: created.version,
      blocks: [{ blockType: 'paragraph', runs: [{ text: 'A' }], position: 0 }, { blockType: 'paragraph', runs: [{ text: 'B' }], position: 1 }]
    })
  });
  assert.equal(patchRes.status, 200);
  const updated = await patchRes.json();
  assert.equal(updated.blocks.length, 2);
  assert.equal(updated.version, created.version + 1);

  await pool.query('delete from project_articles where id=$1', [created.id]);
});

test('Articles : un bloc image référençant un asset d\'un autre tenant est refusé (isolation, pas juste 400 générique)', async () => {
  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/articles`, {
    method: 'POST', ...withUser(ids.editor),
    body: jsonBody({ title: 'Article', chapeauRuns: [], position: 0, blocks: [{ blockType: 'image', imageAssetId: ids.assetOtherTenant, position: 0 }] })
  });
  assert.equal(res.status, 500, 'la contrainte FK au niveau DB doit faire échouer la transaction (isolation garantie même si la validation applicative ne l\'attrape pas)');
});

test('Articles : un bloc image référençant un asset du BON projet réussit', async () => {
  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/articles`, {
    method: 'POST', ...withUser(ids.editor),
    body: jsonBody({ title: 'Article avec image', chapeauRuns: [], position: 0, blocks: [{ blockType: 'image', imageAssetId: ids.assetInProject, position: 0 }] })
  });
  assert.equal(res.status, 201);
  const created = await res.json();
  assert.equal(created.blocks[0].imageAssetId, ids.assetInProject);
  await pool.query('delete from project_articles where id=$1', [created.id]);
});

test('Articles : les ids de blocs sont préservés à travers les mises à jour (jamais recréés)', async () => {
  const createRes = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/articles`, {
    method: 'POST', ...withUser(ids.editor),
    body: jsonBody({
      title: 'Article Préservation', chapeauRuns: [], position: 5,
      blocks: [{ blockType: 'heading', runs: [{ text: 'Titre' }], position: 0 }, { blockType: 'paragraph', runs: [{ text: 'Para' }], position: 1 }]
    })
  });
  const created = await createRes.json();
  const [block1, block2] = created.blocks;

  const patchRes = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/articles/${created.id}`, {
    method: 'PATCH', ...withUser(ids.editor),
    body: jsonBody({
      title: 'Article Préservation', chapeauRuns: [], version: created.version,
      blocks: [
        { id: block1.id, blockType: 'heading', runs: [{ text: 'Titre modifié' }], position: 0 },
        { id: block2.id, blockType: 'paragraph', runs: [{ text: 'Para' }], position: 1 },
        { blockType: 'paragraph', runs: [{ text: 'Nouveau' }], position: 2 }
      ]
    })
  });
  assert.equal(patchRes.status, 200);
  const updated = await patchRes.json();
  const updatedIds = updated.blocks.map(b => b.id);
  assert.ok(updatedIds.includes(block1.id), 'block1 doit garder son id');
  assert.ok(updatedIds.includes(block2.id), 'block2 doit garder son id');
  assert.equal(updated.blocks.length, 3);

  await pool.query('delete from project_articles where id=$1', [created.id]);
});

test('Articles : un bloc existant absent du payload est réellement supprimé', async () => {
  const createRes = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/articles`, {
    method: 'POST', ...withUser(ids.editor),
    body: jsonBody({ title: 'À réduire', chapeauRuns: [], position: 6, blocks: [{ blockType: 'paragraph', runs: [], position: 0 }, { blockType: 'paragraph', runs: [], position: 1 }] })
  });
  const created = await createRes.json();
  const survivorId = created.blocks[0].id;

  const patchRes = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/articles/${created.id}`, {
    method: 'PATCH', ...withUser(ids.editor),
    body: jsonBody({ title: 'À réduire', chapeauRuns: [], version: created.version, blocks: [{ id: survivorId, blockType: 'paragraph', runs: [], position: 0 }] })
  });
  const updated = await patchRes.json();
  assert.equal(updated.blocks.length, 1);
  assert.equal(updated.blocks[0].id, survivorId);

  await pool.query('delete from project_articles where id=$1', [created.id]);
});

test('Articles : un id de bloc inconnu est refusé (400), version non incrémentée (rollback réel)', async () => {
  const createRes = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/articles`, {
    method: 'POST', ...withUser(ids.editor),
    body: jsonBody({ title: 'Id inconnu', chapeauRuns: [], position: 7, blocks: [] })
  });
  const created = await createRes.json();

  const patchRes = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/articles/${created.id}`, {
    method: 'PATCH', ...withUser(ids.editor),
    body: jsonBody({ title: 'Test', chapeauRuns: [], version: created.version, blocks: [{ id: '00000000-0000-0000-0000-000000000000', blockType: 'paragraph', runs: [], position: 0 }] })
  });
  assert.equal(patchRes.status, 400);

  const { rows: [row] } = await pool.query('select version from project_articles where id=$1', [created.id]);
  assert.equal(row.version, created.version, 'la version ne doit pas bouger après un rejet');

  await pool.query('delete from project_articles where id=$1', [created.id]);
});

test('Articles : un id de bloc appartenant à un AUTRE article est refusé (400)', async () => {
  const article1Res = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/articles`, {
    method: 'POST', ...withUser(ids.editor),
    body: jsonBody({ title: 'Article A', chapeauRuns: [], position: 8, blocks: [{ blockType: 'paragraph', runs: [], position: 0 }] })
  });
  const article1 = await article1Res.json();
  const foreignBlockId = article1.blocks[0].id;

  const article2Res = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/articles`, {
    method: 'POST', ...withUser(ids.editor),
    body: jsonBody({ title: 'Article B', chapeauRuns: [], position: 9, blocks: [] })
  });
  const article2 = await article2Res.json();

  const patchRes = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/articles/${article2.id}`, {
    method: 'PATCH', ...withUser(ids.editor),
    body: jsonBody({ title: 'Article B', chapeauRuns: [], version: article2.version, blocks: [{ id: foreignBlockId, blockType: 'paragraph', runs: [], position: 0 }] })
  });
  assert.equal(patchRes.status, 400);

  await pool.query('delete from project_articles where id in ($1,$2)', [article1.id, article2.id]);
});

test('Articles : deux fois le même id dans le payload est refusé (400)', async () => {
  const createRes = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/articles`, {
    method: 'POST', ...withUser(ids.editor),
    body: jsonBody({ title: 'Doublon', chapeauRuns: [], position: 10, blocks: [{ blockType: 'paragraph', runs: [], position: 0 }] })
  });
  const created = await createRes.json();
  const dupId = created.blocks[0].id;

  const patchRes = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/articles/${created.id}`, {
    method: 'PATCH', ...withUser(ids.editor),
    body: jsonBody({
      title: 'Doublon', chapeauRuns: [], version: created.version,
      blocks: [{ id: dupId, blockType: 'paragraph', runs: [], position: 0 }, { id: dupId, blockType: 'paragraph', runs: [], position: 1 }]
    })
  });
  assert.equal(patchRes.status, 400);

  await pool.query('delete from project_articles where id=$1', [created.id]);
});

test('Articles : publicationDate normalisée en YYYY-MM-DD, jamais un datetime ISO complet', async () => {
  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/articles`, {
    method: 'POST', ...withUser(ids.editor),
    body: jsonBody({ title: 'Date Test', publicationDate: '2026-08-01', chapeauRuns: [], position: 11, blocks: [] })
  });
  const created = await res.json();
  assert.equal(created.publicationDate, '2026-08-01');

  await pool.query('delete from project_articles where id=$1', [created.id]);
});

// ── Upload générique Studio (images de contenu) ──

test('Upload Studio : kind=article_image accepté, aucun effet de bord sur project_identity', async () => {
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a4944415478da6360000002000155' + '7f6e5c0000000049454e44ae426082', 'hex');
  const form = new FormData();
  form.append('file', new Blob([png], { type: 'image/png' }), 'img.png');
  form.append('kind', 'article_image');

  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/assets`, {
    method: 'POST', headers: { 'X-Storm-Dev-User': ids.editor }, body: form
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.ok(body.assetId);

  const { rows: [asset] } = await pool.query('select kind from assets where id=$1', [body.assetId]);
  assert.equal(asset.kind, 'article_image');

  const { rows: [identity] } = await pool.query('select logo_asset_id from project_identity where project_id=$1', [ids.project]);
  assert.notEqual(identity?.logo_asset_id, body.assetId, 'aucun effet de bord sur project_identity');

  await pool.query('delete from assets where id=$1', [body.assetId]);
});

test('Upload Studio : kind non autorisé (ex. "logo") refusé sur cet endpoint générique', async () => {
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a4944415478da6360000002000155' + '7f6e5c0000000049454e44ae426082', 'hex');
  const form = new FormData();
  form.append('file', new Blob([png], { type: 'image/png' }), 'img.png');
  form.append('kind', 'logo');

  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/assets`, {
    method: 'POST', headers: { 'X-Storm-Dev-User': ids.editor }, body: form
  });
  assert.equal(res.status, 400);
});

// ── Espaces : médias ──

test('Espaces : création avec médias, statut respecté', async () => {
  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/spaces`, {
    method: 'POST', ...withUser(ids.editor),
    body: jsonBody({ name: 'Espace 1', status: 'designing', usages: ['Se concentrer'], position: 0, media: [{ kind: 'view', assetId: ids.assetInProject, position: 0 }] })
  });
  assert.equal(res.status, 201);
  const created = await res.json();
  assert.equal(created.media.length, 1);
  assert.equal(created.status, 'designing');
  await pool.query('delete from project_spaces where id=$1', [created.id]);
});

test('Espaces : statut invalide -> 400', async () => {
  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/spaces`, {
    method: 'POST', ...withUser(ids.editor),
    body: jsonBody({ name: 'Espace', status: 'construit_hier_soir', position: 0 })
  });
  assert.equal(res.status, 400);
});

test('upload Studio : kind=space_media accepté (pas seulement article_image)', async () => {
  const fd = new FormData();
  fd.append('kind', 'space_media');
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a4944415478da63600000020001557f6e5c0000000049454e44ae426082', 'hex');
  fd.append('file', new Blob([png], { type: 'image/png' }), 'x.png');
  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/assets`, {
    method: 'POST', headers: { 'X-Storm-Dev-User': ids.editor }, body: fd
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.ok(body.assetId);
  await pool.query('delete from assets where id=$1', [body.assetId]);
});

test('upload Studio : PDF accepté pour kind=space_media (signature réelle vérifiée)', async () => {
  const fd = new FormData();
  fd.append('kind', 'space_media');
  const pdf = Buffer.from('%PDF-1.4\n%fake pdf for signature test\n', 'ascii');
  fd.append('file', new Blob([pdf], { type: 'application/pdf' }), 'plan.pdf');
  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/assets`, {
    method: 'POST', headers: { 'X-Storm-Dev-User': ids.editor }, body: fd
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.ok(body.assetId);
  await pool.query('delete from assets where id=$1', [body.assetId]);
});

test('upload Studio : PDF refusé pour kind=article_image (le PDF reste réservé à space_media)', async () => {
  const fd = new FormData();
  fd.append('kind', 'article_image');
  const pdf = Buffer.from('%PDF-1.4\n%fake pdf\n', 'ascii');
  fd.append('file', new Blob([pdf], { type: 'application/pdf' }), 'x.pdf');
  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/assets`, {
    method: 'POST', headers: { 'X-Storm-Dev-User': ids.editor }, body: fd
  });
  assert.equal(res.status, 400);
});

test('upload Studio : faux PDF (signature ne correspond pas) refusé même pour space_media', async () => {
  const fd = new FormData();
  fd.append('kind', 'space_media');
  const notAPdf = Buffer.from('ceci n\'est absolument pas un PDF', 'ascii');
  fd.append('file', new Blob([notAPdf], { type: 'application/pdf' }), 'x.pdf');
  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/assets`, {
    method: 'POST', headers: { 'X-Storm-Dev-User': ids.editor }, body: fd
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error.message, /correspond pas/);
});

test('upload Studio : kind=ambassador_photo accepté (signature réelle vérifiée)', async () => {
  const fd = new FormData();
  fd.append('kind', 'ambassador_photo');
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a4944415478da63600000020001557f6e5c0000000049454e44ae426082', 'hex');
  fd.append('file', new Blob([png], { type: 'image/png' }), 'photo.png');
  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/assets`, {
    method: 'POST', headers: { 'X-Storm-Dev-User': ids.editor }, body: fd
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.ok(body.assetId);
  await pool.query('delete from assets where id=$1', [body.assetId]);
});

test('upload Studio : faux fichier / signature incorrecte refusé pour ambassador_photo', async () => {
  const fd = new FormData();
  fd.append('kind', 'ambassador_photo');
  const notAPng = Buffer.from('ceci n\'est absolument pas un PNG', 'ascii');
  fd.append('file', new Blob([notAPng], { type: 'image/png' }), 'x.png');
  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/assets`, {
    method: 'POST', headers: { 'X-Storm-Dev-User': ids.editor }, body: fd
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error.message, /correspond pas/);
});

test('Ambassadeurs : création avec photoAssetId issu d\'un upload réel', async () => {
  const fd = new FormData();
  fd.append('kind', 'ambassador_photo');
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a4944415478da63600000020001557f6e5c0000000049454e44ae426082', 'hex');
  fd.append('file', new Blob([png], { type: 'image/png' }), 'photo.png');
  const uploadRes = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/assets`, {
    method: 'POST', headers: { 'X-Storm-Dev-User': ids.editor }, body: fd
  });
  const { assetId } = await uploadRes.json();

  const created = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/ambassadors`, {
    method: 'POST', ...withUser(ids.editor),
    body: jsonBody({ name: 'Ambassadeur Upload Test', photoAssetId: assetId, position: 0 })
  })).json();
  assert.equal(created.photoAssetId, assetId);

  await pool.query('delete from project_ambassadors where id=$1', [created.id]);
  await pool.query('delete from assets where id=$1', [assetId]);
});

test('Ambassadeurs : suppression directe de l\'asset -> ambassadeur conservé, tenant/project intacts, photoAssetId=null', async () => {
  const { rows: [asset] } = await pool.query(
    "insert into assets (tenant_id, project_id, kind, storage_key, content_type, byte_size) values ($1,$2,'ambassador_photo','k','image/png',10) returning id",
    [ids.tenantA, ids.project]
  );
  const created = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/ambassadors`, {
    method: 'POST', ...withUser(ids.editor),
    body: jsonBody({ name: 'Ambassadeur SET NULL Test', photoAssetId: asset.id, position: 0 })
  })).json();

  await pool.query('delete from assets where id=$1', [asset.id]);

  const row = await pool.query('select tenant_id, project_id, name, photo_asset_id from project_ambassadors where id=$1', [created.id]);
  assert.equal(row.rows.length, 1, 'l\'ambassadeur doit être CONSERVÉ (SET NULL, pas CASCADE)');
  assert.equal(row.rows[0].tenant_id, ids.tenantA, 'tenant_id doit rester intact');
  assert.equal(row.rows[0].project_id, ids.project, 'project_id doit rester intact');
  assert.equal(row.rows[0].name, 'Ambassadeur SET NULL Test', 'le nom doit rester intact');
  assert.equal(row.rows[0].photo_asset_id, null, 'seule la référence photo doit être détachée');

  await pool.query('delete from project_ambassadors where id=$1', [created.id]);
});

test('Espaces : préservation des ids de médias à travers un PATCH (inchangé, modifié, réordonné)', async () => {
  const created = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/spaces`, {
    method: 'POST', ...withUser(ids.editor),
    body: jsonBody({ name: 'Espace Diff', position: 0, media: [
      { kind: 'view', assetId: ids.assetInProject, position: 0 },
      { kind: 'plan', assetId: ids.assetInProject, position: 1 }
    ] })
  })).json();
  const [media1, media2] = created.media;

  // Réordonné (media2 en premier) + media1 modifié (label ajouté), mêmes ids envoyés
  const patched = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/spaces/${created.id}`, {
    method: 'PATCH', ...withUser(ids.editor),
    body: jsonBody({ name: 'Espace Diff', version: created.version, media: [
      { id: media2.id, kind: 'plan', assetId: ids.assetInProject, position: 0 },
      { id: media1.id, kind: 'view', assetId: ids.assetInProject, label: 'Modifié', position: 1 }
    ] })
  })).json();

  assert.equal(patched.media.length, 2);
  const patchedMedia1 = patched.media.find(m => m.id === media1.id);
  const patchedMedia2 = patched.media.find(m => m.id === media2.id);
  assert.ok(patchedMedia1, 'media1 doit garder exactement son id d\'origine');
  assert.ok(patchedMedia2, 'media2 doit garder exactement son id d\'origine');
  assert.equal(patchedMedia1.label, 'Modifié');
  assert.equal(patchedMedia1.position, 1);
  assert.equal(patchedMedia2.position, 0);

  await pool.query('delete from project_spaces where id=$1', [created.id]);
});

test('Espaces : ajout d\'un nouveau média -> seul le nouveau reçoit un nouvel id, les existants sont inchangés', async () => {
  const created = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/spaces`, {
    method: 'POST', ...withUser(ids.editor),
    body: jsonBody({ name: 'Espace Ajout', position: 0, media: [{ kind: 'view', assetId: ids.assetInProject, position: 0 }] })
  })).json();
  const existingId = created.media[0].id;

  const patched = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/spaces/${created.id}`, {
    method: 'PATCH', ...withUser(ids.editor),
    body: jsonBody({ name: 'Espace Ajout', version: created.version, media: [
      { id: existingId, kind: 'view', assetId: ids.assetInProject, position: 0 },
      { kind: 'plan', assetId: ids.assetInProject, position: 1 }
    ] })
  })).json();

  assert.equal(patched.media.length, 2);
  assert.ok(patched.media.some(m => m.id === existingId), 'le média existant garde son id');
  assert.ok(patched.media.some(m => m.id !== existingId), 'le nouveau média a un id différent');

  await pool.query('delete from project_spaces where id=$1', [created.id]);
});

test('Espaces : suppression d\'un média -> uniquement celui-ci disparaît', async () => {
  const created = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/spaces`, {
    method: 'POST', ...withUser(ids.editor),
    body: jsonBody({ name: 'Espace Suppr Media', position: 0, media: [
      { kind: 'view', assetId: ids.assetInProject, position: 0 },
      { kind: 'plan', assetId: ids.assetInProject, position: 1 }
    ] })
  })).json();
  const [keep, remove] = created.media;

  const patched = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/spaces/${created.id}`, {
    method: 'PATCH', ...withUser(ids.editor),
    body: jsonBody({ name: 'Espace Suppr Media', version: created.version, media: [
      { id: keep.id, kind: 'view', assetId: ids.assetInProject, position: 0 }
    ] })
  })).json();

  assert.equal(patched.media.length, 1);
  assert.equal(patched.media[0].id, keep.id);
  const removedCheck = await pool.query('select count(*)::int c from project_space_media where id=$1', [remove.id]);
  assert.equal(removedCheck.rows[0].c, 0);

  await pool.query('delete from project_spaces where id=$1', [created.id]);
});

test('Espaces : id de média inconnu -> 400, rollback (version parent inchangée)', async () => {
  const created = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/spaces`, {
    method: 'POST', ...withUser(ids.editor),
    body: jsonBody({ name: 'Espace Rejet', position: 0, media: [] })
  })).json();

  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/spaces/${created.id}`, {
    method: 'PATCH', ...withUser(ids.editor),
    body: jsonBody({ name: 'X', version: created.version, media: [{ id: '00000000-0000-0000-0000-000000000000', kind: 'view', assetId: ids.assetInProject, position: 0 }] })
  });
  assert.equal(res.status, 400);

  const stillV1 = await pool.query('select version from project_spaces where id=$1', [created.id]);
  assert.equal(stillV1.rows[0].version, created.version, 'rollback réel : la version parent ne doit pas avoir bougé');

  await pool.query('delete from project_spaces where id=$1', [created.id]);
});

test('Espaces : id de média d\'un AUTRE espace -> 400, rollback', async () => {
  const spaceA = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/spaces`, {
    method: 'POST', ...withUser(ids.editor),
    body: jsonBody({ name: 'Espace A', position: 0, media: [{ kind: 'view', assetId: ids.assetInProject, position: 0 }] })
  })).json();
  const spaceB = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/spaces`, {
    method: 'POST', ...withUser(ids.editor),
    body: jsonBody({ name: 'Espace B', position: 1, media: [] })
  })).json();

  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/spaces/${spaceB.id}`, {
    method: 'PATCH', ...withUser(ids.editor),
    body: jsonBody({ name: 'Espace B', version: spaceB.version, media: [{ id: spaceA.media[0].id, kind: 'view', assetId: ids.assetInProject, position: 0 }] })
  });
  assert.equal(res.status, 400);

  const spaceAMediaStillThere = await pool.query('select count(*)::int c from project_space_media where id=$1', [spaceA.media[0].id]);
  assert.equal(spaceAMediaStillThere.rows[0].c, 1, 'le média de l\'espace A ne doit surtout pas avoir été déplacé/affecté');

  await pool.query('delete from project_spaces where id=$1', [spaceA.id]);
  await pool.query('delete from project_spaces where id=$1', [spaceB.id]);
});

test('Espaces : id de média en double dans le payload -> 400, rollback', async () => {
  const created = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/spaces`, {
    method: 'POST', ...withUser(ids.editor),
    body: jsonBody({ name: 'Espace Doublon', position: 0, media: [{ kind: 'view', assetId: ids.assetInProject, position: 0 }] })
  })).json();
  const mediaId = created.media[0].id;

  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/spaces/${created.id}`, {
    method: 'PATCH', ...withUser(ids.editor),
    body: jsonBody({ name: 'X', version: created.version, media: [
      { id: mediaId, kind: 'view', assetId: ids.assetInProject, position: 0 },
      { id: mediaId, kind: 'view', assetId: ids.assetInProject, position: 1 }
    ] })
  });
  assert.equal(res.status, 400);

  const stillV1 = await pool.query('select version from project_spaces where id=$1', [created.id]);
  assert.equal(stillV1.rows[0].version, created.version);

  await pool.query('delete from project_spaces where id=$1', [created.id]);
});

test('Espaces : 409 sur version périmée du parent, toujours fonctionnel après le correctif média', async () => {
  const created = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/spaces`, {
    method: 'POST', ...withUser(ids.editor),
    body: jsonBody({ name: 'Espace 409', position: 0, media: [] })
  })).json();

  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/spaces/${created.id}`, {
    method: 'PATCH', ...withUser(ids.editor),
    body: jsonBody({ name: 'X', version: created.version - 1 || 999, media: [] })
  });
  assert.equal(res.status, 409);

  await pool.query('delete from project_spaces where id=$1', [created.id]);
});

// ── Régression : PATCH sur un "domaine simple" (Questions/Jalons/
// Équipe/Ambassadeurs) doit réellement persister position. Bug trouvé
// pendant l'intégration Ambassadeurs (updateAmbassador n'incluait pas
// position dans son SET) -- confirmé systémique aux 4 domaines
// partageant mountSimpleDomain, corrigé partout avec COALESCE (pour
// ne jamais casser un domaine qui n'envoie pas encore ce champ,
// comme Questions aujourd'hui).

test('Ambassadeurs : PATCH avec un nouveau position le persiste réellement (pas seulement les autres champs)', async () => {
  const a = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/ambassadors`, {
    method: 'POST', ...withUser(ids.editor), body: jsonBody({ name: 'Ambassadeur A', position: 0 })
  })).json();
  const b = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/ambassadors`, {
    method: 'POST', ...withUser(ids.editor), body: jsonBody({ name: 'Ambassadeur B', position: 1 })
  })).json();

  // Échanger les positions via deux PATCH indépendants, comme le fait le front réel.
  await fetch(`${baseUrl}/api/projects/${ids.project}/studio/ambassadors/${a.id}`, {
    method: 'PATCH', ...withUser(ids.editor), body: jsonBody({ name: 'Ambassadeur A', position: 1, version: a.version })
  });
  await fetch(`${baseUrl}/api/projects/${ids.project}/studio/ambassadors/${b.id}`, {
    method: 'PATCH', ...withUser(ids.editor), body: jsonBody({ name: 'Ambassadeur B', position: 0, version: b.version })
  });

  const order = await pool.query('select name from project_ambassadors where id = ANY($1) order by position', [[a.id, b.id]]);
  assert.deepEqual(order.rows.map(r => r.name), ['Ambassadeur B', 'Ambassadeur A'], 'position doit être réellement persistée, pas silencieusement ignorée');

  await pool.query('delete from project_ambassadors where id = ANY($1)', [[a.id, b.id]]);
});

test('Questions : un PATCH sans position ne casse rien (COALESCE conserve la valeur existante)', async () => {
  const q = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/questions`, {
    method: 'POST', ...withUser(ids.editor), body: jsonBody({ question: 'Q', answerRuns: [], position: 3 })
  })).json();

  const patched = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/questions/${q.id}`, {
    method: 'PATCH', ...withUser(ids.editor), body: jsonBody({ question: 'Q modifiée', answerRuns: [], version: q.version })
  })).json();
  assert.equal(patched.position, 3, 'position doit rester inchangée quand elle n\'est pas fournie dans le payload');

  await pool.query('delete from project_questions where id=$1', [q.id]);
});

// ── Section content (Homepage) ──

test('Section content Homepage : GET initial vide, POST/PATCH crée puis met à jour', async () => {
  const initial = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/section-content/homepage`, withUser(ids.editor));
  const initialBody = await initial.json();
  assert.equal(initialBody.version, null);

  const created = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/section-content/homepage`, {
    method: 'PATCH', ...withUser(ids.editor), body: jsonBody({ fields: { message: 'Bienvenue' } })
  });
  assert.equal(created.status, 200);
  const createdBody = await created.json();
  assert.equal(createdBody.version, 1);

  const updated = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/section-content/homepage`, {
    method: 'PATCH', ...withUser(ids.editor), body: jsonBody({ fields: { message: 'Bienvenue v2' }, version: createdBody.version })
  });
  assert.equal(updated.status, 200);
  const updatedBody = await updated.json();
  assert.equal(updatedBody.version, 2);
  assert.equal(updatedBody.fields.message, 'Bienvenue v2');

  await pool.query('delete from project_section_content where project_id=$1', [ids.project]);
});

test('Section content Homepage : champ hors {message, askPrompt} refusé', async () => {
  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/section-content/homepage`, {
    method: 'PATCH', ...withUser(ids.editor), body: jsonBody({ fields: { message: 'x', kpiFictif: 42 } })
  });
  assert.equal(res.status, 400);
});

// ── Delta Homepage V3 : composition éditoriale (message, featuredArticleMode/Id, showMilestones, showAskPrompt, askPrompt) ──

test('Homepage V3 : PATCH full-resource avec les 6 champs cibles accepté', async () => {
  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/section-content/homepage`, {
    method: 'PATCH', ...withUser(ids.editor),
    body: jsonBody({ fields: { message: 'Bienvenue', featuredArticleMode: 'latest', featuredArticleId: null, showMilestones: true, showAskPrompt: true, askPrompt: 'Une question ?' } })
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.fields, { message: 'Bienvenue', featuredArticleMode: 'latest', featuredArticleId: null, showMilestones: true, showAskPrompt: true, askPrompt: 'Une question ?' });
  await pool.query('delete from project_section_content where project_id=$1', [ids.project]);
});

test('Homepage V3 : featuredArticleMode invalide refusé', async () => {
  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/section-content/homepage`, {
    method: 'PATCH', ...withUser(ids.editor), body: jsonBody({ fields: { featuredArticleMode: 'pinned' } })
  });
  assert.equal(res.status, 400);
});

test('Homepage V3 : showMilestones/showAskPrompt non booléens refusés', async () => {
  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/section-content/homepage`, {
    method: 'PATCH', ...withUser(ids.editor), body: jsonBody({ fields: { showMilestones: 'oui' } })
  });
  assert.equal(res.status, 400);
});

test('Homepage V3 : manual + featuredArticleId inexistant -> refusé, aucune écriture', async () => {
  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/section-content/homepage`, {
    method: 'PATCH', ...withUser(ids.editor),
    body: jsonBody({ fields: { featuredArticleMode: 'manual', featuredArticleId: '00000000-0000-0000-0000-000000000000' } })
  });
  assert.equal(res.status, 400);
  const row = await pool.query('select 1 from project_section_content where project_id=$1', [ids.project]);
  assert.equal(row.rows.length, 0, 'aucune ligne ne doit avoir été créée sur un rejet');
});

test('Homepage V3 : manual + featuredArticleId d\'un AUTRE projet -> refusé', async () => {
  const { rows: [otherProject] } = await pool.query('insert into projects (tenant_id, name) values ($1,$2) returning id', [ids.tenantA, 'Autre Projet Homepage Test']);
  await pool.query('insert into project_memberships (tenant_id, project_id, user_id, permission_bundle) values ($1,$2,$3,$4)', [ids.tenantA, otherProject.id, ids.editor, 'editor']);
  const otherArticle = await (await fetch(`${baseUrl}/api/projects/${otherProject.id}/studio/articles`, {
    method: 'POST', ...withUser(ids.editor), body: jsonBody({ title: 'Article Autre Projet', chapeauRuns: [], blocks: [], position: 0 })
  })).json();

  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/section-content/homepage`, {
    method: 'PATCH', ...withUser(ids.editor),
    body: jsonBody({ fields: { featuredArticleMode: 'manual', featuredArticleId: otherArticle.id } })
  });
  assert.equal(res.status, 400);

  await pool.query('delete from project_articles where id=$1', [otherArticle.id]);
  await pool.query('delete from projects where id=$1', [otherProject.id]);
});

test('Homepage V3 : manual + featuredArticleId d\'un article réel du même projet -> accepté', async () => {
  const article = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/articles`, {
    method: 'POST', ...withUser(ids.editor), body: jsonBody({ title: 'Article Homepage Test', chapeauRuns: [], blocks: [], position: 0 })
  })).json();

  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/section-content/homepage`, {
    method: 'PATCH', ...withUser(ids.editor),
    body: jsonBody({ fields: { featuredArticleMode: 'manual', featuredArticleId: article.id } })
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.fields.featuredArticleId, article.id);

  await pool.query('delete from project_section_content where project_id=$1', [ids.project]);
  await pool.query('delete from project_articles where id=$1', [article.id]);
});

test('Homepage V3 : manual + featuredArticleId null (brouillon incomplet) accepté', async () => {
  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/section-content/homepage`, {
    method: 'PATCH', ...withUser(ids.editor),
    body: jsonBody({ fields: { featuredArticleMode: 'manual', featuredArticleId: null } })
  });
  assert.equal(res.status, 200);
  await pool.query('delete from project_section_content where project_id=$1', [ids.project]);
});

test('Homepage V3 : suppression de l\'article référencé ne modifie jamais la référence en base (dégradation déférée au futur Compiler)', async () => {
  const article = await (await fetch(`${baseUrl}/api/projects/${ids.project}/studio/articles`, {
    method: 'POST', ...withUser(ids.editor), body: jsonBody({ title: 'Article À Supprimer', chapeauRuns: [], blocks: [], position: 0 })
  })).json();

  await fetch(`${baseUrl}/api/projects/${ids.project}/studio/section-content/homepage`, {
    method: 'PATCH', ...withUser(ids.editor),
    body: jsonBody({ fields: { featuredArticleMode: 'manual', featuredArticleId: article.id } })
  });

  await fetch(`${baseUrl}/api/projects/${ids.project}/studio/articles/${article.id}?version=${article.version}`, { method: 'DELETE', ...withUser(ids.editor) });

  const row = await pool.query('select fields from project_section_content where project_id=$1', [ids.project]);
  assert.equal(row.rows[0].fields.featuredArticleId, article.id, 'la référence doit rester inchangée après suppression de l\'article, jamais nettoyée par Studio');

  await pool.query('delete from project_section_content where project_id=$1', [ids.project]);
});

// ── Non-régression : cross-tenant toujours impossible sur ces nouvelles routes ──

test('cross-tenant : un utilisateur sans membership sur ce projet -> 404 sur les routes Studio aussi', async () => {
  const { rows: [outsider] } = await pool.query("insert into users (email, display_name) values ('outsider-studio@test.local','Outsider') returning id");
  await pool.query('insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1,$2,$3)', [ids.tenantB, outsider.id, 'member']);

  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/studio/questions`, withUser(outsider.id));
  assert.equal(res.status, 404);

  await pool.query('delete from tenant_memberships where user_id=$1', [outsider.id]);
  await pool.query('delete from users where id=$1', [outsider.id]);
});

// ── Régression cascade : politique de suppression différenciée par
// sens métier (migration 0005), jamais un ON DELETE uniforme.
//   CASCADE : la ligne n'a structurellement aucun sens sans son asset
//     (bloc image, média de section narrative, média d'espace).
//   SET NULL : l'objet reste valide sans sa photo (membre d'équipe,
//     ambassadeur).
// Deux angles testés séparément : suppression du projet entier (tous
// les chemins de cascade croisés en même temps), et suppression
// directe d'un asset précis (vérifie le comportement exact par type,
// pas seulement l'absence d'erreur).

async function seedAllFiveAssetReferences(tenantId, projectId) {
  const mk = async (kind) => {
    const { rows: [a] } = await pool.query(
      "insert into assets (tenant_id, project_id, kind, storage_key, content_type, byte_size) values ($1,$2,$3,$4,'image/png',10) returning id",
      [tenantId, projectId, kind, `key-${kind}-${Math.random()}`]
    );
    return a.id;
  };
  const articleImageAsset = await mk('article_image');
  const teamPhotoAsset = await mk('team_photo');
  const narrativeMediaAsset = await mk('narrative_media');
  const ambassadorPhotoAsset = await mk('ambassador_photo');
  const spaceMediaAsset = await mk('space_media');

  const { rows: [article] } = await pool.query(
    'insert into project_articles (tenant_id, project_id, title, position) values ($1,$2,$3,0) returning id',
    [tenantId, projectId, 'Article Cascade Test']
  );
  const { rows: [block] } = await pool.query(
    'insert into project_article_blocks (tenant_id, project_id, article_id, block_type, image_asset_id, position) values ($1,$2,$3,$4,$5,$6) returning id',
    [tenantId, projectId, article.id, 'image', articleImageAsset, 0]
  );
  const { rows: [teamMember] } = await pool.query(
    'insert into project_team_members (tenant_id, project_id, name, photo_asset_id, position) values ($1,$2,$3,$4,0) returning id',
    [tenantId, projectId, 'Membre Cascade Test', teamPhotoAsset]
  );
  const { rows: [section] } = await pool.query(
    "insert into project_narrative_sections (tenant_id, project_id, section_type, position) values ($1,$2,'gallery',0) returning id",
    [tenantId, projectId]
  );
  const { rows: [narrativeMedia] } = await pool.query(
    'insert into project_narrative_section_media (tenant_id, project_id, section_id, asset_id, position) values ($1,$2,$3,$4,0) returning id',
    [tenantId, projectId, section.id, narrativeMediaAsset]
  );
  const { rows: [ambassador] } = await pool.query(
    'insert into project_ambassadors (tenant_id, project_id, name, photo_asset_id, position) values ($1,$2,$3,$4,0) returning id',
    [tenantId, projectId, 'Ambassadeur Cascade Test', ambassadorPhotoAsset]
  );
  const { rows: [space] } = await pool.query(
    "insert into project_spaces (tenant_id, project_id, name, position) values ($1,$2,'Espace Cascade Test',0) returning id",
    [tenantId, projectId]
  );
  const { rows: [spaceMedia] } = await pool.query(
    "insert into project_space_media (tenant_id, project_id, space_id, kind, asset_id, position) values ($1,$2,$3,'view',$4,0) returning id",
    [tenantId, projectId, space.id, spaceMediaAsset]
  );

  return {
    articleImageAsset, teamPhotoAsset, narrativeMediaAsset, ambassadorPhotoAsset, spaceMediaAsset,
    article: article.id, block: block.id, teamMember: teamMember.id,
    section: section.id, narrativeMedia: narrativeMedia.id,
    ambassador: ambassador.id, space: space.id, spaceMedia: spaceMedia.id
  };
}

test('cascade : supprimer un projet contenant les 5 formes de référence asset réussit sans erreur FK', async () => {
  const { rows: [tenant] } = await pool.query("insert into tenants (name) values ('Tenant Cascade Test') returning id");
  const { rows: [project] } = await pool.query('insert into projects (tenant_id, name) values ($1,$2) returning id', [tenant.id, 'Projet Cascade Jetable']);
  const ids2 = await seedAllFiveAssetReferences(tenant.id, project.id);

  await assert.doesNotReject(pool.query('delete from projects where id=$1', [project.id]));

  const counts = await Promise.all([
    pool.query('select count(*)::int c from project_article_blocks where id=$1', [ids2.block]),
    pool.query('select count(*)::int c from project_team_members where id=$1', [ids2.teamMember]),
    pool.query('select count(*)::int c from project_narrative_section_media where id=$1', [ids2.narrativeMedia]),
    pool.query('select count(*)::int c from project_ambassadors where id=$1', [ids2.ambassador]),
    pool.query('select count(*)::int c from project_space_media where id=$1', [ids2.spaceMedia]),
    pool.query('select count(*)::int c from assets where id = ANY($1)', [[ids2.articleImageAsset, ids2.teamPhotoAsset, ids2.narrativeMediaAsset, ids2.ambassadorPhotoAsset, ids2.spaceMediaAsset]])
  ]);
  assert.ok(counts.every(r => r.rows[0].c === 0), 'tout doit être parti en cascade avec le projet, quel que soit le type de relation');

  await pool.query('delete from tenants where id=$1', [tenant.id]);
});

test('cascade : suppression directe d\'un asset — CASCADE pour bloc/médias, SET NULL pour photos de personnes', async () => {
  const { rows: [tenant] } = await pool.query("insert into tenants (name) values ('Tenant Cascade Direct Test') returning id");
  const { rows: [project] } = await pool.query('insert into projects (tenant_id, name) values ($1,$2) returning id', [tenant.id, 'Projet Cascade Direct']);
  const ids2 = await seedAllFiveAssetReferences(tenant.id, project.id);

  // Supprimer les 5 assets un par un, directement (pas via le projet).
  await pool.query('delete from assets where id = ANY($1)', [[
    ids2.articleImageAsset, ids2.teamPhotoAsset, ids2.narrativeMediaAsset, ids2.ambassadorPhotoAsset, ids2.spaceMediaAsset
  ]]);

  const blockGone = await pool.query('select count(*)::int c from project_article_blocks where id=$1', [ids2.block]);
  assert.equal(blockGone.rows[0].c, 0, 'le bloc image doit être supprimé (CASCADE) — un bloc image sans image n\'a aucun sens');

  const narrativeMediaGone = await pool.query('select count(*)::int c from project_narrative_section_media where id=$1', [ids2.narrativeMedia]);
  assert.equal(narrativeMediaGone.rows[0].c, 0, 'le média narratif doit être supprimé (CASCADE)');

  const spaceMediaGone = await pool.query('select count(*)::int c from project_space_media where id=$1', [ids2.spaceMedia]);
  assert.equal(spaceMediaGone.rows[0].c, 0, 'le média d\'espace doit être supprimé (CASCADE)');

  const teamMemberRow = await pool.query('select tenant_id, project_id, photo_asset_id from project_team_members where id=$1', [ids2.teamMember]);
  assert.equal(teamMemberRow.rows.length, 1, 'le membre d\'équipe doit être CONSERVÉ (SET NULL, pas CASCADE)');
  assert.equal(teamMemberRow.rows[0].tenant_id, tenant.id, 'tenant_id doit rester intact — SET NULL ciblé, pas toute la FK composite');
  assert.equal(teamMemberRow.rows[0].project_id, project.id, 'project_id doit rester intact — SET NULL ciblé, pas toute la FK composite');
  assert.equal(teamMemberRow.rows[0].photo_asset_id, null, 'seule sa référence photo doit être détachée (null)');

  const ambassadorRow = await pool.query('select tenant_id, project_id, photo_asset_id from project_ambassadors where id=$1', [ids2.ambassador]);
  assert.equal(ambassadorRow.rows.length, 1, 'l\'ambassadeur doit être CONSERVÉ (SET NULL, pas CASCADE)');
  assert.equal(ambassadorRow.rows[0].tenant_id, tenant.id, 'tenant_id doit rester intact — SET NULL ciblé, pas toute la FK composite');
  assert.equal(ambassadorRow.rows[0].project_id, project.id, 'project_id doit rester intact — SET NULL ciblé, pas toute la FK composite');
  assert.equal(ambassadorRow.rows[0].photo_asset_id, null, 'seule sa référence photo doit être détachée (null)');

  await pool.query('delete from projects where id=$1', [project.id]);
  await pool.query('delete from tenants where id=$1', [tenant.id]);
});
