// Storm Match — couche de confiance : Accès Public résolu -> publication
// active -> corpus.js.
//
// Aucun appelant ne fournit jamais lui-même un Manifest, un
// publicationId ou une révision : tenant/projet viennent exclusivement
// de resolvePublicAccess, publication et Manifest exclusivement de la
// ligne project_publications active de CE projet. Impossible donc de
// combiner l'identité d'un projet A avec le Manifest d'un projet B.
//
// Jamais de lecture Studio (project_questions, brouillons), Control,
// Pilotage ou memberships : le corpus collaborateur ne connaît que ce
// qui a été publié.
import { resolvePublicAccess } from '../publicAccess/repository.js';
import { findActivePublication } from '../publication/repository.js';
import { publishedManifestToKnowledgeCorpus, CorpusState, UnavailableReason } from './corpus.js';

function unavailable(reason) {
  return Object.freeze({ state: CorpusState.UNAVAILABLE, reason, snapshot: null });
}

// Point d'entrée à partir d'une résolution d'Accès Public déjà obtenue
// (même forme que resolvePublicAccess : { kind: 'active', tenantId,
// projectId }). Toute autre résolution -> indisponible.
export async function activePublicationCorpusForAccess(pool, resolution) {
  if (!resolution || resolution.kind !== 'active' || !resolution.tenantId || !resolution.projectId) {
    return unavailable(UnavailableReason.NO_ACTIVE_PUBLICATION);
  }
  const { tenantId, projectId } = resolution;

  const publication = await findActivePublication(pool, projectId);
  if (!publication) return unavailable(UnavailableReason.NO_ACTIVE_PUBLICATION);

  // Binding vérifié sur la ligne elle-même -- jamais supposé depuis la
  // requête : tenant, projet et statut doivent correspondre exactement.
  if (publication.status !== 'active'
      || publication.tenant_id !== tenantId
      || publication.project_id !== projectId) {
    return unavailable(UnavailableReason.PUBLICATION_SCOPE_MISMATCH);
  }

  return publishedManifestToKnowledgeCorpus({
    tenantId,
    projectId,
    publicationId: publication.id,
    publicationRevision: publication.revision,
    manifest: publication.manifest
  });
}

// Point d'entrée public complet : identité d'Accès Public (slugs +
// capability) -> corpus de la publication active.
export async function resolvePublicKnowledgeCorpus(pool, { clientSlug, projectSlug, rawCapability }) {
  const resolution = await resolvePublicAccess(pool, { clientSlug, projectSlug, rawCapability });
  return activePublicationCorpusForAccess(pool, resolution);
}
