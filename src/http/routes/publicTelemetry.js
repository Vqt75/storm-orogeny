import { Router } from 'express';
import { recordPageView, recordMatchResult, recordMoodFeedback } from '../../domain/pilotage/telemetry.js';
import { resolvePublicAccess } from '../../domain/publicAccess/repository.js';

// Collecte télémétrie — JAMAIS authentifiée (un visiteur anonyme
// d'Ivory doit pouvoir l'appeler, même doctrine que les assets
// publics). Le projet est déterminé PAR L'URL, jamais par le corps de
// la requête -- le client ne déclare jamais son tenant (voir addendum
// verrouillé).
//
// Réponse toujours 204 immédiate même en cas d'échec d'écriture -- un
// visiteur ne doit jamais voir la moindre erreur de télémétrie, jamais
// attendre. C'est une doctrine délibérée, pas un oubli de gestion
// d'erreur : voir trackPageView/trackMatchResult (runtime.js), déjà
// conçus comme "fire and forget" côté client.

const VISITOR_COOKIE = 'storm_visitor';
const VISITOR_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 jours glissants (verrouillé)
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseVisitorRef(req) {
  const header = req.headers.cookie || '';
  const match = header.split(';').map(s => s.trim()).find(s => s.startsWith(`${VISITOR_COOKIE}=`));
  if (!match) return null;
  const value = match.slice(VISITOR_COOKIE.length + 1);
  return UUID_PATTERN.test(value) ? value : null;
}

function setVisitorCookie(res, visitorRef) {
  // HttpOnly -- le client n'a jamais besoin de lire cette valeur en
  // JS, seulement de la renvoyer. SameSite=Lax suffit (jamais de
  // requête cross-site nécessaire pour ce cookie). Renouvelée à
  // CHAQUE écriture -- fenêtre glissante, jamais un pseudonyme qui
  // devient de facto permanent par simple usage continu.
  res.setHeader('Set-Cookie', `${VISITOR_COOKIE}=${visitorRef}; Path=/; Max-Age=${VISITOR_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax; HttpOnly`);
}

// FERMETURE (Privacy V1, Batch 8, seconde passe) : une whitelist de
// caractères n'est jamais une whitelist sémantique -- des chaînes
// comme "julien-dupont" ou "monproblemeconfidentiel" respectaient la
// précédente grammaire [a-zA-Z0-9\-_/]+ sans être des routes
// légitimes. Univers réel confirmé EXHAUSTIVEMENT par audit direct du
// template Ivory (public/ivory/renderers/ivory.js) : les pages sont
// exactement les 7 sections top-level `.tct-main > .tct-section`
// existant dans le template (id="home", "timeline", "spaces", "news",
// "questions", "ambassadors", "team" -- comptées et vérifiées une par
// une, aucune autre section top-level n'existe). Le client collapse
// déjà les routes dynamiques news-<slug>/space-<slug> vers
// 'news'/'spaces' AVANT d'appeler trackPageView -- mais SEULEMENT ces
// deux préfixes ; toute AUTRE valeur de hash (y compris un hash
// arbitraire jamais rendu, qui retombe visuellement sur #home) est
// transmise TELLE QUELLE à trackPageView. Le serveur ne dépend donc
// jamais du fait que le frontend ait déjà canonicalisé -- même
// canonicalisation reproduite ici, en defense in depth.
//
// Toute valeur hors de cet univers connu -> null, jamais stockée sous
// une forme partielle/déformée (jamais "other:<raw>").
const CANONICAL_TELEMETRY_PATH_CATEGORIES = new Set([
  'home', 'timeline', 'spaces', 'news', 'questions', 'ambassadors', 'team'
]);

export function normalizeTelemetryPath(rawPath) {
  if (typeof rawPath !== 'string') return null;
  const trimmed = rawPath.trim();
  if (trimmed.length === 0) return null;
  if (/^([a-z][a-z0-9+.-]*:)?\/\//i.test(trimmed)) return null; // URL absolue -- refusée entièrement.

  const withoutQueryOrFragment = trimmed.split('?')[0].split('#')[0];
  if (withoutQueryOrFragment.length === 0) return null;

  // Tolère un éventuel slash de tête (le client actuel n'en envoie
  // jamais, mais rien n'empêche structurellement une valeur "/home") --
  // jamais une nouvelle catégorie inventée, uniquement une variante de
  // format des mêmes catégories réelles.
  let candidate = withoutQueryOrFragment.replace(/^\/+/, '');

  // Canonicalisation des routes dynamiques réelles -- reproduit
  // exactement la même règle que le client (defense in depth, jamais
  // une dépendance à ce que le client l'ait déjà fait).
  if (candidate.startsWith('news-')) candidate = 'news';
  else if (candidate.startsWith('space-')) candidate = 'spaces';

  if (!CANONICAL_TELEMETRY_PATH_CATEGORIES.has(candidate)) return null;
  return candidate;
}

export function createPublicTelemetryRouter({ pool }) {
  const router = Router();

  router.post('/:clientSlug/:projectSlug/:capability/telemetry', async (req, res) => {
    // Toujours 204, y compris en cas d'accès invalide -- ne jamais
    // laisser une réponse d'erreur renseigner un tiers sur l'existence
    // ou le statut d'un accès public via cet endpoint non authentifié.
    res.status(204);

    const { clientSlug, projectSlug, capability } = req.params;
    const resolution = await resolvePublicAccess(pool, { clientSlug, projectSlug, rawCapability: capability }).catch(() => null);
    // Seul un accès ACTIF enregistre de la télémétrie -- jamais pour
    // unpublished/revoked/inconnu (silencieux, doctrine déjà en place).
    // La capability brute ne sert qu'à cette résolution -- jamais
    // transmise à recordPageView/recordMoodFeedback/recordMatchResult,
    // jamais persistée.
    if (!resolution || resolution.kind !== 'active') { res.end(); return; }
    const { projectId, tenantId } = resolution;

    const body = req.body || {};
    const now = new Date();

    try {
      if (body.event === 'mood_feedback') {
        const value = Math.round(Number(body.value));
        if (Number.isInteger(value) && value >= 1 && value <= 5) {
          await recordMoodFeedback(pool, { tenantId, projectId, value, now });
        }
      } else if (body.event === 'page_view' || body.event === 'match_result') {
        let visitorRef = parseVisitorRef(req);
        if (!visitorRef) visitorRef = crypto.randomUUID();
        setVisitorCookie(res, visitorRef);

        if (body.event === 'page_view') {
          const path = normalizeTelemetryPath(body.path);
          await recordPageView(pool, { tenantId, projectId, visitorRef, path, now });
        } else {
          const outcome = ['matched', 'disambiguated', 'abstained'].includes(body.outcome) ? body.outcome : null;
          if (outcome) {
            const matchedEntryId = outcome === 'matched' && UUID_PATTERN.test(body.matchedEntryId || '') ? body.matchedEntryId : null;
            const confidenceBucket = ['high', 'medium', 'low'].includes(body.confidenceBucket) ? body.confidenceBucket : null;
            await recordMatchResult(pool, { tenantId, projectId, visitorRef, outcome, matchedEntryId, confidenceBucket, now });
          }
        }
      }
    } catch (err) {
      // Silencieux, volontairement -- voir doctrine d'en-tête.
    }

    res.end();
  });

  return router;
}
