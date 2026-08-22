import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import XLSX from 'xlsx';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { createApp } from '../src/http/app.js';
import { createStorageAdapter } from '../src/adapters/storage/index.js';
import { recordPageView, recordMatchResult, recordMoodFeedback } from '../src/domain/pilotage/telemetry.js';

const config = loadConfig();
const pool = getPool(config);
const storageAdapter = createStorageAdapter(config);
const silentLogger = { info() {}, warn() {}, error() {} };

let app, server, baseUrl;
let ids = {};

async function cleanAll() {
  await pool.query('delete from telemetry_events');
  await pool.query('delete from daily_usage_agg');
  await pool.query('delete from daily_content_agg');
  await pool.query('delete from daily_match_agg');
  await pool.query('delete from daily_mood_agg');
  await pool.query('delete from project_memberships');
  await pool.query('delete from tenant_memberships');
  await pool.query('delete from projects');
  await pool.query('delete from users');
  await pool.query('delete from tenants');
}

function withUser(userId) { return { headers: { 'X-Storm-Dev-User': userId } }; }

test.before(async () => {
  await runMigrations();
  await cleanAll();

  const { rows: [tenantA] } = await pool.query("insert into tenants (name) values ('Tenant Pilotage A') returning id");
  const { rows: [tenantB] } = await pool.query("insert into tenants (name) values ('Tenant Pilotage B') returning id");

  const { rows: [pilotUser] } = await pool.query("insert into users (email, display_name) values ('pilot@pilotage.local','Pilote') returning id");
  const { rows: [contributor] } = await pool.query("insert into users (email, display_name) values ('contrib@pilotage.local','Contributeur') returning id");

  await pool.query('insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1,$2,$3)', [tenantA.id, pilotUser.id, 'member']);
  await pool.query('insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1,$2,$3)', [tenantA.id, contributor.id, 'member']);

  const { rows: [projectA] } = await pool.query("insert into projects (tenant_id, name) values ($1,'Projet Pilotage A') returning id", [tenantA.id]);
  const { rows: [projectB] } = await pool.query("insert into projects (tenant_id, name) values ($1,'Projet Pilotage B') returning id", [tenantB.id]);
  await pool.query('insert into project_identity (tenant_id, project_id) values ($1,$2)', [tenantA.id, projectA.id]);
  await pool.query('insert into project_identity (tenant_id, project_id) values ($1,$2)', [tenantB.id, projectB.id]);

  await pool.query('insert into project_memberships (tenant_id, project_id, user_id, permission_bundle) values ($1,$2,$3,$4)', [tenantA.id, projectA.id, pilotUser.id, 'pilot']);
  await pool.query('insert into project_memberships (tenant_id, project_id, user_id, permission_bundle) values ($1,$2,$3,$4)', [tenantA.id, projectA.id, contributor.id, 'contributor']);

  ids = { tenantA: tenantA.id, tenantB: tenantB.id, projectA: projectA.id, projectB: projectB.id, pilotUser: pilotUser.id, contributor: contributor.id };

  app = createApp({ logger: silentLogger, pool, config, storageAdapter });
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

test.after(async () => {
  server.close();
  await closePool();
});

async function resetTelemetry() {
  await pool.query('delete from telemetry_events');
  await pool.query('delete from daily_usage_agg');
  await pool.query('delete from daily_content_agg');
  await pool.query('delete from daily_match_agg');
  await pool.query('delete from daily_mood_agg');
}

// ── Capability ──

test('pilot -> GET /pilotage 200, contributor (sans pilotage.view) -> 403', async () => {
  const okRes = await fetch(`${baseUrl}/api/projects/${ids.projectA}/pilotage`, withUser(ids.pilotUser));
  assert.equal(okRes.status, 200);
  const forbiddenRes = await fetch(`${baseUrl}/api/projects/${ids.projectA}/pilotage`, withUser(ids.contributor));
  assert.equal(forbiddenRes.status, 403);
});

test('projet d\'un autre tenant -> 404, jamais un succès cross-tenant', async () => {
  const res = await fetch(`${baseUrl}/api/projects/${ids.projectB}/pilotage`, withUser(ids.pilotUser));
  assert.equal(res.status, 404);
});

// ── Collecte publique — jamais authentifiée ──

test('POST /telemetry ne requiert aucune authentification, toujours 204', async () => {
  const res = await fetch(`${baseUrl}/public/projects/${ids.projectA}/telemetry`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'page_view', path: 'home' })
  });
  assert.equal(res.status, 204);
  await resetTelemetry();
});

test('POST /telemetry sur un projet inexistant reste 204, ne révèle jamais l\'absence du projet', async () => {
  const res = await fetch(`${baseUrl}/public/projects/00000000-0000-0000-0000-000000000000/telemetry`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'page_view' })
  });
  assert.equal(res.status, 204);
});

test('POST /telemetry pose un cookie visiteur pseudonyme, HttpOnly, first-party', async () => {
  const res = await fetch(`${baseUrl}/public/projects/${ids.projectA}/telemetry`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'page_view', path: 'home' })
  });
  const setCookie = res.headers.get('set-cookie') || '';
  assert.match(setCookie, /storm_visitor=[0-9a-f-]{36}/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
  await resetTelemetry();
});

// ── Agrégation à l'écriture ──

test('recordPageView agrège immédiatement dans daily_usage_agg et daily_content_agg', async () => {
  await recordPageView(pool, { tenantId: ids.tenantA, projectId: ids.projectA, visitorRef: crypto.randomUUID(), path: 'home' });
  const usage = await pool.query('select * from daily_usage_agg where project_id=$1', [ids.projectA]);
  assert.equal(usage.rows.length, 1);
  assert.equal(usage.rows[0].unique_visitors, 1);
  assert.equal(usage.rows[0].sessions, 1);
  assert.equal(usage.rows[0].page_views, 1);
  const content = await pool.query('select * from daily_content_agg where project_id=$1', [ids.projectA]);
  assert.equal(content.rows[0].path, 'home');
  assert.equal(content.rows[0].page_views, 1);
  await resetTelemetry();
});

test('même visiteur, deux pages rapprochées -> une seule session, deux pages vues', async () => {
  const visitorRef = crypto.randomUUID();
  await recordPageView(pool, { tenantId: ids.tenantA, projectId: ids.projectA, visitorRef, path: 'home' });
  await recordPageView(pool, { tenantId: ids.tenantA, projectId: ids.projectA, visitorRef, path: 'news' });
  const usage = await pool.query('select * from daily_usage_agg where project_id=$1', [ids.projectA]);
  assert.equal(usage.rows[0].sessions, 1, 'même session -- pas de doublon');
  assert.equal(usage.rows[0].page_views, 2);
  assert.equal(usage.rows[0].unique_visitors, 1, 'même visiteur -- compté une seule fois ce jour-là');
  await resetTelemetry();
});

test('même visiteur, plus de 30 minutes d\'écart -> nouvelle session, comptée comme un retour', async () => {
  const visitorRef = crypto.randomUUID();
  const t1 = new Date('2026-01-01T10:00:00Z');
  const t2 = new Date('2026-01-01T10:45:00Z'); // 45 min plus tard -- au-delà des 30 min d'inactivité
  await recordPageView(pool, { tenantId: ids.tenantA, projectId: ids.projectA, visitorRef, path: 'home', now: t1 });
  await recordPageView(pool, { tenantId: ids.tenantA, projectId: ids.projectA, visitorRef, path: 'home', now: t2 });
  const usage = await pool.query('select * from daily_usage_agg where project_id=$1', [ids.projectA]);
  assert.equal(usage.rows[0].sessions, 2, 'inactivité de 30+ minutes -- deux sessions distinctes');
  assert.equal(usage.rows[0].returning_sessions, 1, 'la 2e session est un retour du même visiteur');
  await resetTelemetry();
});

test('session : durée absolue de 4h dépassée malgré une activité continue -> nouvelle session', async () => {
  const visitorRef = crypto.randomUUID();
  const t1 = new Date('2026-01-01T08:00:00Z');
  const t2 = new Date('2026-01-01T08:20:00Z');  // 20 min plus tard -- même session
  const t3 = new Date('2026-01-01T12:15:00Z');  // 4h15 après le début -- dépasse le plafond absolu, malgré <30min depuis t2
  await recordPageView(pool, { tenantId: ids.tenantA, projectId: ids.projectA, visitorRef, path: 'home', now: t1 });
  const r2 = await recordPageView(pool, { tenantId: ids.tenantA, projectId: ids.projectA, visitorRef, path: 'home', now: t2 });
  const r3 = await recordPageView(pool, { tenantId: ids.tenantA, projectId: ids.projectA, visitorRef, path: 'home', now: t3 });
  assert.equal(r2.sessionRef, (await pool.query('select session_ref from telemetry_events where occurred_at=$1', [t1])).rows[0].session_ref, 'r2 doit réutiliser la session de t1');
  assert.notEqual(r3.sessionRef, r2.sessionRef, 'r3 dépasse 4h depuis le début de la session -- doit en ouvrir une nouvelle');
  await resetTelemetry();
});

test('recordMatchResult : matched avec entryId+confiance, abstained sans -- jamais de mutilation par NOT NULL implicite', async () => {
  await recordMatchResult(pool, { tenantId: ids.tenantA, projectId: ids.projectA, visitorRef: crypto.randomUUID(), outcome: 'matched', matchedEntryId: 'aaaaaaaa-1111-1111-1111-111111111111', confidenceBucket: 'high' });
  await recordMatchResult(pool, { tenantId: ids.tenantA, projectId: ids.projectA, visitorRef: crypto.randomUUID(), outcome: 'abstained', matchedEntryId: null, confidenceBucket: null });
  const rows = await pool.query('select outcome, matched_entry_id, confidence_bucket, count from daily_match_agg where project_id=$1 order by outcome', [ids.projectA]);
  assert.equal(rows.rows.length, 2);
  const abstained = rows.rows.find(r => r.outcome === 'abstained');
  assert.equal(abstained.matched_entry_id, null);
  assert.equal(abstained.confidence_bucket, null);
  const matched = rows.rows.find(r => r.outcome === 'matched');
  assert.equal(matched.matched_entry_id, 'aaaaaaaa-1111-1111-1111-111111111111');
  await resetTelemetry();
});

test('recordMatchResult : deux abstained consécutifs incrémentent le même agrégat (ON CONFLICT), jamais deux lignes', async () => {
  await recordMatchResult(pool, { tenantId: ids.tenantA, projectId: ids.projectA, visitorRef: crypto.randomUUID(), outcome: 'abstained', matchedEntryId: null, confidenceBucket: null });
  await recordMatchResult(pool, { tenantId: ids.tenantA, projectId: ids.projectA, visitorRef: crypto.randomUUID(), outcome: 'abstained', matchedEntryId: null, confidenceBucket: null });
  const rows = await pool.query('select count from daily_match_agg where project_id=$1 and outcome=$2', [ids.projectA, 'abstained']);
  assert.equal(rows.rows.length, 1, 'une seule ligne agrégée, jamais un doublon');
  assert.equal(rows.rows[0].count, 2);
  await resetTelemetry();
});

// ── Seuil de confidentialité météo ──

test('météo sous le seuil -> distribution masquée, total quand même visible (jamais un taux de participation)', async () => {
  for (let i = 0; i < 4; i++) await recordMoodFeedback(pool, { tenantId: ids.tenantA, projectId: ids.projectA, value: 4 });
  const res = await fetch(`${baseUrl}/api/projects/${ids.projectA}/pilotage`, withUser(ids.pilotUser));
  const body = await res.json();
  assert.equal(body.mood.total, 4);
  assert.equal(body.mood.meetsThreshold, false);
  assert.deepEqual(body.mood.distribution, []);
  await resetTelemetry();
});

test('météo au seuil -> distribution révélée', async () => {
  for (let i = 0; i < 5; i++) await recordMoodFeedback(pool, { tenantId: ids.tenantA, projectId: ids.projectA, value: 5 });
  const res = await fetch(`${baseUrl}/api/projects/${ids.projectA}/pilotage`, withUser(ids.pilotUser));
  const body = await res.json();
  assert.equal(body.mood.meetsThreshold, true);
  assert.equal(body.mood.distribution.length, 1);
  assert.equal(body.mood.distribution[0].count, 5);
  await resetTelemetry();
});

// ── Aucune donnée individuelle jamais exposée ──

test('GET /pilotage ne contient structurellement aucun visitor_ref/session_ref, à aucune profondeur', async () => {
  await recordPageView(pool, { tenantId: ids.tenantA, projectId: ids.projectA, visitorRef: crypto.randomUUID(), path: 'home' });
  await recordMatchResult(pool, { tenantId: ids.tenantA, projectId: ids.projectA, visitorRef: crypto.randomUUID(), outcome: 'matched', matchedEntryId: 'aaaaaaaa-1111-1111-1111-111111111111', confidenceBucket: 'high' });
  const res = await fetch(`${baseUrl}/api/projects/${ids.projectA}/pilotage`, withUser(ids.pilotUser));
  const raw = await res.text();
  assert.ok(!/visitor_?ref/i.test(raw), 'aucune trace de visitor_ref dans la réponse JSON');
  assert.ok(!/session_?ref/i.test(raw), 'aucune trace de session_ref dans la réponse JSON');
  await resetTelemetry();
});

test('daily_usage_agg / daily_content_agg / daily_match_agg / daily_mood_agg ne possèdent structurellement aucune colonne individuelle', async () => {
  for (const t of ['daily_usage_agg', 'daily_content_agg', 'daily_match_agg', 'daily_mood_agg']) {
    const cols = await pool.query("select column_name from information_schema.columns where table_name=$1", [t]);
    const names = cols.rows.map(r => r.column_name);
    assert.ok(!names.includes('visitor_ref'), `${t} ne doit jamais avoir de colonne visitor_ref`);
    assert.ok(!names.includes('session_ref'), `${t} ne doit jamais avoir de colonne session_ref`);
  }
});

// ── Isolation multi-tenant ──

test('daily_*_agg -- isolation stricte, un projet ne voit jamais les agrégats d\'un autre', async () => {
  await recordPageView(pool, { tenantId: ids.tenantA, projectId: ids.projectA, visitorRef: crypto.randomUUID(), path: 'home' });
  await recordPageView(pool, { tenantId: ids.tenantB, projectId: ids.projectB, visitorRef: crypto.randomUUID(), path: 'home' });
  const resA = await fetch(`${baseUrl}/api/projects/${ids.projectA}/pilotage`, withUser(ids.pilotUser));
  const bodyA = await resA.json();
  assert.equal(bodyA.kpis.sessions.value, 1, 'projet A ne doit voir que sa propre session, jamais celle du projet B');
  await resetTelemetry();
});

// ── Export Excel ──

test('export .xlsx : 6 onglets attendus, jamais un onglet raw events', async () => {
  await recordPageView(pool, { tenantId: ids.tenantA, projectId: ids.projectA, visitorRef: crypto.randomUUID(), path: 'home' });
  const res = await fetch(`${baseUrl}/api/projects/${ids.projectA}/pilotage/export.xlsx`, withUser(ids.pilotUser));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const buffer = Buffer.from(await res.arrayBuffer());
  const wb = XLSX.read(buffer, { type: 'buffer' });
  assert.deepEqual(wb.SheetNames, ['Synthèse', 'Audience', 'Contenus', 'Storm Match', 'Météo du projet', 'Méthodologie']);
  assert.ok(!wb.SheetNames.some(n => /raw|event/i.test(n)), 'jamais un onglet raw events');
  await resetTelemetry();
});

test('export .xlsx : aucune trace de visitor_ref/session_ref dans le contenu du classeur', async () => {
  const visitorRef = crypto.randomUUID();
  await recordPageView(pool, { tenantId: ids.tenantA, projectId: ids.projectA, visitorRef, path: 'home' });
  const res = await fetch(`${baseUrl}/api/projects/${ids.projectA}/pilotage/export.xlsx`, withUser(ids.pilotUser));
  const buffer = Buffer.from(await res.arrayBuffer());
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const allText = wb.SheetNames.map(n => JSON.stringify(XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 }))).join(' ');
  assert.ok(!allText.includes(visitorRef), 'le pseudonyme visiteur ne doit jamais apparaître dans l\'export');
  await resetTelemetry();
});

test('export .xlsx : contributor (sans pilotage.view) -> 403, jamais un contournement', async () => {
  const res = await fetch(`${baseUrl}/api/projects/${ids.projectA}/pilotage/export.xlsx`, withUser(ids.contributor));
  assert.equal(res.status, 403);
});
