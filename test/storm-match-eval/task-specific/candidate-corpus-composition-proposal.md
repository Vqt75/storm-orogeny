# Storm Match — structure candidate et composition pré-annotation

## Statut

Cette proposition est curator-side. Elle ne constitue ni une annotation humaine
ni un dataset. Elle ne contient aucune formulation utilisateur nouvelle, aucun
label candidate-level, aucun gold système et aucune sortie du futur classifieur.

- Quality Gate automatique : `STRUCTURAL_OK` ;
- Quality Gate métier : `PENDING_HUMAN_REVIEW` ;
- `generationAuthorized: false` ;
- holdout : non créé, non exécutable et non ouvert ;
- commit/push : hors périmètre de cette étape.

Fingerprints SHA-256 recalculés après recomposition :

- structure :
  `7645715532702ea42599151243126e63abcfcb6015ad711673d9e12111da361e` ;
- composition :
  `2951ff970fe1e274e9ed250e25dfef95a6d9425a900b8f8b09e086d2cef5a652`.

Le statut automatique signifie seulement que les références, comptes,
fingerprints et interdictions sont cohérents. Les groupes d’équivalence, leurs
préférés et le graphe métier restent des hypothèses curator-side à soumettre à
deux revues humaines indépendantes puis à adjudication.

## Source canonique et provenance

Le corpus de connaissances reste le snapshot autonome de 112 Q&A Équinoxe :

- `test/storm-match-eval/equinoxe-corpus.snapshot.json` ;
- SHA-256
  `4b8a64a58d44b8f81cbf861e9daefc594a9095b6c8516ef205ecefde82984d4b` ;
- IDs `equinoxe-q001..q112`, synthétiques, stables et test-only ;
- `intentId: null` ;
- provenance historique `src/db/seedDemo.js`, symbole `QUESTIONS`, commit
  `d0243f15c4c390098663a9d31a462e5244ee6e60` ;
- aucune dépendance runtime au seed.

La baseline officielle (320 cas), le Decision Corpus (200) et le holdout NLI
désormais observé (96) sont exclus du futur holdout. Leurs textes peuvent être
réutilisés seulement dans les splits observables, avec provenance et nouvelle
revue humaine ; leurs labels ne sont jamais importés.

## Groupes d’équivalence candidats et dossiers de revue

La partition candidate reste conservatrice : 106 groupes pour 112 entrées,
dont cinq propositions multi-entrée :

| groupe candidat | membres | préféré candidat |
|---|---|---|
| `eqx-aeg-001` | q001, q002 | q002 |
| `eqx-aeg-019` | q019, q053 | q019 |
| `eqx-aeg-050` | q050, q051, q099 | q050 |
| `eqx-aeg-066` | q066, q069 | q069 |
| `eqx-aeg-078` | q078, q085 | q078 |

Ces valeurs ne sont pas validées métier. Cinq dossiers curator-side distincts
reproduisent exactement les Q+A canoniques de chaque comparaison dans
`candidate-corpus-structure.js`. Ils n’incluent ni décision, ni choix préféré,
ni réponse d’un reviewer, ni signal modèle. Le dossier q066/q069 est bien
présent. q050/q051/q099 demande explicitement de vérifier si la dimension
« réservation » de q099 est réellement couverte par sa réponse.

La règle de choix reste : Q+A la plus explicite et autonome sans élargissement
de portée, puis plus petit ordinal uniquement en cas d’égalité stricte.

L’infrastructure expose désormais un contrat de paquet structurel monolingue,
sans générer les paquets finaux. Equivalence substantielle, choix du préféré et
frontières de clusters sont trois sections de décision séparées, avec deux
soumissions humaines aveugles et adjudication append-only. Le contrat couvre les
cinq comparaisons multi-entry et les frontières arrivée/préparation,
flex/télétravail, communication/pilote et salles/Focus. Il interdit tout groupe,
préféré ou cluster proposé, toute réponse de l’autre reviewer et tout score,
output ou rang DistilUSE. `finalPacketGenerationAuthorized` reste `false`.

## Clusters et audit de voisinage curator-side

La réservation candidate couvre les 112 entrées sans chevauchement :

| split | clusters | entrées |
|---|---:|---:|
| train | 4 | 58 |
| development | 2 | 20 |
| calibration | 2 | 12 |
| holdout | 3 | 22 |

Cette répartition 58/20/12/22 préserve les clusters, mais n’est pas scellée.

Un diagnostic DistilUSE a été exécuté exclusivement curator-side :

- modèle `sentence-transformers/distiluse-base-multilingual-cased-v2` ;
- révision `bfe45d0732ca50787611c0fe107ba278c7f3f889` ;
- fingerprint artefact
  `2beea8cfc4a634a02e235f646f3cb298ae4db96edef92b1bfe07f429ae325187` ;
- CPU, six threads, mode strictement offline, aucun téléchargement ;
- représentation : question canonique, dimension 512, longueur max 128,
  voisins Top-5.

Résultats diagnostiques : 560 relations Top-5 dirigées, dont 344
inter-clusters ; 110/112 entrées ont au moins un voisin inter-cluster dans leur
Top-5 ; 101 paires inter-clusters sont mutuelles. Parmi les paires non dirigées,
176 dépassent 0,50, 38 dépassent 0,60, 16 dépassent 0,65, 9 dépassent 0,70 et 2
dépassent 0,75.

Les 16 signaux inter-clusters à au moins 0,65 sont versionnés dans la structure.
Ils imposent notamment une revue humaine de ces frontières :

- arrivée/restauration ↔ préparation/guide/IT via q002/q007/q009 ;
- flex/quartiers ↔ télétravail/présence via q010/q012/q041/q044 ;
- communication ↔ pilote/feedback via q078/q111 ;
- salles de collaboration ↔ Bibliothèque/Focus comme possible composante
  métier unique ;
- q034/q075 comme probable collision numérique, à ne pas transformer en arête
  sans justification métier.

Le diagnostic n’a généré aucun label, groupe, préféré, gold ou décision de
cluster. Ses similarités, rangs et flags sont interdits aux paquets reviewers,
à l’apprentissage, à calibration et au holdout. Le faible voisinage lexical de
q066/q069 ou q078/q085 ne réfute pas une équivalence de réponse métier.

## Audit de capacité des ambiguïtés — tous les splits

L’audit part uniquement des connaissances réservées à chaque split. Une paire
combinatoire ne compte jamais comme situation métier. Les variantes lexicales,
linguistiques ou catégorielles d’un même besoin sont rabattues sur une seule
famille avant estimation.

| split | entrées | groupes | clusters multi-groupes | couples totaux / intra-cluster | familles candidates / prudentes | capacité prudente à 4 | ancien → recommandé |
|---|---:|---:|---:|---:|---:|---:|---:|
| train | 58 | 57 | 4 | 1 596 / 418 | 8 / 6 | 24 | 150 → 24 |
| development | 20 | 19 | 2 | 171 / 93 | 8 / 5 | 20 | 80 → 20 |
| calibration | 12 | 11 | 2 | 55 / 27 | 6 / 4 | 16 | 80 → 16 |
| holdout | 22 | 19 | 3 | 171 / 85 | 12 / 4–5 | 16–20 | 100 → 20 |

Les principaux ensembles concurrents à soumettre aux humains sont :

- train : permanence du poste/quartier, réservation versus déclaration de
  présence, sens de la connexion, sens de l’accessibilité, cible de recharge et
  référent « casier » ;
- development : capacité restaurant/terrasse, offre et accès du Café, existence
  versus ouverture du restaurant, offre alimentaire et règles de présence ;
- calibration : rôle/ouverture/feedback du pilote, cycle de feedback, question
  versus actualité, rôle/présence/désignation des ambassadeurs ;
- holdout : espace de réservation non précisé, capacité du lieu, choix d’espace,
  événement versus réunion, calme/appel/confidentialité, isolation/fermeture.

Chaque split offre les trois mécanismes requis : référence sous-spécifiée,
connaissances publiées concurrentes et lectures d’intention alternatives. Les
ensembles conditionnels, les réponses englobantes, les besoins trop larges et
les simples attributs d’une même intention ne sont pas précomptés. Pour train,
q039 est exclue de toute capacité dépendant d’une date tant que l’anomalie des
casiers n’est pas adjudiquée.

Les quotas recommandés restent des plafonds conditionnels : si la double revue
de structure confirme moins de 6/5/4/5 familles indépendantes, le quota du split
est réduit avant rédaction.

## Diversité et plafond `scenarioFamilyId`

Le plafond historique de quatre est rejeté. À 1 680 slots, il imposait 420
familles — 225/60/60/75 par split — soit jusqu’à 5,5 situations indépendantes
par groupe d’équivalence dans calibration. C’est incompatible avec les
connaissances atomiques de dates, capacités, disponibilités et règles binaires.

La capacité plausible après déduplication est d’environ 230 à 280 familles,
avec un centre de planification 250–260. Une distribution possible, non un quota
à remplir, est :

| split | ancrage covered | ancrage notCovered | ancrage ambiguous | total |
|---|---:|---:|---:|---:|
| train | 70 | 50 | 6 | 126 |
| development | 20 | 17 | 5 | 42 |
| calibration | 16 | 17 | 4 | 37 |
| holdout | 22 | 22 | 5 | 49 |
| **total** | **128** | **106** | **20** | **254** |

Une famille traversant plusieurs catégories diagnostiques n’est comptée qu’une
fois. Les catégories les plus exposées à la sur-fragmentation sont paraphrases,
synonymes, `differentVocab`, traductions, autres robustesses, hard negatives,
collisions, `nearButUnpublished`, permutations de mixed intents, ambiguïtés
combinatoires et variations d’une même fausse prémisse.

Le nouveau plafond dur est huit. Le minimum mathématique devient
113/30/30/38 = 211 familles. Un plancher plus strict de 129/35/35/43 = 242
maintient une moyenne d’au plus sept cas par famille. Si ce plancher n’est pas
atteint, le volume de chaque split est réduit à au plus sept fois le nombre de
familles approuvées. Plus de 50 % des familles saturées à huit ou plus de deux
cas d’un même couple langue × catégorie primaire dans une famille bloque aussi
la rédaction. Les paires candidates ne consomment pas ce plafond ; paraphrases,
variantes et traductions du même besoin réutilisent toujours le même ID.

## Composition system-level amendée

| split | covered | notCovered | ambiguous | total |
|---|---:|---:|---:|---:|
| train | 526 | 350 | 24 | 900 |
| development | 110 | 110 | 20 | 240 |
| calibration | 112 | 112 | 16 | 240 |
| holdout final | 140 | 140 | 20 | 300 |
| **total** | **888** | **712** | **80** | **1 680** |

Les 250 slots d’ambiguïté retirés sont redistribués vers `covered` et
`notCovered`, sans changer la taille des splits. Les volumes de catégories sont
réajustés proportionnellement :

| outcome / catégorie | train | development | calibration | holdout |
|---|---:|---:|---:|---:|
| covered / naturalParaphrase | 132 | 28 | 28 | 35 |
| covered / synonyms | 105 | 22 | 22 | 28 |
| covered / differentVocab | 131 | 27 | 28 | 35 |
| covered / adjacentButResolvable | 105 | 22 | 23 | 28 |
| covered / otherRobustness | 53 | 11 | 11 | 14 |
| notCovered / mixedIntents | 88 | 28 | 28 | 35 |
| notCovered / hardNegative | 70 | 22 | 22 | 28 |
| notCovered / lexicalCollision | 53 | 17 | 17 | 21 |
| notCovered / nearButUnpublished | 52 | 16 | 17 | 21 |
| notCovered / falsePremise | 52 | 16 | 17 | 21 |
| notCovered / clearOutOfCorpus | 35 | 11 | 11 | 14 |
| ambiguous / underspecifiedReference | 10 | 8 | 6 | 8 |
| ambiguous / competingPublishedKnowledge | 8 | 7 | 6 | 7 |
| ambiguous / alternativeIntentReadings | 6 | 5 | 4 | 5 |

Ce sont des slots de rédaction et de revue, jamais des labels préremplis.

## Six langues

Les six langues de référence restent FR, EN, DE, ES, IT et NL. Les comptes
entiers conservent exactement les proportions et totaux globaux préenregistrés :

| split / outcome | FR | EN | DE | ES | IT | NL | total |
|---|---:|---:|---:|---:|---:|---:|---:|
| train / covered | 295 | 63 | 53 | 42 | 42 | 31 | 526 |
| train / notCovered | 196 | 42 | 35 | 28 | 28 | 21 | 350 |
| train / ambiguous | 13 | 3 | 2 | 2 | 2 | 2 | 24 |
| development / covered | 62 | 14 | 11 | 8 | 8 | 7 | 110 |
| development / notCovered | 62 | 14 | 11 | 8 | 8 | 7 | 110 |
| development / ambiguous | 11 | 2 | 2 | 2 | 2 | 1 | 20 |
| calibration / covered | 63 | 14 | 11 | 9 | 8 | 7 | 112 |
| calibration / notCovered | 63 | 14 | 11 | 8 | 9 | 7 | 112 |
| calibration / ambiguous | 9 | 2 | 2 | 1 | 1 | 1 | 16 |
| holdout / covered | 79 | 17 | 14 | 11 | 11 | 8 | 140 |
| holdout / notCovered | 78 | 17 | 14 | 11 | 11 | 9 | 140 |
| holdout / ambiguous | 11 | 2 | 2 | 2 | 2 | 1 | 20 |
| **total corpus** | **942** | **204** | **168** | **132** | **132** | **102** | **1 680** |

Les six langues restent possibles dans chaque couple split/outcome, y compris
les micro-strates d’ambiguïté de 16 à 24 cas. Elles ne sont pas forcées dans
chaque microcatégorie. Chaque catégorie primaire est couverte par au moins trois
langues sur le corpus complet. Les textes seront rédigés nativement, jamais par
traduction mécanique d’un patron français.

## Revue humaine et charge projetée

Reviewer A et Reviewer B sont des rôles par strate linguistique, pas deux
personnes globales. Chaque personne atteste sa compétence dans la langue jugée,
reste aveugle aux outputs modèle et aux réponses de l’autre rôle, et utilise la
même grille. Une même personne ne tient jamais A et B pour un même cas.

- calibration : double revue exhaustive ;
- holdout : double revue exhaustive ;
- train : une revue primaire ;
- development : une revue primaire ;
- seconde revue train/dev : ciblée, indépendante, préenregistrée et jamais
  choisie à partir d’un modèle ; elle n’est pas exhaustive ;
- groupes, préférés, graphe et clusters : deux revues indépendantes puis
  adjudication append-only avant scellement.

Charge query-level minimale :

| source | affectations |
|---|---:|
| train primaire | 900 |
| development primaire | 240 |
| calibration double | 480 |
| holdout double | 600 |
| **total obligatoire** | **2 220** |

Par langue : FR 1 245, EN 270, DE 222, ES 174, IT 174, NL 135. Si les 114
slots dangereux train/dev sont tous sélectionnés pour une seconde revue, le
total atteint 2 334, avant les éventuels cas litigieux ou l’échantillon QA. La
charge de double revue structurelle n’est pas incluse, car le nombre final
d’arêtes et de comparaisons dépend de l’adjudication du graphe.

## Hard negatives et projection candidate-level

L’unité de quota est `(query, hardNegativeAnswerEquivalenceGroupId)`, pas
`(query, entryId)`. Plusieurs alias d’un même groupe ne comptent qu’une fois.

Le minimum de groupes couverts vaut :

- train 574 ;
- development 150 ;
- calibration 144 ;
- holdout 180 ;
- total 1 048.

Le plan train exige donc au moins `2 × 574 = 1 148` occurrences de groupes
hard-negative distinctes par requête. Un groupe multi-entry ne multiplie jamais
ce quota. Le nombre exact de paires reste inconnu avant le retriever gelé, les
groupes adjudiqués et l’annotation exhaustive des candidats plausibles.

## Opportunités de faux positif dangereux

Les slots restent des opportunités à faire confirmer par les humains, pas des
jugements :

| split | covered / mauvais groupe | notCovered | ambiguous | total |
|---|---:|---:|---:|---:|
| train | 20 | 58 | 12 | 90 |
| development | 4 | 12 | 8 | 24 |
| calibration | 12 | 36 | 12 | 60 |
| holdout | 10 | 40 | 10 | 60 |

Le futur rapport publiera toujours le dénominateur confirmé (`0/D`), jamais un
zéro sans contexte.

## Anomalies méthodologiquement résolues

### Date de réservation des casiers

Le même commit d’introduction `d10d6a6` contient : jalon seed au 2 novembre
2026, q035/q036 à « début décembre 2026 » et q039 au 3 décembre 2026. q035,
q036 et q039 sont compatibles entre elles ; le jalon est contradictoire. Aucun
historique ne prouve une évolution temporelle et il ne s’agit pas de deux vérités
métier identifiables. Le snapshot Q&A reste la source d’évaluation autonome,
sans correction silencieuse du seed. Toute rédaction spécifique à la date est
mise en quarantaine jusqu’à adjudication métier. Une formulation générique de
type « quand pourrai-je utiliser mon casier ? » n’est admissible que si son gold
reste identique quelle que soit la date source retenue ; elle ne peut servir à
choisir silencieusement entre le 2 novembre, le début décembre et le 3 décembre.
Disponibilité, usage et date exacte ne sont pas fusionnés automatiquement.

### Mixed intents historiques

Les dix cas `decision-neg-07-01..10` étaient traités comme abstention/
`notCovered`. Les seize cas `answerability-holdout-ambiguous-01..16` étaient
étiquetés `ambiguous`. La règle V0 unique devient :

- conjonction explicite dont aucune Q+A unique ne couvre toutes les parties :
  `notCovered` ;
- plusieurs lectures alternatives raisonnables, chacune complètement couverte
  par un groupe différent : `ambiguous`.

Les anciens labels restent diagnostiques et ne font jamais autorité.

## Décisions encore requises

1. Deux revues humaines et adjudication des groupes, préférés, arêtes et
   clusters, y compris tous les flags sémantiques.
2. Confirmation des capacités prudentes de 6/5/4/5 familles d’ambiguïté par
   split ; sinon réduction du quota concerné avant rédaction.
3. Confirmation d’au moins 129/35/35/43 familles de scénario authentiques ;
   sinon réduction du volume selon le gate de diversité.
4. Affectation de personnes compétentes aux rôles par langue.
5. Adjudication métier de la date des casiers.

Jusqu’à ces décisions : `PENDING_HUMAN_REVIEW` et
`generationAuthorized: false`.
