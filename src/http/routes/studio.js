import { Router } from 'express';
import multer from 'multer';
import { requireProjectCapability } from '../middleware/requireProjectCapability.js';
import { ProjectCapability } from '../../domain/permissions/capabilities.js';
import { Errors } from '../../errors/AppError.js';
import * as repo from '../../domain/studio/repository.js';
import * as validate from '../../domain/studio/validation.js';
import { insertAsset } from '../../domain/project-setup/repository.js';
import { ALLOWED_MIME_TO_EXTENSION, ALLOWED_DOCUMENT_MIME_TO_EXTENSION, MAX_IMAGE_BYTES, matchesRealFileSignature } from '../../domain/assets/imageValidation.js';

// Allowlist serveur des kinds acceptés par cet endpoint générique —
// pour ce slice, uniquement article_image. Étendre cette liste au fur
// et à mesure des besoins réels des autres domaines Studio (Espaces,
// Le projet...), jamais un kind arbitraire fourni par le client.
const ALLOWED_STUDIO_ASSET_KINDS = new Set(['article_image', 'space_media', 'ambassador_photo']);
const uploadStudioAsset = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES } });

// Studio — autosave = brouillon uniquement. Aucune de ces routes ne
// touche à la publication (Phase 2D, pipeline Candidate/Compiler/
// Manifest séparé). Toute écriture requiert content.edit ; la lecture
// requiert seulement project.view — cohérent avec les capabilities
// déjà posées en Phase 0.

// Toute route async doit passer par ce wrapper : Express 4 ne
// rattrape pas automatiquement une promesse rejetée dans un handler
// async — sans lui, une erreur levée (ex. violation de contrainte
// DB) ne remonte jamais à errorHandler et la requête reste bloquée
// indéfiniment plutôt que de répondre proprement.
function asyncHandler(fn) {
  return (req, res, next) => { fn(req, res, next).catch(next); };
}

// ─────────────────────────────────────────────────────────────────
// Factory pour les 4 domaines structurellement identiques (une seule
// table, pas d'enfants) : Questions, Jalons, Membres d'équipe,
// Ambassadeurs. L'API reste un chemin dédié par domaine ; seule
// l'implémentation interne est factorisée.
// ─────────────────────────────────────────────────────────────────
function mountSimpleDomain(router, pool, {
  path, listFn, insertFn, updateFn, deleteFn, validateFn, toApi, fromApi
}) {
  router.get(`/:projectId/studio/${path}`, requireProjectCapability(pool, ProjectCapability.VIEW), asyncHandler(async (req, res) => {
    const rows = await listFn(pool, req.project.id);
    res.status(200).json(rows.map(toApi));
  }));

  router.post(`/:projectId/studio/${path}`, requireProjectCapability(pool, ProjectCapability.CONTENT_EDIT), asyncHandler(async (req, res, next) => {
    const { valid, errors } = validateFn(req.body, { requireVersionField: false });
    if (!valid) { next(Errors.invalid(`Payload ${path} invalide.`, errors)); return; }
    const row = await insertFn(pool, {
      tenantId: req.project.tenant_id, projectId: req.project.id, userId: req.user.id,
      ...fromApi(req.body)
    });
    res.status(201).json(toApi(row));
  }));

  router.patch(`/:projectId/studio/${path}/:itemId`, requireProjectCapability(pool, ProjectCapability.CONTENT_EDIT), asyncHandler(async (req, res, next) => {
    const { valid, errors } = validateFn(req.body, { requireVersionField: true });
    if (!valid) { next(Errors.invalid(`Payload ${path} invalide.`, errors)); return; }
    const row = await updateFn(pool, {
      tenantId: req.project.tenant_id, projectId: req.project.id, id: req.params.itemId,
      userId: req.user.id, ...fromApi(req.body)
    });
    if (!row) { res.status(409).json({ ok: false, error: { code: 'STALE_VERSION', message: 'Version périmée ou ressource introuvable.' } }); return; }
    res.status(200).json(toApi(row));
  }));

  router.delete(`/:projectId/studio/${path}/:itemId`, requireProjectCapability(pool, ProjectCapability.CONTENT_EDIT), asyncHandler(async (req, res, next) => {
    const version = Number(req.query.version);
    if (!Number.isInteger(version)) { next(Errors.invalid('version (query) est requise pour supprimer.')); return; }
    const ok = await deleteFn(pool, { tenantId: req.project.tenant_id, projectId: req.project.id, id: req.params.itemId, version });
    if (!ok) { res.status(409).json({ ok: false, error: { code: 'STALE_VERSION', message: 'Version périmée ou ressource introuvable.' } }); return; }
    res.status(204).send();
  }));
}

export function createStudioRouter({ pool, storageAdapter }) {
  const router = Router();

  // Upload générique Studio, project-scoped, aucun effet de bord sur
  // project_identity (contrairement à POST /projects/:id/logo). Le
  // kind est fourni par le client mais vérifié contre une allowlist
  // serveur stricte — jamais un kind arbitraire inséré tel quel.
  router.post(
    '/:projectId/studio/assets',
    requireProjectCapability(pool, ProjectCapability.CONTENT_EDIT),
    uploadStudioAsset.single('file'),
    asyncHandler(async (req, res, next) => {
      if (!req.file) { next(Errors.invalid('Aucun fichier reçu (champ "file" attendu).')); return; }
      const kind = req.body.kind;
      if (!ALLOWED_STUDIO_ASSET_KINDS.has(kind)) {
        next(Errors.invalid(`kind non autorisé pour cet endpoint : "${kind}". Autorisés : ${[...ALLOWED_STUDIO_ASSET_KINDS].join(', ')}.`));
        return;
      }
      // PDF autorisé uniquement pour space_media (besoin métier réel :
      // Espaces media.kind='document') — jamais pour article_image, qui
      // reste strictement image. asset.kind reste 'space_media' dans
      // les deux cas ; seule la nature du fichier accepté varie.
      const allowedMimes = kind === 'space_media'
        ? { ...ALLOWED_MIME_TO_EXTENSION, ...ALLOWED_DOCUMENT_MIME_TO_EXTENSION }
        : ALLOWED_MIME_TO_EXTENSION;
      const extension = allowedMimes[req.file.mimetype];
      if (!extension) {
        const formats = kind === 'space_media' ? 'PNG, JPG, PDF' : 'PNG, JPG';
        next(Errors.invalid(`Type de fichier non autorisé : ${req.file.mimetype}. Formats acceptés : ${formats}.`));
        return;
      }
      if (!matchesRealFileSignature(req.file.buffer, req.file.mimetype)) {
        next(Errors.invalid('Le contenu du fichier ne correspond pas au type annoncé.'));
        return;
      }

      const { storageKey } = await storageAdapter.save(req.file.buffer, { extension });
      const assetId = await insertAsset(pool, {
        tenantId: req.project.tenant_id, projectId: req.project.id,
        kind, storageKey, contentType: req.file.mimetype, byteSize: req.file.size
      });

      res.status(201).json({ assetId });
    })
  );

  // ── Questions ──
  mountSimpleDomain(router, pool, {
    path: 'questions',
    listFn: repo.listQuestions, insertFn: repo.insertQuestion, updateFn: repo.updateQuestion, deleteFn: repo.deleteQuestion,
    validateFn: validate.validateQuestion,
    toApi: r => ({ id: r.id, question: r.question, answerRuns: r.answer_runs, position: r.position, version: r.version, updatedAt: r.updated_at }),
    fromApi: b => ({ question: b.question, answerRuns: b.answerRuns, position: b.position, version: b.version })
  });

  // ── Jalons (Le projet) ──
  mountSimpleDomain(router, pool, {
    path: 'milestones',
    listFn: repo.listMilestones, insertFn: repo.insertMilestone, updateFn: repo.updateMilestone, deleteFn: repo.deleteMilestone,
    validateFn: validate.validateMilestone,
    toApi: r => ({ id: r.id, status: r.status, dateLabel: r.date_label, label: r.label, description: r.description, position: r.position, version: r.version, updatedAt: r.updated_at }),
    fromApi: b => ({ status: b.status, dateLabel: b.dateLabel, label: b.label, description: b.description, position: b.position, version: b.version })
  });

  // ── Membres d'équipe (Le projet) ──
  mountSimpleDomain(router, pool, {
    path: 'team-members',
    listFn: repo.listTeamMembers, insertFn: repo.insertTeamMember, updateFn: repo.updateTeamMember, deleteFn: repo.deleteTeamMember,
    validateFn: validate.validateTeamMember,
    toApi: r => ({ id: r.id, name: r.name, title: r.title, badge: r.badge, photoAssetId: r.photo_asset_id, position: r.position, version: r.version, updatedAt: r.updated_at }),
    fromApi: b => ({ name: b.name, title: b.title, badge: b.badge, photoAssetId: b.photoAssetId, position: b.position, version: b.version })
  });

  // ── Ambassadeurs ──
  mountSimpleDomain(router, pool, {
    path: 'ambassadors',
    listFn: repo.listAmbassadors, insertFn: repo.insertAmbassador, updateFn: repo.updateAmbassador, deleteFn: repo.deleteAmbassador,
    validateFn: validate.validateAmbassador,
    toApi: r => ({ id: r.id, name: r.name, role: r.role, tag: r.tag, photoAssetId: r.photo_asset_id, contactable: r.contactable, contactChannel: r.contact_channel, contactValue: r.contact_value, position: r.position, version: r.version, updatedAt: r.updated_at }),
    fromApi: b => ({ name: b.name, role: b.role, tag: b.tag, photoAssetId: b.photoAssetId, contactable: b.contactable, contactChannel: b.contactChannel, contactValue: b.contactValue, position: b.position, version: b.version })
  });

  // ── Actualités (Article + blocs, unité de version = l'article) ──
  const blockToApi = b => ({ id: b.id, blockType: b.block_type, runs: b.runs, imageAssetId: b.image_asset_id, position: b.position });
  const articleToApi = r => ({
    id: r.id, tag: r.tag,
    publicationDate: r.publication_date ? new Date(r.publication_date).toISOString().slice(0, 10) : null,
    title: r.title, chapeauRuns: r.chapeau_runs,
    position: r.position, version: r.version, updatedAt: r.updated_at,
    blocks: (r.blocks ?? []).map(blockToApi)
  });

  router.get('/:projectId/studio/articles', requireProjectCapability(pool, ProjectCapability.VIEW), asyncHandler(async (req, res) => {
    const rows = await repo.listArticles(pool, req.project.id);
    res.status(200).json(rows.map(articleToApi));
  }));

  router.post('/:projectId/studio/articles', requireProjectCapability(pool, ProjectCapability.CONTENT_EDIT), asyncHandler(async (req, res, next) => {
    const { valid, errors } = validate.validateArticle(req.body, { requireVersionField: false });
    if (!valid) { next(Errors.invalid('Payload article invalide.', errors)); return; }
    const row = await repo.insertArticle(pool, {
      tenantId: req.project.tenant_id, projectId: req.project.id, userId: req.user.id,
      tag: req.body.tag, publicationDate: req.body.publicationDate, title: req.body.title,
      chapeauRuns: req.body.chapeauRuns, position: req.body.position, blocks: req.body.blocks
    });
    res.status(201).json(articleToApi(row));
  }));

  router.patch('/:projectId/studio/articles/:itemId', requireProjectCapability(pool, ProjectCapability.CONTENT_EDIT), asyncHandler(async (req, res, next) => {
    const { valid, errors } = validate.validateArticle(req.body, { requireVersionField: true });
    if (!valid) { next(Errors.invalid('Payload article invalide.', errors)); return; }
    const row = await repo.updateArticle(pool, {
      tenantId: req.project.tenant_id, projectId: req.project.id, id: req.params.itemId, userId: req.user.id,
      version: req.body.version, tag: req.body.tag, publicationDate: req.body.publicationDate, title: req.body.title,
      chapeauRuns: req.body.chapeauRuns, blocks: req.body.blocks
    });
    if (!row) { res.status(409).json({ ok: false, error: { code: 'STALE_VERSION', message: 'Version périmée ou ressource introuvable.' } }); return; }
    if (row.blockErrors) { next(Errors.invalid('Payload blocks invalide.', row.blockErrors)); return; }
    res.status(200).json(articleToApi(row));
  }));

  router.delete('/:projectId/studio/articles/:itemId', requireProjectCapability(pool, ProjectCapability.CONTENT_EDIT), asyncHandler(async (req, res, next) => {
    const version = Number(req.query.version);
    if (!Number.isInteger(version)) { next(Errors.invalid('version (query) est requise pour supprimer.')); return; }
    const ok = await repo.deleteArticle(pool, { tenantId: req.project.tenant_id, projectId: req.project.id, id: req.params.itemId, version });
    if (!ok) { res.status(409).json({ ok: false, error: { code: 'STALE_VERSION', message: 'Version périmée ou ressource introuvable.' } }); return; }
    res.status(204).send();
  }));

  // ── Sections narratives (Le projet, unité de version = la section) ──
  const sectionMediaToApi = m => ({ id: m.id, assetId: m.asset_id, alt: m.alt, position: m.position });
  const sectionToApi = r => ({
    id: r.id, sectionType: r.section_type, payload: r.payload, position: r.position, version: r.version, updatedAt: r.updated_at,
    media: (r.media ?? []).map(sectionMediaToApi)
  });

  router.get('/:projectId/studio/narrative-sections', requireProjectCapability(pool, ProjectCapability.VIEW), asyncHandler(async (req, res) => {
    const rows = await repo.listNarrativeSections(pool, req.project.id);
    res.status(200).json(rows.map(sectionToApi));
  }));

  router.post('/:projectId/studio/narrative-sections', requireProjectCapability(pool, ProjectCapability.CONTENT_EDIT), asyncHandler(async (req, res, next) => {
    const { valid, errors } = validate.validateNarrativeSection(req.body, { requireVersionField: false });
    if (!valid) { next(Errors.invalid('Payload section narrative invalide.', errors)); return; }
    const row = await repo.insertNarrativeSection(pool, {
      tenantId: req.project.tenant_id, projectId: req.project.id, userId: req.user.id,
      sectionType: req.body.sectionType, payload: req.body.payload, media: req.body.media, position: req.body.position
    });
    res.status(201).json(sectionToApi(row));
  }));

  router.patch('/:projectId/studio/narrative-sections/:itemId', requireProjectCapability(pool, ProjectCapability.CONTENT_EDIT), asyncHandler(async (req, res, next) => {
    const { valid, errors } = validate.validateNarrativeSection(req.body, { requireVersionField: true });
    if (!valid) { next(Errors.invalid('Payload section narrative invalide.', errors)); return; }
    const row = await repo.updateNarrativeSection(pool, {
      tenantId: req.project.tenant_id, projectId: req.project.id, id: req.params.itemId, userId: req.user.id,
      version: req.body.version, sectionType: req.body.sectionType, payload: req.body.payload, media: req.body.media
    });
    if (!row) { res.status(409).json({ ok: false, error: { code: 'STALE_VERSION', message: 'Version périmée ou ressource introuvable.' } }); return; }
    res.status(200).json(sectionToApi(row));
  }));

  router.delete('/:projectId/studio/narrative-sections/:itemId', requireProjectCapability(pool, ProjectCapability.CONTENT_EDIT), asyncHandler(async (req, res, next) => {
    const version = Number(req.query.version);
    if (!Number.isInteger(version)) { next(Errors.invalid('version (query) est requise pour supprimer.')); return; }
    const ok = await repo.deleteNarrativeSection(pool, { tenantId: req.project.tenant_id, projectId: req.project.id, id: req.params.itemId, version });
    if (!ok) { res.status(409).json({ ok: false, error: { code: 'STALE_VERSION', message: 'Version périmée ou ressource introuvable.' } }); return; }
    res.status(204).send();
  }));

  // ── Espaces (Espace + médias, unité de version = l'espace) ──
  const spaceMediaToApi = m => ({ id: m.id, kind: m.kind, assetId: m.asset_id, label: m.label, alt: m.alt, position: m.position });
  const spaceToApi = r => ({
    id: r.id, name: r.name, location: r.location, description: r.description, status: r.status, usages: r.usages,
    position: r.position, version: r.version, updatedAt: r.updated_at,
    media: (r.media ?? []).map(spaceMediaToApi)
  });

  router.get('/:projectId/studio/spaces', requireProjectCapability(pool, ProjectCapability.VIEW), asyncHandler(async (req, res) => {
    const rows = await repo.listSpaces(pool, req.project.id);
    res.status(200).json(rows.map(spaceToApi));
  }));

  router.post('/:projectId/studio/spaces', requireProjectCapability(pool, ProjectCapability.CONTENT_EDIT), asyncHandler(async (req, res, next) => {
    const { valid, errors } = validate.validateSpace(req.body, { requireVersionField: false });
    if (!valid) { next(Errors.invalid('Payload espace invalide.', errors)); return; }
    const row = await repo.insertSpace(pool, {
      tenantId: req.project.tenant_id, projectId: req.project.id, userId: req.user.id,
      name: req.body.name, location: req.body.location, description: req.body.description,
      status: req.body.status, usages: req.body.usages, media: req.body.media, position: req.body.position
    });
    res.status(201).json(spaceToApi(row));
  }));

  router.patch('/:projectId/studio/spaces/:itemId', requireProjectCapability(pool, ProjectCapability.CONTENT_EDIT), asyncHandler(async (req, res, next) => {
    const { valid, errors } = validate.validateSpace(req.body, { requireVersionField: true });
    if (!valid) { next(Errors.invalid('Payload espace invalide.', errors)); return; }
    const row = await repo.updateSpace(pool, {
      tenantId: req.project.tenant_id, projectId: req.project.id, id: req.params.itemId, userId: req.user.id,
      version: req.body.version, name: req.body.name, location: req.body.location, description: req.body.description,
      status: req.body.status, usages: req.body.usages, media: req.body.media
    });
    if (!row) { res.status(409).json({ ok: false, error: { code: 'STALE_VERSION', message: 'Version périmée ou ressource introuvable.' } }); return; }
    if (row.mediaErrors) { next(Errors.invalid('Payload media invalide.', row.mediaErrors)); return; }
    res.status(200).json(spaceToApi(row));
  }));

  router.delete('/:projectId/studio/spaces/:itemId', requireProjectCapability(pool, ProjectCapability.CONTENT_EDIT), asyncHandler(async (req, res, next) => {
    const version = Number(req.query.version);
    if (!Number.isInteger(version)) { next(Errors.invalid('version (query) est requise pour supprimer.')); return; }
    const ok = await repo.deleteSpace(pool, { tenantId: req.project.tenant_id, projectId: req.project.id, id: req.params.itemId, version });
    if (!ok) { res.status(409).json({ ok: false, error: { code: 'STALE_VERSION', message: 'Version périmée ou ressource introuvable.' } }); return; }
    res.status(204).send();
  }));

  // ── Homepage + textes de section ──
  router.get('/:projectId/studio/section-content/:sectionKey', requireProjectCapability(pool, ProjectCapability.VIEW), asyncHandler(async (req, res) => {
    const row = await repo.findSectionContent(pool, { projectId: req.project.id, sectionKey: req.params.sectionKey });
    res.status(200).json(row ? { fields: row.fields, version: row.version, updatedAt: row.updated_at } : { fields: {}, version: null, updatedAt: null });
  }));

  router.patch('/:projectId/studio/section-content/:sectionKey', requireProjectCapability(pool, ProjectCapability.CONTENT_EDIT), asyncHandler(async (req, res, next) => {
    const { valid, errors } = validate.validateSectionContent(req.body, req.params.sectionKey, { requireVersionField: req.body.version !== undefined });
    if (!valid) { next(Errors.invalid('Payload section-content invalide.', errors)); return; }
    const row = await repo.upsertSectionContent(pool, {
      tenantId: req.project.tenant_id, projectId: req.project.id, userId: req.user.id,
      sectionKey: req.params.sectionKey, fields: req.body.fields, version: req.body.version
    });
    if (!row) { res.status(409).json({ ok: false, error: { code: 'STALE_VERSION', message: 'Version périmée, ou la section existe déjà (fournir sa version actuelle).' } }); return; }
    res.status(200).json({ fields: row.fields, version: row.version, updatedAt: row.updated_at });
  }));

  return router;
}
