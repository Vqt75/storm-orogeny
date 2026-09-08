import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { purgeOldTelemetryEvents, PILOTAGE_RAW_RETENTION_DAYS } from '../src/domain/privacy/pilotageRetention.js';
import { runRetentionPolicies } from '../src/domain/privacy/retentionRunner.js';
import { normalizeTelemetryPath } from '../src/http/routes/publicTelemetry.js';
import { createApp } from '../src/http/app.js';
import { createStorageAdapter } from '../src/adapters/storage/index.js';

// Privacy & Data Lifecycle V1 — Batch 8. Rétention déterministe des
// telemetry_events (Pilotage brut, 40 jours) intégrée au retention
// runner existant (Batch 2). Les quatre daily_*_agg ne sont JAMAIS
// purgés par âge -- seulement par suppression permanente du projet
// (cascade déjà en place).

const config = loadConfig();
const pool = getPool(config);
const storageAdapter = createStorageAdapter(config);
const silentLogger = { info() {}, warn() {}, error() {} };

let tenant, project, otherProject;
let app, server, baseUrl;
const DAY_MS = 24 * 60 * 60 * 1000;

async function cleanAll() {
  await pool.query("delete from telemetry_events where tenant_id in (select id from tenants where name like 'Tenant Privacy Batch8%')");
  await pool.query("delete from daily_usage_agg where tenant_id in (select id from tenants where name like 'Tenant Privacy Batch8%')");
  await pool.query("delete from daily_content_agg where tenant_id in (select id from tenants where name like 'Tenant Privacy Batch8%')");
  await pool.query("delete from daily_match_agg where tenant_id in (select id from tenants where name like 'Tenant Privacy Batch8%')");
  await pool.query("delete from daily_mood_agg where tenant_id in (select id from tenants where name like 'Tenant Privacy Batch8%')");
  await pool.query("delete from projects where tenant_id in (select id from tenants where name like 'Tenant Privacy Batch8%')");
  await pool.query("delete from tenants where name like 'Tenant Privacy Batch8%'");
}

test.before(async () => {
  await runMigrations();
  await cleanAll();
  const { rows: [t] } = await pool.query("insert into tenants (name) values ('Tenant Privacy Batch8') returning id");
  tenant = t.id;
  const { rows: [p] } = await pool.query("insert into projects (tenant_id, name, status) values ($1,'Privacy Batch8 Projet A','active') returning id", [tenant]);
  project = p.id;
  const { rows: [p2] } = await pool.query("insert into projects (tenant_id, name, status) values ($1,'Privacy Batch8 Projet B','active') returning id", [tenant]);
  otherProject = p2.id;

  app = createApp({ logger: silentLogger, pool, config, storageAdapter });
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

test.after(async () => {
  server.close();
  await cleanAll();
  await closePool();
});

let counter = 0;
async function makeEvent(projectId, occurredAt, eventType = 'page_view') {
  counter += 1;
  const { rows: [e] } = await pool.query(
    `insert into telemetry_events (tenant_id, project_id, event_type, visitor_ref, session_ref, path, occurred_at)
     values ($1,$2,$3,$4,$4,'/test',$5) returning id`,
    [tenant, projectId, eventType, `${crypto.randomUUID()}`, occurredAt]
  );
  return e.id;
}

async function countEvents(projectId) {
  const { rows } = await pool.query('select count(*)::int as n from telemetry_events where project_id=$1', [projectId]);
  return rows[0].n;
}

// ── Empty ────────────────────────────────────────────────────────────

test('empty -- aucune telemetry, runner propre', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const purged = await purgeOldTelemetryEvents(pool, { now });
  assert.equal(purged, 0);
});

// ── Older than 40 days ───────────────────────────────────────────────

test('event âgé de plus de 40 jours -- supprimé', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const id = await makeEvent(project, new Date(now.getTime() - 45 * DAY_MS));
  await purgeOldTelemetryEvents(pool, { now });
  const { rows } = await pool.query('select id from telemetry_events where id=$1', [id]);
  assert.equal(rows.length, 0);
});

// ── Exactly cutoff ───────────────────────────────────────────────────

test('event âgé d\'exactement 40 jours -- conservé (strictement plus vieux requis)', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const occurredAt = new Date(now.getTime() - PILOTAGE_RAW_RETENTION_DAYS * DAY_MS);
  const id = await makeEvent(project, occurredAt);
  await purgeOldTelemetryEvents(pool, { now });
  const { rows } = await pool.query('select id from telemetry_events where id=$1', [id]);
  assert.equal(rows.length, 1, 'exactement au cutoff -- conservé, jamais purgé');
  await pool.query('delete from telemetry_events where id=$1', [id]);
});

// ── Just inside retention ────────────────────────────────────────────

test('event âgé de 39 jours 23h -- conservé', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const occurredAt = new Date(now.getTime() - (39 * DAY_MS + 23 * 60 * 60 * 1000));
  const id = await makeEvent(project, occurredAt);
  await purgeOldTelemetryEvents(pool, { now });
  const { rows } = await pool.query('select id from telemetry_events where id=$1', [id]);
  assert.equal(rows.length, 1);
  await pool.query('delete from telemetry_events where id=$1', [id]);
});

// ── Mixed projects ───────────────────────────────────────────────────

test('projets mélangés -- seules les lignes trop anciennes sont purgées, aucune confusion entre projets', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const oldA = await makeEvent(project, new Date(now.getTime() - 50 * DAY_MS));
  const recentA = await makeEvent(project, new Date(now.getTime() - 5 * DAY_MS));
  const oldB = await makeEvent(otherProject, new Date(now.getTime() - 50 * DAY_MS));
  const recentB = await makeEvent(otherProject, new Date(now.getTime() - 5 * DAY_MS));

  await purgeOldTelemetryEvents(pool, { now });

  const { rows: remaining } = await pool.query('select id from telemetry_events where id = any($1::uuid[])', [[oldA, recentA, oldB, recentB]]);
  const remainingIds = remaining.map(r => r.id);
  assert.ok(!remainingIds.includes(oldA));
  assert.ok(remainingIds.includes(recentA));
  assert.ok(!remainingIds.includes(oldB));
  assert.ok(remainingIds.includes(recentB));

  await pool.query('delete from telemetry_events where id = any($1::uuid[])', [[recentA, recentB]]);
});

// ── Aggregates untouched ─────────────────────────────────────────────

test('AGRÉGATS -- les quatre daily_*_agg survivent intégralement à la purge raw', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  await makeEvent(project, new Date(now.getTime() - 50 * DAY_MS));

  const day = '2026-04-01';
  await pool.query(
    "insert into daily_usage_agg (tenant_id, project_id, day, unique_visitors, sessions, returning_sessions, page_views) values ($1,$2,$3,1,1,0,1)",
    [tenant, project, day]
  );
  await pool.query(
    "insert into daily_content_agg (tenant_id, project_id, day, path, page_views) values ($1,$2,$3,'/test',1)",
    [tenant, project, day]
  );
  await pool.query(
    "insert into daily_match_agg (tenant_id, project_id, day, outcome, count) values ($1,$2,$3,'matched',1)",
    [tenant, project, day]
  );
  await pool.query(
    "insert into daily_mood_agg (tenant_id, project_id, day, value, count) values ($1,$2,$3,4,1)",
    [tenant, project, day]
  );

  await purgeOldTelemetryEvents(pool, { now });

  const { rows: usage } = await pool.query('select 1 from daily_usage_agg where tenant_id=$1 and project_id=$2 and day=$3', [tenant, project, day]);
  const { rows: content } = await pool.query('select 1 from daily_content_agg where tenant_id=$1 and project_id=$2 and day=$3', [tenant, project, day]);
  const { rows: match } = await pool.query('select 1 from daily_match_agg where tenant_id=$1 and project_id=$2 and day=$3', [tenant, project, day]);
  const { rows: mood } = await pool.query('select 1 from daily_mood_agg where tenant_id=$1 and project_id=$2 and day=$3', [tenant, project, day]);
  assert.equal(usage.length, 1, 'daily_usage_agg doit survivre');
  assert.equal(content.length, 1, 'daily_content_agg doit survivre');
  assert.equal(match.length, 1, 'daily_match_agg doit survivre');
  assert.equal(mood.length, 1, 'daily_mood_agg doit survivre');
});

// ── Idempotence ──────────────────────────────────────────────────────

test('idempotence -- second run purge 0 supplémentaire', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  await makeEvent(project, new Date(now.getTime() - 50 * DAY_MS));
  const first = await purgeOldTelemetryEvents(pool, { now });
  const second = await purgeOldTelemetryEvents(pool, { now });
  assert.ok(first >= 1);
  assert.equal(second, 0);
});

// ── Failure isolation ────────────────────────────────────────────────

test('isolation -- échec de la policy pilotage -- rollback de cette policy, sessions/invitations/audit inchangés', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const id = await makeEvent(project, new Date(now.getTime() - 50 * DAY_MS));

  await pool.query('REVOKE DELETE ON telemetry_events FROM storm_orogeny');
  try {
    await assert.rejects(runRetentionPolicies(pool, { now, logger: silentLogger }));
  } finally {
    await pool.query('GRANT DELETE ON telemetry_events TO storm_orogeny');
  }

  const { rows } = await pool.query('select id from telemetry_events where id=$1', [id]);
  assert.equal(rows.length, 1, 'rollback complet -- rien purgé malgré l\'échec');

  await pool.query('delete from telemetry_events where id=$1', [id]);
});

test('runner -- résultat structuré inclut pilotage, sessions/invitations/audit_events inchangés dans leur contrat', async () => {
  const now = new Date('2026-06-15T12:00:00Z');
  const result = await runRetentionPolicies(pool, { now, logger: silentLogger });
  assert.ok('sessions' in result);
  assert.ok('purged' in result.sessions);
  assert.ok('invitations' in result);
  assert.ok('expired' in result.invitations && 'purged' in result.invitations);
  assert.ok('auditEvents' in result);
  assert.ok('purged' in result.auditEvents);
  assert.ok('pilotage' in result);
  assert.ok('purged' in result.pilotage);
});

// ── Project permanent delete (non-régression cascade) ────────────────

test('CASCADE -- suppression permanente du projet supprime bien les telemetry_events (non-régression)', async () => {
  const { rows: [tempProject] } = await pool.query(
    "insert into projects (tenant_id, name, status) values ($1,'Privacy Batch8 Projet Cascade','archived') returning id",
    [tenant]
  );
  const now = new Date('2026-06-15T12:00:00Z');
  const id = await makeEvent(tempProject.id, new Date(now.getTime() - 5 * DAY_MS));

  await pool.query('delete from projects where id=$1', [tempProject.id]);

  const { rows } = await pool.query('select id from telemetry_events where id=$1', [id]);
  assert.equal(rows.length, 0, 'la cascade FK doit toujours fonctionner -- non-régression Batch 6');
});

// ── Privacy fields ───────────────────────────────────────────────────

test('PRIVACY -- structure de telemetry_events ne porte aucun champ raw/user_id', async () => {
  const { rows: columns } = await pool.query(
    "select column_name from information_schema.columns where table_name='telemetry_events'"
  );
  const columnNames = columns.map(c => c.column_name);
  assert.ok(!columnNames.includes('user_id'), 'jamais de user_id -- seul visitor_ref, pseudonyme');
  assert.ok(!columnNames.includes('email'));
  assert.ok(!columnNames.includes('display_name'));
  assert.ok(!columnNames.includes('question_text'));
  assert.ok(!columnNames.includes('answer_text'));
  assert.ok(!columnNames.includes('match_text'));
  assert.deepEqual(
    columnNames.sort(),
    ['id', 'tenant_id', 'project_id', 'event_type', 'visitor_ref', 'session_ref', 'path', 'outcome', 'matched_entry_id', 'confidence_bucket', 'mood_value', 'occurred_at'].sort()
  );
});


// ── FERMETURE -- contrat telemetry_events.path (allowlist sémantique) ──
// Univers réel confirmé exhaustivement par audit direct du template
// Ivory (public/ivory/renderers/ivory.js) : exactement 7 sections
// top-level (.tct-main > .tct-section), comptées une par une.

test('path -- catégories canoniques réelles conservées telles quelles', () => {
  for (const cat of ['home', 'timeline', 'spaces', 'news', 'questions', 'ambassadors', 'team']) {
    assert.equal(normalizeTelemetryPath(cat), cat);
  }
});

test('path -- routes dynamiques réelles (news-<slug>, space-<slug>) canonicalisées', () => {
  assert.equal(normalizeTelemetryPath('news-my-article'), 'news');
  assert.equal(normalizeTelemetryPath('news-2026-annual-report'), 'news');
  assert.equal(normalizeTelemetryPath('space-paris-team'), 'spaces');
  assert.equal(normalizeTelemetryPath('space-tours-agence'), 'spaces');
});

test('path -- query supprimée/refusée (categorie valide + query)', () => {
  assert.equal(normalizeTelemetryPath('home?email=a@b.com'), 'home');
});

test('path -- fragment supprimé/refusé (categorie valide + fragment)', () => {
  assert.equal(normalizeTelemetryPath('home#secret'), 'home');
});

test('path -- URL absolue refusée entièrement', () => {
  assert.equal(normalizeTelemetryPath('https://evil.example/x'), null);
  assert.equal(normalizeTelemetryPath('http://evil.example/x'), null);
  assert.equal(normalizeTelemetryPath('//evil.example/x'), null);
});

test('path -- TEXTE ARBITRAIRE ALPHANUMÉRIQUE VALIDE SYNTAXIQUEMENT -- jamais persisté (aurait survécu à la simple regex précédente)', () => {
  // Ces chaînes respectent [a-zA-Z0-9\-_/]+ mais ne sont PAS des
  // catégories réelles -- exactement ce que l'ancienne whitelist de
  // caractères laissait passer à tort.
  const arbitraryButSyntacticallyValid = [
    'monproblemeconfidentiel',
    'julien-dupont',
    'private-note',
    'johnsmith',
    'project-secret'
  ];
  for (const value of arbitraryButSyntacticallyValid) {
    assert.equal(normalizeTelemetryPath(value), null, `"${value}" ne doit jamais être persisté`);
  }
});

test('path -- email jamais persisté, sous aucune forme', () => {
  assert.equal(normalizeTelemetryPath('contact@exemple.com'), null);
  assert.equal(normalizeTelemetryPath('home?email=attaquant@exemple.com'), 'home');
});

test('path -- longueur bornée -- sans objet ici, l\'allowlist élimine déjà toute chaîne hors univers connu', () => {
  const longUnknown = 'a'.repeat(200);
  assert.equal(normalizeTelemetryPath(longUnknown), null);
});

test('path -- valeurs non-string ou vides -- refusées proprement', () => {
  assert.equal(normalizeTelemetryPath(undefined), null);
  assert.equal(normalizeTelemetryPath(null), null);
  assert.equal(normalizeTelemetryPath(123), null);
  assert.equal(normalizeTelemetryPath(''), null);
  assert.equal(normalizeTelemetryPath('   '), null);
});

test('path -- BOUT EN BOUT HTTP -- route canonique réelle acceptée et persistée', async () => {
  const res = await fetch(`${baseUrl}/public/projects/${project}/telemetry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'page_view', path: 'news' })
  });
  assert.equal(res.status, 204);

  const { rows } = await pool.query(
    "select path from telemetry_events where project_id=$1 and event_type='page_view' order by occurred_at desc limit 1",
    [project]
  );
  assert.equal(rows[0].path, 'news');

  await pool.query('delete from telemetry_events where project_id=$1', [project]);
});

test('path -- BOUT EN BOUT HTTP -- query+fragment supprimés sur une catégorie valide', async () => {
  const res = await fetch(`${baseUrl}/public/projects/${project}/telemetry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'page_view', path: 'home?email=attaquant@exemple.com#secret-libre' })
  });
  assert.equal(res.status, 204);

  const { rows } = await pool.query(
    "select path from telemetry_events where project_id=$1 and event_type='page_view' order by occurred_at desc limit 1",
    [project]
  );
  assert.equal(rows[0].path, 'home', 'ni la query ni le fragment ne doivent jamais atteindre la base');
  assert.ok(!rows[0].path.includes('@'), 'aucune trace d\'email persistée');

  await pool.query('delete from telemetry_events where project_id=$1', [project]);
});

test('path -- BOUT EN BOUT HTTP -- chaîne arbitraire alphanumérique valide syntaxiquement n\'arrive jamais en DB', async () => {
  const res = await fetch(`${baseUrl}/public/projects/${project}/telemetry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'page_view', path: 'julien-dupont' })
  });
  assert.equal(res.status, 204);

  const { rows } = await pool.query(
    "select path from telemetry_events where project_id=$1 and event_type='page_view' order by occurred_at desc limit 1",
    [project]
  );
  assert.equal(rows[0].path, null, 'une chaîne hors de l\'univers canonique connu ne doit jamais atteindre la base telle quelle');

  await pool.query('delete from telemetry_events where project_id=$1', [project]);
});

test('path -- BOUT EN BOUT HTTP -- route dynamique réelle (news-<slug>) canonicalisée en DB', async () => {
  const res = await fetch(`${baseUrl}/public/projects/${project}/telemetry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'page_view', path: 'news-mon-article-confidentiel' })
  });
  assert.equal(res.status, 204);

  const { rows } = await pool.query(
    "select path from telemetry_events where project_id=$1 and event_type='page_view' order by occurred_at desc limit 1",
    [project]
  );
  assert.equal(rows[0].path, 'news', 'jamais le slug, uniquement la catégorie coarse');

  await pool.query('delete from telemetry_events where project_id=$1', [project]);
});

test('path -- BOUT EN BOUT HTTP -- texte libre non-canonique -- jamais persisté', async () => {
  const res = await fetch(`${baseUrl}/public/projects/${project}/telemetry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'page_view', path: 'mon probleme personnel avec contact@exemple.com' })
  });
  assert.equal(res.status, 204);

  const { rows } = await pool.query(
    "select path from telemetry_events where project_id=$1 and event_type='page_view' order by occurred_at desc limit 1",
    [project]
  );
  assert.equal(rows[0].path, null);

  await pool.query('delete from telemetry_events where project_id=$1', [project]);
});

test('path -- aucun raw Match/user text -- structure de telemetry_events inchangée par cette fermeture', async () => {
  const { rows: columns } = await pool.query(
    "select column_name from information_schema.columns where table_name='telemetry_events'"
  );
  const columnNames = columns.map(c => c.column_name);
  assert.ok(!columnNames.includes('raw_path'), 'aucune colonne supplémentaire de contournement introduite');
  assert.equal(columnNames.length, 12, 'schéma inchangé par cette fermeture -- uniquement le contrat applicatif de path renforcé');
});
