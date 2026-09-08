// Exécution des project_deletion_jobs arrivés à purge_after -- Privacy
// & Data Lifecycle V1, Batch 6. Storage-first, toujours : un projet
// n'est supprimé de PostgreSQL QUE lorsque tous les objets de son
// manifest ont purged_at renseigné. Le manifest capturé à la demande
// (Batch 5) reste l'autorité -- jamais un rescan du storage, jamais
// une suppression par préfixe.
//
// state is source, manifest is truth : storage_purge_state pilote le
// workflow (pending -> in_progress -> completed|failed),
// project_deletion_job_objects.purged_at est la vérité objet par
// objet -- jamais confondus.
//
// CRASH/RESTART RECOVERY (fermeture) : le claim court (SELECT ... FOR
// UPDATE SKIP LOCKED, commit immédiat) évite une transaction longue,
// mais ne distinguait jusqu'ici jamais un job réellement en cours de
// traitement par un worker vivant d'un job abandonné après un crash
// -- les deux se présentent identiquement en storage_purge_state=
// 'in_progress'. LEASE BORNÉE : chaque claim génère un token opaque
// et une expiration enregistrée en DB (jamais une dépendance mémoire
// process, jamais un timeout arbitraire non enregistré). Toute
// écriture ultérieure sur le job (échec storage, complétion storage,
// suppression finale) vérifie explicitement lease_token -- si un
// autre worker a entre-temps repris le job (lease expirée), l'écriture
// est refusée plutôt que silencieusement acceptée. L'idempotence de
// storage.delete() reste une seconde ligne de défense, jamais la
// justification de l'ownership exclusif lui-même.

import { randomUUID } from 'node:crypto';
import { recordAuditEvent, AuditEventType } from '../audit/auditEvents.js';

const LEASE_DURATION_MS = 10 * 60 * 1000; // 10 minutes -- large marge pour purger un manifest raisonnable + transaction finale.

// ── Claim ────────────────────────────────────────────────────────────
//
// Un job est réclamable si :
//   - dû, non annulé, non db-complete (baseline déjà posée Batch 5/6) ;
//   - ET storage_purge_state in ('pending','failed') [jamais en cours
//     par construction], OU lease_expires_at absente/expirée [le job
//     était bien 'in_progress'/'completed' mais son propriétaire
//     précédent n'a plus de lease valide -- crash ou fin de vie
//     normale, indifférent, réclamable dans les deux cas].
//
// Tableau de vérité (now = instant du claim) :
//   pending                                             -> réclamable
//   failed                                               -> réclamable
//   in_progress, lease_expires_at > now                  -> PAS réclamable (worker vivant)
//   in_progress, lease_expires_at <= now ou null         -> réclamable (abandonné)
//   completed, db_purge_completed_at IS NULL, lease > now      -> PAS réclamable
//   completed, db_purge_completed_at IS NULL, lease <= now/null -> réclamable
//   *, db_purge_completed_at IS NOT NULL                 -> jamais sélectionné (filtre baseline)
export async function claimDueDeletionJobs(pool, { now = new Date(), limit = 10 } = {}) {
  const leaseToken = randomUUID();
  const leaseExpiresAt = new Date(now.getTime() + LEASE_DURATION_MS);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `select id from project_deletion_jobs
       where cancelled_at is null and db_purge_completed_at is null and purge_after <= $1
         and (
           storage_purge_state in ('pending', 'failed')
           or lease_expires_at is null
           or lease_expires_at <= $1
         )
       order by purge_after
       for update skip locked
       limit $2`,
      [now, limit]
    );
    const jobIds = rows.map(r => r.id);
    if (jobIds.length > 0) {
      await client.query(
        `update project_deletion_jobs
         set storage_purge_state = case when storage_purge_state in ('pending', 'failed') then 'in_progress' else storage_purge_state end,
             lease_token = $2,
             lease_expires_at = $3
         where id = any($1::uuid[])`,
        [jobIds, leaseToken, leaseExpiresAt]
      );
    }
    await client.query('COMMIT');
    return jobIds.map(jobId => ({ jobId, leaseToken }));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Purge storage -- le manifest est l'autorité ──────────────────────

// Purge tous les objets encore non purgés de CE job précis. S'arrête
// et marque le job 'failed' à la première vraie erreur storage
// (jamais une erreur NOT_FOUND -- storage.delete() est idempotent,
// voir Batch 5). Ne retraite jamais un objet déjà purged_at != NULL.
// Chaque écriture sur le job lui-même (jamais sur les objets
// individuels, déjà protégés par purged_at IS NULL) vérifie
// lease_token -- si la lease a été perdue entretemps (reprise par un
// autre worker), l'écriture est refusée explicitement.
async function purgeJobStorageObjects(pool, storageAdapter, jobId, leaseToken) {
  const { rows: pendingObjects } = await pool.query(
    'select id, storage_key from project_deletion_job_objects where job_id = $1 and purged_at is null order by id',
    [jobId]
  );

  for (const object of pendingObjects) {
    try {
      await storageAdapter.delete(object.storage_key);
    } catch (err) {
      const { rowCount } = await pool.query(
        "update project_deletion_jobs set storage_purge_state = 'failed' where id = $1 and lease_token = $2",
        [jobId, leaseToken]
      );
      if (rowCount === 0) return { ok: false, reason: 'lease_lost' };
      return { ok: false, reason: 'storage_delete_failed' };
    }
    // Invariant crash-safe : si storage.delete() a réussi mais que
    // CETTE écriture échoue (crash, perte de connexion), le prochain
    // passage retentera storage.delete() sur ce même objet -- succès
    // garanti par idempotence, jamais un travail perdu.
    await pool.query(
      'update project_deletion_job_objects set purged_at = now() where id = $1 and purged_at is null',
      [object.id]
    );
  }

  const { rows: [remaining] } = await pool.query(
    'select count(*)::int as n from project_deletion_job_objects where job_id = $1 and purged_at is null',
    [jobId]
  );
  if (remaining.n > 0) {
    return { ok: false, reason: 'objects_remaining' };
  }

  const { rowCount } = await pool.query(
    "update project_deletion_jobs set storage_purge_state = 'completed' where id = $1 and lease_token = $2",
    [jobId, leaseToken]
  );
  if (rowCount === 0) return { ok: false, reason: 'lease_lost' };
  return { ok: true };
}

// ── Suppression finale DB -- storage-first, toujours ─────────────────

async function finalizeProjectDeletion(pool, jobId, leaseToken) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [job] } = await client.query(
      'select id, tenant_id, project_id, cancelled_at, db_purge_completed_at, storage_purge_state, lease_token, lease_expires_at from project_deletion_jobs where id = $1 for update',
      [jobId]
    );
    if (!job) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'NOT_FOUND' };
    }
    if (job.cancelled_at) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'CANCELLED' };
    }
    if (job.db_purge_completed_at) {
      await client.query('ROLLBACK');
      return { ok: true, code: 'ALREADY_COMPLETED' };
    }
    if (job.storage_purge_state !== 'completed') {
      await client.query('ROLLBACK');
      return { ok: false, code: 'STORAGE_NOT_COMPLETE' };
    }
    // Preuve d'ownership exclusif AVANT toute destruction -- si un
    // autre worker a repris ce job (lease expirée puis reclaimée
    // ailleurs), CETTE tentative de finalisation est refusée, jamais
    // silencieusement acceptée sur la seule foi de l'idempotence.
    if (job.lease_token !== leaseToken || !job.lease_expires_at || new Date(job.lease_expires_at) <= new Date()) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'LEASE_LOST' };
    }

    const { rows: [project] } = await client.query(
      'select id, status from projects where id = $1 and tenant_id = $2 for update',
      [job.project_id, job.tenant_id]
    );
    if (!project) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'PROJECT_ALREADY_GONE' };
    }
    if (project.status !== 'archived') {
      await client.query('ROLLBACK');
      return { ok: false, code: 'PROJECT_NOT_ARCHIVED' };
    }

    const { rows: [unpurged] } = await client.query(
      'select count(*)::int as n from project_deletion_job_objects where job_id = $1 and purged_at is null',
      [jobId]
    );
    if (unpurged.n > 0) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'STORAGE_NOT_COMPLETE' };
    }

    await client.query('delete from projects where id = $1', [project.id]);

    await client.query(
      "delete from external_group_mappings where target_type = 'project' and target_id = $1",
      [project.id]
    );

    await client.query(
      "update project_deletion_jobs set db_purge_completed_at = now(), storage_purge_state = 'completed' where id = $1",
      [jobId]
    );

    await recordAuditEvent(client, {
      eventType: AuditEventType.PROJECT_DELETED_PERMANENTLY,
      actorUserId: null,
      targetType: 'project',
      targetId: job.project_id,
      tenantId: job.tenant_id,
      projectId: job.project_id
    });

    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Orchestrateur ────────────────────────────────────────────────────

export async function runProjectDeletions(pool, { storageAdapter, now = new Date(), logger, limit = 10 }) {
  const claimed = await claimDueDeletionJobs(pool, { now, limit });
  logger.info({ claimed: claimed.length }, 'project_deletions.claimed');

  const summary = { claimed: claimed.length, storagePurged: 0, storageFailed: 0, leaseLost: 0, projectsDeleted: 0, alreadyCompleted: 0, blocked: 0 };

  for (const { jobId, leaseToken } of claimed) {
    let storageResult;
    try {
      storageResult = await purgeJobStorageObjects(pool, storageAdapter, jobId, leaseToken);
    } catch (err) {
      summary.blocked += 1;
      logger.warn({ err: { name: err.name, message: err.message } }, 'project_deletions.storage_purge_error');
      continue;
    }
    if (!storageResult.ok) {
      if (storageResult.reason === 'lease_lost') {
        summary.leaseLost += 1;
        logger.warn({}, 'project_deletions.lease_lost_during_storage');
      } else {
        summary.storageFailed += 1;
        logger.warn({ reason: storageResult.reason }, 'project_deletions.storage_purge_failed');
      }
      continue;
    }
    summary.storagePurged += 1;

    let finalResult;
    try {
      finalResult = await finalizeProjectDeletion(pool, jobId, leaseToken);
    } catch (err) {
      summary.blocked += 1;
      logger.warn({ err: { name: err.name, message: err.message } }, 'project_deletions.finalize_error');
      continue;
    }
    if (finalResult.ok) {
      if (finalResult.code === 'ALREADY_COMPLETED') {
        summary.alreadyCompleted += 1;
      } else {
        summary.projectsDeleted += 1;
        logger.info({}, 'project_deletions.project_deleted');
      }
    } else if (finalResult.code === 'LEASE_LOST') {
      summary.leaseLost += 1;
      logger.warn({}, 'project_deletions.lease_lost_during_finalize');
    } else {
      summary.blocked += 1;
      logger.warn({ code: finalResult.code }, 'project_deletions.finalize_blocked');
    }
  }

  logger.info({ summary }, 'project_deletions.completed');
  return summary;
}
