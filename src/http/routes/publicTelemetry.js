import { Router } from 'express';
import { recordPageView, recordMatchResult, recordMoodFeedback } from '../../domain/pilotage/telemetry.js';
import { findActiveProjectTenant } from '../../domain/pilotage/reporting.js';

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

// FERMETURE (Privacy V1, Batch 8) : path est un champ texte fourni par
// le client -- audité, la chaîne réelle vient du hash SPA d'Ivory
// (window.location.hash côté runtime.js/ivory.js), normalisée pour
// les routes news-/space- mais transmise TELLE QUELLE pour toute
// autre valeur -- un visiteur naviguant manuellement vers un hash
// arbitraire (#texte-libre, #email@exemple.com, etc.) verrait cette
// chaîne arbitraire atteindre ce endpoint. Un simple .slice(0,80) ne
// bornait que la longueur, jamais la structure -- normalisation
// structurelle stricte ici, jamais une allowlist exhaustive des
// routes connues :
//   - toute URL absolue (http://, https://, //) refusée entièrement;
//   - query string et fragment retirés (ne conserve que ce qui
//     précède le premier ? ou #, défense en profondeur même si le
//     hash SPA ne devrait déjà plus en contenir à ce stade);
//   - uniquement lettres/chiffres/tiret/underscore/slash acceptés --
//     jamais un espace, une arobase, ou tout caractère pouvant porter
//     un texte libre/PII;
//   - longueur bornée à 80 caractères, appliquée APRÈS validation
//     structurelle (jamais un simple tronquage d'un texte libre qui
//     laisserait jusqu'à 80 caractères de PII passer).
// Toute valeur ne respectant pas cette structure est refusée
// (retourne null, jamais persistée) plutôt que neutralisée/déformée en
// une valeur plausible mais fausse.
const SAFE_TELEMETRY_PATH_PATTERN = /^[a-zA-Z0-9\-_/]+$/;

export function normalizeTelemetryPath(rawPath) {
  if (typeof rawPath !== 'string') return null;
  const trimmed = rawPath.trim();
  if (trimmed.length === 0) return null;
  if (/^([a-z][a-z0-9+.-]*:)?\/\//i.test(trimmed)) return null; // URL absolue -- refusée entièrement.

  const withoutQueryOrFragment = trimmed.split('?')[0].split('#')[0];
  if (withoutQueryOrFragment.length === 0) return null;
  if (!SAFE_TELEMETRY_PATH_PATTERN.test(withoutQueryOrFragment)) return null;

  return withoutQueryOrFragment.slice(0, 80);
}

export function createPublicTelemetryRouter({ pool }) {
  const router = Router();

  router.post('/projects/:projectId/telemetry', async (req, res) => {
    // Toujours 204, y compris en cas de projet invalide -- ne jamais
    // laisser une réponse d'erreur renseigner un tiers sur l'existence
    // ou le statut d'un projet via cet endpoint non authentifié.
    res.status(204);

    const tenantId = await findActiveProjectTenant(pool, req.params.projectId).catch(() => null);
    if (!tenantId) { res.end(); return; }

    const body = req.body || {};
    const projectId = req.params.projectId;
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
