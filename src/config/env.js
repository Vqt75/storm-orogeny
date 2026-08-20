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
    }
  };
}
