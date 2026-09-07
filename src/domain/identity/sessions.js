// Primitives auth_sessions — Batch 1 des fondations SSO / External
// Identity V1. Aucun cookie n'est créé ici (ce sera la responsabilité
// d'un futur middleware/route) -- ce module ne fait que générer,
// stocker (sous forme de hash) et vérifier des sessions.
//
// Invariant central : le token brut de session n'est JAMAIS persisté,
// JAMAIS logué. Seule son empreinte SHA-256 existe en base
// (session_token_hash). La valeur brute n'est retournée qu'À L'APPELANT
// de createSession, exactement une fois, pour qu'il construise plus
// tard le cookie -- jamais recalculée, jamais journalisée nulle part
// dans ce module.

import { randomBytes, createHash } from 'node:crypto';

const SESSION_TOKEN_BYTES = 32; // 256 bits d'entropie, CSPRNG (crypto.randomBytes)

function generateRawSessionToken() {
  return randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
}

function hashSessionToken(rawToken) {
  return createHash('sha256').update(rawToken).digest('hex');
}

// Crée une session -- génère le token en interne (jamais fourni par
// l'appelant, pour qu'aucun code externe n'ait l'occasion de le
// journaliser par erreur avant que ce module ne le retourne). Ne
// stocke que le hash. Retourne {rawToken, session} -- rawToken ne doit
// jamais être conservé au-delà de la construction immédiate du cookie
// par l'appelant.
export async function createSession(pool, { userId, externalIdentityId = null, expiresAt }) {
  const rawToken = generateRawSessionToken();
  const tokenHash = hashSessionToken(rawToken);
  const { rows: [row] } = await pool.query(
    `insert into auth_sessions (user_id, external_identity_id, session_token_hash, expires_at)
     values ($1, $2, $3, $4)
     returning id, user_id, external_identity_id, created_at, expires_at, revoked_at`,
    [userId, externalIdentityId, tokenHash, expiresAt]
  );
  return { rawToken, session: row };
}

// Retrouve une session active à partir de la valeur BRUTE présentée
// (ex. valeur du cookie) -- hashe en interne, ne compare jamais la
// valeur brute directement. Retourne null si absente, expirée ou
// révoquée -- l'appelant ne distingue pas ces trois cas (une session
// invalide est une session invalide, jamais un signal différencié
// utile côté client).
export async function findActiveSessionByRawToken(pool, rawToken) {
  const tokenHash = hashSessionToken(rawToken);
  const { rows: [row] } = await pool.query(
    `select id, user_id, external_identity_id, created_at, expires_at, revoked_at
     from auth_sessions
     where session_token_hash = $1
       and revoked_at is null
       and expires_at > now()`,
    [tokenHash]
  );
  return row ?? null;
}

export async function revokeSession(pool, sessionId) {
  const { rows: [row] } = await pool.query(
    `update auth_sessions set revoked_at = now()
     where id = $1 and revoked_at is null
     returning id, user_id, external_identity_id, revoked_at`,
    [sessionId]
  );
  return row ?? null;
}

// Révoque uniquement les sessions issues d'UNE identité externe
// précise -- jamais toutes les sessions de l'utilisateur (doctrine
// corrigée et validée : révocation d'identité externe ≠ suspension
// utilisateur). Une autre identité externe active du même utilisateur
// garde ses propres sessions intactes.
export async function revokeSessionsByExternalIdentity(pool, externalIdentityId) {
  const { rows } = await pool.query(
    `update auth_sessions set revoked_at = now()
     where external_identity_id = $1 and revoked_at is null
     returning id`,
    [externalIdentityId]
  );
  return rows.length;
}

// Primitive séparée, distincte de la précédente -- révoque TOUTES les
// sessions d'un utilisateur. Réservée à une future suspension
// administrative de l'utilisateur lui-même (concept qui n'existe pas
// encore dans le modèle -- voir audit) -- jamais appelée aujourd'hui
// par aucun chemin de code, disponible seulement pour ce futur usage.
export async function revokeAllSessionsForUser(pool, userId) {
  const { rows } = await pool.query(
    `update auth_sessions set revoked_at = now()
     where user_id = $1 and revoked_at is null
     returning id`,
    [userId]
  );
  return rows.length;
}
