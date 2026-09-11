// API publique Client conservée (utilisée par domain/clients/repository.js
// et les routes existantes) -- l'algorithme lui-même vit désormais dans
// shared/slug.js, réutilisé à l'identique pour le slug Projet (Lot B),
// jamais dupliqué.
export { normalizeSlug as normalizeClientName, isValidSlug as isValidClientName } from '../shared/slug.js';
