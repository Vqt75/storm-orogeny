// Transaction de login OIDC -- Batch 2. Porte state/nonce/PKCE/issuer
// attendu entre /auth/login et /auth/callback, jamais réutilisable
// comme session. Volontairement PAS une table DB : la transaction est
// strictement bornée au navigateur d'un seul utilisateur, sur une
// fenêtre de quelques minutes -- une table n'apporterait aucune
// garantie supplémentaire (voir Security Implementation Gate validé),
// seulement une écriture de plus par tentative de login.
//
// Le cookie est signé (HMAC-SHA256), jamais seulement opaque : sa
// valeur est visible par construction (state/nonce/issuer n'ont pas
// besoin d'être secrets), mais elle ne doit jamais pouvoir être
// falsifiée côté client -- la signature garantit qu'aucun champ n'a
// été modifié entre l'émission et la vérification.

import { randomBytes, createHash, createHmac, timingSafeEqual } from 'node:crypto';

const TRANSACTION_TTL_MS = 10 * 60 * 1000; // 10 minutes -- borne haute de la plage validée (5-10 min).

function base64url(buffer) {
  return buffer.toString('base64url');
}

function randomToken(bytes = 32) {
  return base64url(randomBytes(bytes));
}

// PKCE (RFC 7636), méthode S256 -- code_verifier aléatoire, challenge
// = base64url(SHA256(verifier)). Générés ici même pour un fake
// provider qui n'en a pas l'usage réel : la transaction doit exercer
// la même forme que pour un futur provider réel, jamais une version
// simplifiée qui devrait être reconstruite plus tard.
function generatePkcePair() {
  const codeVerifier = randomToken(32);
  const codeChallenge = base64url(createHash('sha256').update(codeVerifier).digest());
  return { codeVerifier, codeChallenge };
}

function sign(payloadB64, secret) {
  return createHmac('sha256', secret).update(payloadB64).digest('base64url');
}

// Construit la valeur de cookie signée -- {state, nonce, codeVerifier,
// codeChallenge, expectedIssuer, providerType, expiresAt}. Retourne à
// la fois la valeur du cookie (à poser) et les champs utiles pour
// construire l'URL d'autorisation (state/nonce/codeChallenge).
export function createLoginTransaction({ providerType, expectedIssuer, secret }) {
  const state = randomToken(24);
  const nonce = randomToken(24);
  const { codeVerifier, codeChallenge } = generatePkcePair();
  const expiresAt = Date.now() + TRANSACTION_TTL_MS;

  const payload = { providerType, expectedIssuer, state, nonce, codeVerifier, expiresAt };
  const payloadB64 = base64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  const signature = sign(payloadB64, secret);
  const cookieValue = `${payloadB64}.${signature}`;

  return { cookieValue, state, nonce, codeChallenge, providerType, expectedIssuer };
}

// Vérifie une valeur de cookie de transaction. Retourne
// {ok:true, transaction} ou {ok:false, reason} -- jamais une
// exception qui fuiterait un détail interne au client. reason reste
// un code stable interne (jamais renvoyé tel quel au navigateur),
// utile uniquement pour les logs/tests.
export function verifyLoginTransaction(cookieValue, secret) {
  if (typeof cookieValue !== 'string' || !cookieValue.includes('.')) {
    return { ok: false, reason: 'MALFORMED' };
  }
  const lastDot = cookieValue.lastIndexOf('.');
  const payloadB64 = cookieValue.slice(0, lastDot);
  const signature = cookieValue.slice(lastDot + 1);

  const expectedSignature = sign(payloadB64, secret);
  const sigBuf = Buffer.from(signature, 'base64url');
  const expectedBuf = Buffer.from(expectedSignature, 'base64url');
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return { ok: false, reason: 'BAD_SIGNATURE' };
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'MALFORMED' };
  }

  if (typeof payload.expiresAt !== 'number' || Date.now() > payload.expiresAt) {
    return { ok: false, reason: 'EXPIRED' };
  }

  return { ok: true, transaction: payload };
}
