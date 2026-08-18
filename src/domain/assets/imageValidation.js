// Validation d'upload d'image — partagée entre tous les endpoints
// d'upload Studio (logo, images de contenu, futurs domaines). Un seul
// endroit pour cette logique, jamais dupliquée route par route.
//
// SVG volontairement exclu : c'est du XML actif, pas une image
// inerte — le servir depuis le même origin sans sanitisation serait
// un vrai risque. Réintroduction possible plus tard, derrière une
// politique de sanitisation explicite et testée.
export const ALLOWED_MIME_TO_EXTENSION = {
  'image/png': 'png',
  'image/jpeg': 'jpg'
};

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 Mo

// Ne jamais faire confiance uniquement au Content-Type annoncé par le
// client — vérifier la signature binaire réelle avant persistance.
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);

export function matchesRealFileSignature(buffer, mimetype) {
  if (mimetype === 'image/png') return buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
  if (mimetype === 'image/jpeg') return buffer.subarray(0, JPEG_SIGNATURE.length).equals(JPEG_SIGNATURE);
  return false;
}
