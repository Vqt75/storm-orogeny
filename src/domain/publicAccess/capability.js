// Génération et hachage de la capability d'Accès Public -- même motif
// que sessions.js (randomBytes CSPRNG + SHA-256 pour la recherche),
// jamais une nouvelle primitive inventée. La différence avec un token
// de session : ici la valeur brute doit aussi rester récupérable
// (voir encryption.js) -- le hash sert uniquement à la RÉSOLUTION
// publique (requête entrante -> ligne DB), jamais à la récupération
// Studio.
import { randomBytes, createHash } from 'node:crypto';

const CAPABILITY_BYTES = 32; // 256 bits d'entropie, très au-dessus du minimum de 128 bits demandé

export function generateRawCapability() {
  return randomBytes(CAPABILITY_BYTES).toString('base64url');
}

export function hashCapability(rawCapability) {
  return createHash('sha256').update(rawCapability).digest('hex');
}
