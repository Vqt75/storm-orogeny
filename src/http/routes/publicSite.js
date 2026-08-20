import { Router } from 'express';
import path from 'node:path';
import { findActivePublication } from '../../domain/publication/repository.js';
import { Errors } from '../../errors/AppError.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Site public — branchement Ivory. AUCUNE authentification Storm, sur
// le même principe que les assets publics (Slice 1/2) : la visibilité
// publique n'est jamais décidée par Studio vivant, seulement par la
// publication ACTIVE du projet.
//
// Deux routes, volontairement séparées (coquille HTML vs donnée) —
// exactement la séparation déjà éprouvée côté Tectonic entre
// tectonic.html (jamais régénéré, un seul fichier statique pour tous
// les projets, le projectId est déduit de l'URL par le runtime
// lui-même) et /api/manifest (la donnée, jamais mise en cache).
export function createPublicSiteRouter({ pool, publicDir }) {
  const router = Router();

  router.get('/projects/:projectId/manifest', async (req, res, next) => {
    if (!UUID_PATTERN.test(req.params.projectId)) {
      next(Errors.notFound('Publication'));
      return;
    }
    const publication = await findActivePublication(pool, req.params.projectId);
    if (!publication || !publication.manifest) {
      next(Errors.notFound('Publication'));
      return;
    }
    // Jamais mis en cache — une nouvelle publication active doit être
    // visible immédiatement au rechargement, jamais servie périmée
    // depuis un cache intermédiaire (même principe que Tectonic).
    res.status(200).set('Cache-Control', 'no-store').json(publication.manifest);
  });

  router.get('/projects/:projectId', (req, res, next) => {
    if (!UUID_PATTERN.test(req.params.projectId)) {
      next();
      return;
    }
    // Un seul fichier statique pour tous les projets : le runtime
    // déduit lui-même le projectId depuis l'URL courante (voir
    // public/ivory/runtime.js) -- aucune donnée à injecter ici.
    res.sendFile(path.join(publicDir, 'ivory', 'index.html'));
  });

  return router;
}
