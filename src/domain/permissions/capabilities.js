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
  // Gestion du LIFECYCLE d'un projet (transitions actif/stabilisation/
  // archivage/restauration) -- volontairement distincte de
  // PROJECTS_VIEW_ALL (visibilité pure, jamais une mutation) et de
  // MEMBERS_MANAGE (gestion des personnes, jamais du cycle de vie).
  // Aucune capability existante n'était sémantiquement correcte pour
  // ce besoin -- vérifié explicitement avant d'en ajouter une nouvelle,
  // suit le même motif que PROJECTS_MANAGE_MEMBERSHIPS déjà établi.
  PROJECTS_MANAGE_LIFECYCLE: 'projects.manage_lifecycle',
  MEMBERS_MANAGE: 'organization.members.manage',
  SETTINGS_MANAGE: 'organization.settings.manage',
  // Suppression définitive d'un projet -- distincte de la gestion du
  // lifecycle (archiver/restaurer, déjà couverte par CONTROL_ACCESS+
  // PROJECTS_VIEW_ALL). Jamais accordée implicitement à project_admin
  // (capability de projet inexistante ici, uniquement organisationnelle)
  // ni automatiquement à organization_admin sans décision déliberée --
  // voir ORGANIZATION_BUNDLE_CAPABILITIES ci-dessous, volontairement
  // absente du bundle par défaut.
  PROJECTS_DELETE_PERMANENTLY: 'projects.delete_permanently',
  // Configuration des providers/mappings d'identité externe -- distincte
  // de members.manage (projet), jamais accordée par la seule
  // administration d'un projet (voir modèle conceptuel validé).
  EXTERNAL_IDENTITY_MANAGE: 'organization.external_identity.manage'
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
  // Décision explicite, délibérée : EXTERNAL_IDENTITY_MANAGE rejoint le
  // bundle par défaut (responsabilité de gouvernance organisationnelle
  // ordinaire, du même ordre que SETTINGS_MANAGE déjà présent).
  // PROJECTS_DELETE_PERMANENTLY en est volontairement EXCLU -- action
  // irréversible, jamais accordée automatiquement même à
  // organization_admin. Aucun utilisateur ne la possède par défaut tant
  // qu'un mécanisme d'attribution dédié n'existe pas (hors périmètre de
  // cette passe -- voir le compte rendu final).
  organization_admin: Object.freeze([
    OrganizationCapability.CONTROL_ACCESS,
    OrganizationCapability.PROJECTS_VIEW_ALL,
    OrganizationCapability.PROJECTS_CREATE,
    OrganizationCapability.PROJECTS_MANAGE_MEMBERSHIPS,
    OrganizationCapability.PROJECTS_MANAGE_LIFECYCLE,
    OrganizationCapability.MEMBERS_MANAGE,
    OrganizationCapability.SETTINGS_MANAGE,
    OrganizationCapability.EXTERNAL_IDENTITY_MANAGE
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
