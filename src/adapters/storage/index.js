import { createLocalStorageAdapter } from './local.js';
import { createPostgresStorageAdapter } from './postgres.js';
import { getPool } from '../../db/pool.js';

// One selection point for every upload, public read and privacy worker.
export function createStorageAdapter(config) {
  const driver = config.storage.driver ?? (config.isProduction ? 'postgres' : 'local');
  if (driver === 'postgres') return createPostgresStorageAdapter({ pool: getPool(config) });
  if (driver !== 'local') throw new Error('Unsupported STORAGE_DRIVER');
  if (config.isProduction) throw new Error('Local asset storage is not allowed in production');
  return createLocalStorageAdapter({ baseDir: config.storage.localDir });
}
