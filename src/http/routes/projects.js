import { Router } from 'express';
import multer from 'multer';
import { logger } from '../../logger.js';
import {
  listProjectsForUser, findProjectIdentity, findProjectSettings, listProjectModules
} from '../../domain/projects/repository.js';
import { requireProjectCapability } from '../middleware/requireProjectCapability.js';
import { requireOrganizationCapability } from '../middleware/requireOrganizationCapability.js';
import { ProjectCapability, OrganizationCapability, projectCapabilitiesForBundle } from '../../domain/permissions/capabilities.js';
import { validateCreateProjectPayload } from '../../domain/project-setup/validation.js';
import { listSupportedLocales } from '../../domain/project-setup/repository.js';
import {
  insertProject, insertProjectIdentity, insertProjectSettings,
  insertProjectModules, insertProjectMembership, insertProjectInvitation,
  insertAsset, updateProjectIdentityLogo
} from '../../domain/project-setup/repository.js';
import { Errors } from '../../errors/AppError.js';
import { ALLOWED_MIME_TO_EXTENSION, MAX_IMAGE_BYTES, matchesRealFileSignature } from '../../domain/assets/imageValidation.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES } });

export function createProjectsRouter({ pool, storageAdapter }) {
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
    res.status(200).json(projects.map(p => ({ id: p.id, name: p.name })));
  });

  // Création transactionnelle — le tenant vient exclusivement du
  // contexte authentifié (req.tenantMembership, posé par
  // requireOrganizationCapability), jamais d'un tenant_id fourni par
  // le client. Toute écriture se fait sur un seul client, dans une
  // seule transaction : soit tout est créé, soit rien ne l'est.
  router.post(
    '/',
    requireOrganizationCapability(pool, OrganizationCapability.PROJECTS_CREATE),
    async (req, res, next) => {
      const supportedLocales = await listSupportedLocales(pool);
      const validation = validateCreateProjectPayload(req.body, {
        supportedLocales,
        creatorEmail: req.user.email
      });

      if (!validation.valid) {
        next(Errors.invalid('Payload de création de projet invalide.', validation.errors));
        return;
      }

      const { name, workspaceLocale, contentLocale, identity, modules, invites } = validation.data;
      const tenantId = req.tenantMembership.tenant_id;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const projectId = await insertProject(client, { tenantId, name });
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
        const { storageKey } = await storageAdapter.save(req.file.buffer, { extension });
        const assetId = await insertAsset(pool, {
          tenantId: req.project.tenant_id,
          projectId: req.project.id,
          kind: 'logo',
          storageKey,
          contentType: req.file.mimetype,
          byteSize: req.file.size
        });
        await updateProjectIdentityLogo(pool, { projectId: req.project.id, logoAssetId: assetId });

        res.status(201).json({ assetId, url: `/api/assets/${assetId}` });
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
          fontSecondary: identity.font_secondary,
          theme: identity.theme
        } : null,
        settings: settings ? {
          workspaceLocale: settings.workspace_locale,
          contentLocale: settings.content_locale
        } : null,
        modules: modules.map(m => ({ key: m.module_key, enabled: m.enabled })),
        membership: {
          permissionBundle: req.project.my_bundle,
          capabilities: projectCapabilitiesForBundle(req.project.my_bundle)
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

  return router;
}
