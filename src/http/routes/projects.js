import { Router } from 'express';
import { listProjectsForUser } from '../../domain/projects/repository.js';
import { requireProjectCapability } from '../middleware/requireProjectCapability.js';
import { ProjectCapability } from '../../domain/permissions/capabilities.js';

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

  router.get(
    '/:projectId',
    requireProjectCapability(pool, ProjectCapability.VIEW),
    (req, res) => {
      res.status(200).json({ id: req.project.id, name: req.project.name });
    }
  );

  return router;
}
