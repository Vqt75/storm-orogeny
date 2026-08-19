// Validation Studio — pure, aucune écriture DB. Un payload qui ne
// respecte pas le contrat produit une erreur explicite, jamais une
// correction magique (même discipline que Project Setup).

const BLOCK_TYPES = new Set(['paragraph', 'heading', 'image']);
const SECTION_TYPES = new Set(['focus', 'keyFigures', 'text', 'image', 'gallery', 'timeline', 'quote', 'choices', 'team']);
const MILESTONE_STATUSES = new Set(['done', 'current', 'future']);
const SPACE_STATUSES = new Set(['designing', 'approved', 'delivered']);
const SPACE_MEDIA_KINDS = new Set(['view', 'plan', 'document']);
const SECTION_KEYS = new Set(['homepage', 'questions', 'actualites', 'ambassadeurs', 'le_projet', 'espaces']);

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

// Un brouillon Studio tolère l'incomplétude — validité structurelle
// (bon type) != validité de publication (contenu métier complet). La
// complétude sera vérifiée par la future couche Publication (Phase
// 2D), jamais par l'autosave. Invariant Studio global, pas spécifique
// à Questions : title/name/etc. peuvent être temporairement vides
// pendant qu'un brouillon se construit ou se réécrit.
function isString(v) {
  return typeof v === 'string';
}

// Modèle de runs Orogeny — bold/italic/underline/href uniquement.
// highlight est du legacy Tectonic, jamais une primitive Orogeny (voir
// la conception validée) : un payload qui en contient est refusé,
// jamais silencieusement toléré.
function validateRuns(runs, fieldName, errors) {
  if (runs === undefined) return;
  if (!Array.isArray(runs)) {
    errors.push(`${fieldName} doit être un tableau.`);
    return;
  }
  runs.forEach((run, i) => {
    if (!run || typeof run.text !== 'string') {
      errors.push(`${fieldName}[${i}] doit porter un champ text.`);
      return;
    }
    if ('highlight' in run) {
      errors.push(`${fieldName}[${i}] : "highlight" n'est pas une primitive Orogeny (legacy Tectonic). Utiliser bold/italic/underline.`);
    }
    for (const key of Object.keys(run)) {
      if (!['text', 'bold', 'italic', 'underline', 'href'].includes(key)) {
        errors.push(`${fieldName}[${i}] : clé inconnue "${key}".`);
      }
    }
  });
}

function requireVersion(payload, errors) {
  if (typeof payload.version !== 'number') {
    errors.push('version est requise et doit être un nombre (verrou optimiste).');
  }
}

export function validateQuestion(payload, { requireVersionField = true } = {}) {
  const errors = [];
  if (payload?.question !== undefined && !isString(payload.question)) {
    errors.push('question doit être une chaîne de caractères (peut être vide — un brouillon Studio tolère l\'incomplétude).');
  }
  validateRuns(payload?.answerRuns, 'answerRuns', errors);
  if (requireVersionField) requireVersion(payload, errors);
  return { valid: errors.length === 0, errors };
}

function validateBlocks(blocks, errors) {
  if (blocks === undefined) return;
  if (!Array.isArray(blocks)) { errors.push('blocks doit être un tableau.'); return; }
  blocks.forEach((block, i) => {
    if (block?.id !== undefined && !isString(block.id)) {
      errors.push(`blocks[${i}].id doit être une chaîne de caractères si fourni.`);
    }
    if (!BLOCK_TYPES.has(block?.blockType)) {
      errors.push(`blocks[${i}].blockType inconnu : "${block?.blockType}".`);
      return;
    }
    if ((block.blockType === 'paragraph' || block.blockType === 'heading')) {
      validateRuns(block.runs, `blocks[${i}].runs`, errors);
    }
    if (block.blockType === 'image' && !isNonEmptyString(block.imageAssetId)) {
      errors.push(`blocks[${i}] de type image requiert imageAssetId.`);
    }
    if (typeof block.position !== 'number') errors.push(`blocks[${i}].position doit être un nombre.`);
  });
}

export function validateArticle(payload, { requireVersionField = true } = {}) {
  const errors = [];
  if (payload?.title !== undefined && !isString(payload.title)) {
    errors.push('title doit être une chaîne de caractères (peut être vide — un brouillon Studio tolère l\'incomplétude).');
  }
  validateRuns(payload?.chapeauRuns, 'chapeauRuns', errors);
  validateBlocks(payload?.blocks, errors);
  if (requireVersionField) requireVersion(payload, errors);
  return { valid: errors.length === 0, errors };
}

export function validateMilestone(payload, { requireVersionField = true } = {}) {
  const errors = [];
  if (payload?.status !== undefined && payload.status !== null && !MILESTONE_STATUSES.has(payload.status)) {
    errors.push(`status doit être l'un de : ${[...MILESTONE_STATUSES].join(', ')}.`);
  }
  if (requireVersionField) requireVersion(payload, errors);
  return { valid: errors.length === 0, errors };
}

export function validateTeamMember(payload, { requireVersionField = true } = {}) {
  const errors = [];
  if (payload?.name !== undefined && !isString(payload.name)) {
    errors.push('name doit être une chaîne de caractères (peut être vide — un brouillon Studio tolère l\'incomplétude).');
  }
  if (requireVersionField) requireVersion(payload, errors);
  return { valid: errors.length === 0, errors };
}

function validateSectionMedia(media, errors) {
  if (media === undefined) return;
  if (!Array.isArray(media)) { errors.push('media doit être un tableau.'); return; }
  media.forEach((m, i) => {
    if (!isNonEmptyString(m?.assetId)) errors.push(`media[${i}].assetId est requis.`);
    if (typeof m?.position !== 'number') errors.push(`media[${i}].position doit être un nombre.`);
  });
}

// Validation de type par sectionType — seulement SI la propriété est
// présente, jamais une exigence de structure complète (doctrine
// brouillon incomplet toléré, étendue à la forme du payload). Un
// "quote" peut être enregistré sans attribution ; s'il en a une, ce
// doit être une chaîne, pas un objet égaré par erreur.
const NARRATIVE_PAYLOAD_STRING_FIELDS = {
  focus: ['title', 'body'],
  text: ['title', 'body'],
  quote: ['quote', 'attribution'],
  keyFigures: ['title'],
  choices: ['title'],
  image: ['caption'],
  gallery: ['title']
};
const NARRATIVE_PAYLOAD_ITEM_FIELDS = {
  keyFigures: ['value', 'label'],
  choices: ['title', 'body']
};

function validateNarrativeSectionPayload(sectionType, payload, errors) {
  if (payload === undefined || payload === null) return;
  if (typeof payload !== 'object' || Array.isArray(payload)) {
    errors.push('payload doit être un objet.');
    return;
  }
  const stringFields = NARRATIVE_PAYLOAD_STRING_FIELDS[sectionType] ?? [];
  for (const field of stringFields) {
    if (payload[field] !== undefined && !isString(payload[field])) {
      errors.push(`payload.${field} doit être une chaîne de caractères.`);
    }
  }
  const itemFields = NARRATIVE_PAYLOAD_ITEM_FIELDS[sectionType];
  if (itemFields && payload.items !== undefined) {
    if (!Array.isArray(payload.items)) {
      errors.push('payload.items doit être un tableau.');
    } else {
      payload.items.forEach((item, i) => {
        if (typeof item !== 'object' || item === null || Array.isArray(item)) {
          errors.push(`payload.items[${i}] doit être un objet.`);
          return;
        }
        for (const field of itemFields) {
          if (item[field] !== undefined && !isString(item[field])) {
            errors.push(`payload.items[${i}].${field} doit être une chaîne de caractères.`);
          }
        }
      });
    }
  }
}

export function validateNarrativeSection(payload, { requireVersionField = true } = {}) {
  const errors = [];
  if (!SECTION_TYPES.has(payload?.sectionType)) {
    errors.push(`sectionType doit être l'un de : ${[...SECTION_TYPES].join(', ')}.`);
  } else {
    validateNarrativeSectionPayload(payload.sectionType, payload.payload, errors);
  }
  if (['image', 'gallery'].includes(payload?.sectionType)) {
    validateSectionMedia(payload?.media, errors);
  } else if (payload?.media !== undefined && Array.isArray(payload.media) && payload.media.length > 0) {
    errors.push('media ne doit être fourni que pour les sections image/gallery.');
  }
  if (payload?.enabled !== undefined && typeof payload.enabled !== 'boolean') {
    errors.push('enabled doit être un booléen.');
  }
  if (requireVersionField) requireVersion(payload, errors);
  return { valid: errors.length === 0, errors };
}

export function validateAmbassador(payload, { requireVersionField = true } = {}) {
  const errors = [];
  if (payload?.name !== undefined && !isString(payload.name)) {
    errors.push('name doit être une chaîne de caractères (peut être vide — un brouillon Studio tolère l\'incomplétude).');
  }
  if (requireVersionField) requireVersion(payload, errors);
  return { valid: errors.length === 0, errors };
}

function validateSpaceMedia(media, errors) {
  if (media === undefined) return;
  if (!Array.isArray(media)) { errors.push('media doit être un tableau.'); return; }
  media.forEach((m, i) => {
    if (!SPACE_MEDIA_KINDS.has(m?.kind)) errors.push(`media[${i}].kind doit être l'un de : ${[...SPACE_MEDIA_KINDS].join(', ')}.`);
    if (!isNonEmptyString(m?.assetId)) errors.push(`media[${i}].assetId est requis.`);
    if (typeof m?.position !== 'number') errors.push(`media[${i}].position doit être un nombre.`);
  });
}

export function validateSpace(payload, { requireVersionField = true } = {}) {
  const errors = [];
  if (payload?.name !== undefined && !isString(payload.name)) {
    errors.push('name doit être une chaîne de caractères (peut être vide — un brouillon Studio tolère l\'incomplétude).');
  }
  if (payload?.status !== undefined && payload.status !== null && !SPACE_STATUSES.has(payload.status)) {
    errors.push(`status doit être l'un de : ${[...SPACE_STATUSES].join(', ')}.`);
  }
  if (payload?.usages !== undefined && !Array.isArray(payload.usages)) {
    errors.push('usages doit être un tableau.');
  }
  validateSpaceMedia(payload?.media, errors);
  if (requireVersionField) requireVersion(payload, errors);
  return { valid: errors.length === 0, errors };
}

export function validateSectionContent(payload, sectionKey, { requireVersionField = false } = {}) {
  const errors = [];
  if (!SECTION_KEYS.has(sectionKey)) errors.push(`section inconnue : "${sectionKey}".`);
  if (sectionKey === 'homepage' && payload?.fields) {
    const f = payload.fields;
    const allowed = new Set(['message', 'featuredArticleMode', 'featuredArticleId', 'showMilestones', 'showAskPrompt', 'askPrompt']);
    for (const key of Object.keys(f)) {
      if (!allowed.has(key)) errors.push(`homepage.fields ne peut porter que ${[...allowed].join('/')}, pas "${key}".`);
    }
    if (f.featuredArticleMode !== undefined && !['latest', 'manual'].includes(f.featuredArticleMode)) {
      errors.push('homepage.featuredArticleMode doit être "latest" ou "manual".');
    }
    if (f.featuredArticleId !== undefined && f.featuredArticleId !== null && !isString(f.featuredArticleId)) {
      errors.push('homepage.featuredArticleId doit être une chaîne ou null.');
    }
    if (f.showMilestones !== undefined && typeof f.showMilestones !== 'boolean') {
      errors.push('homepage.showMilestones doit être un booléen.');
    }
    if (f.showAskPrompt !== undefined && typeof f.showAskPrompt !== 'boolean') {
      errors.push('homepage.showAskPrompt doit être un booléen.');
    }
  }
  if (sectionKey === 'le_projet' && payload?.fields) {
    // Introduction générale du domaine "Le projet" — title/body,
    // exactement la forme confirmée contre la référence Tectonic
    // (project.intro.title/body). Jamais un JSON libre arbitraire.
    const allowed = new Set(['title', 'body']);
    for (const key of Object.keys(payload.fields)) {
      if (!allowed.has(key)) errors.push(`le_projet.fields ne peut porter que title/body, pas "${key}".`);
    }
    if (payload.fields.title !== undefined && !isString(payload.fields.title)) {
      errors.push('le_projet.fields.title doit être une chaîne de caractères.');
    }
    if (payload.fields.body !== undefined && !isString(payload.fields.body)) {
      errors.push('le_projet.fields.body doit être une chaîne de caractères.');
    }
  }
  if (requireVersionField) requireVersion(payload, errors);
  return { valid: errors.length === 0, errors };
}
