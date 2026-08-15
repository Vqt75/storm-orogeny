import { loadConfig } from './config/env.js';
import { logger } from './logger.js';
import { createApp } from './http/app.js';
import { getPool } from './db/pool.js';
import { createStorageAdapter } from './adapters/storage/index.js';

const config = loadConfig();
const pool = getPool(config);
const storageAdapter = createStorageAdapter(config);
const app = createApp({ logger, pool, config, storageAdapter });

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.nodeEnv }, 'Storm Orogeny — serveur démarré');
});

function shutdown(signal) {
  logger.info({ signal }, 'Arrêt du serveur demandé');
  server.close(() => process.exit(0));
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
