import { parse as parseCookie } from 'cookie';
import { findActiveSessionByRawToken } from '../../domain/identity/sessions.js';
import { Errors } from '../../errors/AppError.js';

// Middleware d'authentification par session -- Batch 2. Lit
// UNIQUEMENT le cookie de session configuré, résout via
// findActiveSessionByRawToken (Batch 1). Aucun fallback vers
// X-Storm-Dev-User -- ssoAuth et devAuth ne sont jamais deux
// alternatives simultanées sur un même chemin (voir doctrine
// production validée). N'attache jamais de bundle/capability lu
// depuis le cookie lui-même : le cookie ne porte qu'un identifiant de
// session opaque, le moteur de capabilities en aval reste seul
// responsable de l'autorisation, exactement comme pour devAuth.
//
// N'est PAS encore monté dans app.js dans ce batch (voir rapport) --
// devAuth reste seul mécanisme réellement actif. Ce middleware est
// prêt et testé, mais son branchement en remplacement de devAuth est
// un choix produit délibérément différé (pas de régression du
// flow demo/dev actuel).
export function ssoAuth({ pool, config }) {
  return async (req, res, next) => {
    const cookies = parseCookie(req.headers.cookie || '');
    const rawToken = cookies[config.sso.sessionCookieName];
    if (!rawToken) {
      next(Errors.unauthenticated());
      return;
    }

    const session = await findActiveSessionByRawToken(pool, rawToken);
    if (!session) {
      // Refus silencieux, indistinct (token inconnu/expiré/révoqué) --
      // jamais un détail qui renseignerait un attaquant sur LEQUEL de
      // ces trois cas s'est produit.
      next(Errors.unauthenticated());
      return;
    }

    const { rows: [user] } = await pool.query(
      'select id, email, display_name, status from users where id = $1',
      [session.user_id]
    );
    if (!user) {
      next(Errors.unauthenticated());
      return;
    }
    // Invariant de sécurité obligatoire (Privacy V1, user lifecycle) :
    // un user non 'active' ne doit JAMAIS pouvoir utiliser une session,
    // même si une ligne auth_sessions valide existe par anomalie (ex.
    // désactivation entre la création de la session et cette requête,
    // avant que la révocation explicite n'ait pu s'appliquer). Fail
    // closed systématique, jamais une confiance dans la seule
    // révocation déjà effectuée à la désactivation.
    if (user.status !== 'active') {
      next(Errors.unauthenticated());
      return;
    }

    req.user = user;
    req.sessionId = session.id;
    next();
  };
}
