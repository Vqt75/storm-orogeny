// Normalisation pure d'un nom de Client en slug lisible et stable.
// Aucune écriture DB ici -- fonction déterministe, testable isolément,
// réutilisée à la fois à la création (contrainte d'unicité) et à la
// recherche (Studio). Ne résout PAS les quasi-doublons sémantiques
// ("AG2R" vs "AG2R LA MONDIALE") -- décision produit explicite : seule
// l'unicité exacte après normalisation est bloquante, la recherche
// Studio reste la défense principale contre les quasi-doublons.

// Unicode NFD décompose déjà nativement tous les accents latins usuels
// (é -> e + accent combinable, ç -> c + cédille combinable, etc.) --
// il suffit ensuite de retirer les marques combinables (plage
// \u0300-\u036f). Seules les LIGATURES (œ, æ) ne se décomposent jamais
// par NFD (ce ne sont pas des lettres + une marque, mais deux lettres
// fusionnées) -- unique complément explicite nécessaire, volontairement
// minimal : Storm ne cible aujourd'hui aucune autre langue nécessitant
// une translitération plus large.
const LIGATURE_SUPPLEMENT = { œ: 'oe', æ: 'ae', Œ: 'OE', Æ: 'AE' };

function stripDiacritics(value) {
  const withLigaturesExpanded = value.replace(/[œæŒÆ]/g, ch => LIGATURE_SUPPLEMENT[ch]);
  return withLigaturesExpanded.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// normalizeClientName -- production du slug lisible et stable utilisé
// pour l'unicité (tenant_id, normalized_slug) et, plus tard, la
// portion Client de l'URL publique (Lot B, jamais implémenté ici).
//
// Déterministe : la même entrée produit toujours exactement la même
// sortie, quel que soit l'environnement d'exécution.
export function normalizeClientName(rawName) {
  if (typeof rawName !== 'string') return '';

  const lowered = stripDiacritics(rawName.trim()).toLowerCase();

  const slug = lowered
    .replace(/[^a-z0-9\s-]/g, ' ')   // tout caractère non alphanumérique (hors espace/tiret déjà valides) devient un espace
    .replace(/[\s_-]+/g, '-')        // espaces/underscores/tirets consécutifs -> un seul tiret
    .replace(/^-+|-+$/g, '');        // jamais de tiret en tête/fin

  return slug;
}

// isValidClientName -- un nom dont la normalisation produit un slug
// vide n'est jamais acceptable (ex. "", "   ", "!!!"). Le nom
// d'affichage brut reste par ailleurs libre (accents, casse, etc.).
export function isValidClientName(rawName) {
  return normalizeClientName(rawName).length > 0;
}
