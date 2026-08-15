import { Errors } from '../../errors/AppError.js';
import { findTenantMembershipForUser } from '../../domain/memberships/repository.js';
import { bundleHasOrganizationCapability } from '../../domain/permissions/capabilities.js';

// Vérifie une ou plusieurs capabilities ORGANISATIONNELLES (ex.
// projects.create, ou [control.access, projects.view_all] pour Storm
// Control — toutes requises), jamais une capability de projet — voir
// requireProjectCapability.js pour l'équivalent project-scoped. UI
// capability != authorization serveur : le fait d'avoir pu ouvrir
// l'interface n'autorise jamais l'action, seule cette vérification
// serveur le fait. Une seule requête DB même avec plusieurs
// capabilities à vérifier.
export function requireOrganizationCapability(pool, capabilityOrCapabilities) {
  const required = Array.isArray(capabilityOrCapabilities) ? capabilityOrCapabilities : [capabilityOrCapabilities];

  return async (req, res, next) => {
    const tenantMembership = await findTenantMembershipForUser(pool, req.user.id);

    if (!tenantMembership) {
      next(Errors.forbidden('Aucune appartenance active à une organisation.'));
      return;
    }

    const missing = required.filter(cap => !bundleHasOrganizationCapability(tenantMembership.permission_bundle, cap));
    if (missing.length > 0) {
      next(Errors.forbidden(`Cette action nécessite la capability "${missing[0]}".`));
      return;
    }

    req.tenantMembership = tenantMembership;
    next();
  };
}
