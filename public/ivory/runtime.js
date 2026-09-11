// OROGENY — Public Runtime, porté depuis Tectonic (Phase 5) sans
// réécriture ni redesign. Une seule adaptation réelle : Tectonic
// suppose un déploiement mono-projet (chemin fixe /api/manifest) ;
// Orogeny est multi-tenant, donc l'identité publique (client/projet/
// capability) est déduite de l'URL de la page elle-même (servie à
// /public/:clientSlug/:projectSlug/:capability, Lot B), jamais codée
// en dur ni passée par une variable globale injectée côté serveur --
// l'UUID projet interne n'apparaît jamais dans cette URL.
//
// Contrat strict, inchangé par rapport à Tectonic :
//   - lit UNIQUEMENT le Manifest de la publication active (jamais
//     Studio vivant, jamais un autre endpoint) ;
//   - refuse proprement un schemaVersion inconnu ;
//   - route vers le renderer indiqué par manifest.edition.id ;
//   - une édition inconnue ou non supportée produit une erreur
//     explicite, JAMAIS un repli silencieux vers Ivory.
//
// Aucune logique éditoriale ici — ce fichier ne fait que charger,
// distribuer, et fournir le "Public Core" partagé (actions
// d'interaction telles que l'envoi d'un contact). Le rendu lui-même
// vit dans /ivory/renderers/*.js, qui ne connaît jamais d'endpoint
// ni de mécanisme de stockage — seulement des actions qu'on lui
// fournit à appeler.

const SUPPORTED_SCHEMA_VERSIONS = [1];
const RENDERERS = {
  ivory: '/ivory/renderers/ivory.js'
  // rainbow-glass, midnight-frost : hors périmètre, volontairement absents
};

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderFatalError(message) {
  const root = document.getElementById('tectonic-root') || document.body;
  // Le message est toujours échappé — une fonction d'erreur publique
  // ne doit jamais injecter du texte brut via innerHTML, même si les
  // messages actuels sont tous contrôlés par ce fichier lui-même.
  root.innerHTML = `
    <div style="max-width:640px;margin:80px auto;padding:32px;font-family:system-ui,sans-serif;
                border:1px solid #e2e2e2;border-radius:8px;background:#fff;color:#1a1a1a;">
      <h1 style="font-size:1.1rem;margin:0 0 12px;">Impossible d'afficher ce site</h1>
      <p style="margin:0;color:#555;line-height:1.5;">${esc(message)}</p>
    </div>`;
}

// Déduit {clientSlug, projectSlug, capability} de l'URL courante
// (/public/:clientSlug/:projectSlug/:capability) -- Lot B, remplace la
// déduction précédente par UUID projet. L'UUID interne n'apparaît plus
// jamais dans l'URL navigateur.
function getPublicPathFromUrl() {
  const match = window.location.pathname.match(/\/public\/([^/]+)\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  return { clientSlug: match[1], projectSlug: match[2], capability: match[3] };
}

// prefixRelativeAssetUrls -- le Compiler émet des références RELATIVES
// ("assets/<id>.<ext>", jamais l'UUID projet ni /public/ en dur --
// voir compiler.js). Le Runtime les complète avec sa base publique
// courante au moment du rendu. Ceci n'est PAS un mécanisme de
// compatibilité avec un ancien format : c'est le contrat normal entre
// le Compiler (référence relative) et ce Runtime (résolution absolue),
// puisque l'identité publique peut tourner indépendamment d'une
// republication de contenu.
function prefixRelativeAssetUrls(manifestText, publicPath) {
  const base = `/public/${publicPath.clientSlug}/${publicPath.projectSlug}/${publicPath.capability}/assets/`;
  return manifestText.replace(/"assets\/([^"/]+)"/g, (_, filename) => `"${base}${filename}"`);
}

async function loadManifest(publicPath) {
  const res = await fetch(`/public/${publicPath.clientSlug}/${publicPath.projectSlug}/${publicPath.capability}/manifest`);
  if (res.status === 404) {
    throw new Error("Aucune publication n'existe encore pour ce projet.");
  }
  if (!res.ok) {
    throw new Error(`Le Manifest n'a pas pu être chargé (HTTP ${res.status}).`);
  }
  const text = await res.text();
  return JSON.parse(prefixRelativeAssetUrls(text, publicPath));
}

function validateSchemaVersion(manifest) {
  if (!SUPPORTED_SCHEMA_VERSIONS.includes(manifest.schemaVersion)) {
    throw new Error(
      `Version de Manifest non reconnue (schemaVersion=${JSON.stringify(manifest.schemaVersion)}). ` +
      `Ce Runtime ne devine jamais une version — il refuse de rendre plutôt que d'improviser.`
    );
  }
}

async function loadRenderer(editionId) {
  const rendererPath = RENDERERS[editionId];
  if (!rendererPath) {
    // Jamais de repli silencieux vers Ivory — une édition inconnue ou
    // pas encore migrée est une erreur explicite, pas une supposition.
    throw new Error(
      `Édition "${editionId}" non supportée par ce Runtime. ` +
      `Aucun repli automatique n'est appliqué.`
    );
  }
  const module = await import(rendererPath);
  if (typeof module.render !== 'function') {
    throw new Error(`Le renderer "${editionId}" ne fournit pas de fonction render() exploitable.`);
  }
  return module.render;
}

// ─────────────────────────────────────────────────────────────────
// Public Core : actions d'interaction fournies aux renderers.
// Un renderer rend l'UI et appelle ces fonctions ; il ne connaît
// jamais l'URL d'un endpoint, ni la façon dont la donnée est stockée.
// Aujourd'hui : escalade de contact + baromètre météo anonyme.
// Le renderer exprime une intention ; le Runtime reste propriétaire de
// l'endpoint et du payload. Le reste du tracking demeure hors renderer.
// ─────────────────────────────────────────────────────────────────
function buildPublicCoreActions(publicPath) {
  const telemetryUrl = `/public/${publicPath.clientSlug}/${publicPath.projectSlug}/${publicPath.capability}/telemetry`;
  return {
    async submitContact({ name, email, message }) {
      try {
        const res = await fetch('/api/public/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, message })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) return { ok: true };
        return { ok: false, error: data.error || 'Envoi impossible.' };
      } catch (e) {
        return { ok: false, error: 'Connexion au serveur impossible.' };
      }
    },

    async submitMood({ value }) {
      const numericValue = Math.round(Number(value));
      if (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > 5) {
        return { ok: false, error: 'Ressenti invalide.' };
      }
      try {
        const res = await fetch(telemetryUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // Doctrine Pilotage verrouillée : "Storm mesure le changement,
          // pas les collaborateurs." Aucune identité ni session envoyée
          // pour la météo — seule catégorie de donnée réellement
          // anonyme dès la collecte, jamais seulement pseudonyme.
          body: JSON.stringify({ event: 'mood_feedback', value: numericValue })
        });
        // Réponse toujours 204 côté serveur (voir publicTelemetry.js) —
        // un échec de la promesse fetch elle-même (réseau) est la seule
        // vraie condition d'échec restante à distinguer ici.
        return { ok: res.ok };
      } catch (e) {
        return { ok: false, error: 'Connexion au serveur impossible.' };
      }
    },

    // Télémétrie silencieuse — jamais un échec visible pour le visiteur,
    // jamais une valeur de retour attendue par l'appelant (le renderer
    // ne doit pas avoir à gérer un état d'erreur pour un simple signal
    // d'usage). Un échec réseau ici ne doit strictement rien changer à
    // l'expérience du site public.
    trackPageView(path) {
      fetch(telemetryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'page_view', path: typeof path === 'string' ? path : undefined })
      }).catch(() => {});
    },

    // Contrat Storm Match V1 verrouillé : outcome + matchedEntryId (si
    // matched) + confidenceBucket -- jamais le texte recherché, jamais
    // une "intention" sémantique (dépend de Liquid Core, non construit,
    // voir addendum architecture Pilotage). matchedEntryId/
    // confidenceBucket restent optionnels : un appelant qui ne les
    // fournit pas encore ne casse rien, le serveur les traite comme
    // absents plutôt que de rejeter l'événement.
    trackMatchResult(outcome, { matchedEntryId, confidenceBucket } = {}) {
      if (outcome !== 'matched' && outcome !== 'disambiguated' && outcome !== 'abstained') return;
      fetch(telemetryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'match_result', outcome, matchedEntryId, confidenceBucket })
      }).catch(() => {});
    }
  };
}

async function boot() {
  const publicPath = getPublicPathFromUrl();
  if (!publicPath) {
    renderFatalError('URL invalide : accès public introuvable.');
    return;
  }

  let manifest;
  try {
    manifest = await loadManifest(publicPath);
    validateSchemaVersion(manifest);
  } catch (err) {
    renderFatalError(err.message);
    return;
  }

  let render;
  try {
    render = await loadRenderer(manifest.edition.id);
  } catch (err) {
    renderFatalError(err.message);
    return;
  }

  const root = document.getElementById('tectonic-root') || document.body;
  const actions = buildPublicCoreActions(publicPath);

  // Une erreur DANS le rendu (bug du renderer, donnée inattendue) ne
  // doit jamais produire une exception JS non gérée côté visiteur —
  // elle doit produire le même état fatal propre que les autres échecs.
  try {
    render(manifest, root, actions);
  } catch (err) {
    renderFatalError(`Le rendu a échoué : ${err.message}`);
  }
}

boot();

// Exports pour les tests unitaires.
export { loadManifest, validateSchemaVersion, loadRenderer, buildPublicCoreActions, renderFatalError, getPublicPathFromUrl, SUPPORTED_SCHEMA_VERSIONS, RENDERERS };
