import { Router } from 'express';
import multer from 'multer';
import { logger } from '../../logger.js';
import {
  listProjectsForUser, findProjectIdentity, findProjectSettings, listProjectModules, renameProjectAtomic
} from '../../domain/projects/repository.js';
import { requireProjectCapability } from '../middleware/requireProjectCapability.js';
import { listActiveTenantMembershipsForUser } from '../../domain/memberships/repository.js';
import { ProjectCapability, OrganizationCapability } from '../../domain/permissions/capabilities.js';
import { validateCreateProjectPayload } from '../../domain/project-setup/validation.js';
import { findClientById } from '../../domain/clients/repository.js';
import {
  reassignProjectClient
} from '../../domain/projects/repository.js';
import {
  findCurrentAccess, rotateAccess, acknowledgeRedistribution, isRedistributionPending, decryptCurrentCapability
} from '../../domain/publicAccess/repository.js';
import { listSupportedLocales } from '../../domain/project-setup/repository.js';
import {
  insertProject, insertProjectIdentity, insertProjectSettings,
  insertProjectModules, insertProjectMembership, insertProjectInvitation,
  insertAsset, updateProjectIdentityLogo, updateProjectIdentityFontAsset,
  removeProjectIdentitySecondaryFont, updateProjectIdentityColors
} from '../../domain/project-setup/repository.js';
import { Errors } from '../../errors/AppError.js';
import { ALLOWED_MIME_TO_EXTENSION, MAX_IMAGE_BYTES, matchesRealFileSignature } from '../../domain/assets/imageValidation.js';
import { ALLOWED_FONT_MIME_TO_EXTENSION, MAX_FONT_BYTES, detectFontExtension, FONT_EXTENSION_TO_CANONICAL_MIME } from '../../domain/assets/fontValidation.js';
import { withProjectDeletionGuard } from '../../domain/projects/deletionJobs.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES } });
const uploadFont = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FONT_BYTES } });

export function createProjectsRouter({ pool, storageAdapter, config }) {
  const router = Router();

  // Liste "mes projets" — strictement via project_memberships, jamais
  // via une capability organisationnelle. C'est ce qui prouve qu'un
  // organization_admin ne voit pas automatiquement tout le parc de
  // projets par ce chemin (Storm Control, futur, aura sa propre route
  // explicite pour projects.view_all).
  router.get('/', async (req, res) => {
    const projects = await listProjectsForUser(pool, req.user.id);
    // Diagnostic temporaire — à retirer une fois la cause du symptôme
    // "seed réussi, aucun projet affiché" confirmée en production
    // (voir pool.js pour le log de cible de connexion associé).
    // Révèle précisément quel userId a été résolu et combien de
    // project_memberships actives ont été trouvées pour lui, sans
    // jamais logger de données sensibles.
    logger.info({ userId: req.user.id, projectCount: projects.length }, 'GET /api/projects');
    res.status(200).json(projects.map(p => ({
      id: p.id,
      name: p.name,
      identity: {
        logoAssetId: p.logo_asset_id,
        primaryColor: p.primary_color
      }
    })));
  });

  // Création transactionnelle — le tenant vient exclusivement de la
  // résolution dédiée ci-dessous (req.tenantMembership, posé
  // explicitement après vérification de la capability effective par
  // organisation), jamais d'un tenant_id fourni par le client. Toute
  // écriture se fait sur un seul client, dans une seule transaction :
  // soit tout est créé, soit rien ne l'est.
  router.post(
    '/',
    async (req, res, next) => {
      // Résolution dédiée à Project Creation -- jamais un changement de
      // requireOrganizationCapability/findTenantMembershipForUser
      // elles-mêmes (utilisées telles quelles ailleurs, notamment Storm
      // Control). Le middleware générique suppose UNE membership déjà
      // résolue de façon déterministe puis vérifie la capability
      // dessus -- sémantique inadaptée ici : une membership sans
      // projects.create n'est jamais un candidat à l'ambiguïté, et une
      // organisation qualifiée ailleurs ne doit jamais être ignorée au
      // seul motif qu'une autre membership, non qualifiée, aurait été
      // choisie en premier par l'ordre déterministe transitoire.
      //
      // Résolution effective, jamais un filtre naïf sur le nom du
      // bundle de la membership : listActiveTenantMembershipsForUser
      // calcule déjà l'union des capabilities de tous les
      // organization_grants actifs (voir audit -- la membership seule
      // porte un bundle legacy jamais mis à jour par une révocation de
      // grant). Aucun système de permissions parallèle : même
      // organizationCapabilitiesForBundle que le reste du domaine.
      const memberships = await listActiveTenantMembershipsForUser(pool, req.user.id);
      const creatable = memberships.filter(m => m.capabilities.includes(OrganizationCapability.PROJECTS_CREATE));

      if (creatable.length === 0) {
        next(Errors.forbidden(`Cette action nécessite la capability "${OrganizationCapability.PROJECTS_CREATE}".`));
        return;
      }
      if (creatable.length > 1) {
        next(Errors.organizationContextRequired());
        return;
      }

      // Exactement une organisation qualifiée -- utilisée explicitement
      // pour toute la suite de la création, jamais rerésolue.
      req.tenantMembership = creatable[0];
      next();
    },
    async (req, res, next) => {
      const supportedLocales = await listSupportedLocales(pool);
      const validation = validateCreateProjectPayload(req.body, {
        supportedLocales,
        creatorEmail: req.user.email,
        acceptLanguageHeader: req.get('Accept-Language')
      });

      if (!validation.valid) {
        next(Errors.invalid('Payload de création de projet invalide.', validation.errors));
        return;
      }

      const { name, clientId, workspaceLocale, contentLocale, identity, modules, invites } = validation.data;
      const tenantId = req.tenantMembership.tenant_id;

      // clientId doit référencer un Client réel du MÊME tenant --
      // vérifié explicitement ici (message clair, jamais une simple
      // violation FK Postgres remontée brute à l'appelant). La FK
      // composite (tenant_id, client_id) reste le filet de sécurité
      // final au niveau base, jamais le seul contrôle.
      const client_ = await findClientById(pool, { tenantId, clientId });
      if (!client_) {
        next(Errors.invalid('clientId doit référencer un client existant de cette organisation.'));
        return;
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const projectId = await insertProject(client, { tenantId, name, clientId });
        await insertProjectIdentity(client, { tenantId, projectId, identity });
        await insertProjectSettings(client, { tenantId, projectId, workspaceLocale, contentLocale });
        await insertProjectModules(client, { tenantId, projectId, modules });
        await insertProjectMembership(client, {
          tenantId, projectId, userId: req.user.id, permissionBundle: 'project_admin'
        });
        for (const invite of invites) {
          await insertProjectInvitation(client, {
            tenantId, projectId,
            email: invite.email, permissionBundle: invite.permissionBundle, locale: invite.locale,
            invitedByUserId: req.user.id
          });
        }

        await client.query('COMMIT');
        res.status(201).json({ id: projectId, name, status: 'active' });
      } catch (err) {
        await client.query('ROLLBACK');
        next(err);
      } finally {
        client.release();
      }
    }
  );

  // Upload réel du logo — scopé à un projet déjà existant (le fichier
  // reste en mémoire navigateur, simple aperçu local, tant que le
  // projet n'existe pas encore). Voir docs/adr/0003-storage-adapter.md.
  //
  // Contrat de séquence, à respecter côté front (Lot 3B) :
  //   validation finale → POST /api/projects → 201 + projectId
  //   → si un logo a été choisi → POST /api/projects/:projectId/logo
  // Si CET upload échoue, le projet n'est JAMAIS recréé — il existe
  // déjà et reste valide. "Réessayer" ne doit réexécuter que cet
  // upload, jamais POST /api/projects à nouveau (pas de projet en
  // double). Le logo est une configuration optionnelle, retentable
  // indépendamment de la création elle-même.
  router.post(
    '/:projectId/logo',
    requireProjectCapability(pool, ProjectCapability.PROJECT_MANAGE),
    upload.single('logo'),
    async (req, res, next) => {
      if (!req.file) {
        next(Errors.invalid('Aucun fichier reçu (champ "logo" attendu).'));
        return;
      }
      const extension = ALLOWED_MIME_TO_EXTENSION[req.file.mimetype];
      if (!extension) {
        next(Errors.invalid(`Type de fichier non autorisé : ${req.file.mimetype}. Formats acceptés : PNG, JPG.`));
        return;
      }
      if (!matchesRealFileSignature(req.file.buffer, req.file.mimetype)) {
        next(Errors.invalid('Le contenu du fichier ne correspond pas au type annoncé.'));
        return;
      }

      try {
        const guard = await withProjectDeletionGuard(pool, {
          projectId: req.params.projectId,
          storageAdapter,
          work: async (client, trackSavedKey) => {
            const { storageKey } = await storageAdapter.save(req.file.buffer, { extension });
            trackSavedKey(storageKey);
            const assetId = await insertAsset(client, {
              tenantId: req.project.tenant_id,
              projectId: req.project.id,
              kind: 'logo',
              storageKey,
              contentType: req.file.mimetype,
              byteSize: req.file.size
            });
            await updateProjectIdentityLogo(client, { projectId: req.project.id, logoAssetId: assetId });
            return { assetId };
          }
        });
        if (!guard.ok) {
          if (guard.code === 'PROJECT_DELETION_IN_PROGRESS') {
            next(Errors.forbidden('Ce projet fait l\'objet d\'une demande de suppression définitive en cours -- aucun nouvel objet ne peut être ajouté.'));
          } else {
            next(Errors.notFound('Projet'));
          }
          return;
        }

        res.status(201).json({ assetId: guard.result.assetId, url: `/api/assets/${guard.result.assetId}` });
      } catch (err) {
        next(err);
      }
    }
  );

  // Police — upload réel du fichier, jamais seulement son nom (voir
  // migration 0009 pour le contexte complet : le formulaire de Project
  // Setup ne chargeait jusqu'ici la police qu'en mémoire du navigateur,
  // pour la prévisualisation — jamais persistée côté serveur, cause
  // racine du bug observé en production). role validé strictement par
  // la route elle-même (jamais transmis en paramètre libre), jamais
  // construit dynamiquement pour la requête SQL (voir
  // updateProjectIdentityFontAsset).
  function fontUploadHandler(role) {
    return async (req, res, next) => {
      if (!req.file) {
        next(Errors.invalid('Aucun fichier reçu (champ "font" attendu).'));
        return;
      }
      const extension = detectFontExtension(req.file.buffer);
      if (!extension) {
        next(Errors.invalid('Le contenu du fichier ne correspond à aucun format de police reconnu (WOFF2, WOFF, OTF, TTF).'));
        return;
      }
      const fontName = String(req.body.fontName || '').trim() || req.file.originalname.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
      try {
        const guard = await withProjectDeletionGuard(pool, {
          projectId: req.params.projectId,
          storageAdapter,
          work: async (client, trackSavedKey) => {
            const { storageKey } = await storageAdapter.save(req.file.buffer, { extension });
            trackSavedKey(storageKey);
            const assetId = await insertAsset(client, {
              tenantId: req.project.tenant_id,
              projectId: req.project.id,
              kind: 'font',
              storageKey,
              contentType: FONT_EXTENSION_TO_CANONICAL_MIME[extension],
              byteSize: req.file.size
            });
            await updateProjectIdentityFontAsset(client, { projectId: req.project.id, role, assetId, fontName });
            return { assetId };
          }
        });
        if (!guard.ok) {
          if (guard.code === 'PROJECT_DELETION_IN_PROGRESS') {
            next(Errors.forbidden('Ce projet fait l\'objet d\'une demande de suppression définitive en cours -- aucun nouvel objet ne peut être ajouté.'));
          } else {
            next(Errors.notFound('Projet'));
          }
          return;
        }
        res.status(201).json({ assetId: guard.result.assetId, fontName, url: `/api/assets/${guard.result.assetId}` });
      } catch (err) {
        next(err);
      }
    };
  }

  router.post(
    '/:projectId/identity/fonts/primary',
    requireProjectCapability(pool, ProjectCapability.PROJECT_MANAGE),
    uploadFont.single('font'),
    fontUploadHandler('primary')
  );
  router.post(
    '/:projectId/identity/fonts/secondary',
    requireProjectCapability(pool, ProjectCapability.PROJECT_MANAGE),
    uploadFont.single('font'),
    fontUploadHandler('secondary')
  );

  // Retrait de la police secondaire uniquement — jamais la primaire,
  // obligatoire par construction produit (aucune route de suppression
  // n'existe pour elle). Retour immédiat au régime "principale partout"
  // dès la prochaine publication (le Compiler retombe sur son repli
  // déjà existant vers la primaire).
  router.delete(
    '/:projectId/identity/fonts/secondary',
    requireProjectCapability(pool, ProjectCapability.PROJECT_MANAGE),
    async (req, res, next) => {
      try {
        await removeProjectIdentitySecondaryFont(pool, { projectId: req.project.id });
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    }
  );

  // Renommage du Projet -- verrouillage optimiste, même contrat que
  // les couleurs d'identité ci-dessous. Aucun effet de bord d'Accès
  // Public dans ce Lot A (n'existe pas encore) -- mute uniquement le
  // nom du Projet.
  router.patch(
    '/:projectId/name',
    requireProjectCapability(pool, ProjectCapability.PROJECT_MANAGE),
    async (req, res, next) => {
      const { name, version } = req.body || {};
      if (typeof name !== 'string' || name.trim().length === 0) {
        next(Errors.invalid('name est requis et ne peut pas être vide.'));
        return;
      }
      if (!Number.isInteger(version)) {
        next(Errors.invalid('version (entier) requise pour le renommage.'));
        return;
      }
      const { project: updated, conflict, rotated } = await renameProjectAtomic(pool, {
        tenantId: req.project.tenant_id, projectId: req.project.id, name: name.trim(), expectedVersion: version,
        encryptionKey: config.publicAccessEncryptionKey
      });
      if (conflict === 'STALE_VERSION') {
        res.status(409).json({ ok: false, error: { code: 'STALE_VERSION', message: 'Ce projet a été modifié ailleurs. Rechargez pour repartir de la version actuelle.' } });
        return;
      }
      res.status(200).json({ id: updated.id, name: updated.name, version: updated.version, rotated });
    }
  );

  // Couleurs — verrouillage optimiste, même contrat que les autres
  // domaines Studio. 409 explicite si la version fournie ne correspond
  // plus, jamais un écrasement silencieux d'une modification concurrente.
  const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
  router.patch(
    '/:projectId/identity',
    requireProjectCapability(pool, ProjectCapability.PROJECT_MANAGE),
    async (req, res, next) => {
      const { primaryColor, secondaryColor, version } = req.body || {};
      if (!HEX_COLOR_PATTERN.test(primaryColor || '') || !HEX_COLOR_PATTERN.test(secondaryColor || '')) {
        next(Errors.invalid('primaryColor et secondaryColor doivent être des couleurs hexadécimales valides (#RRGGBB).'));
        return;
      }
      if (!Number.isInteger(version)) {
        next(Errors.invalid('version (entier) requise pour la mise à jour.'));
        return;
      }
      try {
        const updated = await updateProjectIdentityColors(pool, {
          projectId: req.project.id, primaryColor, secondaryColor, expectedVersion: version, userId: req.user.id
        });
        if (!updated) {
          res.status(409).json({ ok: false, error: { code: 'STALE_VERSION', message: 'Cette identité a été modifiée ailleurs. Rechargez pour repartir de la version actuelle.' } });
          return;
        }
        res.status(200).json({ primaryColor, secondaryColor, version: updated.version, updatedAt: updated.updated_at });
      } catch (err) {
        next(err);
      }
    }
  );

  // Contexte projet agrégé — Phase 2A (Project Shell). Une seule
  // requête plutôt que trois appels à recoller côté front.
  //
  // Invariant 1 : identity.fontPrimary/fontSecondary/theme sont des
  // données d'IDENTITÉ DE PROJET (destinées aux contenus / à
  // l'expérience collaborateur, futur Ivory), jamais des instructions
  // de skinning du Shell. Aucune surface système Orogeny (Project
  // Shell, Studio, Pilotage, Command Layer, Storm Control, Storm Home)
  // ne doit appliquer ces valeurs à sa propre interface — Storm reste
  // Roboto, quelle que soit la valeur reçue ici.
  //
  // Invariant 2 : le serveur ne renvoie aucune liste de destinations
  // UI. membership.capabilities expose les droits effectifs,
  // calculés côté serveur (projectCapabilitiesForBundle) — c'est au
  // front de décider comment les représenter, jamais l'inverse.
  //
  // Pas de identity.logoUrl dans ce contrat V1 : l'auth de
  // développement actuelle (X-Storm-Dev-User) ne peut pas être portée
  // par un <img src> direct. Le front récupère l'asset via fetch()
  // authentifié s'il en a besoin. Une URL directement consommable
  // pourra revenir avec une vraie stratégie de session/assets.
  router.get(
    '/:projectId/context',
    requireProjectCapability(pool, ProjectCapability.VIEW),
    async (req, res) => {
      const [identity, settings, modules] = await Promise.all([
        findProjectIdentity(pool, req.project.id),
        findProjectSettings(pool, req.project.id),
        listProjectModules(pool, req.project.id)
      ]);

      res.status(200).json({
        project: {
          id: req.project.id,
          name: req.project.name,
          status: req.project.status
        },
        identity: identity ? {
          logoAssetId: identity.logo_asset_id,
          primaryColor: identity.primary_color,
          secondaryColor: identity.secondary_color,
          fontPrimary: identity.font_primary,
          fontPrimaryAssetId: identity.font_primary_asset_id,
          fontSecondary: identity.font_secondary,
          fontSecondaryAssetId: identity.font_secondary_asset_id,
          theme: identity.theme,
          version: identity.version,
          updatedAt: identity.updated_at
        } : null,
        settings: settings ? {
          workspaceLocale: settings.workspace_locale,
          contentLocale: settings.content_locale
        } : null,
        modules: modules.map(m => ({ key: m.module_key, enabled: m.enabled })),
        membership: {
          permissionBundle: req.project.my_bundle,
          capabilities: req.project.capabilities
        }
      });
    }
  );

  router.get(
    '/:projectId',
    requireProjectCapability(pool, ProjectCapability.VIEW),
    (req, res) => {
      res.status(200).json({ id: req.project.id, name: req.project.name });
    }
  );

  // Prévisualisation d'impact -- lecture seule. Indique si un Accès
  // Public courant existe (donc si une rotation sera déclenchée par
  // la confirmation) avant toute mutation.
  router.get('/:projectId/reassign-client-impact', async (req, res, next) => {
    const { rows: [project] } = await pool.query('select id, tenant_id, name from projects where id=$1', [req.params.projectId]);
    if (!project) { next(Errors.notFound('Projet')); return; }
    const memberships = await listActiveTenantMembershipsForUser(pool, req.user.id);
    const qualified = memberships.find(m => m.tenant_id === project.tenant_id && m.capabilities.includes(OrganizationCapability.CLIENTS_MANAGE));
    if (!qualified) { next(Errors.forbidden(`Cette action nécessite la capability "${OrganizationCapability.CLIENTS_MANAGE}".`)); return; }

    const newClientId = typeof req.query.clientId === 'string' ? req.query.clientId : '';
    const targetClient = await findClientById(pool, { tenantId: project.tenant_id, clientId: newClientId });
    if (!targetClient) { next(Errors.invalid('clientId doit référencer un client existant de cette organisation.')); return; }

    const currentAccess = await findCurrentAccess(pool, project.id);
    res.status(200).json({
      projectName: project.name,
      targetClientName: targetClient.name,
      hasCurrentAccess: Boolean(currentAccess),
      willRotate: Boolean(currentAccess)
    });
  });

  // Réassignation Client -- capability ORGANISATIONNELLE (CLIENTS_MANAGE),
  // jamais accordée par la seule administration du projet. Le projet
  // est résolu directement puis son tenant vérifié contre les
  // memberships qualifiées de l'utilisateur -- même garantie
  // d'isolation que requireProjectCapability, chemin différent car
  // l'autorisation ici n'est jamais project-scoped.
  router.post('/:projectId/reassign-client', async (req, res, next) => {
    const { rows: [project] } = await pool.query('select id, tenant_id, client_id from projects where id=$1', [req.params.projectId]);
    if (!project) { next(Errors.notFound('Projet')); return; }

    const memberships = await listActiveTenantMembershipsForUser(pool, req.user.id);
    const qualified = memberships.find(m => m.tenant_id === project.tenant_id && m.capabilities.includes(OrganizationCapability.CLIENTS_MANAGE));
    if (!qualified) { next(Errors.forbidden(`Cette action nécessite la capability "${OrganizationCapability.CLIENTS_MANAGE}".`)); return; }

    const newClientId = req.body?.clientId;
    if (typeof newClientId !== 'string' || !newClientId) {
      next(Errors.invalid('clientId est requis.'));
      return;
    }
    const targetClient = await findClientById(pool, { tenantId: project.tenant_id, clientId: newClientId });
    if (!targetClient) {
      next(Errors.invalid('clientId doit référencer un client existant de cette organisation.'));
      return;
    }

    const result = await reassignProjectClient(pool, {
      tenantId: project.tenant_id, projectId: project.id, newClientId,
      encryptionKey: config.publicAccessEncryptionKey
    });
    if (result.conflict) { next(Errors.notFound('Projet ou client')); return; }
    res.status(200).json({ id: result.project.id, name: result.project.name, rotated: result.rotated });
  });

  // Rotation manuelle destructive -- PROJECT_MANAGE. Ne crée jamais un
  // premier accès (réservé à la publication elle-même) -- erreur
  // propre si aucun accès courant n'existe.
  router.post(
    '/:projectId/public-access/rotate',
    requireProjectCapability(pool, ProjectCapability.PROJECT_MANAGE),
    async (req, res, next) => {
      const current = await findCurrentAccess(pool, req.project.id);
      if (!current) {
        next(Errors.invalid('Ce projet n’a aucun Accès Public courant à faire tourner. Publiez-le d’abord.'));
        return;
      }
      const rotated = await rotateAccess(pool, {
        tenantId: req.project.tenant_id, projectId: req.project.id,
        clientSlug: current.client_slug, projectSlug: current.project_slug,
        reason: 'manual_rotation', encryptionKey: config.publicAccessEncryptionKey
      });
      res.status(200).json({ id: rotated.id, status: rotated.status });
    }
  );

  // Accusé de réception de l'avis de redistribution -- PUBLICATION_PUBLISH.
  // Idempotent : ré-accuser un accès déjà accusé reste un 200, jamais
  // une erreur (même motif que les mises à jour idempotentes existantes
  // ailleurs dans le domaine).
  router.post(
    '/:projectId/public-access/acknowledge',
    requireProjectCapability(pool, ProjectCapability.PUBLICATION_PUBLISH),
    async (req, res, next) => {
      const current = await findCurrentAccess(pool, req.project.id);
      if (!current) { next(Errors.notFound('Accès Public')); return; }
      const updated = await acknowledgeRedistribution(pool, { accessId: current.id, userId: req.user.id });
      if (!updated) { next(Errors.notFound('Accès Public')); return; }
      res.status(200).json({ id: updated.id, redistributionAcknowledgedAt: updated.redistribution_acknowledged_at });
    }
  );

  // Service authentifié Accès Public -- lecture d'état pour le futur
  // Studio "Accès au site" (Lot C). PUBLICATION_PUBLISH requis pour
  // voir l'URL complète -- VIEW seul ne suffit jamais (la capability
  // décryptée EST un secret d'accès). Ne retourne jamais
  // capability_hash/capability_encrypted.
  router.get(
    '/:projectId/public-access',
    requireProjectCapability(pool, ProjectCapability.PUBLICATION_PUBLISH),
    async (req, res) => {
      const current = await findCurrentAccess(pool, req.project.id);
      if (!current) {
        res.status(200).json({ hasPublicAccess: false });
        return;
      }
      const rawCapability = decryptCurrentCapability(current, config.publicAccessEncryptionKey);
      res.status(200).json({
        hasPublicAccess: true,
        status: current.status,
        publicUrl: `/public/${current.client_slug}/${current.project_slug}/${rawCapability}`,
        clientSlug: current.client_slug,
        projectSlug: current.project_slug,
        redistributionPending: isRedistributionPending(current),
        createdReason: current.created_reason,
        createdAt: current.created_at
      });
    }
  );

  return router;
}
