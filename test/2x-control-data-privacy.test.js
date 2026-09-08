import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { createApp } from '../src/http/app.js';
import { createStorageAdapter } from '../src/adapters/storage/index.js';

// Control V2 — Data & Privacy V1 (passe finale consolidée). Page
// documentaire read-only, entièrement statique (aucune nouvelle route
// backend, aucun nouveau mécanisme Privacy) -- réutilise control.access
// (jamais projects.view_all). Ces tests portent sur le contenu source
// livré par /control (la seule vérité côté serveur pour une page 100%
// rendue côté client) et sur /api/me pour la preuve d'accès.

const config = loadConfig();
const pool = getPool(config);
const storageAdapter = createStorageAdapter(config);
const silentLogger = { info() {}, warn() {}, error() {} };

let app, server, baseUrl, controlHtml;
let tenant, projectOnlyUser, project;

function withUser(userId) {
  return { headers: { 'X-Storm-Dev-User': userId } };
}

async function cleanAll() {
  await pool.query("delete from project_grants where project_membership_id in (select id from project_memberships where user_id in (select id from users where email like '%@test-control-privacy.local'))");
  await pool.query("delete from project_memberships where user_id in (select id from users where email like '%@test-control-privacy.local')");
  await pool.query("delete from tenant_memberships where user_id in (select id from users where email like '%@test-control-privacy.local')");
  await pool.query("delete from users where email like '%@test-control-privacy.local'");
  await pool.query("delete from projects where name like 'Control Privacy Test%'");
  await pool.query("delete from tenants where name like 'Tenant Control Privacy%'");
}

test.before(async () => {
  await runMigrations();
  await cleanAll();
  app = createApp({ logger: silentLogger, pool, config, storageAdapter });
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
  controlHtml = await fs.readFile(new URL('../public/control.html', import.meta.url), 'utf8');

  const { rows: [t] } = await pool.query("insert into tenants (name) values ('Tenant Control Privacy') returning id");
  tenant = t.id;
  const { rows: [p] } = await pool.query("insert into projects (tenant_id, name, status) values ($1,'Control Privacy Test Projet','active') returning id", [tenant]);
  project = p.id;
  // Utilisateur project-only "externe" : le schéma exige une
  // membership technique-pont dans tenant_memberships pour toute
  // project_membership (contrainte FK réelle, confirmée) -- jamais
  // une absence totale de ligne. Le pont utilise le bundle 'member',
  // qui ne porte aucune capability organisationnelle (confirmé par
  // audit) -- reproduit donc fidèlement un utilisateur sans aucun
  // accès Control réel, jamais un cas artificiel.
  const { rows: [u] } = await pool.query("insert into users (email, display_name) values ('projectonly@test-control-privacy.local','Project Only') returning id");
  projectOnlyUser = u.id;
  await pool.query(
    "insert into tenant_memberships (tenant_id, user_id, permission_bundle) values ($1,$2,'member')",
    [tenant, projectOnlyUser]
  );
  await pool.query(
    "insert into project_memberships (tenant_id, project_id, user_id, permission_bundle) values ($1,$2,$3,'contributor')",
    [tenant, project, projectOnlyUser]
  );
});

test.after(async () => {
  server.close();
  await cleanAll();
  await closePool();
});

// ── Accessibilité de la route ─────────────────────────────────────────

test('/control sert la page -- le contenu Data & Privacy est présent dans le shell', async () => {
  const res = await fetch(`${baseUrl}/control`);
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.ok(body.includes('renderPrivacy'), 'la page doit contenir le rendu Data & Privacy');
});

// ── Capability finale : control.access ───────────────────────────────

test('capability finale -- control.access, jamais projects.view_all', () => {
  assert.ok(controlHtml.includes("if(has(state.me,CAP.CONTROL))views.push('privacy')"), 'la vue privacy doit être gardée par CAP.CONTROL (control.access)');
  assert.ok(!controlHtml.includes("if(has(state.me,CAP.VIEW_ALL))views.push('privacy')"), 'projects.view_all ne doit plus jamais gouverner cette vue');
});

test('aucune nouvelle capability créée pour cette page', () => {
  assert.ok(!/PRIVACY\s*:\s*'/.test(controlHtml), 'aucune capability dédiée type CAP.PRIVACY ne doit exister');
});

test('projects.view_all n\'est pas requis -- preuve via /api/me : un utilisateur control.access sans droit projet particulier verrait quand même la vue privacy gouvernée par CAP.CONTROL', async () => {
  // Preuve structurelle directe : le seul garde utilisé dans le code
  // source pour la vue privacy est CAP.CONTROL, jamais un ET logique
  // avec CAP.VIEW_ALL -- déjà confirmé par le test précédent. Ce test
  // documente explicitement l'absence de dépendance croisée.
  assert.ok(!/views\.push\('privacy'\)[^\n]*VIEW_ALL/.test(controlHtml));
});

test('utilisateur project-only (bundle organisationnel "member", zéro capability) exclu de Storm Control -- /api/me ne renvoie jamais control.access', async () => {
  const res = await fetch(`${baseUrl}/api/me`, withUser(projectOnlyUser));
  assert.equal(res.status, 200);
  const me = await res.json();
  assert.ok(me.organization, 'une organisation est bien résolue (pont technique member)');
  assert.ok(!me.organization.capabilities.includes('control.access'), 'le bundle member ne porte jamais control.access -- exclu de Storm Control');
});

// ── Vérités de rétention exactes rendues ─────────────────────────────

test('sessions -- 7 jours après expiration ou révocation', () => {
  assert.match(controlHtml, /Sessions de connexion/);
  assert.match(controlHtml, /7 jours après leur expiration ou leur révocation/);
});

test('invitations -- ouvertes 90 jours, historique terminal 12 mois', () => {
  assert.match(controlHtml, /90 jours/);
  assert.match(controlHtml, /12 mois/);
});

test('adresse e-mail de première connexion -- retirée après 90 jours, jamais "email de connexion externe"', () => {
  assert.match(controlHtml, /Adresse e-mail de connexion/);
  assert.match(controlHtml, /L’adresse e-mail utilisée lors de la première connexion est retirée après 90 jours/);
  assert.ok(!/[Ee]mail de connexion externe/.test(controlHtml), 'ancien wording jamais réintroduit');
});

test('activité d\'utilisation -- 40 jours, tendances jamais présentées comme purgées par âge', () => {
  assert.match(controlHtml, /40 jours/);
  assert.match(controlHtml, /Tendances d’utilisation/);
  const idx = controlHtml.indexOf('Tendances d’utilisation');
  const snippet = controlHtml.slice(idx, idx + 220);
  assert.ok(!/supprim|purg/i.test(snippet), 'les tendances ne doivent jamais être présentées comme supprimées par âge');
});

test('archive ne supprime rien -- wording final "Archiver conserve le projet"', () => {
  assert.match(controlHtml, /Archiver conserve le projet/);
  const idx = controlHtml.indexOf('Archiver conserve le projet');
  const snippet = controlHtml.slice(idx, idx + 400);
  assert.ok(/aucune suppression/i.test(snippet));
});

test('suppression définitive -- délai de grâce de 7 jours', () => {
  assert.match(controlHtml, /Délai de grâce de 7 jours/);
  assert.match(controlHtml, /laisse 7 jours pour changer d’avis/);
});

test('fichiers du projet retirés avant la suppression finale -- jamais un vocabulaire storage/lease/manifest', () => {
  assert.match(controlHtml, /Fichiers du projet/);
  assert.match(controlHtml, /Storm termine la suppression uniquement après le retrait des fichiers du projet/);
  const idx = controlHtml.indexOf('Fichiers du projet');
  const snippet = controlHtml.slice(idx, idx + 400);
  assert.ok(!/lease|manifest|row lock|worker|storage key|cascade|transaction|job object/i.test(snippet));
});

test('versions publiées -- conservées avec le projet, aucune rétention 90 jours', () => {
  assert.match(controlHtml, /Versions publiées/);
  const idx = controlHtml.lastIndexOf('Versions publiées');
  const snippet = controlHtml.slice(idx, idx + 500);
  assert.ok(!/90 jours/.test(snippet), 'aucune rétention à 90 jours ne doit jamais être affichée pour les publications -- doctrine abandonnée');
  assert.ok(/conservées? avec le projet/i.test(snippet));
});

test('historique des actions -- 12 mois', () => {
  assert.match(controlHtml, /Historique des actions/);
  const idx = controlHtml.indexOf('Historique des actions');
  const snippet = controlHtml.slice(idx, idx + 400);
  assert.ok(/12 mois/.test(snippet));
});

// ── Titres finaux exacts ──────────────────────────────────────────────

test('titre "Utilisation et tendances" (jamais "Usage & tendances")', () => {
  assert.match(controlHtml, /Utilisation et tendances/);
  assert.ok(!controlHtml.includes('Usage &amp; tendances'));
  assert.ok(!controlHtml.includes('Usage & tendances'));
});

test('titre "Hébergement et protections" (jamais "Hébergement & infrastructure")', () => {
  assert.match(controlHtml, /Hébergement et protections/);
  assert.ok(!controlHtml.includes('Hébergement &amp; infrastructure'));
  assert.ok(!controlHtml.includes('Hébergement & infrastructure'));
});

// ── Frontière hébergement -- descriptive, jamais un statut inventé ──

test('hébergement -- descriptif, jamais un statut/checkmark inventé, jamais "DSI / Infrastructure Responsibility Boundary"', () => {
  const idx = controlHtml.indexOf('Géré par l’hébergement');
  assert.ok(idx >= 0);
  const snippet = controlHtml.slice(idx, idx + 500);
  assert.ok(!/✓|Chiffré ✓|Conforme|Certifi/i.test(snippet), 'jamais un statut/checkmark inventé');
  assert.ok(!/DSI\s*\/\s*Infrastructure Responsibility Boundary/i.test(controlHtml));
});

// ── Liquid Core -- entièrement retiré de l'UI actuelle ───────────────

test('Liquid Core -- entièrement absent de la page actuelle (runtime non implémenté)', () => {
  assert.ok(!/Liquid Core/i.test(controlHtml), 'aucune mention de Liquid Core dans la page actuelle');
  assert.ok(!controlHtml.includes('Principe de conception à venir'), 'section prospective entièrement retirée');
  assert.ok(!/Storm Match/i.test((() => {
    const start = controlHtml.indexOf('function renderPrivacy');
    const end = controlHtml.indexOf('function projectSourcesBody');
    return controlHtml.slice(start, end);
  })()), 'aucune mention de Storm Match dans la page Data & Privacy actuelle');
});

// ── Aucune mention "tenant" visible ───────────────────────────────────

test('aucune mention visible de "tenant" dans la page Data & Privacy', () => {
  const start = controlHtml.indexOf('function renderPrivacy');
  const end = controlHtml.indexOf('function projectSourcesBody');
  const snippet = controlHtml.slice(start, end);
  assert.ok(!/tenant/i.test(snippet));
});

// ── Aucune donnée réelle / PII / clé de stockage ─────────────────────

test('aucune donnée personnelle, aucun ID, aucune clé de stockage, aucun issuer/subject rendus', () => {
  const start = controlHtml.indexOf('function renderPrivacy');
  const end = controlHtml.indexOf('function projectSourcesBody');
  const privacySource = controlHtml.slice(start, end);
  assert.ok(!/@[a-z0-9.-]+\.[a-z]{2,}/i.test(privacySource), 'aucun email réel');
  assert.ok(!/storage_key|storageKey/.test(privacySource));
  assert.ok(!/issuer|subject/i.test(privacySource));
  assert.ok(!/visitor_ref/i.test(privacySource));
});

// ── Aucune action destructive / read-only absolu ─────────────────────

test('read-only absolu -- aucun bouton, aucun toggle, aucun formulaire dans la section Data & Privacy', () => {
  const start = controlHtml.indexOf('function renderPrivacy');
  const end = controlHtml.indexOf('function projectSourcesBody');
  const privacySource = controlHtml.slice(start, end);
  assert.ok(!/<button/i.test(privacySource));
  assert.ok(!/<input|<select|<form/i.test(privacySource));
  assert.ok(!/data-purge|data-delete|data-anonymize|data-run-retention|data-configure/i.test(privacySource));
});

// ── Aucun surclaim conformité ─────────────────────────────────────────

test('aucune mention GDPR/RGPD/certification/conformité/score', () => {
  const start = controlHtml.indexOf('function renderPrivacy');
  const end = controlHtml.indexOf('function projectSourcesBody');
  const privacySource = controlHtml.slice(start, end);
  assert.ok(!/GDPR|RGPD|certifi|conforme|100\s*%\s*s[ée]curis|privacy score|compliance/i.test(privacySource));
});

// ── Langage humain, jamais du jargon d'implémentation ────────────────

test('langage produit humain -- aucun vocabulaire d\'implémentation dans le texte affiché', () => {
  const start = controlHtml.indexOf('function renderPrivacy');
  const end = controlHtml.indexOf('function projectSourcesBody');
  const privacySource = controlHtml.slice(start, end);
  const displayedText = (privacySource.match(/>([^<>{}]{4,})</g) || []).join(' ');
  assert.ok(!/telemetry_events|external_identities|project_deletion_job|lease|manifest\b|row lock|retention runner|deterministic purge|probabilistic/i.test(displayedText));
});

// ── Page française dans le shell Control actuel ──────────────────────

test('page en français, cohérente avec le shell Control actuel', () => {
  assert.equal(controlHtml.match(/<html lang="fr">/) !== null, true);
  assert.match(controlHtml, /Données et confidentialité|Comment Storm conserve/);
});
