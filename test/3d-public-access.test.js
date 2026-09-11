import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { createApp } from '../src/http/app.js';
import { createStorageAdapter } from '../src/adapters/storage/index.js';
import { seedTenantMembership, seedProjectMembership } from './helpers/memberships.js';
import { generateRawCapability, hashCapability } from '../src/domain/publicAccess/capability.js';
import { encryptCapability, decryptCapability } from '../src/domain/publicAccess/encryption.js';
import {
  createFirstAccess, findCurrentAccess, resolvePublicAccess, setAvailability,
  rotateAccess, acknowledgeRedistribution, isRedistributionPending, decryptCurrentCapability
} from '../src/domain/publicAccess/repository.js';
import { createPublication } from '../src/domain/publication/repository.js';

const config = loadConfig();
const pool = getPool(config);
const storageAdapter = createStorageAdapter(config);
const silentLogger = { info() {}, warn() {}, error() {} };

let app, server, baseUrl;
let ids = {};

async function cleanAll() {
  await pool.query('delete from project_public_access');
  await pool.query('delete from project_publications');
  await pool.query('delete from project_invitations');
  await pool.query('delete from project_modules');
  await pool.query('delete from project_settings');
  await pool.query('delete from project_identity');
  await pool.query('delete from project_memberships');
  await pool.query('delete from tenant_memberships');
  await pool.query('delete from projects');
  await pool.query('delete from clients');
  await pool.query('delete from users');
  await pool.query('delete from tenants');
}

test.before(async () => {
  await runMigrations();
  await cleanAll();

  const { rows: [tenant] } = await pool.query("insert into tenants (name) values ('Tenant Public Access') returning id");
  const { rows: [otherTenant] } = await pool.query("insert into tenants (name) values ('Autre Tenant Public Access') returning id");
  const { rows: [orgAdmin] } = await pool.query("insert into users (email, display_name) values ('orgadmin@pa.local','OrgAdmin') returning id");
  const { rows: [projectAdmin] } = await pool.query("insert into users (email, display_name) values ('projectadmin@pa.local','ProjectAdmin') returning id");
  const { rows: [editor] } = await pool.query("insert into users (email, display_name) values ('editor@pa.local','Editor') returning id");
  const { rows: [pilotUser] } = await pool.query("insert into users (email, display_name) values ('pilot@pa.local','Pilot') returning id");

  await seedTenantMembership(pool, { tenantId: tenant.id, userId: orgAdmin.id, permissionBundle: 'organization_admin' });
  await seedTenantMembership(pool, { tenantId: tenant.id, userId: projectAdmin.id, permissionBundle: 'member' });
  await seedTenantMembership(pool, { tenantId: tenant.id, userId: editor.id, permissionBundle: 'member' });
  await seedTenantMembership(pool, { tenantId: tenant.id, userId: pilotUser.id, permissionBundle: 'member' });

  const { rows: [clientA] } = await pool.query(
    "insert into clients (tenant_id, name, normalized_slug) values ($1,'Client PA A','client-pa-a') returning id", [tenant.id]
  );
  const { rows: [clientB] } = await pool.query(
    "insert into clients (tenant_id, name, normalized_slug) values ($1,'Client PA B','client-pa-b') returning id", [tenant.id]
  );
  const { rows: [otherTenantClient] } = await pool.query(
    "insert into clients (tenant_id, name, normalized_slug) values ($1,'Client Autre Tenant','client-autre-tenant') returning id", [otherTenant.id]
  );

  const { rows: [project] } = await pool.query(
    "insert into projects (tenant_id, name, client_id) values ($1,'Projet PA',$2) returning id", [tenant.id, clientA.id]
  );
  await seedProjectMembership(pool, { tenantId: tenant.id, projectId: project.id, userId: projectAdmin.id, permissionBundle: 'project_admin' });
  await seedProjectMembership(pool, { tenantId: tenant.id, projectId: project.id, userId: editor.id, permissionBundle: 'editor' });
  await seedProjectMembership(pool, { tenantId: tenant.id, projectId: project.id, userId: pilotUser.id, permissionBundle: 'pilot' });
  await pool.query('insert into project_identity (tenant_id, project_id) values ($1,$2)', [tenant.id, project.id]);
  await pool.query("insert into project_settings (tenant_id, project_id, workspace_locale, content_locale) values ($1,$2,'fr','fr')", [tenant.id, project.id]);

  const { rows: [neverPublicProject] } = await pool.query(
    "insert into projects (tenant_id, name, client_id) values ($1,'Projet Jamais Publié',$2) returning id", [tenant.id, clientA.id]
  );
  await seedProjectMembership(pool, { tenantId: tenant.id, projectId: neverPublicProject.id, userId: projectAdmin.id, permissionBundle: 'project_admin' });

  ids = {
    tenant: tenant.id, otherTenant: otherTenant.id,
    orgAdmin: orgAdmin.id, projectAdmin: projectAdmin.id, editor: editor.id, pilotUser: pilotUser.id,
    clientA: clientA.id, clientB: clientB.id, otherTenantClient: otherTenantClient.id,
    project: project.id, neverPublicProject: neverPublicProject.id
  };

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
  return { headers: { 'X-Storm-Dev-User': userId, ...extra } };
}
function withUserJson(userId, body) {
  return { method: 'POST', headers: { 'X-Storm-Dev-User': userId, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
async function publish(projectId, userId) {
  return fetch(`${baseUrl}/api/projects/${projectId}/publications`, { method: 'POST', ...withUser(userId) });
}

// ── A. Capability / crypto ────────────────────────────────────────────

test('Capability -- deux générations diffèrent, hash déterministe, jamais la valeur brute retrouvée par hash', () => {
  const a = generateRawCapability();
  const b = generateRawCapability();
  assert.notEqual(a, b);
  assert.equal(hashCapability(a), hashCapability(a));
  assert.notEqual(hashCapability(a), a);
  assert.ok(Buffer.from(a, 'base64url').length >= 16, 'au moins 128 bits d\'entropie');
});

test('Chiffrement AES-GCM -- roundtrip, mauvaise clé échoue, altération détectée', () => {
  const key = randomBytes(32);
  const packed = encryptCapability('secret-de-test', key);
  assert.equal(decryptCapability(packed, key), 'secret-de-test');
  assert.throws(() => decryptCapability(packed, randomBytes(32)));
  const tampered = packed.slice(0, -1) + (packed.at(-1) === 'a' ? 'b' : 'a');
  assert.throws(() => decryptCapability(tampered, key));
});

test('Configuration production -- clé de chiffrement invalide rejetée explicitement', () => {
  const previous = process.env.PUBLIC_ACCESS_ENCRYPTION_KEY;
  const previousEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  process.env.PUBLIC_ACCESS_ENCRYPTION_KEY = 'trop-court';
  try {
    assert.throws(() => loadConfig(), /PUBLIC_ACCESS_ENCRYPTION_KEY/);
  } finally {
    process.env.NODE_ENV = previousEnv;
    if (previous === undefined) delete process.env.PUBLIC_ACCESS_ENCRYPTION_KEY; else process.env.PUBLIC_ACCESS_ENCRYPTION_KEY = previous;
  }
});

// ── B. Invariants DB ───────────────────────────────────────────────────

test('DB -- une seule identité courante (non révoquée) par projet, imposé par PostgreSQL', async () => {
  const { rows: [p] } = await pool.query(
    "insert into projects (tenant_id, name, client_id) values ($1,'Projet Invariant',$2) returning id", [ids.tenant, ids.clientA]
  );
  await createFirstAccess(pool, { tenantId: ids.tenant, projectId: p.id, clientSlug: 'x', projectSlug: 'y', encryptionKey: config.publicAccessEncryptionKey });
  await assert.rejects(
    pool.query(
      `insert into project_public_access (tenant_id, project_id, client_slug, project_slug, capability_hash, capability_encrypted, status, created_reason)
       values ($1,$2,'x','y','deadbeef','enc','active','first_publication')`,
      [ids.tenant, p.id]
    ),
    /duplicate key|unique/i
  );
  await pool.query('delete from project_public_access where project_id=$1', [p.id]);
  await pool.query('delete from projects where id=$1', [p.id]);
});

test('DB -- FK composite tenant-safe rejette une incohérence cross-tenant en écriture directe', async () => {
  await assert.rejects(
    pool.query(
      `insert into project_public_access (tenant_id, project_id, client_slug, project_slug, capability_hash, capability_encrypted, status, created_reason)
       values ($1,$2,'x','y','deadbeef2','enc','active','first_publication')`,
      [ids.otherTenant, ids.project]
    ),
    /foreign key|violates/i
  );
});

// ── C/D. Première publication, republication ──────────────────────────

test('Première publication -- crée un Accès Public, snapshot Client/Projet corrects, created_reason=first_publication', async () => {
  const res = await publish(ids.project, ids.editor);
  assert.equal(res.status, 201);
  const access = await findCurrentAccess(pool, ids.project);
  assert.ok(access);
  assert.equal(access.client_slug, 'client-pa-a');
  assert.equal(access.project_slug, 'projet-pa');
  assert.equal(access.created_reason, 'first_publication');
  assert.equal(access.supersedes_access_id, null);
  assert.equal(isRedistributionPending(access), false, 'première publication -- jamais d\'avis de redistribution');
});

test('Republication -- même ligne d\'accès, même hash/chiffré, même identité d\'URL', async () => {
  const before = await findCurrentAccess(pool, ids.project);
  const res = await publish(ids.project, ids.editor);
  assert.equal(res.status, 201);
  const after = await findCurrentAccess(pool, ids.project);
  assert.equal(after.id, before.id);
  assert.equal(after.capability_encrypted, before.capability_encrypted);
});

test('Publication bloquée sans Client réel -- 422, jamais de publication active orpheline', async () => {
  const { rows: [p] } = await pool.query("insert into projects (tenant_id, name) values ($1,'Sans Client') returning id", [ids.tenant]);
  await seedProjectMembership(pool, { tenantId: ids.tenant, projectId: p.id, userId: ids.editor, permissionBundle: 'editor' });
  await pool.query('insert into project_identity (tenant_id, project_id) values ($1,$2)', [ids.tenant, p.id]);
  await pool.query("insert into project_settings (tenant_id, project_id, workspace_locale, content_locale) values ($1,$2,'fr','fr')", [ids.tenant, p.id]);
  const res = await publish(p.id, ids.editor);
  assert.equal(res.status, 422);
  const access = await findCurrentAccess(pool, p.id);
  assert.equal(access, null);
  await pool.query('delete from project_memberships where project_id=$1', [p.id]);
  await pool.query('delete from project_settings where project_id=$1', [p.id]);
  await pool.query('delete from project_identity where project_id=$1', [p.id]);
  await pool.query('delete from projects where id=$1', [p.id]);
});

// ── E. Dépublication / republication de disponibilité ─────────────────

test('Dépublication temporaire -- même identité, route publique renvoie 404, restauration renvoie 200 avec la même URL', async () => {
  const access = await findCurrentAccess(pool, ids.project);
  const raw = decryptCurrentCapability(access, config.publicAccessEncryptionKey);
  const url = `${baseUrl}/public/${access.client_slug}/${access.project_slug}/${raw}`;

  const before = await fetch(url);
  assert.equal(before.status, 200);

  await setAvailability(pool, { projectId: ids.project, status: 'unpublished' });
  const during = await fetch(url);
  assert.equal(during.status, 404);

  await setAvailability(pool, { projectId: ids.project, status: 'active' });
  const restored = await fetch(url);
  assert.equal(restored.status, 200);

  const stillSame = await findCurrentAccess(pool, ids.project);
  assert.equal(stillSame.id, access.id, 'même ligne -- jamais recréée par la restauration');
});

test('Republication de contenu pendant que l\'accès est dépublié ne réactive jamais l\'accès', async () => {
  await setAvailability(pool, { projectId: ids.project, status: 'unpublished' });
  await publish(ids.project, ids.editor);
  const access = await findCurrentAccess(pool, ids.project);
  assert.equal(access.status, 'unpublished', 'republier le contenu ne réactive jamais la disponibilité publique');
  await setAvailability(pool, { projectId: ids.project, status: 'active' });
});

// ── F. Rotation manuelle ───────────────────────────────────────────────

test('Rotation manuelle -- PROJECT_MANAGE requis, ancienne révoquée+410, nouvelle active, disponibilité préservée', async () => {
  const before = await findCurrentAccess(pool, ids.project);
  const beforeRaw = decryptCurrentCapability(before, config.publicAccessEncryptionKey);

  const forbidden = await fetch(`${baseUrl}/api/projects/${ids.project}/public-access/rotate`, { method: 'POST', ...withUser(ids.editor) });
  assert.equal(forbidden.status, 403);

  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/public-access/rotate`, { method: 'POST', ...withUser(ids.projectAdmin) });
  assert.equal(res.status, 200);

  const oldUrl = `${baseUrl}/public/${before.client_slug}/${before.project_slug}/${beforeRaw}`;
  const oldRes = await fetch(oldUrl);
  assert.equal(oldRes.status, 410);

  const after = await findCurrentAccess(pool, ids.project);
  assert.notEqual(after.id, before.id);
  assert.equal(after.supersedes_access_id, before.id);
  assert.equal(after.status, 'active');
  assert.equal(after.created_reason, 'manual_rotation');
  assert.equal(isRedistributionPending(after), true);
});

test('Rotation manuelle sans accès courant -- erreur propre, jamais une création', async () => {
  const res = await fetch(`${baseUrl}/api/projects/${ids.neverPublicProject}/public-access/rotate`, { method: 'POST', ...withUser(ids.projectAdmin) });
  assert.notEqual(res.status, 200);
  const access = await findCurrentAccess(pool, ids.neverPublicProject);
  assert.equal(access, null);
});

// ── Accusé de réception ────────────────────────────────────────────────

test('Accusé de réception -- efface l\'avis en attente, idempotent', async () => {
  const access = await findCurrentAccess(pool, ids.project);
  assert.equal(isRedistributionPending(access), true, 'précondition -- rotation précédente doit laisser un avis en attente');

  const res1 = await fetch(`${baseUrl}/api/projects/${ids.project}/public-access/acknowledge`, { method: 'POST', ...withUser(ids.editor) });
  assert.equal(res1.status, 200);
  const acked = await findCurrentAccess(pool, ids.project);
  assert.equal(isRedistributionPending(acked), false);

  const res2 = await fetch(`${baseUrl}/api/projects/${ids.project}/public-access/acknowledge`, { method: 'POST', ...withUser(ids.editor) });
  assert.equal(res2.status, 200, 'ré-accuser reste un succès, jamais une erreur');
});

// ── G. Renommage Client avec rotation ──────────────────────────────────

test('Renommage Client -- slug normalisé identique -> aucune rotation', async () => {
  const before = await findCurrentAccess(pool, ids.project);
  const { rows: [c] } = await pool.query('select version from clients where id=$1', [ids.clientA]);
  const res = await fetch(`${baseUrl}/api/clients/${ids.clientA}`, {
    method: 'PATCH', headers: { 'X-Storm-Dev-User': ids.orgAdmin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'CLIENT PA A', version: c.version })
  });
  assert.equal(res.status, 200);
  const after = await findCurrentAccess(pool, ids.project);
  assert.equal(after.id, before.id, 'même slug normalisé -- jamais de rotation');
});

test('Renommage Client -- slug changé fait tourner TOUS les projets publiés affectés (actifs et dépubliés), atomique', async () => {
  const { rows: [p2] } = await pool.query(
    "insert into projects (tenant_id, name, client_id) values ($1,'Second Projet Client A',$2) returning id", [ids.tenant, ids.clientA]
  );
  await seedProjectMembership(pool, { tenantId: ids.tenant, projectId: p2.id, userId: ids.editor, permissionBundle: 'editor' });
  await pool.query('insert into project_identity (tenant_id, project_id) values ($1,$2)', [ids.tenant, p2.id]);
  await pool.query("insert into project_settings (tenant_id, project_id, workspace_locale, content_locale) values ($1,$2,'fr','fr')", [ids.tenant, p2.id]);
  await publish(p2.id, ids.editor);
  await setAvailability(pool, { projectId: p2.id, status: 'unpublished' });

  const before1 = await findCurrentAccess(pool, ids.project);
  const before2 = await findCurrentAccess(pool, p2.id);

  const { rows: [c] } = await pool.query('select version from clients where id=$1', [ids.clientA]);
  const res = await fetch(`${baseUrl}/api/clients/${ids.clientA}`, {
    method: 'PATCH', headers: { 'X-Storm-Dev-User': ids.orgAdmin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Client PA A Renommé', version: c.version })
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.rotatedCount, 2);

  const after1 = await findCurrentAccess(pool, ids.project);
  const after2 = await findCurrentAccess(pool, p2.id);
  assert.notEqual(after1.id, before1.id);
  assert.notEqual(after2.id, before2.id);
  assert.equal(after1.client_slug, 'client-pa-a-renomme');
  assert.equal(after2.status, 'unpublished', 'la rotation préserve la disponibilité -- dépublié reste dépublié');
  assert.equal(after1.created_reason, 'client_renamed');

  await pool.query('delete from project_public_access where project_id=$1', [p2.id]);
  await pool.query('delete from project_publications where project_id=$1', [p2.id]);
  await pool.query('delete from project_memberships where project_id=$1', [p2.id]);
  await pool.query('delete from project_settings where project_id=$1', [p2.id]);
  await pool.query('delete from project_identity where project_id=$1', [p2.id]);
  await pool.query('delete from projects where id=$1', [p2.id]);
});

test('Renommage Client -- version périmée rejetée, jamais de rotation appliquée', async () => {
  const before = await findCurrentAccess(pool, ids.project);
  const res = await fetch(`${baseUrl}/api/clients/${ids.clientA}`, {
    method: 'PATCH', headers: { 'X-Storm-Dev-User': ids.orgAdmin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Tentative Périmée', version: 9999 })
  });
  assert.equal(res.status, 409);
  const after = await findCurrentAccess(pool, ids.project);
  assert.equal(after.id, before.id);
});

// ── H. Renommage Projet avec rotation ──────────────────────────────────

test('Renommage Projet -- slug changé fait tourner l\'accès courant ; jamais publié -> renommage direct sans accès', async () => {
  const before = await findCurrentAccess(pool, ids.project);
  const { rows: [p] } = await pool.query('select version from projects where id=$1', [ids.project]);
  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/name`, {
    method: 'PATCH', headers: { 'X-Storm-Dev-User': ids.projectAdmin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Projet PA Renommé', version: p.version })
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.rotated, true);
  const after = await findCurrentAccess(pool, ids.project);
  assert.notEqual(after.id, before.id);
  assert.equal(after.created_reason, 'project_renamed');

  const { rows: [neverPublic] } = await pool.query('select version from projects where id=$1', [ids.neverPublicProject]);
  const res2 = await fetch(`${baseUrl}/api/projects/${ids.neverPublicProject}/name`, {
    method: 'PATCH', headers: { 'X-Storm-Dev-User': ids.projectAdmin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Jamais Publié Renommé', version: neverPublic.version })
  });
  assert.equal(res2.status, 200);
  const body2 = await res2.json();
  assert.equal(body2.rotated, false);
});

// ── I. Réassignation Client ─────────────────────────────────────────────

test('Réassignation -- CLIENTS_MANAGE requis, cross-tenant rejeté, toujours rotation si accès courant existe', async () => {
  const forbidden = await fetch(`${baseUrl}/api/projects/${ids.project}/reassign-client`, withUserJson(ids.editor, { clientId: ids.clientB }));
  assert.equal(forbidden.status, 403);

  const crossTenant = await fetch(`${baseUrl}/api/projects/${ids.project}/reassign-client`, withUserJson(ids.orgAdmin, { clientId: ids.otherTenantClient }));
  assert.equal(crossTenant.status, 400);

  const before = await findCurrentAccess(pool, ids.project);
  const res = await fetch(`${baseUrl}/api/projects/${ids.project}/reassign-client`, withUserJson(ids.orgAdmin, { clientId: ids.clientB }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.rotated, true);

  const after = await findCurrentAccess(pool, ids.project);
  assert.notEqual(after.id, before.id);
  assert.equal(after.client_slug, 'client-pa-b');
  assert.equal(after.created_reason, 'client_reassigned');
});

test('Réassignation -- legacy client_id NULL fonctionne ; jamais publié -> aucun accès créé', async () => {
  const { rows: [legacy] } = await pool.query("insert into projects (tenant_id, name) values ($1,'Legacy Sans Client') returning id", [ids.tenant]);
  const res = await fetch(`${baseUrl}/api/projects/${legacy.id}/reassign-client`, withUserJson(ids.orgAdmin, { clientId: ids.clientA }));
  assert.equal(res.status, 200);
  const { rows: [row] } = await pool.query('select client_id from projects where id=$1', [legacy.id]);
  assert.equal(row.client_id, ids.clientA);
  const access = await findCurrentAccess(pool, legacy.id);
  assert.equal(access, null, 'jamais publié -- aucun Accès Public créé par la seule réassignation');
  await pool.query('delete from projects where id=$1', [legacy.id]);
});

// ── J. Routes publiques -- sémantique exacte ────────────────────────────

test('Routes publiques -- mauvais slug Client/Projet avec capability valide -> 404, jamais une distinction', async () => {
  const access = await findCurrentAccess(pool, ids.project);
  const raw = decryptCurrentCapability(access, config.publicAccessEncryptionKey);
  const wrongClient = await fetch(`${baseUrl}/public/mauvais-client/${access.project_slug}/${raw}`);
  assert.equal(wrongClient.status, 404);
  const wrongProject = await fetch(`${baseUrl}/public/${access.client_slug}/mauvais-projet/${raw}`);
  assert.equal(wrongProject.status, 404);
});

test('Routes publiques -- capability inconnue -> 404 ordinaire', async () => {
  const res = await fetch(`${baseUrl}/public/x/y/${'a'.repeat(43)}`);
  assert.equal(res.status, 404);
});

test('Ancienne route UUID -- entièrement disparue', async () => {
  const res = await fetch(`${baseUrl}/public/projects/${ids.project}`);
  assert.notEqual(res.status, 200);
  const manifestRes = await fetch(`${baseUrl}/public/projects/${ids.project}/manifest`);
  assert.notEqual(manifestRes.status, 200);
});

test('Manifest public -- accessible via la nouvelle route, jamais l\'UUID projet dans les URLs d\'assets générées', async () => {
  const access = await findCurrentAccess(pool, ids.project);
  const raw = decryptCurrentCapability(access, config.publicAccessEncryptionKey);
  const res = await fetch(`${baseUrl}/public/${access.client_slug}/${access.project_slug}/${raw}/manifest`);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.ok(!text.includes(ids.project), 'l\'UUID projet ne doit jamais apparaître dans le Manifest public');
});

// ── K. Sécurité ──────────────────────────────────────────────────────

test('Sécurité -- noindex + no-referrer sur les réponses publiques, y compris 404', async () => {
  const res = await fetch(`${baseUrl}/public/x/y/${'a'.repeat(43)}`);
  assert.equal(res.headers.get('x-robots-tag'), 'noindex');
  assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
});

test('Sécurité -- redaction des logs -- une capability sentinelle n\'apparaît jamais dans la sortie du logger', async () => {
  const sentinel = 'THIS_CAPABILITY_MUST_NEVER_APPEAR';
  const lines = [];
  const capturingLogger = {
    info(obj, msg) { lines.push(JSON.stringify(obj) + ' ' + msg); },
    warn(obj, msg) { lines.push(JSON.stringify(obj) + ' ' + msg); },
    error(obj, msg) { lines.push(JSON.stringify(obj) + ' ' + msg); }
  };
  const capturingApp = createApp({ logger: capturingLogger, pool, config, storageAdapter });
  const capturingServer = http.createServer(capturingApp);
  await new Promise(resolve => capturingServer.listen(0, resolve));
  const capturingUrl = `http://127.0.0.1:${capturingServer.address().port}`;

  // Force une erreur serveur (500) sur un chemin contenant la sentinelle
  // en position de capability -- vérifie que redactPublicPath s'applique
  // avant toute émission de log, même sur un échec.
  await fetch(`${capturingUrl}/public/x/y/${sentinel}/manifest`);

  await new Promise(resolve => capturingServer.close(resolve));
  const allOutput = lines.join('\n');
  assert.ok(!allOutput.includes(sentinel), 'la capability sentinelle ne doit jamais apparaître dans un log capturé');
});

// ── N. Compiler/Runtime -- propreté ──────────────────────────────────

test('Compiler -- n\'émet plus jamais l\'ancienne forme UUID pour les URLs d\'assets publics', async () => {
  const compilerSrc = await import('node:fs').then(fs => fs.promises.readFile(new URL('../src/domain/publication/compiler.js', import.meta.url), 'utf8'));
  assert.ok(!compilerSrc.includes('/public/projects/'), 'le Compiler ne doit plus jamais construire cette forme d\'URL');
});

test('Runtime Ivory -- aucune réécriture regex de compatibilité de l\'ancien format UUID', async () => {
  const runtimeSrc = await import('node:fs').then(fs => fs.promises.readFile(new URL('../public/ivory/runtime.js', import.meta.url), 'utf8'));
  assert.ok(!runtimeSrc.includes('/public/projects/'), 'le Runtime ne doit plus jamais référencer cette forme d\'URL, même en commentaire');
});

// ── L. Service authentifié ──────────────────────────────────────────────

test('Service Accès Public -- PUBLICATION_PUBLISH peut lire l\'état complet, VIEW seul ne peut pas', async () => {
  const okRes = await fetch(`${baseUrl}/api/projects/${ids.project}/public-access`, withUser(ids.editor));
  assert.equal(okRes.status, 200);
  const body = await okRes.json();
  assert.equal(body.hasPublicAccess, true);
  assert.ok(body.publicUrl.startsWith('/public/'));
  assert.ok(!('capability_hash' in body));
  assert.ok(!('capability_encrypted' in body));
  assert.ok(!body.publicUrl.includes(ids.project), 'l\'UUID projet ne doit jamais apparaître dans publicUrl');

  const viewRes = await fetch(`${baseUrl}/api/projects/${ids.project}/public-access`, withUser(ids.pilotUser));
  assert.equal(viewRes.status, 403, 'VIEW/PILOTAGE_VIEW seul ne suffit jamais à lire la capability');
});

test('Service Accès Public -- avant toute publication, état propre hasPublicAccess=false', async () => {
  const { rows: [p] } = await pool.query("insert into projects (tenant_id, name, client_id) values ($1,'Jamais Encore Publié',$2) returning id", [ids.tenant, ids.clientA]);
  await seedProjectMembership(pool, { tenantId: ids.tenant, projectId: p.id, userId: ids.editor, permissionBundle: 'editor' });
  const res = await fetch(`${baseUrl}/api/projects/${p.id}/public-access`, withUser(ids.editor));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body, { hasPublicAccess: false });
  await pool.query('delete from project_memberships where project_id=$1', [p.id]);
  await pool.query('delete from projects where id=$1', [p.id]);
});

// ── O. Télémétrie ──────────────────────────────────────────────────────

test('Télémétrie -- résout via la nouvelle identité publique, jamais l\'ancienne route UUID', async () => {
  const access = await findCurrentAccess(pool, ids.project);
  const raw = decryptCurrentCapability(access, config.publicAccessEncryptionKey);
  const res = await fetch(`${baseUrl}/public/${access.client_slug}/${access.project_slug}/${raw}/telemetry`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'mood_feedback', value: 4 })
  });
  assert.equal(res.status, 204);

  const oldRoute = await fetch(`${baseUrl}/public/projects/${ids.project}/telemetry`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'mood_feedback', value: 4 })
  });
  assert.notEqual(oldRoute.status, 204, 'l\'ancienne route de télémétrie ne doit plus jamais résoudre normalement');
});
