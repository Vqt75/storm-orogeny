// Point d'entrée exécutable du sweeper storage_cleanup_backlog --
// Privacy & Data Lifecycle V1, Batch 7. Une exécution = une passe,
// jamais un scheduler intégré. exit 0 même si certaines lignes restent
// failed/retryables (le passage lui-même s'est terminé normalement) --
// exit non-zéro uniquement si l'infrastructure globale (connexion DB,
// config) ne permet pas d'exécuter le runner du tout.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../../config/env.js';
import { getPool, closePool } from '../../db/pool.js';
import { logger } from '../../logger.js';
import { createStorageAdapter } from '../../adapters/storage/index.js';
import { sweepStorageCleanupBacklog } from './storageCleanupSweeper.js';

export async function runStorageCleanupSweepCli() {
  const config = loadConfig();
  const pool = getPool(config);
  const storageAdapter = createStorageAdapter(config);
  return sweepStorageCleanupBacklog(pool, { storageAdapter, logger });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  runStorageCleanupSweepCli()
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch(err => {
      logger.error({ err: { name: err.name, message: err.message } }, 'storage_cleanup_sweep.failed');
      closePool().finally(() => process.exit(1));
    });
}
