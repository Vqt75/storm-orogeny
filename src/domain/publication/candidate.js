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
//   Slice 1 -> articles/questions.
//   Slice 2 -> spaces/ambassadors, assetContentTypes.
//   Slice 3 -> leProjet (intro/sections/media/milestones/team).

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

function mapSpaceMedia(m) {
  return {
    id: m.id,
    kind: m.kind,
    assetId: m.asset_id,
    label: m.label,
    alt: m.alt,
    position: m.position
  };
}

function mapSpace(s) {
  return {
    id: s.id,
    name: s.name,
    location: s.location,
    description: s.description,
    status: s.status,
    usages: s.usages,
    position: s.position,
    media: (s.media ?? []).map(mapSpaceMedia)
  };
}

function mapAmbassador(a) {
  return {
    id: a.id,
    name: a.name,
    role: a.role,
    tag: a.tag,
    photoAssetId: a.photo_asset_id,
    contactable: a.contactable,
    contactChannel: a.contact_channel,
    contactValue: a.contact_value,
    position: a.position
  };
}

function mapNarrativeSectionMedia(m) {
  return {
    id: m.id,
    sectionId: m.section_id,
    assetId: m.asset_id,
    alt: m.alt,
    position: m.position
  };
}

function mapNarrativeSection(s) {
  return {
    id: s.id,
    sectionType: s.section_type,
    payload: s.payload,
    position: s.position,
    enabled: s.enabled,
    media: (s.media ?? []).map(mapNarrativeSectionMedia)
  };
}

function mapMilestone(m) {
  return {
    id: m.id,
    status: m.status,
    dateLabel: m.date_label,
    label: m.label,
    description: m.description,
    position: m.position
  };
}

function mapTeamMember(m) {
  return {
    id: m.id,
    name: m.name,
    title: m.title,
    badge: m.badge,
    photoAssetId: m.photo_asset_id,
    position: m.position
  };
}

function mapLeProjet(lp) {
  const s = lp || {};
  return {
    intro: s.intro ?? {},
    sections: (s.sections ?? []).map(mapNarrativeSection),
    milestones: (s.milestones ?? []).map(mapMilestone),
    team: (s.team ?? []).map(mapTeamMember)
  };
}

export function buildCandidate(snapshot) {
  const s = snapshot || {};
  return {
    project: s.project,
    identity: s.identity,
    homepage: s.homepage,
    articles: (s.articles ?? []).map(mapArticle),
    questions: (s.questions ?? []).map(mapQuestion),
    spaces: (s.spaces ?? []).map(mapSpace),
    ambassadors: (s.ambassadors ?? []).map(mapAmbassador),
    leProjet: mapLeProjet(s.leProjet),
    // Table de correspondance assetId -> content_type réel. Nécessaire
    // structurellement pour que le Compiler construise des URLs
    // publiques portant la bonne extension de fichier — jamais une
    // donnée sensible, juste un type MIME déjà public par nature.
    assetContentTypes: s.assetContentTypes ?? {}
  };
}
