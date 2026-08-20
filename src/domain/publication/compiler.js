// Compiler — Candidate → Manifest.
//
// Principes repris de la référence Tectonic (audit Phase 2D) :
//   - le Compiler VALIDE, il ne répare jamais silencieusement une
//     incohérence structurelle (édition inconnue, module manquant) ;
//   - aucune écriture tant que la validation finale des invariants
//     du Manifest assemblé n'a pas réussi ;
//   - meta.generatedAt/revision proviennent du CompilationContext,
//     jamais recalculés ici ;
//   - un repli non structurel (ex. featuredArticleId obsolète) est
//     toléré, MAIS jamais silencieux : il produit un warning explicite
//     porté par la publication, jamais juste une correction discrète ;
//   - le Compiler assemble et dérive ; il n'écrit jamais de microcopy
//     éditoriale que Studio n'a pas produite (arbitrage explicite,
//     Slice 2 : intro/contact/join Ambassadeurs restent vides plutôt
//     que remplis d'un texte inventé ici).
//
// Slice 0 : home uniquement. Slice 1 : news/questions. Slice 2 :
// spaces/ambassadors. Slice 3 (ce fichier) : Le projet — sections
// narratives (9 types), timeline (jalons), team (équipe). Tous les 7
// modules sont désormais actifs. Il ne reste que Homepage enrichie
// (Slice 4) avant de brancher Ivory.

export class CompilerBlockingError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'CompilerBlockingError';
    this.code = code || 'COMPILER_BLOCKING_ERROR';
  }
}

// Seule édition réellement supportée aujourd'hui — Ivory reste le
// renderer de référence (voir cadrage Phase 2D). project_identity.theme
// autorise déjà 'rainbow'/'midnight' en base (Phase 1B), mais aucun
// renderer n'existe pour ces valeurs : les accepter ici serait publier
// une promesse que rien ne peut tenir.
const SUPPORTED_EDITIONS = ['ivory'];

function wrapAsset(url, altDefault) {
  if (!url) return null;
  return { url, alt: typeof altDefault === 'string' ? altDefault : '' };
}

// URL d'asset PUBLIQUE — Slice 1 (option A arbitrée), étendue Slice 2
// avec une extension de fichier réelle dans le chemin. Trouvé par
// audit, confirmé en lisant le code source d'Ivory : isPdfUrl() ne
// détecte un PDF QUE par l'extension ".pdf" en fin d'URL -- jamais par
// un champ "kind" du Manifest. Sans extension, un document PDF publié
// se serait affiché comme une image cassée, quel que soit
// media.kind='document' correctement présent par ailleurs. Ce n'est
// pas une modification d'Ivory : Ivory sait déjà tout faire, il fallait
// seulement lui donner une URL qu'elle sait interpréter avec son code
// existant.
//
// L'extension est dérivée du content_type RÉEL de l'asset (jamais
// devinée depuis le nom de fichier d'origine, jamais acceptée telle
// quelle depuis une entrée non fiable) -- voir assetContentTypes,
// construit une seule fois à la lecture du Snapshot. Si le content_type
// est inconnu (asset supprimé après coup, type non supporté), la
// fonction retourne null plutôt qu'une URL sans extension qui romprait
// silencieusement isPdfUrl côté Ivory.
const MIME_TO_EXTENSION = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'application/pdf': 'pdf'
};

function publicAssetUrl(projectId, assetId, assetContentTypes) {
  if (!assetId) return null;
  const contentType = assetContentTypes?.[assetId];
  const extension = MIME_TO_EXTENSION[contentType];
  if (!extension) return null;
  return `/public/projects/${projectId}/assets/${assetId}.${extension}`;
}

// Conversion runs structurés -> chaîne avec syntaxe Ivory
// (**gras**/++souligné++/​//italique//), UNIQUEMENT pour les champs que
// Ivory traite comme des chaînes plates passées à inlineRichText()
// (résumé d'actualité, réponse de question) — jamais pour les blocs
// d'article, qui restent des runs structurés (Ivory les consomme déjà
// tels quels). href n'a pas d'équivalent dans cette syntaxe (Ivory ne
// le supporte pas non plus à ce niveau) : silencieusement abandonné
// ici, uniquement dans ce contexte de chaîne aplatie — jamais dans les
// blocs structurés d'un article, où href reste porté intact.
function runsToInlineMarkdown(runs) {
  return (Array.isArray(runs) ? runs : []).map(r => {
    let t = typeof r?.text === 'string' ? r.text : '';
    if (r?.bold) t = `**${t}**`;
    if (r?.underline) t = `++${t}++`;
    if (r?.italic) t = `//${t}//`;
    return t;
  }).join('');
}

function compileProject(candidate) {
  const name = candidate?.project?.name;
  if (typeof name !== 'string' || !name.trim()) {
    throw new CompilerBlockingError('project.name manquant ou vide — précondition structurelle non satisfaite.', 'PROJECT_NAME_MISSING');
  }
  return { name };
}

function compileBranding(candidate, projectId) {
  const identity = candidate?.identity || {};
  const primary = identity.primaryColor || '#1E1D1E';
  return {
    logo: wrapAsset(publicAssetUrl(projectId, identity.logoAssetId, candidate?.assetContentTypes), ''),
    colors: {
      primary,
      // Une seule couleur explicitement fournie reste une seule
      // identité : jamais un beige de secours qui n'appartient pas à
      // la marque du projet (doctrine reprise telle quelle de Tectonic).
      secondary: identity.secondaryColor || primary
    },
    fonts: {
      primary: { family: identity.fontPrimary || 'Roboto', asset: null },
      secondary: { family: identity.fontSecondary || identity.fontPrimary || 'Roboto', asset: null }
    }
  };
}

function compileEdition(candidate) {
  const theme = candidate?.identity?.theme;
  if (!SUPPORTED_EDITIONS.includes(theme)) {
    throw new CompilerBlockingError(
      `Édition inconnue ou non supportée : "${theme}". Éditions supportées : ${SUPPORTED_EDITIONS.join(', ')}. Compilation refusée — aucun repli silencieux.`,
      'EDITION_UNSUPPORTED'
    );
  }
  return { id: theme };
}

// ─────────────────────────────────────────────────────────────────
// content.news — mapping exact du modèle Orogeny (3 types de blocs
// seulement : paragraph/heading/image, contre 7 chez Tectonic —
// bulletList/orderedList/gallery/document n'existent pas côté Studio
// aujourd'hui ; jamais simulés ici, simplement absents).
// ─────────────────────────────────────────────────────────────────
function estimateReadingMinutes(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

function compileBlock(block, projectId, assetContentTypes) {
  if (!block || typeof block !== 'object') return null;
  const type = block.blockType;
  if (type === 'paragraph' || type === 'heading') {
    // Runs structurés préservés tels quels — Ivory les consomme déjà
    // sous cette forme (voir normalizeNewsBlock côté référence
    // Tectonic). Jamais aplatis en chaîne ici.
    const runs = (Array.isArray(block.runs) ? block.runs : []).map(r => {
      const run = { text: typeof r?.text === 'string' ? r.text : '' };
      if (r?.bold) run.bold = true;
      if (r?.italic) run.italic = true;
      if (r?.underline) run.underline = true;
      if (typeof r?.href === 'string' && r.href) run.href = r.href;
      return run;
    });
    return { id: block.id, type, runs };
  }
  if (type === 'image') {
    if (!block.imageAssetId) return null;
    return { id: block.id, type: 'image', asset: wrapAsset(publicAssetUrl(projectId, block.imageAssetId, assetContentTypes), '') };
  }
  return null;
}

function blockToPlainText(block) {
  if (!block) return '';
  if (block.type === 'paragraph' || block.type === 'heading') {
    return (block.runs || []).map(r => r.text || '').join('');
  }
  return '';
}

function compileArticle(article, projectId, assetContentTypes) {
  const blocks = (Array.isArray(article.blocks) ? article.blocks : [])
    .map(b => compileBlock(b, projectId, assetContentTypes))
    .filter(Boolean);
  const plainText = blocks.map(blockToPlainText).filter(Boolean).join('\n');
  // asset de couverture : dérivé du premier bloc image trouvé — une
  // commodité du Compiler pour les vues en liste, pas un champ Studio
  // distinct (Orogeny n'a pas de notion de "image de couverture"
  // séparée des blocs, contrairement à Tectonic). Documenté ici, pas
  // une invention silencieuse.
  const firstImageBlock = blocks.find(b => b.type === 'image' && b.asset);
  return {
    id: article.id,
    tag: article.tag || '',
    date: article.publicationDate || '',
    title: article.title || '',
    summary: runsToInlineMarkdown(article.chapeauRuns),
    readingMinutes: estimateReadingMinutes(plainText),
    blocks,
    asset: firstImageBlock ? firstImageBlock.asset : null
  };
}

function compileNews(candidate, projectId) {
  const articles = Array.isArray(candidate?.articles) ? candidate.articles : [];
  // Tri canonique arbitré : publicationDate DESC, position ASC en
  // départage. Orogeny ne stocke qu'une DATE (pas d'heure) — contrairement
  // à Tectonic qui triait sur un timestamp complet (publishedAt),
  // aucun départage temporel plus fin n'est possible ici ; position
  // (ordre éditorial Studio) sert de repli stable, jamais un id
  // arbitraire.
  const sorted = articles.slice().sort((a, b) => {
    const ad = a?.publicationDate || '';
    const bd = b?.publicationDate || '';
    if (ad !== bd) {
      if (!ad) return 1;
      if (!bd) return -1;
      return bd.localeCompare(ad);
    }
    return (a?.position ?? 0) - (b?.position ?? 0);
  });
  return { items: sorted.map(a => compileArticle(a, projectId, candidate?.assetContentTypes)) };
}

// ─────────────────────────────────────────────────────────────────
// content.questions — Orogeny ne porte aucun signal de scoring
// (keywords/phrases/intentSignals/priority...) contrairement au
// faqEntries de Tectonic. Arbitrage explicite : ne jamais fabriquer de
// keywords artificiels ici pour simuler une recherche qui n'existe
// pas. Les questions sont compilées telles quelles, cliquables
// directement (le moteur de recherche en texte libre d'Ivory reste
// non fonctionnel pour ce contenu — confirmé par audit, pas un oubli).
// ─────────────────────────────────────────────────────────────────
function compileQuestions(candidate) {
  const questions = Array.isArray(candidate?.questions) ? candidate.questions : [];
  return {
    items: questions.map(q => ({
      id: q.id,
      title: q.question || '',
      answer: runsToInlineMarkdown(q.answerRuns)
    }))
  };
}

// ─────────────────────────────────────────────────────────────────
// content.spaces — le dictionnaire status/statusBody n'existe nulle
// part côté backend Orogeny (confirmé par audit : seul l'enum brut
// designing/approved/delivered est validé serveur, les libellés et
// phrases ne vivent que dans public/studio-espaces.html). Porté ici
// verbatim, jamais reformulé — c'est une narration de maturité déjà
// éprouvée par Studio, pas une occasion de la retoucher.
// ─────────────────────────────────────────────────────────────────
const SPACE_STATUS = {
  designing: {
    label: 'En cours de conception',
    body: 'Cet espace est encore en cours de conception. Son organisation et certains détails peuvent évoluer.'
  },
  approved: {
    label: 'Validé',
    body: 'Les grands principes de cet espace sont validés. Les ajustements restants portent sur des détails de mise au point.'
  },
  delivered: {
    label: 'Livré',
    body: 'Cet espace est livré et peut désormais être découvert tel qu\'il sera utilisé au quotidien.'
  }
};

function compileSpaceMedia(media, projectId, assetContentTypes, spaceName) {
  if (!media || !media.assetId) return null;
  const url = publicAssetUrl(projectId, media.assetId, assetContentTypes);
  if (!url) return null;
  return {
    url,
    alt: media.alt || media.label || spaceName || '',
    label: media.label || '',
    kind: media.kind || 'view'
  };
}

function compileSpace(space, projectId, assetContentTypes) {
  const status = SPACE_STATUS[space.status] || SPACE_STATUS.designing;
  // position ne sert qu'au tri (déjà appliqué par listSpaces, ordre
  // conservé tel quel) -- jamais exposée comme donnée métier, Ivory
  // n'en a pas besoin.
  const media = (Array.isArray(space.media) ? space.media : [])
    .map(m => compileSpaceMedia(m, projectId, assetContentTypes, space.name))
    .filter(Boolean);
  return {
    id: space.id,
    type: 'Espace',
    title: space.name || '',
    location: space.location || '',
    comment: space.description || '',
    status: status.label,
    statusBody: status.body,
    usageTags: Array.isArray(space.usages) ? space.usages : [],
    usages: Array.isArray(space.usages) ? space.usages : [],
    media,
    asset: media[0] || null
  };
}

function compileSpaces(candidate, projectId) {
  const spaces = Array.isArray(candidate?.spaces) ? candidate.spaces : [];
  return {
    intro: { eyebrow: '', title: '', description: '' },
    items: spaces.map(s => compileSpace(s, projectId, candidate?.assetContentTypes))
  };
}

// ─────────────────────────────────────────────────────────────────
// content.ambassadors — arbitrage explicite Slice 2 : intro/contact/
// join publiés avec une structure neutre (Ivory les attend), jamais
// une microcopy éditoriale inventée par le Compiler. Aucun nouveau
// section-content/ambassadeurs dans ce slice -- une évolution Studio
// dédiée pourra piloter ces trois blocs plus tard si un vrai besoin
// éditorial apparaît. roster, lui, est réel et complet.
// ─────────────────────────────────────────────────────────────────
function personAltDefault(name, roleOrTag) {
  if (roleOrTag && String(roleOrTag).trim()) return `${name} — ${roleOrTag}`;
  return name || '';
}

// Repris quasi verbatim de la référence Tectonic (ambassadorContactHref) :
// validation réelle par canal, jamais une confiance aveugle dans une
// valeur saisie dans Studio. contactChannel/contactValue/contactable
// du modèle Orogeny correspondent déjà exactement à ce que cette
// fonction attend -- aucune adaptation de forme nécessaire.
function ambassadorContactHref(person) {
  const channel = ['email', 'teams', 'link'].includes(person?.contactChannel) ? person.contactChannel : 'email';
  const raw = String(person?.contactValue || '').trim();
  if (!raw) return '';

  if (channel === 'email') {
    const email = raw.replace(/^mailto:/i, '').trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? `mailto:${email}` : '';
  }
  if (channel === 'teams') {
    return /^(https?:\/\/|msteams:)/i.test(raw) ? raw : '';
  }
  return /^https?:\/\//i.test(raw) ? raw : '';
}

function compileAmbassador(person, projectId, assetContentTypes) {
  const contactable = person.contactable !== false;
  return {
    id: person.id,
    name: person.name || '',
    role: person.role || '',
    tag: person.tag || '',
    contactable,
    contactHref: contactable ? ambassadorContactHref(person) : '',
    contactLabel: 'Contacter',
    photo: wrapAsset(publicAssetUrl(projectId, person.photoAssetId, assetContentTypes), personAltDefault(person.name, person.role))
  };
}

function compileAmbassadors(candidate, projectId) {
  const roster = Array.isArray(candidate?.ambassadors) ? candidate.ambassadors : [];
  return {
    // Structure présente, valeurs vides sauf nécessité structurelle --
    // jamais de microcopy éditoriale inventée ici (arbitrage explicite).
    intro: { title: '', body: '', rosterLabel: '' },
    contact: { enabled: false, defaultHref: null, label: '' },
    join: { enabled: false, mode: null, title: '', body: '', label: '', href: null },
    roster: roster.map(p => compileAmbassador(p, projectId, candidate?.assetContentTypes))
  };
}

// ─────────────────────────────────────────────────────────────────
// content.project — les 9 types de sections narratives. enabled=false
// exclut la section du Manifest sans jamais toucher au Snapshot (déjà
// garanti par construction : le Snapshot est une copie figée, cette
// fonction ne fait que filtrer en lecture). timeline/team restent des
// marqueurs purs ({id,type}) -- leurs vraies données viennent
// respectivement de content.timeline/content.team, jamais dupliquées
// ici (arbitrage explicite, confirmé par audit contre la référence
// Tectonic : compileProjectContent ne fait que ça).
//
// Les champs texte (title/body/quote/attribution/items[].value/label/
// title/body) sont déjà du texte brut côté Orogeny (validés comme
// string, jamais des runs) — aucune conversion runsToInlineMarkdown
// nécessaire ici, contrairement à Actualités/Questions.
// ─────────────────────────────────────────────────────────────────
function compileNarrativeSectionMedia(media, projectId, assetContentTypes) {
  if (!media || !media.assetId) return null;
  const url = publicAssetUrl(projectId, media.assetId, assetContentTypes);
  if (!url) return null;
  return { url, alt: media.alt || '' };
}

function compileNarrativeSection(section, projectId, assetContentTypes) {
  if (!section || !section.sectionType) return null;
  const type = section.sectionType;
  const base = { id: section.id, type };
  const payload = section.payload || {};

  if (type === 'focus' || type === 'text') {
    return { ...base, title: payload.title || '', body: payload.body || '' };
  }
  if (type === 'quote') {
    return { ...base, quote: payload.quote || '', attribution: payload.attribution || '' };
  }
  if (type === 'keyFigures') {
    return {
      ...base,
      title: payload.title || '',
      items: (Array.isArray(payload.items) ? payload.items : []).map(item => ({
        value: item?.value || '',
        label: item?.label || ''
      }))
    };
  }
  if (type === 'choices') {
    return {
      ...base,
      title: payload.title || '',
      items: (Array.isArray(payload.items) ? payload.items : []).map(item => ({
        title: item?.title || '',
        body: item?.body || ''
      }))
    };
  }
  if (type === 'image') {
    // Un seul média compilé -- le premier par position (arbitrage
    // explicite, Slice 3). Orogeny autorise plusieurs médias même sur
    // une section 'image' (la validation ne le distingue pas de
    // 'gallery'), mais Ivory n'attend qu'un seul asset pour ce type.
    // Les médias en trop restent dans le Snapshot, simplement non
    // compilés -- jamais une erreur, jamais un warning (ce n'est pas
    // une incohérence structurelle, juste un excédent que Studio n'a
    // pas nettoyé).
    const sorted = (Array.isArray(section.media) ? section.media : []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const asset = compileNarrativeSectionMedia(sorted[0], projectId, assetContentTypes);
    return { ...base, asset, caption: payload.caption || '' };
  }
  if (type === 'gallery') {
    const sorted = (Array.isArray(section.media) ? section.media : []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const items = sorted.map(m => compileNarrativeSectionMedia(m, projectId, assetContentTypes)).filter(Boolean);
    return { ...base, title: payload.title || '', items };
  }
  if (type === 'timeline' || type === 'team') return base;
  return null;
}

function compileProjectContent(candidate, projectId) {
  const leProjet = candidate?.leProjet || {};
  const intro = leProjet.intro || {};
  const sections = (Array.isArray(leProjet.sections) ? leProjet.sections : [])
    .filter(s => s && s.enabled !== false);
  return {
    intro: { title: intro.title || '', body: intro.body || '' },
    sections: sections.map(s => compileNarrativeSection(s, projectId, candidate?.assetContentTypes)).filter(Boolean)
  };
}

// ─────────────────────────────────────────────────────────────────
// content.timeline — domaine séparé du marqueur 'timeline' dans
// content.project.sections. Alimenté directement par les jalons
// (leProjet.milestones), jamais par le payload d'une section.
// intro n'a aucun équivalent Studio -- structure neutre, valeurs
// vides, aucune microcopy inventée (arbitrage explicite, même
// doctrine qu'Ambassadeurs au Slice 2).
//
// Comportement done/current/future porté FIDÈLEMENT depuis la
// référence Tectonic, y compris le cas de plusieurs 'current' :
// findIndex ne retient que le PREMIER trouvé pour le calcul de
// progression (les suivants restent listés dans milestones[], mais
// n'influencent pas percent/currentStepLabel). Aucune nouvelle règle
// métier introduite dans ce slice.
// ─────────────────────────────────────────────────────────────────
function computeProgressFromMilestones(milestones) {
  const items = Array.isArray(milestones) ? milestones : [];
  const total = items.length;
  if (!total) return { currentStepLabel: 'Étape 0', totalSteps: 0, percent: 0 };
  const doneCount = items.filter(m => m.status === 'done').length;
  const currentIndex = items.findIndex(m => m.status === 'current');
  const stepNumber = currentIndex >= 0 ? currentIndex + 1 : Math.min(doneCount + 1, total);
  const percent = Math.round(((doneCount + (currentIndex >= 0 ? 0.5 : 0)) / total) * 100);
  return {
    currentStepLabel: `Étape ${stepNumber}`,
    totalSteps: total,
    percent: Math.max(0, Math.min(100, percent))
  };
}

function compileTimeline(candidate) {
  const milestones = Array.isArray(candidate?.leProjet?.milestones) ? candidate.leProjet.milestones : [];
  return {
    intro: { eyebrow: '', title: '', description: '' },
    progress: computeProgressFromMilestones(milestones),
    milestones: milestones.map(m => ({
      id: m.id,
      status: m.status,
      date: m.dateLabel || '',
      label: m.label || '',
      description: m.description || ''
    }))
  };
}

// ─────────────────────────────────────────────────────────────────
// content.team — domaine séparé du marqueur 'team'. group: m.badge
// (confirmé exact contre la référence Tectonic). intro/cta neutres,
// aucune microcopy inventée. Sans photo -> photo:null, déjà géré
// gracieusement côté Ivory (repli sur initiales).
// ─────────────────────────────────────────────────────────────────
function compileTeam(candidate, projectId) {
  const members = Array.isArray(candidate?.leProjet?.team) ? candidate.leProjet.team : [];
  return {
    intro: { introBody: '' },
    cta: { title: '', body: '' },
    members: members.map(m => ({
      id: m.id,
      name: m.name || '',
      title: m.title || '',
      group: m.badge || '',
      photo: wrapAsset(publicAssetUrl(projectId, m.photoAssetId, candidate?.assetContentTypes), personAltDefault(m.name, m.title))
    }))
  };
}



// ─────────────────────────────────────────────────────────────────
// content.home — featured dérivé des Actualités compilées (Slice 1).
// now/next dérivés des jalons compilés (Slice 3) : premier jalon
// status='current' pour now, premier status='future' pour next --
// simple .find(), même logique que le Compiler de référence.
// ─────────────────────────────────────────────────────────────────
const DEFAULT_ASK_PROMPT = 'Une question sur le projet ?';

function compileHome(candidate, compiledNews, compiledTimeline, warnings) {
  const home = candidate?.homepage || {};
  const items = compiledNews?.items || [];
  const milestones = compiledTimeline?.milestones || [];
  const mode = home.featuredArticleMode === 'manual' ? 'manual' : 'latest';

  const now = milestones.find(m => m.status === 'current') || null;
  const next = milestones.find(m => m.status === 'future') || null;

  let featured = null;
  if (mode === 'manual' && home.featuredArticleId) {
    const chosen = items.find(a => String(a.id) === String(home.featuredArticleId));
    if (chosen) {
      featured = { source: { module: 'news', id: chosen.id }, title: chosen.title, summary: chosen.summary };
    } else {
      // Référence devenue obsolète (article supprimé depuis) — repli
      // sur latest, JAMAIS silencieux : un warning de compilation est
      // enregistré avec la publication (arbitrage explicite, audit
      // Phase 2D). La compilation aboutit, mais ce n'est pas invisible.
      warnings.push({
        code: 'FEATURED_ARTICLE_MISSING',
        message: `L'actualité mise en avant (${home.featuredArticleId}) n'existe plus. La dernière actualité disponible a été utilisée.`
      });
      const latest = items[0];
      featured = latest ? { source: { module: 'news', id: latest.id }, title: latest.title, summary: latest.summary } : null;
    }
  } else {
    const latest = items[0];
    featured = latest ? { source: { module: 'news', id: latest.id }, title: latest.title, summary: latest.summary } : null;
  }

  return {
    message: home.message ?? null,
    askPrompt: (home.askPrompt && String(home.askPrompt).trim()) ? home.askPrompt : DEFAULT_ASK_PROMPT,
    now,
    next,
    featured,
    showMilestones: home.showMilestones !== false,
    showAskPrompt: home.showAskPrompt !== false
  };
}

// Fermé à 7 clés, comme la référence Tectonic — un module inconnu
// injecté dans le Candidate ne doit jamais se retrouver validé par
// simple présence des clés attendues.
const REQUIRED_MODULE_KEYS = ['home', 'timeline', 'spaces', 'news', 'questions', 'ambassadors', 'team'];
// timeline/team jamais dans navigation — confirmé par lecture directe
// du code source Ivory (renderNavigation filtre explicitement ces deux
// modules et réinjecte elle-même 'timeline' sous le libellé "Le
// projet", en interne, indépendamment de ce que le Manifest fournit).
// Les inclure ici serait harmless (Ivory les ignorerait) mais
// trompeur : ça donnerait l'impression que le Compiler pilote un
// libellé qu'Ivory ne consultera jamais.
const NAV_LABELS = { questions: 'Questions', news: 'Actualités', spaces: 'Espaces', ambassadors: 'Ambassadeurs' };
const NAV_ORDER = ['questions', 'news', 'spaces', 'ambassadors'];

function validateManifestInvariants(manifest) {
  const modules = manifest.modules;

  REQUIRED_MODULE_KEYS.forEach(key => {
    if (typeof modules[key] !== 'boolean') {
      throw new CompilerBlockingError(`Invariant violé : modules.${key} doit être un booléen, reçu ${JSON.stringify(modules[key])}.`, 'INVARIANT_MODULES_SHAPE');
    }
  });

  const actualKeys = Object.keys(modules).sort();
  const expectedKeys = REQUIRED_MODULE_KEYS.slice().sort();
  if (actualKeys.length !== expectedKeys.length || !actualKeys.every((k, i) => k === expectedKeys[i])) {
    throw new CompilerBlockingError(`Invariant violé : modules doit contenir exactement [${expectedKeys.join(', ')}], reçu [${actualKeys.join(', ')}].`, 'INVARIANT_MODULES_KEYS');
  }

  if (!Array.isArray(manifest.navigation)) {
    throw new CompilerBlockingError('Invariant violé : navigation doit être un tableau.', 'INVARIANT_NAVIGATION_SHAPE');
  }

  if (typeof manifest.meta.generatedAt !== 'string' || !manifest.meta.generatedAt.trim()) {
    throw new CompilerBlockingError('Invariant violé : meta.generatedAt doit être une chaîne non vide.', 'INVARIANT_META_GENERATED_AT');
  }
  if (typeof manifest.meta.revision !== 'number' || !Number.isInteger(manifest.meta.revision)) {
    throw new CompilerBlockingError('Invariant violé : meta.revision doit être un entier.', 'INVARIANT_META_REVISION');
  }

  REQUIRED_MODULE_KEYS.forEach(key => {
    const hasContent = Object.prototype.hasOwnProperty.call(manifest.content, key);
    if (modules[key] === true && !hasContent) {
      throw new CompilerBlockingError(`Invariant violé : modules.${key} est activé mais content.${key} est absent.`, 'INVARIANT_CONTENT_MISSING');
    }
    if (modules[key] === false && hasContent) {
      throw new CompilerBlockingError(`Invariant violé : modules.${key} est désactivé mais content.${key} est présent.`, 'INVARIANT_CONTENT_UNEXPECTED');
    }
  });

  manifest.navigation.forEach(entry => {
    if (modules[entry.module] !== true) {
      throw new CompilerBlockingError(`Invariant violé : navigation référence le module "${entry.module}", désactivé.`, 'INVARIANT_NAVIGATION_MODULE');
    }
  });

  // content.project n'a pas de clé de module dédiée (pas l'un des 7
  // noms fermés) : sa présence est gouvernée par modules.timeline,
  // exactement comme content.timeline -- les deux représentent la même
  // page "Le projet" côté Ivory (sections + jalons), jamais l'un sans
  // l'autre.
  const hasProjectContent = Object.prototype.hasOwnProperty.call(manifest.content, 'project');
  if (modules.timeline === true && !hasProjectContent) {
    throw new CompilerBlockingError('Invariant violé : modules.timeline est activé mais content.project est absent.', 'INVARIANT_CONTENT_MISSING');
  }
  if (modules.timeline === false && hasProjectContent) {
    throw new CompilerBlockingError('Invariant violé : modules.timeline est désactivé mais content.project est présent.', 'INVARIANT_CONTENT_UNEXPECTED');
  }
}

// compile(candidate, context) → { manifest, warnings }
// context = { generatedAt: string ISO, revision: number, projectId: string }
export function compile(candidate, context) {
  if (!candidate || typeof candidate !== 'object') {
    throw new CompilerBlockingError('Publication Candidate absent ou invalide.', 'CANDIDATE_INVALID');
  }
  const projectId = context?.projectId;
  const warnings = [];

  const project = compileProject(candidate);
  const branding = compileBranding(candidate, projectId);
  const edition = compileEdition(candidate);

  // Slice 3 : tous les 7 modules désormais actifs.
  const modules = { home: true, timeline: true, spaces: true, news: true, questions: true, ambassadors: true, team: true };
  const navigation = NAV_ORDER.filter(key => modules[key]).map(key => ({ module: key, label: NAV_LABELS[key] }));

  // Ordre contraint : news et timeline doivent être compilés avant
  // home (featured/now/next en dépendent).
  const content = {};
  content.news = compileNews(candidate, projectId);
  content.questions = compileQuestions(candidate);
  content.spaces = compileSpaces(candidate, projectId);
  content.ambassadors = compileAmbassadors(candidate, projectId);
  content.project = compileProjectContent(candidate, projectId);
  content.timeline = compileTimeline(candidate);
  content.team = compileTeam(candidate, projectId);
  content.home = compileHome(candidate, content.news, content.timeline, warnings);

  const meta = { generatedAt: context?.generatedAt, revision: context?.revision };

  const manifest = { schemaVersion: 1, meta, project, branding, edition, modules, navigation, content };

  validateManifestInvariants(manifest);

  return { manifest, warnings };
}
