// Decision-only corpus for retrieve -> verify -> abstain experiments.
// It is deliberately separate from the immutable 320-case retrieval baseline.
// Every formulation is authored and versioned here; there is no runtime randomisation.

const POSITIVE_GROUPS = [
  {
    entryId: 'equinoxe-q005', split: 'calibration', formulations: {
      paraphrase_naturelle: 'Pourra-t-on découvrir les locaux de Cobalt avant notre installation ?',
      synonymes: 'Une visite préalable du nouveau site est-elle organisée ?',
      vocabulaire_different: 'Est-il prévu de nous faire parcourir les lieux avant le transfert des équipes ?',
      adjacentButResolvable: 'Les créneaux de découverte de Cobalt auront-ils lieu avant le déménagement ?'
    }
  },
  {
    entryId: 'equinoxe-q011', split: 'calibration', formulations: {
      paraphrase_naturelle: 'Pouvez-vous expliquer le principe du flex office ?',
      synonymes: 'Que recouvre l’organisation en bureaux non attribués ?',
      vocabulaire_different: 'Comment fonctionne un plateau où chacun choisit son emplacement selon sa journée ?',
      adjacentButResolvable: 'Le flex office signifie-t-il que je sélectionne une place selon mon activité ?'
    }
  },
  {
    entryId: 'equinoxe-q013', split: 'calibration', formulations: {
      paraphrase_naturelle: 'À quoi correspond un quartier d’équipe ?',
      synonymes: 'Comment définir la zone de référence d’un collectif ?',
      vocabulaire_different: 'Quel espace rassemble les postes, rangements et petites salles d’un même groupe ?',
      adjacentButResolvable: 'Le quartier d’équipe regroupe-t-il les différents espaces utiles à mon équipe ?'
    }
  },
  {
    entryId: 'equinoxe-q016', split: 'calibration', formulations: {
      paraphrase_naturelle: 'Y aura-t-il moins de postes que de collaborateurs ?',
      synonymes: 'Le taux d’équipement prévoit-il un desk pour chaque personne ?',
      vocabulaire_different: 'La capacité d’assises couvrira-t-elle tout l’effectif présent simultanément ?',
      adjacentButResolvable: 'Le ratio de postes inférieur à un correspond-il à une pénurie organisée ?'
    }
  },
  {
    entryId: 'equinoxe-q019', split: 'calibration', formulations: {
      paraphrase_naturelle: 'Quelle est la procédure pour réserver une salle de réunion ?',
      synonymes: 'Avec quel outil puis-je bloquer un espace de réunion ?',
      vocabulaire_different: 'Comment inscrire un créneau afin qu’une pièce soit disponible pour mon rendez-vous ?',
      adjacentButResolvable: 'La réservation des salles continuera-t-elle à passer par l’outil habituel ?'
    }
  },
  {
    entryId: 'equinoxe-q020', split: 'calibration', formulations: {
      paraphrase_naturelle: 'Doit-on réserver avant de travailler à la Bibliothèque ?',
      synonymes: 'L’accès à l’espace silencieux collectif nécessite-t-il un booking ?',
      vocabulaire_different: 'Puis-je m’installer spontanément dans la zone calme de vingt-quatre places ?',
      adjacentButResolvable: 'La Bibliothèque reste-t-elle accessible librement sans inscription préalable ?'
    }
  },
  {
    entryId: 'equinoxe-q022', split: 'calibration', formulations: {
      paraphrase_naturelle: 'Est-il possible de réserver une Project Room en avance ?',
      synonymes: 'Peut-on bloquer à l’avance un espace de travail projet ?',
      vocabulaire_different: 'Puis-je retenir pour demain une pièce destinée au travail collectif prolongé ?',
      adjacentButResolvable: 'Une Project Room peut-elle être réservée pour une journée entière ?'
    }
  },
  {
    entryId: 'equinoxe-q025', split: 'calibration', formulations: {
      paraphrase_naturelle: 'Quels espaces permettent de travailler tranquillement ?',
      synonymes: 'Où trouver une zone silencieuse pour me concentrer ?',
      vocabulaire_different: 'Dans quel lieu puis-je réaliser une tâche sans être sollicité par le plateau ?',
      adjacentButResolvable: 'Pour travailler au calme, puis-je utiliser la Bibliothèque ou un espace Focus ?'
    }
  },
  {
    entryId: 'equinoxe-q027', split: 'calibration', formulations: {
      paraphrase_naturelle: 'Quel endroit utiliser pour un appel téléphonique rapide ?',
      synonymes: 'Où passer une courte visio sans gêner mes voisins ?',
      vocabulaire_different: 'Dans quel petit espace puis-je isoler une conversation de quelques minutes ?',
      adjacentButResolvable: 'Une bulle est-elle adaptée à un appel bref et spontané ?'
    }
  },
  {
    entryId: 'equinoxe-q028', split: 'calibration', formulations: {
      paraphrase_naturelle: 'Combien de participants les salles de réunion peuvent-elles recevoir ?',
      synonymes: 'Quelle jauge est prévue pour les espaces de réunion ?',
      vocabulaire_different: 'Quel est le nombre minimal et maximal de personnes pouvant se réunir dans ces pièces ?',
      adjacentButResolvable: 'Les salles permettent-elles des réunions hybrides jusqu’à seize personnes ?'
    }
  },
  {
    entryId: 'equinoxe-q029', split: 'calibration', formulations: {
      paraphrase_naturelle: 'À quels usages le Forum est-il destiné ?',
      synonymes: 'Quelle est la vocation de l’espace événementiel ?',
      vocabulaire_different: 'Où se tiendront les grandes prises de parole réunissant de nombreux collègues ?',
      adjacentButResolvable: 'Le Forum sert-il aux événements pouvant accueillir jusqu’à cent vingt personnes ?'
    }
  },
  {
    entryId: 'equinoxe-q030', split: 'calibration', formulations: {
      paraphrase_naturelle: 'Un lieu de repos est-il prévu dans Cobalt ?',
      synonymes: 'Disposerons-nous d’une zone bien-être pour souffler ?',
      vocabulaire_different: 'Où pourrai-je m’isoler momentanément afin de récupérer pendant la journée ?',
      adjacentButResolvable: 'L’espace bien-être est-il prévu pour le repos et la récupération ?'
    }
  },
  {
    entryId: 'equinoxe-q034', split: 'calibration', formulations: {
      paraphrase_naturelle: 'Quelle sera la capacité du local à vélos ?',
      synonymes: 'Combien d’emplacements pour bicyclettes sont annoncés ?',
      vocabulaire_different: 'Quel volume de deux-roues non motorisés pourra être accueilli sur le site ?',
      adjacentButResolvable: 'Le local dédié pourra-t-il recevoir environ cent soixante vélos ?'
    }
  },
  {
    entryId: 'equinoxe-q035', split: 'calibration', formulations: {
      paraphrase_naturelle: 'Chaque collaborateur pourra-t-il disposer d’un casier personnel ?',
      synonymes: 'Un locker individuel sera-t-il proposé ?',
      vocabulaire_different: 'Où chacun pourra-t-il conserver ses effets dans un rangement qui lui est propre ?',
      adjacentButResolvable: 'Les rangements individuels seront-ils disponibles sur réservation ?'
    }
  },
  {
    entryId: 'equinoxe-q038', split: 'calibration', formulations: {
      paraphrase_naturelle: 'Pourra-t-on recharger un vélo électrique dans le local ?',
      synonymes: 'Des prises pour bicyclettes à assistance électrique sont-elles prévues ?',
      vocabulaire_different: 'Le stationnement deux-roues permettra-t-il d’alimenter une batterie pendant la journée ?',
      adjacentButResolvable: 'Le local vélos comportera-t-il bien des points d’alimentation électrique ?'
    }
  },
  {
    entryId: 'equinoxe-q043', split: 'holdout', formulations: {
      paraphrase_naturelle: 'Le projet fixe-t-il un nombre minimal de jours sur site ?',
      synonymes: 'Cobalt introduira-t-il un quota de présence au bureau ?',
      vocabulaire_different: 'Faudra-t-il obligatoirement travailler depuis les nouveaux locaux une partie définie de la semaine ?',
      adjacentButResolvable: 'La conception des espaces entraîne-t-elle une nouvelle obligation de présence ?'
    }
  },
  {
    entryId: 'equinoxe-q045', split: 'holdout', formulations: {
      paraphrase_naturelle: 'Quels équipements informatiques trouverons-nous sur les postes ?',
      synonymes: 'Quel matériel IT équipera les desks des quartiers ?',
      vocabulaire_different: 'Quels périphériques seront installés là où nous nous asseyons pour travailler ?',
      adjacentButResolvable: 'Les écrans et équipements standards seront-ils fournis sur les postes partagés ?'
    }
  },
  {
    entryId: 'equinoxe-q047', split: 'holdout', formulations: {
      paraphrase_naturelle: 'Le réseau sans fil couvrira-t-il tout Cobalt ?',
      synonymes: 'Aurons-nous une connexion wifi dans l’ensemble du bâtiment ?',
      vocabulaire_different: 'Pourrai-je me connecter à Internet sans câble depuis n’importe quel espace ?',
      adjacentButResolvable: 'La couverture réseau est-elle prévue jusque dans les salles et espaces communs ?'
    }
  },
  {
    entryId: 'equinoxe-q050', split: 'holdout', formulations: {
      paraphrase_naturelle: 'Comment avoir une conversation confidentielle dans les espaces ouverts ?',
      synonymes: 'Où préserver la discrétion d’un échange sensible en open space ?',
      vocabulaire_different: 'Quel lieu empêche mes voisins d’entendre une discussion qui doit rester privée ?',
      adjacentButResolvable: 'Les salles et bulles sont-elles prévues pour protéger les échanges confidentiels ?'
    }
  },
  {
    entryId: 'equinoxe-q054', split: 'holdout', formulations: {
      paraphrase_naturelle: 'Quels transports en commun desservent Cobalt ?',
      synonymes: 'Comment rejoindre le site en métro ou en RER ?',
      vocabulaire_different: 'Quelles lignes collectives permettent d’arriver aux nouveaux locaux sans voiture ?',
      adjacentButResolvable: 'Les détails d’accès par métro et RER seront-ils communiqués avant l’emménagement ?'
    }
  },
  {
    entryId: 'equinoxe-q060', split: 'holdout', formulations: {
      paraphrase_naturelle: 'Un restaurant sera-t-il disponible sur le site ?',
      synonymes: 'Cobalt disposera-t-il d’une cantine ?',
      vocabulaire_different: 'Pourra-t-on prendre un repas dans un service de restauration intégré au bâtiment ?',
      adjacentButResolvable: 'Le projet prévoit-il bien un lieu principal pour déjeuner sur place ?'
    }
  },
  {
    entryId: 'equinoxe-q062', split: 'holdout', formulations: {
      paraphrase_naturelle: 'Le restaurant proposera-t-il des plats végétariens ?',
      synonymes: 'Une option sans viande sera-t-elle disponible au déjeuner ?',
      vocabulaire_different: 'Les personnes ne consommant pas de produits carnés trouveront-elles un repas chaud adapté ?',
      adjacentButResolvable: 'L’offre de restauration inclura-t-elle explicitement un choix végétarien ?'
    }
  },
  {
    entryId: 'equinoxe-q066', split: 'holdout', formulations: {
      paraphrase_naturelle: 'Quelle démarche suivre pour obtenir un poste de travail adapté ?',
      synonymes: 'À qui adresser une demande d’aménagement ergonomique individuel ?',
      vocabulaire_different: 'Quel circuit utiliser si mon état de santé nécessite un équipement particulier pour travailler ?',
      adjacentButResolvable: 'Une adaptation de poste doit-elle passer par les interlocuteurs RH et santé habituels ?'
    }
  },
  {
    entryId: 'equinoxe-q070', split: 'holdout', formulations: {
      paraphrase_naturelle: 'Le traitement acoustique tient-il compte des personnes sensibles au bruit ?',
      synonymes: 'La conception sonore limite-t-elle les nuisances pour les collaborateurs fragiles ?',
      vocabulaire_different: 'Les espaces ont-ils été pensés pour réduire la fatigue provoquée par les conversations alentour ?',
      adjacentButResolvable: 'L’acoustique fait-elle partie des attentions explicites du projet ?'
    }
  },
  {
    entryId: 'equinoxe-q077', split: 'holdout', formulations: {
      paraphrase_naturelle: 'Quel est le rôle des ambassadeurs du projet ?',
      synonymes: 'À quoi servent les relais Cobalt dans chaque service ?',
      vocabulaire_different: 'Qui peut répondre localement aux questions quotidiennes des équipes sur le changement ?',
      adjacentButResolvable: 'Les ambassadeurs sont-ils les interlocuteurs de proximité pour les questions du projet ?'
    }
  }
];

const NEGATIVE_GROUPS = [
  {
    type: 'clearOutOfCorpus', risk: 'weak',
    rationale: 'Sujet clairement extérieur au projet workplace publié.',
    queries: [
      'Quand sera versée la prochaine prime annuelle ?',
      'Comment modifier mon taux de prélèvement à la source ?',
      'Où télécharger mes anciennes fiches de paie ?',
      'Quelle météo est prévue ce week-end à Lyon ?',
      'Comment réserver un hôtel pour un déplacement professionnel ?',
      'Qui valide les demandes de congé parental ?',
      'Quel est le cours actuel de l’action de l’entreprise ?',
      'Comment renouveler ma carte de mutuelle ?',
      'Où déclarer mes kilomètres professionnels ?',
      'Quelle équipe organise la fête de fin d’année ?'
    ]
  },
  {
    type: 'hardNegative', risk: 'dangerous',
    rationale: 'Contexte Cobalt plausible, mais information précise absente du contenu publié.',
    queries: [
      'Quel est le budget total engagé pour le projet Cobalt ?',
      'Quel cabinet a signé le bail des nouveaux locaux ?',
      'Combien coûtera chaque poste de travail installé ?',
      'Quelle entreprise assurera le nettoyage quotidien du bâtiment ?',
      'Quel est le montant annuel du loyer de Cobalt ?',
      'Qui a remporté l’appel d’offres pour le mobilier ?',
      'Quel assureur couvre les dommages dans les nouveaux bureaux ?',
      'Combien le déménagement coûtera-t-il par collaborateur ?',
      'Quelle société exploitera techniquement le bâtiment ?',
      'Quel est le retour sur investissement prévu après cinq ans ?'
    ]
  },
  {
    type: 'workplaceUncovered', risk: 'dangerous',
    rationale: 'Besoin workplace réel dont la réponse opérationnelle n’est pas publiée.',
    queries: [
      'Quelle température minimale sera garantie dans les bureaux ?',
      'Peut-on régler individuellement la climatisation de son quartier ?',
      'Des bureaux debout électriques seront-ils disponibles partout ?',
      'Quel produit sera utilisé pour nettoyer les écrans partagés ?',
      'Les animaux de compagnie seront-ils autorisés sur le site ?',
      'Où seront rangés les objets trouvés dans le bâtiment ?',
      'Existe-t-il une procédure pour recevoir un colis personnel à Cobalt ?',
      'Les fenêtres des plateaux pourront-elles être ouvertes ?',
      'Une permanence de médecine du travail sera-t-elle présente sur place ?',
      'Peut-on diffuser de la musique dans les quartiers d’équipe ?'
    ]
  },
  {
    type: 'lexicalCollision', risk: 'medium',
    rationale: 'Recouvre fortement le vocabulaire canonique, mais porte sur une intention différente non couverte.',
    queries: [
      'Comment réserver un billet de train depuis l’outil habituel ?',
      'Puis-je réserver une place de parking pour mon domicile ?',
      'Quel poste budgétaire finance le restaurant ?',
      'Comment changer le mot de passe du wifi de mon logement ?',
      'Qui réserve la salle pour la formation externe de demain ?',
      'Mon casier fiscal personnel est-il disponible en ligne ?',
      'Quel ambassadeur représente la marque auprès des clients ?',
      'Le Forum informatique permet-il de signaler un bug ?',
      'Combien de places reste-t-il pour l’atelier de formation Excel ?',
      'Puis-je recharger mon abonnement de transport au restaurant ?'
    ]
  },
  {
    type: 'nearButUnpublished', risk: 'dangerous',
    rationale: 'Question très proche d’une Q&A, mais demande un détail que la réponse publiée ne fournit pas.',
    queries: [
      'À quelle heure exacte commenceront les visites de Cobalt ?',
      'Quel numéro de version portera l’outil de réservation des salles ?',
      'Combien de prises de recharge vélo seront installées précisément ?',
      'Quelle marque d’écran équipera les postes de travail ?',
      'Quel sera le prix quotidien du menu végétarien ?',
      'Quelle fréquence wifi sera utilisée dans les salles ?',
      'Quel quai de la gare RER est le plus proche de l’entrée ?',
      'Quelle surface en mètres carrés occupe la Bibliothèque ?',
      'Quel modèle de serrure équipe les casiers personnels ?',
      'Quel coefficient acoustique exact a été retenu pour les cloisons ?'
    ]
  },
  {
    type: 'trueAmbiguous', risk: 'dangerous',
    rationale: 'Deux Q&A distinctes sont sollicitées sans intention principale déterminable.',
    queries: [
      'Dois-je réserver un poste ou plutôt une salle quand je viens ?',
      'Le casier et le bureau seront-ils tous les deux personnels ?',
      'Pour être tranquille, vaut-il mieux une bulle ou la Bibliothèque ?',
      'Le restaurant et le Café central serviront-ils les mêmes repas ?',
      'Vais-je prendre le RER ou venir à vélo ?',
      'La Project Room et la salle de réunion ont-elles la même capacité ?',
      'Qui choisir entre un ambassadeur et les RH pour demander de l’aide ?',
      'Le Forum sert-il aux événements ou aux réunions ordinaires ?',
      'La présence minimale dépend-elle des jours de télétravail ?',
      'Les prises électriques concernent-elles les vélos ou les voitures ?'
    ]
  },
  {
    type: 'mixedIntents', risk: 'dangerous',
    rationale: 'La requête mélange deux intentions couvertes incompatibles avec une réponse unique.',
    queries: [
      'Quand déménageons-nous et comment réserver une salle ?',
      'Combien de places vélos y aura-t-il et le restaurant sera-t-il ouvert ?',
      'Expliquez le flex office et dites-moi comment venir en RER.',
      'Puis-je visiter Cobalt et obtenir un poste adapté ?',
      'Où travailler au calme et où déjeuner ensuite ?',
      'Aurai-je un casier et quel matériel informatique sera fourni ?',
      'Le wifi couvrira-t-il le site et qui sont les ambassadeurs ?',
      'Comment réserver une Project Room et combien de personnes tient-elle ?',
      'Le télétravail change-t-il et y aura-t-il une offre végétarienne ?',
      'Comment passer un appel confidentiel et recharger mon vélo ?'
    ]
  },
  {
    type: 'falsePremise', risk: 'dangerous',
    rationale: 'La demande contient une prémisse contraire ou non établie par le contenu publié.',
    queries: [
      'Pourquoi le déménagement a-t-il été avancé au 3 janvier 2027 ?',
      'Comment obtenir mon bureau nominatif déjà attribué ?',
      'Pourquoi la Bibliothèque est-elle payante sur réservation ?',
      'Quand recevrai-je ma place de parking visiteur permanente ?',
      'Pourquoi le télétravail est-il supprimé après l’ouverture ?',
      'Comment choisir mon menu végétarien gratuit chaque vendredi ?',
      'Où récupérer la clé de ma Project Room personnelle ?',
      'Pourquoi les vélos électriques sont-ils interdits dans le local ?',
      'Quel étage est réservé uniquement aux managers ?',
      'Comment contacter l’ambassadeur externe imposé à mon équipe ?'
    ]
  },
  {
    type: 'shortUnresolvable', risk: 'weak',
    rationale: 'Formulation très courte dont l’intention reste insuffisamment déterminée.',
    queries: [
      'Réservation demain ?',
      'Combien de places ?',
      'Accès comment ?',
      'Ouverture quand ?',
      'Quel équipement ?',
      'Besoin particulier ?',
      'Espace disponible ?',
      'Qui contacter ?',
      'C’est obligatoire ?',
      'Quelle capacité ?'
    ]
  },
  {
    type: 'strongResemblanceUncovered', risk: 'dangerous',
    rationale: 'La formulation ressemble à une question canonique, mais la conduite juste reste l’abstention.',
    queries: [
      'Combien de places vélos seront réservées aux visiteurs externes ?',
      'Puis-je réserver la Bibliothèque entière pour mon équipe ?',
      'Le casier personnel peut-il conserver des produits dangereux ?',
      'Les bulles peuvent-elles accueillir un entretien de recrutement de deux heures ?',
      'Le Forum sera-t-il loué à des entreprises extérieures le week-end ?',
      'Le wifi permet-il de connecter des équipements personnels non administrés ?',
      'Le restaurant garantit-il des repas sans allergènes certifiés ?',
      'L’accès PMR couvre-t-il un accompagnement humain depuis le domicile ?',
      'Les ambassadeurs peuvent-ils valider une demande RH individuelle ?',
      'Le poste adapté sera-t-il livré sous quarante-huit heures ?'
    ]
  }
];

const POSITIVE_CATEGORIES = [
  'paraphrase_naturelle',
  'synonymes',
  'vocabulaire_different',
  'adjacentButResolvable'
];

const positiveCases = POSITIVE_GROUPS.flatMap(group =>
  POSITIVE_CATEGORIES.map(category => ({
    id: `decision-pos-${group.entryId}-${category}`,
    split: group.split,
    type: category,
    risk: null,
    formulation: group.formulations[category],
    expectedEntryId: group.entryId,
    intentId: null,
    rationale: `Reformulation résoluble de la question canonique ${group.entryId}.`
  }))
);

const negativeCases = NEGATIVE_GROUPS.flatMap((group, groupIndex) =>
  group.queries.map((formulation, index) => ({
    id: `decision-neg-${String(groupIndex + 1).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`,
    split: index < 6 ? 'calibration' : 'holdout',
    type: group.type,
    risk: group.risk,
    formulation,
    expectedEntryId: null,
    intentId: null,
    rationale: group.rationale
  }))
);

export const decisionCases = Object.freeze([...positiveCases, ...negativeCases]);
export const decisionCorpusContract = Object.freeze({
  schemaVersion: 1,
  total: 200,
  calibration: 120,
  holdout: 80,
  positives: 100,
  negatives: 100,
  positiveCategories: POSITIVE_CATEGORIES,
  negativeTypes: NEGATIVE_GROUPS.map(group => group.type)
});
