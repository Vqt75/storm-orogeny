import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { createApp } from '../src/http/app.js';
import { createStorageAdapter } from '../src/adapters/storage/index.js';

const config = loadConfig();
const pool = getPool(config);
const storageAdapter = createStorageAdapter(config);
const silentLogger = { info() {}, warn() {}, error() {} };

let app, server, baseUrl;

test.before(async () => {
  app = createApp({ logger: silentLogger, pool, config, storageAdapter });
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  server.close();
  await closePool();
});

test('GET /projects/new sert toujours Project Setup, jamais capté par la route Shell paramétrée', async () => {
  const res = await fetch(`${baseUrl}/projects/new`);
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.match(body, /Nouveau projet/);
});

test('GET /projects/:uuid sert le Project Shell', async () => {
  const res = await fetch(`${baseUrl}/projects/00000000-0000-0000-0000-000000000000`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /html/);
  const body = await res.text();
  assert.match(body, /Storm Project Shell/);
});

test('GET /projects/pas-un-uuid -> 404, jamais confondu avec le Shell', async () => {
  const res = await fetch(`${baseUrl}/projects/pas-un-uuid-du-tout`);
  assert.equal(res.status, 404);
});
