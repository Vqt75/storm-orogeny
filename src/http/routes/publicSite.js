import { Router } from 'express';
import path from 'node:path';
import { findActivePublication } from '../../domain/publication/repository.js';
import { resolvePublicAccess } from '../../domain/publicAccess/repository.js';

// Site public — identité d'Accès Public dédiée (Lot B), jamais l'UUID
// interne du projet. AUCUNE authentification Storm : la visibilité
// publique n'est jamais décidée par Studio vivant, seulement par le
// statut de l'Accès Public résolu ci-dessous.
//
// Sémantique HTTP par statut (doctrine figée) :
//   active + slugs/capability exacts  -> 200
//   unpublished (même chemin exact)   -> 404 neutre (jamais distinct d'un chemin inconnu)
//   capability/chemin inconnu         -> 404 neutre
//   revoked (chemin historique exact) -> 410, jamais un indice vers le nouveau lien
export function createPublicSiteRouter({ pool, publicDir }) {
  const router = Router();

  // noindex + no-referrer sur TOUTE réponse de ce router, y compris
  // 404/410 -- jamais seulement sur le cas de succès. Scopé
  // exclusivement à la livraison publique, jamais à Studio authentifié.
  router.use((req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  async function resolveOrRespond(req, res) {
    const { clientSlug, projectSlug, capability } = req.params;
    const resolution = await resolvePublicAccess(pool, { clientSlug, projectSlug, rawCapability: capability });
    if (resolution.kind === 'revoked') {
      res.status(410).json({ ok: false, error: { code: 'GONE', message: 'Ce lien n’est plus actif.' } });
      return null;
    }
    if (resolution.kind !== 'active') {
      res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Page introuvable.' } });
      return null;
    }
    return resolution.projectId;
  }

  router.get('/:clientSlug/:projectSlug/:capability/manifest', async (req, res, next) => {
    try {
      const projectId = await resolveOrRespond(req, res);
      if (!projectId) return;
      const publication = await findActivePublication(pool, projectId);
      if (!publication || !publication.manifest) {
        res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Page introuvable.' } });
        return;
      }
      // Jamais mis en cache — une nouvelle publication active doit
      // être visible immédiatement au rechargement.
      res.status(200).set('Cache-Control', 'no-store').json(publication.manifest);
    } catch (err) { next(err); }
  });

  router.get('/:clientSlug/:projectSlug/:capability', async (req, res, next) => {
    try {
      const projectId = await resolveOrRespond(req, res);
      if (!projectId) return;
      // Un seul fichier statique pour tous les projets : le runtime
      // déduit lui-même client/projet/capability depuis l'URL courante
      // (voir public/ivory/runtime.js) -- aucune donnée à injecter ici.
      res.sendFile(path.join(publicDir, 'ivory', 'index.html'));
    } catch (err) { next(err); }
  });

  return router;
}
