// Capabilities — définition centrale, testable isolément. Le code
// applicatif demande toujours une capability précise, jamais un nom de
// bundle. Voir docs/contracts/permissions.md pour la doctrine complète.

export const ProjectCapability = Object.freeze({
  VIEW: 'project.view',
  CONTENT_EDIT: 'content.edit',
  PUBLICATION_PUBLISH: 'publication.publish',
  PILOTAGE_VIEW: 'pilotage.view',
  MEMBERS_MANAGE: 'members.manage',
  PROJECT_MANAGE: 'project.manage'
});

export const OrganizationCapability = Object.freeze({
  CONTROL_ACCESS: 'control.access',
  PROJECTS_VIEW_ALL: 'projects.view_all',
  PROJECTS_CREATE: 'projects.create',
  PROJECTS_MANAGE_MEMBERSHIPS: 'projects.manage_memberships',
  MEMBERS_MANAGE: 'organization.members.manage',
  SETTINGS_MANAGE: 'organization.settings.manage'
});

// Bundles de projet — un bundle principal par project_membership (V1).
// contributor ne publie pas ; editor publie ; pilot observe seulement ;
// project_admin a tout, y compris la gestion des accès du projet.
const PROJECT_BUNDLE_CAPABILITIES = Object.freeze({
  contributor: Object.freeze([ProjectCapability.VIEW, ProjectCapability.CONTENT_EDIT]),
  editor: Object.freeze([ProjectCapability.VIEW, ProjectCapability.CONTENT_EDIT, ProjectCapability.PUBLICATION_PUBLISH]),
  pilot: Object.freeze([ProjectCapability.VIEW, ProjectCapability.PILOTAGE_VIEW]),
  project_admin: Object.freeze([
    ProjectCapability.VIEW,
    ProjectCapability.CONTENT_EDIT,
    ProjectCapability.PUBLICATION_PUBLISH,
    ProjectCapability.PILOTAGE_VIEW,
    ProjectCapability.MEMBERS_MANAGE,
    ProjectCapability.PROJECT_MANAGE
  ])
});

// Bundles d'organisation — invariant central, ne jamais casser :
// organization_admin donne des capabilities ORGANISATIONNELLES
// (gouvernance/visibilité transverses), jamais de capability de PROJET
// implicite. Un organization_admin sans project_membership sur un
// projet donné n'a toujours AUCUNE capability de projet dessus.
const ORGANIZATION_BUNDLE_CAPABILITIES = Object.freeze({
  member: Object.freeze([]),
  organization_admin: Object.freeze([
    OrganizationCapability.CONTROL_ACCESS,
    OrganizationCapability.PROJECTS_VIEW_ALL,
    OrganizationCapability.PROJECTS_CREATE,
    OrganizationCapability.PROJECTS_MANAGE_MEMBERSHIPS,
    OrganizationCapability.MEMBERS_MANAGE,
    OrganizationCapability.SETTINGS_MANAGE
  ])
});

export function projectCapabilitiesForBundle(bundle) {
  return PROJECT_BUNDLE_CAPABILITIES[bundle] ?? [];
}

export function organizationCapabilitiesForBundle(bundle) {
  return ORGANIZATION_BUNDLE_CAPABILITIES[bundle] ?? [];
}

export function bundleHasProjectCapability(bundle, capability) {
  return projectCapabilitiesForBundle(bundle).includes(capability);
}

export function bundleHasOrganizationCapability(bundle, capability) {
  return organizationCapabilitiesForBundle(bundle).includes(capability);
}
