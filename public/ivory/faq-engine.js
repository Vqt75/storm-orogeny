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

export function normalize(text = "") {
  return text.toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text = "") {
  return normalize(text).split(" ")
    .filter(w => w && !stopWords.has(w))
    .map(w => synonymMap[w] || w);
}

export function scoreEntry(question, entry) {
  const normQ  = normalize(question);
  const tokens = tokenize(question);
  let score = 0;

  (entry.keywords || []).forEach(kw => {
    tokenize(kw).forEach(t => { if (tokens.includes(t)) score += 3; });
    const nk = normalize(kw);
    if (nk.length > 3 && normQ.includes(nk)) score += 5;
  });

  (entry.phrases || []).forEach(phrase => {
    const np = normalize(phrase);
    if (np && normQ.includes(np)) score += 10;
  });

  (entry.intentSignals || []).forEach(sig => {
    const ns = normalize(sig);
    if (tokens.includes(ns) || (ns.length > 3 && normQ.includes(ns))) score += 4;
  });

  (entry.emotionSignals || []).forEach(sig => {
    const ns = normalize(sig);
    if (tokens.includes(ns) || (ns.length > 3 && normQ.includes(ns))) score += 2;
  });

  (entry.negativeSignals || []).forEach(sig => {
    const ns = normalize(sig);
    if (tokens.includes(ns) || (ns.length > 3 && normQ.includes(ns))) score -= 3;
  });

  score += (entry.priority || 0);
  return score;
}

// Signature adaptée : Pangea lisait `faqData` (variable globale) ;
// ici la liste d'entrées est un paramètre explicite — mêmes règles de
// décision, sans dépendance à un état global implicite.
export function matchFaq(question, faqItems) {
  const scored = (faqItems || [])
    .map(entry => ({ entry, score: scoreEntry(question, entry) }))
    .sort((a, b) => b.score - a.score);

  const best   = scored[0];
  const second = scored[1];

  if (!best || best.score < 12) return null;

  const strongCandidates = scored.filter(s => s.score >= 28);
  const distinctCategories = new Set(strongCandidates.map(s => s.entry.category));
  if (distinctCategories.size >= 3) return null;

  if (second && second.score >= 18) {
    const gap = best.score - second.score;
    if (gap < 5 && best.entry.category !== second.entry.category) {
      if ((second.entry.priority || 0) > (best.entry.priority || 0)) return second.entry;
      if ((best.entry.priority || 0) === (second.entry.priority || 0)) return null;
    }
  }

  if (second && Math.abs(best.score - second.score) <= 3) {
    if ((second.entry.priority || 0) > (best.entry.priority || 0)) {
      return second.entry;
    }
  }

  return best.entry;
}
