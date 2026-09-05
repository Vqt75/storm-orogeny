// Sealed answerability holdout. Authored before any NLI inference.
// It is independent from the official baseline and the prior Decision Corpus.

const COVERED = [
  ['equinoxe-q004', 'paraphrase_naturelle', 'À quelle date se déroulera la semaine prévue pour préparer notre arrivée ?'],
  ['equinoxe-q006', 'paraphrase_naturelle', 'Depuis quand peut-on découvrir le plateau témoin ?'],
  ['equinoxe-q007', 'paraphrase_naturelle', 'Aurons-nous assez de temps pour organiser nos affaires avant le transfert ?'],
  ['equinoxe-q008', 'paraphrase_naturelle', 'Peut-on continuer à interroger l’équipe projet sans date de clôture ?'],
  ['equinoxe-q009', 'paraphrase_naturelle', 'Le transfert de tous les collaborateurs aura-t-il lieu simultanément ?'],
  ['equinoxe-q012', 'paraphrase_naturelle', 'Est-ce que mon emplacement de travail devra varier quotidiennement ?'],
  ['equinoxe-q014', 'paraphrase_naturelle', 'Notre collectif conservera-t-il durablement le même secteur ?'],
  ['equinoxe-q015', 'paraphrase_naturelle', 'Pourrai-je sélectionner librement une place en arrivant le matin ?'],

  ['equinoxe-q017', 'synonymes', 'Pourquoi abandonner les postes nominatifs au profit de places partagées ?'],
  ['equinoxe-q018', 'synonymes', 'Un booking est-il obligatoire avant de choisir un desk ?'],
  ['equinoxe-q021', 'synonymes', 'Faut-il signaler à l’avance ses journées de présence sur site ?'],
  ['equinoxe-q023', 'synonymes', 'Les cabines pour appels spontanés nécessitent-elles une réservation ?'],
  ['equinoxe-q024', 'synonymes', 'Peut-on bloquer le Forum pour une manifestation interne ?'],
  ['equinoxe-q026', 'synonymes', 'Qu’est-ce qui distingue les postes isolés de la zone collective silencieuse ?'],
  ['equinoxe-q031', 'synonymes', 'Quel effectif maximal peut travailler dans une salle projet ?'],
  ['equinoxe-q032', 'synonymes', 'Où pourra-t-on avoir des conversations informelles entre collègues ?'],

  ['equinoxe-q033', 'vocabulaire_different', 'Chaque collectif disposera-t-il à proximité de pièces fermées de petite taille ?'],
  ['equinoxe-q036', 'vocabulaire_different', 'Sans place attitrée, dans quel rangement sécurisé déposer mes effets ?'],
  ['equinoxe-q037', 'vocabulaire_different', 'Après un trajet à bicyclette, pourra-t-on se laver près du stationnement ?'],
  ['equinoxe-q039', 'vocabulaire_different', 'À partir de quel jour pourrai-je obtenir un rangement individuel ?'],
  ['equinoxe-q041', 'vocabulaire_different', 'L’installation à Cobalt augmente-t-elle le nombre de trajets hebdomadaires obligatoires ?'],
  ['equinoxe-q042', 'vocabulaire_different', 'Notre rythme de travail depuis le domicile sera-t-il conservé ?'],
  ['equinoxe-q044', 'vocabulaire_different', 'Le responsable d’équipe pourra-t-il fixer de nouvelles journées imposées sur place à cause du projet ?'],
  ['equinoxe-q046', 'vocabulaire_different', 'Le transfert exige-t-il de remplacer la machine professionnelle que j’utilise déjà ?'],

  ['equinoxe-q048', 'adjacentButResolvable', 'Une aide technique sera-t-elle disponible pour connecter les équipements lors de la préparation ?'],
  ['equinoxe-q049', 'adjacentButResolvable', 'Le guide précisera-t-il comment les moniteurs seront répartis entre les places ?'],
  ['equinoxe-q051', 'adjacentButResolvable', 'Une salle fermée convient-elle pour discuter confidentiellement avec les RH ?'],
  ['equinoxe-q052', 'adjacentButResolvable', 'L’isolation sonore des salles projet est-elle prévue pour le travail en petit groupe ?'],
  ['equinoxe-q053', 'adjacentButResolvable', 'L’entretien annuel se réserve-t-il avec le même outil que les réunions ?'],
  ['equinoxe-q055', 'adjacentButResolvable', 'Une gare du réseau express régional se trouve-t-elle près de Cobalt ?'],
  ['equinoxe-q056', 'adjacentButResolvable', 'Le site prévoit-il stationnement, recharge et douche pour les cyclistes ?'],
  ['equinoxe-q057', 'adjacentButResolvable', 'Quelle procédure permet de faire entrer une personne extérieure sur le site ?']
];

const NOT_COVERED = [
  ['hardNegative', 'À quelle heure précise la semaine de préparation commencera-t-elle chaque matin ?'],
  ['hardNegative', 'Combien de minutes faut-il prévoir entre le RER et mon quartier exact ?'],
  ['hardNegative', 'Quel fournisseur fabriquera les casiers individuels ?'],
  ['hardNegative', 'Quel débit wifi minimal sera contractuellement garanti à chaque poste ?'],
  ['hardNegative', 'Combien coûtera la réservation d’une Project Room à la journée ?'],
  ['hardNegative', 'Quelle température sera maintenue dans les espaces Focus en hiver ?'],
  ['hardNegative', 'Qui assurera la maintenance quotidienne des prises pour vélos électriques ?'],
  ['hardNegative', 'Combien de visiteurs simultanés l’accueil pourra-t-il enregistrer ?'],

  ['nearButUnpublished', 'Quelle marque exacte de siège équipera chaque poste partagé ?'],
  ['nearButUnpublished', 'À quelle minute ouvrira le restaurant le jour de l’emménagement ?'],
  ['nearButUnpublished', 'Quelle dimension intérieure aura le plus petit casier personnel ?'],
  ['nearButUnpublished', 'Quel numéro de quai RER faut-il emprunter pour rejoindre Cobalt ?'],
  ['nearButUnpublished', 'Quel indice acoustique certifié auront les Project Rooms ?'],
  ['nearButUnpublished', 'Quel nom commercial portera l’application de réservation ?'],
  ['nearButUnpublished', 'Combien de bornes de recharge automobile seront disponibles dès janvier ?'],
  ['nearButUnpublished', 'Quelle référence précise d’écran sera installée dans les quartiers ?'],

  ['falsePremise', 'Pourquoi la semaine de préparation a-t-elle été annulée ?'],
  ['falsePremise', 'Comment récupérer le bureau nominatif attribué à chaque manager ?'],
  ['falsePremise', 'Pourquoi les bulles deviennent-elles payantes sur réservation ?'],
  ['falsePremise', 'Quand le télétravail sera-t-il supprimé après le déménagement ?'],
  ['falsePremise', 'Pourquoi les cyclistes ne pourront-ils pas utiliser de douche ?'],
  ['falsePremise', 'Comment obtenir la clé de ma Project Room personnelle permanente ?'],
  ['falsePremise', 'Pourquoi les stagiaires seront-ils exclus des quartiers d’équipe ?'],
  ['falsePremise', 'Quand le restaurant fermera-t-il définitivement après l’ouverture ?'],

  ['clearOutOfCorpus', 'Comment modifier mon prélèvement automatique d’impôts ?'],
  ['clearOutOfCorpus', 'Quel est le cours de clôture de l’euro face au dollar ?'],
  ['clearOutOfCorpus', 'Puis-je faire livrer une ordonnance à ma pharmacie habituelle ?'],
  ['clearOutOfCorpus', 'Comment inscrire mon enfant à une activité sportive municipale ?'],
  ['clearOutOfCorpus', 'Quelle compagnie dessert le vol direct pour Montréal demain ?'],
  ['clearOutOfCorpus', 'Comment renouveler le contrôle technique de mon véhicule personnel ?'],
  ['clearOutOfCorpus', 'Quel mot de passe utiliser pour ma banque en ligne ?'],
  ['clearOutOfCorpus', 'Où consulter les résultats du championnat de football ?']
];

const AMBIGUOUS = [
  ['mixedIntents', 'Quand commence la préparation et comment réserver une salle de réunion ?'],
  ['mixedIntents', 'Puis-je garder mon ordinateur et disposer d’une douche après le vélo ?'],
  ['mixedIntents', 'Le télétravail reste-t-il identique et le Forum est-il réservable ?'],
  ['mixedIntents', 'Combien de personnes tient une Project Room et où ranger mes affaires ?'],
  ['mixedIntents', 'Comment accueillir un visiteur et savoir si une salle est libre ?'],
  ['mixedIntents', 'Les bulles sont-elles réservables et quand ouvre la réservation des casiers ?'],
  ['mixedIntents', 'Pourquoi abandonner les bureaux attribués et peut-on déjeuner dehors ?'],
  ['mixedIntents', 'La gare RER est-elle proche et les écrans seront-ils partagés ?'],
  ['mixedIntents', 'Qui compose les quartiers et où poser une question qui manque dans Storm ?'],
  ['mixedIntents', 'Le Café central est-il ouvert toute la journée et combien le bâtiment a-t-il d’étages ?'],
  ['mixedIntents', 'Peut-on annuler une Project Room et suivre l’avancement du projet ?'],
  ['mixedIntents', 'Les managers ont-ils un espace dédié et le wifi couvre-t-il toutes les salles ?'],
  ['mixedIntents', 'Comment demander un poste adapté et à quelle date a lieu la préparation ?'],
  ['mixedIntents', 'Le restaurant ouvre-t-il le premier jour et peut-on réserver le Forum ?'],
  ['mixedIntents', 'Où passer un entretien confidentiel et combien de collaborateurs viendront à Cobalt ?'],
  ['mixedIntents', 'Puis-je venir à vélo et comment seront configurés mes logiciels ?'],

  ['trueAmbiguous', 'Dois-je choisir une bulle, une salle ou un espace Focus ?'],
  ['trueAmbiguous', 'Faut-il réserver cet espace avant de venir ?'],
  ['trueAmbiguous', 'Combien de personnes peuvent tenir dans la salle ?'],
  ['trueAmbiguous', 'Qui dois-je contacter pour régler ce problème ?'],
  ['trueAmbiguous', 'Est-ce que cette zone restera toujours la même ?'],
  ['trueAmbiguous', 'Peut-on y manger ou seulement discuter ?'],
  ['trueAmbiguous', 'Cela sera-t-il disponible dès le premier jour ?'],
  ['trueAmbiguous', 'Est-ce prévu pour les visiteurs aussi ?'],
  ['trueAmbiguous', 'Je dois le réserver pour une heure ou pour toute la journée ?'],
  ['trueAmbiguous', 'Où pourrai-je déposer cela en arrivant ?'],
  ['trueAmbiguous', 'Est-ce mon équipe ou le projet qui décide ?'],
  ['trueAmbiguous', 'Cette règle concerne-t-elle tout le monde ?'],
  ['trueAmbiguous', 'Peut-on modifier ce choix plus tard ?'],
  ['trueAmbiguous', 'Est-ce accessible sans prévenir quelqu’un ?'],
  ['trueAmbiguous', 'Quel espace est le plus adapté dans mon cas ?'],
  ['trueAmbiguous', 'Quand recevra-t-on les détails définitifs ?']
];

const coveredCases = COVERED.map(([expectedEntryId, type, formulation], index) => ({
  id: `answerability-holdout-covered-${String(index + 1).padStart(2, '0')}`,
  label: 'covered', type, formulation, expectedEntryId, intentId: null,
  risk: null,
  rationale: `La Q&A ${expectedEntryId} couvre directement cette formulation.`
}));

const notCoveredCases = NOT_COVERED.map(([type, formulation], index) => ({
  id: `answerability-holdout-not-covered-${String(index + 1).padStart(2, '0')}`,
  label: 'notCovered', type, formulation, expectedEntryId: null, intentId: null,
  risk: type === 'clearOutOfCorpus' ? 'weak' : 'dangerous',
  rationale: 'Aucune réponse canonique ne fournit la connaissance demandée.'
}));

const ambiguousCases = AMBIGUOUS.map(([type, formulation], index) => ({
  id: `answerability-holdout-ambiguous-${String(index + 1).padStart(2, '0')}`,
  label: 'ambiguous', type, formulation, expectedEntryId: null, intentId: null,
  risk: 'dangerous',
  rationale: type === 'mixedIntents'
    ? 'Plusieurs intentions couvertes exigeraient plusieurs réponses distinctes.'
    : 'La formulation ne permet pas d’identifier une connaissance unique.'
}));

export const answerabilityHoldoutCases = Object.freeze([
  ...coveredCases,
  ...notCoveredCases,
  ...ambiguousCases
]);

export const answerabilityHoldoutContract = Object.freeze({
  schemaVersion: 1,
  authoredBeforeNliRun: true,
  total: 96,
  labels: { covered: 32, notCovered: 32, ambiguous: 32 },
  coveredTypes: { paraphrase_naturelle: 8, synonymes: 8, vocabulaire_different: 8, adjacentButResolvable: 8 },
  notCoveredTypes: { hardNegative: 8, nearButUnpublished: 8, falsePremise: 8, clearOutOfCorpus: 8 },
  ambiguousTypes: { mixedIntents: 16, trueAmbiguous: 16 }
});
