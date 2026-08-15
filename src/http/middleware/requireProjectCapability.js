import { Errors } from '../../errors/AppError.js';
import { findAccessibleProjectForUser } from '../../domain/projects/repository.js';
import { bundleHasProjectCapability } from '../../domain/permissions/capabilities.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Décision 404 vs 403 — tranchée une fois ici, jamais choisie au hasard
// route par route :
//
//   Aucune project_membership pour cet utilisateur sur ce projet
//   (que le projet n'existe pas, appartienne à un autre tenant, ou
//   appartienne au même tenant sans membership) -> 404.
//   On ne révèle jamais l'existence d'un projet à quelqu'un qui n'a
//   aucune relation avec lui — y compris pour un organization_admin
//   sans project_membership explicite (voir l'invariant central de
//   docs/contracts/permissions.md).
//
//   Une project_membership existe, mais ne porte pas la capability
//   requise pour CETTE action précise (ex. contributor tentant de
//   publier) -> 403. L'utilisateur a déjà une relation légitime avec
//   le projet ; refuser l'action ne fuite aucune information qu'il
//   ne possède pas déjà.
export function requireProjectCapability(pool, capability) {
  return async (req, res, next) => {
    const { projectId } = req.params;

    if (!UUID_PATTERN.test(projectId)) {
      next(Errors.notFound('Projet'));
      return;
    }

    const project = await findAccessibleProjectForUser(pool, { userId: req.user.id, projectId });
    if (!project) {
      next(Errors.notFound('Projet'));
      return;
    }

    if (!bundleHasProjectCapability(project.my_bundle, capability)) {
      next(Errors.forbidden(`Cette action nécessite la capability "${capability}".`));
      return;
    }

    req.project = project;
    next();
  };
}
