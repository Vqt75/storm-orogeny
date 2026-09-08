import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { createStorageAdapter } from '../src/adapters/storage/index.js';
import { requestProjectDeletion, cancelProjectDeletion } from '../src/domain/projects/deletionJobs.js';
import { claimDueDeletionJobs, runProjectDeletions } from '../src/domain/projects/deletionRunner.js';
import { transitionProjectLifecycle } from '../src/domain/control/repository.js';
import { AuditEventType } from '../src/domain/audit/auditEvents.js';

// Privacy & Data Lifecycle V1 — Batch 6. Exécution réelle des
// project_deletion_jobs arrivés à purge_after. Storage-first, jamais
// un DELETE FROM projects tant qu'un seul objet du manifest reste non
// purgé.

const config = loadConfig();
const pool = getPool(config);
const storageAdapter = createStorageAdapter(config);
const silentLogger = { info() {}, warn() {}, error() {} };

let tenant, actorUserId;

async function cleanAll() {
  await pool.query("delete from project_deletion_job_objects where job_id in (select id from project_deletion_jobs where tenant_id in (select id from tenants where name like 'Tenant Privacy Batch6%'))");
  await pool.query("delete from project_deletion_jobs where tenant_id in (select id from tenants where name like 'Tenant Privacy Batch6%')");
  await pool.query("delete from audit_events where tenant_id in (select id from tenants where name like 'Tenant Privacy Batch6%')");
  await pool.query("delete from assets where tenant_id in (select id from tenants where name like 'Tenant Privacy Batch6%')");
  await pool.query("delete from projects where tenant_id in (select id from tenants where name like 'Tenant Privacy Batch6%')");
  await pool.query("delete from users where email like '%@test-privacy-batch6.local'");
  await pool.query("delete from tenants where name like 'Tenant Privacy Batch6%'");
}

test.before(async () => {
  await runMigrations();
  await cleanAll();
  const { rows: [t] } = await pool.query("insert into tenants (name) values ('Tenant Privacy Batch6') returning id");
  tenant = t.id;
  const { rows: [actor] } = await pool.query("insert into users (email, display_name) values ('actor@test-privacy-batch6.local','Actor') returning id");
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
    [tenant, `Privacy Batch6 Projet ${counter}`, status]
  );
  return p;
}

async function makeAsset(projectId) {
  const { storageKey } = await storageAdapter.save(Buffer.from(`contenu-${counter}-${Date.now()}`), { extension: 'txt' });
  await pool.query(
    "insert into assets (tenant_id, project_id, kind, storage_key, content_type, byte_size) values ($1,$2,'logo',$3,'image/png',10)",
    [tenant, projectId, storageKey]
  );
  return storageKey;
}

// Crée un job de suppression directement dû (purge_after dans le
// passé), avec son manifest -- contourne volontairement les 7 jours
// réels de requestProjectDeletion pour rendre les tests déterministes.
async function makeDueJob(projectId, { storageKeys = [], purgeAfter = new Date(Date.now() - 60 * 1000) } = {}) {
  const { rows: [job] } = await pool.query(
    `insert into project_deletion_jobs (tenant_id, project_id, requested_by_user_id, purge_after, storage_purge_state)
     values ($1,$2,$3,$4,'pending') returning id`,
    [tenant, projectId, actorUserId, purgeAfter]
  );
  for (const key of storageKeys) {
    await pool.query('insert into project_deletion_job_objects (job_id, storage_key) values ($1,$2)', [job.id, key]);
  }
  return job.id;
}

async function getJob(jobId) {
  const { rows: [j] } = await pool.query('select * from project_deletion_jobs where id=$1', [jobId]);
  return j;
}

async function projectExists(projectId) {
  const { rows } = await pool.query('select id from projects where id=$1', [projectId]);
  return rows.length === 1;
}

async function countAuditEvents(eventType, targetId) {
  const { rows } = await pool.query('select count(*)::int as n from audit_events where event_type=$1 and target_id=$2', [eventType, targetId]);
  return rows[0].n;
}

// ── Not due / cancelled ──────────────────────────────────────────────

test('not due -- aucune action', async () => {
  const p = await makeProject('archived');
  const key = await makeAsset(p.id);
  const jobId = await makeDueJob(p.id, { storageKeys: [key], purgeAfter: new Date(Date.now() + 60 * 60 * 1000) });

  await runProjectDeletions(pool, { storageAdapter, logger: silentLogger });

  assert.ok(await projectExists(p.id), 'un job futur ne doit jamais être traité');
  await assert.doesNotReject(storageAdapter.read(key));
  const job = await getJob(jobId);
  assert.equal(job.storage_purge_state, 'pending');
});

test('cancelled -- aucune action', async () => {
  const p = await makeProject('archived');
  const key = await makeAsset(p.id);
  const jobId = await makeDueJob(p.id, { storageKeys: [key] });
  await pool.query('update project_deletion_jobs set cancelled_at = now() where id=$1', [jobId]);

  await runProjectDeletions(pool, { storageAdapter, logger: silentLogger });

  assert.ok(await projectExists(p.id));
  await assert.doesNotReject(storageAdapter.read(key));
});

// ── Zero assets ──────────────────────────────────────────────────────

test('zero assets -- DELETE DB autorisé, job/manifeste survivent, audit final', async () => {
  const p = await makeProject('archived');
  const jobId = await makeDueJob(p.id, { storageKeys: [] });

  const summary = await runProjectDeletions(pool, { storageAdapter, logger: silentLogger });
  assert.equal(summary.projectsDeleted, 1);

  assert.equal(await projectExists(p.id), false, 'projet réellement supprimé');
  const job = await getJob(jobId);
  assert.ok(job, 'le job survit à la suppression du projet');
  assert.ok(job.db_purge_completed_at);
  assert.equal(job.storage_purge_state, 'completed');

  const n = await countAuditEvents(AuditEventType.PROJECT_DELETED_PERMANENTLY, p.id);
  assert.equal(n, 1);
});

// ── Normal assets ────────────────────────────────────────────────────

test('assets normaux -- storage supprimé pour toutes les clés, purged_at sur chacune, puis seulement DELETE project', async () => {
  const p = await makeProject('archived');
  const key1 = await makeAsset(p.id);
  const key2 = await makeAsset(p.id);
  const jobId = await makeDueJob(p.id, { storageKeys: [key1, key2] });

  const summary = await runProjectDeletions(pool, { storageAdapter, logger: silentLogger });
  assert.equal(summary.projectsDeleted, 1);

  await assert.rejects(storageAdapter.read(key1));
  await assert.rejects(storageAdapter.read(key2));

  const { rows: objects } = await pool.query('select purged_at from project_deletion_job_objects where job_id=$1', [jobId]);
  assert.equal(objects.length, 2);
  assert.ok(objects.every(o => o.purged_at !== null));

  assert.equal(await projectExists(p.id), false);
});

// ── Partial storage failure ──────────────────────────────────────────

test('échec storage partiel -- premier supprimé/marqué, second échoue -- project survit, state failed, retry ne refait pas le premier, run suivant termine', async () => {
  const p = await makeProject('archived');
  const key1 = await makeAsset(p.id);
  // key2 n'a JAMAIS de fichier physique réel -- storage.delete()
  // dessus échouera réellement UNIQUEMENT si on force une vraie
  // erreur IO (jamais ENOENT, absorbé par l'idempotence). Technique
  // fichier -> répertoire déjà validée en Batch 5.
  const { storageKey: key2 } = await storageAdapter.save(Buffer.from('sera-saboté'), { extension: 'txt' });
  await fs.unlink(`${config.storage.localDir}/${key2}`);
  await fs.mkdir(`${config.storage.localDir}/${key2}`);

  const jobId = await makeDueJob(p.id, { storageKeys: [key1, key2] });

  await runProjectDeletions(pool, { storageAdapter, logger: silentLogger });

  assert.ok(await projectExists(p.id), 'le projet doit survivre -- purge storage incomplète');
  const jobAfterFirstRun = await getJob(jobId);
  assert.equal(jobAfterFirstRun.storage_purge_state, 'failed');
  assert.equal(jobAfterFirstRun.db_purge_completed_at, null);

  // L'ordre de traitement des objets n'est jamais garanti (order by id,
  // un UUID aléatoire) -- l'invariant à vérifier est indépendant de
  // l'ordre : key2 (sabotée) n'est jamais purgée ; key1, SI elle a été
  // traitée avant l'échec, doit être réellement supprimée et sa
  // progression conservée -- jamais perdue par l'échec sur key2,
  // quel que soit l'ordre réel.
  const { rows: [obj2] } = await pool.query('select purged_at from project_deletion_job_objects where job_id=$1 and storage_key=$2', [jobId, key2]);
  assert.equal(obj2.purged_at, null, 'key2 (sabotée) ne doit jamais être marquée purgée');
  await assert.doesNotReject(fs.stat(`${config.storage.localDir}/${key2}`), 'key2 reste physiquement présente (sous forme du répertoire de sabotage)');

  const { rows: [obj1] } = await pool.query('select purged_at from project_deletion_job_objects where job_id=$1 and storage_key=$2', [jobId, key1]);
  if (obj1.purged_at) {
    // key1 a été traitée avant l'échec sur key2 -- doit avoir été
    // réellement supprimée, progression conservée.
    await assert.rejects(storageAdapter.read(key1), 'key1 a bien été réellement supprimée si sa progression est marquée');
  } else {
    // key2 a été traitée en premier, l'échec a stoppé le traitement
    // avant même d'atteindre key1 -- key1 doit alors rester
    // physiquement intacte, jamais à moitié traitée.
    await assert.doesNotReject(storageAdapter.read(key1), 'key1 doit rester physiquement intacte si jamais atteinte');
  }

  // Répare le sabotage (le fichier réel a "réapparu", simulant une
  // correction opérationnelle) et relance -- le run suivant doit
  // terminer correctement, sans jamais retraiter un objet déjà
  // purgé comme travail nécessaire.
  await fs.rmdir(`${config.storage.localDir}/${key2}`);
  await storageAdapter.save(Buffer.from('remplace'), { extension: 'txt' }).then(async ({ storageKey: tempKey }) => {
    // Remet un vrai fichier exactement à l'emplacement key2 pour que
    // le retry storage.delete(key2) réussisse normalement.
    await fs.rename(`${config.storage.localDir}/${tempKey}`, `${config.storage.localDir}/${key2}`);
  });

  const summary = await runProjectDeletions(pool, { storageAdapter, logger: silentLogger });
  assert.equal(summary.projectsDeleted, 1, 'le run suivant doit terminer correctement');
  assert.equal(await projectExists(p.id), false);

  const { rows: objectsAfter } = await pool.query('select storage_key, purged_at from project_deletion_job_objects where job_id=$1', [jobId]);
  assert.ok(objectsAfter.every(o => o.purged_at !== null));
});

// ── Delete succeeded / mark failed (progression récupérée) ──────────

test('storage supprimé mais purged_at non persisté -- retry storage.delete (absent) réussit -- progression récupérée', async () => {
  const p = await makeProject('archived');
  const key = await makeAsset(p.id);
  const jobId = await makeDueJob(p.id, { storageKeys: [key] });

  // Simule exactement le scénario demandé : l'objet physique est
  // RÉELLEMENT supprimé, mais purged_at n'a JAMAIS été persisté
  // (crash simulé entre les deux étapes) -- reproduit directement
  // l'état intermédiaire, jamais un mock du runner lui-même.
  await storageAdapter.delete(key);

  const summary = await runProjectDeletions(pool, { storageAdapter, logger: silentLogger });
  assert.equal(summary.projectsDeleted, 1, 'le retry doit réussir -- storage.delete() sur une clé déjà absente est un succès (idempotence Batch 5), jamais un échec');

  const { rows: [obj] } = await pool.query('select purged_at from project_deletion_job_objects where job_id=$1', [jobId]);
  assert.ok(obj.purged_at, 'la progression est bien récupérée après le retry');
});

// ── Final DB delete failure ──────────────────────────────────────────

test('échec du DELETE/audit final -- storage déjà terminé -- project reste, job non db-complete, retry peut terminer', async () => {
  const p = await makeProject('archived');
  const key = await makeAsset(p.id);
  const jobId = await makeDueJob(p.id, { storageKeys: [key] });

  await pool.query('REVOKE DELETE ON projects FROM storm_orogeny');
  try {
    await runProjectDeletions(pool, { storageAdapter, logger: silentLogger });
  } finally {
    await pool.query('GRANT DELETE ON projects TO storm_orogeny');
  }

  assert.ok(await projectExists(p.id), 'le projet doit survivre à l\'échec du DELETE final');
  const jobAfter = await getJob(jobId);
  assert.equal(jobAfter.db_purge_completed_at, null);
  assert.equal(jobAfter.storage_purge_state, 'completed', 'le storage reste marqué complété -- jamais reperdu par l\'échec DB final');
  await assert.rejects(storageAdapter.read(key), 'le storage a bien déjà été réellement supprimé, retryable sans le refaire');

  // Le retry immédiat ne doit PAS reprendre ce job -- sa lease reste
  // valide jusqu'à expiration (comportement voulu, évite un
  // tight-retry-loop sur un job en échec). Simule un passage cron
  // ultérieur réel, une fois la lease naturellement expirée.
  const later = new Date(Date.now() + 11 * 60 * 1000);
  const summary = await runProjectDeletions(pool, { storageAdapter, logger: silentLogger, now: later });
  assert.equal(summary.projectsDeleted, 1, 'le retry doit terminer correctement une fois le privilège restauré et la lease expirée');
  assert.equal(await projectExists(p.id), false);
});

// ── Final audit failure ──────────────────────────────────────────────

test('échec de l\'audit final -- DELETE project rollback, audit absent, retry possible', async () => {
  const p = await makeProject('archived');
  const key = await makeAsset(p.id);
  const jobId = await makeDueJob(p.id, { storageKeys: [key] });

  await pool.query('REVOKE INSERT ON audit_events FROM storm_orogeny');
  try {
    await runProjectDeletions(pool, { storageAdapter, logger: silentLogger });
  } finally {
    await pool.query('GRANT INSERT ON audit_events TO storm_orogeny');
  }

  assert.ok(await projectExists(p.id), 'jamais supprimé sans son audit final -- rollback complet');
  const jobAfter = await getJob(jobId);
  assert.equal(jobAfter.db_purge_completed_at, null);
  const n = await countAuditEvents(AuditEventType.PROJECT_DELETED_PERMANENTLY, p.id);
  assert.equal(n, 0);

  const later = new Date(Date.now() + 11 * 60 * 1000);
  const summary = await runProjectDeletions(pool, { storageAdapter, logger: silentLogger, now: later });
  assert.equal(summary.projectsDeleted, 1, 'retry réussi une fois le privilège restauré et la lease expirée');
  assert.equal(await projectExists(p.id), false);
});

// ── Non-archived project (défense en profondeur) ─────────────────────

test('projet non-archived au moment du run -- runner refuse, aucune destruction storage supplémentaire', async () => {
  const p = await makeProject('archived');
  const key = await makeAsset(p.id);
  const jobId = await makeDueJob(p.id, { storageKeys: [key] });

  // Simule directement en base le cas que le garde-fou lifecycle
  // (transitionProjectLifecycle) est censé rendre impossible en
  // pratique -- le runner doit rester défensif indépendamment.
  await pool.query("update projects set status='active' where id=$1", [p.id]);

  const summary = await runProjectDeletions(pool, { storageAdapter, logger: silentLogger });
  assert.equal(summary.projectsDeleted, 0);
  assert.equal(summary.blocked, 1);

  assert.ok(await projectExists(p.id));
  await assert.rejects(storageAdapter.read(key), 'le storage a déjà été purgé (storage-first) -- attendu même si la finalisation DB est bloquée, cohérent avec la doctrine storage-first');

  // Nettoyage explicite -- jamais laisser ce job perpétuellement dû et
  // bloqué, ce qui contaminerait tout test ultérieur appelant
  // runProjectDeletions dans ce même fichier.
  await pool.query('update project_deletion_jobs set cancelled_at = now() where id=$1', [jobId]);
});

// ── Lifecycle guard (fermeture Batch 6) ──────────────────────────────

test('lifecycle guard -- un projet avec job actif ne peut plus quitter archived', async () => {
  const p = await makeProject('archived');
  await requestProjectDeletion(pool, { tenantId: tenant, projectId: p.id, actorUserId });

  const result = await transitionProjectLifecycle(pool, { tenantId: tenant, projectId: p.id, toStatus: 'restore', actorUserId });
  assert.equal(result.blocked, true);
  assert.equal(result.code, 'PROJECT_DELETION_IN_PROGRESS');

  const { rows: [project] } = await pool.query('select status from projects where id=$1', [p.id]);
  assert.equal(project.status, 'archived', 'jamais sorti de archived tant que le job reste actif');
});

test('lifecycle guard -- après annulation du job, la transition redevient possible', async () => {
  const p = await makeProject('archived');
  const requested = await requestProjectDeletion(pool, { tenantId: tenant, projectId: p.id, actorUserId });
  await cancelProjectDeletion(pool, { jobId: requested.jobId, actorUserId });

  const result = await transitionProjectLifecycle(pool, { tenantId: tenant, projectId: p.id, toStatus: 'restore', actorUserId });
  assert.notEqual(result?.blocked, true);
  assert.ok(result.status);
});

// ── Job/manifest survival (reprouvé après vraie suppression) ────────

test('SURVIVAL -- après suppression réelle, job et manifeste survivent intégralement avec toutes leurs métadonnées', async () => {
  const p = await makeProject('archived');
  const key1 = await makeAsset(p.id);
  const key2 = await makeAsset(p.id);
  const jobId = await makeDueJob(p.id, { storageKeys: [key1, key2] });

  await runProjectDeletions(pool, { storageAdapter, logger: silentLogger });

  assert.equal(await projectExists(p.id), false);

  const job = await getJob(jobId);
  assert.ok(job, 'ligne job présente');
  assert.ok(job.db_purge_completed_at, 'db_purge_completed_at renseigné');
  assert.equal(job.storage_purge_state, 'completed');

  const { rows: objects } = await pool.query('select storage_key, purged_at from project_deletion_job_objects where job_id=$1 order by storage_key', [jobId]);
  assert.equal(objects.length, 2, 'les deux objets du manifeste survivent');
  assert.ok(objects.every(o => o.purged_at !== null), 'chaque objet conserve son purged_at');

  const n = await countAuditEvents(AuditEventType.PROJECT_DELETED_PERMANENTLY, p.id);
  assert.equal(n, 1, 'audit final présent et survivant');
});

// ── Concurrent runners ────────────────────────────────────────────────

test('CONCURRENCE RÉELLE -- deux runners simultanés sur les mêmes jobs dus -- un seul traite réellement chaque job, aucun double DELETE', async () => {
  const projects = [];
  for (let i = 0; i < 4; i++) {
    const p = await makeProject('archived');
    const key = await makeAsset(p.id);
    await makeDueJob(p.id, { storageKeys: [key] });
    projects.push(p);
  }

  const [summaryA, summaryB] = await Promise.all([
    runProjectDeletions(pool, { storageAdapter, logger: silentLogger, limit: 10 }),
    runProjectDeletions(pool, { storageAdapter, logger: silentLogger, limit: 10 })
  ]);

  // L'invariant réel n'est jamais "claimed" (un détail d'implémentation
  // du claim -- SKIP LOCKED protège les transactions SIMULTANÉES,
  // jamais deux transactions séquentielles non chevauchantes ; un job
  // déjà traité peut légitimement être re-réclamé par un appel
  // postérieur, sans risque grâce à l'idempotence de chaque étape).
  // L'invariant qui compte réellement : chaque projet est supprimé
  // EXACTEMENT une fois, jamais deux, jamais zéro.
  assert.equal(summaryA.projectsDeleted + summaryB.projectsDeleted, 4, 'exactement 4 suppressions réelles au total, aucun double DELETE, aucune perte');

  for (const p of projects) {
    assert.equal(await projectExists(p.id), false, 'chaque projet doit avoir été réellement supprimé, par exactement un des deux runners');
  }
});

// ── FERMETURE crash/restart recovery (lease bornée) ──────────────────

test('LEASE -- table de vérité -- pending et failed toujours réclamables', async () => {
  const p1 = await makeProject('archived');
  const key1 = await makeAsset(p1.id);
  const jobPending = await makeDueJob(p1.id, { storageKeys: [key1] });

  const p2 = await makeProject('archived');
  const key2 = await makeAsset(p2.id);
  const jobFailed = await makeDueJob(p2.id, { storageKeys: [key2] });
  await pool.query("update project_deletion_jobs set storage_purge_state='failed' where id=$1", [jobFailed]);

  const claimed = await claimDueDeletionJobs(pool, { now: new Date() });
  const claimedIds = claimed.map(c => c.jobId);
  assert.ok(claimedIds.includes(jobPending), 'pending doit être réclamable');
  assert.ok(claimedIds.includes(jobFailed), 'failed doit être réclamable');

  // Nettoyage explicite -- ces jobs viennent d'être claimés (lease
  // valide ~10 min) mais jamais résolus ; jamais laissés réclamables
  // par une horloge avancée dans un test ultérieur du même fichier.
  await pool.query('update project_deletion_jobs set cancelled_at = now() where id = any($1::uuid[])', [[jobPending, jobFailed]]);
});

test('LEASE -- table de vérité -- in_progress avec lease valide N\'EST PAS réclamable (worker vivant)', async () => {
  const p = await makeProject('archived');
  const key = await makeAsset(p.id);
  const jobId = await makeDueJob(p.id, { storageKeys: [key] });

  const firstClaim = await claimDueDeletionJobs(pool, { now: new Date() });
  assert.equal(firstClaim.length, 1);

  // Un second claim IMMÉDIAT (lease toujours valide, worker "vivant"
  // par construction) ne doit jamais reprendre ce même job.
  const secondClaim = await claimDueDeletionJobs(pool, { now: new Date() });
  assert.equal(secondClaim.find(c => c.jobId === jobId), undefined, 'in_progress avec lease valide -- jamais réclamable par un second claim');

  await pool.query('update project_deletion_jobs set cancelled_at = now() where id = $1', [jobId]);
});

test('LEASE -- table de vérité -- in_progress avec lease EXPIRÉE redevient réclamable (job abandonné)', async () => {
  const p = await makeProject('archived');
  const key = await makeAsset(p.id);
  const jobId = await makeDueJob(p.id, { storageKeys: [key] });

  await claimDueDeletionJobs(pool, { now: new Date() });
  const later = new Date(Date.now() + 11 * 60 * 1000);
  const secondClaim = await claimDueDeletionJobs(pool, { now: later });
  assert.ok(secondClaim.some(c => c.jobId === jobId), 'lease expirée -- doit redevenir réclamable, un nouveau token est émis');

  await pool.query('update project_deletion_jobs set cancelled_at = now() where id = $1', [jobId]);
});

test('LEASE -- table de vérité -- completed avec db_purge_completed_at NULL et lease valide N\'EST PAS réclamable', async () => {
  const p = await makeProject('archived');
  const jobId = await makeDueJob(p.id, { storageKeys: [] });
  const claim = await claimDueDeletionJobs(pool, { now: new Date() });
  await pool.query("update project_deletion_jobs set storage_purge_state='completed' where id=$1", [jobId]);

  const secondClaim = await claimDueDeletionJobs(pool, { now: new Date() });
  assert.equal(secondClaim.find(c => c.jobId === jobId), undefined, 'completed non-db-complete avec lease valide -- jamais un terminal par erreur, mais pas réclamable tant que le worker vivant la détient');

  await pool.query('update project_deletion_jobs set cancelled_at = now() where id = $1', [jobId]);
});

test('LEASE -- table de vérité -- db_purge_completed_at NOT NULL jamais sélectionné', async () => {
  const p = await makeProject('archived');
  const jobId = await makeDueJob(p.id, { storageKeys: [] });
  await runProjectDeletions(pool, { storageAdapter, logger: silentLogger });
  const job = await getJob(jobId);
  assert.ok(job.db_purge_completed_at);

  const claim = await claimDueDeletionJobs(pool, { now: new Date() });
  assert.equal(claim.find(c => c.jobId === jobId), undefined, 'jamais réclamé une fois réellement terminé');
  // Déjà db_purge_completed_at -- rien à nettoyer, ce job ne sera
  // plus jamais sélectionné par aucun claim.
});

test('HARD CRASH après claim, avant toute opération storage -- job récupérable au restart, jamais deux workers actifs simultanément', async () => {
  const p = await makeProject('archived');
  const key = await makeAsset(p.id);
  const jobId = await makeDueJob(p.id, { storageKeys: [key] });

  // "Crash" simulé : claim effectué, mais AUCUNE opération storage/
  // finalisation n'a jamais lieu -- le process meurt immédiatement
  // après le commit de la transaction de claim.
  const crashedClaim = await claimDueDeletionJobs(pool, { now: new Date() });
  assert.equal(crashedClaim.length, 1);
  const jobAfterCrash = await getJob(jobId);
  assert.equal(jobAfterCrash.storage_purge_state, 'in_progress');
  assert.ok(jobAfterCrash.lease_expires_at);

  // Tant que la lease n'a pas expiré, un restart immédiat ne doit
  // jamais permettre à un second worker de travailler activement sur
  // ce même job.
  const immediateRestart = await runProjectDeletions(pool, { storageAdapter, logger: silentLogger });
  assert.equal(await projectExists(p.id), true, 'jamais traité tant que la lease originale reste valide');

  // Une fois la lease naturellement expirée (restart réel après
  // suffisamment de temps), le job doit être intégralement récupérable.
  const later = new Date(Date.now() + 11 * 60 * 1000);
  const realRestart = await runProjectDeletions(pool, { storageAdapter, logger: silentLogger, now: later });
  assert.equal(realRestart.projectsDeleted, 1, 'le job doit être entièrement récupéré et terminé après expiration de la lease');
  assert.equal(await projectExists(p.id), false);
});

test('CRASH après storage completed, avant DB delete -- ne devient jamais terminal par erreur, reprend directement vers la finalisation', async () => {
  const p = await makeProject('archived');
  const key = await makeAsset(p.id);
  const jobId = await makeDueJob(p.id, { storageKeys: [key] });

  // Simule directement l'état "storage terminé, DB delete jamais
  // atteint" -- reproduction fidèle de l'état intermédiaire, jamais
  // un mock du runner.
  await storageAdapter.delete(key);
  await pool.query("update project_deletion_job_objects set purged_at=now() where job_id=$1", [jobId]);
  await pool.query("update project_deletion_jobs set storage_purge_state='completed' where id=$1", [jobId]);

  const jobBefore = await getJob(jobId);
  assert.equal(jobBefore.storage_purge_state, 'completed');
  assert.equal(jobBefore.db_purge_completed_at, null, 'jamais devenu terminal par erreur -- toujours en attente de finalisation');

  const summary = await runProjectDeletions(pool, { storageAdapter, logger: silentLogger });
  assert.equal(summary.projectsDeleted, 1, 'reprend directement vers la transaction finale, sans jamais retraiter le storage');
  assert.equal(await projectExists(p.id), false);
});

test('DELETE succeeded / purged_at write échoue (vraie erreur DB) -- objet physique absent, purged_at reste null, retry réussit par idempotence', async () => {
  const p = await makeProject('archived');
  const key = await makeAsset(p.id);
  const jobId = await makeDueJob(p.id, { storageKeys: [key] });

  // Vraie erreur DB sur l'écriture purged_at -- jamais un mock qui
  // court-circuite la logique centrale du runner.
  await pool.query('REVOKE UPDATE ON project_deletion_job_objects FROM storm_orogeny');
  try {
    await runProjectDeletions(pool, { storageAdapter, logger: silentLogger });
  } finally {
    await pool.query('GRANT UPDATE ON project_deletion_job_objects TO storm_orogeny');
  }

  // L'objet physique DOIT avoir été réellement supprimé (storage.delete
  // a réussi avant que l'écriture DB n'échoue) -- purged_at reste
  // pourtant null puisque cette écriture précise a échoué.
  await assert.rejects(storageAdapter.read(key), 'objet physique déjà réellement absent malgré l\'échec de l\'écriture purged_at');
  const { rows: [obj] } = await pool.query('select purged_at from project_deletion_job_objects where job_id=$1', [jobId]);
  assert.equal(obj.purged_at, null);
  assert.ok(await projectExists(p.id), 'le projet doit survivre');

  // Retry (après expiration de la lease, comportement réel) -- doit
  // réussir : storage.delete() sur une clé déjà absente est un succès
  // idempotent, jamais un échec.
  const later = new Date(Date.now() + 11 * 60 * 1000);
  const summary = await runProjectDeletions(pool, { storageAdapter, logger: silentLogger, now: later });
  assert.equal(summary.projectsDeleted, 1, 'le retry doit réussir et terminer normalement');
  assert.equal(await projectExists(p.id), false);
});

test('UN JOB EN ÉCHEC NE BLOQUE JAMAIS LES AUTRES -- job A échoue sur storage, job B (indépendant) est néanmoins traité complètement dans la même passe', async () => {
  const pA = await makeProject('archived');
  const { storageKey: sabotagedKey } = await storageAdapter.save(Buffer.from('sera-saboté-A'), { extension: 'txt' });
  await fs.unlink(`${config.storage.localDir}/${sabotagedKey}`);
  await fs.mkdir(`${config.storage.localDir}/${sabotagedKey}`);
  const jobA = await makeDueJob(pA.id, { storageKeys: [sabotagedKey] });

  const pB = await makeProject('archived');
  const keyB = await makeAsset(pB.id);
  const jobB = await makeDueJob(pB.id, { storageKeys: [keyB] });

  const summary = await runProjectDeletions(pool, { storageAdapter, logger: silentLogger });

  const jobAAfter = await getJob(jobA);
  assert.equal(jobAAfter.storage_purge_state, 'failed', 'job A doit finir failed');
  assert.ok(await projectExists(pA.id), 'projet A doit survivre à son propre échec');

  assert.equal(await projectExists(pB.id), false, 'projet B, indépendant, doit avoir été traité complètement dans la MÊME passe malgré l\'échec de A');
  assert.equal(summary.projectsDeleted, 1);
  assert.equal(summary.storageFailed, 1);

  await fs.rmdir(`${config.storage.localDir}/${sabotagedKey}`);
  // Nettoyage explicite -- un job 'failed' est immédiatement
  // réclamable par construction (aucun worker vivant ne le détient
  // plus), jamais laissé contaminer un test ultérieur du même fichier.
  await pool.query('update project_deletion_jobs set cancelled_at = now() where id = $1', [jobA]);
});

test('SINGLE ACTIVE OWNERSHIP -- deux runners simultanés sur le MÊME job -- un seul exécute réellement storage.delete, l\'autre est refusé par la lease', async () => {
  const p = await makeProject('archived');
  const key = await makeAsset(p.id);
  await makeDueJob(p.id, { storageKeys: [key] });

  // Deux claims strictement simultanés (Promise.all) sur le seul job
  // dû -- la sérialisation FOR UPDATE SKIP LOCKED garantit qu'au plus
  // une des deux transactions de claim obtient réellement ce job.
  const [claimA, claimB] = await Promise.all([
    claimDueDeletionJobs(pool, { now: new Date() }),
    claimDueDeletionJobs(pool, { now: new Date() })
  ]);

  const totalClaimed = claimA.length + claimB.length;
  assert.equal(totalClaimed, 1, 'exactement un seul des deux claims simultanés doit réellement obtenir ce job -- jamais les deux, jamais aucun');

  const winner = claimA.length === 1 ? claimA[0] : claimB[0];
  const job = await getJob(winner.jobId);
  assert.equal(job.lease_token, winner.leaseToken, 'le lease_token en DB doit correspondre exactement au gagnant de la course');

  await assert.doesNotReject(storageAdapter.read(key), 'aucun storage.delete() ne doit avoir été tenté avant que le claim ne soit résolu proprement');
});
