# Revue humaine structurelle Storm Match — mode d’emploi

## Statut et périmètre

Ces paquets évaluent uniquement la structure préalable au futur corpus. Ils ne
contiennent aucune formulation utilisateur, aucun gold, aucune sortie modèle et
aucun `scenarioFamilyId` attribué.

- Quality Gate automatique : `STRUCTURAL_OK` ;
- Quality Gate métier : `PENDING_HUMAN_REVIEW` ;
- `generationAuthorized: false` ;
- structure :
  `7645715532702ea42599151243126e63abcfcb6015ad711673d9e12111da361e` ;
- composition :
  `2951ff970fe1e274e9ed250e25dfef95a6d9425a900b8f8b09e086d2cef5a652`.

Le contenu est entièrement en français. La personne affectée à un rôle doit
attester sa compétence en français et ne peut jamais tenir A et B pour le même
lot.

## Distribution aveugle

Le répertoire `generated-structural-review/reviewer-a/` est remis uniquement au
Reviewer A. Le répertoire `reviewer-b/` est remis uniquement au Reviewer B.
Chaque rôle reçoit quatre fichiers dans un ordre distinct et reproductible :

| paquet | items | connaissances affichées |
|---|---:|---:|
| équivalence et préféré | 5 | 11 |
| frontières métier | 4 | 51 |
| familles candidates d’ambiguïté | 34 | 82 |
| préflight des familles de scénario | 34 | 82 |

Ne jamais distribuer `curator-only/`, l’autre répertoire reviewer ou l’autre
journal de réponses. Le dossier `curator-only/` contient uniquement les
liaisons entre références aveugles et IDs de fixture nécessaires à
l’adjudication. Il ne contient aucun jugement.

Les fichiers sous `responses/reviewer-a/` et `responses/reviewer-b/` sont des
journaux séparés, initialement vides (`events: []`). Un reviewer travaille sur
une copie de son propre journal seulement. Chaque décision ajoutée doit être un
nouvel événement ; une correction ajoute un événement de remplacement et ne
supprime ni ne modifie jamais l’événement initial.

Le générateur ne possède ces journaux que pendant leur amorçage : il crée un
journal vide uniquement si le chemin attendu n’existe pas encore. Une
matérialisation ultérieure préserve tout journal existant, et `--check` en
vérifie seulement l’existence et la liaison au paquet sans exiger qu’il soit
resté vide. Les paquets, liaisons curator-only et manifestes structurels restent
les sorties déterministes régénérables ; les journaux et seals sont des
artefacts persistants du workflow humain.

## Décisions attendues

### 1. Equivalence et `preferredEntryId`

Pour chacun des cinq items :

1. partitionner les Q&A en un groupe substantiellement équivalent ou plusieurs
   groupes non équivalents ;
2. justifier la décision par l’interchangeabilité réelle des réponses métier ;
3. seulement pour chaque groupe multi-entry confirmé, choisir une connaissance
   préférée parmi les références affichées ;
4. justifier ce choix selon la règle : Q+A la plus explicite et autonome sans
   élargissement de portée, puis rang de départage uniquement en cas d’égalité
   stricte.

Le rang de départage n’est ni une recommandation ni une sélection automatique.

### 2. Frontières métier

Pour chacune des quatre frontières :

1. décider `sameConnectedComponent`, `separateComponents`,
   `partitionRequired` ou `insufficientEvidence` ;
2. proposer la partition exacte lorsque nécessaire ;
3. documenter les critères métier qu’une future formulation devrait remplir
   pour être couverte, non couverte ou réellement ambiguë.

Aucun gold de cas ne doit être créé : aucune formulation utilisateur n’existe.

### 3. Familles candidates d’ambiguïté

Pour chacun des 34 briefs :

1. choisir `structuralAmbiguity`, `notCovered`, `artificialOrMalformed`,
   `blockedTemporalInstability` ou `insufficientEvidence` ;
2. si `structuralAmbiguity`, sélectionner exactement un mécanisme :
   `underspecifiedReference`, `competingPublishedKnowledge` ou
   `alternativeIntentReadings` ;
3. identifier les groupes de réponses substantiellement différents qui seraient
   en concurrence ;
4. fournir une justification métier.

q039 et toute décision dépendant de la date exacte des casiers sont exclues.

### 4. Préflight `scenarioFamilyId`

Les 34 briefs disponibles sont les candidats d’ambiguïté, utilisés comme
premier échantillon de consolidation. Chaque reviewer doit :

1. créer sa propre partition en situations utilisateur/métier distinctes ;
2. signaler les briefs à fusionner, trop larges, artificiellement fragmentés ou
   insuffisamment documentés ;
3. ne chercher à atteindre ni 254 ni un autre nombre cible.

La cible 250–260 concerne le futur inventaire complet. Elle n’est pas une
réponse attendue dans ce paquet.

## Enregistrement et adjudication

Chaque événement de réponse comporte au minimum :

- un identifiant d’événement stable et une séquence croissante ;
- le `reviewItemRef` du paquet ;
- le `decisionType`, la valeur choisie et la justification ;
- l’identité humaine, l’attestation de compétence linguistique et l’horodatage ;
- le hash de l’événement précédent et le hash du nouvel événement.

Les deux soumissions sont scellées séparément. L’adjudication commence seulement
après réception des deux versions scellées. Elle conserve les jugements A et B
originaux et ajoute toute décision arbitrée dans le registre append-only déjà
prévu par le protocole.

## Limites impossibles à trancher maintenant

- Les frontières `covered/notCovered/ambiguous` peuvent être décrites comme
  règles métier, mais aucun label de cas n’est possible sans formulation.
- Le préflight couvre uniquement les 34 candidats d’ambiguïté ; il ne valide pas
  la capacité globale de 250–260 familles.
- La séparation abusive de paraphrases, traductions, hard negatives, collisions
  lexicales et mixed intents ne pourra être testée empiriquement qu’après
  création d’un inventaire de briefs neutres, toujours avant leur rédaction en
  formulations utilisateur.
- La date exacte des casiers reste bloquée jusqu’à adjudication de provenance.

Aucun de ces paquets ne peut faire évoluer automatiquement
`generationAuthorized`.

## Journal append-only dédié à la revue structurelle

`structural-review-response-log.js` implémente le protocole de réponse des
quatre paquets structurels. Il est volontairement séparé de
`review-response-log.js`, qui reste réservé aux décisions query-level
`candidateDecision`, `answerEquivalenceGroup`, `systemOutcome` et
`dangerousFalsePositiveOpportunity`. Les deux journaux ne partagent ni leurs
enums ni leur format d'événement.

Deux niveaux d'API sont volontairement distincts :

- `constructStructuralReviewLogWithEvent` est une primitive pure en mémoire.
  Elle construit et valide une nouvelle valeur de journal mais n'autorise
  aucune écriture persistante et ne constitue donc jamais une preuve qu'un
  artefact est encore appendable ;
- `appendStructuralReviewEvent` est le chemin public pour les artefacts
  persistés. Il reçoit obligatoirement les chemins du journal et du paquet,
  dérive lui-même le chemin fixe `structural-reviewer-seal.json` dans le
  répertoire Reviewer et vérifie ce fichier avant toute construction ou
  écriture. Il n'accepte aucun argument optionnel permettant au caller de
  déclarer arbitrairement l'absence de seal.

Un événement structurel contient exactement :

- `eventId`, généré par le mécanisme d'append ;
- `sequence`, avec `1` pour le premier événement puis un incrément de un ;
- `reviewItemRef`, `decisionType`, `decisionValue` et une `rationale` non vide ;
- `reviewerIdentity`, chaîne opaque non vide telle que `reviewer-a`, sans nom ni
  adresse personnelle ;
- `languageCompetenceAttested`, booléen strict ;
- `recordedAt`, horodatage ISO canonique généré lors de l'append ;
- `previousEventHash`, `null` pour le premier événement puis le `eventHash`
  exact de l'événement précédent ;
- `eventHash`.

`eventHash` est le SHA-256 hexadécimal du JSON canonique UTF-8 de l'événement
sans `eventHash`, mais avec `previousEventHash`. Le helper existant
`canonicalJson` trie récursivement les clés des objets et conserve l'ordre des
tableaux ; le hash ne dépend donc jamais de l'indentation du fichier.

Une correction ajoute un nouvel événement avec le même couple
`(reviewItemRef, decisionType)`. Aucun événement précédent n'est modifié ou
supprimé. La décision effective est le dernier événement valide de ce couple ;
l'historique complet reste disponible dans `events`.

### Complétude des quatre paquets

La chaîne et la complétude sont évaluées séparément : un journal peut être
cryptographiquement valide tout en restant incomplet.

- `EQUIVALENCE_AND_PREFERRED` exige
  `substantiveEquivalencePartition`. `preferredEntrySelection` est exigé après
  une partition confirmée `oneEquivalentGroup` ou
  `multipleNonEquivalentGroups`, et ne peut être ajouté avant cette décision de
  phase 1. La rationale reste le support prévu par le paquet pour détailler les
  groupes et les entrées préférées ; le logger ne tente pas d'en interpréter le
  langage naturel.
- `KNOWLEDGE_BOUNDARIES` exige `knowledgeComponentBoundary` et
  `futureCoverageBoundaryRules` pour chaque item.
- `AMBIGUITY_CAPACITY_FAMILIES` exige toujours
  `ambiguityFamilyDisposition`. Si sa décision effective vaut
  `structuralAmbiguity`, `ambiguityMechanism` et
  `substantiallyDifferentCoveredGroups` deviennent également obligatoires.
  Dans les autres cas, ils ne sont pas exigés ; d'anciens événements restent
  néanmoins dans l'historique si une correction a changé la disposition.
- `SCENARIO_FAMILY_PREFLIGHT` exige `reviewerScenarioFamilyPartition` et
  `fragmentationAssessment` pour chaque item.

Le contrat des `decisionType`, des `allowedValues` et des conditions doit
correspondre exactement aux quatre versions connues. Toute condition future ou
inconnue échoue fermement au lieu d'être interprétée librement.

### Seal Reviewer structurel

Le seal est un manifeste séparé : il ne modifie ni le journal ni les événements.
`createStructuralReviewerSeal` refuse tout journal invalide, incomplet, lié à un
autre paquet ou portant une autre identité Reviewer. Pour chaque paquet, le
manifeste enregistre `packetId`, `packetFingerprint`, chemin du journal, nombre
d'événements, dernier hash de chaîne et SHA-256 du JSON canonique complet du
journal. `sealHash` est le SHA-256 du JSON canonique du manifeste sans
`sealHash`.

`persistStructuralReviewerSeal` écrit le manifeste sous le nom fixe
`structural-reviewer-seal.json`, directement dans le même répertoire que les
journaux qu'il couvre. L'API publique d'append dérive et charge toujours ce
chemin : si le seal est valide et couvre le paquet, l'append est refusé ; si le
fichier de seal existe mais est invalide ou altéré, l'append échoue fermement au
lieu de considérer le journal comme non scellé. Omettre un manifeste dans
l'appel n'est pas un chemin possible de l'API persistante. Aucun workflow de
correction post-seal n'est défini en V0.

Les réponses peer ne sont jamais chargées automatiquement : un travail sur A
reçoit uniquement le paquet, le journal et, le cas échéant, le seal de A. La
comparaison A/B et l'adjudication restent des étapes séparées après les deux
seals.

Enfin, les états restent strictement distincts :

- `complete` signifie que la chaîne est valide et que toutes les décisions
  actuellement requises sont présentes ;
- `sealed` signifie qu'un manifeste valide fige cryptographiquement ce journal ;
- ni l'un ni l'autre ne valide un gold, la qualité métier globale ou le futur
  holdout ;
- `generationAuthorized` reste `false` jusqu'à une décision ultérieure et n'est
  jamais modifié par ce logger ou par un seal Reviewer.
