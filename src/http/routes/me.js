import { Router } from 'express';
import { findTenantMembershipForUser } from '../../domain/memberships/repository.js';

export function createMeRouter({ pool }) {
  const router = Router();

  router.get('/', async (req, res) => {
    const tenantMembership = await findTenantMembershipForUser(pool, req.user.id);

    res.status(200).json({
      id: req.user.id,
      displayName: req.user.display_name,
      // Identité + organisation utile — jamais une décharge de toutes
      // les tables (voir le cadrage de ce milestone).
      organization: tenantMembership ? {
        id: tenantMembership.tenant_id,
        name: tenantMembership.tenant_name
      } : null
    });
  });

  return router;
}
