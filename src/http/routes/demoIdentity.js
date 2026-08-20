import { Router } from 'express';
import { findUserByEmail } from '../../domain/users/repository.js';
import { Errors } from '../../errors/AppError.js';

// Amorçage d'identité pour l'instance de démonstration — raccord
// minimal, jamais un nouveau mécanisme d'authentification.
//
// Storm Home (et les pages qui en découlent) résolvent l'identité via
// ?devUser= en développement (voir docs/contracts/privacy-and-data-
// governance.md). En production, cette query string n'est jamais
// présente naturellement — un visiteur de l'instance de démonstration
// n'a aucune raison de connaître un UUID à coller dans l'URL. Cette
// route ne fait qu'UNE chose : si config.demoAllowHeaderIdentityInProduction
// est explicitement actif (voir config/env.js — devAuth.js accepte déjà
// cette identité une fois transmise), révéler l'identifiant de
// l'unique utilisateur de démonstration désigné, pour que le frontend
// puisse ensuite l'envoyer comme n'importe quel ?devUser= explicite.
//
// Jamais authentifiée elle-même (ce serait circulaire — c'est
// précisément ce qui amorce l'identité avant tout autre appel). Sans
// le flag actif, 404 strict : une vraie instance de production ne
// révèle jamais cet endpoint, jamais un identifiant par défaut.
//
// L'email est celui, fixe, du persona de démonstration défini dans
// seed.js ('vivien@parella.example') — jamais un premier utilisateur
// arbitraire trouvé en base, pour rester déterministe même si
// d'autres utilisateurs existent.
const DEMO_USER_EMAIL = 'vivien@parella.example';

export function createDemoIdentityRouter({ pool, config }) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    if (!config.demoAllowHeaderIdentityInProduction) {
      next(Errors.notFound('Route'));
      return;
    }
    const user = await findUserByEmail(pool, DEMO_USER_EMAIL);
    if (!user) {
      next(Errors.notFound('Route'));
      return;
    }
    res.status(200).json({ userId: user.id });
  });

  return router;
}
