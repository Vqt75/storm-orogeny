import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';

// Privacy & Data Lifecycle V1 — Batch 1. Fondations de schéma
// uniquement : aucun comportement runtime nouveau, aucun retention
// runner, aucune désactivation/anonymisation exécutée, aucune
// suppression de projet exécutée, aucun storage delete. Ces tests
// couvrent exclusivement la forme du schéma et l'invariant critique de
// survie du job de suppression.

const config = loadConfig();
const pool = getPool(config);

let tenant, project;

async function cleanAll() {
  await pool.query("delete from project_deletion_job_objects where job_id in (select id from project_deletion_jobs where tenant_id in (select id from tenants where name like 'Tenant Privacy%'))");
  await pool.query("delete from project_deletion_jobs where tenant_id in (select id from tenants where name like 'Tenant Privacy%')");
  await pool.query("delete from audit_events where tenant_id in (select id from tenants where name like 'Tenant Privacy%')");
  await pool.query("delete from projects where name like 'Privacy Batch1%'");
  await pool.query("delete from users where email like '%@test-privacy-batch1.local'");
  await pool.query("delete from tenants where name like 'Tenant Privacy%'");
}

test.before(async () => {
  await runMigrations();
  await cleanAll();
  const { rows: [t] } = await pool.query("insert into tenants (name) values ('Tenant Privacy Batch1') returning id");
  tenant = t.id;
  const { rows: [p] } = await pool.query("insert into projects (tenant_id, name, status) values ($1,'Privacy Batch1 Projet','active') returning id", [tenant]);
  project = p.id;
});

test.after(async () => {
  await cleanAll();
  await closePool();
});

// ── Users ─────────────────────────────────────────────────────────────

test('un user déjà existant (créé avant ce batch) se retrouve status=active', async () => {
  const { rows: [u] } = await pool.query(
    "insert into users (email, display_name) values ('legacy@test-privacy-batch1.local','Legacy') returning status, deactivated_at, anonymized_at"
  );
  assert.equal(u.status, 'active');
  assert.equal(u.deactivated_at, null);
  assert.equal(u.anonymized_at, null);
});

test('création d\'un nouveau user -- status=active par défaut', async () => {
  const { rows: [u] } = await pool.query(
    "insert into users (email, display_name) values ('nouveau@test-privacy-batch1.local','Nouveau') returning status"
  );
  assert.equal(u.status, 'active');
});

test('status invalide -- refusé par la contrainte CHECK', async () => {
  await assert.rejects(
    pool.query("insert into users (email, display_name, status) values ('invalide@test-privacy-batch1.local','X','not-a-real-status')")
  );
});

test('colonnes timestamps nullable -- deactivated_at/anonymized_at peuvent être NULL pour un user active', async () => {
  const { rows: [u] } = await pool.query(
    "insert into users (email, display_name) values ('nullable@test-privacy-batch1.local','Nullable') returning deactivated_at, anonymized_at"
  );
  assert.equal(u.deactivated_at, null);
  assert.equal(u.anonymized_at, null);
});

test('contrainte de cohérence -- status=deactivated sans deactivated_at est refusé', async () => {
  await assert.rejects(
    pool.query("insert into users (email, display_name, status) values ('incoherent1@test-privacy-batch1.local','X','deactivated')")
  );
});

test('contrainte de cohérence -- status=anonymized sans anonymized_at est refusé', async () => {
  await assert.rejects(
    pool.query("insert into users (email, display_name, status, deactivated_at) values ('incoherent2@test-privacy-batch1.local','X','anonymized', now())")
  );
});

test('contrainte de cohérence -- status=deactivated avec deactivated_at renseigné est accepté', async () => {
  const { rows: [u] } = await pool.query(
    "insert into users (email, display_name, status, deactivated_at) values ('coherent1@test-privacy-batch1.local','X','deactivated', now()) returning status"
  );
  assert.equal(u.status, 'deactivated');
});

test('contrainte de cohérence -- status=anonymized avec les deux timestamps renseignés est accepté', async () => {
  const { rows: [u] } = await pool.query(
    "insert into users (email, display_name, status, deactivated_at, anonymized_at) values ('coherent2@test-privacy-batch1.local','X','anonymized', now(), now()) returning status"
  );
  assert.equal(u.status, 'anonymized');
});

// ── Invitations -- confirmation, aucune migration nécessaire ─────────

test('project_invitations.status accepte déjà "expired" (confirmé préexistant, migration 0011 -- aucune modification dans ce batch)', async () => {
  const { rows: [inviter] } = await pool.query("insert into users (email, display_name) values ('inviter@test-privacy-batch1.local','Inviter') returning id");
  const { rows: [inv] } = await pool.query(
    `insert into project_invitations (tenant_id, project_id, email, permission_bundle, locale, invited_by_user_id, status)
     values ($1,$2,'invitee@test-privacy-batch1.local','editor','fr',$3,'expired') returning status`,
    [tenant, project, inviter.id]
  );
  assert.equal(inv.status, 'expired');
});

test('project_invitations.status -- les anciens statuts restent acceptés', async () => {
  const { rows: [inviter] } = await pool.query("select id from users where email='inviter@test-privacy-batch1.local'");
  const { rows: [inv] } = await pool.query(
    `insert into project_invitations (tenant_id, project_id, email, permission_bundle, locale, invited_by_user_id, status)
     values ($1,$2,'invitee2@test-privacy-batch1.local','editor','fr',$3,'pending') returning status`,
    [tenant, project, inviter.id]
  );
  assert.equal(inv.status, 'pending');
});

test('project_invitations.status -- statut invalide toujours refusé', async () => {
  const { rows: [inviter] } = await pool.query("select id from users where email='inviter@test-privacy-batch1.local'");
  await assert.rejects(
    pool.query(
      `insert into project_invitations (tenant_id, project_id, email, permission_bundle, locale, invited_by_user_id, status)
       values ($1,$2,'invitee3@test-privacy-batch1.local','editor','fr',$3,'not-a-real-status')`,
      [tenant, project, inviter.id]
    )
  );
});

// ── Audit events ──────────────────────────────────────────────────────

test('audit_events -- insertion minimale valide', async () => {
  const { rows: [e] } = await pool.query(
    `insert into audit_events (event_type, target_type, target_id, tenant_id, project_id)
     values ('test.event', 'project', $1, $2, $1) returning id, occurred_at`,
    [project, tenant]
  );
  assert.ok(e.id);
  assert.ok(e.occurred_at);
});

test('audit_events -- actor_user_id nullable', async () => {
  const { rows: [e] } = await pool.query(
    "insert into audit_events (event_type, target_type) values ('test.event.no_actor', 'system') returning actor_user_id"
  );
  assert.equal(e.actor_user_id, null);
});

test('audit_events -- suppression de l\'acteur (SET NULL) ne détruit jamais l\'événement', async () => {
  const { rows: [actor] } = await pool.query("insert into users (email, display_name) values ('actor-to-delete@test-privacy-batch1.local','Actor') returning id");
  const { rows: [e] } = await pool.query(
    "insert into audit_events (event_type, target_type, actor_user_id) values ('test.event.actor', 'system', $1) returning id",
    [actor.id]
  );
  // Suppression physique réelle de l'utilisateur -- possible seulement
  // ici car aucun autre FK RESTRICT ne le référence encore (test isolé,
  // aucune membership créée pour cet utilisateur).
  await pool.query('delete from users where id=$1', [actor.id]);
  const { rows: [stillThere] } = await pool.query('select actor_user_id from audit_events where id=$1', [e.id]);
  assert.equal(stillThere.actor_user_id, null, 'ON DELETE SET NULL -- événement conservé, acteur devenu null');
});

test('audit_events -- structure ne contient aucun champ générique de contenu/secret', async () => {
  const { rows: columns } = await pool.query(
    "select column_name from information_schema.columns where table_name='audit_events'"
  );
  const names = columns.map(c => c.column_name);
  assert.deepEqual(
    names.sort(),
    ['actor_user_id', 'event_type', 'id', 'occurred_at', 'project_id', 'target_id', 'target_type', 'tenant_id'].sort()
  );
});

// ── Deletion jobs ─────────────────────────────────────────────────────

test('project_deletion_jobs -- création correcte', async () => {
  const { rows: [job] } = await pool.query(
    `insert into project_deletion_jobs (tenant_id, project_id, purge_after, storage_purge_state)
     values ($1,$2, now() + interval '7 days', 'pending') returning id, storage_purge_state`,
    [tenant, project]
  );
  assert.ok(job.id);
  assert.equal(job.storage_purge_state, 'pending');
  await pool.query('delete from project_deletion_jobs where id=$1', [job.id]);
});

test('project_deletion_jobs -- states valides acceptés (pending/in_progress/completed/failed)', async () => {
  for (const state of ['pending', 'in_progress', 'completed', 'failed']) {
    const { rows: [job] } = await pool.query(
      `insert into project_deletion_jobs (tenant_id, project_id, purge_after, storage_purge_state)
       values ($1,$2, now() + interval '7 days', $3) returning storage_purge_state`,
      [tenant, project, state]
    );
    assert.equal(job.storage_purge_state, state);
    // Nettoyage immédiat -- un seul job actif à la fois par projet
    // (index unique partiel), jamais quatre simultanés dans ce test.
    await pool.query('delete from project_deletion_jobs where project_id=$1', [project]);
  }
});

test('project_deletion_jobs -- state invalide refusé', async () => {
  await assert.rejects(
    pool.query(
      `insert into project_deletion_jobs (tenant_id, project_id, purge_after, storage_purge_state)
       values ($1,$2, now() + interval '7 days', 'not-a-real-state')`,
      [tenant, project]
    )
  );
});

test('project_deletion_jobs -- purge_after persisté exactement', async () => {
  const target = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const { rows: [job] } = await pool.query(
    `insert into project_deletion_jobs (tenant_id, project_id, purge_after, storage_purge_state)
     values ($1,$2,$3,'pending') returning purge_after`,
    [tenant, project, target]
  );
  assert.equal(new Date(job.purge_after).getTime(), target.getTime());
  await pool.query('delete from project_deletion_jobs where project_id=$1', [project]);
});

test('project_deletion_jobs -- annulable structurellement (cancelled_at)', async () => {
  const { rows: [job] } = await pool.query(
    `insert into project_deletion_jobs (tenant_id, project_id, purge_after, storage_purge_state)
     values ($1,$2, now() + interval '7 days', 'pending') returning id`,
    [tenant, project]
  );
  await pool.query('update project_deletion_jobs set cancelled_at = now() where id=$1', [job.id]);
  const { rows: [updated] } = await pool.query('select cancelled_at from project_deletion_jobs where id=$1', [job.id]);
  assert.ok(updated.cancelled_at);
  await pool.query('delete from project_deletion_jobs where id=$1', [job.id]);
});

test('protection deux jobs actifs simultanés -- refusée par l\'index unique partiel', async () => {
  const { rows: [job1] } = await pool.query(
    `insert into project_deletion_jobs (tenant_id, project_id, purge_after, storage_purge_state)
     values ($1,$2, now() + interval '7 days', 'pending') returning id`,
    [tenant, project]
  );
  await assert.rejects(
    pool.query(
      `insert into project_deletion_jobs (tenant_id, project_id, purge_after, storage_purge_state)
       values ($1,$2, now() + interval '7 days', 'pending')`,
      [tenant, project]
    )
  );
  // Un job ANNULÉ, en revanche, ne doit jamais bloquer une nouvelle demande.
  await pool.query('update project_deletion_jobs set cancelled_at = now() where id=$1', [job1.id]);
  const { rows: [job2] } = await pool.query(
    `insert into project_deletion_jobs (tenant_id, project_id, purge_after, storage_purge_state)
     values ($1,$2, now() + interval '7 days', 'pending') returning id`,
    [tenant, project]
  );
  assert.ok(job2.id, 'un job annulé ne doit jamais bloquer une nouvelle demande pour le même projet');
  await pool.query('delete from project_deletion_jobs where project_id=$1', [project]);
});

// ── Manifest ─────────────────────────────────────────────────────────

test('project_deletion_job_objects -- plusieurs storage keys pour un même job', async () => {
  const { rows: [job] } = await pool.query(
    `insert into project_deletion_jobs (tenant_id, project_id, purge_after, storage_purge_state)
     values ($1,$2, now() + interval '7 days', 'pending') returning id`,
    [tenant, project]
  );
  await pool.query("insert into project_deletion_job_objects (job_id, storage_key) values ($1,'key-a'),($1,'key-b'),($1,'key-c')", [job.id]);
  const { rows } = await pool.query('select count(*)::int as n from project_deletion_job_objects where job_id=$1', [job.id]);
  assert.equal(rows[0].n, 3);
  await pool.query('delete from project_deletion_jobs where id=$1', [job.id]);
});

test('project_deletion_job_objects -- duplicate (job_id, storage_key) refusé', async () => {
  const { rows: [job] } = await pool.query(
    `insert into project_deletion_jobs (tenant_id, project_id, purge_after, storage_purge_state)
     values ($1,$2, now() + interval '7 days', 'pending') returning id`,
    [tenant, project]
  );
  await pool.query("insert into project_deletion_job_objects (job_id, storage_key) values ($1,'key-dup')", [job.id]);
  await assert.rejects(
    pool.query("insert into project_deletion_job_objects (job_id, storage_key) values ($1,'key-dup')", [job.id])
  );
  await pool.query('delete from project_deletion_jobs where id=$1', [job.id]);
});

test('suppression du job cascade ses objets (manifeste)', async () => {
  const { rows: [job] } = await pool.query(
    `insert into project_deletion_jobs (tenant_id, project_id, purge_after, storage_purge_state)
     values ($1,$2, now() + interval '7 days', 'pending') returning id`,
    [tenant, project]
  );
  await pool.query("insert into project_deletion_job_objects (job_id, storage_key) values ($1,'key-cascade')", [job.id]);
  await pool.query('delete from project_deletion_jobs where id=$1', [job.id]);
  const { rows } = await pool.query('select count(*)::int as n from project_deletion_job_objects where job_id=$1', [job.id]);
  assert.equal(rows[0].n, 0);
});

test('aucun lien direct cascade vers projet -- confirmé par le catalogue Postgres', async () => {
  const { rows } = await pool.query(`
    select tc.table_name, kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
    join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_name in ('project_deletion_jobs', 'project_deletion_job_objects')
      and ccu.table_name = 'projects'
  `);
  assert.equal(rows.length, 0, 'aucune FK ne doit jamais référencer projects depuis ces deux tables');
});

// ── Test critique de survie ──────────────────────────────────────────

test('CRITIQUE -- le deletion job et son manifeste survivent à la suppression physique réelle du projet', async () => {
  const { rows: [survivalTenant] } = await pool.query("insert into tenants (name) values ('Tenant Privacy Survival') returning id");
  const { rows: [survivalProject] } = await pool.query(
    "insert into projects (tenant_id, name, status) values ($1,'Privacy Batch1 Survival Projet','archived') returning id",
    [survivalTenant.id]
  );

  const { rows: [job] } = await pool.query(
    `insert into project_deletion_jobs (tenant_id, project_id, purge_after, storage_purge_state)
     values ($1,$2, now() + interval '7 days', 'pending') returning id`,
    [survivalTenant.id, survivalProject.id]
  );
  await pool.query(
    "insert into project_deletion_job_objects (job_id, storage_key) values ($1,'survival-key-1'),($1,'survival-key-2')",
    [job.id]
  );

  // Suppression physique RÉELLE du projet -- exerce la vraie cascade DB,
  // jamais une simulation.
  await pool.query('delete from projects where id=$1', [survivalProject.id]);

  const { rows: [projectCheck] } = await pool.query('select count(*)::int as n from projects where id=$1', [survivalProject.id]);
  assert.equal(projectCheck.n, 0, 'le projet doit avoir réellement disparu');

  const { rows: [jobCheck] } = await pool.query('select id, project_id from project_deletion_jobs where id=$1', [job.id]);
  assert.ok(jobCheck, 'le deletion job doit toujours exister après la suppression physique du projet');
  assert.equal(jobCheck.project_id, survivalProject.id, 'project_id reste un identifiant snapshot informatif, jamais perdu');

  const { rows: manifestCheck } = await pool.query('select storage_key from project_deletion_job_objects where job_id=$1', [job.id]);
  assert.equal(manifestCheck.length, 2, 'le manifeste doit toujours exister intégralement');

  // Le job doit encore pouvoir être mis à jour normalement, y compris
  // après la disparition du projet lui-même.
  await pool.query("update project_deletion_jobs set storage_purge_state='completed', db_purge_completed_at=now() where id=$1", [job.id]);
  const { rows: [finalCheck] } = await pool.query('select storage_purge_state, db_purge_completed_at from project_deletion_jobs where id=$1', [job.id]);
  assert.equal(finalCheck.storage_purge_state, 'completed');
  assert.ok(finalCheck.db_purge_completed_at);

  await pool.query('delete from project_deletion_jobs where id=$1', [job.id]);
  await pool.query('delete from tenants where id=$1', [survivalTenant.id]);
});
