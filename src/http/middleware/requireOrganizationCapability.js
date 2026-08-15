import { Errors } from '../../errors/AppError.js';
import { findTenantMembershipForUser } from '../../domain/memberships/repository.js';
import { bundleHasOrganizationCapability } from '../../domain/permissions/capabilities.js';

// Vérifie une capability ORGANISATIONNELLE (ex. projects.create),
// jamais une capability de projet — voir requireProjectCapability.js
// pour l'équivalent project-scoped. UI capability != authorization
// serveur : le fait d'avoir pu ouvrir l'interface n'autorise jamais
// l'action, seule cette vérification serveur le fait.
export function requireOrganizationCapability(pool, capability) {
  return async (req, res, next) => {
    const tenantMembership = await findTenantMembershipForUser(pool, req.user.id);

    if (!tenantMembership) {
      next(Errors.forbidden('Aucune appartenance active à une organisation.'));
      return;
    }

    if (!bundleHasOrganizationCapability(tenantMembership.permission_bundle, capability)) {
      next(Errors.forbidden(`Cette action nécessite la capability "${capability}".`));
      return;
    }

    req.tenantMembership = tenantMembership;
    next();
  };
}
