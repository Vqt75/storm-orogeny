import { Router } from 'express';
import { listProjectsForUser } from '../../domain/projects/repository.js';
import { requireProjectCapability } from '../middleware/requireProjectCapability.js';
import { requireOrganizationCapability } from '../middleware/requireOrganizationCapability.js';
import { ProjectCapability, OrganizationCapability } from '../../domain/permissions/capabilities.js';
import { validateCreateProjectPayload } from '../../domain/project-setup/validation.js';
import { listSupportedLocales } from '../../domain/project-setup/repository.js';
import {
  insertProject, insertProjectIdentity, insertProjectSettings,
  insertProjectModules, insertProjectMembership, insertProjectInvitation
} from '../../domain/project-setup/repository.js';
import { Errors } from '../../errors/AppError.js';

export function createProjectsRouter({ pool }) {
  const router = Router();

  // Liste "mes projets" — strictement via project_memberships, jamais
  // via une capability organisationnelle. C'est ce qui prouve qu'un
  // organization_admin ne voit pas automatiquement tout le parc de
  // projets par ce chemin (Storm Control, futur, aura sa propre route
  // explicite pour projects.view_all).
  router.get('/', async (req, res) => {
    const projects = await listProjectsForUser(pool, req.user.id);
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

  router.get(
    '/:projectId',
    requireProjectCapability(pool, ProjectCapability.VIEW),
    (req, res) => {
      res.status(200).json({ id: req.project.id, name: req.project.name });
    }
  );

  return router;
}
