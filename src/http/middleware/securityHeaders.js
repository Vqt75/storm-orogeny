// Baseline de sécurité HTTP -- Batch 2. Uniquement ce qui est
// applicable immédiatement sans casser le frontend existant (voir
// audit : 11 des 12 pages HTML utilisent du <script> inline, aucune
// ressource externe chargée nulle part).
//
// CSP : 'unsafe-inline' reste nécessaire sur script-src/style-src tant
// qu'une passe frontend dédiée n'a pas retiré les scripts/styles
// inline (nonce/hash ou externalisation) -- 'unsafe-inline' n'est PAS
// une défense forte contre une XSS inline, seulement une baseline
// transitoire utile grâce aux autres directives (object-src, base-uri,
// frame-ancestors, restriction d'origines). GATE explicite, documentée
// ici : avant l'activation d'un provider Entra réel / première vraie
// production client, une passe CSP dédiée doit retirer 'unsafe-inline'
// de script-src.

export function securityHeaders({ isProduction }) {
  return (req, res, next) => {
    // HSTS uniquement en production -- suppose HTTPS en amont
    // (terminaison TLS), jamais envoyé en développement où la
    // connexion réelle est en clair.
    if (isProduction) {
      res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline'; " + // GATE : retirer avant Entra réel / prod client (voir ci-dessus).
      "style-src 'self' 'unsafe-inline'; " +
      "object-src 'none'; " +
      "base-uri 'self'; " +
      "frame-ancestors 'none'"
    );
    next();
  };
}
