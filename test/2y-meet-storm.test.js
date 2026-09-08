import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { createApp } from '../src/http/app.js';
import { createStorageAdapter } from '../src/adapters/storage/index.js';

// Meet Storm -- Orogeny V1 (passe finale produit). Surface éditoriale
// interne, entièrement statique (aucune nouvelle route API, aucune
// capability dédiée), accessible depuis Storm Home. Ces tests portent
// sur le contenu source livré par /meet et sur le câblage réel depuis
// /home.html -- jamais des snapshots pixel, des contrats sémantiques.

const config = loadConfig();
const pool = getPool(config);
const storageAdapter = createStorageAdapter(config);
const silentLogger = { info() {}, warn() {}, error() {} };

let app, server, baseUrl, meetHtml, homeHtml;

test.before(async () => {
  await runMigrations();
  app = createApp({ logger: silentLogger, pool, config, storageAdapter });
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
  meetHtml = await fs.readFile(new URL('../public/meet.html', import.meta.url), 'utf8');
  homeHtml = await fs.readFile(new URL('../public/home.html', import.meta.url), 'utf8');
});

test.after(async () => {
  server.close();
  await closePool();
});

// ── Route ──────────────────────────────────────────────────────────────

test('GET /meet sert la page, sans authentification requise pour le shell statique -- même principe que / et /control', async () => {
  const res = await fetch(`${baseUrl}/meet`);
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.ok(body.includes('Meet Storm'));
});

test('page en français', () => {
  assert.match(meetHtml, /<html lang="fr">/);
});

// ── Navigation Home <-> Meet Storm réellement câblée ─────────────────

test('Home câble réellement l\'action "discover" vers ROUTES.meetStorm -- jamais le toast "arrive dans la prochaine étape"', () => {
  assert.match(homeHtml, /meetStorm\s*:\s*'\/meet'/);
  assert.match(homeHtml, /action\.dataset\.action === 'discover'/);
  assert.match(homeHtml, /navigateWithDevUser\(ROUTES\.meetStorm\)/);
});

test('mode démo ?devUser= préservé lors de la navigation Home -> Meet Storm', () => {
  const idx = homeHtml.indexOf("action.dataset.action === 'discover'");
  const snippet = homeHtml.slice(idx, idx + 150);
  assert.match(snippet, /navigateWithDevUser/);
});

test('retour Meet Storm -> Home réutilise le même mécanisme de préservation ?devUser=', () => {
  assert.match(meetHtml, /function currentDevUser/);
  assert.match(meetHtml, /function homeUrl/);
  assert.match(meetHtml, /continueBtn.*addEventListener.*homeUrl\(\)|homeUrl\(\).*continueBtn/s);
});

// ── Aucun overclaim produit ───────────────────────────────────────────

test('Liquid Core jamais mentionné -- le runtime n\'existe pas encore', () => {
  assert.ok(!/Liquid Core/i.test(meetHtml));
});

test('Strata jamais mentionné', () => {
  assert.ok(!/Strata/i.test(meetHtml));
});

test('Storm Match totalement absent -- choix éditorial V1, rail non fermé', () => {
  assert.ok(!/Storm Match/i.test(meetHtml));
});

test('aucune mention de "tenant" ni de noms techniques de locale dans le texte visible', () => {
  assert.ok(!/tenant/i.test(meetHtml));
  assert.ok(!/workspaceLocale|contentLocale|interfaceLocale/.test(meetHtml));
});

// ── Narration complète, produit réel ──────────────────────────────────

test('les onze séquences narratives sont présentes, dans l\'ordre', () => {
  const ids = ['s-intro', 's-move', 's-home', 's-enter', 's-studio', 's-publish', 's-ivory', 's-pilotage', 's-control', 's-principle', 's-continue'];
  let lastIdx = -1;
  for (const id of ids) {
    const idx = meetHtml.indexOf(`id="${id}"`);
    assert.ok(idx > lastIdx, `${id} doit être présent et dans l'ordre narratif`);
    lastIdx = idx;
  }
});

test('Home -> projet -> Studio -> publication -> Ivory -> Pilotage -> Control tous représentés dans le récit', () => {
  assert.match(meetHtml, /Tous vos projets/);
  assert.match(meetHtml, /unité de travail/);
  assert.match(meetHtml, /Studio/);
  assert.match(meetHtml, /décidez du moment/);
  assert.match(meetHtml, /Ivory disparaît|Storm disparaît/);
  assert.match(meetHtml, /Voir ce qui aide/);
  assert.match(meetHtml, /échelle de l.organisation/);
});

test('le principe central apparaît après le parcours, jamais en ouverture', () => {
  const principleIdx = meetHtml.indexOf('Storm absorbe la complexité');
  const introIdx = meetHtml.indexOf('id="s-intro"');
  const controlIdx = meetHtml.indexOf('id="s-control"');
  assert.ok(principleIdx > introIdx);
  assert.ok(principleIdx > controlIdx, 'le principe doit venir après avoir montré le système, pas comme slogan initial');
});

test('intro très courte, aucun CTA immédiat', () => {
  const introIdx = meetHtml.indexOf('id="s-intro"');
  const moveIdx = meetHtml.indexOf('id="s-move"');
  const introSection = meetHtml.slice(introIdx, moveIdx);
  assert.ok(!/<button/i.test(introSection), 'aucun bouton/CTA dans le premier viewport');
  assert.match(introSection, /Meet Storm\./);
});

test('sortie naturelle unique -- un seul CTA final, jamais un menu de destinations', () => {
  const continueIdx = meetHtml.indexOf('id="s-continue"');
  const continueSection = meetHtml.slice(continueIdx);
  const buttons = continueSection.match(/<button/g) || [];
  assert.equal(buttons.length, 1, 'un seul CTA dans la séquence finale');
  assert.match(continueSection, /Voir mes projets/);
});

test('collaborateurs ne voient jamais Storm -- rappelé explicitement dans la séquence Ivory ou le principe', () => {
  assert.match(meetHtml, /collaborateurs ne voient jamais Storm|Storm disparaît/);
});

// ── Pas de grille de features SaaS ────────────────────────────────────

test('les grandes surfaces ne sont jamais présentées comme 4 cartes égales icône+titre+description', () => {
  assert.ok(!meetHtml.includes('surface-card'), 'ancien pattern de grille de features retiré');
});

// ── Mise en scène : plus qu\'un simple fade-in générique ──────────────

test('mise en scène dépasse "section entre dans le viewport -> opacity 1" -- transformations géométriques réelles', () => {
  assert.match(meetHtml, /transform:(?:scale|translateY)/);
  assert.match(meetHtml, /stroke-dashoffset/, 'la composition Pilotage anime un tracé, pas seulement une opacité');
  assert.match(meetHtml, /on-ivory/, 'le chrome réagit au passage vers Ivory, mise en scène continue');
});

test('rail de progression fonctionnel -- navigation réelle, jamais décoratif', () => {
  assert.match(meetHtml, /scrollIntoView/);
});

// ── Read-only / aucun appel API ────────────────────────────────────────

test('aucune action destructive, aucun formulaire, aucun appel API métier dans la page', () => {
  assert.ok(!/<form/i.test(meetHtml));
  assert.ok(!/fetch\(/i.test(meetHtml), 'contenu 100% statique, aucun appel réseau');
});

test('aucune donnée personnelle réelle (email, nom, ID) rendue', () => {
  assert.ok(!/@[a-z0-9.-]+\.[a-z]{2,}/i.test(meetHtml));
});

// ── Accessibilité / responsive / reduced motion ──────────────────────

test('reduced motion -- toute la narration reste lisible, aucune information ne disparaît, layout stable', () => {
  const idx = meetHtml.indexOf('prefers-reduced-motion:reduce');
  assert.ok(idx >= 0);
  const snippet = meetHtml.slice(idx, idx + 400);
  assert.match(snippet, /opacity:1!important/);
  assert.match(snippet, /transform:none!important/);
});

test('structure de titres cohérente -- un seul h1', () => {
  const h1Count = (meetHtml.match(/<h1/g) || []).length;
  assert.equal(h1Count, 1, 'un seul h1 sur la page');
  assert.ok((meetHtml.match(/<h2/g) || []).length >= 5, 'plusieurs sections structurées par h2');
});

test('media query responsive présente (mobile/tablette), grilles simplifiées', () => {
  assert.match(meetHtml, /@media\(max-width:720px\)/);
});

test('focus visible sur les éléments interactifs (CTA, rail, retour Home)', () => {
  assert.match(meetHtml, /:focus-visible/);
});

test('aria-hidden sur les compositions visuelles purement décoratives, jamais un sens porté uniquement par la couleur/animation', () => {
  const ariaHiddenCount = (meetHtml.match(/aria-hidden="true"/g) || []).length;
  assert.ok(ariaHiddenCount >= 5, 'les compositions UI-natives abstraites doivent être masquées aux lecteurs d\'écran, le texte porte le sens');
});

// ── Aucun nouveau mécanisme backend / IAM ─────────────────────────────

test('aucune nouvelle capability créée pour Meet Storm', () => {
  assert.ok(!/CAP\.MEET|MEET_STORM\s*:\s*'/.test(homeHtml));
});
