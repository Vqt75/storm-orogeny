// Normalisation pure d'un nom (Client ou Projet) en slug lisible,
// stable et URL-safe. Aucune écriture DB ici -- fonction déterministe,
// testable isolément. Réutilisée pour deux usages distincts : les
// contraintes d'unicité (Client) et les instantanés d'URL publique
// (Client + Projet, Lot B) -- une seule implémentation, jamais deux
// algorithmes parallèles.

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

// normalizeSlug -- déterministe : la même entrée produit toujours
// exactement la même sortie, quel que soit l'environnement
// d'exécution.
export function normalizeSlug(rawName) {
  if (typeof rawName !== 'string') return '';

  const lowered = stripDiacritics(rawName.trim()).toLowerCase();

  const slug = lowered
    .replace(/[^a-z0-9\s-]/g, ' ')   // tout caractère non alphanumérique (hors espace/tiret déjà valides) devient un espace
    .replace(/[\s_-]+/g, '-')        // espaces/underscores/tirets consécutifs -> un seul tiret
    .replace(/^-+|-+$/g, '');        // jamais de tiret en tête/fin

  return slug;
}

// isValidSlug -- un nom dont la normalisation produit un slug vide
// n'est jamais acceptable (ex. "", "   ", "!!!"). Le nom d'affichage
// brut reste par ailleurs libre (accents, casse, etc.).
export function isValidSlug(rawName) {
  return normalizeSlug(rawName).length > 0;
}
