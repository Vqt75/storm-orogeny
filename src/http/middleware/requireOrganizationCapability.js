import { Errors } from '../../errors/AppError.js';
import { findTenantMembershipForUser } from '../../domain/memberships/repository.js';
import { organizationCapabilitiesForBundle } from '../../domain/permissions/capabilities.js';

// Vérifie une ou plusieurs capabilities ORGANISATIONNELLES (ex.
// projects.create, ou [control.access, projects.view_all] pour Storm
// Control — toutes requises), jamais une capability de projet — voir
// requireProjectCapability.js pour l'équivalent project-scoped. UI
// capability != authorization serveur : le fait d'avoir pu ouvrir
// l'interface n'autorise jamais l'action, seule cette vérification
// serveur le fait.
//
// CORRECTION (Privacy V1, Batch 5 — fermeture) : ce middleware lisait
// jusqu'ici uniquement le bundle STATIQUE de la tenant_membership
// (tenantMembership.permission_bundle), jamais l'union des grants
// organisationnels ACTIFS -- en contradiction avec la doctrine déjà
// appliquée ailleurs (ex. listActiveTenantMembershipsForUser,
// hasAdministrativeCapabilityRemaining) : "effective permissions =
// union des active grants". Frontière structurelle, jamais spécifique
// à une seule route -- ce middleware est utilisé par les 14 routes
// Control existantes, corrigé ici une seule fois pour toutes.
// Vérifié avant correction : aujourd'hui, chaque tenant_membership
// seedée porte exactement un organization_grant actif au bundle
// identique -- aucune régression de comportement observable pour les
// données existantes, uniquement une frontière désormais correcte
// pour l'avenir (ex. un grant révoqué doit réellement retirer l'accès,
// jamais rester actif via le seul bundle statique résiduel).
export function requireOrganizationCapability(pool, capabilityOrCapabilities) {
  const required = Array.isArray(capabilityOrCapabilities) ? capabilityOrCapabilities : [capabilityOrCapabilities];

  return async (req, res, next) => {
    const tenantMembership = await findTenantMembershipForUser(pool, req.user.id);

    if (!tenantMembership) {
      next(Errors.forbidden('Aucune appartenance active à une organisation.'));
      return;
    }

    const { rows } = await pool.query(
      `select coalesce(array_agg(distinct og.permission_bundle) filter (where og.permission_bundle is not null), '{}') as active_bundles
       from tenant_memberships tm
       join organization_grants og on og.organization_membership_id = tm.id and og.status = 'active'
       where tm.tenant_id = $1 and tm.user_id = $2 and tm.status = 'active'`,
      [tenantMembership.tenant_id, req.user.id]
    );
    const activeBundles = rows[0].active_bundles;
    const effectiveCapabilities = new Set();
    for (const bundle of activeBundles) {
      for (const cap of organizationCapabilitiesForBundle(bundle)) {
        effectiveCapabilities.add(cap);
      }
    }

    const missing = required.filter(cap => !effectiveCapabilities.has(cap));
    if (missing.length > 0) {
      next(Errors.forbidden(`Cette action nécessite la capability "${missing[0]}".`));
      return;
    }

    req.tenantMembership = tenantMembership;
    next();
  };
}
