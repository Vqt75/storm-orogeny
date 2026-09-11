import { AppError, Errors } from '../errors/AppError.js';

// redactPublicPath -- la capability d'Accès Public (3e segment de
// /public/:clientSlug/:projectSlug/:capability(/...)) ne doit JAMAIS
// apparaître en clair dans un log, y compris une erreur serveur.
// Remplacée par un marqueur stable -- le reste du chemin (client/projet/
// famille de route : manifest/assets/telemetry) reste lisible, utile
// au diagnostic.
function redactPublicPath(path) {
  if (typeof path !== 'string') return path;
  return path.replace(/^(\/public\/[^/]+\/[^/]+)\/[^/]+/, '$1/[REDACTED]');
}

// Un seul endroit où une erreur devient une réponse HTTP. Toute erreur
// non structurée (bug non anticipé) est loggée en entier côté serveur,
// mais jamais renvoyée en détail au client — une AppError générique
// "internal" est renvoyée à la place.
export function errorHandler(logger) {
  return (err, req, res, next) => { // eslint-disable-line no-unused-vars
    if (err instanceof AppError) {
      if (err.status >= 500) logger.error({ err, path: redactPublicPath(req.path) }, 'Erreur serveur');
      res.status(err.status).json(err.toJSON());
      return;
    }
    logger.error({ err, path: redactPublicPath(req.path) }, 'Erreur non structurée — bug à corriger, pas seulement à attraper');
    const fallback = Errors.internal();
    res.status(fallback.status).json(fallback.toJSON());
  };
}

export function notFoundHandler(req, res) {
  const err = Errors.notFound('Route');
  res.status(err.status).json(err.toJSON());
}
