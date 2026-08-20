import { Errors } from '../../errors/AppError.js';
import { findUserById } from '../../domain/users/repository.js';
import { logger } from '../../logger.js';

// AuthN de développement — répond uniquement "qui es-tu ?", jamais
// "que peux-tu faire ?" (voir docs/contracts/privacy-and-data-governance.md,
// AuthN ≠ Authorization). Un futur SSO remplacera CE middleware
// uniquement — le moteur d'autorisation en aval (capabilities) reste
// inchangé.
//
// Impossible à activer accidentellement en production : si
// NODE_ENV === 'production', ce middleware refuse systématiquement,
// SAUF si config.demoAllowHeaderIdentityInProduction est explicitement
// vrai (voir config/env.js — nécessite la phrase complète exacte en
// variable d'environnement, jamais un simple "1"/"true"). C'est un
// raccord temporaire et assumé pour une instance de démonstration
// déployée qui n'a aujourd'hui aucun autre mécanisme d'authentification
// réel — jamais une désactivation silencieuse de la protection. Pas de
// mot de passe global façon Tectonic — chaque requête porte toujours
// une identité individuelle explicite, résolue contre un utilisateur
// réel en base, dans les deux cas.
const DEV_HEADER = 'x-storm-dev-user';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let demoWarningLogged = false;

export function devAuth({ pool, config }) {
  return async (req, res, next) => {
    if (config.isProduction && config.demoAllowHeaderIdentityInProduction && !demoWarningLogged) {
      // Une seule fois par démarrage de process, mais à chaque
      // démarrage — impossible de manquer ce raccord dans les logs de
      // déploiement, contrairement à une variable oubliée en silence.
      logger.warn(
        {},
        'ATTENTION — DEMO_ALLOW_HEADER_IDENTITY_IN_PRODUCTION est actif : ' +
        'cette instance de production accepte une identité déclarée par ' +
        'en-tête, comme en développement. Raccord temporaire assumé, ' +
        'jamais destiné à une instance servant de vraies données ' +
        'utilisateur. À retirer dès qu\'un vrai SSO existe.'
      );
      demoWarningLogged = true;
    }

    if (config.isProduction && !config.demoAllowHeaderIdentityInProduction) {
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
