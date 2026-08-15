import { Router } from 'express';
import { findAsset } from '../../domain/project-setup/repository.js';
import { findAccessibleProjectForUser } from '../../domain/projects/repository.js';
import { Errors } from '../../errors/AppError.js';

export function createAssetsRouter({ pool, storageAdapter }) {
  const router = Router();

  // Service du fichier — protégé : il faut une relation réelle avec le
  // projet propriétaire (même principe que GET /api/projects/:id,
  // jamais un simple fichier statique public).
  router.get('/:assetId', async (req, res, next) => {
    const asset = await findAsset(pool, req.params.assetId);
    if (!asset) {
      next(Errors.notFound('Fichier'));
      return;
    }
    const accessible = await findAccessibleProjectForUser(pool, { userId: req.user.id, projectId: asset.project_id });
    if (!accessible) {
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
