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
// Slice 0 : home uniquement. Slice 1 : news/questions. Slice 2 (ce
// fichier) : spaces/ambassadors. now/next (jalons) restent null — Le
// projet n'est pas encore compilé, ce sera Slice 3.

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
// content.home — featured désormais réellement dérivé des Actualités
// compilées. now/next restent null (Le projet, Slice 3).
// ─────────────────────────────────────────────────────────────────
const DEFAULT_ASK_PROMPT = 'Une question sur le projet ?';

function compileHome(candidate, compiledNews, warnings) {
  const home = candidate?.homepage || {};
  const items = compiledNews?.items || [];
  const mode = home.featuredArticleMode === 'manual' ? 'manual' : 'latest';

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
    now: null,
    next: null,
    featured,
    showMilestones: home.showMilestones !== false,
    showAskPrompt: home.showAskPrompt !== false
  };
}

// Fermé à 7 clés, comme la référence Tectonic — un module inconnu
// injecté dans le Candidate ne doit jamais se retrouver validé par
// simple présence des clés attendues.
const REQUIRED_MODULE_KEYS = ['home', 'timeline', 'spaces', 'news', 'questions', 'ambassadors', 'team'];
const NAV_LABELS = { questions: 'Questions', news: 'Actualités', spaces: 'Espaces', ambassadors: 'Ambassadeurs', team: 'Équipe projet' };
const NAV_ORDER = ['questions', 'news', 'spaces', 'ambassadors', 'team'];

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

  // Slice 2 : home + news + questions + spaces + ambassadors actifs.
  // timeline/team apparaîtront quand Le projet sera réellement compilé
  // (Slice 3).
  const modules = { home: true, timeline: false, spaces: true, news: true, questions: true, ambassadors: true, team: false };
  const navigation = NAV_ORDER.filter(key => modules[key]).map(key => ({ module: key, label: NAV_LABELS[key] }));

  // Ordre contraint : news doit être compilé avant home (featured en dépend).
  const content = {};
  content.news = compileNews(candidate, projectId);
  content.questions = compileQuestions(candidate);
  content.spaces = compileSpaces(candidate, projectId);
  content.ambassadors = compileAmbassadors(candidate, projectId);
  content.home = compileHome(candidate, content.news, warnings);

  const meta = { generatedAt: context?.generatedAt, revision: context?.revision };

  const manifest = { schemaVersion: 1, meta, project, branding, edition, modules, navigation, content };

  validateManifestInvariants(manifest);

  return { manifest, warnings };
}
