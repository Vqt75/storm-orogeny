import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { recordAuditEvent, AuditEventType } from '../src/domain/audit/auditEvents.js';
import { disableExternalGroupMapping } from '../src/domain/memberships/repository.js';
import { reconcileGroupsToGrants } from '../src/domain/identity/groupReconciliation.js';
import { purgeOldAuditEvents } from '../src/domain/privacy/auditRetention.js';
import { runRetentionPolicies } from '../src/domain/privacy/retentionRunner.js';

// Privacy & Data Lifecycle V1 — Batch 3. Audit applicatif minimal mis
// en service : primitive d'écriture, premier événement métier réel
// (désactivation de mapping, dans la même transaction que l'action),
// rétention à 12 mois via le retention runner existant.

const config = loadConfig();
const pool = getPool(config);
const silentLogger = { info() {}, warn() {}, error() {} };

let tenant, project, actorUserId;
const ISSUER = 'https://fake-idp.test-privacy-batch3/issuer';

async function cleanAll() {
  await pool.query("delete from project_grants where mapping_id in (select id from external_group_mappings where external_group_id like 'privacy-batch3-%')");
  await pool.query("delete from organization_grants where mapping_id in (select id from external_group_mappings where external_group_id like 'privacy-batch3-%')");
  await pool.query("delete from external_group_mappings where external_group_id like 'privacy-batch3-%'");
  await pool.query("delete from audit_events where tenant_id in (select id from tenants where name like 'Tenant Privacy Batch3%')");
  await pool.query("delete from external_identities where user_id in (select id from users where email like '%@test-privacy-batch3.local')");
  await pool.query("delete from tenant_memberships where user_id in (select id from users where email like '%@test-privacy-batch3.local')");
  await pool.query("delete from project_memberships where user_id in (select id from users where email like '%@test-privacy-batch3.local')");
  await pool.query("delete from users where email like '%@test-privacy-batch3.local'");
  await pool.query("delete from projects where name like 'Privacy Batch3%'");
  await pool.query("delete from tenants where name like 'Tenant Privacy Batch3%'");
}

test.before(async () => {
  await runMigrations();
  await cleanAll();
  const { rows: [t] } = await pool.query("insert into tenants (name) values ('Tenant Privacy Batch3') returning id");
  tenant = t.id;
  const { rows: [p] } = await pool.query("insert into projects (tenant_id, name, status) values ($1,'Privacy Batch3 Projet','active') returning id", [tenant]);
  project = p.id;
  const { rows: [actor] } = await pool.query("insert into users (email, display_name) values ('actor@test-privacy-batch3.local','Actor') returning id");
  actorUserId = actor.id;
});

test.after(async () => {
  await cleanAll();
  await closePool();
});

let counter = 0;
async function makeUser() {
  counter += 1;
  const { rows: [u] } = await pool.query(
    `insert into users (email, display_name) values ($1,'Test') returning id`,
    [`user${counter}-${Date.now()}@test-privacy-batch3.local`]
  );
  return u.id;
}

async function makeMapping({ targetType, targetId, groupId, bundle, tenantId = tenant }) {
  const { rows: [row] } = await pool.query(
    `insert into external_group_mappings (tenant_id, provider, issuer, external_group_id, target_type, target_id, permission_bundle)
     values ($1,'fake',$2,$3,$4,$5,$6) returning id`,
    [tenantId, ISSUER, groupId, targetType, targetId, bundle]
  );
  return row.id;
}

async function makeExternalIdentity({ userId, subject }) {
  await pool.query("insert into external_identities (provider_type, issuer, subject, user_id) values ('fake',$1,$2,$3)", [ISSUER, subject, userId]);
}

async function countAuditEvents({ eventType, targetId }) {
  const { rows } = await pool.query(
    'select count(*)::int as n from audit_events where event_type=$1 and target_id=$2',
    [eventType, targetId]
  );
  return rows[0].n;
}

// ── Primitive ────────────────────────────────────────────────────────

test('recordAuditEvent -- insertion minimale valide', async () => {
  const { rows: [dummyMapping] } = await pool.query(
    "insert into external_group_mappings (tenant_id, provider, issuer, external_group_id, target_type, target_id, permission_bundle) values ($1,'fake',$2,'privacy-batch3-primitive','project',$3,'contributor') returning id",
    [tenant, ISSUER, project]
  );
  await recordAuditEvent(pool, {
    eventType: 'test.event', actorUserId, targetType: 'external_group_mapping', targetId: dummyMapping.id, tenantId: tenant, projectId: project
  });
  const { rows: [e] } = await pool.query('select * from audit_events where target_id=$1', [dummyMapping.id]);
  assert.equal(e.event_type, 'test.event');
  assert.equal(e.actor_user_id, actorUserId);
  assert.equal(e.tenant_id, tenant);
  assert.equal(e.project_id, project);
  await pool.query('delete from external_group_mappings where id=$1', [dummyMapping.id]);
});

test('recordAuditEvent -- actor nullable structurellement', async () => {
  await recordAuditEvent(pool, { eventType: 'test.event.no_actor', targetType: 'system' });
  const { rows: [e] } = await pool.query("select actor_user_id from audit_events where event_type='test.event.no_actor'");
  assert.equal(e.actor_user_id, null);
});

test('recordAuditEvent -- aucun payload libre accepté (structure de table inchangée)', async () => {
  const { rows: columns } = await pool.query("select column_name from information_schema.columns where table_name='audit_events'");
  assert.deepEqual(
    columns.map(c => c.column_name).sort(),
    ['actor_user_id', 'event_type', 'id', 'occurred_at', 'project_id', 'target_id', 'target_type', 'tenant_id'].sort()
  );
});

// ── Mapping disable project-scoped ───────────────────────────────────

test('désactivation project-scoped -- exactement 1 event, type/target/tenant/project/actor exacts', async () => {
  const userId = await makeUser();
  await makeExternalIdentity({ userId, subject: 'sub-disable-project' });
  const mappingId = await makeMapping({ targetType: 'project', targetId: project, groupId: 'privacy-batch3-grp-project', bundle: 'contributor' });
  await reconcileGroupsToGrants(pool, { userId, issuer: ISSUER, groups: { kind: 'complete', groupIds: ['privacy-batch3-grp-project'] } });

  const result = await disableExternalGroupMapping(pool, { tenantId: tenant, mappingId, actorUserId });
  assert.equal(result.ok, true);
  assert.equal(result.revokedGrantCount, 1);

  const n = await countAuditEvents({ eventType: AuditEventType.EXTERNAL_GROUP_MAPPING_DISABLED, targetId: mappingId });
  assert.equal(n, 1);

  const { rows: [event] } = await pool.query(
    'select * from audit_events where event_type=$1 and target_id=$2',
    [AuditEventType.EXTERNAL_GROUP_MAPPING_DISABLED, mappingId]
  );
  assert.equal(event.target_type, 'external_group_mapping');
  assert.equal(event.tenant_id, tenant);
  assert.equal(event.project_id, project, 'mapping projet -> project_id renseigné');
  assert.equal(event.actor_user_id, actorUserId);
});

// ── Mapping disable organization-scoped ──────────────────────────────

test('désactivation organization-scoped -- project_id null, reste du scope correct', async () => {
  const { rows: [orgTenant] } = await pool.query("insert into tenants (name) values ('Tenant Privacy Batch3 Org') returning id");
  const mappingId = await makeMapping({ targetType: 'organization', targetId: orgTenant.id, groupId: 'privacy-batch3-grp-org', bundle: 'member', tenantId: orgTenant.id });

  const result = await disableExternalGroupMapping(pool, { tenantId: orgTenant.id, mappingId, actorUserId });
  assert.equal(result.ok, true);

  const { rows: [event] } = await pool.query(
    'select * from audit_events where event_type=$1 and target_id=$2',
    [AuditEventType.EXTERNAL_GROUP_MAPPING_DISABLED, mappingId]
  );
  assert.equal(event.project_id, null, 'mapping organisation -> project_id jamais renseigné');
  assert.equal(event.tenant_id, orgTenant.id);
  assert.equal(event.target_type, 'external_group_mapping');

  await pool.query('delete from external_group_mappings where id=$1', [mappingId]);
  await pool.query('delete from tenants where id=$1', [orgTenant.id]);
});

// ── Idempotence ───────────────────────────────────────────────────────

test('idempotence -- second disable sur mapping déjà désactivé -- aucun nouvel event', async () => {
  const mappingId = await makeMapping({ targetType: 'project', targetId: project, groupId: 'privacy-batch3-grp-idem', bundle: 'contributor' });
  const first = await disableExternalGroupMapping(pool, { tenantId: tenant, mappingId, actorUserId });
  assert.equal(first.ok, true);

  const second = await disableExternalGroupMapping(pool, { tenantId: tenant, mappingId, actorUserId });
  assert.equal(second.ok, false);
  assert.equal(second.code, 'ALREADY_DISABLED');

  const n = await countAuditEvents({ eventType: AuditEventType.EXTERNAL_GROUP_MAPPING_DISABLED, targetId: mappingId });
  assert.equal(n, 1, 'jamais un faux historique de double désactivation');
});

// ── Last-admin ────────────────────────────────────────────────────────

test('garde-fou dernier administrateur -- désactivation refusée -- mapping active, grants intacts, zéro event', async () => {
  const { rows: [dedicatedProject] } = await pool.query(
    "insert into projects (tenant_id, name, status) values ($1,'Privacy Batch3 Projet Dédié','active') returning id", [tenant]
  );
  const userId = await makeUser();
  await makeExternalIdentity({ userId, subject: 'sub-last-admin-audit' });
  const mappingId = await makeMapping({ targetType: 'project', targetId: dedicatedProject.id, groupId: 'privacy-batch3-grp-last-admin', bundle: 'project_admin' });
  await reconcileGroupsToGrants(pool, { userId, issuer: ISSUER, groups: { kind: 'complete', groupIds: ['privacy-batch3-grp-last-admin'] } });

  const result = await disableExternalGroupMapping(pool, { tenantId: tenant, mappingId, actorUserId });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'LAST_ADMIN');

  const { rows: [mapping] } = await pool.query('select status from external_group_mappings where id=$1', [mappingId]);
  assert.equal(mapping.status, 'active');
  const { rows: [grant] } = await pool.query('select status from project_grants where mapping_id=$1', [mappingId]);
  assert.equal(grant.status, 'active');

  const n = await countAuditEvents({ eventType: AuditEventType.EXTERNAL_GROUP_MAPPING_DISABLED, targetId: mappingId });
  assert.equal(n, 0, 'zéro event -- l\'action métier n\'a jamais réellement eu lieu');

  await pool.query('delete from projects where id=$1', [dedicatedProject.id]);
});

// ── Échec technique de l'insertion audit ─────────────────────────────

test('échec technique sur l\'insertion audit -- transaction entière rollback, mapping active, grants intacts, aucun event partiel', async () => {
  const userId = await makeUser();
  await makeExternalIdentity({ userId, subject: 'sub-audit-fail' });
  const mappingId = await makeMapping({ targetType: 'project', targetId: project, groupId: 'privacy-batch3-grp-audit-fail', bundle: 'contributor' });
  await reconcileGroupsToGrants(pool, { userId, issuer: ISSUER, groups: { kind: 'complete', groupIds: ['privacy-batch3-grp-audit-fail'] } });

  await pool.query('REVOKE INSERT ON audit_events FROM storm_orogeny');
  try {
    await assert.rejects(disableExternalGroupMapping(pool, { tenantId: tenant, mappingId, actorUserId }));
  } finally {
    await pool.query('GRANT INSERT ON audit_events TO storm_orogeny');
  }

  const { rows: [mapping] } = await pool.query('select status from external_group_mappings where id=$1', [mappingId]);
  assert.equal(mapping.status, 'active', 'jamais désactivé sans sa trace d\'audit -- rollback complet');
  const { rows: [grant] } = await pool.query('select status from project_grants where mapping_id=$1', [mappingId]);
  assert.equal(grant.status, 'active', 'aucune révocation partielle');
  const n = await countAuditEvents({ eventType: AuditEventType.EXTERNAL_GROUP_MAPPING_DISABLED, targetId: mappingId });
  assert.equal(n, 0);
});

// ── Rétention audit_events ───────────────────────────────────────────

async function makeAuditEventAt(occurredAt) {
  const { rows: [e] } = await pool.query(
    "insert into audit_events (event_type, target_type, occurred_at) values ('test.retention','system',$1) returning id",
    [occurredAt]
  );
  return e.id;
}

test('event âgé de 11 mois 29 jours -- conservé', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const occurredAt = new Date(now.getTime());
  occurredAt.setUTCMonth(occurredAt.getUTCMonth() - 11);
  occurredAt.setUTCDate(occurredAt.getUTCDate() - 29);
  const id = await makeAuditEventAt(occurredAt);
  await purgeOldAuditEvents(pool, { now });
  const { rows } = await pool.query('select id from audit_events where id=$1', [id]);
  assert.equal(rows.length, 1);
  await pool.query('delete from audit_events where id=$1', [id]);
});

test('event âgé d\'exactement 12 mois -- purgé', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const occurredAt = new Date(now.getTime());
  occurredAt.setUTCMonth(occurredAt.getUTCMonth() - 12);
  const id = await makeAuditEventAt(occurredAt);
  await purgeOldAuditEvents(pool, { now });
  const { rows } = await pool.query('select id from audit_events where id=$1', [id]);
  assert.equal(rows.length, 0);
});

test('event âgé de >12 mois -- purgé', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const occurredAt = new Date(now.getTime());
  occurredAt.setUTCMonth(occurredAt.getUTCMonth() - 15);
  const id = await makeAuditEventAt(occurredAt);
  await purgeOldAuditEvents(pool, { now });
  const { rows } = await pool.query('select id from audit_events where id=$1', [id]);
  assert.equal(rows.length, 0);
});

test('event récent -- conservé', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const id = await makeAuditEventAt(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  await purgeOldAuditEvents(pool, { now });
  const { rows } = await pool.query('select id from audit_events where id=$1', [id]);
  assert.equal(rows.length, 1);
  await pool.query('delete from audit_events where id=$1', [id]);
});

test('rétention audit -- second run 0 supplémentaire', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const occurredAt = new Date(now.getTime());
  occurredAt.setUTCMonth(occurredAt.getUTCMonth() - 20);
  await makeAuditEventAt(occurredAt);
  const first = await purgeOldAuditEvents(pool, { now });
  const second = await purgeOldAuditEvents(pool, { now });
  assert.ok(first >= 1);
  assert.equal(second, 0);
});

// ── Runner enrichi ────────────────────────────────────────────────────

test('runner -- résultat structuré inclut auditEvents', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const result = await runRetentionPolicies(pool, { now, logger: silentLogger });
  assert.ok('sessions' in result);
  assert.ok('invitations' in result);
  assert.ok('auditEvents' in result);
  assert.ok('purged' in result.auditEvents);
});

test('runner -- échec de la politique audit -- sessions/invitations déjà commitées restent commitées, erreur propagée', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const occurredAt = new Date(now.getTime());
  occurredAt.setUTCMonth(occurredAt.getUTCMonth() - 20);
  const survivingEventId = await makeAuditEventAt(occurredAt);

  await pool.query('REVOKE DELETE ON audit_events FROM storm_orogeny');
  try {
    await assert.rejects(runRetentionPolicies(pool, { now, logger: silentLogger }));
  } finally {
    await pool.query('GRANT DELETE ON audit_events TO storm_orogeny');
  }

  // La politique audit a échoué et rollback -- l'événement doit donc
  // toujours exister (rien purgé), confirmant l'absence de purge
  // partielle malgré l'échec.
  const { rows } = await pool.query('select id from audit_events where id=$1', [survivingEventId]);
  assert.equal(rows.length, 1, 'rollback de la politique audit -- rien purgé malgré l\'échec');
  await pool.query('delete from audit_events where id=$1', [survivingEventId]);
});

// ── CLI (non-régression) ─────────────────────────────────────────────

test('CLI -- exécute désormais aussi la politique audit_events sans erreur', async () => {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execFileAsync = promisify(execFile);
  const { stdout } = await execFileAsync('node', ['src/domain/privacy/runRetention.js'], { cwd: process.cwd() });
  assert.ok(stdout.includes('retention.audit_events.completed'));
});

// ── Actor obligatoire (fermeture) ────────────────────────────────────

test('désactivation sans actorUserId -- fail fast, aucune mutation, aucun audit event', async () => {
  const mappingId = await makeMapping({ targetType: 'project', targetId: project, groupId: 'privacy-batch3-grp-no-actor', bundle: 'contributor' });

  const result = await disableExternalGroupMapping(pool, { tenantId: tenant, mappingId });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ACTOR_REQUIRED');

  const { rows: [mapping] } = await pool.query('select status from external_group_mappings where id=$1', [mappingId]);
  assert.equal(mapping.status, 'active', 'aucune désactivation sans actor');

  const n = await countAuditEvents({ eventType: AuditEventType.EXTERNAL_GROUP_MAPPING_DISABLED, targetId: mappingId });
  assert.equal(n, 0, 'zéro audit event -- jamais actor_user_id=null silencieux pour une action humaine');

  await pool.query('delete from external_group_mappings where id=$1', [mappingId]);
});

test('désactivation avec actorUserId explicitement null -- même refus, jamais un contournement', async () => {
  const mappingId = await makeMapping({ targetType: 'project', targetId: project, groupId: 'privacy-batch3-grp-null-actor', bundle: 'contributor' });

  const result = await disableExternalGroupMapping(pool, { tenantId: tenant, mappingId, actorUserId: null });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ACTOR_REQUIRED');

  await pool.query('delete from external_group_mappings where id=$1', [mappingId]);
});

test('recordAuditEvent (primitive générique) -- actorUserId=null reste explicitement supporté', async () => {
  await recordAuditEvent(pool, { eventType: 'test.event.generic.system', targetType: 'system' });
  const { rows: [e] } = await pool.query("select actor_user_id from audit_events where event_type='test.event.generic.system'");
  assert.equal(e.actor_user_id, null, 'la primitive générique reste volontairement permissive pour de futurs événements système');
});
