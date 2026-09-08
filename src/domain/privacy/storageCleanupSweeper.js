// Sweeper storage_cleanup_backlog -- Privacy & Data Lifecycle V1,
// Batch 7. Consomme les lignes créées lorsque la compensation
// immédiate d'un orphan storage (upload, Batch 5) échoue elle-même.
// File technique de nettoyage, jamais de contenu métier -- jamais un
// audit métier par objet, jamais un rescan du storage, jamais une
// suppression par préfixe, jamais une inférence d'owner.
//
// Orthogonal au deletion runner (Batch 6) : project_deletion_job_objects
// est un manifest propre à une suppression de projet, jamais touché
// ici. Ce sweeper ne traite QUE storage_cleanup_backlog, aucun partage
// d'état implicite entre les deux.
//
// Concurrence SANS lease -- délibérément, après audit : chaque ligne
// représente un travail trivial et rapide (un storage.delete() + une
// écriture), tenir le row lock pour toute la durée de son traitement
// est le mécanisme le plus simple et sûr (contrairement au deletion
// runner, dont le manifest par job pouvait être long et nécessitait
// de relâcher le lock entre le claim et le travail réel). SELECT ...
// FOR UPDATE SKIP LOCKED, tenu jusqu'au commit final de CETTE ligne --
// aucun état intermédiaire "claimé mais pas encore traité" ne persiste
// jamais : un crash pendant le traitement fait simplement échouer la
// transaction (rollback automatique à la perte de connexion), la
// ligne redevient trivialement disponible pour le prochain passage,
// sans lease requise.

export async function sweepStorageCleanupBacklog(pool, { storageAdapter, logger, limit = 100 }) {
  const { rows: eligibleIds } = await pool.query(
    `select id from storage_cleanup_backlog
     where cleaned_at is null
     order by created_at
     limit $1`,
    [limit]
  );

  const summary = { eligible: eligibleIds.length, cleaned: 0, failed: 0 };

  for (const { id } of eligibleIds) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: [row] } = await client.query(
        'select id, storage_key from storage_cleanup_backlog where id = $1 and cleaned_at is null for update skip locked',
        [id]
      );
      if (!row) {
        // Déjà pris par un autre worker (SKIP LOCKED) ou déjà nettoyé
        // entre la sélection et cette tentative -- jamais un double
        // traitement, simplement ignoré ici.
        await client.query('ROLLBACK');
        continue;
      }

      try {
        await storageAdapter.delete(row.storage_key);
      } catch {
        // Vraie erreur storage/provider -- jamais renseigner
        // cleaned_at, jamais supprimer la ligne, jamais perdre la
        // storage key. La ligne reste éligible pour le prochain
        // passage. Un échec sur cette ligne ne doit jamais bloquer
        // les autres lignes du même passage -- rollback de CETTE
        // seule transaction, la boucle continue normalement.
        await client.query('ROLLBACK');
        summary.failed += 1;
        continue;
      }

      // Invariant crash-safe : si storage.delete() a réussi mais que
      // CETTE écriture ou le COMMIT échouent, le prochain passage
      // retentera storage.delete() sur cette même clé -- succès
      // garanti par idempotence (objet déjà absent = succès), jamais
      // un travail perdu.
      await client.query('update storage_cleanup_backlog set cleaned_at = now() where id = $1', [id]);
      await client.query('COMMIT');
      summary.cleaned += 1;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      summary.failed += 1;
      logger.warn({}, 'storage_cleanup_sweep.row_error');
    } finally {
      client.release();
    }
  }

  logger.info({ summary }, 'storage_cleanup_sweep.completed');
  return summary;
}
