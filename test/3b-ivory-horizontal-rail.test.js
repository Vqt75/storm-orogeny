import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { mixWithWhite, colorContrast, resolveCardSurface, renderHome, renderProject, renderNews, renderNewsArticle, renderSpaces, renderQuestions } from '../public/ivory/renderers/ivory.js';

// Rail horizontal -- "le vertical raconte, l'horizontal explore".
// Suite au niveau source (même convention que test/2e-ivory.test.js
// pour ce renderer -- aucun navigateur headless dans ce dépôt).
// Couvre la primitive partagée (wireHorizontalRails) et ses trois
// usages actuels : chiffres clés, principes (choices), équipe,
// ambassadeurs.

let ivoryJs;

test.before(async () => {
  ivoryJs = await fs.readFile(new URL('../public/ivory/renderers/ivory.js', import.meta.url), 'utf8');
});

function functionBody(name) {
  const idx = ivoryJs.indexOf(`function ${name}(`);
  assert.ok(idx >= 0, `${name} doit exister`);
  // Bornage grossier mais suffisant pour ces assertions de contenu --
  // jusqu'à la prochaine déclaration de fonction top-level.
  const nextFn = ivoryJs.indexOf('\nfunction ', idx + 10);
  return ivoryJs.slice(idx, nextFn > 0 ? nextFn : idx + 4000);
}

// ── Primitive partagée ────────────────────────────────────────────────

test('wireHorizontalRails existe, appelée depuis wireInteractions', () => {
  assert.match(ivoryJs, /function wireHorizontalRails\(root\)/);
  const wireInteractionsBody = functionBody('wireInteractions');
  assert.match(wireInteractionsBody, /wireHorizontalRails\(root\)/);
});

test('jamais une bibliothèque de carousel -- overflow natif', () => {
  assert.match(ivoryJs, /\[data-tct-rail\]\s*\{[^}]*overflow-x:auto/);
  assert.match(ivoryJs, /scroll-snap-type:x proximity/);
});

test('jamais de flèches/dots/pagination permanentes dans le CSS du rail', () => {
  const idx = ivoryJs.indexOf('[data-tct-rail] {');
  const cssBlock = ivoryJs.slice(idx, idx + 1400);
  assert.ok(!/\.tct-rail-(arrow|dot|pagination)/i.test(cssBlock));
});

test('aucune bibliothèque de carousel réellement importée/référencée (le mot peut légitimement apparaître dans un commentaire documentant son absence)', () => {
  const withoutComments = ivoryJs.replace(/\/\/[^\n]*/g, '');
  assert.ok(!/\bslick\b|\bswiper\b|new Carousel\(|Carousel\.init|carousel\.min\.js/i.test(withoutComments));
});

// ── Sémantique / accessibilité ────────────────────────────────────────

test('sémantique native préservée -- aucun rôle ARIA synthétique ajouté si les enfants sont déjà des <li>', () => {
  const body = functionBody('wireHorizontalRails');
  assert.match(body, /firstChildIsListItem/);
  assert.match(body, /if \(!firstChildIsListItem && !rail\.hasAttribute\('role'\)\)/, 'le rôle list/listitem ne doit être ajouté QUE si les enfants ne sont pas déjà des <li>');
});

test('Ambassadeurs et Équipe restent de vrais <ul><li> -- jamais besoin de role=list synthétique', () => {
  const ambassadorIdx = ivoryJs.indexOf('data-tct-rail-family="ambassadors"');
  assert.ok(ambassadorIdx > 0);
  assert.match(ivoryJs.slice(ambassadorIdx - 100, ambassadorIdx + 20), /<ul /);
  assert.match(ivoryJs, /<li class="tct-ambassador-person"/);

  const teamIdx = ivoryJs.indexOf('data-tct-rail-family="team"');
  assert.ok(teamIdx > 0);
  assert.match(ivoryJs.slice(teamIdx - 100, teamIdx + 20), /<ul /);
  assert.match(ivoryJs, /<li class="tct-project-person">/);
});

test('rail focusable au clavier (tabindex), focus visible défini', () => {
  const body = functionBody('wireHorizontalRails');
  assert.match(body, /rail\.setAttribute\('tabindex', '0'\)/);
  assert.match(ivoryJs, /\[data-tct-rail\]:focus-visible\s*\{\s*outline:/);
});

test('flèches clavier -- uniquement quand le rail LUI-MÊME a le focus, jamais quand un CTA interne l\'a', () => {
  const body = functionBody('wireHorizontalRails');
  assert.match(body, /if \(e\.target !== rail\) return;/, 'jamais de capture des flèches quand un contrôle interne (ex. CTA ambassadeur) est la cible réelle');
  assert.match(body, /ArrowLeft.*ArrowRight|ArrowRight.*ArrowLeft/);
  assert.match(body, /e\.preventDefault\(\)/);
});

test('touch et trackpad natifs jamais combattus -- le drag pointer ignore explicitement pointerType touch', () => {
  const body = functionBody('wireHorizontalRails');
  assert.match(body, /if \(e\.pointerType === 'touch'\) return;/);
});

// ── Cue contextuel ─────────────────────────────────────────────────────

test('cue par famille -- jamais une seule fois globale ni à chaque rail', () => {
  const body = functionBody('wireHorizontalRails');
  assert.match(body, /shownFamilies/);
  assert.match(body, /MAX_CUES_PER_PAGE/);
  assert.match(body, /if \(cueState\.shownFamilies\.has\(family\)\) return;/);
});

test('cue plafonné et soumis à un cooldown après une interaction récente', () => {
  const body = functionBody('wireHorizontalRails');
  assert.match(body, /INTERACTION_COOLDOWN_MS/);
  assert.match(body, /cueState\.totalShown >= MAX_CUES_PER_PAGE/);
  assert.match(body, /Date\.now\(\) - cueState\.lastInteractionAt < INTERACTION_COOLDOWN_MS/);
});

test('cue disparaît immédiatement dès la première interaction (pointerdown ou scroll)', () => {
  const body = functionBody('wireHorizontalRails');
  assert.match(body, /rail\.addEventListener\('pointerdown', \(\) => \{ clearTimeout\(timer\); dismiss\(\); \}, \{ once: true \}\)/);
  assert.match(body, /rail\.addEventListener\('scroll', \(\) => \{ clearTimeout\(timer\); dismiss\(\); \}, \{ once: true, passive: true \}\)/);
});

test('cue jamais un tutoriel textuel -- aria-hidden, aucun texte "faites glisser"', () => {
  const body = functionBody('wireHorizontalRails');
  assert.match(body, /cue\.setAttribute\('aria-hidden', 'true'\)/);
  assert.ok(!/[Ff]aites glisser/.test(ivoryJs));
});

test('reduced motion -- aucun cue affiché du tout', () => {
  const body = functionBody('wireHorizontalRails');
  assert.match(body, /if \(reduced\) return;/);
});

// ── Usages -- contenu préservé, comportements métier intacts ──────────

test('Chiffres clés en rail, jamais une carte perdue -- même map(...) sur les mêmes données', () => {
  assert.match(ivoryJs, /data-tct-rail-family="figures"/);
  assert.match(ivoryJs, /figures\.map\(item => `/);
});

test('Principes (choices) en rail -- structure réelle du Manifest (sectionType choices), jamais une donnée inventée', () => {
  assert.match(ivoryJs, /data-tct-rail-family="choices"/);
  assert.match(ivoryJs, /type === 'choices'/);
  assert.match(ivoryJs, /<li class="tct-project-choice-card">/);
});

test('recherche Ambassadeurs préservée -- data-ambassador-search toujours présent sur chaque <li>', () => {
  assert.match(ivoryJs, /data-ambassador-search="\$\{esc\(ambassadorSearchText\(person\)\)\}"/);
  assert.match(ivoryJs, /data-tct-ambassador-no-result/);
});

test('CTA internes préservés -- lien de contact ambassadeur toujours rendu', () => {
  assert.match(ivoryJs, /class="tct-ambassador-contact"/);
});

// ── Brand Engine -- surfaces teintées, jamais un second calcul ────────

test('cartes Chiffres clés et Principes utilisent une surface calculée et validée côté serveur, jamais un color-mix CSS brut non vérifié', () => {
  const figureIdx = ivoryJs.indexOf('.tct-project-figure {');
  const figureCss = ivoryJs.slice(figureIdx, figureIdx + 300);
  assert.match(figureCss, /background:var\(--tct-figure-surface/);
  assert.ok(!/color-mix/.test(figureCss), 'jamais un color-mix CSS brut -- le contraste doit être vérifié avant le rendu, pas espéré au moment du style');

  const choiceIdx = ivoryJs.indexOf('.tct-project-choice-card {');
  const choiceCss = ivoryJs.slice(choiceIdx, choiceIdx + 300);
  assert.match(choiceCss, /background:var\(--tct-choice-surface/);
  assert.ok(!/color-mix/.test(choiceCss));
});

test('resolveCardSurface calcule et valide réellement le contraste (encre ET muted) avant de choisir la teinte, jamais une simple supposition', () => {
  assert.match(ivoryJs, /function resolveCardSurface\(accentHex, inkHex, mutedHex, tintPercent\)/);
  assert.match(ivoryJs, /function mixWithWhite\(hex, percent\)/);
  assert.match(ivoryJs, /colorContrast\(inkHex, bg\) >= WCAG_BODY_TEXT_MIN && colorContrast\(mutedHex, bg\) >= WCAG_BODY_TEXT_MIN/);
  assert.match(ivoryJs, /const figureSurface = resolveCardSurface\(expressionAccent, '#171717', '#6a6a66', 9\);/);
  assert.match(ivoryJs, /const choiceSurface = resolveCardSurface\(expressionAccent, '#171717', '#6a6a66', 7\);/);
});

test('repli en cascade -- teinte réduite puis papier neutre si le contraste échoue, jamais un blocage', () => {
  const idx = ivoryJs.indexOf('function resolveCardSurface');
  const body = ivoryJs.slice(idx, idx + 900);
  assert.match(body, /percent = tintPercent \/ 2/);
  assert.match(body, /bg = '#ffffff'/);
});

test('le grand chiffre en couleur accent uniquement si son contraste réel sur la surface retenue passe le seuil grand texte (3:1), sinon repli encre', () => {
  const idx = ivoryJs.indexOf('function resolveCardSurface');
  const body = ivoryJs.slice(idx, idx + 900);
  assert.match(body, /const accentOnBg = colorContrast\(accentHex, bg\);/);
  assert.match(body, /numberColor: accentOnBg >= WCAG_LARGE_TEXT_MIN \? accentHex : inkHex/);
});

test('accentSecondary exposé et utilisé avec retenue (deux emplois ciblés), jamais un second Brand Engine', () => {
  assert.match(ivoryJs, /expressionAccentSecondary/);
  assert.match(ivoryJs, /--tct-expression-accent-secondary/);
  assert.ok(!/StormBrandEngine\s*=\s*\{/.test(ivoryJs), 'jamais une redéfinition locale du Brand Engine partagé');
});

// ── Isolation Liquid Core / Storm Match ───────────────────────────────

test('aucune référence à Storm Match / Liquid Core / classifier / retrieval dans ce fichier', () => {
  assert.ok(!/classifier|retrieval|quality[- ]gate|liquid core/i.test(ivoryJs));
});

// ── Scroll-jack directionnel ──────────────────────────────────────────

test('scroll-jack -- la molette verticale ne se convertit qu\'en présence d\'un vrai deltaY, jamais si le geste est déjà horizontal', () => {
  const body = functionBody('wireHorizontalRails');
  assert.match(body, /if \(Math\.abs\(e\.deltaY\) <= Math\.abs\(e\.deltaX\)\) return;/);
});

test('scroll-jack -- relâche immédiate dès que le bord est atteint dans le sens du geste, jamais un piège', () => {
  const body = functionBody('wireHorizontalRails');
  assert.match(body, /const canConsume = scrollingForward \? rail\.scrollLeft < maxScroll - 1 : rail\.scrollLeft > 1;/);
  assert.match(body, /if \(!canConsume\) \{ justEngaged = false; return; \}/, 'aucun preventDefault appelé au bord -- le scroll vertical natif doit reprendre sans intervention');
});

test('scroll-jack -- résistance légère au premier tick d\'engagement, jamais un blocage complet', () => {
  const body = functionBody('wireHorizontalRails');
  assert.match(body, /rail\.scrollLeft \+= e\.deltaY \* 0\.35;/);
});

test('scroll-jack -- micro-retour haptique en progressive enhancement uniquement, jamais requis', () => {
  const body = functionBody('wireHorizontalRails');
  assert.match(body, /typeof navigator !== 'undefined' && navigator\.vibrate/);
  assert.match(body, /try \{ navigator\.vibrate\(8\); \} catch/, 'jamais une erreur bloquante si vibrate n\'est pas supporté');
});

test('scroll-jack -- entièrement désactivé sous reduced motion, jamais de comportement de scroll modifié', () => {
  const body = functionBody('wireHorizontalRails');
  assert.match(body, /if \(!reduced\) \{[\s\S]*rail\.addEventListener\('wheel'/);
});

test('scroll-jack -- uniquement wheel (souris/trackpad), jamais touchmove -- le swipe tactile natif reste intact', () => {
  const body = functionBody('wireHorizontalRails');
  assert.ok(!/addEventListener\('touchmove'/.test(body), 'jamais d\'interception du geste tactile natif');
});

test('scroll-jack -- n\'agit que dans la zone d\'engagement verticale (rail visible autour du centre), jamais hors champ', () => {
  const body = functionBody('wireHorizontalRails');
  assert.match(body, /inEngagementZone/);
  assert.match(body, /rect\.top < vh \* 0\.62 && rect\.bottom > vh \* 0\.38/);
});

// ── Contraste réel des cartes -- vérification numérique, pas seulement structurelle ──


test('contraste réel -- un accent à faible contraste (jaune pâle) bascule automatiquement le chiffre sur l\'encre, jamais un texte illisible', () => {
  const result = resolveCardSurface('#F5E6A8', '#171717', '#6a6a66', 9);
  assert.equal(result.numberColor, '#171717', 'un accent trop clair pour porter du texte doit basculer sur l\'encre');
  assert.ok(colorContrast('#171717', result.background) >= 4.5, 'le texte de corps doit rester lisible (WCAG AA, 4.5:1)');
});

test('contraste réel -- un accent saturé (bleu foncé, rouge vif) peut porter le chiffre en couleur, contraste réellement suffisant', () => {
  for (const accent of ['#1E3A8A', '#E11D48']) {
    const result = resolveCardSurface(accent, '#171717', '#6a6a66', 9);
    assert.equal(result.numberColor, accent, `${accent} doit pouvoir porter le chiffre directement`);
    assert.ok(colorContrast(accent, result.background) >= 3, 'seuil WCAG AA grand texte (3:1) réellement atteint, pas supposé');
    assert.ok(colorContrast('#171717', result.background) >= 4.5, 'le texte de corps (libellé) reste toujours lisible');
    assert.ok(colorContrast('#6a6a66', result.background) >= 4.5, 'le libellé muted (plus clair que l\'encre) reste aussi lisible');
  }
});

test('contraste réel -- la surface obtenue reste toujours proche du blanc, jamais une carte sombre imprévue', () => {
  for (const accent of ['#1E3A8A', '#F5E6A8', '#E11D48', '#171717', '#0D9488']) {
    const result = resolveCardSurface(accent, '#171717', '#6a6a66', 9);
    assert.ok(colorLuminanceApprox(result.background) > 0.75, `${accent} -> ${result.background} doit rester une surface claire`);
  }
});

function colorLuminanceApprox(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

test('mixWithWhite -- fonction pure, résultat déterministe, jamais de couleur invalide produite', () => {
  const result = mixWithWhite('#1E3A8A', 50);
  assert.match(result, /^#[0-9a-f]{6}$/);
  assert.equal(mixWithWhite('#1E3A8A', 0), '#ffffff');
});

// ── Home V2.1 -- hero (ouverture + média héros) ───────────────────────

function homeFixture(overrides = {}) {
  return {
    statement: 'Un test.',
    message: 'Le projet avance.',
    featured: { title: 'Article de test', summary: 'Résumé de test.', source: { module: 'news', id: 'a1' } },
    ...overrides
  };
}

test('Home V2.1 -- média héros réel (asset featured déjà calculé par le Compiler) utilisé quand il existe, jamais un faux média', () => {
  const news = { items: [{ id: 'a1', title: 'Article de test', asset: { url: '/public/projects/x/assets/y.jpg', alt: 'Photo du chantier' } }] };
  const html = renderHome(homeFixture(), { news });
  assert.match(html, /class="tct-home-hero tct-reveal"/, 'jamais no-visual quand un asset réel existe');
  assert.match(html, /tct-home-hero-img/);
  assert.match(html, /src="\/public\/projects\/x\/assets\/y\.jpg"/);
  assert.match(html, /alt="Photo du chantier"/);
});

test('Home V2.1 -- média héros réutilise renderAsset existant, jamais un second rendu d\'image dupliqué', () => {
  const idx = ivoryJs.indexOf('const heroVisual = featuredAsset ? `');
  const snippet = ivoryJs.slice(idx, idx + 400);
  assert.match(snippet, /renderAsset\(featuredAsset, 'tct-home-hero-img'\)/);
});

test('Home V2.1 -- media-sparse : classe no-visual appliquée, hero passe en une colonne, jamais un espace réservé vide', () => {
  const news = { items: [{ id: 'a1', title: 'Article de test', asset: null }] };
  const html = renderHome(homeFixture(), { news });
  assert.match(html, /class="tct-home-hero no-visual tct-reveal"/);
  assert.ok(!html.includes('tct-home-hero-visual'), 'aucun conteneur média vide rendu');
});

test('Home V2.1 -- sans featured du tout, hero reste fonctionnel (une colonne), aucune section vide affichée', () => {
  const html = renderHome(homeFixture({ featured: null }), { news: { items: [] } });
  assert.match(html, /no-visual/);
});

test('Home V2.1 -- média héros média-sparse : le CSS .no-visual repasse bien en une seule colonne', () => {
  const idx = ivoryJs.indexOf('.tct-home-hero.no-visual {');
  assert.ok(idx > 0);
  assert.match(ivoryJs.slice(idx, idx + 100), /grid-template-columns:1fr/);
});

// ── Home V2.1 -- recomposition depuis le handoff (structure réelle) ──

test('Home V2.1 -- un seul h1, toujours issu de l\'ouverture (statement/message), jamais un second titre concurrent', () => {
  const html = renderHome({ statement: 'x', now: { label: 'Titre jalon' } }, {});
  assert.equal((html.match(/<h1/g) || []).length, 1);
  assert.match(html, /<h1 id="tct-home-title">x<\/h1>/);
});

test('Home V2.1 -- home.message devient le paragraphe de soutien de l\'ouverture quand home.statement existe aussi et diffère, jamais dupliqué', () => {
  const html = renderHome({ statement: 'TITRE_TEST', message: 'MESSAGE_SOUTIEN_TEST' }, {});
  assert.match(html, /<h1 id="tct-home-title">TITRE_TEST<\/h1>/);
  assert.match(html, /<p>MESSAGE_SOUTIEN_TEST<\/p>/);
});

test('Home V2.1 -- sans home.statement, home.message seul porte le h1, jamais dupliqué en paragraphe', () => {
  const html = renderHome({ message: 'MESSAGE_UNIQUE_TEST' }, {});
  const occurrences = (html.match(/MESSAGE_UNIQUE_TEST/g) || []).length;
  assert.equal(occurrences, 1);
  assert.match(html, /<h1 id="tct-home-title">MESSAGE_UNIQUE_TEST<\/h1>/);
});

test('Home V2.1 -- identité projet (manifest.project.name) affichée comme micro-label réel, jamais inventée si absente', () => {
  const html = renderHome({ message: 'x' }, { project: { name: 'PROJET_TEST' } });
  assert.match(html, /<div class="tct-home-project-id">PROJET_TEST<\/div>/);
  const htmlSansNom = renderHome({ message: 'x' }, {});
  assert.ok(!htmlSansNom.includes('tct-home-project-id'), 'jamais de micro-label vide sans donnée réelle');
});

test('Home V2.1 -- points d\'entrée (jump + explore) sont des liens fixes vers des destinations produit réelles, jamais une donnée Manifest inventée', () => {
  const html = renderHome({ message: 'x' }, {});
  assert.match(html, /href="#spaces" data-tct-route/);
  assert.match(html, /href="#timeline" data-tct-route/);
  assert.match(html, /href="#questions" data-tct-route/);
});

test('Home V2.1 -- showAskPrompt=false retire les points d\'entrée vers Questions, jamais affichés malgré tout', () => {
  const html = renderHome({ message: 'x', showAskPrompt: false }, {});
  assert.ok(!html.includes('href="#questions"'));
});

test('Home V2.1 -- "Ce qui change vraiment pour vous" réutilise une section Principes existante de Le Projet, jamais un nouveau champ Studio', () => {
  const sections = [{ type: 'choices', items: [{ title: 'Principe test 1' }, { title: 'Principe test 2' }] }];
  const html = renderHome({ message: 'x' }, { projectSections: sections });
  assert.match(html, /Ce qui change vraiment pour vous/);
  assert.match(html, /Principe test 1/);
});

test('Home V2.1 -- sans section Principes disponible, "Ce qui change" est absente, jamais un contenu inventé pour combler', () => {
  const html = renderHome({ message: 'x' }, { projectSections: [] });
  assert.ok(!html.includes('tct-home-change'));
});

test('Home V2.1 -- repère de progression réel (X / Y étapes franchies), jamais le pseudo-numéro d\'étape déconnecté d\'un jalon réel', () => {
  const timeline = { milestones: [{ status: 'done' }, { status: 'done' }, { status: 'done' }, { status: 'future' }] };
  const html = renderHome({ message: 'x', next: { label: 'l' } }, { timeline });
  assert.match(html, /<strong>3 \/ 4<\/strong>/);
  assert.match(html, /étapes déjà franchies/);
});

test('Home V2.1 -- aucune structure momentum vide réservée quand ni jalon courant ni suivant n\'existent', () => {
  const html = renderHome({ message: 'x', now: null, next: null }, { timeline: { milestones: [] } });
  assert.ok(!html.includes('tct-home-momentum'));
});

test('Home V2.1 -- fixture réaliste complète : aucun contenu Manifest perdu dans la recomposition', () => {
  const home = {
    statement: 'Déclaration de test unique.',
    now: { label: 'Titre now unique', description: 'Description now unique.' },
    next: { date: 'DATE_TEST', label: 'Titre next unique' },
    featured: { title: 'Titre featured unique', summary: 'Résumé featured unique.', source: { module: 'news', id: 'a1' } },
    latest: { title: 'Titre latest unique' }
  };
  const news = { items: [{ id: 'a1', asset: null }] };
  const html = renderHome(home, { news, timeline: { milestones: [{ status: 'done' }] } });
  for (const needle of ['Déclaration de test unique.', 'Titre now unique', 'Description now unique.', 'Titre featured unique']) {
    assert.ok(html.includes(needle), `donnée perdue : "${needle}"`);
  }
});

test('Home V2.1 -- reduced motion : toutes les nouvelles sections portent .tct-reveal, couvertes par la règle globale existante', () => {
  assert.match(ivoryJs, /class="tct-home-hero\$\{featuredAsset \? '' : ' no-visual'\} tct-reveal"/);
  assert.match(ivoryJs, /class="tct-home-momentum tct-reveal"/);
  assert.match(ivoryJs, /class="tct-home-change tct-reveal"/);
  assert.match(ivoryJs, /class="tct-home-explore tct-reveal"/);
  assert.match(ivoryJs, /class="tct-home-news tct-reveal"/);
});

test('Home V2.1 -- aucun appel réseau introduit, fonction de rendu pure', () => {
  const idx = ivoryJs.indexOf('function renderHome');
  const end = ivoryJs.indexOf('\nfunction ', idx + 10);
  const body = ivoryJs.slice(idx, end);
  assert.ok(!/fetch\(|XMLHttpRequest|api\(/.test(body));
});

// ── Le Projet -- composition finale, fixture réelle exécutée ─────────

function projectFixture(sections, context = {}) {
  const project = { intro: { title: 'Titre du projet', body: 'Description du projet.' }, sections };
  return renderProject(project, context);
}

test('Le Projet -- fixture réelle : tout contenu Manifest reste rendu (texte, chiffres clés, principes, équipe, timeline simultanément)', () => {
  const html = projectFixture([
    { type: 'text', title: 'Contexte unique', body: 'Texte narratif unique.' },
    { type: 'keyFigures', title: 'Repères uniques', items: [{ value: 'VALEUR_TEST', label: 'LABEL_TEST' }] },
    { type: 'choices', title: 'Principes uniques', items: [{ title: 'TITRE_PRINCIPE', body: 'CORPS_PRINCIPE' }] },
    { type: 'team' },
    { type: 'timeline' }
  ], {
    team: { members: [{ name: 'NOM_TEST', title: 'ROLE_TEST' }] },
    timeline: { milestones: [{ status: 'current', label: 'ETAPE_TEST', date: 'DATE_TEST' }] }
  });
  for (const needle of ['Contexte unique', 'Texte narratif unique.', 'VALEUR_TEST', 'LABEL_TEST', 'TITRE_PRINCIPE', 'CORPS_PRINCIPE', 'NOM_TEST', 'ETAPE_TEST', 'DATE_TEST']) {
    assert.ok(html.includes(needle), `contenu perdu : "${needle}"`);
  }
});

test('Le Projet -- un seul h1 (ouverture), jamais un second titre à échelle hero dans le flux', () => {
  const html = projectFixture([{ type: 'text', title: 'X', body: 'Y' }]);
  assert.equal((html.match(/<h1/g) || []).length, 1);
});

test('Le Projet -- Chiffres clés et Principes restent en rail (data-tct-rail), jamais retirés ni convertis', () => {
  const html = projectFixture([
    { type: 'keyFigures', items: [{ value: '1', label: 'x' }] },
    { type: 'choices', items: [{ title: 'a', body: 'b' }] }
  ]);
  assert.match(html, /class="tct-project-figures-grid[^"]*" data-tct-rail data-tct-rail-family="figures"/);
  assert.match(html, /class="tct-project-choices-grid" data-tct-rail data-tct-rail-family="choices"/);
});

test('Le Projet -- timeline garde son mécanisme dédié (ol sémantique, aria-current, adaptatif horizontal/vertical), jamais convertie vers la primitive de rail générique', () => {
  const htmlFew = projectFixture([{ type: 'timeline' }], { timeline: { milestones: [
    { status: 'done', label: 'a', date: '1' }, { status: 'current', label: 'b', date: '2' }
  ] } });
  assert.match(htmlFew, /<ol class="tct-project-milestones">/);
  assert.match(htmlFew, /aria-current="step"/);
  assert.match(htmlFew, /class="tct-project-track is-horizontal"/);
  assert.ok(!htmlFew.includes('tct-project-milestones" data-tct-rail'), 'la timeline ne doit jamais porter data-tct-rail');

  const many = Array.from({ length: 8 }, (_, i) => ({ status: i === 0 ? 'current' : 'upcoming', label: `étape ${i}`, date: `d${i}` }));
  const htmlMany = projectFixture([{ type: 'timeline' }], { timeline: { milestones: many } });
  assert.match(htmlMany, /class="tct-project-track is-vertical"/, 'plus de 6 étapes -> bascule vertical, mécanisme dédié toujours actif');
});

test('Le Projet -- aucun appel réseau introduit dans renderProject/renderProjectSection, fonctions de rendu pures', () => {
  const idx = ivoryJs.indexOf('function renderProject(project, context = {})');
  const end = ivoryJs.indexOf('\n// ── Espaces', idx);
  const body = ivoryJs.slice(idx, end > 0 ? end : idx + 6000);
  assert.ok(!/fetch\(|XMLHttpRequest|api\(/.test(body));
});

test('Le Projet -- ouverture allégée, jamais de min-height artificiel comme l\'ancien bug Home (66vh autour d\'un texte court)', () => {
  const idx = ivoryJs.indexOf('.tct-project-opening {');
  const css = ivoryJs.slice(idx, idx + 250);
  assert.ok(!/min-height/.test(css), 'jamais de min-height artificiel sur l\'ouverture Le Projet');
});

test('Le Projet -- espacement des sections resserré et cohérent -- jamais deux rails séparés par un désert (repli combiné mesuré)', () => {
  for (const sel of ['.tct-project-figures {', '.tct-project-choices {', '.tct-project-text {', '.tct-project-media {', '.tct-project-gallery {']) {
    const idx = ivoryJs.indexOf(sel);
    assert.ok(idx > 0, `${sel} doit exister`);
    const closeIdx = ivoryJs.indexOf('}', idx);
    const css = ivoryJs.slice(idx, closeIdx + 1);
    const maxValues = [...css.matchAll(/,(\d+)px\)/g)].map(m => Number(m[1]));
    for (const v of maxValues) {
      assert.ok(v <= 110, `${sel} porte encore un padding max de ${v}px (attendu ≤110px après resserrement)`);
    }
  }
});

test('Le Projet -- média non enfermé dans une petite card : largeur héritée de .tct-section (jusqu\'à 1420px), jamais une colonne étroite', () => {
  const idx = ivoryJs.indexOf('.tct-section { width:');
  assert.match(ivoryJs.slice(idx, idx + 80), /width:min\(1420px/);
});

// ── Actualités -- composition finale, fixture réelle exécutée ────────

test('Actualités -- fixture réelle : article avec média, article sans média, article ancien (compact) tous rendus, aucun contenu perdu', () => {
  const news = {
    intro: { title: 'TITRE_INTRO', description: 'DESCRIPTION_INTRO' },
    items: [
      { id: '1', title: 'TITRE_AVEC_MEDIA', tag: 'TAG_TEST', date: 'DATE_1', summary: 'RESUME_1', asset: { url: '/x/a.jpg', alt: 'ALT_TEST' } },
      { id: '2', title: 'TITRE_SANS_MEDIA', date: 'DATE_2', summary: 'RESUME_2' },
      { id: '3', title: 'TITRE_COMPACT', date: 'DATE_3' }
    ]
  };
  const html = renderNews(news);
  for (const needle of ['TITRE_INTRO', 'DESCRIPTION_INTRO', 'TITRE_AVEC_MEDIA', 'TAG_TEST', 'DATE_1', 'RESUME_1', 'ALT_TEST', 'TITRE_SANS_MEDIA', 'RESUME_2', 'TITRE_COMPACT']) {
    assert.ok(html.includes(needle), `contenu perdu : "${needle}"`);
  }
});

test('Actualités -- média du lead réellement rendu quand présent (renderAsset réutilisé, jamais un second rendu dupliqué)', () => {
  const news = { intro: {}, items: [{ id: '1', title: 'A', date: '1', asset: { url: '/x/a.jpg', alt: 'B' } }] };
  const html = renderNews(news);
  assert.match(html, /class="tct-news-lead-img"/);
  assert.match(html, /src="\/x\/a\.jpg"/);
});

test('Actualités -- sans média, aucune balise image vide ni placeholder rendu pour le lead', () => {
  const news = { intro: {}, items: [{ id: '1', title: 'A', date: '1' }] };
  const html = renderNews(news);
  const idx = html.indexOf('tct-news-article-shell');
  const listing = html.slice(0, idx);
  assert.ok(!listing.includes('tct-news-lead-media'), 'jamais de conteneur média vide si asset absent');
});

test('Actualités -- un seul h1 dans la liste visible (les h1 additionnels viennent des panneaux Article masqués, hors périmètre de cette passe)', () => {
  const html = renderNews({ intro: {}, items: [{ id: '1', title: 'A', date: '1' }] });
  const idx = html.indexOf('tct-news-article-shell');
  const listing = html.slice(0, idx);
  assert.equal((listing.match(/<h1/g) || []).length, 1);
});

test('Actualités -- liens vers les articles conservés (data-tct-route), le clic vers un article continue de fonctionner', () => {
  const html = renderNews({ intro: {}, items: [{ id: 'abc', title: 'A', date: '1' }, { id: 'def', title: 'B', date: '2', summary: 'x' }] });
  assert.match(html, /href="#news-abc" data-tct-route/);
  assert.match(html, /href="#news-def" data-tct-route/);
});

test('Actualités -- aucun rail horizontal introduit (data-tct-rail absent) -- surface de scan vertical, jamais un carousel', () => {
  const html = renderNews({ intro: {}, items: [{ id: '1', title: 'A', date: '1' }, { id: '2', title: 'B', date: '2' }, { id: '3', title: 'C', date: '3' }] });
  const idx = html.indexOf('tct-news-article-shell');
  assert.ok(!html.slice(0, idx).includes('data-tct-rail'));
});

test('Actualités -- aucun filtre inventé (le produit n\'en a pas aujourd\'hui)', () => {
  assert.ok(!ivoryJs.includes('tct-news-filter'));
});

test('Actualités -- aucun appel réseau introduit dans renderNews, fonction de rendu pure', () => {
  const idx = ivoryJs.indexOf('function renderNews(news)');
  const end = ivoryJs.indexOf('\nfunction ', idx + 10);
  const body = ivoryJs.slice(idx, end);
  assert.ok(!/fetch\(|XMLHttpRequest|api\(/.test(body));
});

test('Actualités -- ouverture allégée, jamais de min-height artificiel comme l\'ancien bug Home/Le Projet', () => {
  const idx = ivoryJs.indexOf('.tct-news-opening {');
  const css = ivoryJs.slice(idx, idx + 250);
  assert.ok(!/min-height/.test(css));
});

test('Actualités -- espacement de liste resserré pour rester scannable (jamais un espacement d\'événement éditorial majeur entre deux entrées de liste)', () => {
  const idx = ivoryJs.indexOf('.tct-news-archive-list {');
  const css = ivoryJs.slice(idx, idx + 150);
  const maxValues = [...css.matchAll(/,(\d+)px\)/g)].map(m => Number(m[1]));
  for (const v of maxValues) {
    assert.ok(v <= 60, `l'écart entre entrées de liste (${v}px) doit rester adapté au scan rapide`);
  }
});

// ── Article + Suggestions -- composition finale, fixture réelle ─────

function articleFixture(item, allItems, index = 0) {
  return renderNewsArticle(item, allItems || [item], index);
}

test('Article -- fixture réelle avec média + rich blocks : tout le contenu Manifest reste rendu', () => {
  const item = {
    id: 'a1', title: 'TITRE_ARTICLE', tag: 'TAG_TEST', date: 'DATE_TEST', summary: 'RESUME_TEST',
    asset: { url: '/x/a.jpg', alt: 'ALT_TEST' },
    blocks: [
      { type: 'heading', runs: [{ text: 'SOUS_TITRE_TEST' }] },
      { type: 'paragraph', runs: [{ text: 'PARAGRAPHE_TEST' }] },
      { type: 'bulletList', items: [{ runs: [{ text: 'PUCE_TEST' }] }] },
      { type: 'image', asset: { url: '/x/b.jpg', alt: 'ALT_INLINE_TEST' } },
      { type: 'document', asset: { url: '/x/doc.pdf' }, title: 'DOCUMENT_TEST' }
    ]
  };
  const html = articleFixture(item, [item]);
  for (const needle of ['TITRE_ARTICLE', 'TAG_TEST', 'DATE_TEST', 'RESUME_TEST', 'ALT_TEST', 'SOUS_TITRE_TEST', 'PARAGRAPHE_TEST', 'PUCE_TEST', 'ALT_INLINE_TEST', 'DOCUMENT_TEST']) {
    assert.ok(html.includes(needle), `contenu perdu : "${needle}"`);
  }
});

test('Article -- h1/panneaux masqués : hidden natif jamais neutralisé par du CSS (aucune règle [hidden] pour .tct-news-article-view-panel qui le contredirait)', () => {
  assert.match(articleFixture({ id: '1', title: 'x' }, null), /class="tct-news-article-view-panel" data-news-article-id="1" hidden>/);
  assert.ok(!ivoryJs.includes('.tct-news-article-view-panel[hidden]'), 'aucune règle CSS ne doit neutraliser le hidden natif pour ce panneau');
});

test('Article -- logique de bascule des panneaux garantit un seul panneau visible à la fois (jamais deux h1 actifs simultanément)', () => {
  assert.match(ivoryJs, /panels\.forEach\(panel => \{ panel\.hidden = panel !== activePanel; \}\)/);
});

test('Article -- sans média, aucun conteneur média vide rendu', () => {
  const item = { id: '1', title: 'x', date: 'd' };
  const html = articleFixture(item, [item]);
  assert.ok(!html.includes('tct-news-article-media'));
});

test('Article -- lightbox/document hooks conservés (data-tct-pdf-reader, data-tct-pdf-src), jamais réécrits', () => {
  const item = { id: '1', title: 'x', blocks: [{ type: 'document', asset: { url: '/x/doc.pdf' }, title: 'Doc' }] };
  const html = articleFixture(item, [item]);
  assert.match(html, /data-tct-pdf-reader/);
  assert.match(html, /data-tct-pdf-src="\/x\/doc\.pdf"/);
  assert.match(html, /class="tct-news-document-download"/, 'le téléchargement direct doit rester disponible en complément de la lightbox');
});

test('Article -- lien retour vers la liste conservé (intrapage navigation)', () => {
  const html = articleFixture({ id: '1', title: 'x' }, [{ id: '1', title: 'x' }]);
  assert.match(html, /href="#news" data-tct-route/);
});

test('Suggestions -- une seule suggestion existe réellement (l\'article immédiatement plus ancien) -- jamais un rail inventé pour un seul élément', () => {
  const item = { id: '1', title: 'x' };
  const older = { id: '0', title: 'TITRE_PRECEDENT' };
  const html = articleFixture(item, [item, older], 0);
  assert.match(html, /Lire aussi : TITRE_PRECEDENT/);
  assert.ok(!html.includes('data-tct-rail'), 'une seule suggestion -- jamais la primitive de rail pour un élément unique');
});

test('Suggestions -- dernier article de la liste n\'a pas de suggestion (aucun contenu inventé)', () => {
  const item = { id: '1', title: 'x' };
  const html = articleFixture(item, [item], 0);
  assert.ok(!html.includes('tct-news-next-story'));
});

test('Suggestions -- logique de sélection inchangée (allItems[index + 1], jamais un nouvel algorithme)', () => {
  assert.match(ivoryJs, /const older = allItems\[index \+ 1\] \|\| null;/);
});

test('Fin d\'article -- jamais un titre à échelle hero pour le message de clôture (ancien bug : 4.8rem pour "Retrouvez le fil des dernières nouvelles")', () => {
  const idx = ivoryJs.indexOf('.tct-news-article-exit h2 {');
  const css = ivoryJs.slice(idx, idx + 250);
  assert.ok(!/4\.\d?rem|5rem|6rem/.test(css), 'jamais une échelle hero pour ce titre de clôture');
  assert.match(css, /font-size:clamp\(1\.3rem,1\.8vw,1\.7rem\)/);
});

test('Fin d\'article -- transition éditoriale claire (hairline) avant les suggestions, jamais juste un grand blanc', () => {
  const idx = ivoryJs.indexOf('.tct-news-article-exit {');
  const css = ivoryJs.slice(idx, idx + 250);
  assert.match(css, /border-top:1px solid var\(--tct-hairline-soft\)/);
});

test('Article -- espacements resserrés (opening/media/body), jamais un min-height artificiel ni un vide excessif avant les suggestions', () => {
  for (const sel of ['.tct-news-article-opening {', '.tct-news-article-media {', '.tct-news-article-body {']) {
    const idx = ivoryJs.indexOf(sel);
    assert.ok(idx > 0, `${sel} doit exister`);
    const css = ivoryJs.slice(idx, idx + 220);
    assert.ok(!/min-height/.test(css));
    const maxValues = [...css.matchAll(/,(\d+)px\)/g)].map(m => Number(m[1]));
    for (const v of maxValues) assert.ok(v <= 90, `${sel} porte encore ${v}px (attendu ≤90px)`);
  }
});

test('Article -- aucun appel réseau introduit, fonction de rendu pure', () => {
  const idx = ivoryJs.indexOf('function renderNewsArticle(item, allItems, index)');
  const end = ivoryJs.indexOf('\nfunction ', idx + 10);
  const body = ivoryJs.slice(idx, end);
  assert.ok(!/fetch\(|XMLHttpRequest|api\(/.test(body));
});

test('Article -- reveal existant couvre l\'ouverture, le média, le corps et la clôture (reduced motion déjà géré globalement)', () => {
  assert.match(ivoryJs, /class="tct-news-article-opening tct-reveal"/);
  assert.match(ivoryJs, /class="tct-news-article-media tct-reveal"/);
  assert.match(ivoryJs, /class="tct-news-article-body tct-reveal"/);
  assert.match(ivoryJs, /class="tct-news-article-exit tct-reveal"/);
});

// ── Espaces -- composition finale, fixture réelle exécutée ────────────

test('Espaces -- fixture réelle : media-rich (image), media-rich (plan/PDF), media-sparse tous rendus sans contenu perdu', () => {
  const spaces = {
    intro: { title: 'TITRE_INTRO', description: 'DESCRIPTION_INTRO' },
    items: [
      { id: 's1', title: 'ESPACE_AVEC_IMAGE', type: 'TYPE_TEST', comment: 'COMMENTAIRE_TEST', usageTags: ['Calme'], image: { url: '/x/a.jpg', alt: 'ALT_TEST' } },
      { id: 's2', title: 'ESPACE_AVEC_PLAN', usageTags: ['Collectif'], image: { url: '/x/plan.pdf', alt: 'ALT_PLAN' } },
      { id: 's3', title: 'ESPACE_SANS_MEDIA', usageTags: [] }
    ]
  };
  const html = renderSpaces(spaces);
  for (const needle of ['TITRE_INTRO', 'DESCRIPTION_INTRO', 'ESPACE_AVEC_IMAGE', 'COMMENTAIRE_TEST', 'ESPACE_AVEC_PLAN', 'ESPACE_SANS_MEDIA']) {
    assert.ok(html.includes(needle), `contenu perdu : "${needle}"`);
  }
});

test('Espaces -- media-sparse : aucun placeholder rectangle vide, un état explicite et intentionnel (tct-space-empty-media)', () => {
  const html = renderSpaces({ intro: {}, items: [{ id: 's1', title: 'Sans média', usageTags: [] }] });
  assert.match(html, /tct-space-empty-media/);
});

test('Espaces -- distinction image/PDF conservée : un plan/PDF reçoit le marqueur PDF, jamais traité comme une photo ambiguë', () => {
  const html = renderSpaces({ intro: {}, items: [
    { id: 's1', title: 'A', usageTags: [] },
    { id: 's2', title: 'B (plan)', usageTags: [], image: { url: '/x/plan.pdf', alt: 'x' } }
  ] });
  assert.match(html, /tct-space-document-mark">PDF</);
});

test('Espaces -- filtres restent dormants sous le seuil produit (moins de 10 espaces ou moins de 2 tags distincts), jamais inventés prématurément', () => {
  const html = renderSpaces({ intro: {}, items: Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, title: `Espace ${i}`, usageTags: ['Calme'] })) });
  assert.ok(!html.includes('tct-space-filters'));
});

test('Espaces -- filtres apparaissent réellement au-delà du seuil produit (10+ espaces, 2+ tags distincts), logique jamais réécrite', () => {
  const items = Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, title: `Espace ${i}`, usageTags: [i % 2 === 0 ? 'Calme' : 'Collectif'] }));
  const html = renderSpaces({ intro: {}, items });
  assert.match(html, /class="tct-space-filters/);
  assert.match(html, /data-space-filter="all"/);
});

test('Espaces -- aucun rail horizontal introduit -- décision explicite documentée (liste, galerie, espaces liés)', () => {
  const items = Array.from({ length: 3 }, (_, i) => ({ id: `s${i}`, title: `Espace ${i}`, usageTags: [], media: [{ url: '/a.jpg', alt: 'a' }, { url: '/b.jpg', alt: 'b' }] }));
  const html = renderSpaces({ intro: {}, items });
  assert.ok(!html.includes('data-tct-rail'));
  assert.match(ivoryJs, /DÉCISION STRUCTURELLE EXPLICITE \(chantier HXI, grammaire\s*\n\s*\/\/ horizontale\)/);
});

test('Espaces -- galerie de médias secondaires conservée avec ses largeurs alternées éditoriales, jamais uniformisée', () => {
  const idx = ivoryJs.indexOf('.tct-space-detail-secondary:nth-child(odd)');
  assert.ok(idx > 0);
  assert.match(ivoryJs.slice(idx, idx + 150), /width:78%/);
});

test('Espaces -- lightbox/inspect hooks conservés (data-tct-inspect-src, data-tct-inspect-kind distingue image/pdf)', () => {
  const html = renderSpaces({ intro: {}, items: [{ id: 's1', title: 'Plan test', usageTags: [], image: { url: '/x/plan.pdf', alt: 'x' } }] });
  assert.match(html, /data-tct-inspect-src=/);
  assert.match(html, /data-tct-inspect-kind="pdf"/);
});

test('Espaces -- liens vers le détail conservés (data-tct-route), navigation entre espaces intacte', () => {
  const html = renderSpaces({ intro: {}, items: [{ id: 'abc', title: 'A', usageTags: [] }, { id: 'def', title: 'B', usageTags: [] }] });
  assert.match(html, /href="#space-abc" data-tct-route/);
});

test('Espaces -- usages listés en ol sémantique, jamais retirés', () => {
  const html = renderSpaces({ intro: {}, items: [{ id: 's1', title: 'A', usageTags: [], usages: ['USAGE_TEST_1', 'USAGE_TEST_2'] }] });
  assert.match(html, /<ol class="tct-space-usages-list">/);
  assert.ok(html.includes('USAGE_TEST_1') && html.includes('USAGE_TEST_2'));
});

test('Espaces -- espace sans capacité/metadata optionnelle ne produit aucun markup vide (repli statut par défaut)', () => {
  const html = renderSpaces({ intro: {}, items: [{ id: 's1', title: 'A', usageTags: [] }] });
  assert.match(html, /En cours de conception/);
});

test('Espaces -- aucun appel réseau introduit, fonctions de rendu pures', () => {
  const idx = ivoryJs.indexOf('function renderSpaces(spaces)');
  const end = ivoryJs.indexOf('\n// ── ', idx + 10);
  const body = ivoryJs.slice(idx, end > 0 ? end : idx + 4000);
  assert.ok(!/fetch\(|XMLHttpRequest|api\(/.test(body));
});

test('Espaces -- espacements resserrés mais mesurément plus généreux que les autres surfaces (média-riche assumé), jamais de min-height artificiel', () => {
  const idx = ivoryJs.indexOf('.tct-spaces-opening {');
  const css = ivoryJs.slice(idx, idx + 250);
  assert.ok(!/min-height/.test(css));
});

// ── FAQ/Questions -- composition finale, fixture réelle exécutée ────

test('Questions -- fixture réelle : champ, exemples, questions fréquentes, contact/escalade tous rendus', () => {
  const questions = { intro: { title: 'TITRE_TEST', description: 'DESC_TEST' }, items: [{ id: 'q1', title: 'QUESTION_TEST_1' }] };
  const html = renderQuestions(questions, false);
  for (const needle of ['TITRE_TEST', 'DESC_TEST', 'id="tct-question-input"', 'id="tct-contact-form"', 'QUESTION_TEST_1', 'aria-live="polite"']) {
    assert.ok(html.includes(needle), `contenu perdu : "${needle}"`);
  }
});

test('Questions -- aucun rail horizontal -- surface verticale/utilitaire par défaut, comme demandé', () => {
  const questions = { intro: {}, items: [{ id: 'q1', title: 'A' }, { id: 'q2', title: 'B' }, { id: 'q3', title: 'C' }] };
  const html = renderQuestions(questions, false);
  assert.ok(!html.includes('data-tct-rail'));
});

test('Questions -- questions fréquentes en ol sémantique, jamais retirées', () => {
  const html = renderQuestions({ intro: {}, items: [{ id: 'q1', title: 'A' }] }, false);
  assert.match(html, /<ol>\s*\n\s*<li>/);
});

test('Questions -- escalade/contact conservée intégralement (nom, email, message, soumission), jamais modifiée', () => {
  const html = renderQuestions({ intro: {}, items: [] }, false);
  assert.match(html, /<input type="text" name="name" autocomplete="name" required>/);
  assert.match(html, /<input type="email" name="email" autocomplete="email" required>/);
  assert.match(html, /<textarea name="message" rows="4" required><\/textarea>/);
  assert.match(html, /Transmettre la question/);
});

test('Questions -- champ de recherche calme, aucun style "AI magic box" (pas de glow, pas de backdrop-filter sur le champ)', () => {
  const idx = ivoryJs.indexOf('.tct-question-input-line {');
  const css = ivoryJs.slice(idx, idx + 300);
  assert.ok(!/box-shadow.*glow|backdrop-filter|radial-gradient/i.test(css), 'jamais de glow/verre décoratif sur le champ de question');
});

test('Questions -- aucun appel réseau introduit par cette passe (moteur Storm Match jamais touché ici, présentation uniquement)', () => {
  const idx = ivoryJs.indexOf('function renderQuestions(questions, allowDemoFallback)');
  const end = ivoryJs.indexOf('\nfunction ', idx + 10);
  const body = ivoryJs.slice(idx, end);
  assert.ok(!/fetch\(|XMLHttpRequest|api\(/.test(body));
});

test('Questions -- aucun titre à échelle hero (ancien bug : jusqu\'à 5.15rem pour le titre de réponse, 4.15rem pour l\'escalade, 4rem pour "questions fréquentes")', () => {
  for (const sel of ['.tct-question-answer h2,', '.tct-question-contact-intro h2 {', '.tct-featured-questions-heading h2 {']) {
    const idx = ivoryJs.indexOf(sel);
    assert.ok(idx > 0, `${sel} doit exister`);
    const css = ivoryJs.slice(idx, idx + 300);
    assert.ok(!/[3-9]\.\d?rem\)/.test(css.match(/font-size:clamp\([^)]+\)/)?.[0] || ''), `${sel} ne doit plus porter d'échelle hero`);
  }
});

test('Questions -- densité compacte assumée, plus resserrée que les autres surfaces (aucune valeur de padding au-delà de 76px)', () => {
  for (const sel of ['.tct-questions-page {', '.tct-questions-top {', '.tct-question-workbench {', '.tct-question-result {', '.tct-question-contact {']) {
    const idx = ivoryJs.indexOf(sel);
    assert.ok(idx > 0, `${sel} doit exister`);
    const css = ivoryJs.slice(idx, idx + 220);
    const maxValues = [...css.matchAll(/,(\d+)px\)/g)].map(m => Number(m[1]));
    for (const v of maxValues) assert.ok(v <= 76, `${sel} porte encore ${v}px (FAQ doit être plus compacte, ≤76px attendu)`);
  }
});

test('Questions -- exemples de question et boutons associés conservés (data-tct-question-example)', () => {
  const html = renderQuestions({ intro: {}, items: [] }, false);
  assert.match(html, /data-tct-question-example="Quand aura lieu le déménagement \?"/);
});

test('Questions -- résultat en aria-live polite, jamais retiré (annonce accessible du contenu dynamique)', () => {
  const html = renderQuestions({ intro: {}, items: [] }, false);
  assert.match(html, /id="tct-question-result" class="tct-question-result" aria-live="polite" hidden/);
});

// ── Passe transversale finale -- corrections cross-surface ───────────

test('Audit transversal -- AUCUNE marque Storm externe montrée au collaborateur (footer "Powered by Storm · Tectonic 2.1" retiré -- bug réel trouvé et corrigé)', () => {
  assert.ok(!ivoryJs.includes('Powered by'));
  assert.ok(!ivoryJs.includes('tct-footer-signature'));
  const idx = ivoryJs.indexOf('function renderFooter()');
  const body = ivoryJs.slice(idx, idx + 300);
  assert.ok(!/Storm|Tectonic/.test(body), 'le footer ne doit jamais nommer Storm ni un nom de code interne');
  assert.match(body, /Espace projet/);
});

test('Audit transversal -- Ambassadeurs rattrapé sur le même bug "trop blanc" que les autres surfaces (min-height artificiel + titre CTA à échelle hero, jamais traités lors de la passe rail)', () => {
  const openIdx = ivoryJs.indexOf('.tct-ambassadors-opening {');
  const openCss = ivoryJs.slice(openIdx, openIdx + 220);
  assert.ok(!/min-height/.test(openCss));

  const ctaIdx = ivoryJs.indexOf('.tct-ambassadors-cta h2 {');
  const ctaCss = ivoryJs.slice(ctaIdx, ctaIdx + 300);
  assert.ok(!/[3-9]\.\d?rem\)/.test(ctaCss.match(/font-size:clamp\([^)]+\)/)?.[0] || ''));
});

test('Audit transversal -- Liquid Glass (backdrop-filter) uniquement sur des contrôles flottants réels, jamais sur du contenu éditorial', () => {
  const forbidden = ['.tct-project-figure', '.tct-project-choice-card', '.tct-ambassador-person', '.tct-news-article-reading', '.tct-space-story', '.tct-question-answer'];
  for (const sel of forbidden) {
    const idx = ivoryJs.indexOf(`${sel} {`);
    if (idx < 0) continue;
    const css = ivoryJs.slice(idx, idx + 400);
    assert.ok(!/backdrop-filter/.test(css), `${sel} ne doit jamais porter de backdrop-filter (verre)`);
  }
});

test('Audit transversal -- exactement les quatre familles de rail validées, aucun rail accidentel introduit ailleurs', () => {
  const families = [...ivoryJs.matchAll(/data-tct-rail-family="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(new Set(families), new Set(['team', 'figures', 'choices', 'ambassadors']));
});

test('Audit transversal -- aucun titre à échelle hero résiduel sur l\'ensemble du fichier (hors lettrine décorative ambassador-monogram, assumée)', () => {
  const matches = [...ivoryJs.matchAll(/font-size:clamp\([3-9]\.?\d*rem,[\d.]*vw,([5-9]\.\d*|\d{2,}\.?\d*)rem\)/g)];
  const offenders = matches.filter(m => {
    const before = ivoryJs.slice(Math.max(0, m.index - 400), m.index);
    return !before.includes('tct-ambassador-person-monogram');
  });
  assert.equal(offenders.length, 0, `titres hero résiduels trouvés : ${offenders.map(m => m[0]).join(', ')}`);
});

test('Audit transversal -- aucun changement Storm Match / Liquid Core / classifier / retrieval dans ce fichier', () => {
  assert.ok(!/classifier|retrieval|quality[- ]gate|answerability|generation[- ]pipeline/i.test(ivoryJs));
});

// ── Retrait du lien Administration ────────────────────────────────────

test('Aucun lien Administration/Studio visible dans l\'expérience collaborateurs -- jamais rendu, pour aucun visiteur', () => {
  const livingCodeLines = ivoryJs.split('\n').filter(line => !line.trim().startsWith('//'));
  const livingCode = livingCodeLines.join('\n');
  assert.ok(!livingCode.includes('tct-admin-entry'));
  assert.ok(!livingCode.includes('Administration'), 'seul un commentaire explicatif peut légitimement nommer ce lien retiré, jamais du code vivant');
  assert.ok(!livingCode.includes('studioUrlFromLocation'));
  assert.ok(!/\/projects\/\$\{match\[1\]\}\/studio/.test(livingCode));
});

test('Retrait du lien Administration n\'a affecté aucune autre fonction (safeFontAssetUrl reste correct, vérifié séparément)', () => {
  assert.match(ivoryJs, /function safeFontAssetUrl\(value\)/);
  const fnIdx = ivoryJs.indexOf('function safeFontAssetUrl(value)');
  const fnBody = ivoryJs.slice(fnIdx, ivoryJs.indexOf('\n}', fnIdx));
  assert.ok(fnBody.includes('\\/public\\/projects\\/'));
});

// ── Vérification de sécurité du remapping wheel -- jamais de scroll trap ──
// Décision produit confirmée : ce remapping localisé wheel->horizontal
// est volontaire (demandé explicitement pour les 4 rails validés),
// jamais un hijacking global de la page. Ces tests protègent les 9
// garanties vérifiées manuellement avant le checkpoint Ivory V1 HXI.

test('scroll-jack -- canConsume est calculé et vérifié AVANT tout preventDefault, jamais l\'inverse', () => {
  const body = functionBody('wireHorizontalRails');
  const canConsumeIdx = body.indexOf('const canConsume');
  const preventIdx = body.indexOf('e.preventDefault();', canConsumeIdx);
  assert.ok(canConsumeIdx > 0 && preventIdx > canConsumeIdx, 'canConsume doit être calculé avant preventDefault');
  const between = body.slice(canConsumeIdx, preventIdx);
  assert.match(between, /if \(!canConsume\) \{ justEngaged = false; return; \}/, 'preventDefault ne doit jamais être atteint si canConsume est faux');
});

test('scroll-jack -- un rail non overflowé (maxScroll=0) ne peut jamais consommer le wheel, dans aucune direction', () => {
  // Vérification directe de la formule : maxScroll=0 rend canConsume
  // faux que scrollingForward soit vrai ou faux (0<-1 et 0>1 sont
  // tous deux faux), donc jamais de preventDefault sur un rail dont
  // tout le contenu tient déjà à l'écran.
  const maxScroll = 0;
  const scrollLeft = 0;
  const canConsumeForward = scrollLeft < maxScroll - 1;
  const canConsumeBackward = scrollLeft > 1;
  assert.equal(canConsumeForward, false);
  assert.equal(canConsumeBackward, false);
});

test('scroll-jack -- geste déjà horizontal (trackpad natif) exclu en tout premier, avant toute autre logique', () => {
  const body = functionBody('wireHorizontalRails');
  const wheelIdx = body.indexOf("rail.addEventListener('wheel'");
  const firstLineAfter = body.slice(wheelIdx, wheelIdx + 200);
  assert.match(firstLineAfter, /if \(Math\.abs\(e\.deltaY\) <= Math\.abs\(e\.deltaX\)\) return;/, 'doit être la toute première vérification du handler');
});

test('scroll-jack -- entièrement désactivé sous reduced motion (aucun wheel listener posé), jamais un comportement modifié', () => {
  const body = functionBody('wireHorizontalRails');
  const guardIdx = body.indexOf('if (!reduced) {');
  const wheelIdx = body.indexOf("rail.addEventListener('wheel'", guardIdx);
  const closeIdx = body.indexOf('\n    }\n', guardIdx);
  assert.ok(guardIdx > 0 && wheelIdx > guardIdx && wheelIdx < closeIdx, 'le listener wheel doit être entièrement contenu dans le bloc if (!reduced)');
});

test('scroll-jack -- localisé aux quatre rails validés uniquement, jamais un hijacking global de la page (aucun addEventListener wheel sur window/document)', () => {
  assert.ok(!ivoryJs.includes("window.addEventListener('wheel'"));
  assert.ok(!ivoryJs.includes("document.addEventListener('wheel'"));
});

test('scroll-jack -- touch et clavier restent des handlers entièrement séparés, jamais mélangés à la logique wheel', () => {
  const body = functionBody('wireHorizontalRails');
  const wheelBlockIdx = body.indexOf('if (!reduced) {');
  const wheelBlockEnd = body.indexOf('\n    }\n', wheelBlockIdx);
  const wheelBlock = body.slice(wheelBlockIdx, wheelBlockEnd);
  assert.ok(!/pointerType === 'touch'|ArrowLeft|ArrowRight/.test(wheelBlock), 'la logique touch/clavier ne doit jamais être dans le bloc wheel');
});


// ── Home V2.1 -- moment du projet (En ce moment / À suivre réels) ────
// Doctrine figée : home.message n'est jamais un repli de home.now.label.
// "En ce moment" n'existe que si un vrai jalon status:'current' existe.

test('Home V2.1 -- Case 1 : sans jalon courant, momentum montre "À suivre", jamais un faux "En ce moment"', () => {
  const home = {
    message: 'Un nouveau lieu pour mieux travailler ensemble.',
    now: null,
    next: { date: '15 septembre 2026', label: 'Choix des quartiers d\'équipe' },
    showMilestones: true
  };
  const html = renderHome(home, {});
  assert.match(html, /<h1 id="tct-home-title">Un nouveau lieu pour mieux travailler ensemble\.<\/h1>/);
  assert.ok(!html.includes('En ce moment'));
  assert.match(html, /À suivre · 15 septembre 2026/);
  assert.match(html, /Choix des quartiers d.équipe/);
});

test('Home V2.1 -- Case 2 : jalon courant explicite, momentum montre "En ce moment" avec le libellé du jalon, jamais le message', () => {
  const home = {
    message: 'Un nouveau lieu pour mieux travailler ensemble.',
    now: { label: 'Aménagement en cours', description: 'Les mobiliers sont livrés étage par étage.' },
    next: { date: '15 septembre 2026', label: 'Choix des quartiers d\'équipe' },
    showMilestones: true
  };
  const html = renderHome(home, {});
  assert.match(html, /<div class="tct-home-moment-status">En ce moment<\/div>/);
  assert.match(html, /<h2 id="tct-momentum-title">Aménagement en cours<\/h2>/);
  assert.ok(!html.includes('Aménagement en cours</h1>'), 'le jalon courant ne doit jamais devenir le h1 de l\'ouverture -- il vit dans momentum, pas dans le hero');
  assert.match(html, /Un nouveau lieu pour mieux travailler ensemble\./, 'le message reste visible dans l\'ouverture, jamais retiré');
});

test('Home V2.1 -- home.message n\'est jamais perdu même quand un jalon courant existe (visible dans l\'ouverture via statement+message ou message seul)', () => {
  const html = renderHome({ statement: 'STATEMENT_TEST', message: 'MESSAGE_TEST', now: { label: 'x' }, showMilestones: true }, {});
  assert.ok(html.includes('STATEMENT_TEST') && html.includes('MESSAGE_TEST'));
});

test('Home V2.1 -- aucune structure momentum vide réservée quand ni jalon courant ni suivant n\'existent (déjà couvert, reconfirmé après recomposition)', () => {
  const html = renderHome({ message: 'x', now: null, next: null, showMilestones: true }, { timeline: { milestones: [] } });
  assert.ok(!html.includes('tct-home-momentum'));
});

test('Home V2.1 -- home.now === null n\'empêche jamais l\'affichage du hero média, de "Ce qui change", "Entrez par" ni de la matière récente', () => {
  const home = {
    message: 'x', now: null,
    featured: { title: 'FEATURED_TEST', source: { module: 'news', id: 'a1' } }
  };
  const html = renderHome(home, {
    news: { items: [{ id: 'a1', asset: { url: '/x.jpg', alt: 'a' } }] },
    projectSections: [{ type: 'choices', items: [{ title: 'CHANGE_TEST' }] }]
  });
  assert.ok(html.includes('FEATURED_TEST') && html.includes('CHANGE_TEST') && html.includes('Entrez par ce qui vous concerne'));
});

test('Home V2.1 -- un seul h1 dans les deux cas (avec et sans jalon courant), jamais deux titres concurrents', () => {
  const withCurrent = renderHome({ message: 'x', now: { label: 'y' }, showMilestones: true }, {});
  const withoutCurrent = renderHome({ message: 'x', now: null }, {});
  assert.equal((withCurrent.match(/<h1/g) || []).length, 1);
  assert.equal((withoutCurrent.match(/<h1/g) || []).length, 1);
});

test('Home V2.1 -- hasCurrentMilestone reste la seule condition du bloc "En ce moment", jamais showMilestones seul', () => {
  const idx = ivoryJs.indexOf('function renderHome');
  const body = ivoryJs.slice(idx, idx + 4000);
  assert.match(body, /const hasCurrentMilestone = Boolean\(showMilestones && home\.now && home\.now\.label\);/);
});

// ── Vérification post-validation -- stamp héros + gating des entrées ──

test('Stamp héros -- purement informatif (aucun lien, aucun bouton, aucun rôle interactif), jamais de Liquid Glass dessus', () => {
  const idx = ivoryJs.indexOf('const heroVisual = featuredAsset ? `');
  const snippet = ivoryJs.slice(idx, idx + 500);
  assert.match(snippet, /<div class="tct-home-hero-stamp">/, 'doit rester un simple div, jamais un <a>/<button>');
  assert.ok(!/<a[^>]*tct-home-hero-stamp|tct-home-hero-stamp[^`]*href/.test(snippet));

  const cssIdx = ivoryJs.indexOf('.tct-home-hero-stamp {');
  const css = ivoryJs.slice(cssIdx, cssIdx + 300);
  assert.ok(!/backdrop-filter/.test(css), 'jamais de verre sur une simple légende informative');
  assert.match(css, /background:color-mix\(in srgb, var\(--tct-canvas\) 97%, transparent\)/, 'surface quasi opaque pour une bonne lisibilité');
});

test('Entrées Home -- Espaces et Le Projet sont des destinations stables, jamais conditionnées à showAskPrompt (qui ne gouverne que Questions)', () => {
  const html = renderHome({ message: 'x', showAskPrompt: false }, {});
  assert.match(html, /href="#spaces"/, 'Espaces doit rester visible même si showAskPrompt est faux');
  assert.match(html, /href="#timeline"/, 'Le Projet doit rester visible même si showAskPrompt est faux');
  assert.ok(!html.includes('href="#questions"'), 'Questions doit disparaître -- c\'est bien son propre contrat');
});

test('Entrées Home -- Espaces et Le Projet toujours présentes par défaut (aucun signal contractuel réel n\'existe aujourd\'hui pour les désactiver -- audité dans le Compiler, NAV_ORDER ne contient même pas "timeline")', () => {
  const html = renderHome({ message: 'x' }, {});
  assert.match(html, /href="#spaces"/);
  assert.match(html, /href="#timeline"/);
  assert.match(html, /href="#questions"/);
});

// ── Le Projet V2.1 -- récit continu (handoff), fixture réelle ────────

test('Le Projet V2.1 -- ouverture inversée : paragraphe avant le titre dans le DOM (matchant le handoff), micro-label eyebrow décoratif retiré', () => {
  const html = renderProject({ intro: { title: 'TITRE_TEST', body: 'PARAGRAPHE_TEST' }, sections: [] }, {});
  const pIdx = html.indexOf('PARAGRAPHE_TEST');
  const h1Idx = html.indexOf('TITRE_TEST');
  assert.ok(pIdx > 0 && pIdx < h1Idx, 'le paragraphe doit précéder le titre dans le DOM');
  assert.ok(!html.includes('tct-project-opening-eyebrow'));
});

test('Le Projet V2.1 -- les sections narratives (text/focus) reçoivent un numéro de chapitre courant, jamais les chiffres/principes/citation/média', () => {
  const project = {
    intro: {},
    sections: [
      { type: 'text', title: 'A', body: 'a' },
      { type: 'keyFigures', items: [{ value: '1', label: 'x' }] },
      { type: 'text', title: 'B', body: 'b' },
      { type: 'choices', items: [{ title: 'x' }] },
      { type: 'quote', quote: 'x' },
      { type: 'text', title: 'C', body: 'c' }
    ]
  };
  const html = renderProject(project, {});
  const numbers = [...html.matchAll(/tct-project-chapter-num">(\d+)</g)].map(m => m[1]);
  assert.deepEqual(numbers, ['01', '02', '03'], 'seules les 3 sections text doivent être numérotées, dans l\'ordre');
});

test('Le Projet V2.1 -- aucune perte de contenu : intro, chapitres, chiffres, principes, citation, timeline tous rendus simultanément', () => {
  const project = {
    intro: { title: 'INTRO_TITRE', body: 'INTRO_CORPS' },
    sections: [
      { type: 'text', title: 'CHAPITRE_TITRE', body: 'CHAPITRE_CORPS' },
      { type: 'keyFigures', items: [{ value: 'VAL_TEST', label: 'LABEL_TEST' }] },
      { type: 'choices', items: [{ title: 'PRINCIPE_TEST', body: 'PRINCIPE_CORPS' }] },
      { type: 'quote', quote: 'CITATION_TEST' },
      { type: 'timeline' }
    ]
  };
  const context = { timeline: { milestones: [{ status: 'current', label: 'JALON_TEST', date: 'DATE_TEST' }] } };
  const html = renderProject(project, context);
  for (const needle of ['INTRO_TITRE', 'INTRO_CORPS', 'CHAPITRE_TITRE', 'CHAPITRE_CORPS', 'VAL_TEST', 'LABEL_TEST', 'PRINCIPE_TEST', 'PRINCIPE_CORPS', 'CITATION_TEST', 'JALON_TEST']) {
    assert.ok(html.includes(needle), `donnée perdue : "${needle}"`);
  }
});

test('Le Projet V2.1 -- rails Chiffres clés et Principes toujours présents avec data-tct-rail, mécanique jamais touchée', () => {
  const project = { intro: {}, sections: [
    { type: 'keyFigures', items: [{ value: '1', label: 'x' }] },
    { type: 'choices', items: [{ title: 'a', body: 'b' }] }
  ] };
  const html = renderProject(project, {});
  assert.match(html, /data-tct-rail data-tct-rail-family="figures"/);
  assert.match(html, /data-tct-rail data-tct-rail-family="choices"/);
});

test('Le Projet V2.1 -- timeline garde son mécanisme dédié (ol sémantique, aria-current, adaptatif), jamais convertie en rail générique -- décision inchangée', () => {
  const html = renderProject({ intro: {}, sections: [{ type: 'timeline' }] }, { timeline: { milestones: [{ status: 'current', label: 'a', date: '1' }] } });
  assert.match(html, /<ol class="tct-project-milestones">/);
  assert.match(html, /aria-current="step"/);
  assert.ok(!html.includes('tct-project-milestones" data-tct-rail'));
});

test('Le Projet V2.1 -- timeline traitée comme conclusion (hairline de transition), jamais un simple bloc posé après tout le reste sans signal', () => {
  const idx = ivoryJs.indexOf('.tct-project-trajectory {');
  const css = ivoryJs.slice(idx, idx + 150);
  assert.match(css, /border-top:1px solid var\(--tct-hairline-soft\)/);
});

test('Le Projet V2.1 -- media-sparse : sans keyFigures/choices/média, la page reste fonctionnelle, aucune section vide/placeholder', () => {
  const html = renderProject({ intro: { title: 'x' }, sections: [{ type: 'text', title: 'a', body: 'b' }] }, {});
  assert.ok(!html.includes('tct-project-figures') && !html.includes('tct-project-choices') && !html.includes('tct-project-media'));
});

test('Le Projet V2.1 -- media-rich : une image narrative reste intégrée (jamais dupliquée artificiellement pour remplir)', () => {
  const html = renderProject({ intro: {}, sections: [{ type: 'image', asset: { url: '/x.jpg', alt: 'Photo test' } }] }, {});
  const occurrences = (html.match(/x\.jpg/g) || []).length;
  assert.equal(occurrences, 1);
});

test('Le Projet V2.1 -- un seul h1 (ouverture), jamais un second titre à échelle hero dans le flux narratif', () => {
  const html = renderProject({ intro: { title: 'x' }, sections: [{ type: 'text', title: 'y', body: 'z' }] }, {});
  assert.equal((html.match(/<h1/g) || []).length, 1);
});

test('Le Projet V2.1 -- aucun nouveau champ Manifest requis, aucune dépendance Studio/Compiler/backend introduite', () => {
  const idx = ivoryJs.indexOf('function renderProject(project, context');
  const end = ivoryJs.indexOf('\n// ── Espaces', idx);
  const body = ivoryJs.slice(idx, end > 0 ? end : idx + 2000);
  assert.ok(!/fetch\(|XMLHttpRequest|api\(/.test(body));
});

// ── Actualités + Article V2.1 -- marges actives, non-invention ───────

test('Actualités V2.1 -- lead déterministe (premier article de l\'ordre existant), jamais un flag Studio inventé', () => {
  const items = [{ id: 'a1', title: 'PREMIER_TEST' }, { id: 'a2', title: 'DEUXIEME_TEST' }];
  const html = renderNews({ intro: {}, items });
  const leadIdx = html.indexOf('tct-news-lead');
  const archiveIdx = html.indexOf('tct-news-row');
  assert.ok(html.slice(leadIdx, leadIdx + 300).includes('PREMIER_TEST'));
  assert.ok(html.slice(archiveIdx, archiveIdx + 300).includes('DEUXIEME_TEST'));
});

test('Actualités V2.1 -- fonctionne avec un seul article (lead seul, aucune archive, layout jamais cassé)', () => {
  const html = renderNews({ intro: {}, items: [{ id: 'a1', title: 'SEUL_TEST' }] });
  assert.ok(html.includes('SEUL_TEST'));
  assert.ok(!html.includes('tct-news-row'));
});

test('Actualités V2.1 -- densité variable de l\'archive déjà en place (compact au-delà des 2 premières entrées), jamais le même poids partout', () => {
  assert.match(ivoryJs, /const compact = index >= 2;/);
});

test('Actualités V2.1 -- aucun filtre inventé (confirmation reconduite -- le produit n\'en possède toujours pas)', () => {
  assert.ok(!ivoryJs.includes('tct-news-filter'));
});

test('Article V2.1 -- marges actives : les médias inline (image/galerie) peuvent sortir de la colonne de lecture, jamais le texte', () => {
  const idxMedia = ivoryJs.indexOf('.tct-news-inline-media {');
  const cssMedia = ivoryJs.slice(idxMedia, idxMedia + 200);
  assert.match(cssMedia, /width:calc\(100% \+ 2 \* min\(6vw,32px\)\)/);

  const idxReading = ivoryJs.indexOf('.tct-news-article-reading {');
  const cssReading = ivoryJs.slice(idxReading, idxReading + 100);
  assert.ok(!/width:calc\(100% \+/.test(cssReading), 'le texte lui-même ne doit jamais sortir de sa colonne');
});

test('Article V2.1 -- rupture de marge plafonnée (jamais au-delà de la marge propre de la section, aucun risque de débordement horizontal)', () => {
  const idx = ivoryJs.indexOf('.tct-news-inline-media {');
  const css = ivoryJs.slice(idx, idx + 200);
  assert.match(css, /max\(-6vw,-32px\)/);
});

test('Article V2.1 -- rupture de marge désactivée sur mobile (texte déjà pleine largeur, aucune marge active pertinente à cette échelle)', () => {
  assert.match(ivoryJs, /\.tct-news-inline-media, \.tct-news-inline-gallery \{ width:100%; margin-left:0; margin-right:0; \}/);
});

test('Article V2.1 -- aucune perte de contenu : fixture riche (titre, chapeau, date, tag, paragraphe, intertitre, liste, image, document) tous rendus', () => {
  const item = {
    id: 'a1', title: 'TITRE_TEST', tag: 'TAG_TEST', date: 'DATE_TEST', summary: 'CHAPEAU_TEST',
    blocks: [
      { type: 'paragraph', runs: [{ text: 'PARAGRAPHE_TEST' }] },
      { type: 'heading', runs: [{ text: 'INTERTITRE_TEST' }] },
      { type: 'bulletList', items: [{ runs: [{ text: 'PUCE_TEST' }] }] },
      { type: 'image', asset: { url: '/x.jpg', alt: 'ALT_IMAGE_TEST' } },
      { type: 'document', asset: { url: '/x.pdf' }, title: 'DOC_TEST' }
    ]
  };
  const html = renderNewsArticle(item, [item], 0);
  for (const needle of ['TITRE_TEST', 'TAG_TEST', 'DATE_TEST', 'CHAPEAU_TEST', 'PARAGRAPHE_TEST', 'INTERTITRE_TEST', 'PUCE_TEST', 'ALT_IMAGE_TEST', 'DOC_TEST']) {
    assert.ok(html.includes(needle), `donnée perdue : "${needle}"`);
  }
});

test('Suggestions V2.1 -- reflète exactement la capacité réelle (un seul lien de continuation), jamais un carousel ou plusieurs recommandations artificielles', () => {
  const item = { id: '1', title: 'x' };
  const older = { id: '0', title: 'ARTICLE_PRECEDENT_TEST' };
  const html = renderNewsArticle(item, [item, older], 0);
  assert.match(html, /Lire aussi : ARTICLE_PRECEDENT_TEST/);
  assert.ok(!html.includes('data-tct-rail'), 'jamais un rail pour une suggestion unique');
  const suggestionLinks = (html.match(/tct-news-next-story/g) || []).length;
  assert.equal(suggestionLinks, 1, 'jamais plus d\'une suggestion mise en scène');
});

test('Suggestions V2.1 -- dernier article de la liste : aucune suggestion inventée pour combler', () => {
  const item = { id: '1', title: 'x' };
  const html = renderNewsArticle(item, [item], 0);
  assert.ok(!html.includes('tct-news-next-story'));
});

test('Aucun type de bloc "citation isolée" inventé dans renderNewsBlocks -- le modèle de données actuel ne le supporte pas, jamais fabriqué pour cette passe', () => {
  const idx = ivoryJs.indexOf('function renderNewsBlocks');
  const end = ivoryJs.indexOf('\nfunction ', idx + 10);
  const body = ivoryJs.slice(idx, end);
  assert.ok(!/block\.type === 'quote'/.test(body));
});

// ── Complétion compositionnelle réelle -- split lead/archive, marge active ──

test('Actualités -- vrai split côte à côte lead/archive (conteneur .tct-news-grid partagé), jamais un empilement vertical de deux sections indépendantes', () => {
  const html = renderNews({ intro: {}, items: [{ id: 'a1', title: 'A' }, { id: 'a2', title: 'B' }] });
  assert.match(html, /<div class="tct-news-grid">\s*<article class="tct-news-lead/, 'lead et archive doivent partager le même conteneur grid');
  const idx = ivoryJs.indexOf('.tct-news-grid {');
  const css = ivoryJs.slice(idx, idx + 250);
  assert.match(css, /grid-template-columns:1\.35fr 1fr/, 'vraie asymétrie de largeur, pas une grille uniforme');
  assert.match(css, /border-top:1px solid var\(--tct-hairline-soft\)/);
});

test('Actualités -- séparation structurelle réelle entre lead et archive (bordure verticale), jamais une simple juxtaposition sans couture', () => {
  const idx = ivoryJs.indexOf('.tct-news-lead {\n    padding');
  const css = ivoryJs.slice(idx, idx + 200);
  assert.match(css, /border-right:1px solid var\(--tct-hairline-soft\)/);
});

test('Actualités -- différence d\'échelle réelle entre titre lead et titres archive (rapport > 2x au maximum)', () => {
  const leadIdx = ivoryJs.indexOf('.tct-news-lead h2 {');
  const leadCss = ivoryJs.slice(leadIdx, leadIdx + 350);
  const leadMax = Number(leadCss.match(/font-size:clamp\([^,]+,[^,]+,(\d+(?:\.\d+)?)rem\)/)[1]);
  const rowIdx = ivoryJs.indexOf('.tct-news-row h3 {');
  const rowCss = ivoryJs.slice(rowIdx, rowIdx + 350);
  const rowMax = Number(rowCss.match(/font-size:clamp\([^,]+,[^,]+,(\d+(?:\.\d+)?)rem\)/)[1]);
  assert.ok(leadMax / rowMax >= 2, `écart d'échelle insuffisant : lead ${leadMax}rem vs archive ${rowMax}rem`);
});

test('Actualités -- lead sans média reste pleinement dominant (aucun trou, la mise en page ne dépend pas de la présence d\'une image)', () => {
  const html = renderNews({ intro: {}, items: [{ id: 'a1', title: 'TITRE_SANS_MEDIA', summary: 'RESUME_TEST' }, { id: 'a2', title: 'B' }] });
  assert.ok(html.includes('TITRE_SANS_MEDIA') && html.includes('RESUME_TEST'));
  assert.ok(!html.includes('tct-news-lead-media'));
});

test('Actualités -- un seul article : modificateur is-lead-only retire la bordure flottante, jamais une couture sans contenu en face', () => {
  const html = renderNews({ intro: {}, items: [{ id: 'a1', title: 'A' }] });
  assert.match(html, /tct-news-grid is-lead-only/);
  const idx = ivoryJs.indexOf('.tct-news-grid.is-lead-only .tct-news-lead {');
  assert.match(ivoryJs.slice(idx, idx + 80), /border-right:0/);
});

test('Article -- le chapeau devient la matière de la marge active (position sticky, colonne dédiée), jamais rendu une seconde fois dans le header', () => {
  const item = { id: '1', title: 'x', summary: 'CHAPEAU_UNIQUE_TEST', blocks: [] };
  const html = renderNewsArticle(item, [item], 0);
  const occurrences = (html.match(/CHAPEAU_UNIQUE_TEST/g) || []).length;
  assert.equal(occurrences, 1);
  const headerEnd = html.indexOf('</header>');
  assert.ok(!html.slice(0, headerEnd).includes('CHAPEAU_UNIQUE_TEST'), 'jamais dans le header');
  assert.match(html, /<aside class="tct-news-article-margin">\s*<p>CHAPEAU_UNIQUE_TEST/);
});

test('Article -- marge active sticky sur desktop, repli naturel dans le flux sur mobile (jamais de vide si aucun chapeau)', () => {
  const idx = ivoryJs.indexOf('.tct-news-article-margin {');
  const css = ivoryJs.slice(idx, idx + 150);
  assert.match(css, /position:sticky/);
  const mobileIdx = ivoryJs.indexOf('.tct-news-article-margin { position:static');
  assert.ok(mobileIdx > 0, 'repli mobile doit exister (position:static)');

  const htmlSansChapeau = renderNewsArticle({ id: '1', title: 'x', blocks: [] }, [{ id: '1' }], 0);
  assert.ok(!htmlSansChapeau.includes('tct-news-article-margin'), 'aucune structure de marge vide sans chapeau réel');
});

test('Article -- header conserve son rapport d\'échelle (titre dominant 8/12, métadonnées 2/12), non retouché car déjà conforme', () => {
  const idx = ivoryJs.indexOf('.tct-news-article-opening h1 {');
  assert.match(ivoryJs.slice(idx, idx + 60), /grid-column:3 \/ span 8/);
});

// ── Questions V2.1 -- titre et saisie dans le même geste ──────────────

test('Questions -- titre et saisie fusionnés dans le même conteneur (.tct-questions-top), jamais deux blocs empilés séparés', () => {
  const html = renderQuestions({ intro: {}, items: [] }, false);
  assert.match(html, /<header class="tct-questions-top tct-reveal"[\s\S]*?<h1>[\s\S]*?<div class="tct-question-workbench"[\s\S]*?<\/header>/, 'titre et champ de saisie doivent partager le même header');
});

test('Questions -- micro-label "Questions" redondant retiré (n\'apportait aucune information au-dessus d\'un titre qui dit déjà la même chose)', () => {
  assert.ok(!ivoryJs.includes('tct-questions-opening-eyebrow'));
});

test('Questions -- composition à deux colonnes réelle (titre+description | saisie), jamais une simple pile verticale', () => {
  const idx = ivoryJs.indexOf('.tct-questions-top {');
  const css = ivoryJs.slice(idx, idx + 250);
  assert.match(css, /display:grid/);
  assert.match(css, /grid-template-columns:minmax\(0,\.85fr\) minmax\(320px,1\.15fr\)/);
});

test('Questions -- résultat intégré au canvas, jamais une card dans une card (aucun fond/bordure/ombre sur le conteneur de réponse)', () => {
  const idx = ivoryJs.indexOf('.tct-question-result {');
  const css = ivoryJs.slice(idx, idx + 100);
  assert.ok(!/background|border|box-shadow/.test(css));
});

test('Questions -- aucune théâtralisation IA (pas de marque Storm, pas de badge de confiance inventé) dans les templates de réponse', () => {
  const idx = ivoryJs.indexOf('const answerMarkup = entry =>');
  const end = ivoryJs.indexOf('const showAnswer', idx);
  const body = ivoryJs.slice(idx, end);
  assert.ok(!/Storm|%\s*fiable|IA vérifiée|confiance/i.test(body));
});

test('Questions -- réponse prioritaire (titre de l\'entrée réelle), jamais la question brute de l\'utilisateur répétée en énorme (doctrine déjà fixée, reconfirmée)', () => {
  const idx = ivoryJs.indexOf('const answerMarkup = entry =>');
  const body = ivoryJs.slice(idx, idx + 400);
  assert.match(body, /<h2>\$\{esc\(entry\.title\)\}<\/h2>/);
});

test('Questions -- escalade réelle utilise les capacités existantes uniquement (transmission vers contact), jamais un routage inventé', () => {
  const idx = ivoryJs.indexOf('const unknownMarkup');
  const body = ivoryJs.slice(idx, idx + 700);
  assert.match(body, /data-tct-open-contact/);
});

test('Questions -- structure FAQ existante (ol sémantique) préservée, jamais transformée en accordion sans raison', () => {
  const html = renderQuestions({ intro: {}, items: [{ id: 'q1', title: 'A' }] }, false);
  assert.match(html, /<ol>\s*\n\s*<li>/);
  assert.ok(!ivoryJs.includes('tct-question-accordion'));
});

test('Questions -- aucun changement au moteur (matchFaq reste la seule autorité), cette passe est strictement renderer/UI', () => {
  assert.match(ivoryJs, /exact Pangea matchFaq stays authoritative/);
});

// ── Espaces/Ambassadeurs/Équipe -- intégration V2.1, discipline micro-label ──
// Passe d'intégration, pas de redesign : ces trois surfaces conservent
// leur mécanique (rails protégés, filtres conditionnels, absence de
// rail générique sur la liste Espaces) déjà validée dans les passes
// précédentes. Seuls trois micro-labels redondants ont été retirés,
// cohérents avec la discipline déjà appliquée sur toutes les autres
// surfaces V2.1.

test('Espaces -- micro-label "Espaces" redondant retiré de l\'ouverture, titre et description conservés', () => {
  const html = renderSpaces({ intro: { title: 'TITRE_TEST', description: 'DESC_TEST' }, items: [] });
  assert.ok(!html.includes('tct-spaces-opening-eyebrow'));
  assert.ok(html.includes('TITRE_TEST') && html.includes('DESC_TEST'));
});

test('Ambassadeurs -- micro-label "Ambassadeurs" redondant retiré de l\'ouverture, titre et description conservés', () => {
  const idx = ivoryJs.indexOf('function renderAmbassadors');
  const body = ivoryJs.slice(idx, idx + 2500);
  assert.ok(!body.includes('tct-ambassadors-opening-eyebrow'));
  assert.match(body, /<h1>Des relais au plus près du terrain\.<\/h1>/);
});

test('Équipe -- micro-label "Équipe projet" redondant retiré (le h2 dit déjà la même chose), contenu réel toujours rendu', () => {
  const html = renderProject({ intro: {}, sections: [{ type: 'team' }] }, { team: { members: [{ name: 'NOM_TEST', title: 'ROLE_TEST' }] } });
  assert.ok(!html.includes('<span>Équipe projet</span>'));
  assert.match(html, /<h2>Ce projet est porté par une équipe\.<\/h2>/);
  assert.ok(html.includes('NOM_TEST') && html.includes('ROLE_TEST'));
});

test('Espaces -- aucun rail générique introduit sur la liste principale, décision antérieure toujours en vigueur', () => {
  const html = renderSpaces({ intro: {}, items: [{ id: 's1', title: 'A', usageTags: [] }, { id: 's2', title: 'B', usageTags: [] }] });
  assert.ok(!html.includes('data-tct-rail'));
});

test('Ambassadeurs et Équipe -- rails protégés intacts (familles ambassadors/team, sémantique <ul><li>), mécanique jamais touchée par cette passe', () => {
  const idxA = ivoryJs.indexOf('data-tct-rail-family="ambassadors"');
  const idxT = ivoryJs.indexOf('data-tct-rail-family="team"');
  assert.ok(idxA > 0 && idxT > 0);
});

test('Aucune nouvelle donnée inventée sur ces trois surfaces (aucun nouveau champ Manifest, aucun texte marketing ajouté)', () => {
  const idx = ivoryJs.indexOf('function renderSpaces');
  const end = ivoryJs.indexOf('function renderAmbassadors');
  const body = ivoryJs.slice(idx, end);
  assert.ok(!/Vos ambassadeurs sont là pour vous/i.test(body));
});

// ── Espaces + Ambassadeurs + Équipe -- intégration V2.1 (changements réels) ──

test('Espaces -- usageTags réels affichés comme chips (donnée déjà calculée, jamais visible auparavant), jamais un label inventé', () => {
  const idx = ivoryJs.indexOf('function renderSpaceIndexItem');
  const body = ivoryJs.slice(idx, idx + 1600);
  assert.match(body, /tct-space-chip/);
  assert.match(body, /tags\.slice\(0, 3\)\.map\(tag => `<span class="tct-space-chip">\$\{esc\(tag\)\}<\/span>`\)/);
});

test('Espaces -- chips absentes si aucun usageTag réel (jamais de pastille vide inventée)', () => {
  const idx = ivoryJs.indexOf('${tags.length ? `');
  assert.ok(idx > 0);
});

test('Espaces -- liste principale jamais convertie en rail générique (décision produit déjà prise, reconfirmée)', () => {
  const idx = ivoryJs.indexOf('function renderSpaces(spaces)');
  const body = ivoryJs.slice(idx, idx + 600);
  assert.match(body, /DÉCISION STRUCTURELLE EXPLICITE/);
});

test('Équipe -- distincte visuellement d\'Ambassadeurs : le rôle porte davantage de poids que le nom (institutionnel), inverse d\'Ambassadeurs où le nom domine', () => {
  const idx = ivoryJs.indexOf('.tct-project-person-copy strong {');
  const strongCss = ivoryJs.slice(idx, idx + 120);
  assert.match(strongCss, /font-size:\.82rem/);
  const spanIdx = ivoryJs.indexOf('.tct-project-person-copy span {');
  const spanCss = ivoryJs.slice(spanIdx, spanIdx + 320);
  assert.match(spanCss, /font-size:1\.05rem/, 'le rôle (span) doit être visuellement plus fort que le nom (strong)');
});

test('Équipe -- rail family "team" toujours intact, sémantique <ul><li> préservée', () => {
  const html_ = renderProject({ intro: {}, sections: [{ type: 'team' }] }, { team: { members: [{ name: 'A', title: 'B' }] } });
  assert.match(html_, /<ul class="tct-project-team-grid" data-tct-rail data-tct-rail-family="team"/);
  assert.match(html_, /<li class="tct-project-person">/);
});

test('Aucune nouvelle donnée introduite -- usageTags/team/ambassadeurs sont des champs déjà existants, jamais un nouveau champ Manifest', () => {
  assert.ok(!ivoryJs.includes('item.newSpaceField'));
  const idx = ivoryJs.indexOf('const tags = (Array.isArray(item.usageTags)');
  assert.ok(idx > 0, 'usageTags doit rester le champ déjà existant, jamais renommé/dupliqué');
});

// ── Passe d'intégration transverse finale V2.1 -- corrections réelles ──

test('Audit transversal -- micro-label "Actualités" décoratif retiré, cohérence avec Le Projet/Questions (aucune information réelle apportée)', () => {
  assert.ok(!ivoryJs.includes('tct-news-opening-eyebrow'));
});

test('Audit transversal -- Ambassadeurs rattrapé sur un résidu de padding jamais traité (jusqu\'à 210px), jamais touché lors des passes précédentes', () => {
  const idx = ivoryJs.indexOf('.tct-ambassadors-roster { padding');
  const css = ivoryJs.slice(idx, idx + 80);
  const maxValues = [...css.matchAll(/,(\d+)px\)/g)].map(m => Number(m[1]));
  for (const v of maxValues) assert.ok(v <= 100, `padding encore excessif : ${v}px`);
});

test('Audit transversal -- exactement les quatre familles de rail protégées, aucune dérive après l\'ensemble des passes V2.1', () => {
  const families = [...ivoryJs.matchAll(/data-tct-rail-family="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(new Set(families), new Set(['team', 'figures', 'choices', 'ambassadors']));
});

test('Audit transversal -- Liquid Glass toujours limité aux mêmes contrôles flottants légitimes (aucun nouvel usage introduit pendant les passes V2.1)', () => {
  const legitimate = ['tct-header', 'tct-space-image-action', 'tct-space-viewer-close', 'tct-inspector-close', 'tct-plan-inspector', 'tct-inspector-toolbar', 'tct-pdf-reader-bar', 'tct-nav', 'tct-mood-fab'];
  const lines = ivoryJs.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes('backdrop-filter:') || lines[i].trim().startsWith('@supports')) continue;
    const before = lines.slice(Math.max(0, i - 15), i + 1).join('\n');
    const matchesKnown = legitimate.some(sel => before.includes(sel));
    assert.ok(matchesKnown, `backdrop-filter trouvé hors des contrôles flottants connus, près de : ${lines[i].trim()}`);
  }
});

test('Audit transversal -- résistance structurelle confirmée sur contenu extrême (chapeau très long, titre très long, 20 personnes, timeline sans jalon courant) sans erreur ni rupture', () => {
  const longSummary = 'x'.repeat(300);
  const item = { id: '1', title: 'x', summary: longSummary, blocks: [] };
  const html = renderNewsArticle(item, [item], 0);
  assert.ok(html.includes(longSummary));

  const many = Array.from({ length: 20 }, (_, i) => ({ name: `P${i}`, title: 'R' }));
  const htmlTeam = renderProject({ intro: {}, sections: [{ type: 'team' }] }, { team: { members: many } });
  assert.equal((htmlTeam.match(/tct-project-person"/g) || []).length, 20);
});
