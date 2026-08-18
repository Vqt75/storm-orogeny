// Validation d'upload — partagée entre tous les endpoints d'upload
// Studio (logo, images de contenu, futurs domaines). Un seul endroit
// pour cette logique, jamais dupliquée route par route.
//
// SVG volontairement exclu : c'est du XML actif, pas une image
// inerte — le servir depuis le même origin sans sanitisation serait
// un vrai risque. Réintroduction possible plus tard, derrière une
// politique de sanitisation explicite et testée.
export const ALLOWED_MIME_TO_EXTENSION = {
  'image/png': 'png',
  'image/jpeg': 'jpg'
};

// PDF : autorisé uniquement là où un besoin métier réel l'exige
// (Espaces, media.kind='document') — jamais un ajout global à tous
// les endpoints d'upload. asset.kind reste 'space_media' ; c'est le
// media.kind métier (view/plan/document) qui porte la distinction de
// nature du contenu, pas un nouveau kind d'asset.
export const ALLOWED_DOCUMENT_MIME_TO_EXTENSION = {
  'application/pdf': 'pdf'
};

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 Mo

// Ne jamais faire confiance uniquement au Content-Type annoncé par le
// client — vérifier la signature binaire réelle avant persistance.
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const PDF_SIGNATURE = Buffer.from('%PDF-', 'ascii');

export function matchesRealFileSignature(buffer, mimetype) {
  if (mimetype === 'image/png') return buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
  if (mimetype === 'image/jpeg') return buffer.subarray(0, JPEG_SIGNATURE.length).equals(JPEG_SIGNATURE);
  if (mimetype === 'application/pdf') return buffer.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE);
  return false;
}
