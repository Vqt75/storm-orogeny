// TECTONIC — Renderer Ivory (Phase 5, migration de parité)
//
// Contrat inchangé : ce fichier consomme le Manifest et les actions
// du Public Core reçues en arguments. Il ne connaît jamais d'endpoint,
// jamais de mécanisme de stockage — voir runtime.js pour la frontière
// Renderer / Public Core.
//
// Périmètre de cette migration (voir TECTONIC_PHASE5_PARITY_AUDIT.md) :
// moteur FAQ, escalade contact, lecture complète d'article, filtres
// Plans & 3D, distinction image/PDF, lightbox, libellé roster
// ambassadeurs, CTA ambassadeurs/équipe, séparation des groupes
// équipe, logo. Volontairement hors périmètre : baromètre météo,
// tracking KPI, repli IA Gemini, typographies personnalisées
// (jamais appliquées publiquement par Pangea lui-même, donc pas un
// écart de parité — voir l'audit).

import { matchFaq, scoreEntry } from '../faq-engine.js';
import { createMoodSolicitationEngine } from '../mood-engine.js';

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Auth admin Tectonic (xyz_admin_token / sessionStorage) retirée
// (branchement Orogeny) : sans objet, Ivory ne gère plus elle-même
// aucune notion de session admin, voir wireInteractions et le lien
// Administration ci-dessous.

// Lien Administration -> Studio Orogeny réel (branchement Orogeny).
// projectId déduit de l'URL courante (page servie à
// /public/projects/:projectId), jamais codé en dur ni transmis via le
// Manifest -- l'authentification Orogeny (devAuth, appartenance de
// projet) prend le relais nativement dès la navigation, sans overlay
// ni session propre à Ivory.
function studioUrlFromLocation(win) {
  const w = win || (typeof window !== 'undefined' ? window : null);
  const pathname = (w && w.location && w.location.pathname) || '';
  const match = pathname.match(/\/public\/projects\/([^/]+)/);
  return match ? `/projects/${match[1]}/studio` : '/';
}



// Studio Hardening 8A — semantic inline emphasis shared by descriptive copy.
// Authors may express emphasis, but never colour, font, size or alignment.
// Stored tokens stay presentation-agnostic: **bold**, //italic//, ++underline++.
function inlineRichText(value) {
  let safe = esc(value || '');
  safe = safe.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>');
  safe = safe.replace(/\+\+([\s\S]+?)\+\+/g, '<u>$1</u>');
  safe = safe.replace(/\/\/([\s\S]+?)\/\//g, '<em>$1</em>');
  safe = safe.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
  return safe.replace(/\r?\n/g, '<br>');
}

function isPdfUrl(url) {
  return /\.pdf($|\?)/i.test(url || '');
}


// Ivory v2.9.2 — Ambassadeurs zero-detour join flow. The Manifest remains semantic: all
// visual decisions (grid, rhythm, motion) stay inside this renderer.
function safeCssColor(value, fallback) {
  const v = String(value || '').trim();
  return /^#[0-9a-f]{3,8}$/i.test(v) ? v : fallback;
}

// v2.4: narrow resolver for expressive Home accents only.
// The full cross-theme Brand Color Resolver remains a separate Storm backlog item.
function hexToRgb(value) {
  const raw = String(value || '').replace('#', '').trim();
  if (!/^[0-9a-f]{3,8}$/i.test(raw)) return null;
  let h = raw;
  if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map(c => c + c).join('');
  else h = h.slice(0, 6);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16)
  };
}

function colorLuminance(value) {
  const rgb = hexToRgb(value);
  if (!rgb) return null;
  const channel = c => {
    const v = c / 255;
    return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4);
  };
  return .2126 * channel(rgb.r) + .7152 * channel(rgb.g) + .0722 * channel(rgb.b);
}

function colorContrast(a, b) {
  const la = colorLuminance(a);
  const lb = colorLuminance(b);
  if (la == null || lb == null) return 0;
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + .05) / (lo + .05);
}

function isNeutralBrandColor(value) {
  const rgb = hexToRgb(value);
  if (!rgb) return true;
  const spread = Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b);
  const average = (rgb.r + rgb.g + rgb.b) / 3;
  return spread <= 18 || average <= 36 || average >= 238;
}

function resolveExpressionAccent(primary, secondary) {
  // Identity 1A : même resolver que le Studio quand le Brand Engine partagé
  // est chargé par tectonic.html. Le fallback conserve le comportement
  // historique pour les tests/imports isolés du renderer.
  const shared = globalThis && globalThis.StormBrandEngine;
  if (shared && typeof shared.resolve === 'function') {
    const decision = shared.resolve([primary, secondary], { canvas: '#F7F7F5' });
    if (decision && decision.roles && decision.roles.accent) return decision.roles.accent;
  }

  const canvas = '#F7F7F5';
  const ink = '#1E1D1E';
  const isUsable = color => !isNeutralBrandColor(color) && colorContrast(color, canvas) >= 1.8;
  if (isNeutralBrandColor(primary)) return isUsable(secondary) ? secondary : ink;
  if (isUsable(primary)) return primary;
  if (isUsable(secondary)) return secondary;
  return ink;
}

function renderLandingStatement(statement) {
  const source = String(statement || '');
  const match = source.match(/prend\s+forme\.?$/i);
  if (!match) return esc(source);
  const prefix = source.slice(0, match.index);
  return `${esc(prefix)}<span class="tct-home-landing-accent">${esc(match[0])}</span>`;
}

function safeCssFont(value, fallback) {
  const v = String(value || '').replace(/[^a-zA-Z0-9 _-]/g, '').trim();
  return v || fallback;
}

function safeFontAssetUrl(value) {
  const v = String(value || '').trim();
  return /^\/uploads\/[a-zA-Z0-9._-]+$/.test(v) ? v : '';
}

function fontFaceCss(font, fallbackFamily) {
  const family = safeCssFont(font && font.family, fallbackFamily);
  const url = safeFontAssetUrl(font && font.asset && font.asset.url);
  if (!url) return '';
  return `@font-face{font-family:"${family}";src:url("${url}");font-display:swap;}`;
}

// currentMilestone/nextMilestone retirées (branchement Orogeny) :
// home.now/home.next viennent désormais entièrement du Compiler,
// plus aucun recalcul de ces jalons depuis content.timeline ici.

function findNewsItem(news, id) {
  if (!id) return null;
  return (news && news.items || []).find(item => String(item.id) === String(id)) || null;
}

// Experience v2 keeps the authored article text intact, but gives its
// lightweight legacy `##` convention semantic structure for editorial reading.
function articleBodyToHtml(text) {
  const lines = String(text || '').split(/\r?\n/);
  const chunks = [];
  let paragraph = [];

  const flushParagraph = () => {
    const value = paragraph.join(' ').trim();
    if (value) chunks.push(`<p>${esc(value)}</p>`);
    paragraph = [];
  };

  lines.forEach(line => {
    const trimmed = String(line || '').trim();
    if (!trimmed) {
      flushParagraph();
      return;
    }
    if (trimmed.startsWith('## ')) {
      flushParagraph();
      chunks.push(`<h2>${esc(trimmed.slice(3))}</h2>`);
      return;
    }
    paragraph.push(trimmed);
  });
  flushParagraph();
  return chunks.join('');
}

function safeNewsHref(value) {
  const href = String(value || '').trim();
  return /^(https?:\/\/|mailto:|\/|#)/i.test(href) ? href : '';
}

function renderNewsRuns(runs) {
  if (!Array.isArray(runs)) return '';
  return runs.map(run => {
    let value = esc(run && run.text || '');
    if (!value) return '';
    if (run && run.bold) value = `<strong>${value}</strong>`;
    if (run && run.italic) value = `<em>${value}</em>`;
    if (run && run.highlight) value = `<mark>${value}</mark>`;
    const href = safeNewsHref(run && run.href);
    if (href) value = `<a href="${esc(href)}">${value}</a>`;
    return value;
  }).join('');
}

function formatDocumentMeta(block) {
  const bytes = Number(block && block.fileSize || 0);
  let size = '';
  if (Number.isFinite(bytes) && bytes > 0) {
    if (bytes >= 1024 * 1024) size = `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1).replace('.', ',')} Mo`;
    else size = `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  }
  return ['PDF', size].filter(Boolean).join(' · ');
}

function renderNewsBlocks(blocks, legacyBody) {
  if (!Array.isArray(blocks) || !blocks.length) return articleBodyToHtml(legacyBody);

  return blocks.map(block => {
    if (!block || typeof block !== 'object') return '';
    if (block.type === 'paragraph') {
      const html = renderNewsRuns(block.runs);
      return html ? `<p>${html}</p>` : '';
    }
    if (block.type === 'heading') {
      const html = renderNewsRuns(block.runs);
      return html ? `<h2>${html}</h2>` : '';
    }
    if (block.type === 'bulletList' || block.type === 'orderedList') {
      const tag = block.type === 'orderedList' ? 'ol' : 'ul';
      const items = (block.items || []).map(item => `<li>${renderNewsRuns(item && item.runs)}</li>`).join('');
      return items ? `<${tag} class="tct-news-rich-list">${items}</${tag}>` : '';
    }
    if (block.type === 'image' && block.asset && block.asset.url) {
      return `
        <figure class="tct-news-inline-media tct-reveal" data-tct-reveal>
          ${renderAsset(block.asset, 'tct-news-inline-image')}
          ${(block.asset.caption || block.asset.alt) ? `<figcaption>${esc(block.asset.caption || block.asset.alt)}</figcaption>` : ''}
        </figure>`;
    }
    if (block.type === 'gallery' && Array.isArray(block.items) && block.items.length) {
      return `
        <figure class="tct-news-inline-gallery tct-reveal" data-tct-reveal>
          <div class="tct-news-inline-gallery-grid">
            ${block.items.map(asset => asset && asset.url ? `<div>${renderAsset(asset, 'tct-news-inline-gallery-image')}</div>` : '').join('')}
          </div>
          ${block.caption ? `<figcaption>${esc(block.caption)}</figcaption>` : ''}
        </figure>`;
    }
    if (block.type === 'document' && block.asset && block.asset.url) {
      const href = safeNewsHref(block.asset.url);
      if (!href) return '';
      const title = block.title || 'Document à consulter';
      const meta = formatDocumentMeta(block);
      return `
        <div class="tct-news-inline-document">
          <button type="button" class="tct-news-document-open" data-tct-pdf-reader data-tct-pdf-src="${esc(href)}" data-tct-pdf-title="${esc(title)}">
            <span class="tct-news-document-kicker">${esc(meta)}</span>
            <strong>${esc(title)}</strong>
            ${block.description ? `<p>${esc(block.description)}</p>` : ''}
            <em>Consulter →</em>
          </button>
          <a class="tct-news-document-download" href="${esc(href)}" download>Télécharger</a>
        </div>`;
    }
    return '';
  }).join('');
}

function splitNewsMeta(value) {
  const parts = String(value || '').split('·').map(part => part.trim()).filter(Boolean);
  return {
    date: parts[0] || '',
    extra: parts.slice(1).join(' · ')
  };
}

function formatNewsPublishedAt(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', { day:'numeric', month:'long', year:'numeric' }).format(date);
}

function newsMeta(item) {
  const legacy = splitNewsMeta(item && item.date);
  const date = formatNewsPublishedAt(item && item.publishedAt) || legacy.date;
  const minutes = Number(item && item.readingMinutes);
  return {
    date,
    extra: Number.isFinite(minutes) && minutes > 0 ? `${minutes} min` : legacy.extra
  };
}

function newsAsset(item) {
  return item && (item.asset || item.image || item.media) || null;
}

function renderAsset(asset, cssClass, enableLightbox = false) {
  if (!asset || !asset.url) return '';
  if (isPdfUrl(asset.url)) {
    return `
      <a class="${cssClass} tct-pdf-chip" href="${esc(asset.url)}" target="_blank" rel="noopener">
        <span class="tct-pdf-icon">PDF</span><span>${esc(asset.alt || 'Ouvrir le document')}</span>
      </a>`;
  }
  // La lightbox (zoom/déplacement) est réservée aux visuels Plans & 3D
  // — c'est ce que l'audit de parité établit, pas les portraits
  // d'ambassadeurs/équipe. Activation explicite, jamais par défaut,
  // pour ne pas l'étendre silencieusement à un usage non demandé.
  return `<img class="${cssClass}${enableLightbox ? ' tct-lightbox-trigger' : ''}" src="${esc(asset.url)}" alt="${esc(asset.alt)}" loading="lazy"${enableLightbox ? ` data-lightbox-src="${esc(asset.url)}" data-lightbox-title="${esc(asset.alt)}" tabindex="0" role="button" aria-label="Agrandir : ${esc(asset.alt || 'visuel')}"` : ''}>`;
}

function renderIntro(intro) {
  if (!intro) return '';
  return `
    <header class="tct-intro">
      ${intro.eyebrow ? `<div class="tct-eyebrow">${esc(intro.eyebrow)}</div>` : ''}
      ${intro.title ? `<h2>${esc(intro.title)}</h2>` : ''}
      ${intro.description ? `<p class="tct-desc">${esc(intro.description)}</p>` : ''}
    </header>`;
}

function renderHome(home, context = {}) {
  if (!home) return '';

  const timeline = context.timeline || null;
  const news = context.news || null;
  // Neutralisation bornée (branchement Orogeny) : current/upcoming ne
  // sont plus recalculés ici -- home.now/home.next viennent déjà
  // entièrement du Compiler (Phase 2D). Même chose pour "latest" :
  // plus d'exclusion du featured recalculée ici, on lit simplement le
  // premier article compilé. Structure, DA et responsive inchangés.
  const showMilestones = home.showMilestones !== false;
  const showAskPrompt = home.showAskPrompt !== false;
  const featuredSource = home.featured && home.featured.source && home.featured.source.module === 'news'
    ? findNewsItem(news, home.featured.source.id)
    : null;
  const latest = home.latest || null;

  // Home v2.3 introduces a quiet editorial prologue. The landing sentence may
  // carry the introductory tone, but the main home headline remains the most
  // truthful current phase whenever timeline data exists.
  const landingStatement = (home.statement && String(home.statement).trim())
    || (home.hero && home.hero.statement && String(home.hero.statement).trim())
    || 'Un nouveau lieu de travail prend forme.';
  const headline = (showMilestones && home.now && home.now.label)
    || (home.message && String(home.message).trim())
    || 'Le projet avance.';
  const presentText = (showMilestones && home.now && home.now.description) || '';
  const progress = timeline && timeline.progress || null;
  const phaseMeta = showMilestones && progress && progress.currentStepLabel && progress.totalSteps
    ? `${progress.currentStepLabel} sur ${progress.totalSteps}`
    : '';

  const nextDate = (home.next && home.next.date) || '';
  const nextTitle = (home.next && home.next.label) || '';
  const nextDescription = (home.next && home.next.description) || '';

  const nextBlock = showMilestones && (nextDate || nextTitle) ? `
    <div class="tct-home-nextline tct-reveal" data-tct-reveal aria-labelledby="tct-next-title">
      <div class="tct-home-nextline-rail">
        <div class="tct-home-nextline-label">À suivre</div>
        ${nextDate ? `<div class="tct-home-nextline-date">${esc(nextDate)}</div>` : ''}
      </div>
      <div class="tct-home-nextline-copy">
        ${nextTitle ? `<h2 id="tct-next-title">${esc(nextTitle)}</h2>` : ''}
        ${nextDescription ? `<p>${esc(nextDescription)}</p>` : ''}
        ${timeline ? `<a class="tct-text-link tct-home-nextline-link" href="#timeline" data-tct-route>Voir les grandes étapes <span aria-hidden="true">→</span></a>` : ''}
      </div>
    </div>` : '';

  const featured = home.featured ? `
    <section class="tct-home-feature tct-reveal" data-tct-reveal aria-labelledby="tct-featured-title">
      <div class="tct-home-feature-inner">
        <div class="tct-home-feature-meta">
          <span>À la une</span>
          ${featuredSource && featuredSource.tag ? `<span>${esc(featuredSource.tag)}</span>` : ''}
          ${featuredSource && featuredSource.date ? `<span>${esc(featuredSource.date)}</span>` : ''}
        </div>
        <div class="tct-home-feature-title-wrap">
          <h2 id="tct-featured-title">${esc(home.featured.title)}</h2>
        </div>
        <div class="tct-home-feature-aside">
          ${home.featured.summary ? `<p>${esc(home.featured.summary)}</p>` : ''}
          <a class="tct-text-link" href="#${esc(home.featured.source && home.featured.source.module || 'news')}" data-tct-route>
            Découvrir <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </section>` : '';

  const latestNews = latest ? `
    <section class="tct-home-latest tct-reveal" data-tct-reveal aria-labelledby="tct-latest-title">
      <div class="tct-home-latest-label">Dernière actualité</div>
      <div class="tct-home-latest-date">${esc(latest.date || '')}</div>
      <div class="tct-home-latest-copy">
        <span>${esc(latest.tag || '')}</span>
        <h2 id="tct-latest-title">${esc(latest.title)}</h2>
      </div>
      <a class="tct-round-link" href="#news" data-tct-route aria-label="Lire l’actualité"><span aria-hidden="true">→</span></a>
    </section>` : '';

  const questionsBlock = showAskPrompt ? `
      <section class="tct-home-questions tct-reveal" data-tct-reveal aria-labelledby="tct-home-questions-title">
        <div class="tct-home-questions-overline">Questions</div>
        <h2 id="tct-home-questions-title">${esc(home.askPrompt || 'Une question sur le projet ?')}</h2>
        <p>Retrouvez les informations disponibles sur le projet.</p>
        <a class="tct-home-question-action" href="#questions" data-tct-route>
          <span>Poser une question</span><span class="tct-question-arrow" aria-hidden="true">→</span>
        </a>
      </section>` : '';

  return `
    <section id="home" class="tct-section tct-home is-active" aria-labelledby="tct-home-title">
      <div class="tct-home-landing">
        <div class="tct-home-landing-inner">
          <p class="tct-home-landing-title tct-reveal" data-tct-reveal>${renderLandingStatement(landingStatement)}</p>
        </div>
      </div>
      <div class="tct-home-stage">
        <div class="tct-home-stage-meta tct-reveal" data-tct-reveal>
          <span class="tct-live-dot" aria-hidden="true"></span>
          <span>En ce moment</span>
          ${phaseMeta ? `<span class="tct-home-phase">${esc(phaseMeta)}</span>` : ''}
        </div>
        <div class="tct-home-stage-grid">
          <h1 id="tct-home-title" class="tct-home-title tct-reveal" data-tct-reveal>${esc(headline)}</h1>
          ${presentText ? `
            <div class="tct-home-present tct-reveal" data-tct-reveal>
              <span>Situation actuelle</span>
              <p>${esc(presentText)}</p>
            </div>` : ''}
        </div>
        ${nextBlock}
      </div>
      ${featured}
      ${latestNews}
      ${questionsBlock}
    </section>`;
}
function projectInitials(name) {
  return String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('');
}

function renderProjectTrajectory(timeline) {
  if (!timeline) return '';

  const milestones = timeline.milestones || [];
  const progress = timeline.progress || {};
  const currentIndex = milestones.findIndex(m => m.status === 'current');
  const semanticProgress = Number.isFinite(Number(progress.percent))
    ? Math.max(0, Math.min(100, Number(progress.percent)))
    : (currentIndex >= 0 && milestones.length > 1
        ? Math.round((currentIndex / (milestones.length - 1)) * 100)
        : 0);
  const stepMeta = progress.currentStepLabel && progress.totalSteps
    ? `${progress.currentStepLabel} sur ${progress.totalSteps}`
    : (currentIndex >= 0 ? `Étape ${currentIndex + 1} sur ${milestones.length}` : '');
  const layout = milestones.length > 6 ? 'vertical' : 'horizontal';

  const statusLabel = status => status === 'done'
    ? 'Terminé'
    : (status === 'current' ? 'En ce moment' : 'À suivre');

  const items = milestones.map(m => `
    <li class="tct-project-milestone tct-status-${esc(m.status)}"${m.status === 'current' ? ' aria-current="step"' : ''}>
      <div class="tct-project-milestone-marker" aria-hidden="true"></div>
      <div class="tct-project-milestone-meta">
        <span class="tct-project-milestone-status">${statusLabel(m.status)}</span>
        <span class="tct-project-milestone-date">${esc(m.date)}</span>
      </div>
      <div class="tct-project-milestone-copy">
        <h3>${esc(m.label)}</h3>
        ${m.description ? `<p>${esc(m.description)}</p>` : ''}
      </div>
    </li>`).join('');

  return `
    <section class="tct-project-section tct-project-trajectory tct-reveal" data-tct-reveal aria-labelledby="tct-project-trajectory-title">
      <div class="tct-project-trajectory-head">
        <h2 id="tct-project-trajectory-title">Grandes étapes</h2>
        ${stepMeta ? `<span>${esc(stepMeta)}</span>` : ''}
      </div>
      ${milestones.length ? `
        <div class="tct-project-track is-${layout}" style="--tct-project-step-count:${Math.max(1, Math.min(milestones.length, 6))}" data-tct-trajectory data-tct-target-progress="${semanticProgress}">
          <div class="tct-project-track-line" aria-hidden="true"><i></i></div>
          <ol class="tct-project-milestones">${items}</ol>
        </div>` : '<p class="tct-empty">Aucune grande étape publiée pour le moment.</p>'}
    </section>`;
}

function renderProjectTeam(team) {
  if (!team || !(team.members || []).length) return '';
  const members = team.members || [];

  const people = members.map(member => {
    const initials = projectInitials(member.name);
    return `
      <li class="tct-project-person">
        ${member.photo && member.photo.url
          ? `<div class="tct-project-person-photo">${renderAsset(member.photo, 'tct-project-person-img')}</div>`
          : `<div class="tct-project-person-fallback" aria-hidden="true">${esc(initials)}</div>`}
        <div class="tct-project-person-copy">
          <strong>${esc(member.name)}</strong>
          ${member.title ? `<span>${esc(member.title)}</span>` : ''}
        </div>
      </li>`;
  }).join('');

  return `
    <section class="tct-project-section tct-project-team tct-reveal" data-tct-reveal>
      <div class="tct-project-team-heading">
        <span>Équipe projet</span>
        <h2>Ce projet est porté par une équipe.</h2>
      </div>
      <ul class="tct-project-team-grid">${people}</ul>
    </section>`;
}

function renderProjectSection(section, context = {}) {
  if (!section || !section.type) return '';
  const type = String(section.type);

  if (type === 'timeline') return renderProjectTrajectory(context.timeline);
  if (type === 'team') return renderProjectTeam(context.team);

  if (type === 'text') {
    return `
      <section class="tct-project-section tct-project-text tct-reveal" data-tct-reveal>
        <div class="tct-project-reading">
          ${section.title ? `<h2>${esc(section.title)}</h2>` : ''}
          ${section.body ? `<p>${inlineRichText(section.body)}</p>` : ''}
        </div>
      </section>`;
  }

  if (type === 'focus') {
    return `
      <section class="tct-project-section tct-project-focus tct-reveal" data-tct-reveal>
        <div class="tct-project-focus-inner">
          <span>Focus</span>
          <div>
            ${section.title ? `<h2>${esc(section.title)}</h2>` : ''}
            ${section.body ? `<p>${inlineRichText(section.body)}</p>` : ''}
          </div>
        </div>
      </section>`;
  }

  if (type === 'keyFigures' || type === 'key-figures') {
    const figures = (section.items || []).filter(item => item && (item.value || item.label));
    if (!figures.length) return '';
    const count = figures.length;
    return `
      <section class="tct-project-section tct-project-figures tct-reveal" data-tct-reveal>
        <div class="tct-project-figures-head">${esc(section.title || 'Quelques repères')}</div>
        <div class="tct-project-figures-grid ${count > 4 ? 'is-many' : ''}" style="--tct-figure-count:${Math.max(1, Math.min(count, 4))}">
          ${figures.map(item => `
            <div class="tct-project-figure">
              <strong>${esc(item.value)}</strong>
              ${item.label ? `<span>${esc(item.label)}</span>` : ''}
            </div>`).join('')}
        </div>
      </section>`;
  }

  if (type === 'quote') {
    if (!section.quote) return '';
    return `
      <section class="tct-project-section tct-project-quote tct-reveal" data-tct-reveal>
        <blockquote>« ${esc(section.quote)} »</blockquote>
        ${section.attribution ? `<cite>${esc(section.attribution)}</cite>` : ''}
      </section>`;
  }

  if (type === 'choices') {
    const choices = (section.items || []).filter(Boolean);
    if (!choices.length) return '';
    return `
      <section class="tct-project-section tct-project-choices tct-reveal" data-tct-reveal>
        <div class="tct-project-choices-head">${esc(section.title || 'Les grands choix du projet')}</div>
        <div class="tct-project-choices-grid">
          ${choices.map(item => `
            <article>
              ${item.title ? `<h3>${esc(item.title)}</h3>` : ''}
              ${item.body ? `<p>${esc(item.body)}</p>` : ''}
            </article>`).join('')}
        </div>
      </section>`;
  }

  if (type === 'image') {
    const asset = section.asset || section.image;
    if (!asset || !asset.url) return '';
    return `
      <figure class="tct-project-section tct-project-media tct-reveal" data-tct-reveal data-tct-drift>
        <div class="tct-project-media-frame">${renderAsset(asset, 'tct-project-media-img')}</div>
        ${(section.caption || asset.alt) ? `<figcaption>${esc(section.caption || asset.alt)}</figcaption>` : ''}
      </figure>`;
  }

  if (type === 'gallery') {
    const assets = (section.items || section.assets || []).filter(asset => asset && asset.url);
    if (!assets.length) return '';
    return `
      <section class="tct-project-section tct-project-gallery tct-reveal" data-tct-reveal data-count="${assets.length}">
        ${section.title ? `<div class="tct-project-gallery-head">${esc(section.title)}</div>` : ''}
        <div class="tct-project-gallery-grid">
          ${assets.map((asset, index) => `
            <figure class="tct-project-gallery-item ${index === 0 ? 'is-lead' : ''}" data-tct-drift>
              <div>${renderAsset(asset, 'tct-project-gallery-img')}</div>
              ${asset.alt ? `<figcaption>${esc(asset.alt)}</figcaption>` : ''}
            </figure>`).join('')}
        </div>
      </section>`;
  }

  return '';
}

function renderProject(project, context = {}) {
  const source = project && typeof project === 'object' ? project : {};
  const intro = source.intro && typeof source.intro === 'object' ? source.intro : {};
  const sections = Array.isArray(source.sections) ? source.sections : [];

  return `
    <section id="timeline" class="tct-section tct-project-page">
      <header class="tct-project-opening tct-reveal" data-tct-reveal>
        <div class="tct-project-opening-eyebrow">Le projet</div>
        <h1>${esc(intro.title || '')}</h1>
        <p>${inlineRichText(intro.body || intro.description || '')}</p>
      </header>

      <div class="tct-project-flow">
        ${sections.map(section => renderProjectSection(section, context)).join('')}
      </div>
    </section>`;
}

// ── Espaces Experience v2 : architecture editorial + detail + inspection ──
function spaceKey(item, index) {
  return String(item && item.id ? item.id : `space-${index + 1}`);
}

function spacePrimaryAsset(item) {
  return item && (item.hero || item.asset || item.image || item.media) || null;
}

function spaceMediaList(item) {
  if (!item) return [];
  if (Array.isArray(item.media)) return item.media.filter(asset => asset && asset.url);
  const primary = spacePrimaryAsset(item);
  return primary && primary.url ? [primary] : [];
}

function spaceSemanticText(item) {
  return [
    item && item.type,
    item && item.title,
    item && item.location,
    ...((item && item.tags) || []),
    ...((item && item.usageTags) || [])
  ].filter(Boolean).join(' ');
}

function isInspectableSpace(item, asset = spacePrimaryAsset(item)) {
  if (asset && ['view', 'plan', 'document'].includes(asset.kind)) return asset.kind === 'plan';
  if (asset && asset.url && isPdfUrl(asset.url)) return true;
  return /\b(plan|zoning|schema|schéma|implantation|plateau|niveau|rdc|étage|etage)\b/i.test(spaceSemanticText(item));
}

function isOverviewSpace(item) {
  return /\b(vue d['’ ]ensemble|ensemble|g[ée]n[ée]ral|zoning|macro[- ]?zoning|plan g[ée]n[ée]ral)\b/i.test(spaceSemanticText(item));
}

function spaceStatus(item) {
  return item && item.status ? String(item.status) : 'En cours de conception';
}

function spaceStatusBody(item) {
  return item && item.statusBody
    ? String(item.statusBody)
    : 'Cette projection présente l’orientation actuelle de l’espace et pourra encore évoluer.';
}

function spaceFallbackUsages(item) {
  if (Array.isArray(item && item.usages) && item.usages.length) return item.usages;
  const semantic = spaceSemanticText(item).toLowerCase();
  if (/caf[eé]|convivial|restauration|work\s*caf/.test(semantic)) {
    return ['Faire une pause', 'Échanger de façon informelle', 'Travailler ponctuellement autrement'];
  }
  if (/concentration|focus|calme|biblioth[eè]que|individuel/.test(semantic)) {
    return ['Se concentrer', 'S’isoler ponctuellement', 'Travailler au calme'];
  }
  if (/r[ée]union|projet|collab|atelier|salle/.test(semantic)) {
    return ['Se réunir', 'Construire à plusieurs', 'Faire avancer un travail collectif'];
  }
  return ['Changer de cadre', 'Choisir un environnement adapté', 'Faire évoluer sa façon d’occuper les espaces'];
}

function renderSpaceImageButton(asset, item, className, mode = 'view') {
  if (!asset || !asset.url) return '';
  const inspect = mode === 'inspect' || isInspectableSpace(item, asset);
  if (isPdfUrl(asset.url)) {
    return `
      <button type="button" class="${className} tct-space-document-trigger"
        data-tct-inspect-src="${esc(asset.url)}"
        data-tct-inspect-title="${esc(item.title || asset.alt || 'Plan')}"
        data-tct-inspect-kind="pdf">
        <span class="tct-space-document-mark">PDF</span>
        <span class="tct-space-document-copy">
          <strong>${esc(asset.label || item.title || (asset.kind === 'plan' ? 'Plan du projet' : 'Document du projet'))}</strong>
          <em>${asset.kind === 'plan' ? 'Explorer le plan' : 'Consulter le document'}</em>
        </span>
      </button>`;
  }

  return `
    <button type="button" class="${className} tct-space-image-trigger"
      ${inspect
        ? `data-tct-inspect-src="${esc(asset.url)}" data-tct-inspect-title="${esc(item.title || asset.alt || 'Plan')}" data-tct-inspect-kind="image"`
        : `data-tct-view-src="${esc(asset.url)}" data-tct-view-title="${esc(item.title || asset.alt || 'Vue de l’espace')}"`}>
      <img src="${esc(asset.url)}" alt="${esc(asset.alt || item.title || '')}" loading="lazy">
      <span class="tct-space-image-action">${inspect ? 'Explorer le plan' : 'Voir en grand'}</span>
    </button>`;
}

function renderSpaceIndexItem(item, originalIndex, sequenceIndex) {
  const key = spaceKey(item, originalIndex);
  const asset = spacePrimaryAsset(item);
  const inspectable = isInspectableSpace(item, asset);
  const tags = (Array.isArray(item.usageTags) ? item.usageTags : []).filter(Boolean);
  const variant = inspectable
    ? 'document'
    : (sequenceIndex % 3 === 0 ? 'media-left' : (sequenceIndex % 3 === 1 ? 'media-right' : 'wide'));

  return `
    <article class="tct-space-story is-${variant} tct-reveal"
      data-tct-reveal
      data-space-tags="${esc(JSON.stringify(tags))}">
      <div class="tct-space-story-media ${asset && !isPdfUrl(asset.url) ? 'has-image' : ''}" ${asset && !inspectable && !isPdfUrl(asset.url) ? 'data-tct-drift' : ''}>
        ${asset
          ? renderSpaceImageButton(asset, item, 'tct-space-story-media-button', inspectable ? 'inspect' : 'view')
          : `<div class="tct-space-empty-media"><span>${esc(item.type || 'Espace')}</span></div>`}
      </div>
      <div class="tct-space-story-copy">
        <span>${esc(item.location || item.type || (inspectable ? 'Plan' : 'Espace'))}</span>
        <h2><a href="#space-${encodeURIComponent(key)}" data-tct-route>${esc(item.title || 'Un espace du projet')}</a></h2>
        ${item.comment ? `<p>${inlineRichText(item.comment)}</p>` : ''}
        <a class="tct-text-link" href="#space-${encodeURIComponent(key)}" data-tct-route>Découvrir cet espace <span aria-hidden="true">→</span></a>
      </div>
    </article>`;
}

function renderSpaceDetail(item, items, index) {
  const key = spaceKey(item, index);
  const media = spaceMediaList(item);
  const primary = media[0] || null;
  const inspectable = isInspectableSpace(item, primary);
  const usages = spaceFallbackUsages(item);
  const related = [];
  for (let offset = 1; offset < items.length && related.length < 2; offset++) {
    const candidateIndex = (index + offset) % items.length;
    if (candidateIndex !== index) related.push({ item: items[candidateIndex], index: candidateIndex });
  }

  const gallery = media.slice(1).map((asset, mediaIndex) => {
    const assetInspectable = isInspectableSpace(item, asset);
    return `
      <figure class="tct-space-detail-secondary tct-reveal" data-tct-reveal ${!assetInspectable && !isPdfUrl(asset.url) ? 'data-tct-drift' : ''}>
        ${renderSpaceImageButton(asset, item, 'tct-space-detail-secondary-button', assetInspectable ? 'inspect' : 'view')}
        ${asset.alt ? `<figcaption>${esc(asset.alt)}</figcaption>` : ''}
      </figure>`;
  }).join('');

  return `
    <article class="tct-space-detail-panel" data-space-detail-id="${esc(key)}" hidden>
      <a class="tct-space-back" href="#spaces" data-tct-route><span aria-hidden="true">←</span> Tous les espaces</a>

      <header class="tct-space-detail-opening tct-reveal" data-tct-reveal>
        <div class="tct-space-detail-eyebrow">${esc(item.location ? `Espace · ${item.location}` : (item.type || 'Espace'))}</div>
        <h1>${esc(item.title || 'Un espace du projet')}</h1>
        <p>${inlineRichText(item.comment || 'Découvrez l’orientation actuellement imaginée pour cet espace et la manière dont elle accompagne les usages de la journée.')}</p>
      </header>

      ${primary ? `
        <div class="tct-space-detail-hero tct-reveal ${inspectable ? 'is-inspectable' : ''}" data-tct-reveal ${!inspectable && !isPdfUrl(primary.url) ? 'data-tct-drift' : ''}>
          ${renderSpaceImageButton(primary, item, 'tct-space-detail-hero-button', inspectable ? 'inspect' : 'view')}
        </div>` : ''}

      <section class="tct-space-status tct-reveal" data-tct-reveal>
        <div class="tct-space-status-signal" aria-hidden="true"></div>
        <div>
          <strong>${esc(spaceStatus(item))}</strong>
          <p>${esc(spaceStatusBody(item))}</p>
        </div>
        ${primary && inspectable
          ? `<button type="button" class="tct-space-inspect-link"
              data-tct-inspect-src="${esc(primary.url)}"
              data-tct-inspect-title="${esc(item.title || primary.alt || 'Plan')}"
              data-tct-inspect-kind="${isPdfUrl(primary.url) ? 'pdf' : 'image'}">
              ${primary.kind === 'plan' ? 'Explorer le plan' : 'Consulter le document'} <span aria-hidden="true">↗</span>
            </button>`
          : ''}
      </section>

      <section class="tct-space-usages tct-reveal" data-tct-reveal>
        <div class="tct-space-usages-head">
          <span>Usages</span>
          <h2>Ce que cet espace permet.</h2>
        </div>
        <ol class="tct-space-usages-list">
          ${usages.map((usage, usageIndex) => `
            <li>
              <span>${String(usageIndex + 1).padStart(2, '0')}</span>
              <strong>${esc(typeof usage === 'string' ? usage : (usage.title || usage.label || 'Usage'))}</strong>
              ${typeof usage === 'object' && usage.body ? `<p>${esc(usage.body)}</p>` : ''}
            </li>`).join('')}
        </ol>
      </section>

      ${gallery ? `<section class="tct-space-detail-gallery">${gallery}</section>` : ''}

      ${related.length ? `
        <footer class="tct-space-related tct-reveal" data-tct-reveal>
          <div>
            <span>Continuer à explorer</span>
            <h2>Découvrir un autre espace.</h2>
          </div>
          <div class="tct-space-related-links">
            ${related.map(({ item: rel, index: relIndex }) => `
              <a href="#space-${encodeURIComponent(spaceKey(rel, relIndex))}" data-tct-route>
                <span>${esc(rel.type || 'Espace')}</span>
                <strong>${esc(rel.title || 'Autre espace')}</strong>
                <em aria-hidden="true">→</em>
              </a>`).join('')}
          </div>
        </footer>` : ''}
    </article>`;
}

function renderSpaces(spaces) {
  if (!spaces) return '';
  const items = spaces.items || [];
  const intro = spaces.intro || {};
  const rawTitle = String(intro.title || '').trim();
  const openingTitle = !rawTitle || /^(Se projeter avant d[’']y être|Plans\s*&\s*3D)\.?$/i.test(rawTitle)
    ? 'Les espaces prennent forme.'
    : rawTitle;
  const openingDescription = intro.description
    || 'Découvrez les environnements imaginés pour les différents usages de la journée.';

  const overviewIndex = Math.max(0, items.findIndex(isOverviewSpace));
  const leadIndex = items.length ? (overviewIndex >= 0 ? overviewIndex : 0) : -1;
  const lead = leadIndex >= 0 ? items[leadIndex] : null;
  const rest = items
    .map((item, index) => ({ item, index }))
    .filter(entry => entry.index !== leadIndex);

  // Filters are intentionally dormant until Studio / Compiler publish a
  // human-centred usage taxonomy. Legacy technical tags (Plan, 3D, floor,
  // file type, etc.) must never become the user's mental model.
  const usageTagSet = new Set();
  items.forEach(item => {
    (Array.isArray(item.usageTags) ? item.usageTags : []).forEach(tag => usageTagSet.add(tag));
  });
  const filterTags = [...usageTagSet].filter(Boolean);

  // Product rule: Storm asks people to organise information only once the
  // collection is complex enough to make the absence of filtering painful.
  const showFilters = items.length >= 10 && filterTags.length > 1;

  const leadHtml = lead ? (() => {
    const asset = spacePrimaryAsset(lead);
    const inspectable = isInspectableSpace(lead, asset);
    const key = spaceKey(lead, leadIndex);
    return `
      <article class="tct-spaces-lead tct-reveal" data-tct-reveal>
        <div class="tct-spaces-lead-media ${asset && !isPdfUrl(asset.url) ? 'has-image' : ''}" ${asset && !inspectable && !isPdfUrl(asset.url) ? 'data-tct-drift' : ''}>
          ${asset
            ? renderSpaceImageButton(asset, lead, 'tct-spaces-lead-media-button', inspectable ? 'inspect' : 'view')
            : `<div class="tct-space-empty-media"><span>${esc(lead.type || 'Espace')}</span></div>`}
        </div>
        <div class="tct-spaces-lead-copy">
          <span>${isOverviewSpace(lead) ? 'Vue d’ensemble' : esc(lead.type || 'À découvrir')}</span>
          <h2>${esc(lead.title || 'Se projeter dans les futurs espaces.')}</h2>
          ${lead.comment ? `<p>${inlineRichText(lead.comment)}</p>` : ''}
          <a class="tct-text-link" href="#space-${encodeURIComponent(key)}" data-tct-route>
            ${inspectable ? 'Comprendre ce plan' : 'Découvrir cet espace'} <span aria-hidden="true">→</span>
          </a>
        </div>
      </article>`;
  })() : '';

  const filters = showFilters ? `
    <div class="tct-space-filters tct-reveal" data-tct-reveal aria-label="Filtrer les espaces">
      <button type="button" class="is-active" data-space-filter="all">Tout voir</button>
      ${filterTags.map(tag => `<button type="button" data-space-filter="${esc(tag)}">${esc(tag)}</button>`).join('')}
    </div>` : '';

  return `
    <section id="spaces" class="tct-section tct-spaces-page">
      <div class="tct-spaces-index" data-tct-spaces-index>
        <header class="tct-spaces-opening tct-reveal" data-tct-reveal>
          <div class="tct-spaces-opening-eyebrow">Espaces</div>
          <h1>${esc(openingTitle)}</h1>
          <p>${inlineRichText(openingDescription)}</p>
        </header>

        ${items.length ? leadHtml : '<p class="tct-empty">Aucun espace publié pour le moment.</p>'}
        ${filters}

        ${rest.length ? `
          <section class="tct-spaces-sequence" data-tct-spaces-sequence>
            ${rest.map(({ item, index }, sequenceIndex) => renderSpaceIndexItem(item, index, sequenceIndex)).join('')}
          </section>` : ''}
      </div>

      <div class="tct-space-detail-shell" data-tct-space-detail-view hidden>
        ${items.map((item, index) => renderSpaceDetail(item, items, index)).join('')}
      </div>
    </section>`;
}

// ── Actualités Experience v2 : chronologie éditoriale + page article ──
function renderNewsArticle(item, allItems, index) {
  const meta = newsMeta(item);
  const asset = newsAsset(item);
  const older = allItems[index + 1] || null;

  return `
    <article class="tct-news-article-view-panel" data-news-article-id="${esc(item.id)}" hidden>
      <a class="tct-news-back" href="#news" data-tct-route><span aria-hidden="true">←</span> Toutes les actualités</a>

      <header class="tct-news-article-opening tct-reveal" data-tct-reveal>
        <div class="tct-news-article-meta">
          ${item.tag ? `<span>${esc(item.tag)}</span>` : ''}
          ${meta.date ? `<time>${esc(meta.date)}</time>` : ''}
          ${meta.extra ? `<em>${esc(meta.extra)}</em>` : ''}
        </div>
        <h1>${esc(item.title)}</h1>
        ${item.summary ? `<p>${inlineRichText(item.summary)}</p>` : ''}
      </header>

      ${asset && asset.url ? `
        <figure class="tct-news-article-media tct-reveal" data-tct-reveal data-tct-drift>
          <div>${renderAsset(asset, 'tct-news-article-img')}</div>
          ${asset.alt ? `<figcaption>${esc(asset.alt)}</figcaption>` : ''}
        </figure>` : ''}

      <div class="tct-news-article-body tct-reveal" data-tct-reveal>
        <aside class="tct-news-article-date" aria-hidden="true">
          <span>${esc(meta.date)}</span>
        </aside>
        <div class="tct-news-article-reading">
          ${renderNewsBlocks(item.blocks, item.body)}
        </div>
      </div>

      <footer class="tct-news-article-exit tct-reveal" data-tct-reveal>
        <div>
          <span>Continuer à suivre le projet</span>
          <h2>Retrouvez le fil des dernières nouvelles.</h2>
        </div>
        <div class="tct-news-article-exit-links">
          <a class="tct-text-link" href="#news" data-tct-route>Voir toutes les actualités <span aria-hidden="true">→</span></a>
          ${older ? `<a class="tct-text-link tct-news-next-story" href="#news-${encodeURIComponent(String(older.id))}" data-tct-route>Lire aussi : ${esc(older.title)} <span aria-hidden="true">→</span></a>` : ''}
        </div>
      </footer>
    </article>`;
}

function renderNews(news) {
  if (!news) return '';
  const items = news.items || [];
  const intro = news.intro || {};
  const rawOpeningTitle = String(intro.title || '').trim();
  const openingTitle = !rawOpeningTitle || /^Le fil du projet\.?$/i.test(rawOpeningTitle)
    ? 'Le projet avance.'
    : rawOpeningTitle;
  const lead = items[0] || null;
  const previous = items.slice(1);

  const leadHtml = lead ? (() => {
    const meta = newsMeta(lead);
    const asset = newsAsset(lead);
    return `
      <article class="tct-news-lead tct-reveal" data-tct-reveal>
        <div class="tct-news-lead-date">
          <span>Dernière actualité</span>
          <time>${esc(meta.date)}</time>
          ${meta.extra ? `<em>${esc(meta.extra)}</em>` : ''}
        </div>
        <div class="tct-news-lead-copy">
          ${lead.tag ? `<div class="tct-news-tag">${esc(lead.tag)}</div>` : ''}
          <h2>${esc(lead.title)}</h2>
          ${lead.summary ? `<p>${inlineRichText(lead.summary)}</p>` : ''}
          <a class="tct-text-link" href="#news-${encodeURIComponent(String(lead.id))}" data-tct-route>Lire l’actualité <span aria-hidden="true">→</span></a>
        </div>
        ${asset && asset.url ? `
          <div class="tct-news-lead-media" data-tct-drift>
            ${renderAsset(asset, 'tct-news-lead-img')}
          </div>` : ''}
      </article>`;
  })() : '';

  const archive = previous.map((item, index) => {
    const meta = newsMeta(item);
    const compact = index >= 2;
    return `
      <article class="tct-news-row ${compact ? 'is-compact' : ''} tct-reveal" data-tct-reveal>
        <div class="tct-news-row-date">
          <time>${esc(meta.date)}</time>
          ${meta.extra ? `<em>${esc(meta.extra)}</em>` : ''}
        </div>
        <div class="tct-news-row-copy">
          ${item.tag ? `<span>${esc(item.tag)}</span>` : ''}
          <h3><a href="#news-${encodeURIComponent(String(item.id))}" data-tct-route>${esc(item.title)}</a></h3>
          ${!compact && item.summary ? `<p>${inlineRichText(item.summary)}</p>` : ''}
          ${!compact ? `<a class="tct-news-row-action" href="#news-${encodeURIComponent(String(item.id))}" data-tct-route>Lire <span aria-hidden="true">→</span></a>` : ''}
        </div>
      </article>`;
  }).join('');

  const articlePanels = items.map((item, index) => renderNewsArticle(item, items, index)).join('');

  return `
    <section id="news" class="tct-section tct-news-page">
      <div class="tct-news-index" data-tct-news-index>
        <header class="tct-news-opening tct-reveal" data-tct-reveal>
          <div class="tct-news-opening-eyebrow">Actualités</div>
          <h1>${esc(openingTitle)}</h1>
          <p>${esc(intro.description || 'Les dernières nouvelles, décisions et temps forts du projet.')}</p>
        </header>

        ${items.length ? leadHtml : '<p class="tct-empty">Aucune actualité publiée pour le moment.</p>'}

        ${previous.length ? `
          <section class="tct-news-archive" aria-labelledby="tct-news-archive-title">
            <div class="tct-news-archive-head" id="tct-news-archive-title">Le fil précédent</div>
            <div class="tct-news-archive-list">${archive}</div>
          </section>` : ''}
      </div>

      <div class="tct-news-article-shell" data-tct-news-article-view hidden>
        ${articlePanels}
      </div>
    </section>`;
}

// ── Questions Experience v2 : moteur Pangea conservé + couche Ivory ──
function fallbackFaqItems() {
  // POC fallback only: adapted from Pangea's historical built-in FAQ.
  // It disappears automatically as soon as the public Manifest contains
  // real published FAQ entries.
  return [
    {
      id:'date-demenagement', category:'calendrier', title:'Quand aura lieu le déménagement ?',
      status:'confirmed', statusLabel:'Réponse confirmée',
      answer:"Le déménagement est actuellement prévu la semaine du 14 octobre.\n\nLa date précise de bascule par équipe sera confirmée dès que le planning logistique sera totalement sécurisé.",
      note:"Nous préférons partager une date confirmée plutôt qu’un calendrier prématuré qui devrait ensuite être corrigé.",
      keywords:['date','quand','demenagement','demenager','transfert','installation','semaine','arrivee','jour j','calendrier','planning'],
      phrases:['quand aura lieu le demenagement','quelle est la date du demenagement'],
      intentSignals:['date','demenagement','quand'], emotionSignals:[], negativeSignals:[], priority:8
    },
    {
      id:'flex-office', category:'espaces', title:'Est-ce que nous aurons un poste attribué ?',
      status:'partial', statusLabel:'Réponse partielle',
      answer:"Les principes d’occupation des espaces seront précisés en fonction de l’organisation retenue sur le nouveau site.\n\nLe flex office intégral n’est pas le modèle retenu par défaut. Le sujet sera co-construit dans les ateliers.",
      note:"Une communication spécifique expliquera les règles de fonctionnement des espaces de travail.",
      keywords:['flex office','flexoffice','poste','bureau','place','attribution','desk','placement','poste attribue','mon bureau'],
      phrases:['est ce que j aurai un bureau','aurons nous un poste attribue','est ce du flex office'],
      intentSignals:['poste','bureau','attribue','flex'], emotionSignals:[], negativeSignals:[], priority:7
    },
    {
      id:'concentration', category:'espaces', title:'Y aura-t-il des espaces pour travailler au calme ?',
      status:'confirmed', statusLabel:'Réponse confirmée',
      answer:"Oui. Le nouveau site intègre des espaces dédiés à la concentration individuelle : bulles de travail, zones silencieuses et cabines phoniques.",
      note:"L’objectif est de pouvoir choisir un environnement adapté quand une tâche demande davantage de calme.",
      keywords:['concentration','calme','bruit','silence','open space','cabine','bulle','focus','isolement','travailler sereinement','phonique'],
      phrases:['ou travailler au calme','y aura t il des espaces calmes','comment se concentrer'],
      intentSignals:['calme','concentration','bruit'], emotionSignals:['stress'], negativeSignals:[], priority:7
    },
    {
      id:'restauration', category:'services', title:'Comment fonctionnera la restauration ?',
      status:'waiting', statusLabel:'En attente de décision',
      answer:"Les modalités exactes de restauration ne sont pas encore arrêtées à ce stade.\n\nPlusieurs options sont actuellement à l’étude. Une information plus précise sera publiée une fois les arbitrages rendus.",
      note:"Le déjeuner est aussi un moment important dans la journée de travail ; le sujet est donc traité comme un véritable usage.",
      keywords:['restauration','manger','repas','dejeuner','cantine','food','restaurant','pause dejeuner','titres restaurant','ticket restaurant','lunch'],
      phrases:['comment va fonctionner la restauration','y aura t il une cantine','ou est ce qu on mange'],
      intentSignals:['restauration','dejeuner','manger'], emotionSignals:[], negativeSignals:[], priority:6
    },
    {
      id:'casier', category:'espaces', title:'Est-ce que chacun aura un casier ?',
      status:'partial', statusLabel:'Réponse partielle',
      answer:"Des solutions de rangement personnel sont prévues dans le cadre du projet.\n\nL’idée est que chacun puisse disposer d’un espace personnel même dans un environnement partagé. Les modalités précises seront communiquées avant l’installation.",
      note:"",
      keywords:['casier','casiers','rangement','locker','affaires personnelles','stockage','placard','espace personnel'],
      phrases:['aurai je un casier','y aura t il des casiers','ou ranger mes affaires'],
      intentSignals:['casier','rangement'], emotionSignals:[], negativeSignals:[], priority:5
    },
    {
      id:'teletravail', category:'rh', title:'Est-ce que les règles de télétravail vont changer ?',
      status:'confirmed', statusLabel:'Réponse confirmée',
      answer:"Le déménagement n’entraîne pas de remise en cause des accords de télétravail en vigueur.\n\nLes règles applicables restent celles définies dans votre accord ou votre charte d’équipe.",
      note:"",
      keywords:['teletravail','remote','travail distance','jours sur site','hybride','presentiel','jours bureau','travail maison','home office'],
      phrases:['est ce que le teletravail change','combien de jours de teletravail'],
      intentSignals:['teletravail','hybride'], emotionSignals:[], negativeSignals:[], priority:5
    },
    {
      id:'ambassadeurs', category:'ambassadeurs', title:'À quoi servent les ambassadeurs ?',
      status:'confirmed', statusLabel:'Réponse confirmée',
      answer:"Les ambassadeurs sont des collègues volontaires qui relaient les informations, recueillent les questions et font remonter les besoins des équipes.\n\nIls constituent un point de contact de proximité tout au long du projet.",
      note:"",
      keywords:['ambassadeur','ambassadeurs','relais','referent','volontaire','correspondant'],
      phrases:['a quoi servent les ambassadeurs','qui sont les ambassadeurs'],
      intentSignals:['ambassadeurs','relais'], emotionSignals:[], negativeSignals:[], priority:5
    },
    {
      id:'visites', category:'decouverte', title:'Pourra-t-on visiter le futur site avant le déménagement ?',
      status:'confirmed', statusLabel:'Réponse confirmée',
      answer:"Des temps de découverte du site sont prévus avant l’installation afin de permettre aux équipes de mieux se repérer et de se projeter.\n\nLes modalités pratiques seront communiquées à mesure que les créneaux seront stabilisés.",
      note:"",
      keywords:['visite','visites','voir','decouverte','venir voir','visiter','decouvrir le site','avant d arriver'],
      phrases:['peut on visiter le site','quand peut on voir les nouveaux bureaux'],
      intentSignals:['visite','site','decouverte'], emotionSignals:[], negativeSignals:[], priority:4
    }
  ];
}

// Storm Match — repli générique cantonné à un mode démo/dev explicite.
// Jamais activé par défaut : en fonctionnement normal, aucune
// connaissance projet publiée = Storm Match s'abstient proprement
// (voir showUnknown() dans wireInteractions, déjà existant, déjà
// product-compatible — pas besoin d'un nouvel état).
// Le droit d'utiliser le repli est transmis explicitement par chaque
// appelant (manifest.meta.demoMode), jamais lu depuis un état global —
// une fonction de rendu ne doit pas dépendre silencieusement du
// dernier render() exécuté ailleurs dans le runtime.
function faqItemsForQuestions(questions, allowDemoFallback) {
  const published = Array.isArray(questions && questions.items) ? questions.items : [];
  if (published.length) return published;
  return allowDemoFallback ? fallbackFaqItems() : [];
}

function faqStatusLabel(entry) {
  if (!entry) return '';
  if (entry.status === 'waiting') return 'En cours de définition';
  if (entry.status === 'partial') return 'Susceptible d’évoluer';
  if (entry.status === 'confirmed') return 'Information confirmée';
  return entry.statusLabel || '';
}

function faqAnswerToHtml(answer) {
  return String(answer || '')
    .split(/\n\s*\n/)
    .map(block => block.trim())
    .filter(Boolean)
    .map(block => `<p>${inlineRichText(block)}</p>`)
    .join('');
}

function questionRelatedLink(entry) {
  const category = String(entry && entry.category || '').toLowerCase();
  if (category === 'espaces' || category === 'decouverte') {
    return { href:'#spaces', label:'Explorer les espaces' };
  }
  if (category === 'calendrier') {
    return { href:'#timeline', label:'Voir les grandes étapes' };
  }
  if (category === 'ambassadeurs') {
    return { href:'#ambassadors', label:'Trouver un ambassadeur' };
  }
  if (category === 'communication') {
    return { href:'#news', label:'Voir les actualités' };
  }
  return null;
}

function renderQuestions(questions, allowDemoFallback) {
  if (!questions) return '';
  const intro = questions.intro || {};
  const items = faqItemsForQuestions(questions, allowDemoFallback);
  const rawTitle = String(intro.title || '').trim();
  const openingTitle = !rawTitle || /^Une réponse,?\s*chaque fois\.?$/i.test(rawTitle)
    ? 'Une question sur le projet ?'
    : rawTitle;

  const rawDescription = String(intro.description || '').trim();
  const openingDescription = !rawDescription || /Posez votre question librement/i.test(rawDescription)
    ? 'Posez-la comme elle vous vient. Vous verrez ce qui est déjà confirmé — et ce qui reste encore à préciser.'
    : rawDescription;

  const featured = items.slice(0, 4);

  return `
    <section id="questions" class="tct-section tct-questions-page">
      <header class="tct-questions-opening tct-reveal" data-tct-reveal>
        <div class="tct-questions-opening-eyebrow">Questions</div>
        <h1>${esc(openingTitle)}</h1>
        <p>${esc(openingDescription)}</p>
      </header>

      <section class="tct-question-workbench tct-reveal" data-tct-reveal aria-labelledby="tct-question-label">
        <label id="tct-question-label" for="tct-question-input">Votre question</label>
        <div class="tct-question-input-line">
          <input
            type="text"
            id="tct-question-input"
            autocomplete="off"
            spellcheck="true"
            placeholder="Écrivez votre question…"
            aria-describedby="tct-question-examples">
          <button type="button" id="tct-ask-btn" aria-label="Rechercher une réponse">
            <span aria-hidden="true">→</span>
          </button>
        </div>
        <p id="tct-question-examples" class="tct-question-examples">
          Essayez par exemple : <button type="button" data-tct-question-example="Quand aura lieu le déménagement ?">Quand déménageons-nous ?</button>
          <span>·</span>
          <button type="button" data-tct-question-example="Y aura-t-il des espaces pour travailler au calme ?">Où pourrai-je travailler au calme ?</button>
          <span>·</span>
          <button type="button" data-tct-question-example="Est-ce que chacun aura un casier ?">Est-ce qu’il y aura des casiers ?</button>
        </p>
      </section>

      <div id="tct-question-result" class="tct-question-result" aria-live="polite" hidden></div>

      <section id="tct-question-contact" class="tct-question-contact" hidden aria-labelledby="tct-question-contact-title">
        <div class="tct-question-contact-intro">
          <span>Faire remonter la question</span>
          <h2 id="tct-question-contact-title">L’équipe projet peut vous répondre.</h2>
          <p>Votre question sera transmise telle quelle. Elle pourra aussi aider à enrichir les réponses disponibles ici.</p>
        </div>
        <form id="tct-contact-form" class="tct-question-contact-form">
          <label>Votre nom<input type="text" name="name" autocomplete="name" required></label>
          <label>Votre email<input type="email" name="email" autocomplete="email" required></label>
          <label class="is-wide">Votre question<textarea name="message" rows="4" required></textarea></label>
          <button type="submit">Transmettre la question <span aria-hidden="true">→</span></button>
        </form>
        <p id="tct-contact-status" class="tct-question-contact-status" hidden></p>
      </section>

      ${featured.length ? `
        <section class="tct-featured-questions tct-reveal" data-tct-reveal aria-labelledby="tct-featured-questions-title">
          <div class="tct-featured-questions-heading">
            <span>Questions fréquentes</span>
            <h2 id="tct-featured-questions-title">Ce que les équipes cherchent souvent à savoir.</h2>
          </div>
          <ol>
            ${featured.map((item, index) => `
              <li>
                <button type="button" data-tct-featured-question="${esc(item.id)}">
                  <span>${String(index + 1).padStart(2, '0')}</span>
                  <strong>${esc(item.title)}</strong>
                  <em aria-hidden="true">→</em>
                </button>
              </li>`).join('')}
          </ol>
        </section>` : ''}
    </section>`;
}

function ambassadorInitials(name) {
  return String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('');
}

function ambassadorBodyToHtml(value) {
  return String(value || '')
    .split(/\n\s*\n/)
    .map(block => block.trim())
    .filter(Boolean)
    .map(block => `<p>${inlineRichText(block)}</p>`)
    .join('');
}

function ambassadorSearchText(person) {
  return [person && person.name, person && person.role, person && person.tag]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function ambassadorJoinBody(value) {
  const body = String(value || '').trim();
  if (!body) return '';

  // Legacy Studio copy may send people to "the FAQ form", which creates an
  // unnecessary detour because that form is contextual. Ivory removes only
  // that obsolete routing instruction; the rest of the authored copy remains.
  return body
    .replace(/\s*(?:ou\s+)?contactez\s+directement\s+l['’]équipe\s+projet\s+via\s+le\s+formulaire\s+de\s+la\s+FAQ\.?/i,
      ' Vous pouvez aussi manifester directement votre intérêt ci-dessous.')
    .replace(/\s+/g, ' ')
    .trim();
}

function ambassadorContactConfig(person, communityContact) {
  if (!communityContact || communityContact.enabled !== true) return null;
  if (person && person.contactable === false) return null;

  // The future Compiler should resolve channels (email / Teams / shared
  // project channel) into a safe public href. Ivory never invents one.
  const href = person && person.contactHref
    ? String(person.contactHref)
    : (communityContact.defaultHref ? String(communityContact.defaultHref) : '');

  if (!href) return null;

  return {
    href,
    label: String((person && person.contactLabel) || communityContact.label || 'Contacter')
  };
}

function renderAmbassadorPerson(person, index, communityContact) {
  const initials = ambassadorInitials(person.name);
  const contact = ambassadorContactConfig(person, communityContact);

  return `
    <li class="tct-ambassador-person" data-tct-ambassador-person data-ambassador-search="${esc(ambassadorSearchText(person))}">
      <div class="tct-ambassador-person-visual">
        ${person.photo && person.photo.url
          ? renderAsset(person.photo, 'tct-ambassador-person-photo')
          : `<div class="tct-ambassador-person-monogram" aria-hidden="true">${esc(initials)}</div>`}
      </div>
      <div class="tct-ambassador-person-copy">
        <span>${String(index + 1).padStart(2, '0')}</span>
        <div>
          <strong>${esc(person.name)}</strong>
          ${person.role ? `<p>${esc(person.role)}</p>` : ''}
          ${person.tag ? `<em>${esc(person.tag)}</em>` : ''}
          ${contact ? `
            <a class="tct-ambassador-contact" href="${esc(contact.href)}">
              ${esc(contact.label)} <span aria-hidden="true">→</span>
            </a>` : ''}
        </div>
      </div>
    </li>`;
}

function renderAmbassadors(ambassadors) {
  if (!ambassadors) return '';
  const roster = ambassadors.roster || [];
  const intro = ambassadors.intro || {};

  // Future public semantic contract. Both capabilities remain invisible
  // unless explicitly enabled by published data.
  const communityContact = ambassadors.contact || {};
  const legacyCta = ambassadors.cta || {};
  const join = ambassadors.join || (
    (legacyCta.title || legacyCta.body)
      ? {
          enabled: legacyCta.enabled !== false,
          title: legacyCta.title,
          body: legacyCta.body,
          href: legacyCta.href,
          label: legacyCta.label
        }
      : {}
  );

  const isLargeRoster = roster.length >= 24;
  const rosterQualifier = intro.rosterLabel ? String(intro.rosterLabel) : '';
  const openingDescription = roster.length
    ? 'Des collègues engagés dans le projet pour faire circuler les informations, les questions et les besoins au plus près des équipes.'
    : 'Le réseau des ambassadeurs apparaîtra ici à mesure qu’il se constitue.';

  return `
    <section id="ambassadors" class="tct-section tct-ambassadors-page">
      <header class="tct-ambassadors-opening tct-reveal" data-tct-reveal>
        <div class="tct-ambassadors-opening-eyebrow">Ambassadeurs</div>
        <h1>Des relais au plus près du terrain.</h1>
        <p>${esc(openingDescription)}</p>
      </header>

      ${intro.title || intro.body ? `
        <section class="tct-ambassadors-role tct-reveal" data-tct-reveal>
          <div class="tct-ambassadors-role-kicker">Leur rôle</div>
          <div class="tct-ambassadors-role-content">
            ${intro.title ? `<h2>${esc(intro.title)}</h2>` : ''}
            ${intro.body ? `<div class="tct-ambassadors-role-body">${ambassadorBodyToHtml(intro.body)}</div>` : ''}
          </div>
        </section>` : ''}

      <section class="tct-ambassadors-roster tct-reveal" data-tct-reveal aria-labelledby="tct-ambassadors-roster-title">
        <div class="tct-ambassadors-roster-head">
          <div class="tct-ambassadors-count">
            <strong>${roster.length}</strong>
            <span id="tct-ambassadors-roster-title">ambassadeur${roster.length > 1 ? 's' : ''}${rosterQualifier ? ` — ${esc(rosterQualifier)}` : ''}</span>
          </div>

          ${isLargeRoster ? `
            <label class="tct-ambassadors-search">
              <span>Rechercher dans la communauté</span>
              <input type="search" placeholder="Nom, équipe ou direction…" autocomplete="off" data-tct-ambassador-search-input>
            </label>` : ''}
        </div>

        ${roster.length ? `
          <ul class="tct-ambassadors-list" data-tct-ambassadors-list>
            ${roster.map((person, index) => renderAmbassadorPerson(person, index, communityContact)).join('')}
          </ul>
          <p class="tct-ambassadors-no-result" data-tct-ambassador-no-result hidden>
            Aucun ambassadeur ne correspond à cette recherche.
          </p>` : `
          <p class="tct-empty">Aucun ambassadeur publié pour le moment.</p>`}
      </section>

      ${join.enabled === true && (join.title || join.body) ? `
        <section class="tct-ambassadors-cta tct-reveal" data-tct-reveal>
          <div>
            <span>Participer</span>
            ${join.title ? `<h2>${esc(join.title)}</h2>` : ''}
          </div>
          <div>
            ${join.body ? `<p>${inlineRichText(ambassadorJoinBody(join.body))}</p>` : ''}
            ${join.mode === 'link' && join.href ? `
              <a class="tct-text-link" href="${esc(join.href)}" ${String(join.href).startsWith('#') ? 'data-tct-route' : ''}>
                ${esc(join.label || 'Devenir ambassadeur')} <span aria-hidden="true">→</span>
              </a>` : `
              <button type="button" class="tct-ambassador-join-trigger" data-tct-open-ambassador-join>
                ${esc(join.label || 'Devenir ambassadeur')} <span aria-hidden="true">→</span>
              </button>`}
          </div>

          ${join.mode === 'link' ? '' : `
            <div class="tct-ambassador-join-panel" data-tct-ambassador-join-panel hidden>
              <div class="tct-ambassador-join-panel-heading">
                <span>Votre intérêt</span>
                <h3>Faites simplement signe à l’équipe projet.</h3>
              </div>
              <form class="tct-ambassador-join-form" data-tct-ambassador-join-form>
                <label>
                  Votre nom
                  <input type="text" name="name" autocomplete="name" required>
                </label>
                <label>
                  Votre email
                  <input type="email" name="email" autocomplete="email" required>
                </label>
                <label class="is-wide">
                  Un mot à l’équipe projet <span>(facultatif)</span>
                  <textarea name="note" rows="3" placeholder="Ce qui vous donne envie de participer…"></textarea>
                </label>
                <button type="submit">
                  Envoyer ma demande <span aria-hidden="true">→</span>
                </button>
              </form>
              <p class="tct-ambassador-join-status" data-tct-ambassador-join-status hidden></p>
            </div>`}
        </section>` : ''}
    </section>`;
}

// ── Équipe : séparation en deux groupes, port fidèle de la règle Pangea ──
// (index.html : `team.filter(t => t.badge !== 'Parella')` définit les
// deux groupes — ici `group` est le nom du champ dans le Manifest).
function renderTeam(team) {
  if (!team) return '';
  const members = team.members || [];
  const internal = members.filter(m => m.group !== 'Parella');
  const parella = members.filter(m => m.group === 'Parella');

  function personCard(m) {
    return `
      <li class="tct-person">
        ${renderAsset(m.photo, 'tct-person-photo')}
        <strong>${esc(m.name)}</strong>
        <span>${esc(m.title)}</span>
      </li>`;
  }

  return `
    <section id="team" class="tct-section">
      <ul class="tct-grid tct-people">${internal.map(personCard).join('') || '<li class="tct-empty">Aucun membre publié pour le moment.</li>'}</ul>
      ${parella.length ? `
        <div class="tct-team-parella">
          ${team.intro && team.intro.introBody ? `<p class="tct-desc">${esc(team.intro.introBody)}</p>` : ''}
          <ul class="tct-grid tct-people">${parella.map(personCard).join('')}</ul>
        </div>` : ''}
      ${team.cta && (team.cta.title || team.cta.body) ? `
        <div class="tct-cta">
          ${team.cta.title ? `<strong>${esc(team.cta.title)}</strong>` : ''}
          ${team.cta.body ? `<p>${esc(team.cta.body)}</p>` : ''}
        </div>` : ''}
    </section>`;
}

function renderNavigation(navigation, options = {}) {
  const items = (navigation || [])
    .filter(n => n && n.module && n.module !== 'timeline' && n.module !== 'team')
    .map(n => ({ module: n.module, label: n.label }));

  // Manifest v1 still calls the semantic Project trajectory module `timeline`
  // and may omit it from navigation. Experience v2 exposes it as `Le projet`
  // whenever the module is active. This is a temporary front adapter until
  // Studio / Compiler gain the dedicated Project information architecture.
  if (options.hasProject) {
    items.unshift({ module: 'timeline', label: 'Le projet' });
  }

  const links = items
    .map(n => `<a href="#${esc(n.module)}">${esc(n.label)}</a>`)
    .join('');
  return `<nav class="tct-nav" id="tct-main-nav" aria-label="Navigation principale">${links}</nav>`;
}

function renderFooter() {
  return `
    <footer class="tct-footer">
      <div class="tct-footer-inner">
        <span class="tct-footer-note">Espace projet</span>
        <span class="tct-footer-signature">Powered by <strong>Storm</strong> · Tectonic 2.1</span>
      </div>
    </footer>`;
}

const SECTION_RENDERERS = {
  home: renderHome,
  spaces: renderSpaces,
  news: renderNews,
  questions: renderQuestions,
  ambassadors: renderAmbassadors,
  team: renderTeam
};
const SECTION_ORDER = ['home', 'timeline', 'questions', 'news', 'spaces', 'ambassadors'];

const STYLE = `
  :root { color-scheme:light; }
  * { box-sizing:border-box; }
  html { scroll-behavior:smooth; background:#f7f7f5; }
  body {
    margin:0;
    background:var(--tct-canvas,#f7f7f5);
    color:var(--tct-ink,#171717);
    font-family:var(--tct-font-primary,'Roboto'), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    -webkit-font-smoothing:antialiased;
    text-rendering:optimizeLegibility;
  }
  body.tct-nav-open { overflow:hidden; }
  a, button, input, textarea { font:inherit; }
  a { color:inherit; }
  button { color:inherit; }
  ::selection { background:rgba(30,29,30,.12); color:var(--tct-ink,#171717); }
  :focus-visible { outline:2px solid var(--tct-primary,#1e1d1e); outline-offset:4px; border-radius:3px; }

  .tct-site {
    --tct-canvas:#f7f7f5;
    --tct-paper:#ffffff;
    --tct-soft:#ececea;
    --tct-soft-2:#f1f1ef;
    --tct-ink:#171717;
    --tct-muted:#6a6a66;
    --tct-faint:#969690;
    --tct-hairline:rgba(23,23,23,.14);
    --tct-hairline-soft:rgba(23,23,23,.075);
    min-height:100vh;
    background:var(--tct-canvas);
  }

  /* Foundation — the header behaves as a material layer, not a separator. */
  .tct-header {
    --tct-header-alpha:.58;
    --tct-header-blur:24px;
    --tct-header-shadow-alpha:0;
    position:sticky;
    top:0;
    z-index:80;
    min-height:74px;
    display:flex;
    align-items:center;
    background:rgb(247 247 245 / var(--tct-header-alpha));
    box-shadow:0 14px 36px rgb(23 23 23 / var(--tct-header-shadow-alpha));
    backdrop-filter:blur(var(--tct-header-blur)) saturate(138%);
    -webkit-backdrop-filter:blur(var(--tct-header-blur)) saturate(138%);
    transition:min-height .42s cubic-bezier(.16,1,.3,1), background-color .28s ease, box-shadow .32s ease;
  }
  .tct-header.is-compact { min-height:60px; }
  @supports not ((backdrop-filter:blur(2px)) or (-webkit-backdrop-filter:blur(2px))) {
    .tct-header { background:rgba(247,247,245,.96); }
  }
  .tct-header-inner {
    width:min(1420px, calc(100% - 64px));
    margin:0 auto;
    display:grid;
    grid-template-columns:minmax(190px,1fr) auto auto;
    align-items:center;
    gap:clamp(18px,2.6vw,42px);
  }
  .tct-brand {
    min-width:0;
    display:inline-flex;
    align-items:center;
    gap:11px;
    width:max-content;
    max-width:100%;
    color:var(--tct-ink);
    text-decoration:none;
  }
  .tct-brand img { width:auto; height:27px; max-width:132px; object-fit:contain; }
  .tct-brand-name {
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
    font-size:.8rem;
    font-weight:500;
    letter-spacing:-.015em;
  }
  .tct-nav { display:flex; align-items:center; gap:clamp(17px,2vw,30px); }
  .tct-nav a {
    position:relative;
    padding:10px 0;
    color:var(--tct-muted);
    text-decoration:none;
    font-size:.76rem;
    font-weight:500;
    white-space:nowrap;
    transition:color .2s ease;
  }
  .tct-nav a::after {
    content:'';
    position:absolute;
    left:50%;
    bottom:2px;
    width:4px;
    height:4px;
    border-radius:50%;
    background:var(--tct-primary);
    opacity:0;
    transform:translate(-50%,3px) scale(.5);
    transition:opacity .2s ease, transform .25s cubic-bezier(.2,.8,.2,1);
  }
  .tct-nav a:hover, .tct-nav a[aria-current="page"] { color:var(--tct-ink); }
  .tct-nav a[aria-current="page"]::after { opacity:1; transform:translate(-50%,0) scale(1); }
  .tct-admin-entry {
    display:inline-flex;
    align-items:center;
    gap:7px;
    min-height:34px;
    padding:0 8px;
    color:var(--tct-faint);
    text-decoration:none;
    font-size:.69rem;
    font-weight:500;
    white-space:nowrap;
    transition:color .2s ease, background .2s ease;
  }
  .tct-admin-entry:hover { color:var(--tct-ink); background:rgba(23,23,23,.045); }
  .tct-admin-entry svg { width:12px; height:12px; flex:0 0 auto; }
  .tct-menu-toggle {
    display:none;
    width:38px;
    height:38px;
    border:0;
    border-radius:999px;
    background:transparent;
    cursor:pointer;
    align-items:center;
    justify-content:center;
  }
  .tct-menu-toggle:hover { background:rgba(23,23,23,.05); }
  .tct-menu-toggle span, .tct-menu-toggle::before, .tct-menu-toggle::after {
    content:'';
    display:block;
    width:15px;
    height:1px;
    background:currentColor;
    transition:transform .22s ease, opacity .22s ease;
  }
  .tct-menu-toggle span { margin:3px 0; }
  .tct-menu-toggle[aria-expanded="true"]::before { transform:translateY(4px) rotate(45deg); }
  .tct-menu-toggle[aria-expanded="true"] span { opacity:0; }
  .tct-menu-toggle[aria-expanded="true"]::after { transform:translateY(-4px) rotate(-45deg); }

  /* Page switching keeps the public experience out of one-pager territory. */
  .tct-main > .tct-section { display:none; }
  .tct-main > .tct-section.is-active { display:block; }
  .tct-section { width:min(1420px, calc(100% - 64px)); margin:0 auto; padding:clamp(72px,8vw,128px) 0; }
  .tct-kicker, .tct-eyebrow {
    margin:0;
    color:var(--tct-muted);
    text-transform:uppercase;
    letter-spacing:.15em;
    font-size:.62rem;
    font-weight:600;
  }
  .tct-text-link {
    display:inline-flex;
    align-items:center;
    gap:9px;
    margin-top:26px;
    color:var(--tct-ink);
    text-decoration:none;
    font-size:.79rem;
    font-weight:500;
  }
  .tct-text-link span { transition:transform .24s cubic-bezier(.2,.8,.2,1); }
  .tct-text-link:hover span { transform:translateX(4px); }
  .tct-round-link {
    width:48px;
    height:48px;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    justify-self:end;
    align-self:center;
    border:1px solid var(--tct-hairline);
    border-radius:50%;
    text-decoration:none;
    font-size:1.05rem;
    transition:transform .25s cubic-bezier(.2,.8,.2,1), background .2s ease, border-color .2s ease;
  }
  .tct-round-link:hover { transform:translateX(4px); background:var(--tct-ink); color:#fff; border-color:var(--tct-ink); }

  /* HOME v2.3 — A quiet prologue leads into the current phase, then the next.
     The page should feel edited, not dashboard-like. */
  .tct-home { padding-top:0; padding-bottom:0; }
  .tct-home-landing {
    min-height:calc(100svh - 74px);
    display:flex;
    align-items:center;
    justify-content:center;
    padding:clamp(48px,7vw,92px) 0 clamp(22px,4vw,52px);
  }
  .tct-home-landing-inner {
    width:min(920px,100%);
    margin:0 auto;
  }
  .tct-home-landing-title {
    margin:0 auto;
    max-width:11.2ch;
    text-align:center;
    font-family:var(--tct-font-secondary,'Italiana'), Georgia, serif;
    font-size:clamp(3.05rem,6.1vw,6.1rem);
    line-height:.98;
    font-weight:400;
    letter-spacing:-.03em;
    text-wrap:balance;
  }
  .tct-home-landing-accent { color:var(--tct-expression-accent,var(--tct-ink)); }
  .tct-home-stage {
    min-height:auto;
    display:flex;
    flex-direction:column;
    margin-top:-72px;
    padding-top:clamp(10px,2.2vw,20px);
    padding-bottom:clamp(22px,4vw,42px);
  }
  .tct-home-stage-meta {
    display:flex;
    align-items:center;
    gap:9px;
    min-height:22px;
    color:var(--tct-muted);
    font-size:.68rem;
    font-weight:500;
    letter-spacing:.01em;
  }
  .tct-live-dot {
    position:relative;
    width:8px;
    height:8px;
    flex:0 0 auto;
    border-radius:50%;
    background:var(--tct-ink);
    box-shadow:
      0 0 0 8px color-mix(in srgb, var(--tct-expression-accent) 14%, transparent),
      0 0 26px color-mix(in srgb, var(--tct-expression-accent) 26%, transparent);
  }
  .tct-live-dot::before,
  .tct-live-dot::after {
    content:'';
    position:absolute;
    border-radius:50%;
    pointer-events:none;
  }
  .tct-live-dot::before {
    inset:-12px;
    background:color-mix(in srgb, var(--tct-expression-accent) 25%, transparent);
    opacity:.38;
    transform:scale(.76);
    animation:tct-now-breathe 3.4s cubic-bezier(.16,1,.3,1) infinite;
  }
  .tct-live-dot::after {
    inset:-20px;
    background:radial-gradient(circle, color-mix(in srgb, var(--tct-expression-accent) 18%, transparent) 0%, transparent 74%);
    opacity:.24;
    transform:scale(.82);
    animation:tct-now-breathe-wide 5.2s cubic-bezier(.16,1,.3,1) infinite;
    animation-delay:.9s;
  }
  @keyframes tct-now-breathe {
    0%,100% { opacity:.34; transform:scale(.76); }
    46% { opacity:.14; transform:scale(1.42); }
    68% { opacity:.2; transform:scale(1.1); }
  }
  @keyframes tct-now-breathe-wide {
    0%,100% { opacity:.22; transform:scale(.82); }
    55% { opacity:.08; transform:scale(1.64); }
  }
  .tct-home-phase {
    margin-left:auto;
    color:var(--tct-faint);
    font-size:.65rem;
    text-transform:uppercase;
    letter-spacing:.12em;
  }
  .tct-home-stage-grid {
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    column-gap:clamp(18px,2vw,32px);
    align-items:end;
    padding:clamp(26px,3vw,42px) 0 clamp(38px,5.5vw,74px);
  }
  .tct-home-title {
    grid-column:1 / span 8;
    margin:0;
    max-width:10.8ch;
    font-family:var(--tct-font-primary,'Roboto'), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size:clamp(3.65rem,7vw,7.35rem);
    line-height:.94;
    font-weight:400;
    letter-spacing:-.062em;
    text-wrap:balance;
  }
  .tct-home-present {
    grid-column:10 / span 3;
    align-self:end;
    padding-bottom:.4rem;
  }
  .tct-home-present > span {
    color:var(--tct-faint);
    text-transform:uppercase;
    letter-spacing:.13em;
    font-size:.59rem;
    font-weight:600;
  }
  .tct-home-present p {
    margin:18px 0 0;
    color:var(--tct-muted);
    font-size:clamp(.92rem,1vw,1rem);
    line-height:1.65;
  }
  .tct-home-nextline {
    position:relative;
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    column-gap:clamp(18px,2vw,32px);
    align-items:start;
    padding:clamp(10px,1.6vw,16px) 0 clamp(18px,3vw,36px);
  }
  .tct-home-nextline-rail {
    grid-column:1 / span 4;
    display:flex;
    flex-direction:column;
    gap:22px;
  }
  .tct-home-nextline-label {
    color:var(--tct-faint);
    text-transform:uppercase;
    letter-spacing:.14em;
    font-size:.59rem;
    font-weight:600;
  }
  .tct-home-nextline-date {
    font-family:var(--tct-font-secondary,'Italiana'), Georgia, serif;
    font-size:clamp(2.25rem,3.6vw,4.05rem);
    line-height:.98;
    letter-spacing:-.04em;
    text-wrap:balance;
  }
  .tct-home-nextline-copy {
    grid-column:6 / span 5;
    padding-top:8px;
  }
  .tct-home-nextline-copy h2 {
    margin:0;
    font-size:clamp(1.18rem,1.55vw,1.55rem);
    font-weight:500;
    line-height:1.22;
    letter-spacing:-.03em;
  }
  .tct-home-nextline-copy p {
    max-width:44rem;
    margin:12px 0 0;
    color:var(--tct-muted);
    font-size:.84rem;
    line-height:1.6;
  }
  .tct-home-nextline-link { margin-top:22px; }

  /* Featured content becomes a full-width editorial event instead of a card. */
  .tct-home-feature {
    position:relative;
    width:100vw;
    margin-left:calc(50% - 50vw);
    background:var(--tct-soft);
    overflow:hidden;
  }

  .tct-home-feature-inner {
    width:min(1420px, calc(100% - 64px));
    min-height:min(690px,76vh);
    margin:0 auto;
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    column-gap:clamp(18px,2vw,32px);
    align-items:center;
    padding:clamp(94px,10vw,158px) 0;
  }
  .tct-home-feature-meta {
    grid-column:1 / span 2;
    align-self:start;
    display:flex;
    flex-direction:column;
    gap:8px;
    padding-top:8px;
    color:var(--tct-faint);
    text-transform:uppercase;
    letter-spacing:.13em;
    font-size:.58rem;
    font-weight:600;
  }
  .tct-home-feature-meta span:first-child { color:var(--tct-ink); }
  .tct-home-feature-title-wrap { grid-column:3 / span 7; }
  .tct-home-feature h2 {
    margin:0;
    max-width:15ch;
    font-family:var(--tct-font-primary,'Roboto'), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size:clamp(3rem,5.5vw,5.9rem);
    line-height:.98;
    font-weight:400;
    letter-spacing:-.055em;
    text-wrap:balance;
  }
  .tct-home-feature-aside {
    grid-column:10 / span 3;
    align-self:end;
    padding-bottom:8px;
  }
  .tct-home-feature-aside p {
    margin:0;
    color:var(--tct-muted);
    font-size:.92rem;
    line-height:1.65;
  }

  /* Latest news is deliberately a strip, not another content block. */
  .tct-home-latest {
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    column-gap:clamp(18px,2vw,32px);
    align-items:center;
    min-height:156px;
    padding:42px 0;
  }
  .tct-home-latest-label {
    grid-column:1 / span 2;
    color:var(--tct-faint);
    text-transform:uppercase;
    letter-spacing:.13em;
    font-size:.59rem;
    font-weight:600;
  }
  .tct-home-latest-date {
    grid-column:3 / span 2;
    font-family:var(--tct-font-secondary,'Italiana'), Georgia, serif;
    font-size:clamp(1.4rem,2vw,2.15rem);
    line-height:1;
  }
  .tct-home-latest-copy { grid-column:5 / span 6; }
  .tct-home-latest-copy > span {
    display:block;
    margin-bottom:5px;
    color:var(--tct-faint);
    font-size:.62rem;
    text-transform:uppercase;
    letter-spacing:.1em;
  }
  .tct-home-latest h2 {
    margin:0;
    font-size:clamp(1.05rem,1.5vw,1.45rem);
    font-weight:500;
    line-height:1.25;
    letter-spacing:-.026em;
  }
  .tct-home-latest .tct-round-link { grid-column:12; }

  /* Questions is a large, calm exit path — no dark CTA slab. */
  .tct-home-questions {
    position:relative;
    min-height:min(650px,72vh);
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    column-gap:clamp(18px,2vw,32px);
    align-content:center;
    padding:clamp(110px,13vw,190px) 0;
  }
  .tct-home-questions-overline {
    grid-column:1 / span 2;
    align-self:start;
    padding-top:10px;
    color:var(--tct-faint);
    text-transform:uppercase;
    letter-spacing:.14em;
    font-size:.59rem;
    font-weight:600;
  }
  .tct-home-questions h2 {
    grid-column:3 / span 8;
    margin:0;
    max-width:12ch;
    font-family:var(--tct-font-primary,'Roboto'), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size:clamp(3.15rem,5.9vw,6.35rem);
    line-height:.95;
    font-weight:400;
    letter-spacing:-.058em;
    text-wrap:balance;
  }
  .tct-home-questions > p {
    grid-column:3 / span 5;
    margin:28px 0 0;
    color:var(--tct-muted);
    line-height:1.6;
    font-size:.92rem;
  }
  .tct-home-question-action {
    grid-column:3 / span 8;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:24px;
    margin-top:54px;
    padding:20px 22px 20px 0;
    border-radius:18px;
    color:var(--tct-ink);
    text-decoration:none;
    font-size:.86rem;
    font-weight:500;
    transition:background .3s ease, padding-left .38s cubic-bezier(.16,1,.3,1), padding-right .38s cubic-bezier(.16,1,.3,1);
  }
  .tct-home-question-action:hover,
  .tct-home-question-action:focus-visible {
    padding-left:22px;
    padding-right:14px;
    background:rgba(23,23,23,.04);
  }
  .tct-question-arrow {
    width:44px;
    height:44px;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    border-radius:50%;
    background:var(--tct-ink);
    color:#fff;
    font-size:1rem;
    transition:transform .25s cubic-bezier(.2,.8,.2,1);
  }
  .tct-home-question-action:hover .tct-question-arrow { transform:translateX(5px); }

  /* PROJECT v2.5.2 — Le projet is a continuous editorial narrative.
     POC-only fallback copy is used until Studio / Compiler publish semantic
     project sections. Layout choices never enter the Manifest. */
  .tct-project-page { padding-top:clamp(86px,9vw,150px); padding-bottom:clamp(110px,12vw,180px); }
  .tct-project-opening {
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    column-gap:clamp(18px,2vw,32px);
    align-items:start;
    min-height:min(590px,66vh);
    padding-bottom:clamp(90px,10vw,150px);
  }
  .tct-project-opening-eyebrow {
    grid-column:1 / span 2;
    padding-top:.65rem;
    color:var(--tct-faint);
    text-transform:uppercase;
    letter-spacing:.14em;
    font-size:.59rem;
    font-weight:600;
  }
  .tct-project-opening h1 {
    grid-column:3 / span 7;
    margin:0;
    max-width:10.8ch;
    font-family:var(--tct-font-secondary,'Italiana'), Georgia, serif;
    font-size:clamp(3.45rem,6.55vw,7rem);
    line-height:.96;
    font-weight:400;
    letter-spacing:-.04em;
    text-wrap:balance;
  }
  .tct-project-opening > p {
    grid-column:10 / span 3;
    align-self:end;
    margin:0 0 .45rem;
    color:var(--tct-muted);
    font-size:clamp(.92rem,1vw,1rem);
    line-height:1.72;
  }

  .tct-project-flow { display:block; }
  .tct-project-section { position:relative; margin:0; }

  .tct-project-focus {
    width:100vw;
    margin-left:calc(50% - 50vw);
    padding:clamp(92px,10vw,150px) 0;
    background:var(--tct-soft-2);
  }
  .tct-project-focus-inner {
    width:min(1420px,calc(100% - 64px));
    margin:0 auto;
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    column-gap:clamp(18px,2vw,32px);
  }
  .tct-project-focus-inner > span {
    grid-column:1 / span 2;
    padding-top:.6rem;
    color:var(--tct-faint);
    text-transform:uppercase;
    letter-spacing:.14em;
    font-size:.59rem;
    font-weight:600;
  }
  .tct-project-focus-inner > div { grid-column:4 / span 7; }
  .tct-project-focus h2 {
    margin:0;
    max-width:12ch;
    font-family:var(--tct-font-secondary,'Italiana'), Georgia, serif;
    font-size:clamp(2.7rem,5vw,5.35rem);
    line-height:.99;
    font-weight:400;
    letter-spacing:-.038em;
    text-wrap:balance;
  }
  .tct-project-focus p {
    max-width:43rem;
    margin:30px 0 0;
    color:var(--tct-muted);
    font-size:clamp(.95rem,1vw,1.04rem);
    line-height:1.75;
  }

  .tct-project-figures {
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    column-gap:clamp(18px,2vw,32px);
    padding:clamp(110px,12vw,180px) 0;
  }
  .tct-project-figures-head {
    grid-column:1 / span 2;
    padding-top:.55rem;
    color:var(--tct-faint);
    text-transform:uppercase;
    letter-spacing:.14em;
    font-size:.59rem;
    font-weight:600;
  }
  .tct-project-figures-grid {
    grid-column:4 / -1;
    display:grid;
    grid-template-columns:repeat(var(--tct-figure-count,3),minmax(0,1fr));
    gap:clamp(28px,4vw,72px);
    align-items:start;
  }
  .tct-project-figures-grid.is-many {
    grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
  }
  .tct-project-figure strong {
    display:block;
    font-family:var(--tct-font-secondary,'Italiana'), Georgia, serif;
    font-size:clamp(3.1rem,5.8vw,6.3rem);
    line-height:.9;
    font-weight:400;
    letter-spacing:-.055em;
  }
  .tct-project-figure span {
    display:block;
    max-width:15rem;
    margin-top:18px;
    color:var(--tct-muted);
    font-size:.79rem;
    line-height:1.55;
  }

  .tct-project-text { padding:clamp(56px,7vw,104px) 0 clamp(118px,13vw,190px); }
  .tct-project-reading {
    width:min(700px,58vw);
    margin-left:25%;
  }
  .tct-project-reading h2 {
    margin:0;
    font-size:clamp(1.85rem,3vw,3.2rem);
    line-height:1.08;
    font-weight:450;
    letter-spacing:-.045em;
    text-wrap:balance;
  }
  .tct-project-reading p {
    margin:30px 0 0;
    color:var(--tct-muted);
    font-size:clamp(.98rem,1.05vw,1.08rem);
    line-height:1.78;
  }

  .tct-project-trajectory { padding:clamp(30px,4vw,58px) 0 clamp(126px,13vw,194px); }
  .tct-project-trajectory-head {
    display:flex;
    align-items:baseline;
    justify-content:space-between;
    gap:24px;
    margin-bottom:clamp(54px,6vw,88px);
  }
  .tct-project-trajectory-head h2 {
    margin:0;
    font-size:.65rem;
    font-weight:600;
    text-transform:uppercase;
    letter-spacing:.14em;
  }
  .tct-project-trajectory-head span {
    color:var(--tct-faint);
    font-size:.62rem;
    text-transform:uppercase;
    letter-spacing:.11em;
  }
  .tct-project-track {
    --tct-trajectory-progress:0%;
    position:relative;
  }
  .tct-project-milestones { list-style:none; margin:0; padding:0; }
  .tct-project-track.is-horizontal .tct-project-milestones {
    display:grid;
    grid-template-columns:repeat(var(--tct-project-step-count,6),minmax(0,1fr));
    gap:clamp(18px,2vw,30px);
  }
  .tct-project-track-line { position:absolute; pointer-events:none; }
  .tct-project-track-line i {
    position:absolute;
    display:block;
    background:var(--tct-expression-accent,var(--tct-ink));
  }
  .tct-project-track.is-horizontal .tct-project-track-line {
    top:5px; left:0; right:0; height:1px;
    background:color-mix(in srgb,var(--tct-ink) 12%,transparent);
  }
  .tct-project-track.is-horizontal .tct-project-track-line i {
    left:0; top:0; width:var(--tct-trajectory-progress); height:1px;
    transition:width .08s linear;
  }
  .tct-project-milestone { position:relative; min-width:0; padding-top:30px; }
  .tct-project-milestone-marker {
    position:absolute; z-index:2; top:0; left:0;
    width:11px; height:11px; border-radius:50%;
    border:1px solid color-mix(in srgb,var(--tct-ink) 34%,transparent);
    background:var(--tct-canvas);
  }
  .tct-project-milestone.tct-status-done .tct-project-milestone-marker {
    background:var(--tct-ink); border-color:var(--tct-ink);
  }
  .tct-project-milestone.tct-status-current .tct-project-milestone-marker {
    border-color:var(--tct-expression-accent,var(--tct-ink));
    background:var(--tct-expression-accent,var(--tct-ink));
    box-shadow:0 0 0 7px color-mix(in srgb,var(--tct-expression-accent,var(--tct-ink)) 12%,transparent),
      0 0 24px color-mix(in srgb,var(--tct-expression-accent,var(--tct-ink)) 18%,transparent);
  }
  .tct-project-milestone-meta {
    display:flex; flex-direction:column; gap:15px; min-height:84px;
  }
  .tct-project-milestone-status {
    color:var(--tct-faint);
    font-size:.58rem; font-weight:600; letter-spacing:.12em; text-transform:uppercase;
  }
  .tct-project-milestone.tct-status-current .tct-project-milestone-status {
    color:var(--tct-expression-accent,var(--tct-ink));
  }
  .tct-project-milestone-date {
    max-width:13ch;
    font-family:var(--tct-font-secondary,'Italiana'), Georgia, serif;
    font-size:clamp(1.38rem,2vw,2.15rem);
    line-height:1.04;
    letter-spacing:-.035em;
  }
  .tct-project-milestone-copy { margin-top:18px; }
  .tct-project-milestone-copy h3 {
    margin:0;
    font-size:clamp(.92rem,1vw,1.02rem);
    font-weight:500;
    line-height:1.32;
    letter-spacing:-.02em;
  }
  .tct-project-milestone-copy p {
    margin:12px 0 0;
    color:var(--tct-muted);
    font-size:.76rem;
    line-height:1.58;
  }
  .tct-project-milestone.tct-status-done { opacity:.62; }
  .tct-project-milestone.tct-status-future { opacity:.76; }
  .tct-project-milestone.tct-status-current { opacity:1; }

  .tct-project-track.is-vertical { max-width:1060px; margin-left:auto; }
  .tct-project-track.is-vertical .tct-project-track-line {
    top:0; bottom:0; left:5px; width:1px;
    background:color-mix(in srgb,var(--tct-ink) 12%,transparent);
  }
  .tct-project-track.is-vertical .tct-project-track-line i {
    top:0; left:0; width:1px; height:var(--tct-trajectory-progress);
    transition:height .08s linear;
  }
  .tct-project-track.is-vertical .tct-project-milestones { display:grid; gap:0; }
  .tct-project-track.is-vertical .tct-project-milestone {
    display:grid;
    grid-template-columns:2fr 3fr 5fr;
    gap:clamp(24px,4vw,64px);
    padding:0 0 clamp(58px,6vw,92px) 42px;
  }
  .tct-project-track.is-vertical .tct-project-milestone-marker { left:0; }
  .tct-project-track.is-vertical .tct-project-milestone-meta { min-height:0; }
  .tct-project-track.is-vertical .tct-project-milestone-copy { margin-top:0; }
  .tct-project-track.is-vertical .tct-project-milestone-copy p { max-width:42rem; }

  .tct-project-quote {
    width:100vw;
    margin-left:calc(50% - 50vw);
    padding:clamp(116px,13vw,198px) 0;
    background:var(--tct-ink);
    color:var(--tct-canvas);
  }
  .tct-project-quote blockquote,
  .tct-project-quote cite {
    width:min(1120px,calc(100% - 64px));
    margin-left:auto;
    margin-right:auto;
  }
  .tct-project-quote blockquote {
    margin-top:0;
    margin-bottom:0;
    max-width:15ch;
    font-family:var(--tct-font-secondary,'Italiana'), Georgia, serif;
    font-size:clamp(3rem,5.7vw,6rem);
    line-height:1.02;
    font-weight:400;
    font-style:normal;
    letter-spacing:-.04em;
    text-wrap:balance;
  }
  .tct-project-quote cite {
    display:block;
    margin-top:42px;
    color:rgba(247,247,245,.55);
    font-family:var(--tct-font-primary,'Roboto'),sans-serif;
    font-size:.66rem;
    font-style:normal;
    letter-spacing:.12em;
    text-transform:uppercase;
  }

  .tct-project-choices {
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    column-gap:clamp(18px,2vw,32px);
    padding:clamp(126px,14vw,210px) 0;
  }
  .tct-project-choices-head {
    grid-column:1 / span 3;
    padding-top:.35rem;
    color:var(--tct-faint);
    font-size:.61rem;
    font-weight:600;
    letter-spacing:.14em;
    text-transform:uppercase;
  }
  .tct-project-choices-grid {
    grid-column:5 / -1;
    display:grid;
    grid-template-columns:repeat(3,minmax(0,1fr));
    gap:clamp(34px,4vw,68px);
  }
  .tct-project-choices article h3 {
    margin:0;
    font-size:clamp(1.12rem,1.55vw,1.5rem);
    line-height:1.18;
    font-weight:500;
    letter-spacing:-.03em;
  }
  .tct-project-choices article p {
    margin:16px 0 0;
    color:var(--tct-muted);
    font-size:.83rem;
    line-height:1.62;
  }

  .tct-project-team {
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    column-gap:clamp(18px,2vw,32px);
    padding:clamp(48px,6vw,84px) 0 clamp(40px,5vw,70px);
  }
  .tct-project-team-heading { grid-column:1 / span 4; }
  .tct-project-team-heading > span {
    color:var(--tct-faint);
    font-size:.59rem;
    font-weight:600;
    letter-spacing:.14em;
    text-transform:uppercase;
  }
  .tct-project-team-heading h2 {
    max-width:10ch;
    margin:22px 0 0;
    font-family:var(--tct-font-secondary,'Italiana'), Georgia, serif;
    font-size:clamp(2.35rem,4.2vw,4.65rem);
    line-height:1;
    font-weight:400;
    letter-spacing:-.038em;
  }
  .tct-project-team-grid {
    grid-column:6 / -1;
    list-style:none;
    margin:0;
    padding:0;
    display:grid;
    grid-template-columns:repeat(3,minmax(0,1fr));
    gap:clamp(24px,3vw,46px);
  }
  .tct-project-person { min-width:0; }
  .tct-project-person-photo,
  .tct-project-person-fallback {
    aspect-ratio:4 / 5;
    width:100%;
    overflow:hidden;
    background:var(--tct-soft);
  }
  .tct-project-person-img {
    display:block;
    width:100%;
    height:100%;
    object-fit:cover;
  }
  .tct-project-person-fallback {
    display:flex;
    align-items:flex-end;
    padding:18px;
    font-family:var(--tct-font-secondary,'Italiana'),Georgia,serif;
    font-size:clamp(2.1rem,4vw,4rem);
    letter-spacing:-.04em;
  }
  .tct-project-person-copy { margin-top:18px; }
  .tct-project-person-copy strong {
    display:block;
    font-size:.88rem;
    font-weight:500;
  }
  .tct-project-person-copy span {
    display:block;
    margin-top:5px;
    color:var(--tct-muted);
    font-size:.72rem;
    line-height:1.45;
  }

  .tct-project-media { padding:clamp(72px,8vw,120px) 0 clamp(118px,13vw,190px); }
  .tct-project-media-frame { overflow:hidden; }
  .tct-project-media-img {
    display:block;
    width:100%;
    max-height:82vh;
    object-fit:cover;
    transform:translate3d(0,var(--tct-media-drift,0px),0) scale(1.018);
    will-change:transform;
  }
  .tct-project-media figcaption,
  .tct-project-gallery figcaption {
    margin-top:12px;
    color:var(--tct-faint);
    font-size:.65rem;
    line-height:1.45;
  }

  .tct-project-gallery { padding:clamp(70px,8vw,118px) 0 clamp(124px,14vw,200px); }
  .tct-project-gallery-head {
    margin-bottom:34px;
    color:var(--tct-faint);
    font-size:.59rem;
    font-weight:600;
    letter-spacing:.14em;
    text-transform:uppercase;
  }
  .tct-project-gallery-grid {
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    gap:clamp(18px,2vw,32px);
    align-items:start;
  }
  .tct-project-gallery-item { margin:0; grid-column:span 5; }
  .tct-project-gallery-item.is-lead { grid-column:1 / span 7; }
  .tct-project-gallery-item:nth-child(2) { grid-column:9 / span 4; margin-top:clamp(68px,9vw,130px); }
  .tct-project-gallery-item:nth-child(n+3) { grid-column:span 4; }
  .tct-project-gallery-item > div { overflow:hidden; }
  .tct-project-gallery-img {
    display:block;
    width:100%;
    height:auto;
    transform:translate3d(0,var(--tct-media-drift,0px),0) scale(1.018);
    will-change:transform;
  }



  /* ESPACES v2.7 — architectural editorial rhythm; plans become tools. */
  .tct-spaces-page { padding-top:clamp(84px,9vw,146px); padding-bottom:clamp(110px,12vw,180px); }

  .tct-spaces-opening {
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    column-gap:clamp(18px,2vw,32px);
    min-height:min(540px,62vh);
    align-items:start;
    padding-bottom:clamp(92px,10vw,154px);
  }
  .tct-spaces-opening-eyebrow {
    grid-column:1 / span 2;
    padding-top:.62rem;
    color:var(--tct-faint);
    text-transform:uppercase;
    letter-spacing:.14em;
    font-size:.59rem;
    font-weight:600;
  }
  .tct-spaces-opening h1 {
    grid-column:3 / span 7;
    margin:0;
    max-width:9.8ch;
    font-family:var(--tct-font-secondary,'Italiana'),Georgia,serif;
    font-size:clamp(3.4rem,6.55vw,7rem);
    line-height:.96;
    font-weight:400;
    letter-spacing:-.042em;
    text-wrap:balance;
  }
  .tct-spaces-opening > p {
    grid-column:10 / span 3;
    align-self:end;
    margin:0 0 .42rem;
    color:var(--tct-muted);
    font-size:clamp(.92rem,1vw,1rem);
    line-height:1.72;
  }

  .tct-spaces-lead {
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    column-gap:clamp(18px,2vw,32px);
    align-items:end;
    padding-bottom:clamp(128px,14vw,204px);
  }
  .tct-spaces-lead-media { grid-column:1 / span 8; overflow:hidden; min-height:420px; }
  .tct-spaces-lead-copy { grid-column:9 / -1; padding:0 0 .3rem clamp(8px,1vw,18px); }
  .tct-spaces-lead-copy > span,
  .tct-space-story-copy > span,
  .tct-space-detail-eyebrow,
  .tct-space-usages-head > span,
  .tct-space-related > div:first-child > span {
    color:var(--tct-faint);
    font-size:.59rem;
    font-weight:600;
    letter-spacing:.14em;
    text-transform:uppercase;
  }
  .tct-spaces-lead-copy h2 {
    margin:19px 0 0;
    max-width:9.5ch;
    font-size:clamp(2.35rem,4vw,4.45rem);
    line-height:1;
    font-weight:450;
    letter-spacing:-.052em;
    text-wrap:balance;
  }
  .tct-spaces-lead-copy p,
  .tct-space-story-copy p {
    margin:24px 0 0;
    color:var(--tct-muted);
    font-size:.88rem;
    line-height:1.68;
  }

  .tct-spaces-lead-media-button,
  .tct-space-story-media-button,
  .tct-space-detail-hero-button,
  .tct-space-detail-secondary-button {
    position:relative;
    display:block;
    width:100%;
    height:100%;
    min-height:inherit;
    margin:0;
    padding:0;
    border:0;
    border-radius:0;
    background:transparent;
    color:inherit;
    text-align:left;
    cursor:pointer;
    overflow:hidden;
  }
  .tct-space-image-trigger img {
    display:block;
    width:100%;
    height:100%;
    min-height:inherit;
    object-fit:cover;
    transform:translate3d(0,var(--tct-media-drift,0px),0) scale(1.018);
    transition:transform .75s cubic-bezier(.16,1,.3,1);
    will-change:transform;
  }
  .tct-space-image-trigger:hover img {
    transform:translate3d(0,var(--tct-media-drift,0px),0) scale(1.028);
  }
  .tct-space-image-action {
    position:absolute;
    right:18px;
    bottom:18px;
    padding:10px 13px;
    border-radius:999px;
    background:rgba(247,247,245,.78);
    color:var(--tct-ink);
    backdrop-filter:blur(18px) saturate(130%);
    -webkit-backdrop-filter:blur(18px) saturate(130%);
    font-size:.64rem;
    font-weight:500;
    opacity:0;
    transform:translateY(5px);
    transition:opacity .28s ease,transform .28s ease;
  }
  .tct-space-image-trigger:hover .tct-space-image-action,
  .tct-space-image-trigger:focus-visible .tct-space-image-action { opacity:1; transform:none; }

  .tct-space-document-trigger {
    display:flex;
    min-height:420px;
    align-items:flex-end;
    justify-content:space-between;
    gap:30px;
    padding:clamp(28px,4vw,54px);
    background:var(--tct-soft-2);
  }
  .tct-space-document-mark {
    align-self:flex-start;
    font-family:var(--tct-font-secondary,'Italiana'),Georgia,serif;
    font-size:clamp(4rem,9vw,9rem);
    line-height:.8;
    letter-spacing:-.06em;
    color:color-mix(in srgb,var(--tct-ink) 16%,transparent);
  }
  .tct-space-document-copy {
    display:flex;
    max-width:20rem;
    flex-direction:column;
    align-items:flex-start;
    gap:10px;
  }
  .tct-space-document-copy strong {
    font-size:clamp(1.25rem,2vw,2rem);
    line-height:1.08;
    font-weight:500;
    letter-spacing:-.035em;
  }
  .tct-space-document-copy em {
    color:var(--tct-muted);
    font-size:.72rem;
    font-style:normal;
  }

  .tct-space-empty-media {
    display:flex;
    min-height:420px;
    align-items:flex-end;
    padding:32px;
    background:var(--tct-soft);
  }
  .tct-space-empty-media span {
    font-family:var(--tct-font-secondary,'Italiana'),Georgia,serif;
    font-size:clamp(2.2rem,5vw,5.2rem);
    line-height:1;
    color:color-mix(in srgb,var(--tct-ink) 26%,transparent);
  }

  .tct-space-filters {
    display:flex;
    gap:22px;
    flex-wrap:wrap;
    margin:0 0 clamp(88px,10vw,144px);
  }
  .tct-space-filters button {
    padding:0 0 6px;
    border:0;
    border-bottom:1px solid transparent;
    background:transparent;
    color:var(--tct-faint);
    font-size:.7rem;
    cursor:pointer;
  }
  .tct-space-filters button:hover { color:var(--tct-ink); }
  .tct-space-filters button.is-active {
    color:var(--tct-ink);
    border-bottom-color:var(--tct-ink);
  }

  .tct-spaces-sequence { display:grid; gap:clamp(116px,14vw,216px); }
  .tct-space-story {
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    column-gap:clamp(18px,2vw,32px);
    align-items:center;
  }
  .tct-space-story-media { min-height:clamp(360px,43vw,650px); overflow:hidden; }
  .tct-space-story-copy h2 {
    margin:17px 0 0;
    max-width:10.5ch;
    font-size:clamp(2.15rem,3.6vw,4rem);
    line-height:1;
    font-weight:450;
    letter-spacing:-.05em;
    text-wrap:balance;
  }
  .tct-space-story-copy h2 a { text-decoration:none; }
  .tct-space-story-copy h2 a:hover {
    text-decoration:underline;
    text-decoration-thickness:1px;
    text-underline-offset:7px;
  }

  .tct-space-story.is-media-left .tct-space-story-media { grid-column:1 / span 7; }
  .tct-space-story.is-media-left .tct-space-story-copy { grid-column:9 / span 4; }
  .tct-space-story.is-media-right .tct-space-story-media { grid-column:6 / -1; order:2; }
  .tct-space-story.is-media-right .tct-space-story-copy { grid-column:1 / span 4; order:1; }
  .tct-space-story.is-wide .tct-space-story-media { grid-column:2 / span 9; min-height:clamp(420px,48vw,720px); }
  .tct-space-story.is-wide .tct-space-story-copy { grid-column:4 / span 6; margin-top:38px; }
  .tct-space-story.is-document .tct-space-story-media { grid-column:1 / span 8; min-height:360px; }
  .tct-space-story.is-document .tct-space-story-copy { grid-column:9 / -1; }
  .tct-space-story.is-document .tct-space-document-trigger { min-height:360px; }

  /* Space detail */
  .tct-space-detail-shell { padding-top:0; }
  .tct-space-back {
    display:inline-flex;
    align-items:center;
    gap:10px;
    margin-bottom:clamp(38px,5.5vw,78px);
    color:var(--tct-muted);
    text-decoration:none;
    font-size:.72rem;
    font-weight:500;
  }
  .tct-space-back:hover { color:var(--tct-ink); }

  .tct-space-detail-opening {
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    column-gap:clamp(18px,2vw,32px);
    padding-bottom:clamp(72px,8vw,124px);
  }
  .tct-space-detail-eyebrow { grid-column:1 / span 2; padding-top:.6rem; }
  .tct-space-detail-opening h1 {
    grid-column:3 / span 7;
    margin:0;
    max-width:10ch;
    font-family:var(--tct-font-secondary,'Italiana'),Georgia,serif;
    font-size:clamp(3.35rem,6.55vw,7rem);
    line-height:.96;
    font-weight:400;
    letter-spacing:-.042em;
    text-wrap:balance;
  }
  .tct-space-detail-opening > p {
    grid-column:10 / span 3;
    align-self:end;
    margin:0 0 .4rem;
    color:var(--tct-muted);
    font-size:clamp(.94rem,1vw,1.03rem);
    line-height:1.72;
  }

  .tct-space-detail-hero { min-height:clamp(520px,68vw,900px); overflow:hidden; }
  .tct-space-detail-hero.is-inspectable { min-height:clamp(430px,54vw,720px); }
  .tct-space-detail-hero .tct-space-document-trigger { min-height:clamp(430px,54vw,720px); }
  .tct-space-detail-hero-button img { max-height:88vh; }

  .tct-space-status {
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    column-gap:clamp(18px,2vw,32px);
    align-items:start;
    padding:clamp(50px,6vw,88px) 0 clamp(120px,13vw,190px);
  }
  .tct-space-status-signal {
    grid-column:1 / span 1;
    width:10px;
    height:10px;
    margin-top:6px;
    border-radius:50%;
    background:var(--tct-expression-accent,var(--tct-ink));
    box-shadow:0 0 0 7px color-mix(in srgb,var(--tct-expression-accent,var(--tct-ink)) 11%,transparent);
  }
  .tct-space-status > div:nth-child(2) { grid-column:3 / span 6; }
  .tct-space-status strong {
    display:block;
    font-size:1rem;
    font-weight:500;
  }
  .tct-space-status p {
    max-width:42rem;
    margin:13px 0 0;
    color:var(--tct-muted);
    font-size:.87rem;
    line-height:1.66;
  }
  .tct-space-inspect-link {
    grid-column:10 / -1;
    justify-self:start;
    padding:0;
    border:0;
    background:transparent;
    font-size:.75rem;
    font-weight:500;
    cursor:pointer;
  }
  .tct-space-inspect-link:hover { text-decoration:underline; text-underline-offset:5px; }

  .tct-space-usages {
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    column-gap:clamp(18px,2vw,32px);
    align-items:start;
    padding-bottom:clamp(130px,14vw,206px);
  }
  .tct-space-usages-head { grid-column:1 / span 4; }
  .tct-space-usages-head h2 {
    max-width:8.6ch;
    margin:22px 0 0;
    font-family:var(--tct-font-secondary,'Italiana'),Georgia,serif;
    font-size:clamp(2.35rem,4.3vw,4.8rem);
    line-height:1;
    font-weight:400;
    letter-spacing:-.04em;
  }
  .tct-space-usages-list {
    grid-column:6 / -1;
    list-style:none;
    margin:0;
    padding:0;
    display:grid;
    gap:38px;
  }
  .tct-space-usages-list li {
    display:grid;
    grid-template-columns:42px 1fr;
    gap:18px;
    align-items:start;
  }
  .tct-space-usages-list li > span {
    padding-top:3px;
    color:var(--tct-faint);
    font-family:var(--tct-font-secondary,'Italiana'),Georgia,serif;
    font-size:1rem;
  }
  .tct-space-usages-list strong {
    display:block;
    font-size:clamp(1.18rem,1.6vw,1.55rem);
    line-height:1.16;
    font-weight:500;
    letter-spacing:-.03em;
  }
  .tct-space-usages-list p {
    grid-column:2;
    margin:8px 0 0;
    color:var(--tct-muted);
    font-size:.82rem;
    line-height:1.62;
  }

  .tct-space-detail-gallery {
    display:grid;
    gap:clamp(70px,9vw,130px);
    padding-bottom:clamp(130px,14vw,206px);
  }
  .tct-space-detail-secondary { margin:0; }
  .tct-space-detail-secondary:nth-child(odd) { width:78%; }
  .tct-space-detail-secondary:nth-child(even) { width:66%; margin-left:auto; }
  .tct-space-detail-secondary-button { min-height:420px; }
  .tct-space-detail-secondary figcaption {
    margin-top:12px;
    color:var(--tct-faint);
    font-size:.65rem;
  }

  .tct-space-related {
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    column-gap:clamp(18px,2vw,32px);
    align-items:end;
    padding:clamp(88px,10vw,148px) 0 30px;
  }
  .tct-space-related > div:first-child { grid-column:1 / span 5; }
  .tct-space-related h2 {
    max-width:9ch;
    margin:22px 0 0;
    font-family:var(--tct-font-secondary,'Italiana'),Georgia,serif;
    font-size:clamp(2.4rem,4.4vw,4.9rem);
    line-height:1;
    font-weight:400;
    letter-spacing:-.04em;
  }
  .tct-space-related-links {
    grid-column:7 / -1;
    display:grid;
    gap:26px;
  }
  .tct-space-related-links a {
    position:relative;
    display:grid;
    grid-template-columns:120px 1fr auto;
    gap:18px;
    align-items:baseline;
    padding:0 0 18px;
    border-bottom:1px solid var(--tct-hairline-soft);
    text-decoration:none;
  }
  .tct-space-related-links a > span {
    color:var(--tct-faint);
    font-size:.61rem;
    text-transform:uppercase;
    letter-spacing:.11em;
  }
  .tct-space-related-links a strong {
    font-size:1rem;
    font-weight:500;
  }
  .tct-space-related-links a em {
    font-style:normal;
    transition:transform .22s ease;
  }
  .tct-space-related-links a:hover em { transform:translateX(4px); }

  /* Image viewing: quiet. Plan inspection: explicit tools. */
  body.tct-media-open { overflow:hidden; }
  .tct-space-viewer,
  .tct-plan-inspector {
    position:fixed;
    inset:0;
    z-index:10000;
    background:rgba(18,18,18,.96);
    color:#f7f7f5;
  }
  .tct-space-viewer {
    display:grid;
    place-items:center;
    padding:54px;
  }
  .tct-space-viewer img {
    display:block;
    max-width:min(1500px,94vw);
    max-height:88vh;
    object-fit:contain;
  }
  .tct-space-viewer-close,
  .tct-inspector-close {
    position:absolute;
    top:20px;
    right:20px;
    width:42px;
    height:42px;
    border:0;
    border-radius:50%;
    background:rgba(247,247,245,.10);
    color:#f7f7f5;
    cursor:pointer;
    backdrop-filter:blur(18px);
  }
  .tct-space-viewer-title {
    position:absolute;
    left:24px;
    bottom:22px;
    color:rgba(247,247,245,.66);
    font-size:.68rem;
  }

  .tct-plan-inspector {
    display:grid;
    grid-template-rows:auto 1fr;
  }
  .tct-inspector-toolbar {
    min-height:68px;
    display:flex;
    align-items:center;
    gap:10px;
    padding:12px 76px 12px 20px;
    background:rgba(18,18,18,.78);
    backdrop-filter:blur(20px);
    -webkit-backdrop-filter:blur(20px);
  }
  .tct-inspector-title {
    min-width:0;
    margin-right:auto;
    overflow:hidden;
    white-space:nowrap;
    text-overflow:ellipsis;
    font-size:.72rem;
    font-weight:500;
  }
  .tct-inspector-toolbar button {
    height:36px;
    min-width:36px;
    padding:0 12px;
    border:1px solid rgba(247,247,245,.15);
    border-radius:999px;
    background:rgba(247,247,245,.07);
    color:#f7f7f5;
    cursor:pointer;
    font-size:.68rem;
  }
  .tct-inspector-toolbar button:hover { background:rgba(247,247,245,.12); }
  .tct-inspector-zoom { min-width:52px; text-align:center; color:rgba(247,247,245,.6); font-size:.65rem; }
  .tct-inspector-stage {
    position:relative;
    min-width:0;
    min-height:0;
    overflow:hidden;
    touch-action:none;
    cursor:grab;
  }
  .tct-inspector-stage.is-dragging { cursor:grabbing; }
  .tct-inspector-wrap {
    position:absolute;
    inset:0;
    display:grid;
    place-items:center;
    transform-origin:center center;
    will-change:transform;
  }
  .tct-inspector-img {
    display:block;
    max-width:94vw;
    max-height:calc(100vh - 96px);
    user-select:none;
    -webkit-user-drag:none;
    pointer-events:none;
  }
  .tct-inspector-pdf {
    width:100%;
    height:100%;
    border:0;
    background:#fff;
  }

  @media (max-width:980px) {
    .tct-spaces-opening h1 { grid-column:3 / span 7; }
    .tct-spaces-opening > p { grid-column:10 / span 3; }
    .tct-spaces-lead-media { grid-column:1 / span 8; }
    .tct-space-story.is-media-left .tct-space-story-media { grid-column:1 / span 7; }
    .tct-space-story.is-media-left .tct-space-story-copy { grid-column:8 / -1; }
    .tct-space-story.is-media-right .tct-space-story-media { grid-column:6 / -1; }
    .tct-space-story.is-media-right .tct-space-story-copy { grid-column:1 / span 4; }
    .tct-space-detail-opening h1 { grid-column:3 / span 7; }
  }

  @media (max-width:720px) {
    .tct-spaces-page { padding-top:72px; padding-bottom:108px; }
    .tct-spaces-opening { display:block; min-height:auto; padding-bottom:92px; }
    .tct-spaces-opening-eyebrow { margin-bottom:36px; padding-top:0; }
    .tct-spaces-opening h1 { max-width:9.4ch; font-size:clamp(3rem,14.6vw,4.95rem); }
    .tct-spaces-opening > p { max-width:34rem; margin-top:34px; }

    .tct-spaces-lead { display:block; padding-bottom:112px; }
    .tct-spaces-lead-media { min-height:360px; }
    .tct-spaces-lead-copy { margin-top:36px; padding:0; }
    .tct-spaces-lead-copy h2 { max-width:10ch; font-size:clamp(2.35rem,11vw,3.9rem); }

    .tct-space-filters { gap:16px 22px; margin-bottom:86px; }

    .tct-spaces-sequence { gap:112px; }
    .tct-space-story,
    .tct-space-story.is-media-left,
    .tct-space-story.is-media-right,
    .tct-space-story.is-wide,
    .tct-space-story.is-document { display:block; }
    .tct-space-story.is-media-right .tct-space-story-media,
    .tct-space-story.is-media-right .tct-space-story-copy { order:initial; }
    .tct-space-story-media,
    .tct-space-story.is-wide .tct-space-story-media,
    .tct-space-story.is-document .tct-space-story-media { min-height:340px; }
    .tct-space-story-copy,
    .tct-space-story.is-wide .tct-space-story-copy { margin-top:32px; }
    .tct-space-story-copy h2 { max-width:10.5ch; font-size:clamp(2.2rem,10.5vw,3.65rem); }
    .tct-space-document-trigger,
    .tct-space-story.is-document .tct-space-document-trigger { min-height:340px; }

    .tct-space-back { margin-bottom:34px; }
    .tct-space-detail-opening { display:block; padding-bottom:72px; }
    .tct-space-detail-eyebrow { margin-bottom:34px; padding-top:0; }
    .tct-space-detail-opening h1 { max-width:9.5ch; font-size:clamp(3rem,14.5vw,4.9rem); }
    .tct-space-detail-opening > p { max-width:34rem; margin-top:34px; }

    .tct-space-detail-hero,
    .tct-space-detail-hero.is-inspectable,
    .tct-space-detail-hero .tct-space-document-trigger { min-height:360px; }

    .tct-space-status { display:block; padding:46px 0 104px; }
    .tct-space-status-signal { margin-bottom:24px; }
    .tct-space-inspect-link { margin-top:26px; }

    .tct-space-usages { display:block; padding-bottom:112px; }
    .tct-space-usages-head h2 { max-width:8.5ch; font-size:clamp(2.55rem,12vw,4.25rem); }
    .tct-space-usages-list { margin-top:54px; gap:34px; }

    .tct-space-detail-gallery { gap:58px; padding-bottom:112px; }
    .tct-space-detail-secondary:nth-child(odd),
    .tct-space-detail-secondary:nth-child(even) { width:100%; margin-left:0; }
    .tct-space-detail-secondary-button { min-height:340px; }

    .tct-space-related { display:block; padding-top:86px; }
    .tct-space-related-links { margin-top:52px; }
    .tct-space-related-links a { grid-template-columns:90px 1fr auto; }

    .tct-space-image-action { opacity:1; transform:none; }
    .tct-space-viewer { padding:50px 14px 36px; }
    .tct-space-viewer-close,
    .tct-inspector-close { top:12px; right:12px; }
    .tct-inspector-toolbar {
      min-height:62px;
      padding:10px 62px 10px 10px;
      gap:6px;
      overflow-x:auto;
    }
    .tct-inspector-title { display:none; }
    .tct-inspector-toolbar button { padding:0 10px; }
    .tct-inspector-img { max-width:98vw; max-height:calc(100vh - 76px); }
  }

  /* ACTUALITÉS v2.6 — chronology, not a corporate blog grid. */
  .tct-news-page { padding-top:clamp(84px,9vw,146px); padding-bottom:clamp(110px,12vw,180px); }

  .tct-news-opening {
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    column-gap:clamp(18px,2vw,32px);
    min-height:min(520px,60vh);
    align-items:start;
    padding-bottom:clamp(90px,10vw,150px);
  }
  .tct-news-opening-eyebrow {
    grid-column:1 / span 2;
    padding-top:.6rem;
    color:var(--tct-faint);
    text-transform:uppercase;
    letter-spacing:.14em;
    font-size:.59rem;
    font-weight:600;
  }
  .tct-news-opening h1 {
    grid-column:3 / span 7;
    margin:0;
    max-width:9.6ch;
    font-family:var(--tct-font-secondary,'Italiana'),Georgia,serif;
    font-size:clamp(3.35rem,6.4vw,6.8rem);
    line-height:.97;
    font-weight:400;
    letter-spacing:-.04em;
    text-wrap:balance;
  }
  .tct-news-opening > p {
    grid-column:10 / span 3;
    align-self:end;
    margin:0 0 .4rem;
    color:var(--tct-muted);
    font-size:clamp(.92rem,1vw,1rem);
    line-height:1.72;
  }

  .tct-news-lead {
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    column-gap:clamp(18px,2vw,32px);
    align-items:start;
    padding:clamp(24px,3vw,42px) 0 clamp(126px,13vw,196px);
  }
  .tct-news-lead-date {
    grid-column:1 / span 3;
    display:flex;
    flex-direction:column;
    align-items:flex-start;
    gap:16px;
  }
  .tct-news-lead-date > span,
  .tct-news-archive-head {
    color:var(--tct-faint);
    text-transform:uppercase;
    letter-spacing:.14em;
    font-size:.59rem;
    font-weight:600;
  }
  .tct-news-lead-date time {
    max-width:8ch;
    font-family:var(--tct-font-secondary,'Italiana'),Georgia,serif;
    font-size:clamp(2.65rem,4.8vw,5.1rem);
    line-height:.93;
    letter-spacing:-.045em;
  }
  .tct-news-lead-date em,
  .tct-news-row-date em,
  .tct-news-article-meta em {
    color:var(--tct-faint);
    font-size:.64rem;
    font-style:normal;
  }
  .tct-news-lead-copy { grid-column:5 / span 7; }
  .tct-news-tag,
  .tct-news-row-copy > span {
    color:var(--tct-expression-accent,var(--tct-ink));
    font-size:.62rem;
    font-weight:600;
    letter-spacing:.12em;
    text-transform:uppercase;
  }
  .tct-news-lead-copy h2 {
    margin:20px 0 0;
    max-width:12ch;
    font-size:clamp(2.4rem,4.3vw,4.8rem);
    line-height:.99;
    font-weight:400;
    letter-spacing:-.055em;
    text-wrap:balance;
  }
  .tct-news-lead-copy p {
    max-width:44rem;
    margin:28px 0 0;
    color:var(--tct-muted);
    font-size:clamp(.94rem,1vw,1.03rem);
    line-height:1.72;
  }
  .tct-news-lead-media {
    grid-column:5 / -1;
    margin-top:clamp(46px,6vw,84px);
    overflow:hidden;
  }
  .tct-news-lead-img {
    display:block;
    width:100%;
    max-height:72vh;
    object-fit:cover;
    transform:translate3d(0,var(--tct-media-drift,0px),0) scale(1.018);
    will-change:transform;
  }

  .tct-news-archive {
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    column-gap:clamp(18px,2vw,32px);
    align-items:start;
    padding:0 0 clamp(50px,6vw,90px);
  }
  .tct-news-archive-head {
    grid-column:1 / span 2;
    padding-top:.4rem;
  }
  .tct-news-archive-list {
    grid-column:4 / -1;
    display:grid;
    gap:clamp(70px,8vw,118px);
  }
  .tct-news-row {
    display:grid;
    grid-template-columns:3fr 7fr;
    gap:clamp(32px,4vw,70px);
    align-items:start;
  }
  .tct-news-row-date {
    display:flex;
    flex-direction:column;
    gap:10px;
  }
  .tct-news-row-date time {
    font-family:var(--tct-font-secondary,'Italiana'),Georgia,serif;
    font-size:clamp(1.7rem,2.8vw,2.9rem);
    line-height:1;
    letter-spacing:-.04em;
  }
  .tct-news-row-copy h3 {
    margin:14px 0 0;
    max-width:22ch;
    font-size:clamp(1.5rem,2.55vw,2.75rem);
    line-height:1.04;
    font-weight:450;
    letter-spacing:-.045em;
    text-wrap:balance;
  }
  .tct-news-row-copy h3 a { text-decoration:none; }
  .tct-news-row-copy h3 a:hover { text-decoration:underline; text-decoration-thickness:1px; text-underline-offset:5px; }
  .tct-news-row-copy p {
    max-width:42rem;
    margin:20px 0 0;
    color:var(--tct-muted);
    font-size:.88rem;
    line-height:1.68;
  }
  .tct-news-row-action {
    display:inline-flex;
    gap:7px;
    margin-top:19px;
    color:var(--tct-ink);
    text-decoration:none;
    font-size:.76rem;
    font-weight:500;
  }
  .tct-news-row-action span { transition:transform .22s ease; }
  .tct-news-row-action:hover span { transform:translateX(3px); }

  .tct-news-row.is-compact { gap:clamp(28px,4vw,64px); }
  .tct-news-row.is-compact .tct-news-row-date time { font-size:clamp(1.35rem,2.1vw,2.05rem); }
  .tct-news-row.is-compact .tct-news-row-copy h3 {
    max-width:28ch;
    margin-top:10px;
    font-size:clamp(1.18rem,1.7vw,1.75rem);
    line-height:1.12;
  }

  /* Article: wide opening, narrow reading column, date as composition. */
  .tct-news-article-shell { padding-top:0; }
  .tct-news-back {
    display:inline-flex;
    align-items:center;
    gap:10px;
    margin-bottom:clamp(34px,5.5vw,74px);
    color:var(--tct-muted);
    text-decoration:none;
    font-size:.72rem;
    font-weight:500;
  }
  .tct-news-back:hover { color:var(--tct-ink); }
  .tct-news-article-opening {
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    column-gap:clamp(18px,2vw,32px);
    padding-bottom:clamp(78px,9vw,136px);
  }
  .tct-news-article-meta {
    grid-column:1 / span 2;
    display:flex;
    flex-direction:column;
    align-items:flex-start;
    gap:12px;
    padding-top:.65rem;
    color:var(--tct-faint);
    font-size:.62rem;
    letter-spacing:.1em;
    text-transform:uppercase;
  }
  .tct-news-article-meta > span { color:var(--tct-expression-accent,var(--tct-ink)); font-weight:600; }
  .tct-news-article-meta time { color:var(--tct-muted); }
  .tct-news-article-meta em { text-transform:none; letter-spacing:0; }
  .tct-news-article-opening h1 {
    grid-column:3 / span 8;
    margin:0;
    max-width:12ch;
    font-family:var(--tct-font-secondary,'Italiana'),Georgia,serif;
    font-size:clamp(3.15rem,6.2vw,6.6rem);
    line-height:.97;
    font-weight:400;
    letter-spacing:-.042em;
    text-wrap:balance;
  }
  .tct-news-article-opening > p {
    grid-column:5 / span 6;
    margin:clamp(40px,5vw,72px) 0 0;
    color:var(--tct-muted);
    font-size:clamp(1rem,1.15vw,1.15rem);
    line-height:1.72;
  }
  .tct-news-article-media {
    margin:0 0 clamp(100px,11vw,170px);
  }
  .tct-news-article-media > div { overflow:hidden; }
  .tct-news-article-img {
    display:block;
    width:100%;
    max-height:82vh;
    object-fit:cover;
    transform:translate3d(0,var(--tct-media-drift,0px),0) scale(1.018);
    will-change:transform;
  }
  .tct-news-article-media figcaption {
    margin-top:12px;
    color:var(--tct-faint);
    font-size:.65rem;
  }

  .tct-news-article-body {
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    column-gap:clamp(18px,2vw,32px);
    align-items:start;
    padding-bottom:clamp(110px,12vw,178px);
  }
  .tct-news-article-date {
    grid-column:1 / span 3;
    position:sticky;
    top:110px;
  }
  .tct-news-article-date span {
    display:block;
    max-width:8ch;
    font-family:var(--tct-font-secondary,'Italiana'),Georgia,serif;
    font-size:clamp(2.3rem,4vw,4.1rem);
    line-height:.95;
    letter-spacing:-.045em;
    color:var(--tct-faint);
  }
  .tct-news-article-reading { grid-column:5 / span 6; }
  .tct-news-article-reading p {
    margin:0 0 1.7em;
    color:var(--tct-ink);
    font-size:clamp(1rem,1.06vw,1.08rem);
    line-height:1.82;
  }
  .tct-news-article-reading h2 {
    margin:clamp(62px,7vw,94px) 0 26px;
    font-size:clamp(1.55rem,2.2vw,2.25rem);
    line-height:1.1;
    font-weight:500;
    letter-spacing:-.035em;
    text-wrap:balance;
  }
  .tct-news-article-reading h2:first-child { margin-top:0; }

  .tct-news-article-reading strong { font-weight:700; }
  .tct-news-article-reading em { font-style:italic; }
  .tct-news-article-reading mark {
    padding:.08em .18em;
    border-radius:.18em;
    background:color-mix(in srgb,var(--tct-expression-accent,var(--tct-ink)) 13%,transparent);
    color:inherit;
  }
  .tct-news-article-reading a {
    color:inherit;
    text-decoration-thickness:1px;
    text-underline-offset:4px;
  }
  .tct-news-rich-list {
    margin:0 0 2em;
    padding-left:1.35em;
    color:var(--tct-ink);
    font-size:clamp(1rem,1.06vw,1.08rem);
    line-height:1.78;
  }
  .tct-news-rich-list li { margin:.42em 0; padding-left:.28em; }
  .tct-news-rich-list + h2 { margin-top:clamp(62px,7vw,94px); }
  .tct-news-inline-media,
  .tct-news-inline-gallery {
    margin:clamp(54px,6vw,82px) 0;
  }
  .tct-news-inline-image {
    display:block;
    width:100%;
    max-height:720px;
    object-fit:cover;
  }
  .tct-news-inline-media figcaption,
  .tct-news-inline-gallery figcaption {
    margin-top:12px;
    color:var(--tct-faint);
    font-size:.72rem;
    line-height:1.55;
  }
  .tct-news-inline-gallery-grid {
    display:grid;
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:clamp(8px,1.2vw,16px);
  }
  .tct-news-inline-gallery-grid > div:nth-child(3n+1):last-child { grid-column:1 / -1; }
  .tct-news-inline-gallery-image {
    display:block;
    width:100%;
    aspect-ratio:4/3;
    object-fit:cover;
  }
  .tct-news-inline-document {
    position:relative;
    margin:clamp(42px,5vw,70px) 0;
    border-top:1px solid color-mix(in srgb,var(--tct-ink) 10%,transparent);
    border-bottom:1px solid color-mix(in srgb,var(--tct-ink) 10%,transparent);
  }
  .tct-news-document-open {
    width:100%;
    min-height:124px;
    padding:22px 116px 22px 0;
    display:grid;
    gap:7px;
    border:0;
    background:transparent;
    color:var(--tct-ink);
    text-align:left;
    cursor:pointer;
  }
  .tct-news-document-kicker {
    color:var(--tct-faint);
    font-size:.58rem;
    font-weight:600;
    letter-spacing:.13em;
    text-transform:uppercase;
  }
  .tct-news-document-open strong { max-width:34rem; font-size:1rem; font-weight:600; line-height:1.35; }
  .tct-news-document-open p {
    max-width:36rem;
    margin:0;
    color:var(--tct-muted);
    font-size:.78rem;
    line-height:1.55;
  }
  .tct-news-document-open em {
    margin-top:7px;
    color:var(--tct-muted);
    font-size:.72rem;
    font-style:normal;
    transition:transform .22s ease;
  }
  .tct-news-document-open:hover em { transform:translateX(3px); }
  .tct-news-document-download {
    position:absolute;
    right:0;
    top:50%;
    transform:translateY(-50%);
    color:var(--tct-muted);
    font-size:.68rem;
    text-decoration:none;
  }
  .tct-news-document-download:hover { color:var(--tct-ink); text-decoration:underline; text-underline-offset:4px; }
  @media (max-width:720px) {
    .tct-news-inline-gallery-grid { grid-template-columns:1fr; }
    .tct-news-inline-gallery-grid > div:nth-child(3n+1):last-child { grid-column:auto; }
  }

  .tct-pdf-reader {
    position:fixed;
    inset:0;
    z-index:10020;
    display:grid;
    grid-template-rows:auto minmax(0,1fr);
    background:var(--tct-canvas,#f7f7f5);
    color:var(--tct-ink,#1e1d1e);
  }
  .tct-pdf-reader-bar {
    position:relative;
    z-index:2;
    min-height:66px;
    display:grid;
    grid-template-columns:minmax(0,1fr) auto;
    align-items:center;
    gap:18px;
    padding:10px clamp(14px,2.2vw,30px);
    border-bottom:1px solid color-mix(in srgb,var(--tct-ink) 9%,transparent);
    background:color-mix(in srgb,var(--tct-canvas) 88%,transparent);
    backdrop-filter:blur(24px);
    -webkit-backdrop-filter:blur(24px);
  }
  .tct-pdf-reader-left { min-width:0; display:flex; align-items:center; gap:14px; }
  .tct-pdf-reader-back,
  .tct-pdf-reader-action {
    min-height:36px;
    padding:0 13px;
    border:0;
    border-radius:999px;
    background:color-mix(in srgb,var(--tct-ink) 6%,transparent);
    color:var(--tct-ink);
    cursor:pointer;
    font:inherit;
    font-size:.66rem;
    text-decoration:none;
  }
  .tct-pdf-reader-back:hover,
  .tct-pdf-reader-action:hover { background:color-mix(in srgb,var(--tct-ink) 10%,transparent); }
  .tct-pdf-reader-title {
    min-width:0;
    overflow:hidden;
    white-space:nowrap;
    text-overflow:ellipsis;
    font-size:.72rem;
    font-weight:600;
  }
  .tct-pdf-reader-actions { display:flex; align-items:center; gap:8px; }
  .tct-pdf-reader-stage { min-width:0; min-height:0; overflow:hidden; background:#e9e9e6; }
  .tct-pdf-reader-frame { width:100%; height:100%; border:0; background:#fff; }
  @media (max-width:720px) {
    .tct-news-document-open { padding-right:0; padding-bottom:54px; }
    .tct-news-document-download { top:auto; right:auto; left:0; bottom:20px; transform:none; }
    .tct-pdf-reader-bar { min-height:58px; grid-template-columns:minmax(0,1fr) auto; padding:8px 10px; }
    .tct-pdf-reader-left { gap:8px; }
    .tct-pdf-reader-title { font-size:.64rem; }
    .tct-pdf-reader-action[data-pdf-fullscreen] { display:none; }
    .tct-pdf-reader-action { padding:0 10px; }
  }

  .tct-news-article-exit {
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    column-gap:clamp(18px,2vw,32px);
    align-items:end;
    padding:clamp(90px,10vw,150px) 0 clamp(20px,3vw,46px);
  }
  .tct-news-article-exit > div:first-child { grid-column:1 / span 6; }
  .tct-news-article-exit > div:first-child > span {
    color:var(--tct-faint);
    font-size:.59rem;
    font-weight:600;
    letter-spacing:.14em;
    text-transform:uppercase;
  }
  .tct-news-article-exit h2 {
    max-width:10ch;
    margin:22px 0 0;
    font-family:var(--tct-font-secondary,'Italiana'),Georgia,serif;
    font-size:clamp(2.4rem,4.4vw,4.8rem);
    line-height:1;
    font-weight:400;
    letter-spacing:-.04em;
  }
  .tct-news-article-exit-links {
    grid-column:8 / -1;
    display:flex;
    flex-direction:column;
    align-items:flex-start;
    padding-bottom:.35rem;
  }
  .tct-news-next-story { max-width:34rem; line-height:1.45; }

  @media (max-width:980px) {
    .tct-news-opening h1 { grid-column:3 / span 7; }
    .tct-news-opening > p { grid-column:10 / span 3; }
    .tct-news-lead-copy { grid-column:5 / -1; }
    .tct-news-archive-list { grid-column:4 / -1; }
    .tct-news-article-opening h1 { grid-column:3 / -1; }
    .tct-news-article-opening > p { grid-column:4 / span 7; }
    .tct-news-article-reading { grid-column:4 / span 7; }
  }

  @media (max-width:720px) {
    .tct-news-page { padding-top:72px; padding-bottom:108px; }
    .tct-news-opening { display:block; min-height:auto; padding-bottom:94px; }
    .tct-news-opening-eyebrow { margin-bottom:36px; padding-top:0; }
    .tct-news-opening h1 { max-width:9ch; font-size:clamp(3rem,14.6vw,4.95rem); }
    .tct-news-opening > p { max-width:34rem; margin-top:34px; }

    .tct-news-lead { display:block; padding:12px 0 112px; }
    .tct-news-lead-date { gap:12px; margin-bottom:42px; }
    .tct-news-lead-date time { max-width:none; font-size:clamp(2.6rem,13vw,4rem); }
    .tct-news-lead-copy h2 { max-width:11ch; font-size:clamp(2.45rem,11.7vw,4.1rem); }
    .tct-news-lead-copy p { margin-top:24px; }
    .tct-news-lead-media { margin-top:52px; }

    .tct-news-archive { display:block; padding-bottom:30px; }
    .tct-news-archive-head { margin-bottom:52px; padding-top:0; }
    .tct-news-archive-list { gap:74px; }
    .tct-news-row { display:block; }
    .tct-news-row-date { margin-bottom:22px; }
    .tct-news-row-date time,
    .tct-news-row.is-compact .tct-news-row-date time { font-size:clamp(1.75rem,8vw,2.5rem); }
    .tct-news-row-copy h3,
    .tct-news-row.is-compact .tct-news-row-copy h3 { max-width:20ch; font-size:clamp(1.5rem,7vw,2.25rem); }

    .tct-news-back { margin-bottom:36px; }
    .tct-news-article-opening { display:block; padding-bottom:78px; }
    .tct-news-article-meta { margin-bottom:38px; padding-top:0; }
    .tct-news-article-opening h1 { max-width:10.8ch; font-size:clamp(3rem,14vw,4.85rem); }
    .tct-news-article-opening > p { margin-top:36px; }
    .tct-news-article-media { margin-bottom:86px; }

    .tct-news-article-body { display:block; padding-bottom:100px; }
    .tct-news-article-date { position:static; margin-bottom:54px; }
    .tct-news-article-date span { max-width:none; font-size:clamp(2.35rem,11vw,3.7rem); }
    .tct-news-article-reading h2 { margin-top:62px; }

    .tct-news-article-exit { display:block; padding-top:86px; }
    .tct-news-article-exit-links { margin-top:52px; padding-bottom:0; }
  }

  /* Transitional styles for existing sections. Their full Experience v2
     direction remains deferred until Home is approved. */
  .tct-intro { max-width:760px; margin-bottom:44px; }
  .tct-intro h2 { margin:14px 0 0; font-family:var(--tct-font-secondary,'Italiana'), Georgia, serif; font-size:clamp(2.7rem,5vw,5.2rem); line-height:1; font-weight:400; letter-spacing:-.035em; }
  .tct-desc { max-width:620px; margin:22px 0 0; color:var(--tct-muted); line-height:1.7; }
  .tct-grid, .tct-list { list-style:none; padding:0; margin:28px 0 0; display:grid; gap:16px; }
  .tct-grid { grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); }
  .tct-card, .tct-person { background:var(--tct-paper); border:1px solid var(--tct-hairline-soft); padding:20px; }
  .tct-card-img, .tct-person-photo { width:100%; margin-bottom:14px; object-fit:cover; max-height:220px; cursor:zoom-in; }
  .tct-card-tag { margin-bottom:6px; color:var(--tct-muted); text-transform:uppercase; letter-spacing:.09em; font-size:.66rem; }
  .tct-empty { color:var(--tct-muted); font-style:italic; }
  .tct-filters { display:flex; flex-wrap:wrap; gap:8px; margin:18px 0 0; }
  .tct-filter-pill { padding:7px 13px; border:1px solid var(--tct-hairline); border-radius:999px; background:transparent; cursor:pointer; font-size:.74rem; }
  .tct-filter-pill.is-active { background:var(--tct-ink); border-color:var(--tct-ink); color:var(--tct-canvas); }
  .tct-pdf-chip { display:flex; align-items:center; gap:8px; padding:20px; margin-bottom:10px; background:rgba(255,255,255,.6); text-decoration:none; }
  .tct-pdf-icon { padding:2px 6px; background:#9d312b; color:#fff; font-size:.62rem; font-weight:700; }
  .tct-article-toggle { width:100%; display:flex; justify-content:space-between; gap:20px; padding:0; border:0; background:none; cursor:pointer; text-align:left; color:inherit; }
  .tct-article-body { margin-top:18px; padding-top:18px; border-top:1px solid var(--tct-hairline-soft); color:var(--tct-muted); line-height:1.75; white-space:pre-line; }
  .tct-roster-label { margin-top:8px; color:var(--tct-muted); font-size:.82rem; }
  .tct-cta { margin-top:30px; padding:22px 0; border-top:1px solid var(--tct-hairline); }
  .tct-team-parella { margin-top:42px; padding-top:28px; border-top:1px solid var(--tct-hairline); }


  /* QUESTIONS v2.8 — resolution first; interface recedes behind language. */
  .tct-questions-page {
    padding-top:clamp(82px,8vw,132px);
    padding-bottom:clamp(110px,12vw,178px);
  }

  .tct-questions-opening {
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    column-gap:clamp(18px,2vw,32px);
    align-items:start;
    padding-bottom:clamp(72px,8vw,118px);
  }
  .tct-questions-opening-eyebrow {
    grid-column:1 / span 2;
    padding-top:.58rem;
    color:var(--tct-faint);
    text-transform:uppercase;
    letter-spacing:.14em;
    font-size:.59rem;
    font-weight:600;
  }
  .tct-questions-opening h1 {
    grid-column:3 / span 7;
    margin:0;
    max-width:10ch;
    font-family:var(--tct-font-secondary,'Italiana'),Georgia,serif;
    font-size:clamp(3.25rem,6.1vw,6.5rem);
    line-height:.97;
    font-weight:400;
    letter-spacing:-.04em;
    text-wrap:balance;
  }
  .tct-questions-opening > p {
    grid-column:10 / span 3;
    align-self:end;
    margin:0 0 .4rem;
    color:var(--tct-muted);
    font-size:clamp(.92rem,1vw,1rem);
    line-height:1.72;
  }

  .tct-question-workbench {
    width:min(980px,76vw);
    margin:0 auto;
    padding:clamp(32px,4vw,54px) 0 clamp(78px,8vw,120px);
  }
  .tct-question-workbench > label {
    display:block;
    margin-bottom:22px;
    color:var(--tct-faint);
    text-transform:uppercase;
    letter-spacing:.14em;
    font-size:.59rem;
    font-weight:600;
  }
  .tct-question-input-line {
    display:grid;
    grid-template-columns:1fr auto;
    align-items:center;
    border-bottom:1px solid color-mix(in srgb,var(--tct-ink) 28%,transparent);
    transition:border-color .24s ease;
  }
  .tct-question-input-line:focus-within {
    border-bottom-color:var(--tct-ink);
  }
  .tct-question-input-line input {
    width:100%;
    min-width:0;
    padding:0 24px 18px 0;
    border:0;
    outline:0;
    background:transparent;
    color:var(--tct-ink);
    font-family:var(--tct-font-primary,'Roboto'),sans-serif;
    font-size:clamp(1.8rem,3.2vw,3.35rem);
    line-height:1.08;
    font-weight:400;
    letter-spacing:-.045em;
  }
  .tct-question-input-line input::placeholder {
    color:color-mix(in srgb,var(--tct-ink) 26%,transparent);
  }
  .tct-question-input-line button {
    width:48px;
    height:48px;
    display:grid;
    place-items:center;
    margin-bottom:12px;
    padding:0;
    border:0;
    border-radius:50%;
    background:var(--tct-ink);
    color:var(--tct-canvas);
    cursor:pointer;
    font-size:1rem;
    transition:transform .22s cubic-bezier(.16,1,.3,1),background .22s ease;
  }
  .tct-question-input-line button:hover { transform:translateX(3px); }
  .tct-question-input-line button:focus-visible {
    outline:2px solid var(--tct-expression-accent,var(--tct-ink));
    outline-offset:4px;
  }

  .tct-question-examples {
    display:flex;
    flex-wrap:wrap;
    gap:5px 8px;
    margin:18px 0 0;
    color:var(--tct-faint);
    font-size:.68rem;
    line-height:1.55;
  }
  .tct-question-examples button {
    padding:0;
    border:0;
    background:transparent;
    color:var(--tct-muted);
    cursor:pointer;
    font:inherit;
    text-decoration:underline;
    text-decoration-color:transparent;
    text-underline-offset:4px;
    transition:color .18s ease,text-decoration-color .18s ease;
  }
  .tct-question-examples button:hover {
    color:var(--tct-ink);
    text-decoration-color:currentColor;
  }

  .tct-question-result {
    scroll-margin-top:120px;
    padding:clamp(34px,4vw,58px) 0 clamp(116px,12vw,176px);
  }
  .tct-question-answer,
  .tct-question-ambiguity,
  .tct-question-unknown {
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    column-gap:clamp(18px,2vw,32px);
    align-items:start;
  }
  .tct-question-state {
    grid-column:1 / span 3;
    display:flex;
    align-items:center;
    gap:11px;
    padding-top:.35rem;
    color:var(--tct-faint);
    font-size:.61rem;
    font-weight:600;
    letter-spacing:.11em;
    text-transform:uppercase;
  }
  .tct-question-state i {
    width:8px;
    height:8px;
    border-radius:50%;
    background:var(--tct-expression-accent,var(--tct-ink));
    box-shadow:0 0 0 6px color-mix(in srgb,var(--tct-expression-accent,var(--tct-ink)) 9%,transparent);
  }
  .tct-question-answer-main,
  .tct-question-ambiguity-main,
  .tct-question-unknown-main { grid-column:4 / span 7; }

  .tct-question-answer h2,
  .tct-question-ambiguity h2,
  .tct-question-unknown h2 {
    max-width:14ch;
    margin:0;
    font-family:var(--tct-font-secondary,'Italiana'),Georgia,serif;
    font-size:clamp(2.6rem,4.7vw,5.15rem);
    line-height:1;
    font-weight:400;
    letter-spacing:-.04em;
    text-wrap:balance;
  }
  .tct-question-answer-body {
    max-width:700px;
    margin-top:34px;
  }
  .tct-question-answer-body p {
    margin:0 0 1.25em;
    color:var(--tct-ink);
    font-size:clamp(.98rem,1.05vw,1.08rem);
    line-height:1.78;
  }
  .tct-question-answer-note {
    max-width:620px;
    margin:30px 0 0;
    padding-left:20px;
    border-left:1px solid color-mix(in srgb,var(--tct-expression-accent,var(--tct-ink)) 42%,transparent);
    color:var(--tct-muted);
    font-size:.78rem;
    line-height:1.65;
  }
  .tct-question-answer-actions {
    display:flex;
    flex-wrap:wrap;
    align-items:baseline;
    gap:24px;
    margin-top:38px;
  }
  .tct-question-answer-actions .tct-text-link {
    margin-top:0;
    line-height:1.35;
  }
  .tct-question-answer-actions button {
    padding:0;
    border:0;
    background:transparent;
    color:var(--tct-muted);
    cursor:pointer;
    font-size:.79rem;
    line-height:1.35;
  }
  .tct-question-answer-actions button:hover { color:var(--tct-ink); }

  .tct-question-ambiguity-main > p,
  .tct-question-unknown-main > p {
    max-width:600px;
    margin:28px 0 0;
    color:var(--tct-muted);
    font-size:.94rem;
    line-height:1.7;
  }
  .tct-question-candidates {
    list-style:none;
    margin:44px 0 0;
    padding:0;
    display:grid;
    gap:24px;
  }
  .tct-question-candidates button {
    width:100%;
    display:grid;
    grid-template-columns:1fr auto;
    gap:20px;
    align-items:baseline;
    padding:0 0 17px;
    border:0;
    border-bottom:1px solid var(--tct-hairline-soft);
    background:transparent;
    color:var(--tct-ink);
    cursor:pointer;
    text-align:left;
  }
  .tct-question-candidates strong {
    font-size:clamp(1rem,1.25vw,1.25rem);
    line-height:1.25;
    font-weight:500;
    letter-spacing:-.025em;
  }
  .tct-question-candidates em {
    font-style:normal;
    transition:transform .2s ease;
  }
  .tct-question-candidates button:hover em { transform:translateX(4px); }

  .tct-question-transmit {
    display:inline-flex;
    gap:8px;
    margin-top:34px;
    padding:0 0 5px;
    border:0;
    border-bottom:1px solid var(--tct-ink);
    background:transparent;
    color:var(--tct-ink);
    cursor:pointer;
    font-size:.78rem;
    font-weight:500;
  }

  .tct-question-contact {
    scroll-margin-top:112px;
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    column-gap:clamp(18px,2vw,32px);
    padding:clamp(78px,9vw,132px) 0 clamp(128px,13vw,194px);
  }
  .tct-question-contact[hidden] { display:none; }
  .tct-question-contact-intro { grid-column:1 / span 4; }
  .tct-question-contact-intro > span,
  .tct-featured-questions-heading > span {
    color:var(--tct-faint);
    font-size:.59rem;
    font-weight:600;
    letter-spacing:.14em;
    text-transform:uppercase;
  }
  .tct-question-contact-intro h2 {
    max-width:9ch;
    margin:21px 0 0;
    font-family:var(--tct-font-secondary,'Italiana'),Georgia,serif;
    font-size:clamp(2.2rem,3.8vw,4.15rem);
    line-height:1;
    font-weight:400;
    letter-spacing:-.04em;
  }
  .tct-question-contact-intro p {
    max-width:24rem;
    margin:24px 0 0;
    color:var(--tct-muted);
    font-size:.8rem;
    line-height:1.65;
  }
  .tct-question-contact-form {
    grid-column:6 / -1;
    display:grid;
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:34px 28px;
  }
  .tct-question-contact-form label {
    display:flex;
    flex-direction:column;
    gap:10px;
    color:var(--tct-faint);
    font-size:.62rem;
  }
  .tct-question-contact-form label.is-wide { grid-column:1 / -1; }
  .tct-question-contact-form input,
  .tct-question-contact-form textarea {
    width:100%;
    padding:10px 0 12px;
    border:0;
    border-bottom:1px solid var(--tct-hairline);
    border-radius:0;
    outline:0;
    background:transparent;
    color:var(--tct-ink);
    font:inherit;
    font-size:.92rem;
    line-height:1.55;
    resize:vertical;
  }
  .tct-question-contact-form input:focus,
  .tct-question-contact-form textarea:focus { border-bottom-color:var(--tct-ink); }
  .tct-question-contact-form > button {
    grid-column:1 / -1;
    justify-self:start;
    display:inline-flex;
    gap:10px;
    padding:0 0 6px;
    border:0;
    border-bottom:1px solid var(--tct-ink);
    background:transparent;
    color:var(--tct-ink);
    cursor:pointer;
    font-size:.78rem;
    font-weight:500;
  }
  .tct-question-contact-status {
    grid-column:6 / -1;
    margin:28px 0 0;
    color:var(--tct-muted);
    font-size:.8rem;
  }

  .tct-featured-questions {
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    column-gap:clamp(18px,2vw,32px);
    align-items:start;
    padding:clamp(48px,6vw,88px) 0 26px;
  }
  .tct-featured-questions-heading { grid-column:1 / span 4; }
  .tct-featured-questions-heading h2 {
    max-width:10ch;
    margin:21px 0 0;
    font-family:var(--tct-font-secondary,'Italiana'),Georgia,serif;
    font-size:clamp(2.2rem,3.7vw,4rem);
    line-height:1;
    font-weight:400;
    letter-spacing:-.04em;
  }
  .tct-featured-questions ol {
    grid-column:6 / -1;
    list-style:none;
    margin:0;
    padding:0;
    display:grid;
    gap:0;
  }
  .tct-featured-questions li button {
    width:100%;
    display:grid;
    grid-template-columns:46px 1fr auto;
    gap:18px;
    align-items:baseline;
    padding:0 0 22px;
    margin:0 0 24px;
    border:0;
    border-bottom:1px solid var(--tct-hairline-soft);
    background:transparent;
    color:var(--tct-ink);
    cursor:pointer;
    text-align:left;
  }
  .tct-featured-questions li button > span {
    color:var(--tct-faint);
    font-family:var(--tct-font-secondary,'Italiana'),Georgia,serif;
    font-size:.92rem;
  }
  .tct-featured-questions li strong {
    max-width:30ch;
    font-size:clamp(1rem,1.2vw,1.2rem);
    line-height:1.28;
    font-weight:500;
    letter-spacing:-.025em;
  }
  .tct-featured-questions li em {
    font-style:normal;
    transition:transform .2s ease;
  }
  .tct-featured-questions li button:hover em { transform:translateX(4px); }

  @media (max-width:980px) {
    .tct-questions-opening h1 { grid-column:3 / span 7; }
    .tct-question-workbench { width:min(880px,82vw); }
    .tct-question-answer-main,
    .tct-question-ambiguity-main,
    .tct-question-unknown-main { grid-column:4 / span 8; }
  }

  @media (max-width:720px) {
    .tct-questions-page { padding-top:72px; padding-bottom:106px; }
    .tct-questions-opening { display:block; padding-bottom:64px; }
    .tct-questions-opening-eyebrow { margin-bottom:34px; padding-top:0; }
    .tct-questions-opening h1 { max-width:9.5ch; font-size:clamp(3rem,14vw,4.8rem); }
    .tct-questions-opening > p { max-width:33rem; margin-top:32px; }

    .tct-question-workbench { width:100%; margin:0; padding:20px 0 82px; }
    .tct-question-workbench > label { margin-bottom:18px; }
    .tct-question-input-line input {
      padding-right:14px;
      font-size:clamp(1.72rem,8.8vw,2.65rem);
    }
    .tct-question-input-line button { width:44px; height:44px; }
    .tct-question-examples { margin-top:16px; gap:5px 7px; }

    .tct-question-result { padding:26px 0 98px; scroll-margin-top:88px; }
    .tct-question-answer,
    .tct-question-ambiguity,
    .tct-question-unknown { display:block; }
    .tct-question-state { margin-bottom:34px; padding-top:0; }
    .tct-question-answer h2,
    .tct-question-ambiguity h2,
    .tct-question-unknown h2 { max-width:10.5ch; font-size:clamp(2.7rem,12.5vw,4.45rem); }
    .tct-question-answer-body { margin-top:28px; }
    .tct-question-answer-actions { gap:18px 24px; margin-top:32px; }

    .tct-question-contact { display:block; padding:74px 0 112px; }
    .tct-question-contact-intro h2 { max-width:9.5ch; font-size:clamp(2.4rem,11vw,3.9rem); }
    .tct-question-contact-form { grid-template-columns:1fr; margin-top:54px; gap:28px; }
    .tct-question-contact-form label.is-wide { grid-column:auto; }
    .tct-question-contact-form > button { grid-column:auto; }
    .tct-question-contact-status { margin-top:24px; }

    .tct-featured-questions { display:block; padding-top:38px; }
    .tct-featured-questions-heading h2 { max-width:9.5ch; font-size:clamp(2.4rem,11vw,3.9rem); }
    .tct-featured-questions ol { margin-top:54px; }
    .tct-featured-questions li button { grid-template-columns:34px 1fr auto; gap:12px; }
  }


  /* AMBASSADEURS v2.9 — human presence, not an HR directory. */
  .tct-ambassadors-page {
    padding-top:clamp(84px,9vw,144px);
    padding-bottom:clamp(110px,12vw,178px);
  }

  .tct-ambassadors-opening {
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    column-gap:clamp(18px,2vw,32px);
    min-height:min(520px,60vh);
    align-items:start;
    padding-bottom:clamp(92px,10vw,150px);
  }
  .tct-ambassadors-opening-eyebrow {
    grid-column:1 / span 2;
    padding-top:.6rem;
    color:var(--tct-faint);
    font-size:.59rem;
    font-weight:600;
    letter-spacing:.14em;
    text-transform:uppercase;
  }
  .tct-ambassadors-opening h1 {
    grid-column:3 / span 7;
    max-width:10.2ch;
    margin:0;
    font-family:var(--tct-font-secondary,'Italiana'),Georgia,serif;
    font-size:clamp(3.35rem,6.35vw,6.8rem);
    line-height:.97;
    font-weight:400;
    letter-spacing:-.042em;
    text-wrap:balance;
  }
  .tct-ambassadors-opening > p {
    grid-column:10 / span 3;
    align-self:end;
    margin:0 0 .4rem;
    color:var(--tct-muted);
    font-size:clamp(.92rem,1vw,1rem);
    line-height:1.72;
  }

  .tct-ambassadors-role {
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    column-gap:clamp(18px,2vw,32px);
    align-items:start;
    padding:clamp(18px,3vw,42px) 0 clamp(118px,13vw,192px);
  }
  .tct-ambassadors-role-kicker {
    grid-column:1 / span 2;
    padding-top:.5rem;
    color:var(--tct-faint);
    font-size:.59rem;
    font-weight:600;
    letter-spacing:.14em;
    text-transform:uppercase;
  }
  .tct-ambassadors-role-content { grid-column:4 / span 7; }
  .tct-ambassadors-role-content h2 {
    max-width:11ch;
    margin:0;
    font-size:clamp(2.1rem,3.5vw,3.8rem);
    line-height:1.04;
    font-weight:450;
    letter-spacing:-.048em;
    text-wrap:balance;
  }
  .tct-ambassadors-role-body {
    max-width:700px;
    margin-top:32px;
  }
  .tct-ambassadors-role-body p {
    margin:0 0 1.45em;
    color:var(--tct-muted);
    font-size:clamp(.94rem,1vw,1.03rem);
    line-height:1.76;
  }
  .tct-ambassadors-role-body strong {
    color:var(--tct-ink);
    font-weight:500;
  }

  .tct-ambassadors-roster { padding:0 0 clamp(126px,14vw,210px); }
  .tct-ambassadors-roster-head {
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    column-gap:clamp(18px,2vw,32px);
    align-items:end;
    margin-bottom:clamp(64px,7vw,104px);
  }
  .tct-ambassadors-count {
    grid-column:1 / span 5;
    display:flex;
    align-items:baseline;
    gap:20px;
  }
  .tct-ambassadors-count strong {
    font-family:var(--tct-font-secondary,'Italiana'),Georgia,serif;
    font-size:clamp(4rem,8vw,8.6rem);
    line-height:.78;
    font-weight:400;
    letter-spacing:-.06em;
  }
  .tct-ambassadors-count span {
    max-width:15rem;
    color:var(--tct-muted);
    font-size:.69rem;
    line-height:1.5;
    text-transform:uppercase;
    letter-spacing:.1em;
  }

  .tct-ambassadors-search {
    grid-column:8 / -1;
    display:block;
  }
  .tct-ambassadors-search > span {
    display:block;
    margin-bottom:13px;
    color:var(--tct-faint);
    font-size:.59rem;
    font-weight:600;
    letter-spacing:.12em;
    text-transform:uppercase;
  }
  .tct-ambassadors-search input {
    width:100%;
    padding:0 0 12px;
    border:0;
    border-bottom:1px solid var(--tct-hairline);
    outline:0;
    background:transparent;
    color:var(--tct-ink);
    font-size:1rem;
  }
  .tct-ambassadors-search input:focus { border-bottom-color:var(--tct-ink); }
  .tct-ambassadors-search input::placeholder { color:var(--tct-faint); }

  .tct-ambassadors-list {
    list-style:none;
    margin:0;
    padding:0;
    display:grid;
    grid-template-columns:repeat(3,minmax(0,1fr));
    gap:clamp(66px,8vw,112px) clamp(34px,4vw,66px);
    align-items:start;
  }
  .tct-ambassador-person {
    min-width:0;
    display:grid;
    grid-template-rows:auto auto;
    gap:18px;
  }
  .tct-ambassador-person[hidden] { display:none; }
  .tct-ambassador-person:nth-child(3n+2) { padding-top:clamp(26px,3vw,48px); }

  .tct-ambassador-person-visual {
    width:100%;
    aspect-ratio:4 / 5;
    overflow:hidden;
  }
  .tct-ambassador-person-photo {
    display:block;
    width:100%;
    height:100%;
    object-fit:cover;
  }
  .tct-ambassador-person-monogram {
    width:100%;
    height:100%;
    display:flex;
    align-items:flex-end;
    padding:clamp(18px,2vw,28px);
    background:var(--tct-soft);
    color:color-mix(in srgb,var(--tct-ink) 42%,transparent);
    font-family:var(--tct-font-secondary,'Italiana'),Georgia,serif;
    font-size:clamp(3.2rem,6vw,6.4rem);
    line-height:.8;
    letter-spacing:-.055em;
  }

  .tct-ambassador-person-copy {
    display:grid;
    grid-template-columns:32px 1fr;
    gap:10px;
    align-items:start;
  }
  .tct-ambassador-person-copy > span {
    padding-top:3px;
    color:var(--tct-faint);
    font-family:var(--tct-font-secondary,'Italiana'),Georgia,serif;
    font-size:.88rem;
  }
  .tct-ambassador-person-copy strong {
    display:block;
    font-size:clamp(1rem,1.2vw,1.16rem);
    line-height:1.2;
    font-weight:500;
    letter-spacing:-.025em;
  }
  .tct-ambassador-person-copy p {
    margin:7px 0 0;
    color:var(--tct-muted);
    font-size:.72rem;
    line-height:1.48;
  }
  .tct-ambassador-person-copy em {
    display:block;
    margin-top:8px;
    color:var(--tct-faint);
    font-size:.61rem;
    font-style:normal;
    letter-spacing:.08em;
    text-transform:uppercase;
  }
  .tct-ambassador-contact {
    display:inline-flex;
    align-items:baseline;
    gap:7px;
    margin-top:14px;
    color:var(--tct-ink);
    font-size:.7rem;
    font-weight:500;
    line-height:1.35;
    text-decoration:none;
  }
  .tct-ambassador-contact span {
    transition:transform .2s ease;
  }
  .tct-ambassador-contact:hover span,
  .tct-ambassador-contact:focus-visible span {
    transform:translateX(3px);
  }
  .tct-ambassador-contact:focus-visible {
    outline:1px solid var(--tct-expression-accent,var(--tct-ink));
    outline-offset:4px;
  }
  .tct-ambassadors-no-result {
    max-width:34rem;
    margin:0;
    color:var(--tct-muted);
    font-size:.88rem;
  }

  .tct-ambassadors-cta {
    width:100vw;
    margin-left:calc(50% - 50vw);
    display:grid;
    grid-template-columns:minmax(0,1fr) minmax(0,1fr);
    gap:clamp(42px,6vw,96px);
    align-items:end;
    padding:clamp(92px,10vw,148px) max(32px,calc((100vw - 1420px)/2));
    background:var(--tct-soft-2);
  }
  .tct-ambassadors-cta > div:first-child > span {
    color:var(--tct-faint);
    font-size:.59rem;
    font-weight:600;
    letter-spacing:.14em;
    text-transform:uppercase;
  }
  .tct-ambassadors-cta h2 {
    max-width:10ch;
    margin:22px 0 0;
    font-family:var(--tct-font-secondary,'Italiana'),Georgia,serif;
    font-size:clamp(2.45rem,4.4vw,4.9rem);
    line-height:1;
    font-weight:400;
    letter-spacing:-.04em;
  }
  .tct-ambassadors-cta > div:last-child {
    max-width:580px;
    justify-self:end;
  }
  .tct-ambassadors-cta p {
    margin:0;
    color:var(--tct-muted);
    font-size:.9rem;
    line-height:1.7;
  }

  .tct-ambassador-join-trigger {
    display:inline-flex;
    align-items:baseline;
    gap:9px;
    margin-top:26px;
    padding:0 0 6px;
    border:0;
    border-bottom:1px solid var(--tct-ink);
    background:transparent;
    color:var(--tct-ink);
    cursor:pointer;
    font-size:.79rem;
    font-weight:500;
  }
  .tct-ambassador-join-trigger span {
    transition:transform .2s ease;
  }
  .tct-ambassador-join-trigger:hover span,
  .tct-ambassador-join-trigger:focus-visible span {
    transform:translateX(3px);
  }

  .tct-ambassador-join-panel {
    grid-column:1 / -1;
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    column-gap:clamp(18px,2vw,32px);
    margin-top:clamp(66px,8vw,112px);
    padding-top:clamp(58px,7vw,96px);
    border-top:1px solid color-mix(in srgb,var(--tct-ink) 11%,transparent);
  }
  .tct-ambassador-join-panel[hidden] { display:none; }

  .tct-ambassador-join-panel-heading {
    grid-column:1 / span 4;
  }
  .tct-ambassador-join-panel-heading > span {
    color:var(--tct-faint);
    font-size:.59rem;
    font-weight:600;
    letter-spacing:.14em;
    text-transform:uppercase;
  }
  .tct-ambassador-join-panel-heading h3 {
    max-width:10ch;
    margin:20px 0 0;
    font-family:var(--tct-font-secondary,'Italiana'),Georgia,serif;
    font-size:clamp(2rem,3.5vw,3.8rem);
    line-height:1;
    font-weight:400;
    letter-spacing:-.04em;
  }

  .tct-ambassador-join-form {
    grid-column:6 / -1;
    display:grid;
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:32px 28px;
  }
  .tct-ambassador-join-form label {
    display:flex;
    flex-direction:column;
    gap:9px;
    color:var(--tct-faint);
    font-size:.62rem;
  }
  .tct-ambassador-join-form label > span {
    color:var(--tct-faint);
    font-size:.58rem;
  }
  .tct-ambassador-join-form label.is-wide { grid-column:1 / -1; }

  .tct-ambassador-join-form input,
  .tct-ambassador-join-form textarea {
    width:100%;
    padding:10px 0 12px;
    border:0;
    border-bottom:1px solid var(--tct-hairline);
    border-radius:0;
    outline:0;
    background:transparent;
    color:var(--tct-ink);
    font:inherit;
    font-size:.92rem;
    line-height:1.55;
    resize:vertical;
  }
  .tct-ambassador-join-form input:focus,
  .tct-ambassador-join-form textarea:focus {
    border-bottom-color:var(--tct-ink);
  }
  .tct-ambassador-join-form textarea::placeholder {
    color:var(--tct-faint);
  }

  .tct-ambassador-join-form > button {
    grid-column:1 / -1;
    justify-self:start;
    display:inline-flex;
    gap:9px;
    padding:0 0 6px;
    border:0;
    border-bottom:1px solid var(--tct-ink);
    background:transparent;
    color:var(--tct-ink);
    cursor:pointer;
    font-size:.79rem;
    font-weight:500;
  }
  .tct-ambassador-join-form > button:disabled {
    opacity:.45;
    cursor:default;
  }

  .tct-ambassador-join-status {
    grid-column:6 / -1;
    margin:26px 0 0;
    color:var(--tct-muted);
    font-size:.8rem;
  }

  @media (max-width:980px) {
    .tct-ambassadors-opening h1 { grid-column:3 / span 7; }
    .tct-ambassadors-role-content { grid-column:4 / span 8; }
    .tct-ambassadors-list { grid-template-columns:repeat(2,minmax(0,1fr)); }
    .tct-ambassador-person:nth-child(3n+2) { padding-top:0; }
    .tct-ambassador-person:nth-child(even) { padding-top:clamp(24px,3vw,42px); }
    .tct-ambassadors-search { grid-column:7 / -1; }
  }

  @media (max-width:720px) {
    .tct-ambassadors-page { padding-top:72px; padding-bottom:104px; }

    .tct-ambassadors-opening { display:block; min-height:auto; padding-bottom:86px; }
    .tct-ambassadors-opening-eyebrow { margin-bottom:36px; padding-top:0; }
    .tct-ambassadors-opening h1 { max-width:9.5ch; font-size:clamp(3rem,14vw,4.85rem); }
    .tct-ambassadors-opening > p { max-width:33rem; margin-top:34px; }

    .tct-ambassadors-role { display:block; padding:20px 0 102px; }
    .tct-ambassadors-role-kicker { margin-bottom:34px; padding-top:0; }
    .tct-ambassadors-role-content h2 { max-width:10ch; font-size:clamp(2.35rem,10.5vw,3.7rem); }

    .tct-ambassadors-roster { padding-bottom:112px; }
    .tct-ambassadors-roster-head { display:block; margin-bottom:58px; }
    .tct-ambassadors-count { gap:14px; }
    .tct-ambassadors-count strong { font-size:clamp(4rem,20vw,6.4rem); }
    .tct-ambassadors-search { margin-top:42px; }

    .tct-ambassadors-list { grid-template-columns:repeat(2,minmax(0,1fr)); gap:52px 14px; }
    .tct-ambassador-person:nth-child(even),
    .tct-ambassador-person:nth-child(3n+2) { padding-top:0; }
    .tct-ambassador-person-monogram { font-size:clamp(2.5rem,16vw,4.4rem); }
    .tct-ambassador-person-copy { grid-template-columns:26px 1fr; gap:7px; }
    .tct-ambassador-person-copy p { font-size:.68rem; }
    .tct-ambassador-person-copy em { font-size:.56rem; }

    .tct-ambassadors-cta {
      display:block;
      padding:86px 14px 96px;
    }
    .tct-ambassadors-cta h2 { max-width:9.5ch; font-size:clamp(2.55rem,12vw,4.15rem); }
    .tct-ambassadors-cta > div:last-child { max-width:none; margin-top:42px; justify-self:auto; }
    .tct-ambassador-join-panel { display:block; margin-top:64px; padding-top:58px; }
    .tct-ambassador-join-panel[hidden] { display:none; }
    .tct-ambassador-join-panel-heading h3 { max-width:9.5ch; font-size:clamp(2.3rem,10.8vw,3.7rem); }
    .tct-ambassador-join-form { grid-template-columns:1fr; margin-top:48px; gap:28px; }
    .tct-ambassador-join-form label.is-wide,
    .tct-ambassador-join-form > button { grid-column:auto; }
    .tct-ambassador-join-status { margin-top:24px; }
  }

  @media (max-width:460px) {
    .tct-ambassadors-list { grid-template-columns:1fr; gap:58px; }
    .tct-ambassador-person {
      grid-template-columns:96px 1fr;
      grid-template-rows:auto;
      gap:18px;
      align-items:end;
    }
    .tct-ambassador-person-visual { aspect-ratio:4 / 5; }
    .tct-ambassador-person-monogram {
      padding:12px;
      font-size:2.3rem;
    }
  }

  /* Lightbox remains functional and neutral. */
  .tct-lightbox-overlay { position:fixed; inset:0; z-index:999; display:flex; align-items:center; justify-content:center; background:rgba(18,18,17,.94); }
  .tct-lightbox-stage { width:100%; height:100%; display:flex; align-items:center; justify-content:center; overflow:hidden; cursor:grab; }
  .tct-lightbox-stage.is-dragging { cursor:grabbing; }
  .tct-lightbox-img { max-width:90vw; max-height:90vh; object-fit:contain; transition:transform .05s linear; user-select:none; -webkit-user-drag:none; }
  .tct-lightbox-close { position:fixed; top:20px; right:24px; width:40px; height:40px; border:1px solid rgba(255,255,255,.26); border-radius:999px; background:rgba(255,255,255,.08); color:#fff; cursor:pointer; }

  /* Footer stays almost invisible in Ivory. */
  .tct-footer { padding:25px 0 30px; background:var(--tct-canvas); color:var(--tct-faint); }
  .tct-footer-inner { width:min(1420px, calc(100% - 64px)); margin:0 auto; display:flex; justify-content:space-between; gap:24px; font-size:.61rem; letter-spacing:.035em; }
  .tct-footer-signature strong { color:var(--tct-muted); font-weight:500; }

  /* One motion language: continuity, low amplitude, deterministic timing. */
  .tct-reveal {
    --tct-reveal-delay:0ms;
    opacity:0;
    transform:translate3d(0,12px,0);
    transition:opacity .56s ease var(--tct-reveal-delay), transform .86s cubic-bezier(.16,1,.3,1) var(--tct-reveal-delay);
    will-change:opacity,transform;
  }
  .tct-reveal.is-visible { opacity:1; transform:none; }
  .tct-home-landing-title { --tct-reveal-delay:0ms; }
  .tct-home-stage-meta { --tct-reveal-delay:28ms; }
  .tct-home-title { --tct-reveal-delay:72ms; }
  .tct-home-present { --tct-reveal-delay:126ms; }
  .tct-home-nextline { --tct-reveal-delay:164ms; }

  @media (max-width:1080px) {
    .tct-home-landing-title { max-width:11.8ch; }
    .tct-home-title { grid-column:1 / span 9; }
    .tct-home-present { grid-column:10 / span 3; }
    .tct-home-nextline-rail { grid-column:1 / span 5; }
    .tct-home-nextline-copy { grid-column:7 / span 5; }
    .tct-home-feature-title-wrap { grid-column:3 / span 7; }
  }

  @media (max-width:1180px) {
    .tct-project-opening h1 { grid-column:3 / span 7; }
    .tct-project-opening > p { grid-column:10 / span 3; }
    .tct-project-track.is-horizontal .tct-project-milestone-copy p { font-size:.73rem; }
  }

  @media (max-width:980px) {
    .tct-header-inner { width:min(100% - 40px,1420px); grid-template-columns:1fr auto auto; gap:10px; }
    .tct-menu-toggle { display:inline-flex; }
    .tct-nav {
      position:fixed;
      inset:60px 0 auto 0;
      display:flex;
      flex-direction:column;
      align-items:flex-start;
      gap:0;
      padding:26px 20px 34px;
      background:rgba(247,247,245,.82);
      backdrop-filter:blur(30px) saturate(140%);
      -webkit-backdrop-filter:blur(30px) saturate(140%);
      transform:translateY(-120%);
      opacity:0;
      pointer-events:none;
      transition:transform .42s cubic-bezier(.16,1,.3,1), opacity .24s ease;
    }
    .tct-nav.is-open { transform:none; opacity:1; pointer-events:auto; }
    .tct-nav a { width:100%; padding:12px 0; font-family:var(--tct-font-primary,'Roboto'),sans-serif; font-size:1.55rem; font-weight:400; letter-spacing:-.035em; color:var(--tct-ink); }
    .tct-nav a::after { display:none; }
    .tct-section, .tct-footer-inner { width:calc(100% - 40px); }
    .tct-project-opening { min-height:auto; padding-bottom:100px; }
    .tct-project-opening-eyebrow { grid-column:1 / span 2; }
    .tct-project-opening h1 { grid-column:3 / span 7; }
    .tct-project-opening > p { grid-column:10 / span 3; }
    .tct-project-track.is-horizontal .tct-project-milestone-copy p { display:none; }
    .tct-home-landing { min-height:calc(100svh - 66px); }
    .tct-home-stage-grid { align-items:start; }
    .tct-home-title { grid-column:1 / span 8; }
    .tct-home-present { grid-column:9 / -1; }
    .tct-home-nextline-rail { grid-column:1 / span 5; }
    .tct-home-nextline-copy { grid-column:6 / span 6; }
    .tct-home-feature-inner { width:calc(100% - 40px); min-height:auto; }
    .tct-home-feature-meta { grid-column:1 / span 2; }
    .tct-home-feature-title-wrap { grid-column:3 / span 7; }
    .tct-home-feature-aside { grid-column:10 / span 3; }
    .tct-home-latest-copy { grid-column:5 / span 6; }
    .tct-home-questions h2, .tct-home-questions > p, .tct-home-question-action { grid-column:3 / span 9; }
  }

  @media (max-width:720px) {
    .tct-header { min-height:66px; }
    .tct-header.is-compact { min-height:58px; }
    .tct-header-inner { width:calc(100% - 28px); }
    .tct-brand img { max-width:92px; height:25px; }
    .tct-brand-name { font-size:.75rem; max-width:150px; }
    .tct-admin-entry { width:34px; padding:0; justify-content:center; }
    .tct-admin-entry span { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
    .tct-nav { inset:58px 0 auto 0; }
    .tct-section, .tct-footer-inner { width:calc(100% - 28px); }

    .tct-project-page { padding-top:72px; padding-bottom:110px; }
    .tct-project-opening { display:block; min-height:auto; padding-bottom:96px; }
    .tct-project-opening-eyebrow { margin-bottom:38px; padding-top:0; }
    .tct-project-opening h1 { max-width:10ch; font-size:clamp(3.15rem,15vw,5.15rem); line-height:.96; }
    .tct-project-opening > p { max-width:34rem; margin-top:38px; }
    .tct-project-trajectory-head { margin-bottom:52px; }
    .tct-project-track.is-horizontal,
    .tct-project-track.is-vertical { max-width:none; margin:0; }
    .tct-project-track.is-horizontal .tct-project-milestones,
    .tct-project-track.is-vertical .tct-project-milestones { display:grid; grid-template-columns:1fr; gap:0; }
    .tct-project-track.is-horizontal .tct-project-track-line,
    .tct-project-track.is-vertical .tct-project-track-line {
      top:0;
      bottom:0;
      left:5px;
      right:auto;
      width:1px;
      height:auto;
      background:color-mix(in srgb, var(--tct-ink) 12%, transparent);
    }
    .tct-project-track.is-horizontal .tct-project-track-line i,
    .tct-project-track.is-vertical .tct-project-track-line i {
      top:0;
      left:0;
      width:1px;
      height:var(--tct-trajectory-progress);
      transition:height .08s linear;
    }
    .tct-project-track.is-horizontal .tct-project-milestone,
    .tct-project-track.is-vertical .tct-project-milestone {
      display:block;
      padding:0 0 70px 38px;
    }
    .tct-project-track.is-horizontal .tct-project-milestone-marker,
    .tct-project-track.is-vertical .tct-project-milestone-marker { left:0; }
    .tct-project-milestone-meta { min-height:0; gap:12px; }
    .tct-project-milestone-date { max-width:none; font-size:clamp(1.75rem,8vw,2.45rem); }
    .tct-project-milestone-copy { margin-top:20px; }
    .tct-project-milestone-copy h3 { font-size:1.02rem; }
    .tct-project-track.is-horizontal .tct-project-milestone-copy p { display:block; }

    .tct-home-landing { min-height:calc(100svh - 58px); padding:42px 0 24px; }
    .tct-home-landing-title { max-width:9.6ch; font-size:clamp(2.8rem,12vw,4.9rem); line-height:1; }
    .tct-home-stage { min-height:auto; margin-top:-58px; padding-top:22px; }
    .tct-home-stage-meta { font-size:.65rem; }
    .tct-home-phase { letter-spacing:.08em; font-size:.58rem; }
    .tct-home-stage-grid { display:block; padding:34px 0 50px; }
    .tct-home-title { max-width:10.5ch; font-size:clamp(3.2rem,15vw,5.25rem); line-height:.93; }
    .tct-home-present { margin-top:42px; max-width:34rem; }
    .tct-home-nextline { display:block; padding:10px 0 30px; }
    .tct-home-nextline-rail { display:flex; flex-direction:column; gap:18px; }
    .tct-home-nextline-date { font-size:clamp(2.45rem,13vw,3.7rem); }
    .tct-home-nextline-copy { padding:28px 0 0; }
    .tct-home-nextline-copy p { margin-top:14px; }
    .tct-home-nextline-link { margin-top:20px; }

    .tct-home-feature-inner { width:calc(100% - 28px); display:block; padding:92px 0 100px; }

    .tct-home-feature-meta { margin-bottom:58px; flex-direction:row; flex-wrap:wrap; gap:7px 14px; }
    .tct-home-feature h2 { max-width:11ch; font-size:clamp(3rem,13.2vw,4.8rem); }
    .tct-home-feature-aside { margin-top:58px; max-width:34rem; }

    .tct-home-latest { grid-template-columns:1fr auto; column-gap:20px; min-height:auto; padding:44px 0; align-items:start; }
    .tct-home-latest-label, .tct-home-latest-date, .tct-home-latest-copy { grid-column:1; }
    .tct-home-latest-date { margin-top:24px; font-size:1.9rem; }
    .tct-home-latest-copy { margin-top:24px; }
    .tct-home-latest .tct-round-link { grid-column:2; grid-row:1 / span 3; align-self:center; }

    .tct-home-questions { display:block; min-height:auto; padding:110px 0 118px; }
    .tct-home-questions-overline { margin-bottom:48px; }
    .tct-home-questions h2 { max-width:9.5ch; font-size:clamp(3.1rem,14vw,5rem); }
    .tct-home-questions > p { margin-top:28px; max-width:28rem; }
    .tct-home-question-action { margin-top:58px; }
    .tct-ask-box { flex-direction:column; }
    .tct-footer-inner { flex-direction:column; gap:9px; }
  }


  @media (max-width:1080px) {
    .tct-project-focus-inner > div { grid-column:4 / span 8; }
    .tct-project-reading { width:min(680px,66vw); margin-left:18%; }
    .tct-project-team-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
  }

  @media (max-width:980px) {
    .tct-project-opening h1 { grid-column:3 / span 7; }
    .tct-project-opening > p { grid-column:10 / span 3; }
    .tct-project-focus-inner { width:calc(100% - 40px); }
    .tct-project-figures-grid { grid-column:4 / -1; }
    .tct-project-choices-grid { grid-column:4 / -1; }
    .tct-project-team-heading { grid-column:1 / span 4; }
    .tct-project-team-grid { grid-column:5 / -1; }
    .tct-project-track.is-horizontal .tct-project-milestone-copy p { display:none; }
  }

  @media (max-width:720px) {
    .tct-project-page { padding-top:72px; padding-bottom:100px; }
    .tct-project-opening { display:block; min-height:auto; padding-bottom:92px; }
    .tct-project-opening-eyebrow { margin-bottom:38px; padding-top:0; }
    .tct-project-opening h1 { max-width:10ch; font-size:clamp(3.05rem,14.6vw,5rem); line-height:.97; }
    .tct-project-opening > p { max-width:34rem; margin-top:38px; }

    .tct-project-focus { padding:86px 0 94px; }
    .tct-project-focus-inner { width:calc(100% - 28px); display:block; }
    .tct-project-focus-inner > span { display:block; margin-bottom:34px; padding-top:0; }
    .tct-project-focus h2 { max-width:10ch; font-size:clamp(2.8rem,12.5vw,4.6rem); }
    .tct-project-focus p { margin-top:26px; }

    .tct-project-figures { display:block; padding:96px 0 116px; }
    .tct-project-figures-head { margin-bottom:48px; padding-top:0; }
    .tct-project-figures-grid,
    .tct-project-figures-grid.is-many { grid-template-columns:repeat(2,minmax(0,1fr)); gap:48px 24px; }
    .tct-project-figure strong { font-size:clamp(3rem,15vw,5rem); }
    .tct-project-figure span { margin-top:12px; }

    .tct-project-text { padding:22px 0 110px; }
    .tct-project-reading { width:auto; margin-left:0; }
    .tct-project-reading h2 { font-size:clamp(2rem,9vw,3rem); }
    .tct-project-reading p { margin-top:26px; }

    .tct-project-trajectory { padding:26px 0 116px; }
    .tct-project-trajectory-head { margin-bottom:52px; }
    .tct-project-track.is-horizontal,
    .tct-project-track.is-vertical { max-width:none; margin:0; }
    .tct-project-track.is-horizontal .tct-project-milestones,
    .tct-project-track.is-vertical .tct-project-milestones {
      display:grid; grid-template-columns:1fr; gap:0;
    }
    .tct-project-track.is-horizontal .tct-project-track-line,
    .tct-project-track.is-vertical .tct-project-track-line {
      top:0; bottom:0; left:5px; right:auto; width:1px; height:auto;
      background:color-mix(in srgb,var(--tct-ink) 12%,transparent);
    }
    .tct-project-track.is-horizontal .tct-project-track-line i,
    .tct-project-track.is-vertical .tct-project-track-line i {
      top:0; left:0; width:1px; height:var(--tct-trajectory-progress);
    }
    .tct-project-track.is-horizontal .tct-project-milestone,
    .tct-project-track.is-vertical .tct-project-milestone {
      display:block;
      padding:0 0 66px 36px;
    }
    .tct-project-track.is-horizontal .tct-project-milestone-marker,
    .tct-project-track.is-vertical .tct-project-milestone-marker { left:0; }
    .tct-project-milestone-meta { min-height:0; gap:12px; }
    .tct-project-milestone-date { max-width:none; font-size:clamp(1.75rem,8vw,2.45rem); }
    .tct-project-milestone-copy { margin-top:20px; }
    .tct-project-milestone-copy h3 { font-size:1.02rem; }
    .tct-project-track.is-horizontal .tct-project-milestone-copy p { display:block; }

    .tct-project-quote { padding:106px 0 116px; }
    .tct-project-quote blockquote,
    .tct-project-quote cite { width:calc(100% - 28px); }
    .tct-project-quote blockquote { max-width:11ch; font-size:clamp(2.8rem,12.5vw,4.7rem); }
    .tct-project-quote cite { margin-top:34px; }

    .tct-project-choices { display:block; padding:104px 0 116px; }
    .tct-project-choices-head { margin-bottom:46px; }
    .tct-project-choices-grid { display:grid; grid-template-columns:1fr; gap:42px; }

    .tct-project-team { display:block; padding:44px 0 28px; }
    .tct-project-team-heading h2 { max-width:9.5ch; }
    .tct-project-team-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:36px 16px; margin-top:54px; }

    .tct-project-media { padding:62px 0 106px; }
    .tct-project-media-img { max-height:none; }
    .tct-project-gallery { padding:62px 0 110px; }
    .tct-project-gallery-grid { grid-template-columns:1fr; gap:40px; }
    .tct-project-gallery-item,
    .tct-project-gallery-item.is-lead,
    .tct-project-gallery-item:nth-child(2),
    .tct-project-gallery-item:nth-child(n+3) { grid-column:auto; margin-top:0; }
  }

  @media (prefers-reduced-motion:reduce) {
    html { scroll-behavior:auto; }
    *, *::before, *::after { animation-duration:.001ms !important; animation-iteration-count:1 !important; transition-duration:.001ms !important; scroll-behavior:auto !important; }
    .tct-reveal { opacity:1; transform:none; }
    .tct-live-dot::before, .tct-live-dot::after { animation:none; opacity:.16; transform:scale(1); }
    .tct-project-media-img, .tct-project-gallery-img, .tct-news-lead-img, .tct-news-article-img, .tct-space-image-trigger img { transform:none !important; }
  }
`;

const TCT_MOOD_LABELS = Object.freeze({
  1: 'Orageux',
  2: 'Nuageux',
  3: 'Couvert',
  4: 'Éclairci',
  5: 'Ensoleillé'
});

const TCT_MOOD_ICONS = Object.freeze({
  1: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16.5a4 4 0 0 1 .5-7.97A5.5 5.5 0 0 1 17 8.5a4 4 0 0 1 .3 7.98"/><path d="M13 12l-2.5 4h3L11 20"/></svg>',
  2: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 17.5a4 4 0 0 1 .4-7.98A5.5 5.5 0 0 1 16 8.7a4.2 4.2 0 0 1 3.5 4.15 3.9 3.9 0 0 1-.4 4.65"/><path d="M8 17.5h10.5"/></svg>',
  3: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="9" r="3.4"/><path d="M11 17.5a4 4 0 0 1 .4-7.9c.4-.05.8-.03 1.2.03A5.5 5.5 0 0 1 22.5 12a4 4 0 0 1-1 5.5"/></svg>',
  4: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="3.6"/><path d="M8 2.6v1.4M8 12v1.4M2.6 8h1.4M12 8h1.4M4.3 4.3l1 1M10.7 4.3l-1 1"/><path d="M13 19.5a3.7 3.7 0 0 1 .4-7.36A5 5 0 0 1 22.5 14a3.7 3.7 0 0 1-1 5.5"/></svg>',
  5: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.6"/><path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M5.6 18.4l1.7-1.7M16.7 7.3l1.7-1.7"/></svg>'
});

const TCT_MOOD_STYLE = `
  .tct-mood-fab{position:fixed;right:24px;bottom:24px;z-index:86;height:48px;max-width:48px;padding:0 13px;display:flex;align-items:center;gap:8px;border:1px solid color-mix(in srgb,var(--tct-ink) 14%,transparent);border-radius:999px;background:color-mix(in srgb,var(--tct-canvas) 88%,transparent);backdrop-filter:blur(22px) saturate(125%);-webkit-backdrop-filter:blur(22px) saturate(125%);box-shadow:0 12px 32px rgba(24,22,20,.09);color:var(--tct-ink);overflow:hidden;cursor:pointer;transition:max-width .16s ease,border-color .16s ease,transform .16s ease,background .16s ease;}
  .tct-mood-fab:hover{border-color:color-mix(in srgb,var(--tct-ink) 28%,transparent);transform:translateY(-1px);}
  .tct-mood-fab-icon,.tct-mood-fab-icon svg{width:20px;height:20px;display:block;flex:0 0 20px;}
  .tct-mood-fab-icon svg,.tct-mood-option svg{fill:none;stroke:currentColor;stroke-width:1.55;stroke-linecap:round;stroke-linejoin:round;}
  .tct-mood-fab-label{white-space:nowrap;opacity:0;transform:translateX(4px);font:600 12px/1 var(--tct-font-primary);transition:opacity .14s ease,transform .14s ease;}
  .tct-mood-fab.is-introduced{max-width:184px;border-color:color-mix(in srgb,var(--tct-expression-accent) 32%,transparent);}
  .tct-mood-fab.is-introduced .tct-mood-fab-label{opacity:1;transform:none;}
  .tct-mood-fab.is-answered::after{content:"";position:absolute;right:6px;top:6px;width:6px;height:6px;border-radius:50%;background:var(--tct-expression-accent);}
  .tct-mood-fab.is-wave{animation:tctMoodFabNudge 1.6s ease-out 1;}
  @keyframes tctMoodFabNudge{0%{box-shadow:0 12px 32px rgba(24,22,20,.09),0 0 0 0 color-mix(in srgb,var(--tct-expression-accent) 42%,transparent)}55%{box-shadow:0 12px 32px rgba(24,22,20,.09),0 0 0 11px color-mix(in srgb,var(--tct-expression-accent) 18%,transparent)}100%{box-shadow:0 12px 32px rgba(24,22,20,.09),0 0 0 18px transparent}}
  .tct-mood-panel[hidden]{display:none!important;}
  .tct-mood-panel{position:fixed;right:24px;bottom:84px;z-index:85;width:min(360px,calc(100vw - 32px));padding:22px;border:1px solid color-mix(in srgb,var(--tct-ink) 10%,transparent);border-radius:22px;background:color-mix(in srgb,var(--tct-canvas) 94%,white 6%);box-shadow:0 24px 64px rgba(24,22,20,.15);opacity:0;transform:translateY(5px) scale(.99);transition:opacity .15s ease,transform .15s ease;}
  .tct-mood-panel.is-open{opacity:1;transform:none;}
  .tct-mood-question{margin:0 0 17px;font:600 15px/1.45 var(--tct-font-primary);letter-spacing:-.01em;color:var(--tct-ink);}
  .tct-mood-options{display:grid;grid-template-columns:repeat(auto-fit,minmax(44px,1fr));gap:10px;}
  .tct-mood-option{min-width:0;padding:10px 4px 8px;display:grid;place-items:center;gap:6px;border:1px solid color-mix(in srgb,var(--tct-ink) 10%,transparent);border-radius:14px;background:transparent;color:color-mix(in srgb,var(--tct-ink) 72%,transparent);cursor:pointer;transition:background .14s ease,border-color .14s ease,transform .14s ease,color .14s ease;}
  .tct-mood-option:hover{background:color-mix(in srgb,var(--tct-expression-accent) 8%,transparent);border-color:color-mix(in srgb,var(--tct-expression-accent) 38%,transparent);color:var(--tct-ink);transform:translateY(-1px);}
  .tct-mood-option:disabled{cursor:wait;opacity:.55;}
  .tct-mood-option svg{width:18px;height:18px;}
  .tct-mood-option span{font:500 9px/1.15 var(--tct-font-primary);}
  .tct-mood-note{margin:14px 0 0;font:400 11px/1.45 var(--tct-font-primary);color:color-mix(in srgb,var(--tct-ink) 47%,transparent);}
  .tct-mood-thanks{font:500 13px/1.55 var(--tct-font-primary);color:var(--tct-ink);}
  @media(max-width:680px){.tct-mood-fab{right:16px;bottom:16px}.tct-mood-panel{right:16px;bottom:76px}.tct-mood-option span{display:none}.tct-mood-option{padding:12px 4px}}
  @media(prefers-reduced-motion:reduce){.tct-mood-fab,.tct-mood-fab-label,.tct-mood-panel,.tct-mood-option{transition:none!important}.tct-mood-fab.is-wave{animation:none!important}}
`;

// Overlay d'authentification admin — markup et wording identiques à
// #adminModal (tectonic/studio.html), valeurs de couleur RÉSOLUES plutôt
// que les variables Studio (--ink, --white, --bordeaux…), qui n'existent
// pas dans les variables --tct-* d'Ivory. Même apparence, pas de nouvelle
// charte. z-index au-dessus de tout, y compris la lightbox (999).
function renderMoodExperience(manifest) {
  const config = manifest && manifest.experience && manifest.experience.mood ? manifest.experience.mood : {};
  if (config.enabled === false || config.status === 'suspended') return '';
  const question = String(config.question || 'Comment vous sentez-vous par rapport au projet aujourd’hui ?');
  return `
    <button type="button" class="tct-mood-fab" data-tct-mood-fab aria-expanded="false" aria-controls="tct-mood-panel" aria-label="Météo du projet">
      <span class="tct-mood-fab-icon" aria-hidden="true">${TCT_MOOD_ICONS[4]}</span>
      <span class="tct-mood-fab-label" aria-hidden="true">Météo du projet</span>
    </button>
    <section class="tct-mood-panel" id="tct-mood-panel" data-tct-mood-panel hidden aria-label="Météo du projet">
      <div data-tct-mood-body>
        <p class="tct-mood-question">${esc(question)}</p>
        <div class="tct-mood-options">
          ${[1,2,3,4,5].map(value => `
            <button type="button" class="tct-mood-option" data-tct-mood-value="${value}" aria-label="${esc(TCT_MOOD_LABELS[value])}" title="${esc(TCT_MOOD_LABELS[value])}">
              ${TCT_MOOD_ICONS[value]}
              <span>${esc(TCT_MOOD_LABELS[value])}</span>
            </button>`).join('')}
        </div>
        <p class="tct-mood-note">Anonyme, agrégé uniquement — jamais individuel.</p>
      </div>
    </section>`;
}

function wireMoodExperience(root, actions) {
  const doc = root.ownerDocument;
  const win = doc && doc.defaultView;
  const fab = root.querySelector('[data-tct-mood-fab]');
  const panel = root.querySelector('[data-tct-mood-panel]');
  const body = root.querySelector('[data-tct-mood-body]');
  if (!doc || !win || !fab || !panel || !body) return;

  const answeredKey = 'storm_mood_last_answered';
  const legacyAnsweredKey = 'xyz_mood_last_answered';
  const todayStamp = () => new Date().toISOString().slice(0, 10);
  const safeGet = key => { try { return win.localStorage.getItem(key); } catch { return null; } };
  const hasAnsweredToday = () => {
    const today = todayStamp();
    return safeGet(answeredKey) === today || safeGet(legacyAnsweredKey) === today;
  };
  const renderAnswered = () => {
    body.innerHTML = '<div class="tct-mood-thanks">Merci — votre ressenti a bien été pris en compte.</div>';
  };

  if (hasAnsweredToday()) { fab.classList.add('is-answered'); renderAnswered(); }

  const open = () => {
    panel.hidden = false;
    fab.setAttribute('aria-expanded', 'true');
    if (typeof win.requestAnimationFrame === 'function') win.requestAnimationFrame(() => panel.classList.add('is-open'));
    else panel.classList.add('is-open');
  };
  const close = ({ restoreFocus = false } = {}) => {
    panel.classList.remove('is-open');
    fab.setAttribute('aria-expanded', 'false');
    win.setTimeout(() => { if (!panel.classList.contains('is-open')) panel.hidden = true; }, 160);
    // Restitution volontairement absente lors d'un clic extérieur : ce
    // clic a déjà légitimement déplacé le focus ailleurs sur la page,
    // le lui reprendre serait un vol de focus inattendu.
    if (restoreFocus) fab.focus();
  };

  fab.addEventListener('click', () => { panel.hidden ? open() : close(); });
  doc.addEventListener('click', event => {
    if (panel.hidden || panel.contains(event.target) || fab.contains(event.target)) return;
    close();
  });
  doc.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) close({ restoreFocus: true }); });

  body.querySelectorAll('[data-tct-mood-value]').forEach(button => {
    button.addEventListener('click', async () => {
      if (hasAnsweredToday()) return;
      const value = Number(button.dataset.tctMoodValue);
      if (!Number.isInteger(value) || value < 1 || value > 5) return;
      body.querySelectorAll('button').forEach(item => { item.disabled = true; });
      const result = await actions.submitMood({ value });
      if (!result || !result.ok) {
        body.querySelectorAll('button').forEach(item => { item.disabled = false; });
        const note = body.querySelector('.tct-mood-note');
        if (note) note.textContent = (result && result.error) || 'Enregistrement impossible pour le moment.';
        return;
      }
      try { win.localStorage.setItem(answeredKey, todayStamp()); } catch {}
      fab.classList.add('is-answered');
      renderAnswered();
      win.setTimeout(close, 1000);
    });
  });

  // Même prudence que safeGet ci-dessus : sur une origine restreinte
  // (Safari en navigation privée, origine opaque, iframe sandboxée),
  // l'accès à localStorage/sessionStorage lève une exception au moment
  // même de LIRE la propriété — pas seulement à l'appel de getItem/
  // setItem. Le moteur météo sait déjà gérer une valeur absente
  // (mood-engine.js), donc on se contente ici de ne jamais planter le
  // rendu de toute la page pour un widget additif.
  const safeStorageRef = getter => { try { return getter(); } catch { return null; } };

  const engine = createMoodSolicitationEngine({
    window: win,
    document: doc,
    storage: safeStorageRef(() => win.localStorage),
    sessionStorage: safeStorageRef(() => win.sessionStorage),
    storageKeyPrefix: 'storm_mood',
    hasAnswered: hasAnsweredToday,
    isBusy: () => !panel.hidden,
    onNudge({ reducedMotion, introMs }) {
      if (hasAnsweredToday()) return;
      if (!reducedMotion) {
        fab.classList.add('is-wave');
        win.setTimeout(() => fab.classList.remove('is-wave'), 1500);
      }
      fab.classList.add('is-introduced');
      win.setTimeout(() => fab.classList.remove('is-introduced'), introMs || 3200);
      return true;
    }
  });
  engine.start();
}

// Overlay d'authentification admin Tectonic retirée (branchement
// Orogeny) : le lien Administration pointe désormais directement vers
// Studio Orogeny (/projects/:projectId/studio), dont l'authentification
// réelle (devAuth, appartenance de projet) prend le relais nativement.
// Aucun overlay, aucun token, aucune session propre à Ivory.

function wireInteractions(root, manifest, actions) {
  // Espaces v2 — filters only appear for large collections.
  root.querySelectorAll('[data-space-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.closest('.tct-spaces-index');
      if (!group) return;
      group.querySelectorAll('[data-space-filter]').forEach(other => other.classList.remove('is-active'));
      btn.classList.add('is-active');
      const filter = btn.dataset.spaceFilter;
      group.querySelectorAll('[data-space-tags]').forEach(story => {
        let tags = [];
        try { tags = JSON.parse(story.dataset.spaceTags || '[]'); } catch (e) { tags = []; }
        story.hidden = !(filter === 'all' || tags.includes(filter));
      });
    });
  });

  function lockMedia() { document.body.classList.add('tct-media-open'); }
  function unlockMedia() { document.body.classList.remove('tct-media-open'); }

  // A project document is read as a native Storm object, not as a browser attachment.
  root.querySelectorAll('[data-tct-pdf-reader]').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const active = document.activeElement;
      const src = safeNewsHref(trigger.dataset.tctPdfSrc || '');
      if (!src) return;
      const title = trigger.dataset.tctPdfTitle || 'Document';
      const viewerSrc = `${src}${src.includes('#') ? '&' : '#'}toolbar=0&navpanes=0&scrollbar=1&view=FitH`;
      const overlay = document.createElement('div');
      overlay.className = 'tct-pdf-reader';
      overlay.setAttribute('role','dialog');
      overlay.setAttribute('aria-modal','true');
      overlay.setAttribute('aria-label', `Lecture — ${title}`);
      overlay.innerHTML = `
        <header class="tct-pdf-reader-bar">
          <div class="tct-pdf-reader-left">
            <button type="button" class="tct-pdf-reader-back" data-pdf-close>← Retour à l’article</button>
            <strong class="tct-pdf-reader-title">${esc(title)}</strong>
          </div>
          <div class="tct-pdf-reader-actions">
            <button type="button" class="tct-pdf-reader-action" data-pdf-fullscreen>Plein écran</button>
            <a class="tct-pdf-reader-action" href="${esc(src)}" download>Télécharger</a>
          </div>
        </header>
        <div class="tct-pdf-reader-stage">
          <iframe class="tct-pdf-reader-frame" src="${esc(viewerSrc)}" title="${esc(title)}"></iframe>
        </div>`;
      document.body.appendChild(overlay);
      lockMedia();

      const closeBtn=overlay.querySelector('[data-pdf-close]');
      const fullscreenBtn=overlay.querySelector('[data-pdf-fullscreen]');
      if (!overlay.requestFullscreen) fullscreenBtn?.remove();
      fullscreenBtn?.addEventListener('click', async () => {
        try {
          if (document.fullscreenElement) await document.exitFullscreen();
          else await overlay.requestFullscreen();
        } catch (error) { /* Fullscreen is optional; reading still works. */ }
      });
      const close = async () => {
        if (document.fullscreenElement === overlay) {
          try { await document.exitFullscreen(); } catch (error) {}
        }
        overlay.remove();
        unlockMedia();
        document.removeEventListener('keydown',onKey);
        if (active && typeof active.focus === 'function') active.focus();
      };
      const onKey=e=>{ if(e.key==='Escape' && !document.fullscreenElement) close(); };
      document.addEventListener('keydown',onKey);
      closeBtn?.addEventListener('click',close);
      closeBtn?.focus();
    });
  });

  // An architectural image is looked at: fullscreen, clear exit, no tool theatre.
  root.querySelectorAll('[data-tct-view-src]').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const active = document.activeElement;
      const overlay = document.createElement('div');
      overlay.className = 'tct-space-viewer';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', trigger.dataset.tctViewTitle || 'Vue agrandie');
      overlay.innerHTML = `
        <img src="${esc(trigger.dataset.tctViewSrc)}" alt="${esc(trigger.dataset.tctViewTitle || '')}">
        <button type="button" class="tct-space-viewer-close" aria-label="Fermer">✕</button>
        ${trigger.dataset.tctViewTitle ? `<div class="tct-space-viewer-title">${esc(trigger.dataset.tctViewTitle)}</div>` : ''}`;
      document.body.appendChild(overlay);
      lockMedia();
      const closeBtn = overlay.querySelector('.tct-space-viewer-close');

      const close = () => {
        overlay.remove();
        unlockMedia();
        document.removeEventListener('keydown', onKey);
        if (active && typeof active.focus === 'function') active.focus();
      };
      const onKey = e => { if (e.key === 'Escape') close(); };
      document.addEventListener('keydown', onKey);
      closeBtn.addEventListener('click', close);
      overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
      closeBtn.focus();
    });
  });

  // A plan is explored: dedicated inspection mode with explicit tools.
  root.querySelectorAll('[data-tct-inspect-src]').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const active = document.activeElement;
      const src = trigger.dataset.tctInspectSrc || '';
      const title = trigger.dataset.tctInspectTitle || 'Plan';
      const kind = trigger.dataset.tctInspectKind || (isPdfUrl(src) ? 'pdf' : 'image');

      const overlay = document.createElement('div');
      overlay.className = 'tct-plan-inspector';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', `Inspection — ${title}`);
      overlay.innerHTML = `
        <div class="tct-inspector-toolbar">
          <strong class="tct-inspector-title">${esc(title)}</strong>
          ${kind === 'image' ? `
            <button type="button" data-inspector-out aria-label="Dézoomer">−</button>
            <span class="tct-inspector-zoom" data-inspector-zoom>100%</span>
            <button type="button" data-inspector-in aria-label="Zoomer">+</button>
            <button type="button" data-inspector-reset>Réinitialiser</button>` : `
            <span class="tct-inspector-zoom">Document PDF</span>`}
        </div>
        <button type="button" class="tct-inspector-close" aria-label="Fermer">✕</button>
        <div class="tct-inspector-stage">
          ${kind === 'pdf'
            ? `<iframe class="tct-inspector-pdf" src="${esc(src)}" title="${esc(title)}"></iframe>`
            : `<div class="tct-inspector-wrap"><img class="tct-inspector-img" src="${esc(src)}" alt="${esc(title)}"></div>`}
        </div>`;
      document.body.appendChild(overlay);
      lockMedia();

      const closeBtn = overlay.querySelector('.tct-inspector-close');
      const stage = overlay.querySelector('.tct-inspector-stage');
      const wrap = overlay.querySelector('.tct-inspector-wrap');
      const zoomLabel = overlay.querySelector('[data-inspector-zoom]');
      const zoomIn = overlay.querySelector('[data-inspector-in]');
      const zoomOut = overlay.querySelector('[data-inspector-out]');
      const resetBtn = overlay.querySelector('[data-inspector-reset]');

      let scale = 1;
      let tx = 0;
      let ty = 0;
      const MIN_SCALE = .55;
      const MAX_SCALE = 6;
      const pointers = new Map();
      let dragOrigin = null;
      let pinchOrigin = null;

      const apply = () => {
        if (!wrap) return;
        wrap.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
        if (zoomLabel) zoomLabel.textContent = `${Math.round(scale * 100)}%`;
      };
      const reset = () => { scale = 1; tx = 0; ty = 0; apply(); };
      const zoom = delta => {
        scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale + delta));
        if (Math.abs(scale - 1) < .03) { scale = 1; tx = 0; ty = 0; }
        apply();
      };

      if (kind === 'image' && stage) {
        stage.addEventListener('wheel', e => {
          e.preventDefault();
          zoom(e.deltaY < 0 ? .15 : -.15);
        }, { passive: false });

        stage.addEventListener('pointerdown', e => {
          stage.setPointerCapture?.(e.pointerId);
          pointers.set(e.pointerId, { x:e.clientX, y:e.clientY });
          if (pointers.size === 1) {
            dragOrigin = { x:e.clientX, y:e.clientY, tx, ty };
            stage.classList.add('is-dragging');
          } else if (pointers.size === 2) {
            const pts = [...pointers.values()];
            const distance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            pinchOrigin = { distance, scale };
            dragOrigin = null;
          }
        });

        stage.addEventListener('pointermove', e => {
          if (!pointers.has(e.pointerId)) return;
          pointers.set(e.pointerId, { x:e.clientX, y:e.clientY });

          if (pointers.size === 2 && pinchOrigin) {
            const pts = [...pointers.values()];
            const distance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinchOrigin.scale * (distance / Math.max(1, pinchOrigin.distance))));
            apply();
            return;
          }

          if (pointers.size === 1 && dragOrigin && scale > MIN_SCALE) {
            tx = dragOrigin.tx + (e.clientX - dragOrigin.x);
            ty = dragOrigin.ty + (e.clientY - dragOrigin.y);
            apply();
          }
        });

        const releasePointer = e => {
          pointers.delete(e.pointerId);
          if (pointers.size < 2) pinchOrigin = null;
          if (!pointers.size) {
            dragOrigin = null;
            stage.classList.remove('is-dragging');
          } else {
            const only = [...pointers.values()][0];
            dragOrigin = { x:only.x, y:only.y, tx, ty };
          }
        };
        stage.addEventListener('pointerup', releasePointer);
        stage.addEventListener('pointercancel', releasePointer);

        zoomIn?.addEventListener('click', () => zoom(.2));
        zoomOut?.addEventListener('click', () => zoom(-.2));
        resetBtn?.addEventListener('click', reset);
      }

      const close = () => {
        overlay.remove();
        unlockMedia();
        document.removeEventListener('keydown', onKey);
        if (active && typeof active.focus === 'function') active.focus();
      };
      const onKey = e => {
        if (e.key === 'Escape') close();
        if (kind === 'image' && (e.key === '+' || e.key === '=')) zoom(.2);
        if (kind === 'image' && e.key === '-') zoom(-.2);
        if (kind === 'image' && (e.key === '0' || e.key === 'Home')) reset();
      };
      document.addEventListener('keydown', onKey);
      closeBtn.addEventListener('click', close);
      closeBtn.focus();
    });
  });

  // Filtres Plans & 3D
  root.querySelectorAll('.tct-filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.tct-filter-pill').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      const filter = btn.dataset.filter;
      root.querySelectorAll('#tct-spaces-grid > li').forEach(card => {
        let cardTags = [];
        try { cardTags = JSON.parse(card.dataset.tags || '[]'); } catch (e) { cardTags = []; }
        card.style.display = (filter === 'all' || cardTags.includes(filter)) ? '' : 'none';
      });
    });
  });

  // Lecture complète d'un article
  root.querySelectorAll('.tct-article-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const body = btn.parentElement.querySelector('.tct-article-body');
      const isOpen = !body.hidden;
      body.hidden = isOpen;
      btn.setAttribute('aria-expanded', String(!isOpen));
    });
  });

  // Lightbox avec zoom (molette) et déplacement (glisser-déposer) —
  // port du comportement utile de Pangea (zoom + pan), pas une simple
  // image agrandie. Les PDF s'ouvrent déjà dans un nouvel onglet via
  // leur lien direct, pas besoin de lightbox pour eux.
  const lightboxDoc = root.ownerDocument;
  const lightboxWin = lightboxDoc && lightboxDoc.defaultView;
  root.querySelectorAll('.tct-lightbox-trigger').forEach(img => {
    function openFromTrigger() {
      const overlay = lightboxDoc.createElement('div');
      overlay.className = 'tct-lightbox-overlay';
      overlay.innerHTML = `
        <div class="tct-lightbox-stage">
          <img class="tct-lightbox-img" src="${esc(img.dataset.lightboxSrc)}" alt="${esc(img.dataset.lightboxTitle)}">
        </div>
        <button type="button" class="tct-lightbox-close" aria-label="Fermer">✕</button>`;
      lightboxDoc.body.appendChild(overlay);

      const stage = overlay.querySelector('.tct-lightbox-stage');
      const lbImg = overlay.querySelector('.tct-lightbox-img');
      let scale = 1, tx = 0, ty = 0;
      let dragging = false, startX = 0, startY = 0, startTx = 0, startTy = 0;

      function applyTransform() {
        lbImg.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
      }

      // Zoom à la molette, borné à [1, 5] — 1 = taille d'origine,
      // jamais plus petit (pas d'intérêt à dézoomer sous l'original).
      stage.addEventListener('wheel', e => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.15 : -0.15;
        scale = Math.max(1, Math.min(5, scale + delta));
        if (scale === 1) { tx = 0; ty = 0; } // recentrer si on revient à l'échelle d'origine
        applyTransform();
      }, { passive: false });

      // Déplacement (glisser-déposer) — actif uniquement une fois zoomé,
      // comme dans le comportement Pangea d'origine.
      stage.addEventListener('mousedown', e => {
        if (scale <= 1) return;
        dragging = true;
        startX = e.clientX; startY = e.clientY;
        startTx = tx; startTy = ty;
        stage.classList.add('is-dragging');
      });
      function onMouseMove(e) {
        if (!dragging) return;
        tx = startTx + (e.clientX - startX);
        ty = startTy + (e.clientY - startY);
        applyTransform();
      }
      function onMouseUp() {
        dragging = false;
        stage.classList.remove('is-dragging');
      }
      lightboxWin.addEventListener('mousemove', onMouseMove);
      lightboxWin.addEventListener('mouseup', onMouseUp);

      function onKeydown(e) {
        if (e.key === 'Escape') { e.preventDefault(); close(); }
      }
      lightboxDoc.addEventListener('keydown', onKeydown, true);

      function close() {
        lightboxWin.removeEventListener('mousemove', onMouseMove);
        lightboxWin.removeEventListener('mouseup', onMouseUp);
        lightboxDoc.removeEventListener('keydown', onKeydown, true);
        overlay.remove();
        img.focus();
      }
      overlay.querySelector('.tct-lightbox-close').addEventListener('click', close);
      // Un clic sur le fond (pas sur l'image elle-même, pour ne pas
      // fermer accidentellement pendant un glisser-déposer) ferme la lightbox.
      overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    }

    img.addEventListener('click', openFromTrigger);
    // tabindex ajouté sur ce déclencheur (voir renderAsset) : l'activation
    // clavier doit donc aussi fonctionner, pas seulement le clic souris.
    img.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFromTrigger(); }
    });
  });

  // Ambassadors v2.9.2: a declared wish to participate gets an immediate
  // action. No detour through Questions / FAQ is required.
  const joinTrigger = root.querySelector('[data-tct-open-ambassador-join]');
  const joinPanel = root.querySelector('[data-tct-ambassador-join-panel]');
  const joinForm = root.querySelector('[data-tct-ambassador-join-form]');
  const joinStatus = root.querySelector('[data-tct-ambassador-join-status]');

  if (joinTrigger && joinPanel && joinForm) {
    joinTrigger.addEventListener('click', () => {
      const win = root.ownerDocument && root.ownerDocument.defaultView;
      const willOpen = joinPanel.hidden;
      joinPanel.hidden = !willOpen;
      joinTrigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');

      if (willOpen) {
        const firstInput = joinForm.querySelector('input');
        if (win) {
          const reduceMotion = typeof win.matchMedia === 'function'
            && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
          win.setTimeout(() => {
            try { joinPanel.scrollIntoView({ block:'nearest', behavior:reduceMotion ? 'auto' : 'smooth' }); }
            catch (e) { /* older browser */ }
            firstInput?.focus();
          }, 0);
        } else {
          firstInput?.focus();
        }
      }
    });

    joinForm.addEventListener('submit', async event => {
      event.preventDefault();
      const name = joinForm.querySelector('[name="name"]').value.trim();
      const email = joinForm.querySelector('[name="email"]').value.trim();
      const note = joinForm.querySelector('[name="note"]').value.trim();
      const submitButton = joinForm.querySelector('button[type="submit"]');

      if (submitButton) submitButton.disabled = true;

      const message = note
        ? `Je souhaite devenir ambassadeur.\n\n${note}`
        : 'Je souhaite devenir ambassadeur.';

      // Same existing Public Core contact action; no new backend route.
      const result = await actions.submitContact({ name, email, message });

      if (submitButton) submitButton.disabled = false;
      if (joinStatus) {
        joinStatus.hidden = false;
        joinStatus.textContent = result.ok
          ? 'Votre intérêt a bien été transmis à l’équipe projet.'
          : (result.error || 'La transmission est momentanément impossible.');
      }

      if (result.ok) joinForm.reset();
    });
  }

  // Ambassadors v2.9: search appears only for genuinely large communities.
  // It searches human-facing identity fields (name, role, team/direction).
  const ambassadorSearch = root.querySelector('[data-tct-ambassador-search-input]');
  if (ambassadorSearch) {
    const people = [...root.querySelectorAll('[data-tct-ambassador-person]')];
    const noResult = root.querySelector('[data-tct-ambassador-no-result]');

    ambassadorSearch.addEventListener('input', () => {
      const query = ambassadorSearch.value.trim().toLowerCase();
      let visible = 0;
      people.forEach(person => {
        const haystack = String(person.dataset.ambassadorSearch || '').toLowerCase();
        const match = !query || haystack.includes(query);
        person.hidden = !match;
        if (match) visible += 1;
      });
      if (noResult) noResult.hidden = visible > 0;
    });
  }

  // Questions v2: exact Pangea matchFaq stays authoritative.
  // scoreEntry is used only when matchFaq intentionally refuses to choose
  // between several plausible answers; the UI then asks the user to choose.
  const input = root.querySelector('#tct-question-input');
  const askBtn = root.querySelector('#tct-ask-btn');
  const resultBox = root.querySelector('#tct-question-result');
  const contactPanel = root.querySelector('#tct-question-contact');
  const contactForm = root.querySelector('#tct-contact-form');
  const contactStatus = root.querySelector('#tct-contact-status');

  if (input && askBtn && resultBox && manifest.content.questions) {
    const items = faqItemsForQuestions(manifest.content.questions, manifest.meta?.demoMode === true);
    const win = root.ownerDocument && root.ownerDocument.defaultView;
    let debounceTimer = 0;
    let lastQuestion = '';

    const findById = id => items.find(item => String(item.id) === String(id)) || null;

    const closeContact = () => {
      if (contactPanel) contactPanel.hidden = true;
      if (contactStatus) contactStatus.hidden = true;
    };

    const maybeScrollResult = explicit => {
      if (!explicit || !win) return;
      const reduceMotion = typeof win.matchMedia === 'function'
        && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (win.innerWidth <= 720) input.blur();
      win.setTimeout(() => {
        try { resultBox.scrollIntoView({ block:'nearest', behavior:reduceMotion ? 'auto' : 'smooth' }); }
        catch (e) { /* jsdom / older browsers */ }
      }, win.innerWidth <= 720 ? 90 : 0);
    };

    const answerMarkup = entry => {
      const related = questionRelatedLink(entry);
      return `
        <article class="tct-question-answer">
          <div class="tct-question-state">
            <i aria-hidden="true"></i>
            <span>${esc(faqStatusLabel(entry))}</span>
          </div>
          <div class="tct-question-answer-main">
            <h2>${esc(entry.title)}</h2>
            <div class="tct-question-answer-body">${faqAnswerToHtml(entry.answer)}</div>
            ${entry.note ? `<p class="tct-question-answer-note">${esc(entry.note)}</p>` : ''}
            <div class="tct-question-answer-actions">
              ${related ? `<a class="tct-text-link" href="${related.href}" data-tct-route>${esc(related.label)} <span aria-hidden="true">→</span></a>` : ''}
              <button type="button" data-tct-ask-another>Poser une autre question</button>
            </div>
          </div>
        </article>`;
    };

    const ambiguityMarkup = candidates => `
      <div class="tct-question-ambiguity">
        <div class="tct-question-state">
          <i aria-hidden="true"></i>
          <span>À préciser</span>
        </div>
        <div class="tct-question-ambiguity-main">
          <h2>Vous pensiez plutôt à…</h2>
          <p>Votre formulation peut correspondre à plusieurs sujets. Choisissez simplement celui qui se rapproche le plus de votre question.</p>
          <ul class="tct-question-candidates">
            ${candidates.map(candidate => `
              <li>
                <button type="button" data-tct-question-candidate="${esc(candidate.id)}">
                  <strong>${esc(candidate.title)}</strong>
                  <em aria-hidden="true">→</em>
                </button>
              </li>`).join('')}
          </ul>
        </div>
      </div>`;

    const unknownMarkup = () => `
      <div class="tct-question-unknown">
        <div class="tct-question-state">
          <i aria-hidden="true"></i>
          <span>Pas encore disponible ici</span>
        </div>
        <div class="tct-question-unknown-main">
          <h2>Cette question mérite une réponse précise.</h2>
          <p>Nous n’avons pas trouvé de réponse suffisamment fiable dans les informations publiées. Plutôt que de vous proposer quelque chose d’approximatif, vous pouvez la transmettre à l’équipe projet.</p>
          <button type="button" class="tct-question-transmit" data-tct-open-contact>
            Transmettre cette question <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>`;

    const showAnswer = (entry, explicit = true) => {
      if (!entry) return;
      resultBox.innerHTML = answerMarkup(entry);
      resultBox.hidden = false;
      closeContact();
      maybeScrollResult(explicit);
    };

    const showAmbiguity = (candidates, explicit = true) => {
      resultBox.innerHTML = ambiguityMarkup(candidates);
      resultBox.hidden = false;
      closeContact();
      maybeScrollResult(explicit);
    };

    const showUnknown = (explicit = true) => {
      resultBox.innerHTML = unknownMarkup();
      resultBox.hidden = false;
      maybeScrollResult(explicit);
    };

    const ask = ({ explicit = false } = {}) => {
      const question = input.value.trim();
      lastQuestion = question;

      if (question.length < 4) {
        if (explicit) {
          resultBox.innerHTML = `
            <div class="tct-question-unknown">
              <div class="tct-question-state"><i aria-hidden="true"></i><span>Quelques mots de plus</span></div>
              <div class="tct-question-unknown-main">
                <h2>Précisez un peu votre question.</h2>
                <p>Une formulation un peu plus complète permettra de chercher une réponse plus fiable.</p>
              </div>
            </div>`;
          resultBox.hidden = false;
        } else {
          resultBox.hidden = true;
          closeContact();
        }
        return;
      }

      const direct = matchFaq(question, items);
      if (direct) {
        if (explicit) actions.trackMatchResult?.('matched');
        showAnswer(direct, explicit);
        return;
      }

      const ranked = items
        .map(entry => ({ entry, score:scoreEntry(question, entry) }))
        .filter(candidate => candidate.score >= 12)
        .sort((a,b) => b.score - a.score);

      // No confidence percentages: only expose a choice when the existing
      // engine genuinely sees several plausible subjects.
      const candidates = [];
      ranked.forEach(candidate => {
        if (candidates.length >= 3) return;
        if (!candidates.some(existing => existing.id === candidate.entry.id)) {
          candidates.push(candidate.entry);
        }
      });

      if (candidates.length >= 2) {
        if (explicit) actions.trackMatchResult?.('disambiguated');
        showAmbiguity(candidates, explicit);
        return;
      }

      // During quiet type-ahead, silence is better than a premature failure.
      // The unknown state appears only after an explicit Enter/click.
      if (explicit) {
        actions.trackMatchResult?.('abstained');
        showUnknown(true);
      } else resultBox.hidden = true;
    };

    askBtn.addEventListener('click', () => ask({ explicit:true }));
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        ask({ explicit:true });
      }
    });
    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      closeContact();
      if (input.value.trim().length < 4) {
        resultBox.hidden = true;
        return;
      }
      debounceTimer = setTimeout(() => ask({ explicit:false }), 560);
    });

    root.querySelectorAll('[data-tct-question-example]').forEach(button => {
      button.addEventListener('click', () => {
        input.value = button.dataset.tctQuestionExample || button.textContent.trim();
        input.focus();
        ask({ explicit:true });
      });
    });

    root.querySelectorAll('[data-tct-featured-question]').forEach(button => {
      button.addEventListener('click', () => {
        const entry = findById(button.dataset.tctFeaturedQuestion);
        if (!entry) return;
        input.value = entry.title;
        lastQuestion = entry.title;
        showAnswer(entry, true);
      });
    });

    resultBox.addEventListener('click', event => {
      const candidateButton = event.target.closest('[data-tct-question-candidate]');
      if (candidateButton) {
        const entry = findById(candidateButton.dataset.tctQuestionCandidate);
        if (entry) {
          input.value = entry.title;
          lastQuestion = entry.title;
          showAnswer(entry, false);
        }
        return;
      }

      const another = event.target.closest('[data-tct-ask-another]');
      if (another) {
        resultBox.hidden = true;
        closeContact();
        input.value = '';
        input.focus();
        return;
      }

      const contactTrigger = event.target.closest('[data-tct-open-contact]');
      if (contactTrigger && contactPanel && contactForm) {
        contactPanel.hidden = false;
        const message = contactForm.querySelector('[name="message"]');
        if (message && !message.value.trim()) message.value = lastQuestion;
        if (win) {
          const reduceMotion = typeof win.matchMedia === 'function'
            && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
          win.setTimeout(() => {
            try { contactPanel.scrollIntoView({ block:'start', behavior:reduceMotion ? 'auto' : 'smooth' }); }
            catch (e) { /* older browser */ }
          }, 0);
        }
      }
    });
  }

  if (contactForm) {
    contactForm.addEventListener('submit', async event => {
      event.preventDefault();
      const name = contactForm.querySelector('[name="name"]').value.trim();
      const email = contactForm.querySelector('[name="email"]').value.trim();
      const message = contactForm.querySelector('[name="message"]').value.trim();

      const submitButton = contactForm.querySelector('button[type="submit"]');
      if (submitButton) submitButton.disabled = true;

      // Renderer emits an intention only; Public Core owns endpoint/storage.
      const result = await actions.submitContact({ name, email, message });

      if (submitButton) submitButton.disabled = false;
      if (contactStatus) {
        contactStatus.hidden = false;
        contactStatus.textContent = result.ok
          ? 'Votre question a bien été transmise à l’équipe projet.'
          : (result.error || 'La transmission est momentanément impossible.');
      }
      if (result.ok) contactForm.reset();
    });
  }

  wireMoodExperience(root, actions);
}


function wireFoundation(root, manifest, actions) {
  const doc = root.ownerDocument;
  const win = doc && doc.defaultView;
  if (!doc || !win) return;

  const header = root.querySelector('#tct-site-header');
  const nav = root.querySelector('#tct-main-nav');
  const menuToggle = root.querySelector('#tct-menu-toggle');
  const pages = [...root.querySelectorAll('.tct-main > .tct-section')];

  function closeMenu({ restoreFocus = false } = {}) {
    if (!nav || !menuToggle) return;
    nav.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    doc.body.classList.remove('tct-nav-open');
    if (restoreFocus) menuToggle.focus();
  }

  if (menuToggle && nav) {
    menuToggle.addEventListener('click', () => {
      const willOpen = menuToggle.getAttribute('aria-expanded') !== 'true';
      menuToggle.setAttribute('aria-expanded', String(willOpen));
      nav.classList.toggle('is-open', willOpen);
      doc.body.classList.toggle('tct-nav-open', willOpen);
    });
    doc.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
        closeMenu({ restoreFocus: true });
      }
    });
  }

  const revealWithin = page => {
    const els = [...page.querySelectorAll('[data-tct-reveal]')];
    if (!els.length) return;
    if (!('IntersectionObserver' in win)) {
      els.forEach(el => el.classList.add('is-visible'));
      return;
    }
    els.forEach((el, index) => {
      // Small deterministic staggering reinforces reading order without
      // turning the page into a sequence of effects.
      if (!el.style.getPropertyValue('--tct-reveal-delay')) {
        el.style.setProperty('--tct-reveal-delay', `${Math.min(index, 4) * 28}ms`);
      }
    });
    const observer = new win.IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -5% 0px' });
    els.forEach(el => observer.observe(el));
  };

  function syncSpacesView(requested) {
    const spacesPage = root.querySelector('#spaces');
    if (!spacesPage) return;

    const indexView = spacesPage.querySelector('[data-tct-spaces-index]');
    const detailShell = spacesPage.querySelector('[data-tct-space-detail-view]');
    const panels = [...spacesPage.querySelectorAll('[data-space-detail-id]')];
    const isDetailRoute = String(requested || '').startsWith('space-');

    let activePanel = null;
    if (isDetailRoute) {
      let spaceId = String(requested).slice(6);
      try { spaceId = decodeURIComponent(spaceId); } catch (e) { /* keep raw id */ }
      activePanel = panels.find(panel => String(panel.dataset.spaceDetailId) === spaceId) || null;
    }

    const showDetail = Boolean(activePanel);
    if (indexView) indexView.hidden = showDetail;
    if (detailShell) detailShell.hidden = !showDetail;
    panels.forEach(panel => { panel.hidden = panel !== activePanel; });
    if (showDetail) revealWithin(activePanel);
  }

  function syncNewsView(requested) {
    const newsPage = root.querySelector('#news');
    if (!newsPage) return;

    const indexView = newsPage.querySelector('[data-tct-news-index]');
    const articleShell = newsPage.querySelector('[data-tct-news-article-view]');
    const panels = [...newsPage.querySelectorAll('[data-news-article-id]')];
    const isArticleRoute = String(requested || '').startsWith('news-');

    let activePanel = null;
    if (isArticleRoute) {
      let articleId = String(requested).slice(5);
      try { articleId = decodeURIComponent(articleId); } catch (e) { /* keep raw id */ }
      activePanel = panels.find(panel => String(panel.dataset.newsArticleId) === articleId) || null;
    }

    const showArticle = Boolean(activePanel);
    if (indexView) indexView.hidden = showArticle;
    if (articleShell) articleShell.hidden = !showArticle;
    panels.forEach(panel => { panel.hidden = panel !== activePanel; });

    if (showArticle) revealWithin(activePanel);
  }

  function activatePage(hash, scroll = true) {
    const requested = String(hash || '#home').replace(/^#/, '') || 'home';
    const baseRequested = requested.startsWith('news-')
      ? 'news'
      : (requested.startsWith('space-') ? 'spaces' : requested);
    const target = root.querySelector(`#${baseRequested}`) || root.querySelector('#home') || pages[0];
    if (!target) return;

    actions?.trackPageView?.();

    pages.forEach(page => page.classList.toggle('is-active', page === target));
    root.querySelectorAll('.tct-nav a').forEach(link => {
      const isCurrent = link.getAttribute('href') === `#${target.id}`;
      if (isCurrent) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    syncNewsView(requested);
    syncSpacesView(requested);
    closeMenu();
    revealWithin(target);

    if (scroll) {
      const reduceMotion = typeof win.matchMedia === 'function'
        && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
      try { win.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); } catch (e) { /* jsdom */ }
    }
  }

  root.querySelectorAll('a[data-tct-route], .tct-nav a, .tct-brand').forEach(link => {
    const href = link.getAttribute('href') || '';
    if (!href.startsWith('#')) return;
    link.addEventListener('click', e => {
      e.preventDefault();
      const hash = href || '#home';
      if (win.location.hash === hash) activatePage(hash, true);
      else win.location.hash = hash;
    });
  });

  win.addEventListener('hashchange', () => activatePage(win.location.hash || '#home', true));
  activatePage(win.location.hash || '#home', false);

  const trajectory = root.querySelector('[data-tct-trajectory]');
  if (trajectory) {
    const targetProgress = Math.max(0, Math.min(100, Number(trajectory.dataset.tctTargetProgress) || 0));
    const reduceMotion = typeof win.matchMedia === 'function'
      && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let trajectoryFrame = 0;

    const updateTrajectory = () => {
      trajectoryFrame = 0;
      if (!trajectory.isConnected) return;
      if (reduceMotion) {
        trajectory.style.setProperty('--tct-trajectory-progress', `${targetProgress}%`);
        return;
      }
      const rect = trajectory.getBoundingClientRect();
      const vh = Math.max(1, win.innerHeight || doc.documentElement.clientHeight || 1);
      // The line is semantic project progress. Scroll only reveals that progress;
      // it never changes the underlying project state.
      const reveal = Math.max(0, Math.min(1, ((vh * .86) - rect.top) / (vh * .54)));
      trajectory.style.setProperty('--tct-trajectory-progress', `${(targetProgress * reveal).toFixed(2)}%`);
    };
    const requestTrajectoryUpdate = () => {
      if (trajectoryFrame) return;
      trajectoryFrame = win.requestAnimationFrame
        ? win.requestAnimationFrame(updateTrajectory)
        : (updateTrajectory(), 0);
    };
    updateTrajectory();
    win.addEventListener('scroll', requestTrajectoryUpdate, { passive: true });
    win.addEventListener('resize', requestTrajectoryUpdate, { passive: true });
  }

  const driftMedia = [...root.querySelectorAll('[data-tct-drift]')];
  if (driftMedia.length) {
    const reduceMotion = typeof win.matchMedia === 'function'
      && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let driftFrame = 0;
    const paintDrift = () => {
      driftFrame = 0;
      driftMedia.forEach(item => {
        if (reduceMotion) {
          item.style.setProperty('--tct-media-drift', '0px');
          return;
        }
        const rect = item.getBoundingClientRect();
        const vh = Math.max(1, win.innerHeight || doc.documentElement.clientHeight || 1);
        const centerDelta = ((rect.top + rect.height / 2) - vh / 2) / vh;
        const drift = Math.max(-16, Math.min(16, centerDelta * -16));
        item.style.setProperty('--tct-media-drift', `${drift.toFixed(2)}px`);
      });
    };
    const requestDriftPaint = () => {
      if (driftFrame) return;
      driftFrame = win.requestAnimationFrame
        ? win.requestAnimationFrame(paintDrift)
        : (paintDrift(), 0);
    };
    paintDrift();
    win.addEventListener('scroll', requestDriftPaint, { passive: true });
    win.addEventListener('resize', requestDriftPaint, { passive: true });
  }

  if (header) {
    let headerFrame = 0;
    const updateHeader = () => {
      headerFrame = 0;
      const y = Math.max(0, win.scrollY || 0);
      const progress = Math.min(y / 160, 1);
      header.classList.toggle('is-compact', y > 24);
      header.style.setProperty('--tct-header-alpha', (.58 + progress * .20).toFixed(3));
      header.style.setProperty('--tct-header-blur', `${(24 + progress * 8).toFixed(1)}px`);
      header.style.setProperty('--tct-header-shadow-alpha', (progress * .035).toFixed(3));
    };
    const requestHeaderUpdate = () => {
      if (headerFrame) return;
      if (win.requestAnimationFrame) headerFrame = win.requestAnimationFrame(updateHeader);
      else updateHeader();
    };
    updateHeader();
    win.addEventListener('scroll', requestHeaderUpdate, { passive: true });
  }
}

export function render(manifest, root, actions) {
  const branding = manifest.branding || {};
  const colors = branding.colors || {};
  const fonts = branding.fonts || {};
  const primary = safeCssColor(colors.primary, '#1E1D1E');
  const secondary = safeCssColor(colors.secondary, '#C2AF7E');
  const expressionAccent = resolveExpressionAccent(primary, secondary);
  const fontPrimary = safeCssFont(fonts.primary && fonts.primary.family, 'Roboto');
  const fontSecondary = safeCssFont(fonts.secondary && fonts.secondary.family, 'Italiana');
  const fontAssetsCss = [
    fontFaceCss(fonts.primary, 'Roboto'),
    fontFaceCss(fonts.secondary, 'Italiana')
  ].filter(Boolean).join('');
  const projectName = esc(manifest.project && manifest.project.name);
  const logoHtml = branding.logo && branding.logo.url
    ? `<img src="${esc(branding.logo.url)}" alt="${esc(branding.logo.alt)}">`
    : '';

  const sections = SECTION_ORDER
    .filter(key => {
      if (!manifest.content) return false;
      if (key === 'timeline') return Boolean(manifest.content.project || manifest.content.timeline);
      return Boolean(manifest.content[key]);
    })
    .map(key => {
      if (key === 'home') {
        return renderHome(manifest.content.home, {
          timeline: manifest.content.timeline,
          news: manifest.content.news
        });
      }
      if (key === 'timeline') {
        return renderProject(manifest.content.project, {
          timeline: manifest.content.timeline,
          team: manifest.content.team
        });
      }
      if (key === 'questions') {
        return renderQuestions(manifest.content.questions, manifest.meta?.demoMode === true);
      }
      return SECTION_RENDERERS[key](manifest.content[key]);
    })
    .join('');

  root.innerHTML = `
    <style>${fontAssetsCss}${STYLE}${TCT_MOOD_STYLE}</style>
    <div class="tct-site" style="--tct-primary:${primary};--tct-secondary:${secondary};--tct-expression-accent:${expressionAccent};--tct-font-primary:'${fontPrimary}';--tct-font-secondary:'${fontSecondary}';">
      <header class="tct-header" id="tct-site-header">
        <div class="tct-header-inner">
          <a class="tct-brand" href="#home" aria-label="Accueil — ${projectName}">
            ${logoHtml}
            <span class="tct-brand-name">${projectName}</span>
          </a>
          <button type="button" class="tct-menu-toggle" id="tct-menu-toggle" aria-expanded="false" aria-controls="tct-main-nav" aria-label="Ouvrir la navigation"><span></span></button>
          ${renderNavigation(manifest.navigation, { hasProject: Boolean(manifest.content && (manifest.content.project || manifest.content.timeline)) })}
          <a class="tct-admin-entry" href="${esc(studioUrlFromLocation())}" aria-label="Administration">
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>
            <span>Administration</span>
          </a>
        </div>
      </header>
      <main class="tct-main">${sections}</main>
      ${renderFooter()}
      ${renderMoodExperience(manifest)}
    </div>`;

  if (root.ownerDocument) root.ownerDocument.title = manifest.project && manifest.project.name ? manifest.project.name : 'Projet';
  wireInteractions(root, manifest, actions || {
    submitContact: async () => ({ ok: false, error: 'Indisponible.' }),
    submitMood: async () => ({ ok: false, error: 'Indisponible.' })
  });
  wireFoundation(root, manifest, actions);
}
