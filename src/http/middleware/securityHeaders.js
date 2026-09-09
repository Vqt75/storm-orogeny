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
//
// img-src 'self' blob: -- BUG RÉEL TROUVÉ ET CORRIGÉ : sans directive
// img-src explicite, la CSP retombe sur default-src 'self', qui
// n'autorise jamais les URL blob:. Or le pattern de chargement d'assets
// utilisé partout (Studio Identité/Ambassadeurs/Actualités/Espaces/Le
// projet, Control, project-shell -- voir loadAssetImages()/getBlob())
// assigne systématiquement img.src = URL.createObjectURL(blob) pour
// contourner le fait qu'un <img src="/api/assets/:id"> classique ne
// peut jamais envoyer l'en-tête d'authentification requis. Le
// navigateur bloquait silencieusement cette assignation (violation CSP
// sur le chargement de la ressource, jamais une exception JS
// catchable par le bloc try/catch existant) -- icône d'image cassée
// systématique pour tout logo/photo/aperçu dans toute l'application,
// invisible côté serveur (curl/tests HTTP ne déclenchent jamais de CSP,
// seul un navigateur réel l'applique) et invisible dans la suite de
// tests existante (entièrement HTTP-level, aucun test de rendu
// navigateur réel).

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
      "img-src 'self' blob:; " +
      "object-src 'none'; " +
      "base-uri 'self'; " +
      "frame-ancestors 'none'"
    );
    next();
  };
}
