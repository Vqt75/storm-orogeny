import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { createStorageAdapter } from '../src/adapters/storage/index.js';

const config = { ...loadConfig(), storage: { driver: 'postgres' } };
const adapter = () => createStorageAdapter(config);
const keys = new Set();
async function save(body, options) {
  const result = await adapter().save(body, options);
  keys.add(result.storageKey);
  return result.storageKey;
}
test.before(async () => { await runMigrations(); });
test.after(async () => {
  for (const key of keys) await adapter().delete(key);
  await closePool();
});

test('binary bytes survive adapter recreation and database reconnection', async () => {
  const body = Buffer.from([0, 255, 128, 0, 39, 92]);
  const key = await save(body, { extension: 'png' });
  await closePool();
  assert.deepEqual(await adapter().read(key), body);
});
test('physical objects are independent of metadata transaction rollback', async () => {
  const pool = getPool(config), client = await pool.connect();
  try {
    await client.query('begin');
    const key = await save(Buffer.from('durable'));
    await client.query('rollback');
    assert.equal((await adapter().read(key)).toString(), 'durable');
    await adapter().delete(key);
  } finally { client.release(); }
});
test('delete is idempotent and removes physical bytes', async () => {
  const key = await save(Buffer.from('remove'));
  await adapter().delete(key);
  await adapter().delete(key);
  await assert.rejects(adapter().read(key), { code: 'ENOENT' });
});
test('missing physical object does not return fabricated bytes', async () => {
  await assert.rejects(adapter().read('00000000-0000-0000-0000-000000000000.png'), { code: 'ENOENT' });
});
test('payload is bounded and must be binary', async () => {
  for (const payload of ['', Buffer.alloc(0), Buffer.alloc(5242881)]) {
    await assert.rejects(adapter().save(payload), /Invalid storage payload/);
  }
  const key = await save(Buffer.alloc(5242880, 42));
  assert.equal((await adapter().read(key)).length, 5242880);
});
test('keys and extensions reject traversal and injection', async () => {
  for (const key of ['../file', '/file', 'key\\file', "'; delete from assets;--"]) {
    await assert.rejects(adapter().read(key), /Invalid storage key/);
    await assert.rejects(adapter().delete(key), /Invalid storage key/);
  }
  await assert.rejects(adapter().save(Buffer.from('x'), { extension: '../png' }), /Invalid storage extension/);
});
test('same bytes receive distinct immutable storage identities', async () => {
  const a = await save(Buffer.from('same')), b = await save(Buffer.from('same'));
  assert.notEqual(a, b);
  await adapter().delete(a);
  assert.equal((await adapter().read(b)).toString(), 'same');
});
test('database write failure is not acknowledged as a successful upload', async () => {
  const pool = getPool(config);
  const { rows: [role] } = await pool.query('select current_user as name');
  const identifier = `"${role.name.replaceAll('"', '""')}"`;
  await pool.query(`revoke insert on stored_asset_objects from ${identifier}`);
  try { await assert.rejects(adapter().save(Buffer.from('unavailable')), { code: '42501' }); }
  finally { await pool.query(`grant insert on stored_asset_objects to ${identifier}`); }
});
test('production cannot accidentally use ephemeral storage', () => {
  assert.throws(() => createStorageAdapter({ ...config, isProduction: true, storage: { driver: 'local', localDir: '/tmp' } }), /not allowed in production/);
  assert.throws(() => createStorageAdapter({ ...config, storage: { driver: 'unknown' } }), /Unsupported STORAGE_DRIVER/);
});
test('migration runner is idempotent', async () => {
  assert.equal((await runMigrations()).appliedCount, 0);
});
