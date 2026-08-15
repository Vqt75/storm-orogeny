import { Router } from 'express';
import { findTenantMembershipForUser } from '../../domain/memberships/repository.js';
import { organizationCapabilitiesForBundle } from '../../domain/permissions/capabilities.js';

export function createMeRouter({ pool }) {
  const router = Router();

  router.get('/', async (req, res) => {
    const tenantMembership = await findTenantMembershipForUser(pool, req.user.id);

    res.status(200).json({
      id: req.user.id,
      displayName: req.user.display_name,
      // Identité + organisation utile — jamais une décharge de toutes
      // les tables (voir le cadrage de ce milestone).
      //
      // capabilities ici = capabilities ORGANISATIONNELLES uniquement,
      // calculées côté serveur depuis le bundle (jamais le nom du
      // bundle exposé tel quel). Ne jamais agréger de capabilities
      // provenant de project_memberships dans ce tableau — un droit
      // n'existe pas seulement par son nom, il existe dans un
      // contexte. content.edit sur un projet n'est pas content.edit
      // sur tout Storm ; les capabilities de projet resteront
      // attachées à leur contexte projet le moment venu.
      organization: tenantMembership ? {
        id: tenantMembership.tenant_id,
        name: tenantMembership.tenant_name,
        capabilities: organizationCapabilitiesForBundle(tenantMembership.permission_bundle)
      } : null
    });
  });

  return router;
}
