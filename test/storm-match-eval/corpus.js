// STORM MATCH — CORPUS D'ÉVALUATION (audit-only, versionné, déterministe)
//
// 30 questions canoniques sélectionnées parmi les 112 réelles du
// projet démo Équinoxe (src/db/seedDemo.js, QUESTIONS), réparties sur
// l'ensemble des familles thématiques. Chaque entrée référence le
// TEXTE EXACT de la question canonique (jamais un UUID -- l'ID réel
// est résolu par le harnais au moment de l'exécution, via l'index
// dans le tableau QUESTIONS importé directement depuis seedDemo.js,
// jamais une copie qui pourrait dériver).
//
// Types de formulations exigés par l'audit, pour chaque entrée :
// nearIdentical, naturalParaphrase, conversational, short, synonym,
// differentVocab, imperfectSyntax, typo, keywordsOnly, ambiguous.
// « ambiguous » n'a pas toujours de bonne réponse garantie -- c'est
// précisément ce qui est mesuré (voir harness.mjs, catégorie à part).
//
// outOfCorpus : requêtes qui ne doivent jamais matcher quoi que ce
// soit -- sans rapport avec le contenu réel d'Équinoxe.

export const CANONICAL_ENTRIES = [
  {
    canonicalQuestion: 'Quand déménageons-nous ?',
    formulations: {
      nearIdentical: 'Quand est-ce qu\u2019on déménage ?',
      naturalParaphrase: 'À quelle date est prévu le déménagement ?',
      conversational: 'Du coup on part quand pour Cobalt ?',
      short: 'date déménagement ?',
      synonym: 'Quand a lieu le transfert vers le nouveau site ?',
      differentVocab: 'Quand est prévue la bascule vers Cobalt ?',
      imperfectSyntax: 'nous demenageons quand exactement',
      typo: 'quand est-ce qu on demenage svp',
      keywordsOnly: 'date déménagement Cobalt',
      ambiguous: 'c\u2019est quand ?'
    }
  },
  {
    canonicalQuestion: 'Est-ce que je peux visiter Cobalt avant le déménagement ?',
    formulations: {
      nearIdentical: 'Puis-je visiter Cobalt avant le déménagement ?',
      naturalParaphrase: 'Y aura-t-il des visites du site avant qu\u2019on y emménage ?',
      conversational: 'On peut aller jeter un œil à Cobalt avant d\u2019y être ?',
      short: 'visite avant demenagement ?',
      synonym: 'Puis-je découvrir le futur site avant l\u2019emménagement ?',
      differentVocab: 'Des visites du nouveau site sont-elles prévues au préalable ?',
      imperfectSyntax: 'je peux visiter avant demenagement',
      typo: 'je peu visiter cobal avant le demenagement',
      keywordsOnly: 'visite Cobalt avant',
      ambiguous: 'je veux voir le site'
    }
  },
  {
    canonicalQuestion: 'Aurai-je un bureau attitré ?',
    formulations: {
      nearIdentical: 'Est-ce que j\u2019aurai un bureau attitré ?',
      naturalParaphrase: 'Vais-je avoir un poste qui m\u2019est réservé ?',
      conversational: 'Du coup j\u2019ai un bureau à moi ou pas ?',
      short: 'bureau attitré ?',
      synonym: 'Aurai-je un poste nominatif ?',
      differentVocab: 'Est-ce que j\u2019ai un desk qui m\u2019est dédié ?',
      imperfectSyntax: 'je aurai bureau attitré',
      typo: 'aurai je un buro attitre',
      keywordsOnly: 'bureau attribué',
      ambiguous: 'et pour mon bureau ?'
    }
  },
  {
    canonicalQuestion: 'C\u2019est quoi le flex office exactement ?',
    formulations: {
      nearIdentical: 'C\u2019est quoi exactement le flex office ?',
      naturalParaphrase: 'Pouvez-vous m\u2019expliquer ce qu\u2019est le flex office ?',
      conversational: 'Le flex office là, ça veut dire quoi concrètement ?',
      short: 'flex office ?',
      synonym: 'C\u2019est quoi le principe du poste non attribué ?',
      differentVocab: 'Comment fonctionne le desk sharing chez nous ?',
      imperfectSyntax: 'flex office c est quoi ca',
      typo: 'c est quoi le flexe office',
      keywordsOnly: 'définition flex office',
      ambiguous: 'expliquez-moi le nouveau système'
    }
  },
  {
    canonicalQuestion: 'Dois-je réserver un poste ?',
    formulations: {
      nearIdentical: 'Est-ce que je dois réserver un poste ?',
      naturalParaphrase: 'Faut-il réserver son poste de travail à l\u2019avance ?',
      conversational: 'Je dois booker un poste avant de venir ou pas ?',
      short: 'réserver poste ?',
      synonym: 'La réservation d\u2019un desk est-elle obligatoire ?',
      differentVocab: 'Y a-t-il une réservation à faire pour avoir une place ?',
      imperfectSyntax: 'je dois reserver poste avant venir',
      typo: 'doi je reserver un poste',
      keywordsOnly: 'réservation poste obligatoire',
      ambiguous: 'comment ça marche pour venir travailler ?'
    }
  },
  {
    canonicalQuestion: 'Faut-il réserver pour aller à la Bibliothèque ?',
    formulations: {
      nearIdentical: 'Dois-je réserver pour aller à la Bibliothèque ?',
      naturalParaphrase: 'La Bibliothèque nécessite-t-elle une réservation ?',
      conversational: 'Pour la bibliothèque, faut réserver ou j\u2019y vais direct ?',
      short: 'réservation bibliothèque ?',
      synonym: 'L\u2019accès à la Bibliothèque est-il libre ou sur réservation ?',
      differentVocab: 'Le silence room nécessite-t-il une inscription préalable ?',
      imperfectSyntax: 'bibliotheque il faut reserver',
      typo: 'faut il reservé pour la bibliotheque',
      keywordsOnly: 'bibliothèque réservation',
      ambiguous: 'et pour la salle calme ?'
    }
  },
  {
    canonicalQuestion: 'Où travailler au calme ?',
    formulations: {
      nearIdentical: 'Où puis-je travailler au calme ?',
      naturalParaphrase: 'Quels espaces permettent de travailler dans le calme ?',
      conversational: 'Y a un coin tranquille pour bosser sans bruit ?',
      short: 'espace calme ?',
      synonym: 'Où trouver un espace de concentration ?',
      differentVocab: 'Où puis-je m\u2019isoler pour du deep work ?',
      imperfectSyntax: 'ou travailler calme sans bruit',
      typo: 'ou travailler o calme',
      keywordsOnly: 'travail calme silence',
      ambiguous: 'je cherche un endroit tranquille'
    }
  },
  {
    canonicalQuestion: 'Quelle est la capacité des salles de réunion ?',
    formulations: {
      nearIdentical: 'Quelle capacité pour les salles de réunion ?',
      naturalParaphrase: 'Combien de personnes peuvent tenir dans une salle de réunion ?',
      conversational: 'Les salles de réunion font combien de places à peu près ?',
      short: 'capacité salle réunion ?',
      synonym: 'Quelle est la jauge maximale des meeting rooms ?',
      differentVocab: 'Combien de participants dans une salle de réunion classique ?',
      imperfectSyntax: 'capacite salle reunion combien',
      typo: 'capacite des sale de reunion',
      keywordsOnly: 'capacité salles réunion',
      ambiguous: 'pour combien de personnes ?'
    }
  },
  {
    canonicalQuestion: 'J\u2019aurai un casier personnel ?',
    formulations: {
      nearIdentical: 'Est-ce que j\u2019aurai un casier personnel ?',
      naturalParaphrase: 'Vais-je disposer d\u2019un casier qui m\u2019est propre ?',
      conversational: 'J\u2019ai un casier à moi ou c\u2019est partagé ?',
      short: 'casier personnel ?',
      synonym: 'Aurai-je un rangement individuel ?',
      differentVocab: 'Y a-t-il un locker qui m\u2019est attribué ?',
      imperfectSyntax: 'je aurai casier personnel a moi',
      typo: 'jaurai un caisier personel',
      keywordsOnly: 'casier personnel attribution',
      ambiguous: 'et pour ranger mes affaires ?'
    }
  },
  {
    canonicalQuestion: 'Combien de places vélos ?',
    formulations: {
      nearIdentical: 'Combien de places pour les vélos ?',
      naturalParaphrase: 'Quelle est la capacité du local vélos ?',
      conversational: 'Y a de la place pour les vélos, à peu près combien ?',
      short: 'places vélos ?',
      synonym: 'Combien de places de stationnement pour bicyclettes ?',
      differentVocab: 'Le parking à vélos accueille combien de deux-roues ?',
      imperfectSyntax: 'combien place velo disponible',
      typo: 'combien de place a velo',
      keywordsOnly: 'nombre places vélos',
      ambiguous: 'et pour mon vélo ?'
    }
  },
  {
    canonicalQuestion: 'Le projet change-t-il le télétravail ?',
    formulations: {
      nearIdentical: 'Est-ce que le projet change le télétravail ?',
      naturalParaphrase: 'Le déménagement a-t-il un impact sur le télétravail ?',
      conversational: 'Ça va changer un truc pour le télétravail tout ça ?',
      short: 'impact télétravail ?',
      synonym: 'Le projet modifie-t-il les règles de travail à distance ?',
      differentVocab: 'Le déménagement affecte-t-il notre politique remote ?',
      imperfectSyntax: 'projet change teletravail ou pas',
      typo: 'le projet change le teletravaille',
      keywordsOnly: 'télétravail changement projet',
      ambiguous: 'et le télétravail dans tout ça ?'
    }
  },
  {
    canonicalQuestion: 'Puis-je garder mon ordinateur actuel ?',
    formulations: {
      nearIdentical: 'Est-ce que je peux garder mon ordinateur actuel ?',
      naturalParaphrase: 'Vais-je conserver le même ordinateur après le déménagement ?',
      conversational: 'Je garde mon PC actuel ou on m\u2019en donne un autre ?',
      short: 'garder mon ordi ?',
      synonym: 'Puis-je conserver mon poste informatique actuel ?',
      differentVocab: 'Mon laptop actuel reste-t-il le même après la bascule ?',
      imperfectSyntax: 'je peux garder ordinateur actuel',
      typo: 'je peu garder mon ordianteur actuel',
      keywordsOnly: 'garder ordinateur actuel',
      ambiguous: 'et pour mon matériel ?'
    }
  },
  {
    canonicalQuestion: 'Y aura-t-il du wifi partout dans le bâtiment ?',
    formulations: {
      nearIdentical: 'Y a-t-il du wifi partout dans le bâtiment ?',
      naturalParaphrase: 'Le wifi est-il disponible dans tous les espaces du bâtiment ?',
      conversational: 'Y a du wifi partout ou juste dans certains coins ?',
      short: 'wifi partout ?',
      synonym: 'La couverture réseau sans fil couvre-t-elle tout le site ?',
      differentVocab: 'La connexion internet est-elle accessible dans tous les espaces ?',
      imperfectSyntax: 'wifi partout dans batiment oui ou non',
      typo: 'y a t il du wifi partou dans le batiment',
      keywordsOnly: 'wifi couverture bâtiment',
      ambiguous: 'et pour la connexion ?'
    }
  },
  {
    canonicalQuestion: 'Comment garantir la confidentialité dans un open space ?',
    formulations: {
      nearIdentical: 'Comment garantir la confidentialité en open space ?',
      naturalParaphrase: 'Comment préserver la confidentialité dans un espace ouvert ?',
      conversational: 'Comment on fait pour être discret en open space du coup ?',
      short: 'confidentialité open space ?',
      synonym: 'Comment assurer la discrétion des échanges en espace partagé ?',
      differentVocab: 'Comment gérer des conversations privées dans un plateau ouvert ?',
      imperfectSyntax: 'comment garantir confidentialite open space',
      typo: 'comment garantire la confidentialite en open space',
      keywordsOnly: 'confidentialité open space',
      ambiguous: 'et pour être tranquille ?'
    }
  },
  {
    canonicalQuestion: 'Comment accéder à Cobalt en transport en commun ?',
    formulations: {
      nearIdentical: 'Comment accède-t-on à Cobalt en transport en commun ?',
      naturalParaphrase: 'Quels transports en commun desservent Cobalt ?',
      conversational: 'On y va comment en transports, à Cobalt ?',
      short: 'accès Cobalt transport ?',
      synonym: 'Comment rejoindre Cobalt en transports publics ?',
      differentVocab: 'Quelle est la desserte RER/métro pour Cobalt ?',
      imperfectSyntax: 'comment acceder cobalt transport commun',
      typo: 'comment acceder a coblat en transport en commun',
      keywordsOnly: 'accès Cobalt métro RER',
      ambiguous: 'comment on y va ?'
    }
  },
  {
    canonicalQuestion: 'Puis-je venir en vélo ?',
    formulations: {
      nearIdentical: 'Est-ce que je peux venir en vélo ?',
      naturalParaphrase: 'Ai-je la possibilité de venir travailler à vélo ?',
      conversational: 'Je peux venir à vélo ou pas terrible comme idée ?',
      short: 'venir en vélo ?',
      synonym: 'Puis-je me rendre sur site à bicyclette ?',
      differentVocab: 'Est-il possible de rejoindre Cobalt en deux-roues non motorisé ?',
      imperfectSyntax: 'je peux venir velo au travail',
      typo: 'je peu venir en velos',
      keywordsOnly: 'venir vélo possible',
      ambiguous: 'et pour venir autrement ?'
    }
  },
  {
    canonicalQuestion: 'Y aura-t-il un restaurant ?',
    formulations: {
      nearIdentical: 'Est-ce qu\u2019il y aura un restaurant ?',
      naturalParaphrase: 'Un restaurant sera-t-il présent sur le site ?',
      conversational: 'Y a un resto sur place ou pas ?',
      short: 'restaurant sur site ?',
      synonym: 'Un espace de restauration est-il prévu ?',
      differentVocab: 'Y aura-t-il une cantine sur place ?',
      imperfectSyntax: 'restaurant sur site oui ou non',
      typo: 'y ora til un restaurent',
      keywordsOnly: 'restaurant présence site',
      ambiguous: 'et pour manger ?'
    }
  },
  {
    canonicalQuestion: 'Y aura-t-il une offre végétarienne ?',
    formulations: {
      nearIdentical: 'Est-ce qu\u2019il y aura une offre végétarienne ?',
      naturalParaphrase: 'Le restaurant proposera-t-il des plats végétariens ?',
      conversational: 'Y a des options veggie au menu ou c\u2019est que de la viande ?',
      short: 'offre végétarienne ?',
      synonym: 'Une option sans viande sera-t-elle disponible ?',
      differentVocab: 'Y aura-t-il des plats végétaliens ou juste végétariens ?',
      imperfectSyntax: 'offre vegetarienne restaurant oui',
      typo: 'y aura til une offre vegetarienne',
      keywordsOnly: 'menu végétarien restaurant',
      ambiguous: 'et pour les végétariens ?'
    }
  },
  {
    canonicalQuestion: 'Cobalt est-il accessible aux personnes à mobilité réduite ?',
    formulations: {
      nearIdentical: 'Est-ce que Cobalt est accessible aux personnes à mobilité réduite ?',
      naturalParaphrase: 'Le site est-il adapté aux personnes en situation de handicap moteur ?',
      conversational: 'C\u2019est accessible PMR, Cobalt ?',
      short: 'accessibilité PMR ?',
      synonym: 'Cobalt est-il équipé pour les personnes à mobilité réduite ?',
      differentVocab: 'Le bâtiment dispose-t-il d\u2019aménagements pour fauteuils roulants ?',
      imperfectSyntax: 'cobalt accessible personne mobilite reduite',
      typo: 'cobalt es til accessible au pmr',
      keywordsOnly: 'accessibilité PMR Cobalt',
      ambiguous: 'et pour l\u2019accessibilité ?'
    }
  },
  {
    canonicalQuestion: 'Y a-t-il une salle d\u2019allaitement ?',
    formulations: {
      nearIdentical: 'Est-ce qu\u2019il y a une salle d\u2019allaitement ?',
      naturalParaphrase: 'Un espace dédié à l\u2019allaitement est-il prévu ?',
      conversational: 'Y a une pièce pour allaiter si besoin ?',
      short: 'salle allaitement ?',
      synonym: 'Existe-t-il un espace pour l\u2019allaitement ?',
      differentVocab: 'Un espace parent-bébé est-il disponible sur site ?',
      imperfectSyntax: 'salle allaitement disponible cobalt',
      typo: 'y a til une sale d allaitement',
      keywordsOnly: 'salle allaitement disponibilité',
      ambiguous: 'et pour les jeunes parents ?'
    }
  },
  {
    canonicalQuestion: 'Il y a combien d\u2019étages ?',
    formulations: {
      nearIdentical: 'Combien d\u2019étages y a-t-il ?',
      naturalParaphrase: 'Le bâtiment compte combien de niveaux ?',
      conversational: 'C\u2019est un immeuble de combien d\u2019étages ?',
      short: 'combien étages ?',
      synonym: 'Quel est le nombre de niveaux du bâtiment ?',
      differentVocab: 'Sur combien de niveaux s\u2019étend le site ?',
      imperfectSyntax: 'combien etage a le batiment',
      typo: 'il y a combien detage',
      keywordsOnly: 'nombre étages bâtiment',
      ambiguous: 'c\u2019est grand comment ?'
    }
  },
  {
    canonicalQuestion: 'Combien de personnes vont travailler à Cobalt ?',
    formulations: {
      nearIdentical: 'Combien de personnes travailleront à Cobalt ?',
      naturalParaphrase: 'Quel est l\u2019effectif prévu sur le site de Cobalt ?',
      conversational: 'On sera combien à travailler là-bas au final ?',
      short: 'effectif Cobalt ?',
      synonym: 'Combien de collaborateurs seront concernés par Cobalt ?',
      differentVocab: 'Quelle est la population attendue sur le nouveau site ?',
      imperfectSyntax: 'combien personne vont travailler cobalt',
      typo: 'combien de personne travaillerons a coblat',
      keywordsOnly: 'effectif nombre collaborateurs Cobalt',
      ambiguous: 'on sera combien ?'
    }
  },
  {
    canonicalQuestion: 'Qui sont les ambassadeurs, ils servent à quoi ?',
    formulations: {
      nearIdentical: 'Qui sont les ambassadeurs et à quoi servent-ils ?',
      naturalParaphrase: 'Quel est le rôle des ambassadeurs du projet ?',
      conversational: 'C\u2019est qui les ambassadeurs et ils font quoi exactement ?',
      short: 'rôle ambassadeurs ?',
      synonym: 'À quoi servent les relais de proximité du projet ?',
      differentVocab: 'Quelle est la mission des référents projet dans chaque service ?',
      imperfectSyntax: 'qui sont ambassadeurs ils servent a quoi',
      typo: 'qui son les ambassadeur il servent a quoi',
      keywordsOnly: 'rôle ambassadeurs projet',
      ambiguous: 'c\u2019est quoi leur rôle ?'
    }
  },
  {
    canonicalQuestion: 'Est-ce que les ateliers équipes sont obligatoires ?',
    formulations: {
      nearIdentical: 'Les ateliers équipes sont-ils obligatoires ?',
      naturalParaphrase: 'La participation aux ateliers d\u2019équipe est-elle obligatoire ?',
      conversational: 'Je suis obligé d\u2019aller aux ateliers équipe ou c\u2019est facultatif ?',
      short: 'ateliers obligatoires ?',
      synonym: 'La présence aux ateliers est-elle requise ?',
      differentVocab: 'Doit-on impérativement assister aux workshops d\u2019équipe ?',
      imperfectSyntax: 'ateliers equipe obligatoire ou pas',
      typo: 'les atelié équipe son til obligatoire',
      keywordsOnly: 'ateliers équipe obligatoire',
      ambiguous: 'je suis obligé d\u2019y aller ?'
    }
  },
  {
    canonicalQuestion: 'Le guide des nouveaux usages, c\u2019est quoi concrètement ?',
    formulations: {
      nearIdentical: 'C\u2019est quoi concrètement le guide des nouveaux usages ?',
      naturalParaphrase: 'Pouvez-vous décrire ce que contient le guide des nouveaux usages ?',
      conversational: 'Le fameux guide des nouveaux usages, ça parle de quoi concrètement ?',
      short: 'guide nouveaux usages ?',
      synonym: 'Quel est le contenu du document sur les nouveaux usages ?',
      differentVocab: 'Que couvre le manuel pratique sur le fonctionnement à Cobalt ?',
      imperfectSyntax: 'guide nouveau usage c est quoi',
      typo: 'le guide des noveau usage c est quoi',
      keywordsOnly: 'contenu guide nouveaux usages',
      ambiguous: 'c\u2019est quoi ce document ?'
    }
  },
  {
    canonicalQuestion: 'Le café central sert-il aussi à manger ?',
    formulations: {
      nearIdentical: 'Est-ce que le café central sert aussi à manger ?',
      naturalParaphrase: 'Peut-on manger quelque chose au café central ?',
      conversational: 'Au café central on peut manger un truc ou juste boire un café ?',
      short: 'café central manger ?',
      synonym: 'Le café central propose-t-il de la petite restauration ?',
      differentVocab: 'Peut-on se restaurer légèrement au café central ?',
      imperfectSyntax: 'cafe central sert a manger aussi',
      typo: 'le cafe central sert til a mangé',
      keywordsOnly: 'café central restauration',
      ambiguous: 'et le café, on peut y manger ?'
    }
  },
  {
    canonicalQuestion: 'Peut-on manger à son poste ?',
    formulations: {
      nearIdentical: 'Est-ce qu\u2019on peut manger à son poste ?',
      naturalParaphrase: 'Est-il autorisé de déjeuner directement à son poste de travail ?',
      conversational: 'Je peux manger à mon bureau ou c\u2019est interdit ?',
      short: 'manger au poste ?',
      synonym: 'Peut-on déjeuner sur son espace de travail ?',
      differentVocab: 'Est-il permis de prendre son repas à son desk ?',
      imperfectSyntax: 'peut on manger a son poste travail',
      typo: 'peu ton manger a son poste',
      keywordsOnly: 'manger poste autorisé',
      ambiguous: 'je peux manger là où je suis ?'
    }
  },
  {
    canonicalQuestion: 'Combien de personnes dans une Project Room ?',
    formulations: {
      nearIdentical: 'Combien de personnes tiennent dans une Project Room ?',
      naturalParaphrase: 'Quelle est la capacité d\u2019une Project Room ?',
      conversational: 'Une Project Room, ça fait combien de places à peu près ?',
      short: 'capacité Project Room ?',
      synonym: 'Quelle est la jauge d\u2019une salle projet ?',
      differentVocab: 'Combien de collaborateurs peuvent travailler ensemble dans une Project Room ?',
      imperfectSyntax: 'combien personne project room capacite',
      typo: 'combien de personne dans une projecte room',
      keywordsOnly: 'capacité Project Room',
      ambiguous: 'et la salle projet, elle fait combien ?'
    }
  },
  {
    canonicalQuestion: 'Comment se passera le branchement de mon poste le premier jour ?',
    formulations: {
      nearIdentical: 'Comment va se passer le branchement de mon poste le premier jour ?',
      naturalParaphrase: 'Qui m\u2019aidera à installer mon poste de travail le jour de l\u2019arrivée ?',
      conversational: 'Le premier jour, qui branche mon ordi et tout ça ?',
      short: 'branchement poste premier jour ?',
      synonym: 'Comment se déroulera l\u2019installation de mon poste informatique à l\u2019arrivée ?',
      differentVocab: 'Y aura-t-il un support pour la mise en route de mon setup le jour J ?',
      imperfectSyntax: 'comment se passe branchement poste premier jour',
      typo: 'comment se passera le branchemant de mon poste',
      keywordsOnly: 'branchement poste premier jour aide',
      ambiguous: 'et le premier jour, comment ça marche ?'
    }
  },
  {
    canonicalQuestion: 'Comment accueillir un visiteur ?',
    formulations: {
      nearIdentical: 'Comment accueille-t-on un visiteur ?',
      naturalParaphrase: 'Quelle est la procédure pour accueillir un visiteur externe ?',
      conversational: 'Si j\u2019ai un visiteur qui vient, je fais comment ?',
      short: 'accueil visiteur ?',
      synonym: 'Comment gère-t-on l\u2019arrivée d\u2019un invité externe ?',
      differentVocab: 'Quelle procédure suivre pour un badge visiteur ?',
      imperfectSyntax: 'comment accueillir visiteur externe',
      typo: 'comment acueillir un visiteure',
      keywordsOnly: 'procédure accueil visiteur',
      ambiguous: 'j\u2019ai quelqu\u2019un qui vient me voir'
    }
  }
];

// Requêtes hors-corpus -- ne doivent JAMAIS matcher quoi que ce soit,
// sans rapport aucun avec le contenu réel d'Équinoxe/Cobalt.
export const OUT_OF_CORPUS_QUERIES = [
  'Quelle est la météo à Paris demain ?',
  'Comment fonctionne le moteur de recherche Google ?',
  'Quel est le prix du pétrole aujourd\u2019hui ?',
  'Peux-tu m\u2019aider à réviser mon examen de mathématiques ?',
  'Quelle est la capitale de l\u2019Australie ?',
  'Comment cuisiner un risotto aux champignons ?',
  'Quels sont les horaires du cinéma ce soir ?',
  'Peux-tu résumer la Révolution française ?',
  'Comment installer Python sur mon ordinateur personnel ?',
  'Quel est le score du match de football hier soir ?',
  'Comment déclarer mes impôts cette année ?',
  'Quelle est la meilleure recette de tarte aux pommes ?',
  'Peux-tu me recommander un livre de science-fiction ?',
  'Comment fonctionne la bourse en général ?',
  'Quels vaccins sont recommandés pour voyager en Asie ?',
  'Comment se muscler efficacement en salle de sport ?',
  'Quelle est la différence entre le Wi-Fi 5 et le Wi-Fi 6 en général ?',
  'Peux-tu m\u2019expliquer la théorie de la relativité ?',
  'Quel est le meilleur restaurant étoilé de Paris ?',
  'Comment adopter un chat en refuge ?'
];
