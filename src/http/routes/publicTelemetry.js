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
          const path = typeof body.path === 'string' ? body.path.slice(0, 80) : null;
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
