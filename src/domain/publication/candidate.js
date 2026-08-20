// Candidate — Snapshot → Candidate.
//
// Whitelist explicite, jamais clone-then-delete (doctrine reprise de
// la référence Tectonic, audit Phase 2D) : chaque champ inclus
// ci-dessous est une décision positive d'inclusion. Un champ ajouté un
// jour au Snapshot (brouillon interne, futur champ sensible) ne se
// retrouve donc jamais dans le Candidate par simple oubli de le
// retirer — il faudrait l'ajouter explicitement ici.
//
// C'est aussi ICI, et nulle part ailleurs, que le mapping snake_case
// (forme brute du Snapshot, fidèle aux lignes DB) vers camelCase
// (forme que le Compiler consomme) a lieu — jamais dans le Snapshot
// lui-même (qui reste une copie fidèle de l'état autoritaire), jamais
// dans le Compiler (qui doit pouvoir supposer des noms de champs
// propres). Cette fonction est étendue domaine par domaine, slice
// après slice (jamais remplacée) :
//   Slice 0 -> project/identity/homepage (déjà camelCase à la source).
//   Slice 1 -> articles/questions (mapping ajouté ici).

function mapBlock(b) {
  return {
    id: b.id,
    blockType: b.block_type,
    runs: b.runs,
    imageAssetId: b.image_asset_id,
    position: b.position
  };
}

function mapArticle(a) {
  return {
    id: a.id,
    tag: a.tag,
    publicationDate: a.publication_date
      ? new Date(a.publication_date).toISOString().slice(0, 10)
      : null,
    title: a.title,
    chapeauRuns: a.chapeau_runs,
    position: a.position,
    blocks: (a.blocks ?? []).map(mapBlock)
  };
}

function mapQuestion(q) {
  return {
    id: q.id,
    question: q.question,
    answerRuns: q.answer_runs,
    position: q.position
  };
}

export function buildCandidate(snapshot) {
  const s = snapshot || {};
  return {
    project: s.project,
    identity: s.identity,
    homepage: s.homepage,
    articles: (s.articles ?? []).map(mapArticle),
    questions: (s.questions ?? []).map(mapQuestion)
  };
}
