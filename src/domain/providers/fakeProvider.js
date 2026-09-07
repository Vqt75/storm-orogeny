// Fake provider -- Batch 2. Déterministe, aucun réseau, aucun secret
// Microsoft. Respecte EXACTEMENT la même interface qu'un futur
// adaptateur Entra réel (buildAuthorizeUrl / handleCallback), pour que
// le reste du système (routes /auth/*, validations) n'ait jamais à
// changer lorsque l'adaptateur réel sera branché.
//
// Le "code" transmis au callback est un blob base64url auto-porteur
// (jamais un vrai code opaque à échanger auprès d'un réseau) --
// acceptable et honnête ici précisément PARCE QUE ce provider est
// fake : aucune pseudo-validation cryptographique maison n'est simulée
// (voir consigne), seul le CONTRAT et ses états sont exercés.

export const FAKE_PROVIDER_TYPE = 'fake';

function encodeCode(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeCode(code) {
  try {
    return JSON.parse(Buffer.from(code, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

// Construit l'URL vers laquelle /auth/login redirige. Pour ce
// provider, il ne s'agit jamais d'un vrai IdP externe -- issuer est
// configuré pour pointer vers /auth/fake-provider/authorize, une
// route servie par Storm lui-même (dev/test uniquement), qui referme
// immédiatement la boucle vers /auth/callback. Le scénario et les
// valeurs de simulation voyagent en clair dans l'URL -- acceptable
// uniquement parce qu'aucune donnée réelle ne transite jamais par ce
// provider.
export function buildAuthorizeUrl({ issuer, state, nonce, codeChallenge, scenario, overrides = {} }) {
  const url = new URL(`${issuer}/authorize`);
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('scenario', scenario ?? 'success');
  if (overrides.subject) url.searchParams.set('subject', overrides.subject);
  if (overrides.email) url.searchParams.set('email', overrides.email);
  if (overrides.emailVerified !== undefined) url.searchParams.set('emailVerified', String(overrides.emailVerified));
  if (overrides.displayName) url.searchParams.set('displayName', overrides.displayName);
  if (overrides.groupIds) url.searchParams.set('groupIds', overrides.groupIds.join(','));
  return url.toString();
}

// Appelée par la route /auth/fake-provider/authorize (jamais par
// /auth/callback directement) pour produire le "code" auto-porteur
// que le callback recevra ensuite -- referme la boucle sans réseau.
export function buildFakeCode({ scenario, nonce, subject, email, emailVerified, displayName, groupIds }) {
  return encodeCode({ scenario, nonce, subject, email, emailVerified, displayName, groupIds });
}

const DEFAULTS = {
  subject: 'fake-subject-001',
  email: 'personne@fake-idp.test',
  emailVerified: true,
  displayName: 'Personne Fake',
  groupIds: ['grp-fake-1']
};

// handleCallback -- décode le code auto-porteur et produit le résultat
// exactement conforme au contrat générique :
// { issuer, subject, email, emailVerified, displayName, groups, nonce }
// où groups est une des quatre variantes {complete|absent|incomplete|error}.
// Ne fait jamais de vraie validation cryptographique (pas de signature
// à vérifier ici, il n'y a pas de vrai jeton) -- exerce uniquement les
// ÉTATS attendus du contrat.
export function handleCallback({ issuer, code }) {
  const decoded = decodeCode(code);
  if (!decoded || decoded.scenario === 'invalid-callback') {
    return { ok: false, code: 'INVALID_CALLBACK' };
  }

  const subject = decoded.subject ?? DEFAULTS.subject;
  const email = decoded.email ?? DEFAULTS.email;
  const emailVerified = decoded.emailVerified ?? DEFAULTS.emailVerified;
  const displayName = decoded.displayName ?? DEFAULTS.displayName;
  const groupIds = decoded.groupIds ?? DEFAULTS.groupIds;

  let groups;
  switch (decoded.scenario) {
    case 'groups-absent':
      groups = { kind: 'absent' };
      break;
    case 'groups-incomplete':
      groups = { kind: 'incomplete', groupIds };
      break;
    case 'groups-error':
      groups = { kind: 'error', reason: 'Simulation -- échec de récupération des groupes.' };
      break;
    case 'email-unverified':
      groups = { kind: 'complete', groupIds };
      break;
    default:
      groups = { kind: 'complete', groupIds };
  }

  return {
    ok: true,
    result: {
      issuer,
      subject,
      email,
      emailVerified: decoded.scenario === 'email-unverified' ? false : emailVerified,
      displayName,
      groups,
      nonce: decoded.nonce
    }
  };
}
