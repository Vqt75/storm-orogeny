import { Router } from 'express';
import { requireOrganizationCapability } from '../middleware/requireOrganizationCapability.js';
import { OrganizationCapability } from '../../domain/permissions/capabilities.js';
import { listAllProjectsForTenant, listTenantMembers, setProjectStatus } from '../../domain/control/repository.js';
import { Errors } from '../../errors/AppError.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createControlRouter({ pool }) {
  const router = Router();

  // control.access + projects.view_all — les deux vérifiées côté
  // serveur, jamais seulement masquées côté front (voir handoff).
  // Scope strict sur req.tenantMembership.tenant_id, jamais un
  // tenant_id fourni par le client.
  router.get(
    '/projects',
    requireOrganizationCapability(pool, [OrganizationCapability.CONTROL_ACCESS, OrganizationCapability.PROJECTS_VIEW_ALL]),
    async (req, res) => {
      const rows = await listAllProjectsForTenant(pool, req.tenantMembership.tenant_id);
      res.status(200).json(rows.map(r => ({
        id: r.id,
        name: r.name,
        status: r.status,
        createdAt: r.created_at
      })));
    }
  );

  // Archiver / restaurer un projet — cycle de vie, jamais une
  // suppression (audité séparément : implications FK/publications/
  // assets non résolues, décision produit distincte). Réutilise
  // exactement les mêmes capabilities que la liste elle-même : cette
  // action reste de l'administration transverse, pas une capability
  // de projet. Storm Home filtre déjà `status='active'` (voir
  // listProjectsForUser) — archiver ici suffit à faire disparaître le
  // projet des listes actives, sans changement côté lecture.
  async function transitionStatus(req, res, next, newStatus) {
    if (!UUID_PATTERN.test(req.params.projectId)) {
      next(Errors.notFound('Projet'));
      return;
    }
    const updated = await setProjectStatus(pool, req.tenantMembership.tenant_id, req.params.projectId, newStatus);
    if (!updated) {
      next(Errors.notFound('Projet'));
      return;
    }
    res.status(200).json({
      id: updated.id,
      name: updated.name,
      status: updated.status,
      createdAt: updated.created_at
    });
  }

  router.post(
    '/projects/:projectId/archive',
    requireOrganizationCapability(pool, [OrganizationCapability.CONTROL_ACCESS, OrganizationCapability.PROJECTS_VIEW_ALL]),
    (req, res, next) => transitionStatus(req, res, next, 'archived')
  );

  router.post(
    '/projects/:projectId/restore',
    requireOrganizationCapability(pool, [OrganizationCapability.CONTROL_ACCESS, OrganizationCapability.PROJECTS_VIEW_ALL]),
    (req, res, next) => transitionStatus(req, res, next, 'active')
  );

  router.get(
    '/members',
    requireOrganizationCapability(pool, [OrganizationCapability.CONTROL_ACCESS, OrganizationCapability.MEMBERS_MANAGE]),
    async (req, res) => {
      const rows = await listTenantMembers(pool, req.tenantMembership.tenant_id);
      res.status(200).json(rows.map(r => ({
        id: r.id,
        email: r.email,
        displayName: r.display_name,
        permissionBundle: r.permission_bundle,
        status: r.status,
        createdAt: r.created_at
      })));
    }
  );

  return router;
}
