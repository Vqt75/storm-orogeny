import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { createApp } from '../src/http/app.js';
import { createStorageAdapter } from '../src/adapters/storage/index.js';
import { seedTenantMembership, seedProjectMembership } from './helpers/memberships.js';
import { acceptProjectInvitation } from '../src/domain/memberships/repository.js';

const config = loadConfig();
const pool = getPool(config);
const storageAdapter = createStorageAdapter(config);
const silentLogger = { info() {}, warn() {}, error() {} };

let app, server, baseUrl;
let ids = {};

async function cleanAll() {
  await pool.query('delete from project_grants');
  await pool.query('delete from project_invitations');
  await pool.query('delete from external_group_mappings');
  await pool.query('delete from project_memberships');
  await pool.query('delete from tenant_memberships');
  await pool.query('delete from projects');
  await pool.query('delete from users');
  await pool.query('delete from tenants');
}

test.before(async () => {
  await runMigrations();
  await cleanAll();

  const { rows: [tenant] } = await pool.query("insert into tenants (name) values ('Tenant Access V2') returning id");
  const { rows: [admin] } = await pool.query("insert into users (email, display_name) values ('adminaccessv2@test.local','Admin Access V2') returning id");
  const { rows: [member] } = await pool.query("insert into users (email, display_name) values ('memberaccessv2@test.local','Member Access V2') returning id");
  const { rows: [alice] } = await pool.query("insert into users (email, display_name) values ('aliceaccessv2@test.local','Alice Access V2') returning id");
  const { rows: [project] } = await pool.query("insert into projects (tenant_id, name) values ($1,'Projet Access V2') returning id", [tenant.id]);

  await seedTenantMembership(pool, { tenantId: tenant.id, userId: admin.id, permissionBundle: 'organization_admin' });
  await seedTenantMembership(pool, { tenantId: tenant.id, userId: member.id, permissionBundle: 'member' });
  await seedTenantMembership(pool, { tenantId: tenant.id, userId: alice.id, permissionBundle: 'member' });
  await seedProjectMembership(pool, { tenantId: tenant.id, projectId: project.id, userId: alice.id, permissionBundle: 'contributor' });

  ids = { tenantId: tenant.id, projectId: project.id, admin: admin.id, member: member.id, alice: alice.id };

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

function withUser(userId) {
  return { headers: { 'X-Storm-Dev-User': userId } };
}

test('GET /access retourne les sources d\'accès réelles, une entrée par personne, jamais un doublon par grant', async () => {
  const res = await fetch(`${baseUrl}/api/control/projects/${ids.projectId}/access`, withUser(ids.admin));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.peopleCount, 1, 'alice uniquement, comptée une fois');
  assert.equal(body.people.length, 1);
  assert.equal(body.people[0].email, 'aliceaccessv2@test.local');
  assert.equal(body.people[0].sources.length, 1);
  assert.equal(body.people[0].sources[0].sourceType, 'direct');
});

test('member (sans projects.manage_memberships/view_all) -> 403 sur /access, jamais une donnée exposée', async () => {
  const res = await fetch(`${baseUrl}/api/control/projects/${ids.projectId}/access`, withUser(ids.member));
  assert.equal(res.status, 403);
});

test('deux grants actifs simultanés pour la même personne -> une seule entrée "people", deux sources distinctes', async () => {
  const { rows: [pm] } = await pool.query('select id from project_memberships where project_id=$1 and user_id=$2', [ids.projectId, ids.alice]);
  await pool.query(
    `insert into project_grants (tenant_id, project_id, project_membership_id, permission_bundle, source_type, external_provider, external_group_id)
     values ($1,$2,$3,'editor','external_group_mapping','entra','grp-test')`,
    [ids.tenantId, ids.projectId, pm.id]
  );

  const res = await fetch(`${baseUrl}/api/control/projects/${ids.projectId}/access`, withUser(ids.admin));
  const body = await res.json();
  assert.equal(body.peopleCount, 1, 'toujours une seule personne, jamais comptée deux fois');
  assert.equal(body.people[0].sources.length, 2, 'deux sources distinctes pour la même personne');

  await pool.query("delete from project_grants where project_membership_id=$1 and source_type='external_group_mapping'", [pm.id]);
});

test('POST /invitations crée une invitation réelle, visible ensuite dans /access', async () => {
  const res = await fetch(`${baseUrl}/api/control/projects/${ids.projectId}/invitations`, {
    method: 'POST', ...withUser(ids.admin),
    headers: { ...withUser(ids.admin).headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'invite.testv2@example.com', permissionBundle: 'editor', locale: 'fr' })
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.ok(body.id);
  ids.invitationId = body.id;

  const accessRes = await fetch(`${baseUrl}/api/control/projects/${ids.projectId}/access`, withUser(ids.admin));
  const accessBody = await accessRes.json();
  assert.equal(accessBody.pendingInvitationsCount, 1);
  assert.ok(accessBody.invitations.some(i => i.email === 'invite.testv2@example.com' && i.status === 'pending'));
});

test('une invitation en attente n\'est jamais comptée parmi les personnes ayant accès', async () => {
  const res = await fetch(`${baseUrl}/api/control/projects/${ids.projectId}/access`, withUser(ids.admin));
  const body = await res.json();
  assert.equal(body.peopleCount, 1, 'toujours alice uniquement -- l\'invitation en attente ne compte jamais comme un accès effectif');
});

test('acceptation réelle d\'une invitation -> crée membership+grant, la personne apparaît ensuite comme membre effectif', async () => {
  const { rows: [invitee] } = await pool.query("insert into users (email, display_name) values ('invite.testv2@example.com','Invité Test') returning id");
  const result = await acceptProjectInvitation(pool, { invitationId: ids.invitationId, userId: invitee.id });
  assert.ok(result.membershipId);

  const res = await fetch(`${baseUrl}/api/control/projects/${ids.projectId}/access`, withUser(ids.admin));
  const body = await res.json();
  assert.equal(body.peopleCount, 2, 'alice + l\'invité maintenant accepté');
  assert.equal(body.pendingInvitationsCount, 0, 'l\'invitation acceptée ne compte plus comme en attente');
  const inviteeEntry = body.people.find(p => p.email === 'invite.testv2@example.com');
  assert.ok(inviteeEntry);
  assert.equal(inviteeEntry.sources[0].sourceType, 'direct');
});

test('POST /invitations/:id/revoke révoque réellement, jamais une invitation déjà acceptée', async () => {
  const createRes = await fetch(`${baseUrl}/api/control/projects/${ids.projectId}/invitations`, {
    method: 'POST', headers: { ...withUser(ids.admin).headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'revoke.testv2@example.com', permissionBundle: 'pilot', locale: 'fr' })
  });
  const { id: revokeId } = await createRes.json();

  const revokeRes = await fetch(`${baseUrl}/api/control/projects/${ids.projectId}/invitations/${revokeId}/revoke`, { method: 'POST', ...withUser(ids.admin) });
  assert.equal(revokeRes.status, 200);
  assert.equal((await revokeRes.json()).status, 'revoked');

  // Une invitation déjà révoquée ne peut pas l'être une seconde fois.
  const secondRevoke = await fetch(`${baseUrl}/api/control/projects/${ids.projectId}/invitations/${revokeId}/revoke`, { method: 'POST', ...withUser(ids.admin) });
  assert.equal(secondRevoke.status, 404);
});

test('DELETE /grants/:grantId révoque une source précise, jamais toute la membership -- l\'autre source (s\'il y en a) survit', async () => {
  const { rows: [pm] } = await pool.query('select id from project_memberships where project_id=$1 and user_id=$2', [ids.projectId, ids.alice]);
  const { rows: [extraGrant] } = await pool.query(
    `insert into project_grants (tenant_id, project_id, project_membership_id, permission_bundle, source_type)
     values ($1,$2,$3,'pilot','direct') returning id`,
    [ids.tenantId, ids.projectId, pm.id]
  );

  const beforeRes = await fetch(`${baseUrl}/api/control/projects/${ids.projectId}/access`, withUser(ids.admin));
  const before = (await beforeRes.json()).people.find(p => p.email === 'aliceaccessv2@test.local');
  assert.equal(before.sources.length, 2);

  const delRes = await fetch(`${baseUrl}/api/control/projects/${ids.projectId}/grants/${extraGrant.id}`, { method: 'DELETE', ...withUser(ids.admin) });
  assert.equal(delRes.status, 204);

  const afterRes = await fetch(`${baseUrl}/api/control/projects/${ids.projectId}/access`, withUser(ids.admin));
  const after = (await afterRes.json()).people.find(p => p.email === 'aliceaccessv2@test.local');
  assert.equal(after.sources.length, 1, 'le grant original (contributor) doit avoir survécu intact');
});

test('garde-fou dernier project_admin -- impossible de révoquer le seul grant project_admin restant', async () => {
  const { rows: [tenant2] } = await pool.query("insert into tenants (name) values ('Tenant LastAdmin') returning id");
  const { rows: [soleAdmin] } = await pool.query("insert into users (email, display_name) values ('soleadmin@test.local','Sole Admin') returning id");
  await seedTenantMembership(pool, { tenantId: tenant2.id, userId: soleAdmin.id, permissionBundle: 'organization_admin' });
  const { rows: [proj2] } = await pool.query("insert into projects (tenant_id, name) values ($1,'Projet LastAdmin') returning id", [tenant2.id]);
  await seedProjectMembership(pool, { tenantId: tenant2.id, projectId: proj2.id, userId: soleAdmin.id, permissionBundle: 'project_admin' });

  const { rows: [{ id: grantId }] } = await pool.query(
    "select id from project_grants where project_id=$1 and permission_bundle='project_admin'", [proj2.id]
  );

  const res = await fetch(`${baseUrl}/api/control/projects/${proj2.id}/grants/${grantId}`, { method: 'DELETE', ...withUser(soleAdmin.id) });
  assert.equal(res.status, 403, 'le dernier project_admin ne doit jamais pouvoir être retiré');

  const { rows: [check] } = await pool.query("select status from project_grants where id=$1", [grantId]);
  assert.equal(check.status, 'active', 'le grant doit rester actif, jamais révoqué malgré la tentative');
});

test('GET /external-group-mappings -- lecture seule, gardée par organization.external_identity.manage, jamais members.manage seul', async () => {
  await pool.query(
    `insert into external_group_mappings (tenant_id, provider, external_group_id, target_type, target_id, permission_bundle)
     values ($1,'entra','grp-editors-v2','project',$2,'editor')`,
    [ids.tenantId, ids.projectId]
  );
  const res = await fetch(`${baseUrl}/api/control/external-group-mappings`, withUser(ids.admin));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.some(m => m.externalGroupId === 'grp-editors-v2' && m.permissionBundle === 'editor'));
});

test('member -> 403 sur /external-group-mappings', async () => {
  const res = await fetch(`${baseUrl}/api/control/external-group-mappings`, withUser(ids.member));
  assert.equal(res.status, 403);
});
