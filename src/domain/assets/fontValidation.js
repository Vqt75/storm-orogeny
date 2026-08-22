// Validation d'upload de police — même doctrine que imageValidation.js :
// jamais confiance au seul Content-Type annoncé par le client, vérifier
// la signature binaire réelle avant persistance.

export const ALLOWED_FONT_MIME_TO_EXTENSION = {
  'font/woff2': 'woff2',
  'font/woff': 'woff',
  'font/otf': 'otf',
  'font/ttf': 'ttf',
  // Certains navigateurs/OS annoncent encore ces variantes historiques
  // pour les mêmes formats réels — acceptées en entrée, jamais utilisées
  // en sortie (l'extension stockée reste toujours l'une des 4 ci-dessus).
  'application/font-woff2': 'woff2',
  'application/font-woff': 'woff',
  'application/x-font-ttf': 'ttf',
  'application/x-font-otf': 'otf',
  'application/vnd.ms-fontobject': 'ttf' // jamais réellement atteint (signature EOT non vérifiée ci-dessous, rejeté à la signature)
};

export const MAX_FONT_BYTES = 5 * 1024 * 1024; // 5 Mo — même limite que le logo

// MIME canonique par extension détectée — jamais le Content-Type
// annoncé par le navigateur, qui varie selon navigateur/OS pour un
// même format réel (ex. 'application/font-woff2' vs 'font/woff2').
// Stocker systématiquement cette forme canonique dans assets.content_type
// garantit que la résolution d'URL publique (compiler.js) et la
// vérification d'extension (publicAssets.js) n'ont jamais qu'UNE
// seule variante à connaître pour chaque format, jamais une table de
// correspondance à maintenir en double dans deux fichiers différents.
export const FONT_EXTENSION_TO_CANONICAL_MIME = {
  woff2: 'font/woff2',
  woff: 'font/woff',
  otf: 'font/otf',
  ttf: 'font/ttf'
};

const WOFF2_SIGNATURE = Buffer.from('wOF2', 'ascii');
const WOFF_SIGNATURE = Buffer.from('wOFF', 'ascii');
const OTF_SIGNATURE = Buffer.from('OTTO', 'ascii');
const TTF_SIGNATURE = Buffer.from([0x00, 0x01, 0x00, 0x00]);

// La signature réelle du fichier décide de l'extension normalisée,
// jamais le Content-Type annoncé (qui varie selon navigateur/OS pour
// un même format réel) — évite de stocker une extension incohérente
// avec le contenu binaire effectif.
export function detectFontExtension(buffer) {
  if (buffer.subarray(0, 4).equals(WOFF2_SIGNATURE)) return 'woff2';
  if (buffer.subarray(0, 4).equals(WOFF_SIGNATURE)) return 'woff';
  if (buffer.subarray(0, 4).equals(OTF_SIGNATURE)) return 'otf';
  if (buffer.subarray(0, 4).equals(TTF_SIGNATURE)) return 'ttf';
  return null;
}
