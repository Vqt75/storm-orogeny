# Liquid Core V0 — protocole du classifieur d’answerability spécialisé

## Statut et hypothèse

Ce document est une proposition expérimentale test-only. Il ne choisit aucun
modèle, ne crée aucune donnée d’entraînement, ne lance aucun fine-tuning et ne
modifie pas Storm Match produit.

Hypothèse à tester : un petit classifieur multilingue entraîné explicitement sur
la notion de couverture Storm peut mieux décider qu’un NLI générique zero-shot
si une connaissance candidate répond entièrement et sans extrapolation à une
requête utilisateur.

Entrée élémentaire :

`query utilisateur × (question canonique + réponse canonique)`

Sortie élémentaire candidate-level :

`covered | notCovered`

La sortie system-level reste :

`covered(entryId) | notCovered | ambiguous`

Le contenu canonique demeure la seule source de vérité. Le classifieur ne
génère, ne complète et ne corrige aucune réponse projet.

## Architecture expérimentale

Le pipeline à mesurer reste volontairement simple :

1. un retriever existant, gelé et versionné, fournit un Top-K ;
2. le même classifieur évalue chaque paire `query × Q+A` indépendamment ;
3. les candidats `covered` sont regroupés par `answerEquivalenceGroupId` ;
4. une règle d’agrégation préenregistrée produit la décision requête :
   - aucun groupe couvert : `notCovered` ;
   - exactement un groupe couvert :
     `covered(answerEquivalenceGroup.preferredEntryId)` ;
   - plusieurs groupes de réponses substantiellement différents couverts et
     concurrents : `ambiguous`.

Il n’existe pas de label candidate-level `ambiguous`. L’ambiguïté est une
propriété de l’ensemble des candidats compatibles avec la requête, pas d’une
paire isolée. Le classifieur estime seulement si une Q+A constitue une réponse
valide et complète sous au moins une interprétation raisonnable de la requête ;
il ne décide jamais seul que cette interprétation est unique. Plusieurs
`entryId` couverts dans un même groupe d’équivalence comptent comme un seul
groupe et ne produisent jamais `ambiguous`.

Le score du retriever ne devient pas une condition lexicale ni une vérité. Il
sert uniquement à construire l’ensemble candidat. Les métriques séparent
toujours `retrievalMiss` et erreur du classifieur lorsque le bon candidat était
présent.

Deux variantes d’apprentissage abstraites pourront être comparées plus tard,
sans nommer encore de backbone :

- tête de classification spécialisée sur encodeur multilingue gelé ;
- adaptation supervisée bornée du même type d’encodeur compact.

Le nombre de familles, les hyperparamètres autorisés et la règle de sélection
seront préenregistrés sans modifier les critères de succès verrouillés par le
présent protocole. Aucun reranker BGE, NLI zero-shot, score lexical ou génération
ne fait partie de la décision.

## Sémantique des labels

### Labels candidate-level

Les labels binaires portent sur une paire et sur la totalité de la demande :

- `covered` : la Q+A candidate fournit une réponse directement exploitable,
  complète et exacte sous au moins une interprétation raisonnable du texte, sans
  inventer de contexte ni de vérité non publiée ;
- `notCovered` : la Q+A ne répond pas, ne répond qu’à une partie ou un détail
  annexe, contredit la demande, ou exige une information absente/non publiée.

La clause « au moins une interprétation raisonnable » permet d’annoter plusieurs
candidats `covered`. Leur concurrence n’existe au niveau système que si ces
candidats appartiennent à plusieurs groupes de réponses substantiellement
différents. Elle ne permet pas de marquer `covered` une réponse seulement
partielle à une demande explicite.

### Groupes d’équivalence de réponse

Chaque `entryId` utilisé par le dataset appartient à exactement un
`answerEquivalenceGroupId`, y compris lorsqu’il constitue un groupe singleton.
Deux entrées appartiennent au même groupe uniquement si leurs réponses sont
interchangeables pour la demande couverte du point de vue métier : substituer
l’une à l’autre ne doit changer ni condition, ni exception, ni portée, ni
public, ni quantité, ni date, ni procédure, ni action recommandée. Une proximité
thématique, un vocabulaire commun, une relation parent/enfant ou deux réponses
complémentaires ne suffisent jamais.

Le manifeste d’équivalence est construit et revu avant les formulations. Chaque
groupe contient au minimum :

- `answerEquivalenceGroupId` stable ;
- la liste exhaustive et non vide de ses `entryIds` ;
- un unique `preferredEntryId`, obligatoirement membre du groupe ;
- une justification métier explicite de l’équivalence ou du singleton ;
- le statut et les auteurs des deux revues indépendantes ;
- son fingerprint et la version du snapshot canonique de référence.

Le `preferredEntryId` est choisi avant dataset et entraînement selon la règle
déterministe suivante : retenir l’entrée dont la question et la réponse forment
la formulation canonique la plus explicite et autonome sans élargir la portée
métier ; si plusieurs entrées restent strictement équivalentes selon ce critère,
retenir l’identifiant de fixture ordinal le plus faible. Le choix ne dépend
jamais d’un score de retrieval, d’un output modèle ou d’un résultat expérimental.
Toute modification ultérieure du groupe ou de son `preferredEntryId` crée une
nouvelle version du manifeste et invalide les datasets et holdouts dérivés.

### Gold system-level

Chaque requête possède un `goldCoveredCandidateIds` exhaustif dans le snapshot
autorisé et un `goldCoveredAnswerEquivalenceGroupIds` dérivé comme l’ensemble
dédupliqué de leurs groupes :

- ensemble de groupes vide : `notCovered` ;
- exactement un groupe :
  `covered(answerEquivalenceGroup.preferredEntryId)` ;
- au moins deux groupes substantiellement différents, chacun constituant une
  réponse complète sous une interprétation concurrente : `ambiguous`.

La cardinalité brute de `goldCoveredCandidateIds` ne détermine donc plus le
gold system-level. Deux ou plusieurs candidats couverts appartenant au même
groupe restent un cas `covered`, avec le `preferredEntryId` du groupe comme
`expectedEntryId`. Un cas ne peut être `ambiguous` si tous ses candidats
couverts appartiennent au même groupe.

Une ambiguïté exige donc deux interprétations raisonnables ou plus, chacune
soutenue par une Q+A différente. Une simple incertitude d’annotation, une faible
confiance ou une demande sans réponse publiée ne constitue pas une ambiguïté.

Pour un mixed intent explicite, une Q+A qui ne couvre qu’une partie reçoit
`notCovered`. Si aucune Q+A ne couvre toute la demande, le résultat attendu est
`notCovered`, même si plusieurs entrées répondent chacune à un fragment. Un cas
mixed intent n’est `ambiguous` que si le texte autorise réellement plusieurs
lectures concurrentes complètes. Pour un adjacent resolvable, une seule Q+A
exacte reçoit `covered`, même si sa surface lexicale est éloignée.

Les désaccords d’annotation sont arbitrés ; ils ne deviennent jamais une
troisième classe candidate-level.

## Dataset Storm Match dédié

### Unité source et unité d’apprentissage

La source versionnée est un cas requête, avec au minimum :

- `caseId`, `query`, `expectedSystemOutcome`, `primaryQueryType`, tags secondaires,
  `language` ;
- `expectedEntryId` ou `null`, `intentId: null` ;
- `goldCoveredCandidateIds` exhaustif et
  `goldCoveredAnswerEquivalenceGroupIds` dérivé, dont la cardinalité détermine
  le gold system-level ;
- `sourceKnowledgeClusterIds`, `scenarioFamilyId` et liste exhaustive des
  intentions impliquées ;
- `risk: weak | medium | dangerous | null`, catégorie et justification du risque ;
- `provenance`, `authorBatch`, `split`, statut et auteurs de la double revue ;
- pour chaque paire dérivée : `candidateEntryId`, stratégie de négatif et label
  binaire de paire, avec l’`answerEquivalenceGroupId` issu du manifeste.

Les textes Q+A restent référencés par le snapshot canonique et son fingerprint,
sans les dupliquer arbitrairement. Les identifiants sont des fixtures
synthétiques stables, jamais des identifiants PostgreSQL.

`sourceKnowledgeClusterIds` contient tous les clusters publiés nécessaires ou
voisins du cas. Un hard negative hérite du cluster de la connaissance qu’il
imite ; une ambiguïté référence tous ses candidats gold ; un mixed intent
référence toutes ses composantes. `scenarioFamilyId` regroupe en plus les
variantes d’un même besoin, y compris les cas sans réponse publiée. Une famille
de scénario appartient à un seul split.

Une requête devient plusieurs paires uniquement après application du retriever
gelé. Le dataset conserve à la fois le cas requête, nécessaire aux métriques
finales, et les paires, nécessaires à l’apprentissage.

### Composition verrouillée

Le plan comporte au minimum 1 680 cas requête avant expansion en paires :

| split | covered | notCovered | ambiguous | total cible |
|---|---:|---:|---:|---:|
| train | 450 | 300 | 150 | 900 |
| development | 80 | 80 | 80 | 240 |
| calibration | 80 | 80 | 80 | 240 |
| holdout final | 100 | 100 | 100 | 300 |

Les comptes train/development/calibration sont des minima ; le holdout contient
exactement 300 cas. Les comptes désignent le gold system-level ; ils ne
définissent pas la distribution des paires. Les
batches d’entraînement peuvent être équilibrés par label de paire et difficulté
afin que les nombreux hard negatives ne rendent pas `notCovered` artificiellement
dominant. Le développement et la calibration conservent des lectures macro par
classe et par catégorie, sans rééchantillonnage après un run.

Chaque split doit couvrir explicitement :

- paraphrases naturelles, synonymes, `differentVocab` et formulations
  `adjacentButResolvable` pour les cas `covered` ;
- hard negatives, collisions lexicales, demandes proches mais non publiées,
  prémisses fausses et demandes clairement hors corpus pour `notCovered` ;
- mixed intents explicitement non couverts par une Q+A unique pour `notCovered` ;
- références sous-spécifiées et interprétations concurrentes réelles pour
  `ambiguous`.

Pour le holdout, `primaryQueryType` est mutuellement exclusif et ses comptes
sont verrouillés afin que chaque pourcentage ait un dénominateur utile :

- parmi les 100 `covered` : 25 paraphrases naturelles, 20 synonymes,
  25 `differentVocab`, 20 `adjacentButResolvable` et 10 autres cas de robustesse ;
- parmi les 100 `notCovered` : 25 mixed intents non couverts par une Q+A unique,
  20 hard negatives, 15 collisions lexicales, 15 `nearButUnpublished`,
  15 prémisses fausses et 10 demandes clairement hors corpus ;
- parmi les 100 `ambiguous` : 40 références sous-spécifiées, 35 interprétations
  concurrentes entre connaissances publiées et 25 lectures d’intention
  alternatives.

Des tags secondaires peuvent se chevaucher, mais ne changent jamais ces
dénominateurs primaires. Les langues et niveaux de risque sont des strates
orthogonales réparties dans les trois outcomes.

Les cas dangereux sont sur-échantillonnés dans calibration et holdout selon les
quotas verrouillés plus bas. La gravité ne dépend ni de la confiance ni du score
du modèle : elle est annotée avant le run selon les conséquences d’une réponse
projet incorrecte.

### Distribution d’apprentissage et distribution d’évaluation

L’équilibrage du train est un outil d’optimisation : sampling, pondération des
classes et ratio positifs/hard negatives peuvent compenser la fréquence des
paires. Ces choix sont limités au train et préenregistrés ; ils ne changent ni
les comptes ni les poids des jeux d’évaluation.

Le même holdout immuable de 300 requêtes donne deux lectures :

1. une lecture macro, primaire, où les trois outcomes et chaque catégorie
   obligatoire ont le même poids indépendamment de leur fréquence ;
2. une lecture pondérée par un inventaire de scénarios d’usage approuvé avant la
   rédaction du holdout, avec les poids inscrits dans son manifeste scellé.

La vue pondérée est secondaire : elle ne peut masquer ni remplacer un critère
par classe, par catégorie ou le veto sécurité. Si aucune distribution cible
défendable ne peut être établie sans collecter de texte utilisateur, la seconde
vue est publiée comme « pondération de scénarios » et non comme mesure
représentative. Les exemples, strates, dénominateurs et poids ne sont jamais
modifiés après ouverture du holdout.

### Faux positif dangereux

Un cas est préannoté `risk: dangerous` lorsqu’une décision positive incorrecte
pourrait raisonnablement conduire l’utilisateur à une action matérielle ou lui
faire tenir pour publiée une information sensible : éligibilité ou droit,
paiement/prix, échéance, accès, sécurité, confidentialité, engagement
contractuel, ou instruction opérationnelle à conséquence difficilement
réversible. Une simple réponse hors sujet sans conséquence plausible est
`weak` ou `medium`, pas `dangerous`.

Un `dangerousFalsePositive` survient si le système retourne
`covered(entryId)` sur un cas `dangerous` alors que :

- le gold system-level est `notCovered` ou `ambiguous` ; ou
- le gold est `covered(expectedEntryId)` mais le système retourne un candidat
  d’un autre groupe d’équivalence dont la réponse déclenche le risque annoté.

Retourner un membre non préféré du bon groupe reste une erreur système par
rapport au contrat déterministe, mais n’est pas un `dangerousFalsePositive` si
l’équivalence métier du groupe est valide : le contenu de réponse est alors
substantiellement interchangeable. Cette erreur est publiée séparément.

Le futur holdout de 300 cas contient au minimum 60 opportunités dangereuses :
au moins 30 `notCovered`, 20 `ambiguous` et 10 `covered` présentant un risque de
mauvais `entryId`. Cette attribution et ces comptes sont scellés avant le run.
Le rapport affiche le numérateur et le dénominateur exacts, par exemple `0/60`,
la répartition par catégorie de risque et la borne supérieure unilatérale à
95 % du taux binomial. `0 dangerous FP` reste un veto absolu ; il n’est jamais
présenté sans son dénominateur. Avec exactement 60 cas et zéro événement, cette
borne vaut environ 4,9 % (`1 - 0,05^(1/60)`) : le résultat satisfait le veto,
mais ne constitue pas une preuve de risque nul en production.

### Construction des hard negatives

Pour chaque positif, les négatifs difficiles proviennent en priorité des Q&A
voisines remontées par les retrievers gelés : même thème, vocabulaire proche,
réponse voisine ou détail partiellement partagé. La Q+A correcte est ajoutée
explicitement même en cas de miss du retriever afin de distinguer apprentissage
pairwise et échec de retrieval.

Règles :

- au moins deux hard negatives voisins par positif d’entraînement ;
- pour les requêtes `notCovered`, plusieurs candidats proches sont annotés
  `notCovered`, notamment le candidat qui pourrait provoquer le faux positif ;
- pour les ambiguïtés, au moins deux candidats concurrents sont annotés
  `covered` parce que chacun est une réponse complète sous une interprétation
  raisonnable différente, et ils appartiennent à des groupes d’équivalence
  différents ;
  plusieurs candidats couverts du même groupe ne suffisent jamais à créer une
  ambiguïté ; les autres candidats restent `notCovered` ;
- les négatifs aléatoires faciles ne dépassent pas 20 % des paires négatives ;
- aucun candidat appartenant à un cluster réservé au holdout ne peut être utilisé
  dans train, development ou calibration.

## Séparation stricte des données

### Partition par familles de connaissance

Une séparation par formulation seule serait contaminée : plusieurs Q&A
Équinoxe sont voisines. Le manifeste d’équivalence, puis la partition, sont donc
terminés et scellés **avant toute génération de requête**.

Les 112 entrées deviennent les nœuds d’un graphe de connaissances. Une arête
relie deux entrées qui partagent le même fait publié, une réponse quasi dupliquée,
une relation généralisation/spécialisation, une même règle métier ou une famille
sémantique telle qu’une paraphrase raisonnable pourrait viser les deux. Les
composantes connexes forment les `knowledgeClusterId`. Deux annotateurs métier
construisent ce graphe indépendamment ; tout désaccord est arbitré avant la
partition. Un contrôle automatique de proximité textuelle et sémantique sert à
signaler des arêtes oubliées, jamais à séparer automatiquement un cluster.

Les clusters entiers sont ensuite attribués irrévocablement aux splits. Une
cible initiale est 60/20/16/16 entrées ou équivalent par clusters pour
train/development/calibration/holdout, mais l’intégrité des clusters prévaut sur
ces nombres. Le manifeste entrée → cluster → split et son SHA-256 sont gelés
avant que les auteurs reçoivent les connaissances de leur split.

Tous les membres d’un même `answerEquivalenceGroupId` appartiennent au même
`knowledgeClusterId` et au même split. Le manifeste de partition référence le
fingerprint du manifeste d’équivalence ; il est invalide si un groupe traverse
deux clusters ou deux splits.

Les contraintes de répartition sont :

- aucun `knowledgeClusterId`, `scenarioFamilyId`, `entryId`, patron de requête
  ou lot d’auteur ne traverse deux splits ;
- aucun `answerEquivalenceGroupId` ne traverse deux clusters ou deux splits ;
- aucune quasi-duplication de connaissance, famille sémantique proche,
  relation parent/enfant ou variante d’une même règle ne traverse deux splits ;
- les thèmes, types et difficultés restent stratifiés ;
- le holdout comporte des connaissances jamais utilisées pour entraîner la tête
  de classification, afin de tester la généralisation à une nouvelle publication
  fournie dans l’entrée Q+A ;
- l’index d’entraînement exclut physiquement les clusters holdout, afin qu’ils ne
  deviennent jamais des négatifs implicites.

Tout cas impliquant plusieurs connaissances n’est admissible que si tous ses
`sourceKnowledgeClusterIds` appartiennent au même split. Les connaissances qui
peuvent raisonnablement devenir des réponses concurrentes sont reliées dans le
graphe initial afin d’être partitionnées ensemble. Les hard negatives hors
corpus et `nearButUnpublished` sont eux aussi assignés à un
`scenarioFamilyId` avant rédaction ; leurs variantes ne peuvent donc pas être
réparties entre train et holdout.

Les formulations sont générées seulement après cette affectation, avec des
auteurs isolés par split. La déduplication inter-splits est un filet de sécurité
postérieur ; elle ne remplace jamais la partition préalable des connaissances.
Si elle révèle une proximité non prévue, les entrées concernées sont réunies
dans le même cluster et toute formulation déjà écrite pour elles est supprimée
avant collecte. Aucune entrée ni formulation n’est déplacée en réaction aux
résultats d’un modèle.

Un second diagnostic development, non décisionnel, peut mesurer la
généralisation à de nouvelles formulations de connaissances déjà vues. Il ne se
substitue pas au holdout final par clusters inconnus.

### Usage des anciens corpus et erreurs

Les 320 cas officiels, les 200 cas Decision, le holdout NLI et toutes les erreurs
publiées sont désormais observés. Ils peuvent uniquement :

- alimenter train, development ou calibration après attribution par cluster ;
- fournir des patrons de hard negatives et une taxonomie de risques ;
- servir de regression benchmark secondaire, jamais de preuve finale.

Chaque réutilisation porte une provenance `priorSpike`. Aucun ancien holdout ne
peut être rebaptisé holdout de la nouvelle famille. Les formulations observées,
leurs quasi-doublons et leurs traductions sont interdites dans le futur holdout.

### Ordre de gel

L’ordre suivant est obligatoire et auditable :

1. approbation et scellement du présent protocole, incluant définitions, quotas,
   métriques, seuils de succès et budgets de portabilité ;
2. construction, double revue puis scellement du manifeste
   `entryId → answerEquivalenceGroupId → preferredEntryId` ;
3. construction puis scellement des clusters et de leur partition, sans couper
   un groupe d’équivalence ;
4. seulement ensuite, rédaction des jeux train/development/calibration ;
5. choix d’une short-list conforme aux contraintes déjà gelées ;
6. entraînement, sélection sur development et calibration selon le budget fixé ;
7. rédaction indépendante du holdout avec les manifestes déjà gelés ;
8. gel de la configuration gagnante, puis unique ouverture du holdout.

Toute modification d’un critère, quota, poids, règle d’agrégation, budget ou
définition après l’étape 1 crée une nouvelle version du protocole. Elle exige un
nouveau holdout vierge et ne peut pas réinterpréter un résultat déjà observé.

### Holdout final réellement vierge

Le futur holdout n’est pas écrit dans ce chantier. Aucun exemple ni brouillon
n’est inclus dans ce document.

Il est constitué ultérieurement par un curateur qui ne participe ni à
l’entraînement ni au tuning. Jusqu’au passage final :

1. les ingénieurs ne reçoivent que le schéma, les comptes par classe/type et le
   SHA-256 d’un artefact chiffré ;
2. le texte reste hors du working tree et inaccessible au processus de training ;
3. le runner de calibration ne sait ni importer ni déchiffrer le holdout ;
4. un évaluateur séparé injecte l’artefact une seule fois après gel complet ;
5. le résultat est marqué `holdoutPasses: 1` et signé avec le fingerprint du
   dataset, du modèle, du tokenizer, du retriever, de l’index et du runner.

Le manifeste scellé contient avant rédaction : les 100/100/100 outcomes, les
minima par catégorie, les 60 opportunités dangereuses minimales, la méthode de
pondération secondaire et tous les dénominateurs attendus. Les textes ne sont
créés qu’ensuite par le curateur indépendant à partir des seuls clusters holdout.

Le holdout peut recevoir un premier scellement technique — fingerprint du
plaintext, chiffrement authentifié, checksum du ciphertext et isolation hors du
working tree — avant les revues humaines. Son état obligatoire reste alors
`PENDING_HUMAN_REVIEW`; il ne peut être ouvert par le training, la sélection de
modèle ou la calibration. Les paquets de revue sont dérivés de cette version
sans output modèle. Après adjudication, toute correction produit une nouvelle
version scellée avec filiation explicite vers la précédente ; aucune version
antérieure ni aucun jugement initial n’est écrasé. Seul l’état
`SEALED_READY_FOR_ONE_TIME_EVALUATION`, obtenu après les deux revues et
l’adjudication, autorise l’unique passage final.

Un échec clôt l’expérience. Toute nouvelle architecture ou modification après
lecture des erreurs exige un nouveau holdout vierge ; l’ancien devient un corpus
observé de développement.

## Annotation et Quality Gate

Chaque cas calibration/holdout est écrit par une personne et revu à l’aveugle
par deux humains indépendants :

- Reviewer A : Vivien ;
- Reviewer B : humain désigné ultérieurement, de préférence familier du domaine
  workplace/change et n’ayant vu ni les labels ni les décisions de Reviewer A.

Deux paquets de revue séparés sont produits à partir du même fingerprint de
dataset. Ils emploient deux ordres randomisés différents, enregistrés dans leurs
manifestes respectifs. La randomisation ne change jamais le contenu et reste
reproductible à partir d’un seed conservé par le curateur ; seul le hash du seed
figure dans le paquet. Aucun paquet ne contient output modèle, score,
probabilité, suggestion automatique, gold proposé, décision de l’autre reviewer
ou information sur son avancement.

Chaque paquet fournit uniquement les informations métier nécessaires : texte de
la requête, Q+A candidates, identifiants de revue aveugles, contexte publié
strictement requis et définitions de la grille. Les identifiants de split, les
labels préremplis et l’ordre du dataset source sont masqués. La grille est
strictement identique pour les deux reviewers et leur demande, sans valeur par
défaut, de statuer sur :

1. `covered | notCovered` pour chaque paire candidate-level ;
2. l’équivalence métier entre entrées et les groupes qui en résultent ;
3. le `preferredEntryId` de chaque groupe selon la règle préenregistrée ;
4. le gold système `notCovered | covered(preferredEntryId) | ambiguous` ;
5. le statut `dangerousFalsePositiveOpportunity: true | false` et sa catégorie
   de conséquence.

Les réponses A et B sont enregistrées dans deux artefacts append-only distincts,
fingerprintés et horodatés. Un reviewer n’accède jamais à l’autre paquet rempli.
L’accord requis est total sur les labels de paire, la partition en groupes, le
`preferredEntryId`, le gold système et le marquage dangereux. Après réception
des deux réponses, une phase d’adjudication produit un registre de désaccords
contenant : jugement A immuable, jugement B immuable, décision arbitrée, auteur
de l’arbitrage et justification. Aucun jugement initial n’est réécrit
silencieusement. Un cas non résolu est retiré et remplacé avant scellement final,
avec reprise des deux revues pour son remplaçant.

Le Quality Gate humain reste `PENDING_HUMAN_REVIEW` tant que Reviewer A et
Reviewer B n’ont pas terminé et que tous les désaccords ne sont pas adjudiqués.
Il est interdit de le déclarer accompli sur la base de contrôles automatiques ou
d’une revue par un agent.

Contrôles automatiques avant scellement :

- unicité des IDs et des formulations normalisées ;
- absence de doublon exact, edit-distance proche, n-gram fortement partagé et
  voisin sémantique suspect entre splits, suivie d’une revue humaine ;
- absence de traduction ou de paraphrase d’un cas observé ;
- existence de tous les `expectedEntryId` dans le snapshot autorisé ;
- chaque `entryId` du snapshot apparaît dans exactement un groupe d’équivalence
  et aucun `entryId` n’apparaît dans plusieurs groupes ;
- chaque groupe est non vide et possède un unique `preferredEntryId` valide,
  membre du groupe ;
- aucune formulation qui contient involontairement la réponse ;
- cohérence `expectedSystemOutcome`, `expectedEntryId`,
  `goldCoveredCandidateIds`, `goldCoveredAnswerEquivalenceGroupIds`,
  `sourceKnowledgeClusterIds`, `scenarioFamilyId`, intentions et labels binaires
  de paire ;
- égalité stricte entre `goldCoveredAnswerEquivalenceGroupIds` déclaré et
  l’ensemble dédupliqué des groupes des `goldCoveredCandidateIds` ;
- `notCovered` si cet ensemble est vide, `covered(preferredEntryId)` s’il
  contient un groupe, et `ambiguous` uniquement s’il contient au moins deux
  groupes substantiellement différents ;
- absence de faux `ambiguous` lorsque tous les candidats couverts appartiennent
  au même `answerEquivalenceGroupId` ;
- cohérence du groupe déclaré pour chaque paire avec le manifeste d’équivalence ;
- quotas par classe, type, risque, langue, cluster et lot d’auteur ;
- fingerprint stable du corpus, du manifeste d’équivalence et du manifeste de
  partition.

Le corpus principal français est complété par des cas anglais, néerlandais et
espagnols distribués dans chaque split et annotés nativement. Les traductions
mécaniques d’un même cas ne doivent jamais être réparties entre splits.

## Training et sélection sans holdout

Après scellement des critères et avant le premier entraînement, un plan
d’exécution dérivé enregistre : seeds, budget maximal d’essais, familles
abstraites autorisées, stratégie de sampling, longueur maximale, early stopping
et fonction d’objectif. Ce plan peut restreindre l’espace d’essai, mais ne peut
modifier aucun critère ou quota du présent protocole.

- `train` ajuste les paramètres ;
- `development` choisit architecture et hyperparamètres ;
- `calibration` ajuste uniquement la calibration probabiliste et la règle de
  décision préenregistrée ;
- le holdout ne sert ni à sélectionner, ni à recalibrer, ni à expliquer une
  relance.

Les probabilités candidate-level `covered` et `notCovered` sont conservées. La
calibration peut utiliser une méthode binaire bornée et préenregistrée, par
exemple temperature scaling, mais aucune règle ne peut être ajoutée après
observation du holdout. La sélection privilégie d’abord zéro faux positif
dangereux en calibration, puis le recall exact `covered`, `ambiguous` et
`notCovered`. Le nombre total d’essais est publié afin de rendre visible le
risque de surapprentissage au development set.

## Mesures obligatoires

Le rapport conserve trois niveaux sans les fusionner :

1. **candidate-level** : matrice de confusion binaire, précision/recall/F1 de
   `covered`, Brier score, ECE et courbes sur les paires effectivement fournies ;
2. **group-level** : précision/recall des
   `answerEquivalenceGroupId` couverts, nombre de groupes gold/prédits et taux de
   collapse correct des multiples `entryId` équivalents ;
3. **system-level** : décision exacte
   `notCovered | covered(preferredEntryId) | ambiguous` après agrégation.

Les métriques end-to-end principales sont calculées au niveau requête, en lecture
macro et selon la pondération secondaire préenregistrée :

- recall exact et précision de `covered(entryId)`, `notCovered` exact,
  `ambiguous` exact, accuracy et matrice de confusion ;
- résultats séparés paraphrase, synonymes, `differentVocab`, adjacent
  resolvable, hard negatives, mixed intents et ambiguïtés réelles ;
- faux positifs faibles/moyens/dangereux, avec numérateur, dénominateur et
  exemples audités ;
- sur-abstention : gold `covered(entryId)` rendu `notCovered` ou `ambiguous` ;
- match vers le mauvais groupe ou vers un `entryId` différent du
  `preferredEntryId` préenregistré ;
- diagnostic de calibration candidate-level : Brier score, ECE et courbes ;
- latence CPU bout-en-bout mean/p50/p95 pour Top-3 et Top-5 ;
- cold start processus et cold start disque documentés séparément ;
- RAM au repos, modèle chargé et pic ; taille effective, checksum et licence de
  l’artefact packagé.

### Attribution retrieval / classifier / agrégation

Pour chaque requête et chaque K, l’oracle applique l’agrégateur aux labels gold
des seules paires récupérées. Une erreur end-to-end reçoit exactement une cause,
dans cet ordre :

1. `retrievalMiss` : l’agrégateur oracle ne peut pas produire le gold system-level
   avec le Top-K fourni. Pour `covered`, aucun candidat du groupe gold unique
   n’est présent ; pour `ambiguous`, au moins un groupe gold concurrent n’est
   représenté par aucun candidat. Un cas `notCovered`, dont l’ensemble de groupes
   gold est vide, n’est jamais un retrieval miss ;
2. `candidatePresentButClassifierError` : le Top-K est suffisant selon l’oracle,
   mais au moins une prédiction binaire erronée change la décision finale ;
3. `aggregationError` : le Top-K est suffisant et les labels binaires prédits
   correspondent aux labels gold des paires et les groupes sont corrects, mais
   l’implémentation de la règle zéro/un/plusieurs groupes produit tout de même un
   mauvais outcome ou un autre `entryId` que le `preferredEntryId`.

La troisième catégorie devrait être nulle ; elle détecte un défaut de règle,
d’annotation ou d’implémentation. Le rapport publie Recall@3/Recall@5 du
retriever, métriques pairwise conditionnelles sur les candidats effectivement
présents, métriques group-level, exactitude de l’agrégateur oracle et résultat
end-to-end. Une requête
classée `retrievalMiss` est exclue des dénominateurs d’erreur du classifieur ; une
erreur du classifieur n’est pas comptée comme échec du retriever.

Toutes les mesures de performance utilisent le même matériel, le même nombre de
threads, le même batch plan et les mêmes artefacts offline.

## Critères de succès verrouillés

Les critères ci-dessous sont préenregistrés par cette revue, avant choix de
modèle, entraînement et rédaction/ouverture du holdout. Ils ne sont plus
« proposés » et ne peuvent être assouplis pour qualifier un candidat :

- recall exact `covered(entryId)` ≥ 75 % ;
- `notCovered` exact ≥ 85 % ;
- `ambiguous` exact ≥ 75 % et au moins 95 % sans match arbitraire ;
- paraphrases couvertes ≥ 75 % ;
- synonymes couverts ≥ 75 % ;
- `differentVocab` couvert ≥ 50 % ;
- `adjacentButResolvable` couvert exactement ≥ 75 % ;
- mixed intents avec outcome exact ≥ 85 % ;
- zéro `dangerousFalsePositive` sur au moins 60 opportunités dangereuses, avec
  résultat publié sous la forme `0/D` et borne supérieure à 95 % ;
- faux positifs totaux sur les gold `notCovered` ≤ 15 % ;
- sur-abstention sur les gold `covered` ≤ 25 % ;
- aucune catégorie obligatoire ni langue ne peut être absente du rapport.

Critères de portabilité sur la machine CPU de référence à six threads, runtime
offline et batch plan identiques :

- Top-3 bout-en-bout p95 ≤ 180 ms et Top-5 p95 ≤ 250 ms ; mean et p50 sont aussi
  publiés pour les deux K ;
- RAM pic du processus complet ≤ 1 Gio ;
- cold start disque, poids non présents dans le cache OS, ≤ 5 s ;
- artefact complet effectif ≤ 500 Mio ;
- licence explicitement compatible avec l’usage commercial envisagé ;
- package autonome vérifié offline, sans téléchargement, accès réseau ni
  `trust_remote_code`, avec tokenizer, runtime, modèle, révision, checksum,
  licence et SBOM.

Chaque ligne est évaluée séparément sur le holdout scellé. La vue pondérée ne
peut compenser l’échec d’un critère macro, catégoriel, de sécurité ou de
portabilité. Un seul faux positif dangereux ou l’échec d’un critère obligatoire
interdit toute recommandation Liquid Core V0.

## Contraintes de modèle — sans choix à ce stade

Tout candidat futur doit être :

- multilingue et suffisamment compact pour le CPU ;
- utilisable entièrement offline, sans `trust_remote_code` ni téléchargement au
  runtime ;
- sous licence compatible avec l’usage commercial envisagé ;
- exportable et packagable avec tokenizer, runtime, révision, checksum, licence
  et SBOM ;
- reproductible avec seeds, versions logicielles et empreinte matérielle.

Aucun candidat n’est retenu dans ce document. Une short-list séparée devra être
approuvée avant l’entraînement, sur ces critères et non sur le futur holdout.

## Risques de contamination et safeguards

| risque | safeguard |
|---|---|
| proximité thématique prise à tort pour une équivalence métier | critère d’interchangeabilité stricte, justification par groupe et double revue humaine avant formulation |
| entrées équivalentes comptées comme ambiguïté | agrégation sur les groupes dédupliqués et Quality Gate `FALSE_AMBIGUOUS_SINGLE_GROUP` |
| connaissance, quasi-duplication ou famille sémantique répartie entre splits | graphe métier et partition des clusters avant toute formulation ; intégrité du cluster prioritaire |
| négatif hors corpus ou mixed intent décliné dans plusieurs splits | `scenarioFamilyId` unique et liste exhaustive des clusters sources avant rédaction |
| ancien holdout réutilisé comme preuve | provenance `priorSpike`, usage limité aux splits observés |
| hard negative issu d’un cluster holdout | index et générateur de candidats physiquement séparés par split |
| traduction ou paraphrase transversale | déduplication multilingue automatique puis revue humaine |
| tuning indirect sur le holdout | artefact chiffré, évaluateur séparé, export impossible depuis le runner de training |
| contamination entre reviewers | paquets sans gold ni output modèle, ordres distincts, sorties append-only séparées et absence d’accès aux décisions de l’autre reviewer |
| adjudication effaçant les désaccords | registre conservant les deux jugements initiaux, la décision arbitrée, son auteur et sa justification |
| multiplication silencieuse des essais | budget d’essais et registre des runs préenregistrés |
| label appris via artefact ou ID | IDs neutralisés à l’entrée ; seul le texte query/Q+A est encodé |
| réponse partielle confondue avec couverture | règle « totalité de la demande » et double annotation des mixed intents |
| moyenne masquant un faux positif critique | veto absolu sur tout faux positif `dangerous` |
| benchmark performant mais non portable | budgets CPU/RAM/cold start/taille et artefact offline vérifiés avant recommandation |
| backbone préentraîné sur des textes projet | provenance et jeux d’entraînement documentés avant sélection ; candidat exclu en cas d’exposition projet connue |

## Condition de recommandation

Aucune conclusion produit ne peut provenir de train, development, calibration,
des anciens benchmarks ou d’un sous-ensemble du holdout. Une architecture ne
devient recommandable pour Liquid Core V0 que si sa configuration entièrement
gelée passe en une fois le nouveau holdout vierge, simultanément sur la qualité,
la sécurité et la portabilité CPU.
