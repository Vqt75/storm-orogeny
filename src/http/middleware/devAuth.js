import { Errors } from '../../errors/AppError.js';
import { findUserById } from '../../domain/users/repository.js';

// AuthN de développement — répond uniquement "qui es-tu ?", jamais
// "que peux-tu faire ?" (voir docs/contracts/privacy-and-data-governance.md,
// AuthN ≠ Authorization). Un futur SSO remplacera CE middleware
// uniquement — le moteur d'autorisation en aval (capabilities) reste
// inchangé.
//
// Impossible à activer accidentellement en production : si
// NODE_ENV === 'production', ce middleware refuse systématiquement,
// quelle que soit la présence du header. Pas de mot de passe global
// façon Tectonic — chaque requête porte une identité individuelle
// explicite.
const DEV_HEADER = 'x-storm-dev-user';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function devAuth({ pool, config }) {
  return async (req, res, next) => {
    if (config.isProduction) {
      next(Errors.unauthenticated());
      return;
    }

    const userId = req.header(DEV_HEADER);
    if (!userId || !UUID_PATTERN.test(userId)) {
      next(Errors.unauthenticated());
      return;
    }

    const user = await findUserById(pool, userId);
    if (!user) {
      next(Errors.unauthenticated());
      return;
    }

    req.user = user;
    next();
  };
}
