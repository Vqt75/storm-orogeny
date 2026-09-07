// Configuration d'environnement — chargée et validée une seule fois au
// démarrage. Un champ manquant ou invalide doit faire échouer le
// démarrage immédiatement, jamais silencieusement plus tard au premier
// usage réel.

function requireString(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Configuration manquante ou invalide : ${name}`);
  }
  return value;
}

function requireInt(name, fallback) {
  const raw = process.env[name] ?? fallback;
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw new Error(`Configuration invalide (entier attendu) : ${name}`);
  }
  return value;
}

export function loadConfig() {
  const nodeEnv = requireString('NODE_ENV', 'development');
  return {
    nodeEnv,
    isDevelopment: nodeEnv === 'development',
    isProduction: nodeEnv === 'production',
    isTest: nodeEnv === 'test',
    port: requireInt('PORT', '4000'),
    // Raccord explicite, temporaire, pour une instance de démonstration
    // déployée — jamais un affaiblissement silencieux du modèle
    // d'autorisation. Orogeny n'a aujourd'hui AUCUN mécanisme
    // d'authentification réel pour la production (pas de SSO, pas de
    // session utilisateur) : devAuth refuse donc systématiquement en
    // production, par conception (voir devAuth.js). Pour qu'une
    // instance de DÉMONSTRATION déployée reste fonctionnelle en
    // attendant un vrai SSO, ce raccord permet — UNIQUEMENT si la
    // variable porte EXACTEMENT cette phrase complète, jamais un
    // simple "1"/"true" qu'on pourrait activer par copier-coller
    // inattentif — de repasser devAuth dans son comportement de
    // développement (identité déclarée par en-tête, toujours résolue
    // contre un utilisateur réel en base) MÊME en production.
    //
    // Ceci ne touche QUE l'AuthN (qui es-tu ?), jamais l'Authorization
    // (que peux-tu faire ?) : le moteur de capabilities en aval reste
    // entièrement inchangé et continue de s'appliquer normalement.
    // Un vrai SSO remplacera CE seul mécanisme le moment venu.
    demoAllowHeaderIdentityInProduction:
      process.env.DEMO_ALLOW_HEADER_IDENTITY_IN_PRODUCTION === 'yes-this-is-a-temporary-demo-instance',
    // Base de données — voir docs/contracts/schema-and-migrations.md.
    // Aucune valeur par défaut pour l'hôte/utilisateur/mot de passe en
    // production : ils doivent être fournis explicitement. En
    // développement/test, un repli local raisonnable est acceptable.
    database: {
      host: requireString('DB_HOST', 'localhost'),
      port: requireInt('DB_PORT', '5432'),
      name: requireString('DB_NAME', 'storm_orogeny_dev'),
      user: requireString('DB_USER', 'storm_orogeny'),
      password: nodeEnv === 'production'
        ? requireString('DB_PASSWORD')
        : requireString('DB_PASSWORD', 'storm_orogeny_dev'),
      ssl: process.env.DB_SSL === '1'
    },
    // Storage — implémentation locale uniquement pour l'instant,
    // strictement derrière l'adapter (voir docs/adr/0003-storage-adapter.md).
    // Jamais gravé comme solution métier durable.
    storage: {
      localDir: requireString('STORAGE_LOCAL_DIR', 'storage-data')
    },
    // trust proxy -- nombre de sauts de reverse proxy à faire
    // confiance pour dériver req.ip (donc la clé du rate limiter, voir
    // rateLimit.js) depuis X-Forwarded-For. JAMAIS deviné : sans cette
    // configuration, deux erreurs symétriques sont possibles --
    // (a) derrière un proxy réel non déclaré, tous les utilisateurs
    // partagent la même req.ip (l'adresse du proxy), donc le même
    // budget de rate limit ; (b) une valeur trop permissive (trust
    // proxy=true, "faire confiance à tous les sauts") permettrait à
    // un client parlant directement au process de forger son propre
    // X-Forwarded-For et de contourner le rate limiting.
    //
    // Développement/test : 0 (aucun proxy en local, req.ip reflète
    // déjà directement la vraie connexion -- comportement Express par
    // défaut, sans risque ici).
    //
    // Production : AUCUNE valeur par défaut, exigée explicitement.
    // La topologie réelle (Render aujourd'hui, OVH/reverse proxy
    // Parella plus tard) doit être confirmée par la DSI/l'infra avant
    // le premier déploiement réel -- jamais affirmée depuis ce repo.
    // Pour Render, un seul saut de proxy (valeur 1) est la topologie
    // usuelle mais DOIT être confirmée, jamais supposée ici à la
    // légère.
    security: {
      trustProxyHops: nodeEnv === 'production'
        ? requireInt('TRUST_PROXY_HOPS')
        : requireInt('TRUST_PROXY_HOPS', '0')
    },
    // SSO / External Identity V1 — Batch 2 (squelette AuthN testable
    // avec un fake provider, jamais encore le mécanisme production
    // actif -- devAuth reste seul branché). Voir docs/contracts pour
    // le plan complet validé.
    sso: {
      // issuer du fake provider : une valeur CONNUE à l'avance,
      // jamais dérivée d'une requête entrante -- utilisée par le
      // registre de providers de confiance (jamais un issuer
      // arbitraire accepté).
      fakeProviderIssuer: requireString('SSO_FAKE_PROVIDER_ISSUER', `http://localhost:${requireInt('PORT', '4000')}/auth/fake-provider`),
      // Secret de signature HMAC de la transaction de login -- aucune
      // valeur par défaut en production, même principe que DB_PASSWORD.
      transactionSigningSecret: nodeEnv === 'production'
        ? requireString('SSO_TRANSACTION_SIGNING_SECRET')
        : requireString('SSO_TRANSACTION_SIGNING_SECRET', 'dev-only-transaction-signing-secret-never-use-in-production'),
      // __Host- exige Secure=true, Path=/, aucun Domain -- inutilisable
      // tel quel en développement (Secure=false sur http:// local, le
      // navigateur rejetterait purement et simplement le cookie).
      // Noms distincts en développement, jamais un simple retrait
      // silencieux du préfixe qui laisserait croire à la même garantie.
      sessionCookieName: nodeEnv === 'production' ? '__Host-storm_session' : 'storm_session_dev',
      transactionCookieName: nodeEnv === 'production' ? '__Host-storm_oidc_tx' : 'storm_oidc_tx_dev',
      sessionTtlHours: requireInt('SSO_SESSION_TTL_HOURS', '24'),
      // Origines de confiance pour la validation stricte d'Origin sur
      // les méthodes non sûres (voir CSRF). Jamais une liste ouverte.
      allowedOrigins: requireString('SSO_ALLOWED_ORIGINS', `http://localhost:${requireInt('PORT', '4000')}`)
        .split(',').map(o => o.trim()).filter(Boolean),
      // Rate limiting léger sur /auth/login et /auth/callback --
      // ralentit le bourrage, jamais un mécanisme d'autorisation.
      // Valeur par défaut généreuse pour un usage normal (plusieurs
      // tentatives légitimes par minute restent possibles) ; resserrée
      // explicitement dans les tests qui vérifient le déclenchement
      // lui-même, jamais en production.
      authRateLimitWindowMs: requireInt('SSO_AUTH_RATE_LIMIT_WINDOW_MS', '60000'),
      authRateLimitMax: requireInt('SSO_AUTH_RATE_LIMIT_MAX', '100')
    }
  };
}
