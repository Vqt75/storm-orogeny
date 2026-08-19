import { Router } from 'express';
import { requireProjectCapability } from '../middleware/requireProjectCapability.js';
import { ProjectCapability } from '../../domain/permissions/capabilities.js';
import { createPublication, findActivePublication, listPublications } from '../../domain/publication/repository.js';

function asyncHandler(fn) {
  return (req, res, next) => { fn(req, res, next).catch(next); };
}

// Publication — capability dédiée (publication.publish), distincte de
// content.edit. Déclencher une publication n'est pas éditer du
// contenu Studio, même si les deux sont souvent accordées ensemble
// (bundles editor/project_admin) — voir capabilities.js.
export function createPublicationRouter({ pool }) {
  const router = Router();

  router.post('/:projectId/publications', requireProjectCapability(pool, ProjectCapability.PUBLICATION_PUBLISH), asyncHandler(async (req, res) => {
    const result = await createPublication(pool, {
      tenantId: req.project.tenant_id,
      projectId: req.project.id,
      userId: req.user.id
    });
    if (result.status === 'failed') {
      res.status(422).json({ ok: false, revision: result.revision, status: 'failed', failureCode: result.failureCode, failureDetail: result.failureDetail });
      return;
    }
    res.status(201).json({ id: result.id, revision: result.revision, status: result.status, manifest: result.manifest });
  }));

  // Lecture de la publication active — c'est cette route, jamais un
  // accès direct à Studio, qu'Ivory est destinée à consommer à terme
  // (slice ultérieur). Volontairement protégée par la même capability
  // de vue que le reste de Studio pour l'instant : l'ouverture à un
  // accès public non authentifié est une décision distincte, pas un
  // sous-produit accidentel de ce slice.
  router.get('/:projectId/publications/active', requireProjectCapability(pool, ProjectCapability.VIEW), asyncHandler(async (req, res) => {
    const row = await findActivePublication(pool, req.project.id);
    if (!row) {
      res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Aucune publication active pour ce projet.' } });
      return;
    }
    res.status(200).json({
      id: row.id, revision: row.revision, status: row.status, manifest: row.manifest,
      compilerVersion: row.compiler_version, createdAt: row.created_at, compiledAt: row.compiled_at, activatedAt: row.activated_at
    });
  }));

  router.get('/:projectId/publications', requireProjectCapability(pool, ProjectCapability.VIEW), asyncHandler(async (req, res) => {
    const rows = await listPublications(pool, req.project.id);
    res.status(200).json(rows.map(r => ({
      id: r.id, revision: r.revision, status: r.status, compilerVersion: r.compiler_version,
      failureCode: r.failure_code, failureDetail: r.failure_detail,
      createdByUserId: r.created_by_user_id, createdAt: r.created_at, compiledAt: r.compiled_at, activatedAt: r.activated_at
    })));
  }));

  return router;
}
