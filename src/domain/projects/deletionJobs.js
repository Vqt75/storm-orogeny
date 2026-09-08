// Suppression définitive de projet -- Privacy & Data Lifecycle V1,
// Batch 5. POSE UNIQUEMENT les deux prérequis : demande/annulation
// d'un project_deletion_job avec capture immédiate du manifest
// storage. AUCUNE suppression physique ici -- ni storage.delete()
// exécuté, ni DELETE FROM projects. Le futur Batch 6 exécutera
// réellement les jobs arrivés à purge_after.
//
// Capability : actorUserId requis (action administrative humaine),
// mais l'AUTORISATION elle-même (projects.delete_permanently) reste
// la responsabilité de l'appelant HTTP -- même doctrine que
// disableExternalGroupMapping/userLifecycle : ce module ne revérifie
// jamais une capability déjà vérifiée par requireOrganizationCapability
// en amont (AuthN ≠ Authorization, jamais une seconde définition de la
// même frontière). actorUserId sert uniquement de provenance d'audit.
//
// Lifecycle projet et lifecycle de suppression restent strictement
// orthogonaux (doctrine déjà validée) : ce module ne touche JAMAIS
// projects.status, seul project_deletion_jobs porte l'état de
// suppression. Un projet en cours de suppression reste 'archived'.

import { recordAuditEvent, AuditEventType } from '../audit/auditEvents.js';

export async function requestProjectDeletion(pool, { tenantId, projectId, actorUserId }) {
  if (!actorUserId) {
    return { ok: false, code: 'ACTOR_REQUIRED' };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [project] } = await client.query(
      'select id, status from projects where id = $1 and tenant_id = $2 for update',
      [projectId, tenantId]
    );
    if (!project) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'NOT_FOUND' };
    }
    if (project.status !== 'archived') {
      await client.query('ROLLBACK');
      return { ok: false, code: 'PROJECT_NOT_ARCHIVED' };
    }

    const { rows: [existingActive] } = await client.query(
      `select id from project_deletion_jobs
       where project_id = $1 and cancelled_at is null and db_purge_completed_at is null`,
      [projectId]
    );
    if (existingActive) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'DELETION_ALREADY_REQUESTED' };
    }

    const { rows: [job] } = await client.query(
      `insert into project_deletion_jobs (tenant_id, project_id, requested_by_user_id, purge_after, storage_purge_state)
       values ($1, $2, $3, now() + interval '7 days', 'pending')
       returning id, requested_at, purge_after`,
      [tenantId, projectId, actorUserId]
    );

    const { rows: assets } = await client.query(
      'select storage_key from assets where tenant_id = $1 and project_id = $2',
      [tenantId, projectId]
    );
    for (const asset of assets) {
      await client.query(
        'insert into project_deletion_job_objects (job_id, storage_key) values ($1, $2)',
        [job.id, asset.storage_key]
      );
    }

    await recordAuditEvent(client, {
      eventType: AuditEventType.PROJECT_DELETION_REQUESTED,
      actorUserId,
      targetType: 'project',
      targetId: projectId,
      tenantId,
      projectId
    });

    await client.query('COMMIT');
    return { ok: true, jobId: job.id, purgeAfter: job.purge_after, cancellable: true, manifestObjectCount: assets.length };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function cancelProjectDeletion(pool, { jobId, actorUserId }) {
  if (!actorUserId) {
    return { ok: false, code: 'ACTOR_REQUIRED' };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [job] } = await client.query(
      'select id, project_id, tenant_id, cancelled_at, db_purge_completed_at, storage_purge_state, purge_after from project_deletion_jobs where id = $1 for update',
      [jobId]
    );
    if (!job) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'NOT_FOUND' };
    }
    if (job.cancelled_at) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'ALREADY_CANCELLED' };
    }
    if (job.db_purge_completed_at) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'ALREADY_COMPLETED' };
    }
    if (job.storage_purge_state === 'in_progress' || job.storage_purge_state === 'completed') {
      await client.query('ROLLBACK');
      return { ok: false, code: 'PURGE_ALREADY_STARTED' };
    }
    if (new Date() >= new Date(job.purge_after)) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'PURGE_WINDOW_PASSED' };
    }

    await client.query('update project_deletion_jobs set cancelled_at = now() where id = $1', [jobId]);

    await recordAuditEvent(client, {
      eventType: AuditEventType.PROJECT_DELETION_CANCELLED,
      actorUserId,
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

// Verrou de mutation pendant la grace period -- FERMETURE Batch 5 :
// un simple hasActiveProjectDeletionJob() en pré-check, seul, est
// vulnérable au TOCTOU (check-then-act sans exclusion mutuelle) :
//   upload: check (pas de job) -> deletion request crée le job +
//   capture le manifest (l'asset n'existe pas encore) -> upload
//   persiste l'asset -> fichier orphelin, jamais dans le manifest.
//
// Fermeture réelle : SÉRIALISATION sur la MÊME ligne projects que
// requestProjectDeletion verrouille déjà (SELECT ... FOR UPDATE) --
// exclusion mutuelle réelle entre "créer un asset" et "demander une
// suppression" pour un même projet. Quelle que soit la transaction qui
// acquiert le verrou en premier, l'autre attend son COMMIT/ROLLBACK
// avant de pouvoir lire un état cohérent :
//   - upload gagne la course -> verrouille, re-vérifie (aucun job actif),
//     sauvegarde le fichier PENDANT que le verrou est tenu, insère
//     l'asset, commit -> la demande de suppression suivante voit cet
//     asset et l'inclut dans son manifest.
//   - la demande de suppression gagne la course -> verrouille, crée le
//     job + capture le manifest, commit -> l'upload suivant, en
//     acquérant le verrou à son tour, re-vérifie et trouve le job actif
//     -> refuse AVANT tout storage.save() -- jamais un fichier
//     physique écrit sans ligne asset durable, jamais un orphelin.
//
// `work(client, trackSavedKey)` s'exécute PENDANT que le verrou est
// tenu -- storage.save n'est pas transactionnel avec Postgres, mais
// tenir le verrou de ligne pendant l'écriture fichier est précisément
// ce qui empêche la demande de suppression de "se glisser" entre le
// check et l'écriture.
//
// FERMETURE SUPPLÉMENTAIRE (Batch 5, dernière fermeture) : le verrou
// sur `projects` sérialise correctement les races DB-vs-DB, mais ne
// protège JAMAIS contre une défaillance DB-vs-filesystem -- confirmé
// par audit, jamais déduit du seul verrou. Deux scénarios réels
// restaient ouverts avant cette fermeture :
//   storage.save() réussit -> insertAsset() échoue -> ROLLBACK
//   storage.save() réussit -> COMMIT lui-même échoue
// Dans les deux cas, l'objet physique survit sans ligne assets --
// exactement le trou signalé.
//
// `work` reçoit un second paramètre, `trackSavedKey(storageKey)`, à
// appeler IMMÉDIATEMENT après tout storage.save() réussi, avant toute
// autre mutation DB. Sur échec (work() lève, ou COMMIT échoue), CHAQUE
// storageKey suivie fait l'objet d'une compensation storage.delete()
// immédiate. Si cette compensation échoue à son tour, la storage key
// n'est JAMAIS seulement loguée -- elle est enregistrée durablement
// dans storage_cleanup_backlog (migration 0015), retrouvable et
// retraitable plus tard (le sweeper de retraitement reste un chantier
// ultérieur, hors scope de cette fermeture précise).
// FERMETURE DE PREUVE (dernière fermeture Batch 5) : cette fonction
// prend `pool` -- JAMAIS `client` -- dans sa signature. Elle ne peut
// donc structurellement jamais dépendre de l'état de la transaction
// métier qui vient d'échouer : pool.query() acquiert systématiquement
// une connexion FRAÎCHE, indépendante, jamais celle (potentiellement
// avortée/condamnée, potentiellement déjà perdue) du client
// transactionnel appelant. Exportée pour être testée en isolation
// complète, sans jamais orchestrer un vrai client -- la preuve la plus
// stricte possible que cette frontière est propre par construction,
// pas seulement par comportement observé.
export async function compensateOrphanedStorageKeys(pool, storageAdapter, storageKeys, reason) {
  for (const storageKey of storageKeys) {
    try {
      await storageAdapter.delete(storageKey);
    } catch {
      // La compensation elle-même a échoué -- jamais masqué par un
      // simple log : enregistrement durable, retryable. Si même CETTE
      // écriture échouait (DB totalement injoignable), c'est la
      // limite réelle de ce qui est garantissable sans transaction
      // distribuée -- rien de plus ne peut être fait ici.
      await pool.query(
        "insert into storage_cleanup_backlog (storage_key, reason) values ($1, $2)",
        [storageKey, reason]
      ).catch(() => {});
    }
  }
}

export async function withProjectDeletionGuard(pool, { projectId, work, storageAdapter }) {
  const client = await pool.connect();
  const savedStorageKeys = [];
  let committed = false;
  let workFailed = false;
  try {
    await client.query('BEGIN');

    const { rows: [project] } = await client.query(
      'select id from projects where id = $1 for update',
      [projectId]
    );
    if (!project) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'NOT_FOUND' };
    }

    const { rows: [activeJob] } = await client.query(
      `select id from project_deletion_jobs
       where project_id = $1 and cancelled_at is null and db_purge_completed_at is null`,
      [projectId]
    );
    if (activeJob) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'PROJECT_DELETION_IN_PROGRESS' };
    }

    let result;
    try {
      result = await work(client, (storageKey) => savedStorageKeys.push(storageKey));
    } catch (workErr) {
      // Suivi STRUCTUREL de l'origine de l'échec -- jamais une
      // devinette par code d'erreur (une violation CHECK, par exemple,
      // ne porte ni 23505 ni 23503, mais reste bien un échec DANS
      // work(), jamais au COMMIT). On sait ici, avec certitude, que
      // l'échec provient de work() -- pas d'un COMMIT qui n'a même
      // pas encore été tenté.
      workFailed = true;
      throw workErr;
    }

    await client.query('COMMIT');
    committed = true;
    return { ok: true, result };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Le ROLLBACK lui-même peut échouer si la connexion est déjà
      // perdue -- la compensation storage ci-dessous reste tentée
      // dans tous les cas, jamais conditionnée à la réussite de ce
      // ROLLBACK précis.
    }
    if (!committed && savedStorageKeys.length > 0 && storageAdapter) {
      const reason = workFailed ? 'insert_failed' : 'commit_failed';
      await compensateOrphanedStorageKeys(pool, storageAdapter, savedStorageKeys, reason);
    }
    throw err;
  } finally {
    client.release();
  }
}

// Lecture seule, jamais un verrou -- utile uniquement pour un affichage
// UI informatif ("ce projet est en cours de suppression"), jamais pour
// décider d'autoriser ou refuser une mutation. La décision d'autoriser
// une mutation d'asset passe exclusivement par withProjectDeletionGuard
// ci-dessus, qui seul garantit l'exclusion mutuelle réelle.
export async function hasActiveProjectDeletionJob(pool, projectId) {
  const { rows } = await pool.query(
    `select 1 from project_deletion_jobs
     where project_id = $1 and cancelled_at is null and db_purge_completed_at is null
     limit 1`,
    [projectId]
  );
  return rows.length > 0;
}
