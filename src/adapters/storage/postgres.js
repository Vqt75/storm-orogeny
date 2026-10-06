import { randomUUID } from 'node:crypto';

const MAX_BYTES = 5 * 1024 * 1024;

function assertSafeKey(key) {
  if (typeof key !== 'string' || !/^[0-9a-f-]{36}(\.[a-z0-9]{1,10})?$/.test(key)) {
    throw new Error('Invalid storage key');
  }
}

// Use the pool, never the caller's content transaction: physical storage and
// metadata retain the existing compensation/retry boundary.
export function createPostgresStorageAdapter({ pool }) {
  return {
    async save(buffer, { extension } = {}) {
      if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > MAX_BYTES) {
        throw new Error('Invalid storage payload (1 byte to 5 MiB required)');
      }
      if (extension !== undefined && !/^[a-z0-9]{1,10}$/.test(extension)) {
        throw new Error('Invalid storage extension');
      }
      const storageKey = `${randomUUID()}${extension ? `.${extension}` : ''}`;
      await pool.query('insert into stored_asset_objects (storage_key, body) values ($1, $2)', [storageKey, buffer]);
      return { storageKey };
    },
    async read(storageKey) {
      assertSafeKey(storageKey);
      const { rows } = await pool.query('select body from stored_asset_objects where storage_key = $1', [storageKey]);
      if (!rows.length) {
        const error = new Error('Storage object not found');
        error.code = 'ENOENT';
        throw error;
      }
      return rows[0].body;
    },
    async delete(storageKey) {
      assertSafeKey(storageKey);
      await pool.query('delete from stored_asset_objects where storage_key = $1', [storageKey]);
    }
  };
}
