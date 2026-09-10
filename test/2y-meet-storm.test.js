import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import { loadConfig } from '../src/config/env.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { createApp } from '../src/http/app.js';
import { createStorageAdapter } from '../src/adapters/storage/index.js';

// Découvrez Storm (route /meet) -- Orogeny V1. Surface éditoriale
// interne, entièrement statique (aucune nouvelle route API, aucune
// capability dédiée), accessible depuis Storm Home. Ces tests portent
// sur le contenu source livré par /meet et sur le câblage réel depuis
// /home.html -- jamais des snapshots pixel, des contrats sémantiques.
//
// Renommage produit : le nom affiché à l'utilisateur est "Découvrez
// Storm" (jamais "Meet Storm" dans le texte visible) -- la route
// technique /meet reste inchangée par choix explicite (correction de
// langage produit, pas de chantier de routing). "Ivory" n'est jamais
// utilisé comme synonyme de surface collaborateur -- c'est un thème
// visuel parmi d'autres (Ivory, Midnight Frost, Rainbow Glass), jamais
// mentionné comme tel dans cette narration. Le terme produit retenu
// est "expérience collaborateurs". Le mot "Ivory" peut néanmoins
// subsister dans des commentaires de code ou des identifiants
// techniques internes (id="s-ivory", class="seq-ivory") -- jamais
// visibles à l'utilisateur ni aux technologies d'assistance.

const config = loadConfig();
const pool = getPool(config);
const storageAdapter = createStorageAdapter(config);
const silentLogger = { info() {}, warn() {}, error() {} };

let app, server, baseUrl, meetHtml, homeHtml;

// Texte visible = tout sauf les commentaires HTML/CSS/JS, le contenu
// de <script>/<style>, et les attributs techniques (class, id) qui ne
// sont jamais montrés à l'utilisateur ni aux technologies
// d'assistance. Les attributs réellement user-facing (alt,
// aria-label, data-title -- ce dernier alimentant l'aria-label du
// rail) sont réinjectés explicitement pour rester couverts.
function visibleText(html) {
  const withoutNoise = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script>[\s\S]*?<\/script>/g, '')
    .replace(/<style>[\s\S]*?<\/style>/g, '');
  const userFacingAttrs = [...withoutNoise.matchAll(/\s(?:alt|aria-label|data-title|title)="([^"]*)"/g)]
    .map(m => m[1]).join(' ');
  const bodyText = withoutNoise.replace(/<[^>]+>/g, ' ');
  return `${bodyText} ${userFacingAttrs}`;
}

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

test('GET /meet sert la page -- la route technique reste inchangée malgré le renommage produit', async () => {
  const res = await fetch(`${baseUrl}/meet`);
  assert.equal(res.status, 200);
});

test('page en français', () => {
  assert.match(meetHtml, /<html lang="fr">/);
});

// ── Renommage produit : Découvrez Storm ──────────────────────────────

test('"Découvrez Storm" présent -- titre de page, topbar et scène d\'ouverture', () => {
  assert.match(meetHtml, /<title>Découvrez Storm — Orogeny<\/title>/);
  assert.match(meetHtml, /<span>Découvrez Storm<\/span>/);
  assert.match(meetHtml, /<h1 class="mark">Découvrez Storm\.<\/h1>/);
});

test('"Meet Storm" absent du texte visible (peut subsister dans un commentaire de code non rendu)', () => {
  const visible = visibleText(meetHtml);
  assert.ok(!/Meet Storm/i.test(visible));
});

test('bouton "Storm Home" inchangé (non concerné par le renommage)', () => {
  assert.match(meetHtml, />Storm Home</);
});

// ── Ivory n'est jamais un nom de surface collaborateur ───────────────

test('"Ivory" absent du texte visible et de l\'aria-label du rail de navigation (data-title alimente aria-label)', () => {
  const visible = visibleText(meetHtml);
  assert.ok(!/Ivory/i.test(visible), 'Ivory ne doit jamais apparaître dans le texte rendu à l\'utilisateur');
  assert.ok(!meetHtml.includes('data-title="Ivory"'), 'le data-title alimente aria-label du rail -- jamais "Ivory" ici');
});

test('"expérience collaborateurs" utilisé comme terme produit -- jamais un nouveau nom de marque inventé', () => {
  assert.match(meetHtml, /expérience collaborateurs/);
});

test('modèle de thèmes non modifié -- aucune section thèmes ajoutée, Midnight Frost/Rainbow Glass non introduits', () => {
  assert.ok(!/Midnight Frost/i.test(meetHtml));
  assert.ok(!/Rainbow Glass/i.test(meetHtml));
});

// ── Aucun overclaim produit ───────────────────────────────────────────

test('Storm Match jamais présenté comme runtime déjà actif', () => {
  const idx = meetHtml.indexOf('id="s-liquidcore"');
  const end = meetHtml.indexOf('</section>', idx);
  const snippet = meetHtml.slice(idx, end);
  assert.ok(!/[Dd]isponible|[Aa]ctif\b|déjà traitées|en cours de traitement/.test(snippet));
});

test('Storm Match apparaît uniquement dans sa propre scène (jamais une scène séparée, jamais un claim de surface utilisateur) -- Liquid Core y est mentionné comme le nom du versioning', () => {
  const idx = meetHtml.indexOf('id="s-liquidcore"');
  const end = meetHtml.indexOf('</section>', idx);
  const liquidCoreSection = meetHtml.slice(idx, end);
  assert.match(liquidCoreSection, /<h2>Storm Match<\/h2>/, 'Storm Match doit être le titre visible de cette scène');
  assert.match(liquidCoreSection, /Liquid Core/, 'Liquid Core doit y être mentionné comme le nom du versioning');

  // Hors de cette section (et hors de l'alt du badge officiel), Storm
  // Match ne doit apparaître nulle part -- ni scène séparée, ni carte,
  // ni claim de surface.
  const withoutLiquidCoreSection = meetHtml.slice(0, idx) + meetHtml.slice(end);
  const withoutAlt = withoutLiquidCoreSection.replace(/alt="Storm Match — Liquid Core"/g, '');
  assert.ok(!/Storm Match/i.test(withoutAlt), 'aucune autre mention de Storm Match ailleurs sur la page');
});

test('Strata jamais mentionné', () => {
  assert.ok(!/Strata/i.test(meetHtml));
});

test('aucune mention de "tenant" (mot entier) ni de noms techniques de locale dans le texte visible', () => {
  const visible = visibleText(meetHtml);
  assert.ok(!/\btenant\b/i.test(visible), 'jamais le mot "tenant" isolé -- "maintenant" etc. ne doivent jamais déclencher ce test');
  assert.ok(!/workspaceLocale|contentLocale|interfaceLocale/.test(visible));
});

// ── Nouveaux textes -- source de vérité éditoriale ───────────────────

test('scène 1 -- Découvrez Storm, nouvelle copie complète, ancien texte retiré', () => {
  assert.match(meetHtml, /Un projet workplace ne suit jamais exactement le plan/);
  assert.ok(!meetHtml.includes("Un projet workplace ne s'arrête jamais vraiment."));
});

test('scène 3 -- Orogeny, nouvelle copie, jamais "de Home à Ivory"', () => {
  assert.match(meetHtml, /Orogeny 1\.2/);
  assert.match(meetHtml, /pensée pour suivre le projet de Home à l'expérience collaborateurs/);
  assert.ok(!/de Home à Ivory/i.test(meetHtml));
});

test('scène 4 -- le projet bouge, nouvelle copie complète', () => {
  assert.match(meetHtml, /Un plan change\./);
  assert.match(meetHtml, /Une date glisse\./);
  assert.match(meetHtml, /Storm garde les contenus, les décisions et l'expérience alignés au fil du mouvement/);
});

test('scène 5 -- Home, nouvelle headline et copy, ancien texte retiré', () => {
  assert.match(meetHtml, /Tous vos projets, au même endroit\./);
  assert.match(meetHtml, /Home vous montre seulement les projets auxquels vous avez accès/);
  assert.ok(!meetHtml.includes('Un seul point de départ.'));
});

test('scène 6 -- le projet, nouvelle copy explicative', () => {
  assert.match(meetHtml, /Chaque projet a son propre espace de travail, ses contenus, son équipe et ses droits/);
  assert.ok(!meetHtml.includes("Le projet est l'unité de travail."));
});

test('scène 7 -- Studio, copy explicative complète, ancien texte retiré', () => {
  assert.match(meetHtml, /Le projet prend forme ici\. Vous structurez ce que les collaborateurs doivent comprendre/);
  assert.match(meetHtml, /vous construisez une expérience, pas une pile de pages/i);
  assert.ok(!meetHtml.includes('Ce qui doit être dit prend forme ici.'));
});

test('scène 8 -- Storm Match, copy explicatif complet (pas seulement logo + tagline mystérieuse)', () => {
  assert.match(meetHtml, /Comprendre avant de répondre\./);
  assert.match(meetHtml, /Storm Match est conçu pour vérifier d'abord si une question est réellement couverte/);
  assert.match(meetHtml, /C'est la version Liquid Core du moteur/);
});

test('scène 9 -- Publication, nouvelle headline et copy, anciens textes retirés', () => {
  assert.match(meetHtml, /<h2 class="principle-lead" style="margin:0">Publication\.<\/h2>/);
  assert.match(meetHtml, /Vous pouvez modifier sans publier/);
  assert.ok(!meetHtml.includes("Ce qui est modifié n'est pas encore ce qui est vu."));
});

test('scène 10 -- expérience collaborateurs, headline conservée, copy complet, mot Ivory absent', () => {
  assert.match(meetHtml, /<h2[^>]*>Pour les collaborateurs, Storm disparaît\.<\/h2>/);
  assert.match(meetHtml, /Pas de Studio, pas de Control, pas de coulisses/);
  const idx = meetHtml.lastIndexOf('<section', meetHtml.indexOf('id="s-ivory"'));
  const end = meetHtml.indexOf('</section>', idx);
  const visible = visibleText(meetHtml.slice(idx, end));
  assert.ok(!/Ivory/i.test(visible));
});

test('scène 11 -- Pilotage, copy complet', () => {
  assert.match(meetHtml, /Pilotage montre ce qui est réellement consulté et comment l'expérience est utilisée/);
  assert.match(meetHtml, /pas d'intuitions/);
});

test('scène 12 -- Confidentialité, copy complet, aucun chiffre/RGPD/certification', () => {
  assert.match(meetHtml, /La confidentialité n'est pas un réglage ajouté à la fin/);
  assert.match(meetHtml, /Les accès restent liés aux responsabilités de chacun/);
  const idx = meetHtml.indexOf('id="s-privacy"');
  const end = meetHtml.indexOf('</section>', idx);
  const snippet = meetHtml.slice(idx, end);
  assert.ok(!/\d+\s*(jours|mois|ans)/.test(snippet));
  assert.ok(!/GDPR|RGPD|certifi|conforme|compliance/i.test(snippet));
});

test('scène 13 -- Control, copy complet', () => {
  assert.match(meetHtml, /Control donne la vue d'ensemble\s*:\s*projets, membres, accès, cycle de vie et données/);
});

test('scène 14 -- principe final réécrit, jamais "Ivory reste une expérience à part entière"', () => {
  assert.match(meetHtml, /La complexité reste derrière\./);
  assert.match(meetHtml, /Storm absorbe la complexité\. Vous gardez la décision\./);
  assert.match(meetHtml, /Et côté collaborateurs, Storm s'efface derrière l'expérience publiée/);
  assert.ok(!meetHtml.includes('Ivory reste une expérience à part entière'));
  assert.ok(!meetHtml.includes("Les droits suivent les responsabilités.</b> Jamais l'inverse."));
});

test('scène 15 -- continuer, nouvelle copy, CTA exact sans flèche ni icône', () => {
  assert.match(meetHtml, /Vous savez maintenant où commencer\./);
  const idx = meetHtml.indexOf('id="continueBtn"');
  const snippet = meetHtml.slice(idx, idx + 120);
  assert.match(snippet, />Voir mes projets</, 'le CTA doit être exactement "Voir mes projets"');
  assert.ok(!/→|➜|chevron|arrow/i.test(snippet), 'aucune flèche/chevron/icône adjacente au CTA');
});

// ── Navigation Home <-> Découvrez Storm réellement câblée ────────────

test('Home câble réellement l\'action "discover" vers ROUTES.meetStorm', () => {
  assert.match(homeHtml, /meetStorm\s*:\s*'\/meet'/);
  assert.match(homeHtml, /action\.dataset\.action === 'discover'/);
  assert.match(homeHtml, /navigateWithDevUser\(ROUTES\.meetStorm\)/);
});

test('mode démo ?devUser= préservé dans les deux sens', () => {
  const idx = homeHtml.indexOf("action.dataset.action === 'discover'");
  assert.match(homeHtml.slice(idx, idx + 150), /navigateWithDevUser/);
  assert.match(meetHtml, /function currentDevUser/);
  assert.match(meetHtml, /function homeUrl/);
});

// ── Vrais écrans produit intégrés ──────────────────────────────────────

test('les cinq screens réels et le visuel Liquid Core sont intégrés et servis réellement', async () => {
  for (const name of ['liquid-core', 'meet-home', 'meet-enter', 'meet-studio', 'meet-ivory', 'meet-pilotage', 'meet-orogeny', 'storm-control-product-stage', 'meet-publish-1', 'meet-publish-2', 'meet-publish-3']) {
    const res = await fetch(`${baseUrl}/meet-assets/${name}.webp`);
    assert.equal(res.status, 200, `${name}.webp doit être servi`);
    assert.equal(res.headers.get('content-type'), 'image/webp');
  }
});

test('aucune image avec filigrane/watermark de banque d\'images', () => {
  assert.ok(!/shutterstock|getty|istock|watermark|filigrane/i.test(meetHtml));
});

test('Orogeny 1.2 -- vrai visuel intégré (photo licenciée, sans filigrane), jamais un placeholder', () => {
  assert.match(meetHtml, /id="generationVisual"/);
  assert.match(meetHtml, /src="\/meet-assets\/meet-orogeny\.webp"/);
});

// ── Read-only / aucune action destructive / aucun appel API ─────────

test('aucun formulaire, aucun appel API métier dans la page', () => {
  assert.ok(!/<form/i.test(meetHtml));
  assert.ok(!/fetch\(/i.test(meetHtml));
});

test('aucune donnée personnelle réelle rendue', () => {
  assert.ok(!/@[a-z0-9.-]+\.[a-z]{2,}/i.test(meetHtml));
});

// ── Accessibilité / responsive / reduced motion ──────────────────────

test('reduced motion -- narration reste lisible, état final compréhensible', () => {
  const idx = meetHtml.indexOf('prefers-reduced-motion:reduce');
  const snippet = meetHtml.slice(idx, idx + 500);
  assert.match(snippet, /opacity:1!important/);
  assert.match(snippet, /lock-shackle\{transform:translateX\(-50%\) rotate\(0deg\)/);
});

test('un seul h1, hiérarchie h2 par section', () => {
  assert.equal((meetHtml.match(/<h1/g) || []).length, 1);
  assert.ok((meetHtml.match(/<h2/g) || []).length >= 8);
});

test('media query responsive présente', () => {
  assert.match(meetHtml, /@media\(max-width:720px\)/);
});

test('focus visible sur les éléments interactifs', () => {
  assert.match(meetHtml, /:focus-visible/);
});

test('images produit réelles ont un texte alt informatif', () => {
  for (const name of ['meet-home-macbook', 'meet-studio', 'meet-ivory', 'meet-pilotage']) {
    const idx = meetHtml.indexOf(`/meet-assets/${name}.webp`);
    assert.match(meetHtml.slice(idx, idx + 150), /alt="[^"]+"/);
  }
});

test('aucune nouvelle capability créée pour Découvrez Storm', () => {
  assert.ok(!/CAP\.MEET|MEET_STORM\s*:\s*'/.test(homeHtml));
});

// ── FERMETURE — retrait de l'effet "carte contrainte", plein cadre ──

test('scène "Le projet" -- photo en plein cadre (pattern bleed), jamais un rectangle contraint dans le canvas', () => {
  assert.match(meetHtml, /<section class="stage bleed seq-enter"/);
  assert.match(meetHtml, /<div class="bleed-media"><img src="\/meet-assets\/meet-enter\.webp"/);
  assert.ok(!meetHtml.includes('enter-frame'), 'ancienne classe de cadre contraint entièrement retirée');
});

test('scène Orogeny -- même traitement plein cadre que Storm Match, vrai visuel intégré', () => {
  assert.match(meetHtml, /<section class="stage bleed seq-generation"[^>]*data-dark/);
  assert.match(meetHtml, /<div class="bleed-media" id="generationVisual"><img src="\/meet-assets\/meet-orogeny\.webp"/);
  assert.ok(!meetHtml.includes('generation-frame'), 'ancienne classe de cadre contraint entièrement retirée');
});

test('scène "Storm disparaît" -- plus de carte blanche imbriquée, le screenshot flotte directement', () => {
  assert.ok(!meetHtml.includes('ivory-frame'), 'ancienne carte imbriquée entièrement retirée');
  const idx = meetHtml.indexOf('id="s-ivory"');
  const end = meetHtml.indexOf('</section>', idx);
  assert.match(meetHtml.slice(idx, end), /class="screen-frame"/);
});

test('écrans produit (Home/Studio/Ivory/Pilotage) -- flottent sans ombre ni carte, plus grands qu\'avant', () => {
  const idx = meetHtml.indexOf('.screen-frame{');
  const snippet = meetHtml.slice(idx, idx + 200);
  assert.ok(!/box-shadow/.test(snippet), 'jamais d\'ombre de carte sur les écrans produit');
  assert.match(snippet, /width:min\(760px/, 'notablement plus grand que la version carte initiale (560px)');
});

test('effet d\'échelle à l\'entrée sur les médias plein cadre -- jamais un simple fade-in statique', () => {
  assert.match(meetHtml, /\.bleed-media img\{[^}]*transform:scale\(1\.1\)/);
  assert.match(meetHtml, /\.stage\.bleed\.in \.bleed-media img\{transform:scale\(1\)\}/);
});

test('reduced motion -- couvre aussi les nouveaux éléments plein cadre', () => {
  const idx = meetHtml.indexOf('prefers-reduced-motion:reduce');
  const snippet = meetHtml.slice(idx, idx + 400);
  assert.match(snippet, /\.bleed-media/);
  assert.match(snippet, /\.bleed-caption/);
});

// ── FERMETURE — Control et Publication : vrais visuels ───────────────

test('Control -- vrai product stage macro→micro intégré (organisation + projet superposés), jamais un screenshot seul dans un cadre générique', () => {
  assert.match(meetHtml, /src="\/meet-assets\/storm-control-product-stage\.webp"/);
  assert.match(meetHtml, /<div class="control-stage"><img src="\/meet-assets\/storm-control-product-stage\.webp"/, 'jamais enveloppé dans .screen-frame -- l\'asset porte déjà sa propre composition/profondeur');
  assert.ok(!meetHtml.includes('control-scope'), 'ancienne composition abstraite entièrement retirée');
});

test('Publication -- fondu enchaîné réel des trois états Command Layer (enregistré, prêt à publier, publié), jamais les boîtes abstraites', () => {
  assert.match(meetHtml, /src="\/meet-assets\/meet-publish-1\.webp"/);
  assert.match(meetHtml, /src="\/meet-assets\/meet-publish-2\.webp"/);
  assert.match(meetHtml, /src="\/meet-assets\/meet-publish-3\.webp"/);
  assert.ok(!meetHtml.includes('publish-layers'), 'ancienne composition abstraite entièrement retirée');
});

test('Publication -- animation de fondu enchaîné réelle, jamais un simple fade-in statique', () => {
  assert.match(meetHtml, /@keyframes publish-cycle/);
  assert.match(meetHtml, /animation:publish-cycle 6s ease-in-out infinite/);
});

test('reduced motion -- Publication affiche uniquement l\'état final "publié", jamais l\'animation forcée', () => {
  const idx = meetHtml.indexOf('prefers-reduced-motion:reduce');
  const snippet = meetHtml.slice(idx, idx + 500);
  assert.match(snippet, /\.cycle-frame\{opacity:0!important\}/);
  assert.match(snippet, /\.cycle-frame:nth-child\(3\)\{opacity:1!important\}/);
});

test('aucune image avec filigrane -- vérification maintenue après ajout des nouveaux visuels', () => {
  assert.ok(!/shutterstock|getty|istock|watermark|filigrane/i.test(meetHtml));
});

test('Home -- mockup MacBook réel intégré, jamais le screenshot plat encadré précédent', () => {
  assert.match(meetHtml, /src="\/meet-assets\/meet-home-macbook\.webp"/);
  assert.ok(!meetHtml.includes('/meet-assets/meet-home.webp'), 'ancien visuel encadré retiré');
});

test('Home -- mockup MacBook jamais enfermé dans le cadre générique .screen-frame (pas de recadrage/coin arrondi sur un visuel qui porte déjà son propre cadre)', () => {
  const idx = meetHtml.indexOf('meet-home-macbook.webp');
  const before = meetHtml.slice(Math.max(0, idx - 200), idx);
  assert.match(before, /class="mac-frame"/);
  assert.ok(!before.includes('class="screen-frame"'), 'jamais le cadre générique sur ce visuel');
});

test('Home -- .mac-frame n\'introduit ni bordure ni recadrage (le mockup porte déjà son propre cadre et son ombre)', () => {
  const idx = meetHtml.indexOf('.mac-frame{');
  const rule = meetHtml.slice(idx, idx + 200);
  assert.ok(!/border-radius|overflow:hidden/.test(rule), 'jamais de recadrage sur un visuel déjà encadré nativement');
});

test('Home -- conteneur élargi spécifiquement pour cette scène, jamais pour les autres (le mockup reste la pièce maîtresse)', () => {
  assert.match(meetHtml, /\.seq-home \.stage-inner\{width:min\(1040px,100%\)\}/);
  assert.ok(!meetHtml.includes('.seq-studio .stage-inner{width:min(1040px'), 'jamais élargi pour les autres scènes');
});

test('Home -- reduced motion couvre bien .mac-frame (même garde-fou que les autres visuels)', () => {
  const idx = meetHtml.indexOf('prefers-reduced-motion:reduce');
  const snippet = meetHtml.slice(idx, idx + 400);
  assert.match(snippet, /\.mac-frame/);
});

test('Home -- alt texte fidèle au contenu réel du mockup, jamais générique/vide', () => {
  const idx = meetHtml.indexOf('meet-home-macbook.webp');
  const tag = meetHtml.slice(idx, idx + 200);
  assert.match(tag, /alt="[^"]{15,}"/);
});

test('Control -- aucune dépendance au MacBook, scène volontairement différente de Home (product stage frontal, pas un device)', () => {
  const idx = meetHtml.indexOf('s-control');
  const end = meetHtml.indexOf('</section>', idx);
  const snippet = meetHtml.slice(idx, end);
  assert.ok(!snippet.includes('mac-frame'));
  assert.ok(!snippet.includes('meet-home-macbook'));
});

test('Control -- taille ample dédiée (~1120px), pas la largeur standard étroite des autres scènes texte+screenshot', () => {
  const idx = meetHtml.indexOf('.control-stage{');
  const css = meetHtml.slice(idx, idx + 100);
  assert.match(css, /width:min\(1120px,calc\(100vw - 64px\)\)/);
});

test('Control -- alt texte reflète la hiérarchie macro→micro réelle (organisation ET projet), jamais un texte générique', () => {
  const idx = meetHtml.indexOf('storm-control-product-stage.webp');
  const tag = meetHtml.slice(idx, idx + 300);
  assert.match(tag, /alt="[^"]*organisation[^"]*"/i);
  assert.match(tag, /alt="[^"]*Clermont-Ferrand[^"]*"/);
});

test('Control -- ancien asset meet-control.webp démontrablement mort, retiré du disque (aucune référence résiduelle)', async () => {
  assert.ok(!meetHtml.includes('meet-control.webp'));
  const { existsSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const path = await import('node:path');
  const dir = path.dirname(fileURLToPath(import.meta.url));
  assert.ok(!existsSync(path.join(dir, '..', 'public', 'meet-assets', 'meet-control.webp')));
});

test('Control -- copie textuelle inchangée ("Storm, à l\'échelle de l\'organisation."), non réécrite par cette passe', () => {
  assert.match(meetHtml, /Storm, à l.échelle de l.organisation\./);
});
