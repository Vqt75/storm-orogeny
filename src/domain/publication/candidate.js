// Candidate — Snapshot → Candidate.
//
// Whitelist explicite, jamais clone-then-delete (doctrine reprise de
// la référence Tectonic, audit Phase 2D) : chaque champ inclus
// ci-dessous est une décision positive d'inclusion. Un champ ajouté un
// jour au Snapshot (brouillon interne, futur champ sensible) ne se
// retrouve donc jamais dans le Candidate par simple oubli de le
// retirer — il faudrait l'ajouter explicitement ici.
//
// V0 (Slice 0) : le Snapshot capture déjà l'intégralité des 6 domaines
// Studio (voir repository.js), mais ce Candidate V0 ne sélectionne que
// ce qui alimente Home. Les slices suivants étendent cette whitelist
// domaine par domaine, jamais en élargissant silencieusement une
// fonction générique.
export function buildCandidateHomeOnly(snapshot) {
  const s = snapshot || {};
  return {
    project: s.project,
    identity: s.identity,
    homepage: s.homepage
  };
}
