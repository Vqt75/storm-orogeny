// Static, reviewable evaluation formulations. The flattening below is
// deterministic; no formulation is generated or sampled at runtime.

export const FORMULATION_CATEGORIES = [
  'quasi_identique',
  'paraphrase_naturelle',
  'conversationnel',
  'formulation_courte',
  'synonymes',
  'vocabulaire_different',
  'syntaxe_imparfaite',
  'faute_de_frappe',
  'mots_cles_seuls',
  'ambiguite_adjacent'
];

const SELECTED = [
  {
    entryId: 'equinoxe-q001',
    formulations: [
      'Quand déménageons-nous ?',
      'À quelle date est prévu notre déménagement ?',
      'Dis, on part quand à Cobalt ?',
      'Date du déménagement ?',
      'Quand a lieu le transfert vers Cobalt ?',
      'Quel jour doit-on rejoindre nos nouveaux locaux ?',
      'nous déménage quand exactement',
      'Quand déménageons nou ?',
      'déménagement date',
      'Quand commence-t-on à préparer puis à déménager ?'
    ]
  },
  {
    entryId: 'equinoxe-q003',
    formulations: [
      'Le calendrier peut-il encore changer ?',
      'Les dates du projet peuvent-elles encore bouger ?',
      'On est sûrs du planning ou ça peut encore changer ?',
      'Calendrier définitif ?',
      'Le planning reste-t-il modifiable ?',
      'Les échéances sont-elles désormais gravées dans le marbre ?',
      'calendrier peut encore changer ou pas',
      'Le calandrier peut-il changer ?',
      'calendrier changement',
      'Les dates des visites peuvent-elles encore changer ?'
    ]
  },
  {
    entryId: 'equinoxe-q005',
    formulations: [
      'Puis-je visiter Cobalt avant le déménagement ?',
      'Des visites du site sont-elles prévues avant notre arrivée ?',
      'On pourra aller voir Cobalt avant de s’installer ?',
      'Visite avant déménagement ?',
      'Peut-on découvrir les nouveaux locaux avant le transfert ?',
      'Y aura-t-il une découverte des lieux en amont de l’installation ?',
      'possible visiter Cobalt avant qu on déménage',
      'Peut-on vistier Cobalt avant ?',
      'visite Cobalt déménagement',
      'La visite aura-t-elle lieu pendant la semaine de préparation ?'
    ]
  },
  {
    entryId: 'equinoxe-q010',
    formulations: [
      'Aurai-je un bureau attitré ?',
      'Est-ce qu’un poste de travail me sera personnellement attribué ?',
      'J’aurai ma place à moi au bureau ?',
      'Bureau personnel ?',
      'Disposerai-je d’un desk nominatif ?',
      'Est-ce que chacun conserve un emplacement rien qu’à lui ?',
      'moi avoir bureau fixe ou non',
      'Aurai-je un burreau attitré ?',
      'bureau attitré',
      'Aurai-je mon bureau ou seulement un casier personnel ?'
    ]
  },
  {
    entryId: 'equinoxe-q011',
    formulations: [
      'C’est quoi le flex office exactement ?',
      'Pouvez-vous expliquer précisément le fonctionnement du flex office ?',
      'En vrai, ça marche comment le flex office ?',
      'Définition flex office ?',
      'Que signifie le bureau flexible ?',
      'Comment fonctionne un environnement sans place assignée ?',
      'flex office ça veut dire quoi',
      'C’est quoi le flex ofice ?',
      'flex office définition',
      'Le flex office signifie-t-il qu’il y aura moins de postes ?'
    ]
  },
  {
    entryId: 'equinoxe-q013',
    formulations: [
      'Qu’est-ce qu’un quartier d’équipe ?',
      'À quoi correspond exactement un quartier d’équipe ?',
      'Un quartier d’équipe, c’est quoi au juste ?',
      'Définition quartier d’équipe ?',
      'Que désigne la zone de référence d’une équipe ?',
      'Comment appelle-t-on l’espace regroupant une même équipe ?',
      'quartier équipe ça correspond à quoi',
      'Qu’est-ce qu’un quertier d’équipe ?',
      'quartier équipe définition',
      'Le quartier d’équipe est-il toujours la même zone ?'
    ]
  },
  {
    entryId: 'equinoxe-q016',
    formulations: [
      'Le flex office veut-il dire moins de postes que de personnes ?',
      'Y aura-t-il moins de bureaux disponibles que de collaborateurs ?',
      'Est-ce qu’on risque de manquer de places avec le flex office ?',
      'Assez de postes ?',
      'Le desk sharing implique-t-il une pénurie de bureaux ?',
      'La capacité d’assises sera-t-elle inférieure à l’effectif ?',
      'moins postes que personnes avec flex office',
      'Le flex office veut dire moin de postes ?',
      'flex office postes personnes',
      'Pourquoi ne pas garder assez de bureaux attitrés pour tout le monde ?'
    ]
  },
  {
    entryId: 'equinoxe-q019',
    formulations: [
      'Comment je réserve une salle de réunion ?',
      'Quelle est la procédure pour réserver une salle de réunion ?',
      'Je fais comment pour bloquer une salle ?',
      'Réserver une salle ?',
      'Comment effectuer le booking d’un espace de réunion ?',
      'Quel outil permet de bloquer un créneau pour une réunion ?',
      'comment réserver salle réunion',
      'Comment je réserve une sale de réunion ?',
      'réservation salle réunion',
      'Comment réserver une salle pour un entretien confidentiel ?'
    ]
  },
  {
    entryId: 'equinoxe-q020',
    formulations: [
      'Faut-il réserver pour aller à la Bibliothèque ?',
      'La Bibliothèque nécessite-t-elle une réservation préalable ?',
      'Je dois booker avant de m’installer à la Bibliothèque ?',
      'Bibliothèque sur réservation ?',
      'L’accès à la Bibliothèque silencieuse doit-il être planifié ?',
      'Le grand espace collectif silencieux est-il accessible sans inscription ?',
      'bibliothèque faut réserver ou accès libre',
      'Faut-il résèrver la Bibliothèque ?',
      'bibliothèque réservation',
      'Dois-je réserver un poste pour travailler à la Bibliothèque ?'
    ]
  },
  {
    entryId: 'equinoxe-q022',
    formulations: [
      'Peut-on réserver une Project Room à l’avance ?',
      'Est-il possible de planifier une Project Room en amont ?',
      'Je peux booker une Project Room pour demain ?',
      'Réservation Project Room ?',
      'Peut-on bloquer une salle projet à l’avance ?',
      'Puis-je garantir à l’avance une salle dédiée au travail de projet ?',
      'project room réserver avant possible',
      'Peut-on résrever une Project Room ?',
      'Project Room réservation avance',
      'Une Project Room se réserve-t-elle comme une salle de réunion ?'
    ]
  },
  {
    entryId: 'equinoxe-q025',
    formulations: [
      'Où travailler au calme ?',
      'Quels espaces permettent de travailler sans bruit ?',
      'Je vais où si j’ai besoin d’être tranquille ?',
      'Espace calme ?',
      'Où puis-je me concentrer en silence ?',
      'Quel lieu convient à une tâche exigeant toute mon attention ?',
      'où travailler calme sans bruit',
      'Ou travaller au calme ?',
      'calme concentration',
      'Pour être au calme, faut-il choisir Focus ou Bibliothèque ?'
    ]
  },
  {
    entryId: 'equinoxe-q027',
    formulations: [
      'Où passer un appel rapide sans déranger personne ?',
      'Quel espace utiliser pour téléphoner quelques minutes ?',
      'Je vais où pour un petit coup de fil ?',
      'Appel rapide où ?',
      'Où faire une courte visio sans gêner les collègues ?',
      'Quel endroit isole une conversation brève du reste du plateau ?',
      'passer appel court sans déranger où',
      'Où passer un apel rapide ?',
      'appel rapide bulle',
      'Pour un appel confidentiel, bulle ou salle de réunion ?'
    ]
  },
  {
    entryId: 'equinoxe-q028',
    formulations: [
      'Quelle est la capacité des salles de réunion ?',
      'Combien de personnes peuvent accueillir les salles de réunion ?',
      'On rentre à combien dans les salles ?',
      'Capacité salles ?',
      'Quelle jauge est prévue pour les espaces de réunion ?',
      'Quel effectif maximal peut se réunir dans une même pièce ?',
      'salles réunion combien personnes',
      'Quelle capacité des sales de réunion ?',
      'capacité salles réunion',
      'La capacité des salles est-elle comparable à celle des Project Rooms ?'
    ]
  },
  {
    entryId: 'equinoxe-q029',
    formulations: [
      'Le Forum, c’est pour quoi ?',
      'À quels usages le Forum est-il destiné ?',
      'On y fait quoi dans le Forum ?',
      'Usage du Forum ?',
      'À quoi sert l’espace événementiel ?',
      'Quel lieu accueillera les grandes prises de parole ?',
      'forum sert à quoi exactement',
      'Le Forrum c’est pour quoi ?',
      'Forum événements',
      'Le Forum peut-il aussi servir aux réunions d’équipe classiques ?'
    ]
  },
  {
    entryId: 'equinoxe-q030',
    formulations: [
      'Y aura-t-il un espace pour se détendre ?',
      'Un lieu de repos est-il prévu dans le bâtiment ?',
      'Il y aura un coin pour souffler un peu ?',
      'Espace détente ?',
      'Existe-t-il une zone de récupération et de bien-être ?',
      'Où pourrai-je faire une pause au calme pour reprendre des forces ?',
      'prévu endroit pour se détendre',
      'Y aura-t-il un espace pour se détandre ?',
      'détente repos espace',
      'L’espace détente comprend-il aussi la salle d’allaitement ?'
    ]
  },
  {
    entryId: 'equinoxe-q034',
    formulations: [
      'Combien de places vélos ?',
      'Quelle est la capacité du stationnement pour vélos ?',
      'On pourra garer combien de vélos ?',
      'Places vélo ?',
      'Combien d’emplacements pour bicyclettes ?',
      'Quelle quantité de deux-roues non motorisés le local peut-il accueillir ?',
      'local vélo combien places',
      'Combien de places vélso ?',
      'stationnement vélo capacité',
      'Le nombre de places vélos inclut-il les emplacements avec recharge ?'
    ]
  },
  {
    entryId: 'equinoxe-q035',
    formulations: [
      'J’aurai un casier personnel ?',
      'Chaque collaborateur disposera-t-il de son propre casier ?',
      'Est-ce que j’aurai un casier rien qu’à moi ?',
      'Casier individuel ?',
      'Un locker nominatif sera-t-il disponible ?',
      'Où conserver mes effets dans un rangement réservé ?',
      'moi avoir casier personnel',
      'J’aurai un cassier personnel ?',
      'casier personnel',
      'Mon casier personnel sera-t-il assez grand pour mes dossiers ?'
    ]
  },
  {
    entryId: 'equinoxe-q038',
    formulations: [
      'Y a-t-il des prises de recharge pour vélos électriques ?',
      'Pourra-t-on recharger un vélo électrique dans le local ?',
      'Je peux brancher mon vélo électrique sur place ?',
      'Recharge vélo électrique ?',
      'Des bornes pour bicyclettes à assistance électrique sont-elles prévues ?',
      'Le stationnement permettra-t-il d’alimenter la batterie de mon deux-roues ?',
      'prises recharge vélo électrique prévues',
      'Prises de rechrage pour vélos ?',
      'vélo électrique recharge',
      'Les prises vélo sont-elles les mêmes que les bornes pour voitures électriques ?'
    ]
  },
  {
    entryId: 'equinoxe-q040',
    formulations: [
      'Le projet change-t-il le télétravail ?',
      'Les règles de télétravail seront-elles modifiées par Cobalt ?',
      'Est-ce que le remote va changer avec le projet ?',
      'Télétravail modifié ?',
      'Le travail à distance évolue-t-il ?',
      'Notre organisation entre domicile et site sera-t-elle revue ?',
      'projet changer télétravail ou non',
      'Le projet change le télétrvail ?',
      'projet télétravail changement',
      'Le télétravail change-t-il avec une présence minimale à Cobalt ?'
    ]
  },
  {
    entryId: 'equinoxe-q043',
    formulations: [
      'Cobalt va-t-il imposer une présence minimale ?',
      'Un nombre minimum de jours sur site sera-t-il exigé ?',
      'On devra venir au moins combien de jours à Cobalt ?',
      'Présence minimale ?',
      'Y aura-t-il un quota de présentiel obligatoire ?',
      'Le projet fixe-t-il un plancher de fréquentation des locaux ?',
      'Cobalt imposer présence minimum ou pas',
      'Cobalt impose une présance minimale ?',
      'Cobalt présence minimale',
      'La présence minimale dépendra-t-elle des jours de télétravail ?'
    ]
  },
  {
    entryId: 'equinoxe-q045',
    formulations: [
      'Quel matériel IT sera fourni sur les nouveaux postes ?',
      'Quels équipements informatiques trouverons-nous sur chaque poste ?',
      'Il y aura quoi comme matos informatique sur les bureaux ?',
      'Équipement IT des postes ?',
      'Quel hardware sera installé sur les desks ?',
      'Quels appareils permettront de travailler depuis les nouveaux emplacements ?',
      'nouveaux postes matériel informatique fourni',
      'Quel materiel IT sera fourmi ?',
      'matériel IT postes',
      'Le matériel fourni comprend-il les écrans partagés entre postes ?'
    ]
  },
  {
    entryId: 'equinoxe-q047',
    formulations: [
      'Y aura-t-il du wifi partout dans le bâtiment ?',
      'La couverture wifi concernera-t-elle tous les espaces ?',
      'On captera le wifi partout à Cobalt ?',
      'Wifi partout ?',
      'Le réseau sans fil couvrira-t-il l’ensemble du site ?',
      'Pourrai-je me connecter à Internet depuis n’importe quelle zone ?',
      'wifi disponible partout bâtiment',
      'Y aura-t-il du wfi partout ?',
      'wifi bâtiment couverture',
      'Le wifi sera-t-il disponible jusque dans les salles confidentielles ?'
    ]
  },
  {
    entryId: 'equinoxe-q050',
    formulations: [
      'Comment garantir la confidentialité dans un open space ?',
      'Comment préserver des échanges confidentiels en espace ouvert ?',
      'Je fais comment pour parler discrètement sur le plateau ?',
      'Confidentialité au bureau ?',
      'Comment assurer la discrétion dans un bureau partagé ?',
      'Quel dispositif évite que les conversations sensibles soient entendues ?',
      'open space garder conversation confidentielle',
      'Comment garantir la confidentalité en open space ?',
      'confidentialité open space',
      'Pour un entretien RH confidentiel, faut-il une bulle ou une salle ?'
    ]
  },
  {
    entryId: 'equinoxe-q054',
    formulations: [
      'Comment accéder à Cobalt en transport en commun ?',
      'Quels transports collectifs permettent de rejoindre Cobalt ?',
      'Je viens comment à Cobalt sans voiture ?',
      'Transports vers Cobalt ?',
      'Quel itinéraire en métro ou RER dessert le site ?',
      'Quelles lignes publiques conduisent jusqu’aux nouveaux locaux ?',
      'accès Cobalt transport commun',
      'Comment accèder à Cobalt en transports ?',
      'Cobalt métro RER',
      'Pour accéder à Cobalt, le RER est-il plus simple que le bus ?'
    ]
  },
  {
    entryId: 'equinoxe-q060',
    formulations: [
      'Y aura-t-il un restaurant ?',
      'Un restaurant est-il prévu sur le site ?',
      'On aura un endroit pour déjeuner à Cobalt ?',
      'Restaurant prévu ?',
      'Y aura-t-il une cantine ?',
      'Pourra-t-on prendre un repas chaud sans quitter le bâtiment ?',
      'il y aura restaurant sur place',
      'Y aura-t-il un restarant ?',
      'restaurant Cobalt',
      'Le restaurant sera-t-il ouvert dès notre premier jour ?'
    ]
  },
  {
    entryId: 'equinoxe-q062',
    formulations: [
      'Y aura-t-il une offre végétarienne ?',
      'Le restaurant proposera-t-il des plats végétariens ?',
      'Je pourrai manger végé le midi ?',
      'Option végétarienne ?',
      'Une alternative sans viande sera-t-elle proposée ?',
      'Les personnes ne consommant pas de produits carnés auront-elles un choix ?',
      'restaurant prévoir repas végétarien',
      'Y aura-t-il une offre végétariene ?',
      'végétarien restaurant',
      'L’offre végétarienne changera-t-elle chaque jour avec le menu ?'
    ]
  },
  {
    entryId: 'equinoxe-q066',
    formulations: [
      'Comment demander un poste adapté ?',
      'Quelle démarche suivre pour obtenir un poste de travail adapté ?',
      'Je contacte qui pour adapter mon bureau ?',
      'Demande poste adapté ?',
      'Comment solliciter un aménagement ergonomique ?',
      'Par quel circuit faire prendre en compte une contrainte de santé au travail ?',
      'besoin poste adapté comment demander',
      'Comment demander un poste adpaté ?',
      'poste adapté demande',
      'Pour un poste adapté, faut-il contacter l’ergonomie ou l’accessibilité ?'
    ]
  },
  {
    entryId: 'equinoxe-q067',
    formulations: [
      'Cobalt est-il accessible aux personnes à mobilité réduite ?',
      'Le bâtiment est-il adapté aux collaborateurs à mobilité réduite ?',
      'Une personne en fauteuil pourra circuler à Cobalt ?',
      'Accès PMR ?',
      'Le site est-il accessible aux personnes handicapées ?',
      'Les déplacements dans les locaux sont-ils possibles pour tous ?',
      'Cobalt accessible mobilité réduite',
      'Cobalt est-il accesible aux personnes en fauteuil ?',
      'PMR accessibilité Cobalt',
      'L’accès PMR est-il prévu depuis les transports en commun ?'
    ]
  },
  {
    entryId: 'equinoxe-q070',
    formulations: [
      'L’acoustique a-t-elle été pensée pour les personnes sensibles au bruit ?',
      'Le traitement acoustique prend-il en compte la sensibilité au bruit ?',
      'Si je supporte mal le bruit, les espaces seront adaptés ?',
      'Acoustique et bruit ?',
      'L’isolation phonique convient-elle aux personnes sensibles ?',
      'Le confort sonore a-t-il été conçu pour limiter la fatigue auditive ?',
      'acoustique prévue personnes sensibles bruit',
      'Acoustique pensée pour personnes senssibles au bruit ?',
      'acoustique bruit sensibilité',
      'Les personnes sensibles au bruit devront-elles travailler en Focus ?'
    ]
  },
  {
    entryId: 'equinoxe-q077',
    formulations: [
      'Qui sont les ambassadeurs et à quoi servent-ils ?',
      'Quel est le rôle des ambassadeurs du projet ?',
      'Les ambassadeurs, ils peuvent m’aider pour quoi ?',
      'Rôle des ambassadeurs ?',
      'À quoi servent les relais du projet ?',
      'Quelles personnes font circuler les informations dans chaque service ?',
      'ambassadeurs servent à quoi projet',
      'Qui sont les ambassaseurs ?',
      'ambassadeurs rôle relais',
      'Les ambassadeurs de mon service peuvent-ils répondre à mes questions ?'
    ]
  }
];

// Quality Gate classifications for the tenth formulation of each selected
// question. A true ambiguity has no single canonical Q&A capable of answering
// the whole formulation and must therefore abstain. An adjacent but resolvable
// formulation points to the most precise existing canonical Q&A, which may be
// different from the question used to build the nine other variants.
export const ambiguityReview = [
  { sourceEntryId: 'equinoxe-q001', classification: 'trueAmbiguous', expectedEntryId: null, rationale: 'Demande à la fois le début de la préparation et la date du déménagement.' },
  { sourceEntryId: 'equinoxe-q003', classification: 'adjacentButResolvable', expectedEntryId: 'equinoxe-q003', rationale: 'La Q&A calendrier traite explicitement des dates intermédiaires, dont les visites.' },
  { sourceEntryId: 'equinoxe-q005', classification: 'adjacentButResolvable', expectedEntryId: 'equinoxe-q005', rationale: 'La Q&A visite donne sa période et permet de la situer avant la préparation.' },
  { sourceEntryId: 'equinoxe-q010', classification: 'trueAmbiguous', expectedEntryId: null, rationale: 'Cumule l’attribution d’un bureau et l’existence d’un casier personnel.' },
  { sourceEntryId: 'equinoxe-q011', classification: 'adjacentButResolvable', expectedEntryId: 'equinoxe-q016', rationale: 'La Q&A sur le ratio postes/personnes est plus précise que la définition générale du flex office.' },
  { sourceEntryId: 'equinoxe-q013', classification: 'adjacentButResolvable', expectedEntryId: 'equinoxe-q014', rationale: 'La stabilité de la zone est répondue directement par la Q&A sur la zone de l’équipe.' },
  { sourceEntryId: 'equinoxe-q016', classification: 'adjacentButResolvable', expectedEntryId: 'equinoxe-q017', rationale: 'La formulation demande pourquoi les bureaux attitrés ne sont pas conservés.' },
  { sourceEntryId: 'equinoxe-q019', classification: 'adjacentButResolvable', expectedEntryId: 'equinoxe-q019', rationale: 'Le besoin principal est la procédure de réservation d’une salle.' },
  { sourceEntryId: 'equinoxe-q020', classification: 'adjacentButResolvable', expectedEntryId: 'equinoxe-q020', rationale: 'La Q&A répond directement que la Bibliothèque est en accès libre.' },
  { sourceEntryId: 'equinoxe-q022', classification: 'adjacentButResolvable', expectedEntryId: 'equinoxe-q022', rationale: 'La Q&A Project Room répond directement à la possibilité de réserver à l’avance.' },
  { sourceEntryId: 'equinoxe-q025', classification: 'adjacentButResolvable', expectedEntryId: 'equinoxe-q026', rationale: 'La comparaison Focus/Bibliothèque est traitée par la Q&A dédiée à leur différence.' },
  { sourceEntryId: 'equinoxe-q027', classification: 'adjacentButResolvable', expectedEntryId: 'equinoxe-q050', rationale: 'La confidentialité, et non la rapidité de l’appel, détermine la Q&A la plus précise.' },
  { sourceEntryId: 'equinoxe-q028', classification: 'trueAmbiguous', expectedEntryId: null, rationale: 'Comparer les capacités exige deux Q&A distinctes : salles de réunion et Project Rooms.' },
  { sourceEntryId: 'equinoxe-q029', classification: 'adjacentButResolvable', expectedEntryId: 'equinoxe-q105', rationale: 'Une Q&A canonique demande exactement si le Forum sert aux réunions classiques.' },
  { sourceEntryId: 'equinoxe-q030', classification: 'adjacentButResolvable', expectedEntryId: 'equinoxe-q068', rationale: 'La présence d’une salle d’allaitement possède une Q&A canonique dédiée.' },
  { sourceEntryId: 'equinoxe-q034', classification: 'trueAmbiguous', expectedEntryId: null, rationale: 'Le lien entre capacité totale et emplacements équipés pour la recharge n’est pas publié.' },
  { sourceEntryId: 'equinoxe-q035', classification: 'adjacentButResolvable', expectedEntryId: 'equinoxe-q094', rationale: 'La capacité du casier pour des dossiers possède une Q&A canonique dédiée.' },
  { sourceEntryId: 'equinoxe-q038', classification: 'trueAmbiguous', expectedEntryId: null, rationale: 'Comparer recharge vélo et recharge voiture exige deux Q&A sans réponse commune publiée.' },
  { sourceEntryId: 'equinoxe-q040', classification: 'trueAmbiguous', expectedEntryId: null, rationale: 'Cumule deux politiques distinctes : télétravail et présence minimale.' },
  { sourceEntryId: 'equinoxe-q043', classification: 'adjacentButResolvable', expectedEntryId: 'equinoxe-q043', rationale: 'La Q&A établit directement qu’aucune présence minimale n’est imposée.' },
  { sourceEntryId: 'equinoxe-q045', classification: 'adjacentButResolvable', expectedEntryId: 'equinoxe-q049', rationale: 'Le partage des écrans possède une Q&A canonique plus précise que le matériel général.' },
  { sourceEntryId: 'equinoxe-q047', classification: 'adjacentButResolvable', expectedEntryId: 'equinoxe-q047', rationale: 'Une couverture wifi de l’ensemble des espaces inclut les salles.' },
  { sourceEntryId: 'equinoxe-q050', classification: 'adjacentButResolvable', expectedEntryId: 'equinoxe-q051', rationale: 'L’entretien RH confidentiel possède une Q&A canonique dédiée.' },
  { sourceEntryId: 'equinoxe-q054', classification: 'trueAmbiguous', expectedEntryId: null, rationale: 'Le corpus décrit RER et bus séparément mais ne compare ni simplicité ni itinéraire.' },
  { sourceEntryId: 'equinoxe-q060', classification: 'adjacentButResolvable', expectedEntryId: 'equinoxe-q065', rationale: 'L’ouverture du restaurant dès le premier jour possède une Q&A dédiée.' },
  { sourceEntryId: 'equinoxe-q062', classification: 'trueAmbiguous', expectedEntryId: null, rationale: 'Le corpus confirme une offre végétarienne et évoque le menu, sans dire si cette offre change chaque jour.' },
  { sourceEntryId: 'equinoxe-q066', classification: 'adjacentButResolvable', expectedEntryId: 'equinoxe-q066', rationale: 'La Q&A indique directement le circuit RH/santé pour demander un poste adapté.' },
  { sourceEntryId: 'equinoxe-q067', classification: 'trueAmbiguous', expectedEntryId: null, rationale: 'L’accessibilité du trajet entre transports et bâtiment n’est pas couverte par une Q&A unique.' },
  { sourceEntryId: 'equinoxe-q070', classification: 'trueAmbiguous', expectedEntryId: null, rationale: 'Aucune Q&A ne dit que les personnes sensibles au bruit doivent travailler en Focus.' },
  { sourceEntryId: 'equinoxe-q077', classification: 'adjacentButResolvable', expectedEntryId: 'equinoxe-q077', rationale: 'La Q&A sur le rôle des ambassadeurs mentionne les relais de service et les réponses aux questions.' }
];

const ambiguityBySourceEntryId = new Map(
  ambiguityReview.map(item => [item.sourceEntryId, item])
);

const OUT_OF_CORPUS = [
  'Quel temps fera-t-il demain à Paris ?',
  'Quel est le score du match de football ?',
  'Comment déclarer une note de frais ?',
  'Quand serai-je remboursé de mon déplacement professionnel ?',
  'Quelle mutuelle d’entreprise choisir ?',
  'Comment poser mes congés payés ?',
  'Quand arrive mon bulletin de salaire ?',
  'J’ai oublié le mot de passe de l’intranet.',
  'Quelle est la politique de bonus annuel ?',
  'Puis-je suivre une formation en anglais ?',
  'Qui est le directeur financier ?',
  'Où réserver un billet de train ?',
  'Comment signaler un arrêt maladie ?',
  'Quelle est la procédure pour commander du matériel à domicile ?',
  'Peut-on inviter un fournisseur à déjeuner ?',
  'Comment changer mon adresse postale ?',
  'Quel est le numéro du support informatique ?',
  'Comment obtenir une attestation employeur ?',
  'À quelle heure ferme le siège actuel ?',
  'Combien coûte l’abonnement à la salle de sport ?'
];

export const selectedEntryIds = SELECTED.map(item => item.entryId);

export const evaluationCases = [
  ...SELECTED.flatMap(item => item.formulations.map((formulation, index) => {
    const ambiguity = index === FORMULATION_CATEGORIES.length - 1
      ? ambiguityBySourceEntryId.get(item.entryId)
      : null;
    return {
      id: item.entryId + '-' + FORMULATION_CATEGORIES[index],
      category: FORMULATION_CATEGORIES[index],
      formulation,
      sourceEntryId: item.entryId,
      expectedEntryId: ambiguity ? ambiguity.expectedEntryId : item.entryId,
      intentId: null,
      ambiguityClassification: ambiguity ? ambiguity.classification : null
    };
  })),
  ...OUT_OF_CORPUS.map((formulation, index) => ({
    id: 'hors-corpus-' + String(index + 1).padStart(3, '0'),
    category: 'hors_corpus',
    formulation,
    sourceEntryId: null,
    expectedEntryId: null,
    intentId: null,
    ambiguityClassification: null
  }))
];

export const outOfCorpusCount = OUT_OF_CORPUS.length;
