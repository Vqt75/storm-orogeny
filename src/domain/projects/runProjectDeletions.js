// Point d'entrée exécutable de l'exécution des project_deletion_jobs
// -- Privacy & Data Lifecycle V1, Batch 6. Une exécution = une passe,
// jamais une boucle, jamais de scheduler intégré. Le futur
// environnement OVH/DSI déclenchera ce runner via cron/job infra.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../../config/env.js';
import { getPool, closePool } from '../../db/pool.js';
import { logger } from '../../logger.js';
import { createStorageAdapter } from '../../adapters/storage/index.js';
import { runProjectDeletions } from './deletionRunner.js';

export async function runProjectDeletionsCli() {
  const config = loadConfig();
  const pool = getPool(config);
  const storageAdapter = createStorageAdapter(config);
  return runProjectDeletions(pool, { storageAdapter, logger });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  runProjectDeletionsCli()
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch(err => {
      logger.error({ err: { name: err.name, message: err.message } }, 'project_deletions.failed');
      closePool().finally(() => process.exit(1));
    });
}
