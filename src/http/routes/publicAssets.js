import { Router } from 'express';
import { findAsset } from '../../domain/project-setup/repository.js';
import { findActivePublication } from '../../domain/publication/repository.js';
import { Errors } from '../../errors/AppError.js';

// Assets publics — Slice 1, option A (arbitrée).
//
// AUCUNE authentification Storm. La visibilité publique d'un asset
// n'est JAMAIS décidée par Studio vivant (l'asset existe-t-il ?
// appartient-il à ce projet ?) mais exclusivement par la publication
// ACTIVE du projet : cet assetId est-il référencé quelque part dans
// son manifest ? C'est la frontière d'immuabilité elle-même qui sert
// de contrôle d'accès.
//
// Politique V1 pragmatique, documentée explicitement comme telle, pas
// une garantie éternelle : elle repose sur l'absence ACTUELLE de toute
// suppression ou mutation physique de fichier (vérifié pendant l'audit
// Phase 2D — aucun code ne supprime un fichier du disque ni une ligne
// `assets` aujourd'hui). Le jour où une fonctionnalité de suppression
// physique, de remplacement binaire en place, ou un CDN/versioning
// apparaît, cette politique doit être réexaminée — la copie par
// publication ou le stockage content-addressed deviennent alors des
// options à reconsidérer sérieusement.
function manifestReferencesAsset(manifest, assetId) {
  const needle = String(assetId);
  const seen = new Set();
  function walk(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.includes(needle);
    if (Array.isArray(value)) return value.some(walk);
    if (typeof value === 'object') {
      if (seen.has(value)) return false;
      seen.add(value);
      return Object.values(value).some(walk);
    }
    return false;
  }
  return walk(manifest);
}

export function createPublicAssetsRouter({ pool, storageAdapter }) {
  const router = Router();

  router.get('/projects/:projectId/assets/:assetId', async (req, res, next) => {
    const publication = await findActivePublication(pool, req.params.projectId);
    if (!publication || !publication.manifest) {
      next(Errors.notFound('Fichier'));
      return;
    }
    if (!manifestReferencesAsset(publication.manifest, req.params.assetId)) {
      next(Errors.notFound('Fichier'));
      return;
    }
    // La publication référence bien cet id -- l'asset lui-même doit
    // aussi exister réellement ET appartenir à ce projet précis
    // (jamais fait confiance à une simple correspondance de chaîne
    // dans le manifest sans revérifier au niveau DB).
    const asset = await findAsset(pool, req.params.assetId);
    if (!asset || String(asset.project_id) !== String(req.params.projectId)) {
      next(Errors.notFound('Fichier'));
      return;
    }
    try {
      const buffer = await storageAdapter.read(asset.storage_key);
      res.status(200).set('Content-Type', asset.content_type).send(buffer);
    } catch (err) {
      next(Errors.notFound('Fichier'));
    }
  });

  return router;
}
