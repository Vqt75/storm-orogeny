// Registre de providers SSO -- Batch 2. Source unique de vérité pour
// "quels providers/issuers Storm fait-il confiance ?". Aucun issuer
// n'est jamais découvert dynamiquement depuis une entrée utilisateur
// (query param, body, header) -- seule une entrée présente ICI peut
// être utilisée pour initier ou valider une connexion.
//
// NOTE D'ARCHITECTURE -- futur adaptateur Entra réel : le fake
// provider actuel n'effectue aucune vraie validation cryptographique
// (pas de jeton réel à vérifier, voir fakeProvider.js) et peut rester
// ainsi, sans dépendance. Un futur adaptateur réel (Entra ou autre)
// NE DOIT PAS réimplémenter à la main, avec node:crypto, la
// validation OIDC/JWT (discovery, JWKS, signature, iss/aud/exp/iat/
// nonce/azp, PKCE côté serveur de jetons) -- doit s'appuyer sur une
// bibliothèque OIDC/JWT maintenue et éprouvée pour cette partie
// précise. La transaction de login elle-même (state/nonce/PKCE côté
// Storm, cookie signé HMAC) reste as-is, inchangée par ce futur
// adaptateur -- seule la validation du jeton retourné par le vrai
// IdP relève de cette bibliothèque.
//
// Batch 2 : uniquement le fake provider (développement/tests),
// JAMAIS enregistré en production -- voir buildRegistry ci-dessous.
// Un futur adaptateur Entra réel s'ajoutera à ce même registre, sans
// jamais changer la façon dont il est consulté par les routes /auth/*.

import * as fakeProvider from './fakeProvider.js';

// issuer du fake provider : configurable (utile pour faire varier la
// valeur en test), mais toujours une valeur CONNUE à l'avance, jamais
// dérivée d'une requête entrante.
//
// En production, le fake provider n'est JAMAIS enregistré -- ni comme
// provider par défaut, ni comme issuer trusted, quelle que soit la
// configuration. Aucun repli automatique vers fake en l'absence d'un
// provider production valide : le registre reste alors VIDE, et
// /auth/login échoue proprement (PROVIDER_NOT_CONFIGURED) plutôt que
// d'utiliser silencieusement une identité non réelle.
function buildRegistry(config) {
  const registry = new Map();
  if (!config.isProduction) {
    registry.set(fakeProvider.FAKE_PROVIDER_TYPE, {
      providerType: fakeProvider.FAKE_PROVIDER_TYPE,
      issuer: config.sso.fakeProviderIssuer,
      adapter: fakeProvider
    });
  }
  return registry;
}

export function createProviderRegistry(config) {
  const registry = buildRegistry(config);

  return {
    // Le seul provider à proposer par défaut tant qu'aucune UI de
    // sélection n'existe (hors scope de ce batch) -- undefined si le
    // registre est vide (production sans provider réel configuré),
    // jamais un repli implicite vers fake.
    getDefaultProviderType() {
      const [first] = registry.keys();
      return first;
    },
    // Retrouve un provider par son type -- undefined si absent du
    // registre, jamais une résolution partielle/permissive.
    getByProviderType(providerType) {
      return registry.get(providerType);
    },
    // Un issuer n'est trusted QUE s'il correspond exactement à
    // l'issuer configuré pour un providerType du registre -- jamais un
    // match partiel, jamais insensible à la casse.
    isTrustedIssuer(providerType, issuer) {
      const entry = registry.get(providerType);
      return Boolean(entry) && entry.issuer === issuer;
    }
  };
}
