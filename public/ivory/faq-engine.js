import { normalize, createLexicalMatcher } from '../shared/lexicalMatcher.js';
export { normalize };

// TECTONIC — Public Core : moteur de correspondance FAQ (Phase 5)
//
// Port fidèle du moteur réel de Pangea (index.html, normalize/tokenize/
// scoreEntry/matchFaq) — pas une réinterprétation. stopWords et
// synonymMap sont recopiés à l'identique depuis la source, pas
// redevinés.
//
// Logique volontairement partagée entre éditions (pas spécifique à
// Ivory) : le scoring des questions est une fonction du Public Core,
// pas une préoccupation de rendu visuel — cohérent avec la séparation
// Renderer / Public Runtime déjà actée pour la Phase 5.

const stopWords = new Set([
  "ou","où","est","ce","que","qu","on","va","je","tu","il","elle","nous","vous",
  "ils","elles","le","la","les","un","une","des","du","de","d","a","au","aux",
  "en","dans","sur","pour","avec","et","mon","ma","mes","notre","nos","votre",
  "vos","y","aura","t","sera","seront","sont","avoir","etre","quels","quelle",
  "quelles","comment","quel","quoi","qui","si"
]);

const synonymMap = {
  cantine:"restauration", manger:"restauration", repas:"restauration",
  dejeuner:"restauration", restaurant:"restauration", lunch:"restauration", tr:"restauration",
  demenager:"demenagement", transfert:"demenagement", bascule:"demenagement",
  visite:"visites", visiter:"visites", decouverte:"visites",
  acces:"acces", entrer:"acces", entree:"acces",
  wifi:"informatique", reseau:"informatique", teams:"informatique",
  outlook:"informatique", it:"informatique", ordinateur:"informatique",
  telephone:"informatique", materiel:"informatique", outils:"informatique",
  parking:"stationnement", voiture:"stationnement", garage:"stationnement",
  velo:"mobilite", bicyclette:"mobilite", cycliste:"mobilite",
  trottinette:"mobilite", douche:"mobilite", vestiaire:"mobilite",
  navigo:"transport", metro:"transport", rer:"transport", bus:"transport",
  train:"transport", abonnement:"transport", navette:"transport", covoiturage:"transport",
  remote:"teletravail", maison:"teletravail", presentiel:"teletravail", hybride:"teletravail",
  horaire:"horaires", flexible:"horaires", souplesse:"horaires",
  bureau:"poste", place:"poste", desk:"poste",
  attitree:"attribue", attribuee:"attribue",
  salle:"reunion", salles:"reunion", booking:"reservation",
  casier:"rangement", casiers:"rangement", locker:"rangement",
  placard:"rangement", stockage:"rangement",
  bruit:"concentration", silence:"concentration", cabine:"concentration",
  bulle:"concentration", focus:"concentration", phonique:"concentration",
  ambassadeur:"ambassadeurs", relais:"ambassadeurs",
  referent:"ambassadeurs", volontaire:"ambassadeurs",
  atelier:"ateliers", workshop:"ateliers",
  charte:"regles", comportement:"regles", normes:"regles",
  rumeur:"rumeurs", fake:"rumeurs", intox:"rumeurs",
  archives:"archivage", documents:"archivage", papiers:"archivage",
  dossiers:"archivage", scanner:"archivage", destruction:"archivage",
  pmr:"accessibilite", fauteuil:"accessibilite",
  handicap:"accessibilite", ascenseur:"accessibilite"
};

export function tokenize(text = "") {
  return normalize(text).split(" ")
    .filter(w => w && !stopWords.has(w))
    .map(w => synonymMap[w] || w);
}

const legacyMatcher = createLexicalMatcher({ tokenize });
export const { scoreEntry, matchFaq } = legacyMatcher;
