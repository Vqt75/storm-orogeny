import { Router } from 'express';
import { requireOrganizationCapability } from '../middleware/requireOrganizationCapability.js';
import { OrganizationCapability } from '../../domain/permissions/capabilities.js';
import { listAllProjectsForTenant, listTenantMembers } from '../../domain/control/repository.js';

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
