// Compiler — Candidate → Manifest.
//
// Principes repris de la référence Tectonic (audit Phase 2D) :
//   - le Compiler VALIDE, il ne répare jamais silencieusement une
//     incohérence structurelle (édition inconnue, module manquant) ;
//   - aucune écriture tant que la validation finale des invariants
//     du Manifest assemblé n'a pas réussi ;
//   - meta.generatedAt/revision proviennent du CompilationContext,
//     jamais recalculés ici.
//
// V0 (Slice 0) : un seul module compilé — home. now/next/featured
// restent délibérément null : Le projet et Actualités ne sont pas
// encore capturés dans le Candidate à ce stade. Ce n'est pas un repli
// dégradé, c'est l'exacte limite assumée de ce que ce slice construit
// — les slices suivants (voir audit Phase 2D) enrichissent le
// Candidate et cette fonction au fur et à mesure, jamais l'inverse.

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

// ATTENTION — point documenté dans l'audit Phase 2D, non bloquant pour
// ce slice (aucune donnée de test actuelle n'exerce ce chemin), mais
// à traiter comme un vrai blocker avant le premier slice qui compile
// des médias (Espaces/Ambassadeurs) : GET /api/assets/:id (voir
// src/http/routes/assets.js) exige une authentification ET une
// appartenance de projet. Cette URL n'est PAS résolvable par un
// visiteur anonyme d'Ivory. Publier un logo aujourd'hui produirait une
// URL qui échoue en 401/404 pour tout le monde sauf un utilisateur
// Storm déjà connecté sur ce projet précis.
function assetUrl(assetId) {
  return assetId ? `/api/assets/${assetId}` : null;
}

function compileProject(candidate) {
  const name = candidate?.project?.name;
  if (typeof name !== 'string' || !name.trim()) {
    throw new CompilerBlockingError('project.name manquant ou vide — précondition structurelle non satisfaite.', 'PROJECT_NAME_MISSING');
  }
  return { name };
}

function compileBranding(candidate) {
  const identity = candidate?.identity || {};
  const primary = identity.primaryColor || '#1E1D1E';
  return {
    logo: wrapAsset(assetUrl(identity.logoAssetId), ''),
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

const DEFAULT_ASK_PROMPT = 'Une question sur le projet ?';

function compileHome(candidate) {
  const home = candidate?.homepage || {};
  return {
    message: home.message ?? null,
    askPrompt: (home.askPrompt && String(home.askPrompt).trim()) ? home.askPrompt : DEFAULT_ASK_PROMPT,
    // now/next/featured : voir note d'en-tête — Le projet et Actualités
    // ne sont pas encore compilés dans ce slice.
    now: null,
    next: null,
    featured: null,
    showMilestones: home.showMilestones !== false,
    showAskPrompt: home.showAskPrompt !== false
  };
}

// Fermé à 7 clés, comme la référence Tectonic — un module inconnu
// injecté dans le Candidate ne doit jamais se retrouver validé par
// simple présence des clés attendues.
const REQUIRED_MODULE_KEYS = ['home', 'timeline', 'spaces', 'news', 'questions', 'ambassadors', 'team'];

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

// compile(candidate, context) → Manifest
// context = { generatedAt: string ISO, revision: number }
export function compile(candidate, context) {
  if (!candidate || typeof candidate !== 'object') {
    throw new CompilerBlockingError('Publication Candidate absent ou invalide.', 'CANDIDATE_INVALID');
  }

  const project = compileProject(candidate);
  const branding = compileBranding(candidate);
  const edition = compileEdition(candidate);

  // V0 : un seul module actif. Jamais une invention des 6 autres —
  // ils apparaîtront quand les slices suivants les captureront
  // réellement dans le Candidate.
  const modules = { home: true, timeline: false, spaces: false, news: false, questions: false, ambassadors: false, team: false };
  const navigation = [];

  const content = { home: compileHome(candidate) };

  const meta = { generatedAt: context?.generatedAt, revision: context?.revision };

  const manifest = { schemaVersion: 1, meta, project, branding, edition, modules, navigation, content };

  validateManifestInvariants(manifest);

  return manifest;
}
