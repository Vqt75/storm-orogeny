import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { createStorageAdapter } from '../src/adapters/storage/index.js';
import { requestProjectDeletion, cancelProjectDeletion, hasActiveProjectDeletionJob, withProjectDeletionGuard, compensateOrphanedStorageKeys } from '../src/domain/projects/deletionJobs.js';
import { AuditEventType } from '../src/domain/audit/auditEvents.js';

// Privacy & Data Lifecycle V1 — Batch 5. Prérequis à la suppression
// physique d'un projet : storage.delete() idempotent, demande/
// annulation d'un project_deletion_job avec capture immédiate du
// manifest. AUCUNE suppression physique exécutée dans ce batch --
// aucun DELETE FROM projects, aucun storage.delete() réellement
// appelé sur un asset dans le cadre d'une demande.

const config = loadConfig();
const pool = getPool(config);
const storageAdapter = createStorageAdapter(config);

let tenant, actorUserId;

async function cleanAll() {
  await pool.query("delete from project_deletion_job_objects where job_id in (select id from project_deletion_jobs where tenant_id in (select id from tenants where name like 'Tenant Privacy Batch5%'))");
  await pool.query("delete from project_deletion_jobs where tenant_id in (select id from tenants where name like 'Tenant Privacy Batch5%')");
  await pool.query("delete from audit_events where target_type='project' and tenant_id in (select id from tenants where name like 'Tenant Privacy Batch5%')");
  await pool.query("delete from assets where tenant_id in (select id from tenants where name like 'Tenant Privacy Batch5%')");
  await pool.query("delete from projects where tenant_id in (select id from tenants where name like 'Tenant Privacy Batch5%')");
  await pool.query("delete from users where email like '%@test-privacy-batch5.local'");
  await pool.query("delete from tenants where name like 'Tenant Privacy Batch5%'");
}

test.before(async () => {
  await runMigrations();
  await cleanAll();
  const { rows: [t] } = await pool.query("insert into tenants (name) values ('Tenant Privacy Batch5') returning id");
  tenant = t.id;
  const { rows: [actor] } = await pool.query("insert into users (email, display_name) values ('actor@test-privacy-batch5.local','Actor') returning id");
  actorUserId = actor.id;
});

test.after(async () => {
  await cleanAll();
  await closePool();
});

let counter = 0;
async function makeProject(status = 'archived') {
  counter += 1;
  const { rows: [p] } = await pool.query(
    "insert into projects (tenant_id, name, status) values ($1,$2,$3) returning id, status",
    [tenant, `Privacy Batch5 Projet ${counter}`, status]
  );
  return p;
}

async function makeAsset(projectId, storageKey = `fixture-key-${counter}-${Date.now()}`) {
  await pool.query(
    "insert into assets (tenant_id, project_id, kind, storage_key, content_type, byte_size) values ($1,$2,'logo',$3,'image/png',100)",
    [tenant, projectId, storageKey]
  );
  return storageKey;
}

async function countAuditEvents(eventType, targetId) {
  const { rows } = await pool.query('select count(*)::int as n from audit_events where event_type=$1 and target_id=$2', [eventType, targetId]);
  return rows[0].n;
}

// ── storage.delete() ────────────────────────────────────────────────

test('storage.delete -- fichier existant -- supprimé réellement', async () => {
  const { storageKey } = await storageAdapter.save(Buffer.from('contenu-test'), { extension: 'txt' });
  await storageAdapter.delete(storageKey);
  await assert.rejects(storageAdapter.read(storageKey));
});

test('storage.delete -- second delete -- succès (idempotent)', async () => {
  const { storageKey } = await storageAdapter.save(Buffer.from('contenu-test-2'), { extension: 'txt' });
  await storageAdapter.delete(storageKey);
  await assert.doesNotReject(storageAdapter.delete(storageKey), 'un second delete sur une clé déjà absente doit réussir');
});

test('storage.delete -- clé absente dès le départ -- succès, jamais NOT_FOUND considéré comme échec', async () => {
  await assert.doesNotReject(storageAdapter.delete(`jamais-existe-${Date.now()}`));
});

test('storage.delete -- erreur IO réelle -- propagée', async () => {
  // Répertoire au lieu d'un fichier -- unlink() échouera avec une
  // vraie erreur IO (EISDIR), jamais ENOENT -- doit donc être propagée,
  // pas absorbée par le chemin idempotent.
  const dirKey = `un-repertoire-${Date.now()}`;
  await fs.mkdir(`${config.storage.localDir}/${dirKey}`, { recursive: true });
  await assert.rejects(storageAdapter.delete(dirKey));
  await fs.rmdir(`${config.storage.localDir}/${dirKey}`);
});

test('storage.delete/read -- path traversal refusé explicitement', async () => {
  await assert.rejects(storageAdapter.delete('../../etc/passwd'));
  await assert.rejects(storageAdapter.read('../../etc/passwd'));
  await assert.rejects(storageAdapter.delete('sous/dossier/cle'));
});

// ── requestProjectDeletion ────────────────────────────────────────────

test('request -- project active -- refus', async () => {
  const p = await makeProject('active');
  const result = await requestProjectDeletion(pool, { tenantId: tenant, projectId: p.id, actorUserId });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'PROJECT_NOT_ARCHIVED');
});

test('request -- project stabilization -- refus', async () => {
  const p = await makeProject('stabilization');
  const result = await requestProjectDeletion(pool, { tenantId: tenant, projectId: p.id, actorUserId });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'PROJECT_NOT_ARCHIVED');
});

test('request -- project archived -- accepté, purge_after exactement +7 jours, audit exact', async () => {
  const p = await makeProject('archived');
  const before = Date.now();
  const result = await requestProjectDeletion(pool, { tenantId: tenant, projectId: p.id, actorUserId });
  assert.equal(result.ok, true);
  assert.ok(result.jobId);
  assert.equal(result.cancellable, true);

  const purgeAfterMs = new Date(result.purgeAfter).getTime();
  const expectedMs = before + 7 * 24 * 60 * 60 * 1000;
  assert.ok(Math.abs(purgeAfterMs - expectedMs) < 5000, 'purge_after doit être exactement +7 jours (tolérance de quelques secondes pour le temps d\'exécution du test)');

  const { rows: [project] } = await pool.query('select status from projects where id=$1', [p.id]);
  assert.equal(project.status, 'archived', 'le projet reste archived, jamais un statut de suppression');

  const n = await countAuditEvents(AuditEventType.PROJECT_DELETION_REQUESTED, p.id);
  assert.equal(n, 1);
});

test('request -- actor absent -- refus sans mutation', async () => {
  const p = await makeProject('archived');
  const result = await requestProjectDeletion(pool, { tenantId: tenant, projectId: p.id });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ACTOR_REQUIRED');
  const { rows: jobs } = await pool.query('select id from project_deletion_jobs where project_id=$1', [p.id]);
  assert.equal(jobs.length, 0);
});

test('request -- manifest complet capturé', async () => {
  const p = await makeProject('archived');
  const key1 = await makeAsset(p.id);
  const key2 = await makeAsset(p.id);
  const result = await requestProjectDeletion(pool, { tenantId: tenant, projectId: p.id, actorUserId });
  assert.equal(result.ok, true);
  assert.equal(result.manifestObjectCount, 2);

  const { rows: manifest } = await pool.query('select storage_key from project_deletion_job_objects where job_id=$1', [result.jobId]);
  const keys = manifest.map(r => r.storage_key).sort();
  assert.deepEqual(keys, [key1, key2].sort());
});

test('request -- zéro asset -- manifest vide autorisé', async () => {
  const p = await makeProject('archived');
  const result = await requestProjectDeletion(pool, { tenantId: tenant, projectId: p.id, actorUserId });
  assert.equal(result.ok, true);
  assert.equal(result.manifestObjectCount, 0);
});

test('request -- deux demandes actives -- refus/idempotence métier', async () => {
  const p = await makeProject('archived');
  const first = await requestProjectDeletion(pool, { tenantId: tenant, projectId: p.id, actorUserId });
  assert.equal(first.ok, true);
  const second = await requestProjectDeletion(pool, { tenantId: tenant, projectId: p.id, actorUserId });
  assert.equal(second.ok, false);
  assert.equal(second.code, 'DELETION_ALREADY_REQUESTED');

  const { rows: jobs } = await pool.query('select id from project_deletion_jobs where project_id=$1', [p.id]);
  assert.equal(jobs.length, 1, 'un seul job, jamais un doublon');
});

test('request -- aucun storage delete réellement effectué', async () => {
  const p = await makeProject('archived');
  const { storageKey } = await storageAdapter.save(Buffer.from('doit-survivre'), { extension: 'txt' });
  await makeAsset(p.id, storageKey);
  await requestProjectDeletion(pool, { tenantId: tenant, projectId: p.id, actorUserId });
  await assert.doesNotReject(storageAdapter.read(storageKey), 'le fichier physique doit toujours exister -- aucune purge dans ce batch');
});

// ── cancelProjectDeletion ─────────────────────────────────────────────

test('cancel -- avant purge_after -- accepté, cancelled_at exact, project toujours archived, aucun storage delete, audit exact', async () => {
  const p = await makeProject('archived');
  const { storageKey } = await storageAdapter.save(Buffer.from('doit-survivre-cancel'), { extension: 'txt' });
  await makeAsset(p.id, storageKey);
  const requested = await requestProjectDeletion(pool, { tenantId: tenant, projectId: p.id, actorUserId });

  const before = Date.now();
  const result = await cancelProjectDeletion(pool, { jobId: requested.jobId, actorUserId });
  assert.equal(result.ok, true);

  const { rows: [job] } = await pool.query('select cancelled_at from project_deletion_jobs where id=$1', [requested.jobId]);
  assert.ok(job.cancelled_at);
  assert.ok(Math.abs(new Date(job.cancelled_at).getTime() - before) < 5000);

  const { rows: [project] } = await pool.query('select status from projects where id=$1', [p.id]);
  assert.equal(project.status, 'archived');

  await assert.doesNotReject(storageAdapter.read(storageKey));

  const n = await countAuditEvents(AuditEventType.PROJECT_DELETION_CANCELLED, p.id);
  assert.equal(n, 1);
});

test('cancel -- second cancel -- refus/idempotence', async () => {
  const p = await makeProject('archived');
  const requested = await requestProjectDeletion(pool, { tenantId: tenant, projectId: p.id, actorUserId });
  const first = await cancelProjectDeletion(pool, { jobId: requested.jobId, actorUserId });
  assert.equal(first.ok, true);
  const second = await cancelProjectDeletion(pool, { jobId: requested.jobId, actorUserId });
  assert.equal(second.ok, false);
  assert.equal(second.code, 'ALREADY_CANCELLED');
});

test('cancel -- après purge_after -- refus', async () => {
  const p = await makeProject('archived');
  const { rows: [job] } = await pool.query(
    `insert into project_deletion_jobs (tenant_id, project_id, requested_by_user_id, purge_after, storage_purge_state)
     values ($1,$2,$3, now() - interval '1 hour', 'pending') returning id`,
    [tenant, p.id, actorUserId]
  );
  const result = await cancelProjectDeletion(pool, { jobId: job.id, actorUserId });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'PURGE_WINDOW_PASSED');
});

test('cancel -- purge déjà commencée -- refus', async () => {
  const p = await makeProject('archived');
  const { rows: [job] } = await pool.query(
    `insert into project_deletion_jobs (tenant_id, project_id, requested_by_user_id, purge_after, storage_purge_state)
     values ($1,$2,$3, now() + interval '7 days', 'in_progress') returning id`,
    [tenant, p.id, actorUserId]
  );
  const result = await cancelProjectDeletion(pool, { jobId: job.id, actorUserId });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'PURGE_ALREADY_STARTED');
});

test('cancel -- actor absent -- refus', async () => {
  const p = await makeProject('archived');
  const requested = await requestProjectDeletion(pool, { tenantId: tenant, projectId: p.id, actorUserId });
  const result = await cancelProjectDeletion(pool, { jobId: requested.jobId });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ACTOR_REQUIRED');
  const { rows: [job] } = await pool.query('select cancelled_at from project_deletion_jobs where id=$1', [requested.jobId]);
  assert.equal(job.cancelled_at, null);
});

// ── Atomicité ────────────────────────────────────────────────────────

test('atomicité -- échec audit sur request -- rollback total, aucun job, aucun manifest', async () => {
  const p = await makeProject('archived');
  await makeAsset(p.id);
  await pool.query('REVOKE INSERT ON audit_events FROM storm_orogeny');
  try {
    await assert.rejects(requestProjectDeletion(pool, { tenantId: tenant, projectId: p.id, actorUserId }));
  } finally {
    await pool.query('GRANT INSERT ON audit_events TO storm_orogeny');
  }
  const { rows: jobs } = await pool.query('select id from project_deletion_jobs where project_id=$1', [p.id]);
  assert.equal(jobs.length, 0, 'aucun job -- rollback total');
});

test('atomicité -- échec capture manifest -- rollback total, aucun job', async () => {
  const p = await makeProject('archived');
  await makeAsset(p.id);
  await pool.query('REVOKE INSERT ON project_deletion_job_objects FROM storm_orogeny');
  try {
    await assert.rejects(requestProjectDeletion(pool, { tenantId: tenant, projectId: p.id, actorUserId }));
  } finally {
    await pool.query('GRANT INSERT ON project_deletion_job_objects TO storm_orogeny');
  }
  const { rows: jobs } = await pool.query('select id from project_deletion_jobs where project_id=$1', [p.id]);
  assert.equal(jobs.length, 0, 'aucun job partiel -- la capture du manifest fait partie de la même transaction');
  const n = await countAuditEvents(AuditEventType.PROJECT_DELETION_REQUESTED, p.id);
  assert.equal(n, 0);
});

test('atomicité -- échec audit sur cancel -- rollback total, job reste actif', async () => {
  const p = await makeProject('archived');
  const requested = await requestProjectDeletion(pool, { tenantId: tenant, projectId: p.id, actorUserId });
  await pool.query('REVOKE INSERT ON audit_events FROM storm_orogeny');
  try {
    await assert.rejects(cancelProjectDeletion(pool, { jobId: requested.jobId, actorUserId }));
  } finally {
    await pool.query('GRANT INSERT ON audit_events TO storm_orogeny');
  }
  const { rows: [job] } = await pool.query('select cancelled_at from project_deletion_jobs where id=$1', [requested.jobId]);
  assert.equal(job.cancelled_at, null, 'jamais annulé si l\'audit échoue');
});

// ── Verrou de mutation pendant la grace period ───────────────────────

test('hasActiveProjectDeletionJob -- reflète correctement présence/absence/annulation', async () => {
  const p = await makeProject('archived');
  assert.equal(await hasActiveProjectDeletionJob(pool, p.id), false);

  const requested = await requestProjectDeletion(pool, { tenantId: tenant, projectId: p.id, actorUserId });
  assert.equal(await hasActiveProjectDeletionJob(pool, p.id), true, 'un job actif doit être détecté -- c\'est le verrou utilisé par les routes d\'upload');

  await cancelProjectDeletion(pool, { jobId: requested.jobId, actorUserId });
  assert.equal(await hasActiveProjectDeletionJob(pool, p.id), false, 'un job annulé ne doit plus jamais bloquer de nouvelles mutations');
});

// ── Lifecycles orthogonaux ───────────────────────────────────────────

test('orthogonalité -- aucune valeur pending_deletion n\'existe jamais sur projects.status', async () => {
  const { rows } = await pool.query(
    "select conname, pg_get_constraintdef(oid) as def from pg_constraint where conrelid='projects'::regclass and contype='c'"
  );
  const statusCheck = rows.find(r => r.def.includes('status') && r.conname === 'projects_status_check');
  assert.ok(statusCheck, 'la contrainte doit exister');
  assert.ok(!statusCheck.def.includes('pending_deletion'), 'jamais réintroduit comme état du lifecycle projet');
  assert.ok(statusCheck.def.includes('archived'), 'les trois états attendus restent inchangés');
});

// ── Survie critique (structure) ──────────────────────────────────────

test('CRITIQUE (structure) -- project_deletion_jobs ne référence toujours aucune FK vers projects', async () => {
  const { rows } = await pool.query(`
    select tc.table_name from information_schema.table_constraints tc
    join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_name in ('project_deletion_jobs', 'project_deletion_job_objects')
      and ccu.table_name = 'projects'
  `);
  assert.equal(rows.length, 0, 'invariant Batch 1 toujours vérifié -- aucun couplage introduit par ce batch');
});

// ── withProjectDeletionGuard (fermeture TOCTOU) ──────────────────────

test('guard -- aucun job actif -- work() exécuté et committé', async () => {
  const p = await makeProject('archived');
  const key = `guard-ok-${Date.now()}`;
  const guard = await withProjectDeletionGuard(pool, {
    projectId: p.id,
    work: async (client) => {
      await client.query(
        "insert into assets (tenant_id, project_id, kind, storage_key, content_type, byte_size) values ($1,$2,'logo',$3,'image/png',10)",
        [tenant, p.id, key]
      );
      return { done: true };
    }
  });
  assert.equal(guard.ok, true);
  const { rows } = await pool.query('select id from assets where storage_key=$1', [key]);
  assert.equal(rows.length, 1, 'le travail doit être réellement committé');
});

test('guard -- job actif -- work() JAMAIS exécuté, aucun asset, aucun fichier physique créé', async () => {
  const p = await makeProject('archived');
  await requestProjectDeletion(pool, { tenantId: tenant, projectId: p.id, actorUserId });

  let workCalled = false;
  const guard = await withProjectDeletionGuard(pool, {
    projectId: p.id,
    work: async () => { workCalled = true; return {}; }
  });
  assert.equal(guard.ok, false);
  assert.equal(guard.code, 'PROJECT_DELETION_IN_PROGRESS');
  assert.equal(workCalled, false, 'work() ne doit JAMAIS être invoqué -- aucun storage.save() ne doit jamais être tenté');
});

// ── TEST CONCURRENT RÉEL -- upload vs deletion request ───────────────

test('CONCURRENCE RÉELLE -- upload vs deletion request simultanés -- invariant respecté dans les deux ordres possibles, aucun troisième état', async () => {
  // Répété plusieurs fois -- l'ordre réel d'acquisition du verrou
  // dépend du scheduler Postgres/Node, jamais garanti côté test.
  // Chaque itération doit vérifier l'invariant quel que soit le
  // gagnant réel de cette exécution précise.
  for (let i = 0; i < 8; i++) {
    const p = await makeProject('archived');
    const key = `concurrent-key-${i}-${Date.now()}`;

    const uploadAttempt = withProjectDeletionGuard(pool, {
      projectId: p.id,
      work: async (client) => {
        const { storageKey } = await storageAdapter.save(Buffer.from(`contenu-${i}`), { extension: 'txt' });
        await client.query(
          "insert into assets (tenant_id, project_id, kind, storage_key, content_type, byte_size) values ($1,$2,'logo',$3,'image/png',10)",
          [tenant, p.id, storageKey]
        );
        return { storageKey };
      }
    });
    const deletionAttempt = requestProjectDeletion(pool, { tenantId: tenant, projectId: p.id, actorUserId });

    const [uploadResult, deletionResult] = await Promise.all([uploadAttempt, deletionAttempt]);

    if (uploadResult.ok) {
      // L'upload a gagné -- son asset doit exister, et si la demande
      // de suppression a ENSUITE réussi (elle a dû attendre le
      // commit de l'upload grâce au verrou), son manifest doit
      // OBLIGATOIREMENT contenir cette storage key.
      const { rows: assetRows } = await pool.query('select storage_key from assets where storage_key=$1', [uploadResult.result.storageKey]);
      assert.equal(assetRows.length, 1, 'l\'asset de l\'upload gagnant doit exister réellement');

      if (deletionResult.ok) {
        const { rows: manifestRows } = await pool.query(
          'select storage_key from project_deletion_job_objects where job_id=$1 and storage_key=$2',
          [deletionResult.jobId, uploadResult.result.storageKey]
        );
        assert.equal(manifestRows.length, 1, 'INVARIANT -- si l\'upload gagne, sa storage key doit être dans le manifest');
      } else {
        // Si la demande de suppression a échoué (ex. déjà un job actif
        // d'une itération précédente -- improbable ici car projet
        // frais à chaque itération, mais couvert par prudence), rien
        // à vérifier de plus : aucune incohérence possible.
        assert.equal(deletionResult.code, 'DELETION_ALREADY_REQUESTED');
      }
    } else {
      // La demande de suppression a gagné -- l'upload doit avoir été
      // refusé AVANT tout storage.save(), donc aucun fichier physique
      // ni ligne asset durable ne doit exister pour cette clé.
      assert.equal(uploadResult.code, 'PROJECT_DELETION_IN_PROGRESS');
      assert.equal(deletionResult.ok, true, 'la demande de suppression doit avoir réellement réussi dans ce cas');

      const { rows: assetRows } = await pool.query('select id from assets where project_id=$1', [p.id]);
      assert.equal(assetRows.length, 0, 'INVARIANT -- si la deletion request gagne, aucun asset durable ne doit exister');

      const { rows: manifestRows } = await pool.query('select storage_key from project_deletion_job_objects where job_id=$1', [deletionResult.jobId]);
      assert.equal(manifestRows.length, 0, 'le manifest doit être vide -- aucun asset n\'existait au moment de la capture');
    }

    // Nettoyage entre itérations.
    await pool.query('delete from project_deletion_job_objects where job_id in (select id from project_deletion_jobs where project_id=$1)', [p.id]);
    await pool.query('delete from project_deletion_jobs where project_id=$1', [p.id]);
    await pool.query('delete from assets where project_id=$1', [p.id]);
  }
});

// ── FERMETURE DB/storage consistency ─────────────────────────────────
// PostgreSQL et le storage ne partagent jamais la même transaction --
// le verrou sur projects sérialise les races DB-vs-DB, jamais une
// défaillance DB-vs-filesystem. Ces tests exercent le chemin réel de
// compensation, jamais un mock.


async function cleanupBacklogEntries(storageKey) {
  await pool.query('delete from storage_cleanup_backlog where storage_key=$1', [storageKey]);
}

test('storage.save réussit, insertAsset échoue (vraie violation CHECK) -- compensation réussie, aucune trace orpheline', async () => {
  const p = await makeProject('archived');
  let capturedKey;

  await assert.rejects(
    withProjectDeletionGuard(pool, {
      projectId: p.id,
      storageAdapter,
      work: async (client, trackSavedKey) => {
        const { storageKey } = await storageAdapter.save(Buffer.from('contenu-reel'), { extension: 'txt' });
        capturedKey = storageKey;
        trackSavedKey(storageKey);
        // Violation RÉELLE de la contrainte CHECK assets_byte_size_check
        // (byte_size > 0) -- jamais une exception construite à la main.
        await client.query(
          "insert into assets (tenant_id, project_id, kind, storage_key, content_type, byte_size) values ($1,$2,'logo',$3,'image/png',-1)",
          [tenant, p.id, storageKey]
        );
      }
    })
  );

  assert.ok(capturedKey, 'précondition -- storage.save doit avoir réellement réussi avant l\'échec DB');

  const { rows: assetRows } = await pool.query('select id from assets where storage_key=$1', [capturedKey]);
  assert.equal(assetRows.length, 0, 'aucune ligne asset durable');

  await assert.rejects(storageAdapter.read(capturedKey), 'l\'objet physique doit avoir été supprimé par compensation');

  const { rows: backlogRows } = await pool.query('select id from storage_cleanup_backlog where storage_key=$1', [capturedKey]);
  assert.equal(backlogRows.length, 0, 'compensation réussie -- aucune trace de backlog nécessaire, jamais une entrée fantôme');
});

test('LIMITE DE TEST DOCUMENTÉE -- échec au COMMIT lui-même : même chemin de code que l\'échec dans work(), non testable séparément sans mock', async () => {
  // withProjectDeletionGuard traite "work() lève" et "COMMIT lève"
  // de façon strictement identique : même bloc catch, même appel de
  // compensation (voir le code -- `committed` reste false dans les
  // deux cas). Forcer une vraie défaillance de COMMIT isolément
  // exigerait soit un mock du client pg (exclu explicitement), soit
  // une manipulation de connexion à un niveau si bas qu'elle
  // dépasserait ce qui est raisonnablement testable ici. Le test
  // précédent (insertAsset échoue) exerce déjà exactement le même
  // chemin de compensation que emprunterait un échec de COMMIT --
  // confirmé par lecture directe du code, pas par un test séparé.
  assert.ok(true, 'limite documentée explicitement, comme demandé -- aucune fausse couverture prétendue');
});

test('échec DB + échec de la compensation storage.delete -- storage key enregistrée durablement dans storage_cleanup_backlog, jamais perdue', async () => {
  const p = await makeProject('archived');
  let capturedKey;

  // Sabotage RÉEL, jamais un mock : le process tourne en root dans cet
  // environnement (chmod seul est donc sans effet, un root contourne
  // les permissions). Technique fiable indépendamment des privilèges :
  // juste après un storage.save() réel et réussi, on retire le fichier
  // physique puis on crée un RÉPERTOIRE au même chemin -- unlink() sur
  // un répertoire échoue avec EISDIR, une vraie erreur IO jamais
  // absorbée par le chemin idempotent (qui ne traite que ENOENT).
  await assert.rejects(
    withProjectDeletionGuard(pool, {
      projectId: p.id,
      storageAdapter,
      work: async (client, trackSavedKey) => {
        const { storageKey } = await storageAdapter.save(Buffer.from('contenu-reel-2'), { extension: 'txt' });
        capturedKey = storageKey;
        trackSavedKey(storageKey);
        await fs.unlink(`${config.storage.localDir}/${storageKey}`);
        await fs.mkdir(`${config.storage.localDir}/${storageKey}`);
        await client.query(
          "insert into assets (tenant_id, project_id, kind, storage_key, content_type, byte_size) values ($1,$2,'logo',$3,'image/png',-1)",
          [tenant, p.id, storageKey]
        );
      }
    })
  );

  assert.ok(capturedKey);

  const { rows: assetRows } = await pool.query('select id from assets where storage_key=$1', [capturedKey]);
  assert.equal(assetRows.length, 0, 'toujours aucune ligne asset durable');

  const { rows: backlogRows } = await pool.query('select storage_key, reason, cleaned_at from storage_cleanup_backlog where storage_key=$1', [capturedKey]);
  assert.equal(backlogRows.length, 1, 'la storage key doit être enregistrée durablement -- jamais seulement loguée');
  assert.equal(backlogRows[0].reason, 'insert_failed', 'la cause d\'origine (échec DANS work(), jamais au COMMIT) doit être correctement propagée');
  assert.equal(backlogRows[0].cleaned_at, null);

  // Nettoyage réel.
  await fs.rmdir(`${config.storage.localDir}/${capturedKey}`);
  await cleanupBacklogEntries(capturedKey);
});

// ── Delete authority — décision produit confirmée par test ───────────

test('DELETE AUTHORITY -- PROJECTS_DELETE_PERMANENTLY fourni par aucun bundle standard (décision produit V1 explicite)', async () => {
  const { organizationCapabilitiesForBundle, OrganizationCapability } = await import('../src/domain/permissions/capabilities.js');
  assert.equal(
    organizationCapabilitiesForBundle('organization_admin').includes(OrganizationCapability.PROJECTS_DELETE_PERMANENTLY),
    false,
    'organization_admin ne doit jamais porter cette capability -- décision produit V1'
  );
  assert.equal(
    organizationCapabilitiesForBundle('member').includes(OrganizationCapability.PROJECTS_DELETE_PERMANENTLY),
    false
  );
});

test('DELETE AUTHORITY -- le service domaine reste testable indépendamment de toute capability HTTP', async () => {
  // requestProjectDeletion ne revérifie jamais de capability lui-même
  // (AuthN ≠ Authorization) -- confirmé par le simple fait que tous
  // les tests request/cancel de ce fichier réussissent sans jamais
  // passer par une couche d'autorisation HTTP.
  const p = await makeProject('archived');
  const result = await requestProjectDeletion(pool, { tenantId: tenant, projectId: p.id, actorUserId });
  assert.equal(result.ok, true, 'le domaine reste pleinement testable, indépendamment de la décision fail-closed côté HTTP');
});

// ── FERMETURE FINALE -- frontière backlog indépendante de la transaction condamnée ──

test('PREUVE STRICTE -- l\'écriture du backlog réussit alors qu\'une AUTRE transaction métier reste réellement condamnée et encore ouverte sur une connexion séparée', async () => {
  // Réponse à la question posée : OUI, la frontière est propre --
  // compensateOrphanedStorageKeys(pool, ...) ne prend JAMAIS `client`
  // dans sa signature (vérifié par lecture directe du code, cette
  // export le prouve structurellement). Ce test va plus loin qu'une
  // preuve par inspection : il maintient une VRAIE transaction
  // condamnée, réellement ouverte sur une connexion distincte, PENDANT
  // que le backlog s'écrit -- la preuve la plus stricte possible que
  // ces deux frontières ne se recouvrent jamais, jamais absorbée
  // silencieusement par une transaction Postgres avortée.

  // 1. Ouvre une transaction RÉELLEMENT condamnée sur une connexion
  // séparée, obtenue directement du pool -- jamais via
  // withProjectDeletionGuard, pour isoler strictement cette preuve.
  const condemnedClient = await pool.connect();
  await condemnedClient.query('BEGIN');
  await assert.rejects(
    condemnedClient.query("insert into assets (tenant_id, project_id, kind, storage_key, content_type, byte_size) values ($1,$1,'logo','preuve-condamnee','image/png',-1)", [tenant]),
    'précondition -- doit réellement échouer (violation CHECK), plaçant cette transaction en état avorté'
  );
  // La transaction reste VOLONTAIREMENT non-rollback à cet instant --
  // condamnée et toujours ouverte, exactement le scénario à prouver.
  await assert.rejects(
    condemnedClient.query('select 1'),
    'confirmation -- toute nouvelle commande sur cette connexion est bien rejetée tant que la transaction reste condamnée et ouverte'
  );

  // 2. Prépare un vrai échec de compensation (technique fichier ->
  // répertoire, déjà validée), storageKey indépendante de la
  // transaction condamnée ci-dessus.
  const { storageKey } = await storageAdapter.save(Buffer.from('preuve-frontiere'), { extension: 'txt' });
  await fs.unlink(`${config.storage.localDir}/${storageKey}`);
  await fs.mkdir(`${config.storage.localDir}/${storageKey}`);

  // 3. Écrit le backlog via `pool` -- jamais `condemnedClient` --
  // PENDANT que la transaction condamnée est encore ouverte.
  await compensateOrphanedStorageKeys(pool, storageAdapter, [storageKey], 'commit_failed');

  const { rows: backlogRows } = await pool.query(
    'select reason, cleaned_at from storage_cleanup_backlog where storage_key=$1',
    [storageKey]
  );
  assert.equal(backlogRows.length, 1, 'INVARIANT -- le backlog doit être écrit avec succès malgré une transaction condamnée réellement ouverte ailleurs');
  assert.equal(backlogRows[0].reason, 'commit_failed');
  assert.equal(backlogRows[0].cleaned_at, null);

  // 4. Nettoyage -- referme proprement la transaction condamnée
  // (jamais laissée ouverte au-delà de ce test) et le répertoire de
  // test.
  await condemnedClient.query('ROLLBACK');
  condemnedClient.release();
  await fs.rmdir(`${config.storage.localDir}/${storageKey}`);
  await cleanupBacklogEntries(storageKey);
});

// ── Limite de test documentée -- vraie erreur au COMMIT lui-même ────

test('LIMITE DE TEST DOCUMENTÉE -- provoquer une vraie erreur au COMMIT lui-même (distincte d\'une erreur dans work()) reste difficile à isoler proprement', async () => {
  // Ce que le test précédent prouve : la frontière d'écriture du
  // backlog (pool.query, jamais client.query) est structurellement
  // indépendante de N'IMPORTE QUEL état de transaction métier,
  // condamnée ou non -- y compris si cette transaction était condamnée
  // PRÉCISÉMENT parce que son propre COMMIT avait échoué (le mécanisme
  // de compensation ne distingue et ne peut distinguer la CAUSE de
  // l'échec -- work() ou COMMIT -- il agit identiquement dans les
  // deux cas, sur la seule liste de storageKeys déjà suivies).
  //
  // Ce que ce test ne prouve PAS séparément : déclencher une vraie
  // erreur AU MOMENT PRÉCIS du COMMIT (par opposition à une erreur
  // dans une requête à l'intérieur de la transaction) exigerait soit
  // un mock du client pg (exclu explicitement), soit une manipulation
  // de connexion au niveau du driver trop fragile pour constituer une
  // preuve fiable ici. La preuve structurelle (signature de fonction)
  // et la preuve comportementale (transaction condamnée réellement
  // ouverte, test précédent) couvrent ensemble l'invariant demandé :
  // le backlog n'est jamais dépendant de la transaction qui échoue,
  // quelle que soit la nature exacte de cet échec.
  assert.ok(true, 'limite documentée explicitement -- aucune fausse preuve de COMMIT failure isolé prétendue');
});
