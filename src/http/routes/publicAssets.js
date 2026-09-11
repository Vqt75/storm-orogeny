import { Router } from 'express';
import { findAsset } from '../../domain/project-setup/repository.js';
import { findActivePublication } from '../../domain/publication/repository.js';
import { resolvePublicAccess } from '../../domain/publicAccess/repository.js';
import { Errors } from '../../errors/AppError.js';

// Assets publics — Lot B : la résolution d'Accès Public (client/projet
// slugs + capability) précède TOUJOURS la résolution d'asset -- jamais
// l'UUID projet dans le chemin. Frontière de confiance déjà établie
// conservée à l'identique : un asset n'est servable que s'il est
// référencé par le Manifest de la publication ACTIVE, revérifié en
// base (jamais une simple correspondance de chaîne).
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

const EXTENSION_TO_MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  pdf: 'application/pdf',
  woff2: 'font/woff2',
  woff: 'font/woff',
  otf: 'font/otf',
  ttf: 'font/ttf'
};

function parseAssetIdWithExtension(raw) {
  const dotIndex = raw.lastIndexOf('.');
  if (dotIndex <= 0) return null;
  return { assetId: raw.slice(0, dotIndex), extension: raw.slice(dotIndex + 1).toLowerCase() };
}

export function createPublicAssetsRouter({ pool, storageAdapter }) {
  const router = Router();

  router.use((req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  router.get('/:clientSlug/:projectSlug/:capability/assets/:assetIdWithExt', async (req, res, next) => {
    const parsed = parseAssetIdWithExtension(req.params.assetIdWithExt);
    if (!parsed) {
      next(Errors.notFound('Fichier'));
      return;
    }
    const { assetId, extension } = parsed;

    const { clientSlug, projectSlug, capability } = req.params;
    const resolution = await resolvePublicAccess(pool, { clientSlug, projectSlug, rawCapability: capability });
    if (resolution.kind === 'revoked') {
      res.status(410).json({ ok: false, error: { code: 'GONE', message: 'Ce lien n’est plus actif.' } });
      return;
    }
    if (resolution.kind !== 'active') {
      next(Errors.notFound('Fichier'));
      return;
    }
    const projectId = resolution.projectId;

    const publication = await findActivePublication(pool, projectId);
    if (!publication || !publication.manifest) {
      next(Errors.notFound('Fichier'));
      return;
    }
    if (!manifestReferencesAsset(publication.manifest, assetId)) {
      next(Errors.notFound('Fichier'));
      return;
    }
    // La publication référence bien cet id -- l'asset lui-même doit
    // aussi exister réellement ET appartenir à CE projet précis résolu
    // via l'Accès Public (jamais fait confiance à une simple
    // correspondance de chaîne dans le manifest sans revérifier au
    // niveau DB) -- ceci empêche aussi qu'une capability valide pour
    // le projet A serve un asset du projet B.
    const asset = await findAsset(pool, assetId);
    if (!asset || String(asset.project_id) !== String(projectId)) {
      next(Errors.notFound('Fichier'));
      return;
    }
    if (EXTENSION_TO_MIME[extension] !== asset.content_type) {
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
