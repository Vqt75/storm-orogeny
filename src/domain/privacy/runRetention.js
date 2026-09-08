// Point d'entrée exécutable du retention runner -- Privacy & Data
// Lifecycle V1, Batch 2. Une exécution = une passe, jamais une
// boucle, jamais de scheduler intégré. La DSI planifiera
// l'exécution quotidienne de `npm run retention:run` -- ce script ne
// décide jamais lui-même de "demain". N'exige aucun utilisateur, ne
// démarre aucun serveur HTTP.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../../config/env.js';
import { getPool, closePool } from '../../db/pool.js';
import { logger } from '../../logger.js';
import { runRetentionPolicies } from './retentionRunner.js';

export async function runRetentionCli() {
  const config = loadConfig();
  const pool = getPool(config);
  try {
    return await runRetentionPolicies(pool, { logger });
  } finally {
    // Rien d'autre à nettoyer ici -- la fermeture du pool reste la
    // responsabilité du point d'entrée process (isMain ci-dessous),
    // jamais de cette fonction exportée elle-même (réutilisable par
    // d'autres appelants qui géreraient leur propre pool).
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  runRetentionCli()
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch(err => {
      logger.error({ err: { name: err.name, message: err.message } }, 'retention.failed');
      closePool().finally(() => process.exit(1));
    });
}
