// Chiffrement authentifié (AES-256-GCM) de la capability d'Accès
// Public -- permet à Studio de reconstruire l'URL publique active
// (copier le lien, régénérer le QR, l'afficher après reconnexion),
// contrairement à un token de session qui n'a jamais besoin d'être
// récupéré (voir sessions.js, hash seul, jamais de récupération).
//
// Note de gestion de clé (V1, assumée explicitement) : une seule clé
// applicative (`config.publicAccessEncryptionKey`), non versionnée. Si
// cette clé doit un jour être rotée, toute capability déjà chiffrée
// devient illisible sauf migration de ré-chiffrement dédiée (déchiffrer
// avec l'ancienne clé, rechiffrer avec la nouvelle, ligne par ligne).
// Aucune infrastructure KMS introduite dans ce Lot.
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // recommandation standard AES-GCM
const AUTH_TAG_BYTES = 16;

// encryptCapability -- retourne un paquet auto-suffisant (IV + tag
// d'authentification + texte chiffré, tous nécessaires au déchiffrement),
// encodé en une seule chaîne base64url jointe par ':'. Jamais la valeur
// brute persistée ailleurs que sous cette forme chiffrée.
export function encryptCapability(rawCapability, encryptionKey) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(rawCapability, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64url'), authTag.toString('base64url'), ciphertext.toString('base64url')].join(':');
}

// decryptCapability -- lève une erreur si la clé est incorrecte ou si
// le paquet a été altéré (l'authentification AEAD échoue avant même
// de tenter un déchiffrement partiel) -- jamais un texte partiellement
// déchiffré retourné silencieusement.
export function decryptCapability(packed, encryptionKey) {
  const parts = String(packed).split(':');
  if (parts.length !== 3) {
    throw new Error('Paquet de capability chiffrée malformé.');
  }
  const [ivPart, authTagPart, ciphertextPart] = parts;
  const iv = Buffer.from(ivPart, 'base64url');
  const authTag = Buffer.from(authTagPart, 'base64url');
  const ciphertext = Buffer.from(ciphertextPart, 'base64url');
  if (authTag.length !== AUTH_TAG_BYTES) {
    throw new Error('Paquet de capability chiffrée malformé.');
  }
  const decipher = createDecipheriv(ALGORITHM, encryptionKey, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}
