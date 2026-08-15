import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../src/http/app.js';

// Logger silencieux pour les tests — on ne veut pas polluer la sortie
// des tests avec les logs applicatifs, mais on garde une vraie
// implémentation (pas un mock qui masquerait un vrai bug de forme).
const silentLogger = { info() {}, warn() {}, error() {} };

function startTestServer() {
  const app = createApp({ logger: silentLogger });
  const server = http.createServer(app);
  return new Promise(resolve => {
    server.listen(0, () => resolve(server));
  });
}

function baseUrl(server) {
  return `http://127.0.0.1:${server.address().port}`;
}

test('GET /health répond 200 avec un statut healthy', async () => {
  const server = await startTestServer();
  try {
    const res = await fetch(`${baseUrl(server)}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.status, 'healthy');
  } finally {
    server.close();
  }
});

test('une route inexistante répond 404 avec une erreur structurée', async () => {
  const server = await startTestServer();
  try {
    const res = await fetch(`${baseUrl(server)}/api/inexistant`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(body.error.code, 'NOT_FOUND');
    // Jamais de stack trace ni de détail d'implémentation exposé au client.
    assert.equal('stack' in body.error, false);
  } finally {
    server.close();
  }
});
