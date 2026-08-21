import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { createApp } from '../src/http/app.js';

const config = loadConfig();
const pool = getPool(config);
const silentLogger = { info() {}, warn() {}, error() {} };

let app, server, baseUrl;
let ids = {};

async function cleanAll() {
  await pool.query('delete from project_invitations');
  await pool.query('delete from project_modules');
  await pool.query('delete from project_settings');
  await pool.query('delete from project_identity');
  await pool.query('delete from project_memberships');
  await pool.query('delete from tenant_memberships');
  await pool.query('delete from projects');
  await pool.query('delete from users');
  await pool.query('delete from tenants');
}

async function countAll() {
  const tables = ['projects', 'project_identity', 'project_settings', 'project_modules', 'project_memberships', 'project_invitations'];
  const counts = {};
  for (const t of tables) {
    const { rows: [{ count }] } = await pool.query(`select count(*)::int from ${t}`);
    counts[t] = count;
  }
  return counts;
}

test.before(async () => {
  await runMigrations();
  await cleanAll();

  const { rows: [tenant] } = await pool.query("insert into tenants (name) values ('Tenant Lot2') returning id");
  const { rows: [creator] } = await pool.query("insert into users (email, display_name) values ('creator@lot2.local','Créateur Lot2') returning id");
  const { rows: [nonCreator] } = await pool.query("insert into users (email, display_name) values ('sansdroit@lot2.local','Sans Droit') returning id");
  const { rows: [otherTenant] } = await pool.query("insert into tenants (name) values ('Autre Tenant Lot2') returning id");

  await pool.query('insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1,$2,$3)', [tenant.id, creator.id, 'organization_admin']);
  await pool.query('insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1,$2,$3)', [tenant.id, nonCreator.id, 'member']);

  ids = { tenant: tenant.id, creator: creator.id, nonCreator: nonCreator.id, otherTenant: otherTenant.id };

  app = createApp({ logger: silentLogger, pool, config });
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await cleanAll();
  server.close();
  await closePool();
});

function post(userId, body) {
  return fetch(`${baseUrl}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Storm-Dev-User': userId },
    body: JSON.stringify(body)
  });
}

test('happy path : création complète avec identité, réglages, modules, invitations', async () => {
  const before = await countAll();
  const res = await post(ids.creator, {
    name: 'Projet Lot2',
    workspaceLocale: 'en',
    contentLocale: 'fr',
    identity: { primaryColor: '#1E1D1E', theme: 'ivory' },
    modules: { faq: true, actu: false },
    invites: [{ email: 'tarrance@ext.local', permissionBundle: 'editor', locale: 'nl' }]
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.ok(body.id);
  assert.equal(body.name, 'Projet Lot2');
  assert.equal(body.status, 'active');

  const { rows: [project] } = await pool.query('select tenant_id from projects where id=$1', [body.id]);
  assert.equal(project.tenant_id, ids.tenant, 'le projet appartient bien au tenant du créateur');

  const { rows: [membership] } = await pool.query('select permission_bundle from project_memberships where project_id=$1 and user_id=$2', [body.id, ids.creator]);
  assert.equal(membership.permission_bundle, 'project_admin', 'le créateur reçoit project_admin');

  const { rows: [invitation] } = await pool.query('select status, permission_bundle, locale from project_invitations where project_id=$1', [body.id]);
  assert.equal(invitation.status, 'pending');
  assert.equal(invitation.permission_bundle, 'editor');
  assert.equal(invitation.locale, 'nl');

  const { rows: getProjects } = await fetch(`${baseUrl}/api/projects`, { headers: { 'X-Storm-Dev-User': ids.creator } }).then(r => r.json()).then(list => ({ rows: list }));
  assert.ok(getProjects.some(p => p.id === body.id), 'le projet est immédiatement visible dans GET /api/projects');
  const listed = getProjects.find(p => p.id === body.id);
  assert.equal(listed.identity.primaryColor, '#1E1D1E', 'GET /api/projects expose identity.primaryColor (Product Integrity Pass #2 — couture logo Storm Home)');
  assert.equal(listed.identity.logoAssetId, null, 'aucun logo uploadé ici -> logoAssetId strictement null, jamais absent ni une chaîne vide');

  const after = await countAll();
  assert.equal(after.projects, before.projects + 1);

  await pool.query('delete from project_invitations where project_id=$1', [body.id]);
  await pool.query('delete from project_memberships where project_id=$1', [body.id]);
  await pool.query('delete from project_modules where project_id=$1', [body.id]);
  await pool.query('delete from project_settings where project_id=$1', [body.id]);
  await pool.query('delete from project_identity where project_id=$1', [body.id]);
  await pool.query('delete from projects where id=$1', [body.id]);
});

test('sans projects.create -> 403, zéro écriture', async () => {
  const before = await countAll();
  const res = await post(ids.nonCreator, { name: 'Devrait échouer', workspaceLocale: 'fr', contentLocale: 'fr' });
  assert.equal(res.status, 403);
  const after = await countAll();
  assert.deepEqual(after, before);
});

test('locale invalide -> 400, zéro écriture', async () => {
  const before = await countAll();
  const res = await post(ids.creator, { name: 'Devrait échouer', workspaceLocale: 'klingon', contentLocale: 'fr' });
  assert.equal(res.status, 400);
  const after = await countAll();
  assert.deepEqual(after, before);
});

test('bundle d\'invitation invalide -> 400, zéro écriture', async () => {
  const before = await countAll();
  const res = await post(ids.creator, {
    name: 'Devrait échouer', workspaceLocale: 'fr', contentLocale: 'fr',
    invites: [{ email: 'x@y.local', permissionBundle: 'admin', locale: 'fr' }]
  });
  assert.equal(res.status, 400);
  const after = await countAll();
  assert.deepEqual(after, before);
});

test('le tenant_id fourni par le client est totalement ignoré — impossible de créer sous un autre tenant', async () => {
  const res = await post(ids.creator, {
    name: 'Tentative mauvais tenant', workspaceLocale: 'fr', contentLocale: 'fr',
    tenantId: ids.otherTenant // doit être silencieusement ignoré, jamais utilisé
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  const { rows: [project] } = await pool.query('select tenant_id from projects where id=$1', [body.id]);
  assert.equal(project.tenant_id, ids.tenant, 'toujours le tenant du créateur, jamais celui fourni par le client');

  await pool.query('delete from project_memberships where project_id=$1', [body.id]);
  await pool.query('delete from project_modules where project_id=$1', [body.id]);
  await pool.query('delete from project_settings where project_id=$1', [body.id]);
  await pool.query('delete from project_identity where project_id=$1', [body.id]);
  await pool.query('delete from projects where id=$1', [body.id]);
});

test('aucune invitation -> création valide quand même', async () => {
  const res = await post(ids.creator, { name: 'Sans invitation', workspaceLocale: 'fr', contentLocale: 'fr' });
  assert.equal(res.status, 201);
  const body = await res.json();
  const { rows: invitations } = await pool.query('select * from project_invitations where project_id=$1', [body.id]);
  assert.equal(invitations.length, 0);

  await pool.query('delete from project_memberships where project_id=$1', [body.id]);
  await pool.query('delete from project_modules where project_id=$1', [body.id]);
  await pool.query('delete from project_settings where project_id=$1', [body.id]);
  await pool.query('delete from project_identity where project_id=$1', [body.id]);
  await pool.query('delete from projects where id=$1', [body.id]);
});

test('auto-invitation silencieusement exclue — le créateur ne reçoit pas d\'invitation en plus de son membership', async () => {
  const res = await post(ids.creator, {
    name: 'Auto-invitation', workspaceLocale: 'fr', contentLocale: 'fr',
    invites: [
      { email: 'CREATOR@LOT2.LOCAL', permissionBundle: 'editor', locale: 'fr' }, // casse différente, doit matcher creator@lot2.local
      { email: 'vraie@invitee.local', permissionBundle: 'contributor', locale: 'es' }
    ]
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  const { rows: invitations } = await pool.query('select email from project_invitations where project_id=$1', [body.id]);
  assert.equal(invitations.length, 1, 'seule la vraie invitation est créée, pas celle du créateur');
  assert.equal(invitations[0].email, 'vraie@invitee.local');

  await pool.query('delete from project_invitations where project_id=$1', [body.id]);
  await pool.query('delete from project_memberships where project_id=$1', [body.id]);
  await pool.query('delete from project_modules where project_id=$1', [body.id]);
  await pool.query('delete from project_settings where project_id=$1', [body.id]);
  await pool.query('delete from project_identity where project_id=$1', [body.id]);
  await pool.query('delete from projects where id=$1', [body.id]);
});

test('emails en double dans le même payload -> 400, zéro écriture', async () => {
  const before = await countAll();
  const res = await post(ids.creator, {
    name: 'Devrait échouer', workspaceLocale: 'fr', contentLocale: 'fr',
    invites: [
      { email: 'dup@x.local', permissionBundle: 'editor', locale: 'fr' },
      { email: 'DUP@X.LOCAL', permissionBundle: 'contributor', locale: 'en' }
    ]
  });
  assert.equal(res.status, 400);
  const after = await countAll();
  assert.deepEqual(after, before);
});

test('échec d\'écriture interne provoqué -> ROLLBACK complet, zéro ligne dans toutes les tables concernées', async () => {
  const before = await countAll();

  // Échec réellement provoqué (pas simulé) : révoquer temporairement le
  // droit d'écriture sur project_modules, qui s'insère APRÈS project/
  // identity/settings dans la transaction — prouve que les écritures
  // précédentes, déjà "réussies" dans cette même transaction, sont
  // bien annulées elles aussi.
  await pool.query('REVOKE INSERT ON project_modules FROM storm_orogeny');
  try {
    const res = await post(ids.creator, {
      name: 'Devrait tout annuler', workspaceLocale: 'fr', contentLocale: 'fr',
      modules: { faq: true }
    });
    assert.equal(res.status, 500);
  } finally {
    await pool.query('GRANT INSERT ON project_modules TO storm_orogeny');
  }

  const after = await countAll();
  assert.deepEqual(after, before, 'aucune table ne doit avoir gagné de ligne malgré les écritures partielles avant l\'échec');
});
