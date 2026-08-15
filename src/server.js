import { loadConfig } from './config/env.js';
import { logger } from './logger.js';
import { createApp } from './http/app.js';

const config = loadConfig();
const app = createApp({ logger });

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.nodeEnv }, 'Storm Orogeny — serveur démarré');
});

function shutdown(signal) {
  logger.info({ signal }, 'Arrêt du serveur demandé');
  server.close(() => process.exit(0));
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
