// Garde-fou "dernier administrateur" -- UNIQUE définition dans tout le
// système, capability-based, jamais une comparaison de nom de bundle.
// Réutilisé par toute révocation (grant individuel, désactivation de
// mapping en cascade) qui pourrait retirer la dernière autorité
// administrative effective d'une cible (projet ou organisation).
//
// Doctrine inchangée : les bundles facilitent l'administration, les
// permissions décident de l'autorisation -- ce helper interroge donc
// l'union des CAPABILITIES des grants restants, jamais le nom du
// bundle qui les porte. Si un jour un second bundle venait à porter
// la même capability administrative, ce helper resterait correct sans
// modification -- une comparaison de nom de bundle, elle, deviendrait
// silencieusement fausse.

import { projectCapabilitiesForBundle, organizationCapabilitiesForBundle, ProjectCapability, OrganizationCapability } from './capabilities.js';

// Calcule si, après exclusion hypothétique des grants listés dans
// excludingGrantIds, il resterait encore au moins un grant actif dont
// les capabilities effectives incluent la capability administrative
// demandée -- pour un projet OU une organisation, jamais mélangés.
export async function hasAdministrativeCapabilityRemaining(pool, { targetType, targetId, excludingGrantIds, capability }) {
  const excluded = excludingGrantIds && excludingGrantIds.length > 0 ? excludingGrantIds : [null];

  if (targetType === 'project') {
    const { rows } = await pool.query(
      `select permission_bundle from project_grants
       where project_id = $1 and status = 'active' and not (id = any($2::uuid[]))`,
      [targetId, excluded]
    );
    return rows.some(r => projectCapabilitiesForBundle(r.permission_bundle).includes(capability));
  }

  if (targetType === 'organization') {
    const { rows } = await pool.query(
      `select og.permission_bundle from organization_grants og
       where og.tenant_id = $1 and og.status = 'active' and not (og.id = any($2::uuid[]))`,
      [targetId, excluded]
    );
    return rows.some(r => organizationCapabilitiesForBundle(r.permission_bundle).includes(capability));
  }

  throw new Error(`targetType inconnu : ${targetType}`);
}

// Capabilities administratives de référence pour chaque type de
// cible -- celles dont l'absence totale rendrait la cible
// inadministrable. Un seul endroit qui les nomme, jamais dupliqué.
// Capabilities administratives de référence pour chaque type de
// cible -- celles dont l'absence totale rendrait la cible
// inadministrable. Un seul endroit qui les nomme, jamais dupliqué.
//
// Choix audité explicitement (pas une intuition) : le modèle
// organisationnel actuel ne compte que deux bundles -- 'member' (zéro
// capability) et 'organization_admin' (les huit capabilities
// organisationnelles, EXTERNAL_IDENTITY_MANAGE comprise) -- ce qui
// rend aujourd'hui EXTERNAL_IDENTITY_MANAGE et MEMBERS_MANAGE
// mathématiquement équivalents comme discriminants (aucun bundle
// intermédiaire ne les sépare). Le choix retenu, MEMBERS_MANAGE, est
// néanmoins le seul sémantiquement correct : c'est le véritable
// analogue organisationnel de ProjectCapability.PROJECT_MANAGE déjà
// retenu pour les projets -- "gérer qui appartient à cette portée et
// ses accès", exactement ce dont la disparition rend une cible
// inadministrable. EXTERNAL_IDENTITY_MANAGE reste une capability
// étroite (configuration SSO/mappings), co-présente aujourd'hui avec
// l'administration générale par décision explicite du bundle, mais ne
// représente jamais cette autorité elle-même -- un futur bundle qui
// l'accorderait seule (ex. un rôle "configurateur SSO" restreint) ne
// devrait jamais compter comme "dernier administrateur".
export const ADMINISTRATIVE_CAPABILITY = Object.freeze({
  project: ProjectCapability.PROJECT_MANAGE,
  organization: OrganizationCapability.MEMBERS_MANAGE
});
