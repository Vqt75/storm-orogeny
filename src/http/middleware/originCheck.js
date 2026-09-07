// Protection CSRF -- Batch 2. SameSite=Lax + HttpOnly + Secure
// (production) sur le cookie de session, complétés par une validation
// stricte d'Origin sur les méthodes non sûres -- contrat retenu et
// validé (Security Implementation Gate), jamais un token CSRF
// additionnel tant qu'aucun besoin réel ne l'a démontré.
//
// UNSAFE_METHODS uniquement -- GET/HEAD/OPTIONS ne sont jamais
// concernés. Le callback OIDC (GET /auth/callback) est un GET
// cross-site parfaitement légitime (retour depuis l'IdP) : ce
// middleware ne doit jamais le bloquer -- confirmé par construction
// (méthode GET, jamais dans UNSAFE_METHODS).

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function originCheck({ allowedOrigins }) {
  return (req, res, next) => {
    if (!UNSAFE_METHODS.has(req.method)) {
      next();
      return;
    }
    const origin = req.get('Origin');
    // Absence d'Origin sur une méthode mutante : refusé -- un
    // navigateur conforme envoie toujours Origin sur une requête
    // mutante cross-origin ou same-origin moderne ; son absence totale
    // est elle-même suspecte, jamais un repli permissif.
    //
    // allowedOrigins est relu à CHAQUE requête (jamais un instantané
    // figé à la construction du middleware) -- honore une éventuelle
    // mutation runtime de la configuration (utile notamment pour les
    // tests, qui ne connaissent leur propre origine qu'après le
    // démarrage du serveur sur un port éphémère).
    if (!origin || !allowedOrigins.includes(origin)) {
      res.status(403).json({ ok: false, error: { code: 'ORIGIN_REJECTED', message: 'Origine non autorisée.' } });
      return;
    }
    next();
  };
}
