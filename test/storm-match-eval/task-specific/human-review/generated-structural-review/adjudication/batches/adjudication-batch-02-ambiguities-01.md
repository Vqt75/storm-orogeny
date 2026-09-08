# Adjudication structurelle — Batch 02 : ambiguïtés 01

- Batch : `adjudication-batch-02-ambiguities-01`
- Matrice source : `2661f9530fc20272043a621cfbf43b836e883522cdc7dfae861e4a58e2db21dd`
- Seal Reviewer A : `79ea358a594c5b91eee9e5fe453582cb515f11d542571816981b2b2155fde5a8`
- Seal Reviewer B : `3b24eefdf1b200fc94ebbd83003a796aa3fc1593d55efbbf0a4cf86749438549`
- Statut : `PENDING_HUMAN_REVIEW`
- Autorisation de génération : `false`
- Adjudication effectuée : `false`
- Items : 10

## Doctrine de revue

- Liquid Core évalue l’answerability et le retrieval à partir du contenu publié.
- Liquid Core ne génère aucune vérité projet.
- Une formulation peut relever d’une ambiguïté structurelle avec alternatives, être sous-spécifiée, mettre en concurrence plusieurs connaissances, être artificielle ou manquer de preuves suffisantes.
- L’arbitrage humain doit établir la structure de vérité nécessaire à la future génération du corpus.
- `generationAuthorized` reste `false`.

> Les artefacts sources ne contiennent encore ni formulation utilisateur générée ni `scenarioFamilyId`. Chaque section restitue donc la famille candidate, son contexte métier source et ses Q&A canoniques, sans compléter ces absences.
> Aucune des entries de ce batch ne relève des groupes d’équivalence ou sélections `preferredEntryId` déjà scellés dans le Batch 01.
> Ce paquet ne contient aucune adjudication : les blocs de décision restent explicitement à `PENDING`.

## 1. ambiguity-capacity-01 — Famille candidate 01

### Identification

- Item canonique : `ambiguity-capacity-01`
- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- Famille source : Famille candidate 01
- Formulation source disponible — contexte métier : Permanence du poste, position quotidienne et quartier stable
- `scenarioFamilyId` : non attribué dans les artefacts sources.

### Reviewer A

- Classification : `structuralAmbiguity`
- Mécanisme : `alternativeIntentReadings`
- Groupes couverts substantiellement différents :
  - Groupe 1 : `equinoxe-q010`, `equinoxe-q012`, `equinoxe-q015`
  - Groupe 2 : `equinoxe-q014`

Rationales Reviewer A :

- `ambiguityFamilyDisposition`

> Stabilité du quartier d’équipe et permanence ou choix quotidien du poste sont distincts.

- `ambiguityMechanism`

> Mécanisme retenu : alternativeIntentReadings. Stabilité du quartier d’équipe et permanence ou choix quotidien du poste sont distincts.

- `substantiallyDifferentCoveredGroups`

> Partition Reviewer : [storm-03-a-knowledge-057] / [storm-03-a-knowledge-075, storm-03-a-knowledge-033, storm-03-a-knowledge-065].

### Reviewer B

- Classification : `structuralAmbiguity`
- Mécanisme : `underspecifiedReference`
- Groupes couverts substantiellement différents :
  - Groupe 1 : `equinoxe-q010`, `equinoxe-q012`, `equinoxe-q015`
  - Groupe 2 : `equinoxe-q014`

Rationales Reviewer B :

- `ambiguityFamilyDisposition`

> Les connaissances distinguent une zone d’équipe stable d’un poste individuel non nominatif et choisi avec flexibilité.

- `ambiguityMechanism`

> Une référence à une place ou une position « stable » est ambiguë si elle ne précise pas quartier d’équipe ou poste individuel.

- `substantiallyDifferentCoveredGroups`

> Partition des groupes de réponses substantiellement différents : G1 stabilité du quartier d’équipe = [storm-03-b-knowledge-076] ; G2 statut et choix du poste individuel au quotidien = [storm-03-b-knowledge-032, storm-03-b-knowledge-073, storm-03-b-knowledge-060].
> Rationale courte : Les groupes conduisent à des réponses métier substantiellement différentes.

### Comparaison A/B

- Statut exact de la matrice : `MECHANISM_DISAGREEMENT`
- Accord de premier niveau : oui
- Accord complet : non
- Dimensions strictement égales : `ambiguityFamilyDisposition.value`, `substantiallyDifferentCoveredGroups.value`, `substantiallyDifferentCoveredGroups.canonicalPartition`
- Dimensions en désaccord consignées par la matrice : `ambiguityMechanism.value` (`MECHANISM_DISAGREEMENT`)

Crosswalk curator-only utilisé :

- Reviewer A : item local `storm-03-a-item-005`
  - `storm-03-a-knowledge-057` → `equinoxe-q014`
  - `storm-03-a-knowledge-065` → `equinoxe-q012`
  - `storm-03-a-knowledge-075` → `equinoxe-q010`
  - `storm-03-a-knowledge-033` → `equinoxe-q015`
- Reviewer B : item local `storm-03-b-item-006`
  - `storm-03-b-knowledge-076` → `equinoxe-q014`
  - `storm-03-b-knowledge-032` → `equinoxe-q010`
  - `storm-03-b-knowledge-073` → `equinoxe-q012`
  - `storm-03-b-knowledge-060` → `equinoxe-q015`

### Connaissances publiées nécessaires

| q-id canonique | Question canonique | Réponse canonique |
|---|---|---|
| `equinoxe-q010` | Aurai-je un bureau attitré ? | Non, vous aurez un quartier d’équipe mais pas de poste nominatif. |
| `equinoxe-q012` | Je vais devoir changer de bureau tous les jours ? | Vous resterez principalement dans le quartier d’équipe qui vous est associé, avec la liberté de varier selon vos besoins. |
| `equinoxe-q014` | Mon équipe aura-t-elle toujours la même zone ? | Oui, chaque équipe se voit attribuer un quartier de référence stable. |
| `equinoxe-q015` | Est-ce que je choisis où je m’assois chaque matin ? | Oui, au sein de votre quartier d’équipe vous choisissez librement votre poste du jour. |

### Décision humaine — à remplir

```text
HUMAN_ADJUDICATION:
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 2. ambiguity-capacity-03 — Famille candidate 03

### Identification

- Item canonique : `ambiguity-capacity-03`
- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- Famille source : Famille candidate 03
- Formulation source disponible — contexte métier : Connexion réseau sans fil et branchement physique du poste
- `scenarioFamilyId` : non attribué dans les artefacts sources.

### Reviewer A

- Classification : `structuralAmbiguity`
- Mécanisme : `alternativeIntentReadings`
- Groupes couverts substantiellement différents :
  - Groupe 1 : `equinoxe-q047`
  - Groupe 2 : `equinoxe-q048`

Rationales Reviewer A :

- `ambiguityFamilyDisposition`

> Branchement physique du poste et connexion wifi sont distincts.

- `ambiguityMechanism`

> Mécanisme retenu : alternativeIntentReadings. Branchement physique du poste et connexion wifi sont distincts.

- `substantiallyDifferentCoveredGroups`

> Partition Reviewer : [storm-03-a-knowledge-079] / [storm-03-a-knowledge-043].

### Reviewer B

- Classification : `artificialOrMalformed`
- Mécanisme : non applicable
- Groupes couverts substantiellement différents : non applicables dans cette décision.

Rationales Reviewer B :

- `ambiguityFamilyDisposition`

> Le wifi du bâtiment et l’assistance au branchement physique d’un poste sont deux sujets IT distincts ; leur rapprochement repose sur le mot « connexion » plutôt que sur une ambiguïté métier commune.

### Comparaison A/B

- Statut exact de la matrice : `DECISION_VALUE_DISAGREEMENT`
- Accord de premier niveau : non
- Accord complet : non
- Dimensions strictement égales : aucune
- Dimensions en désaccord consignées par la matrice : `ambiguityFamilyDisposition.value` (`DECISION_VALUE_DISAGREEMENT`), `ambiguityFamilyDisposition.conditionalDecisions` (`CONDITIONAL_STRUCTURE_DISAGREEMENT`)

Crosswalk curator-only utilisé :

- Reviewer A : item local `storm-03-a-item-028`
  - `storm-03-a-knowledge-079` → `equinoxe-q048`
  - `storm-03-a-knowledge-043` → `equinoxe-q047`
- Reviewer B : item local `storm-03-b-item-010`
  - `storm-03-b-knowledge-046` → `equinoxe-q047`
  - `storm-03-b-knowledge-074` → `equinoxe-q048`

### Connaissances publiées nécessaires

| q-id canonique | Question canonique | Réponse canonique |
|---|---|---|
| `equinoxe-q047` | Y aura-t-il du wifi partout dans le bâtiment ? | Oui, une couverture wifi est prévue sur l’ensemble des espaces de Cobalt. |
| `equinoxe-q048` | Comment se passera le branchement de mon poste le premier jour ? | Une assistance IT sera présente lors de la semaine de préparation, début janvier 2027. |

### Décision humaine — à remplir

```text
HUMAN_ADJUDICATION:
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 3. ambiguity-capacity-05 — Famille candidate 05

### Identification

- Item canonique : `ambiguity-capacity-05`
- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- Famille source : Famille candidate 05
- Formulation source disponible — contexte métier : Recharge électrique pour vélo ou automobile
- `scenarioFamilyId` : non attribué dans les artefacts sources.

### Reviewer A

- Classification : `structuralAmbiguity`
- Mécanisme : `underspecifiedReference`
- Groupes couverts substantiellement différents :
  - Groupe 1 : `equinoxe-q038`
  - Groupe 2 : `equinoxe-q100`

Rationales Reviewer A :

- `ambiguityFamilyDisposition`

> La recharge électrique peut viser un vélo ou une automobile.

- `ambiguityMechanism`

> Mécanisme retenu : underspecifiedReference. La recharge électrique peut viser un vélo ou une automobile.

- `substantiallyDifferentCoveredGroups`

> Partition Reviewer : [storm-03-a-knowledge-051] / [storm-03-a-knowledge-067].

### Reviewer B

- Classification : `blockedTemporalInstability`
- Mécanisme : non applicable
- Groupes couverts substantiellement différents : non applicables dans cette décision.

Rationales Reviewer B :

- `ambiguityFamilyDisposition`

> La recharge vélo est explicitement prévue, tandis que les modalités de stationnement et de recharge automobile doivent encore être précisées avant l’emménagement ; la branche automobile n’est pas assez stabilisée pour former deux groupes couverts stables.

### Comparaison A/B

- Statut exact de la matrice : `DECISION_VALUE_DISAGREEMENT`
- Accord de premier niveau : non
- Accord complet : non
- Dimensions strictement égales : aucune
- Dimensions en désaccord consignées par la matrice : `ambiguityFamilyDisposition.value` (`DECISION_VALUE_DISAGREEMENT`), `ambiguityFamilyDisposition.conditionalDecisions` (`CONDITIONAL_STRUCTURE_DISAGREEMENT`)

Crosswalk curator-only utilisé :

- Reviewer A : item local `storm-03-a-item-029`
  - `storm-03-a-knowledge-051` → `equinoxe-q038`
  - `storm-03-a-knowledge-067` → `equinoxe-q100`
- Reviewer B : item local `storm-03-b-item-009`
  - `storm-03-b-knowledge-008` → `equinoxe-q100`
  - `storm-03-b-knowledge-054` → `equinoxe-q038`

### Connaissances publiées nécessaires

| q-id canonique | Question canonique | Réponse canonique |
|---|---|---|
| `equinoxe-q038` | Y a-t-il des prises de recharge pour vélos électriques ? | Oui, le local vélos prévoit des prises de recharge. |
| `equinoxe-q100` | Y a-t-il des bornes de recharge pour voitures électriques ? | Les modalités de stationnement et de recharge seront précisées avant l’emménagement. |

### Décision humaine — à remplir

```text
HUMAN_ADJUDICATION:
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 4. ambiguity-capacity-06 — Famille candidate 06

### Identification

- Item canonique : `ambiguity-capacity-06`
- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- Famille source : Famille candidate 06
- Formulation source disponible — contexte métier : Casier personnel et équipement de rangement du local vélos
- `scenarioFamilyId` : non attribué dans les artefacts sources.

### Reviewer A

- Classification : `insufficientEvidence`
- Mécanisme : non applicable
- Groupes couverts substantiellement différents : non applicables dans cette décision.

Rationales Reviewer A :

- `ambiguityFamilyDisposition`

> Le corpus ne permet pas de distinguer avec assez de certitude les casiers du local vélos des casiers personnels.

### Reviewer B

- Classification : `structuralAmbiguity`
- Mécanisme : `underspecifiedReference`
- Groupes couverts substantiellement différents :
  - Groupe 1 : `equinoxe-q035`, `equinoxe-q036`, `equinoxe-q094`, `equinoxe-q095`
  - Groupe 2 : `equinoxe-q037`, `equinoxe-q073`

Rationales Reviewer B :

- `ambiguityFamilyDisposition`

> Le terme de rangement/casier renvoie à deux contextes affichés : effets personnels au poste et équipements à proximité du local vélos.

- `ambiguityMechanism`

> Sans précision sur le contexte du casier ou du rangement, le référent peut être différent.

- `substantiallyDifferentCoveredGroups`

> Partition des groupes de réponses substantiellement différents : G1 casier personnel de travail = [storm-03-b-knowledge-071, storm-03-b-knowledge-022, storm-03-b-knowledge-042, storm-03-b-knowledge-075] ; G2 équipements du local vélos = [storm-03-b-knowledge-037, storm-03-b-knowledge-009].
> Rationale courte : Les groupes conduisent à des réponses métier substantiellement différentes.

### Comparaison A/B

- Statut exact de la matrice : `DECISION_VALUE_DISAGREEMENT`
- Accord de premier niveau : non
- Accord complet : non
- Dimensions strictement égales : aucune
- Dimensions en désaccord consignées par la matrice : `ambiguityFamilyDisposition.value` (`DECISION_VALUE_DISAGREEMENT`), `ambiguityFamilyDisposition.conditionalDecisions` (`CONDITIONAL_STRUCTURE_DISAGREEMENT`)

Crosswalk curator-only utilisé :

- Reviewer A : item local `storm-03-a-item-014`
  - `storm-03-a-knowledge-048` → `equinoxe-q094`
  - `storm-03-a-knowledge-027` → `equinoxe-q037`
  - `storm-03-a-knowledge-052` → `equinoxe-q035`
  - `storm-03-a-knowledge-080` → `equinoxe-q073`
  - `storm-03-a-knowledge-039` → `equinoxe-q036`
  - `storm-03-a-knowledge-069` → `equinoxe-q095`
- Reviewer B : item local `storm-03-b-item-002`
  - `storm-03-b-knowledge-071` → `equinoxe-q036`
  - `storm-03-b-knowledge-022` → `equinoxe-q035`
  - `storm-03-b-knowledge-042` → `equinoxe-q095`
  - `storm-03-b-knowledge-037` → `equinoxe-q073`
  - `storm-03-b-knowledge-075` → `equinoxe-q094`
  - `storm-03-b-knowledge-009` → `equinoxe-q037`

### Connaissances publiées nécessaires

| q-id canonique | Question canonique | Réponse canonique |
|---|---|---|
| `equinoxe-q035` | J’aurai un casier personnel ? | Oui, des casiers seront disponibles -- la réservation ouvrira début décembre 2026. |
| `equinoxe-q036` | Où je mets mes affaires si je n’ai pas de bureau fixe ? | Dans votre casier personnel, réservable à partir de début décembre 2026. |
| `equinoxe-q037` | Le local vélos a des douches à proximité ? | Oui, des casiers et des douches sont prévus à proximité du local vélos. |
| `equinoxe-q073` | Je peux amener mon vélo à l’intérieur ? | Non, un local vélos dédié de 160 places est prévu, avec douches et casiers à proximité. |
| `equinoxe-q094` | Le casier est-il suffisant pour un carton de dossiers ? | Les casiers sont dimensionnés pour les effets personnels et documents courants -- le détail des tailles sera précisé avec l’ouverture des réservations. |
| `equinoxe-q095` | Y a-t-il un casier par personne ou par équipe ? | Les casiers sont individuels, réservables par chaque collaborateur. |

### Décision humaine — à remplir

```text
HUMAN_ADJUDICATION:
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 5. ambiguity-capacity-07 — Famille candidate 07

### Identification

- Item canonique : `ambiguity-capacity-07`
- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- Famille source : Famille candidate 07
- Formulation source disponible — contexte métier : Portée des jalons de préparation au déménagement
- `scenarioFamilyId` : non attribué dans les artefacts sources.

### Reviewer A

- Classification : `structuralAmbiguity`
- Mécanisme : `underspecifiedReference`
- Groupes couverts substantiellement différents :
  - Groupe 1 : `equinoxe-q003`
  - Groupe 2 : `equinoxe-q004`, `equinoxe-q005`, `equinoxe-q007`, `equinoxe-q108`

Rationales Reviewer A :

- `ambiguityFamilyDisposition`

> Jalons concrets de préparation et stabilité générale du calendrier sont distincts.

- `ambiguityMechanism`

> Mécanisme retenu : underspecifiedReference. Jalons concrets de préparation et stabilité générale du calendrier sont distincts.

- `substantiallyDifferentCoveredGroups`

> Partition Reviewer : [storm-03-a-knowledge-063, storm-03-a-knowledge-032, storm-03-a-knowledge-005, storm-03-a-knowledge-074] / [storm-03-a-knowledge-014].

### Reviewer B

- Classification : `structuralAmbiguity`
- Mécanisme : `underspecifiedReference`
- Groupes couverts substantiellement différents :
  - Groupe 1 : `equinoxe-q003`
  - Groupe 2 : `equinoxe-q004`
  - Groupe 3 : `equinoxe-q005`, `equinoxe-q108`
  - Groupe 4 : `equinoxe-q007`

Rationales Reviewer B :

- `ambiguityFamilyDisposition`

> Plusieurs jalons de préparation distincts sont affichés, avec des dates ou statuts différents.

- `ambiguityMechanism`

> Une référence à un jalon ou à la préparation sans préciser lequel peut viser le guide, les visites, la semaine de préparation ou la stabilité du calendrier.

- `substantiallyDifferentCoveredGroups`

> Partition des groupes de réponses substantiellement différents : G1 préparation via le guide = [storm-03-b-knowledge-039] ; G2 stabilité/ajustement du calendrier = [storm-03-b-knowledge-079] ; G3 visites et activités préparatoires = [storm-03-b-knowledge-034, storm-03-b-knowledge-063] ; G4 semaine de préparation = [storm-03-b-knowledge-067].
> Rationale courte : Les groupes conduisent à des réponses métier substantiellement différentes.

### Comparaison A/B

- Statut exact de la matrice : `PARTITION_DISAGREEMENT`
- Accord de premier niveau : oui
- Accord complet : non
- Dimensions strictement égales : `ambiguityFamilyDisposition.value`, `ambiguityMechanism.value`, `substantiallyDifferentCoveredGroups.value`
- Dimensions en désaccord consignées par la matrice : `substantiallyDifferentCoveredGroups.canonicalPartition` (`PARTITION_DISAGREEMENT`)

Crosswalk curator-only utilisé :

- Reviewer A : item local `storm-03-a-item-031`
  - `storm-03-a-knowledge-063` → `equinoxe-q005`
  - `storm-03-a-knowledge-032` → `equinoxe-q108`
  - `storm-03-a-knowledge-005` → `equinoxe-q007`
  - `storm-03-a-knowledge-074` → `equinoxe-q004`
  - `storm-03-a-knowledge-014` → `equinoxe-q003`
- Reviewer B : item local `storm-03-b-item-024`
  - `storm-03-b-knowledge-039` → `equinoxe-q007`
  - `storm-03-b-knowledge-079` → `equinoxe-q003`
  - `storm-03-b-knowledge-034` → `equinoxe-q005`
  - `storm-03-b-knowledge-067` → `equinoxe-q004`
  - `storm-03-b-knowledge-063` → `equinoxe-q108`

### Connaissances publiées nécessaires

| q-id canonique | Question canonique | Réponse canonique |
|---|---|---|
| `equinoxe-q003` | Le calendrier peut-il encore changer ? | Le calendrier est stabilisé, mais certaines dates intermédiaires (ateliers, visites) peuvent être ajustées en fonction de l’avancement. |
| `equinoxe-q004` | Quand aura lieu la semaine de préparation ? | La semaine de préparation est prévue le 11 janvier 2027, juste avant l’emménagement. |
| `equinoxe-q005` | Est-ce que je peux visiter Cobalt avant le déménagement ? | Oui, des visites sont prévues fin novembre 2026 -- les créneaux seront communiqués par les ambassadeurs. |
| `equinoxe-q007` | On aura combien de temps pour préparer notre déménagement personnel ? | Le guide des nouveaux usages sera disponible début octobre, plusieurs mois avant le déménagement. |
| `equinoxe-q108` | Le projet prévoit-il d’autres ateliers après le choix des quartiers ? | Oui, des visites et une semaine de préparation sont prévues avant l’emménagement. |

### Décision humaine — à remplir

```text
HUMAN_ADJUDICATION:
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 6. ambiguity-capacity-10 — Famille candidate 10

### Identification

- Item canonique : `ambiguity-capacity-10`
- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- Famille source : Famille candidate 10
- Formulation source disponible — contexte métier : Finalité, offre et accès du Café
- `scenarioFamilyId` : non attribué dans les artefacts sources.

### Reviewer A

- Classification : `structuralAmbiguity`
- Mécanisme : `alternativeIntentReadings`
- Groupes couverts substantiellement différents :
  - Groupe 1 : `equinoxe-q032`
  - Groupe 2 : `equinoxe-q063`
  - Groupe 3 : `equinoxe-q093`

Rationales Reviewer A :

- `ambiguityFamilyDisposition`

> Offre ou finalité du Café, convivialité et accès toute la journée sont distincts.

- `ambiguityMechanism`

> Mécanisme retenu : alternativeIntentReadings. Offre ou finalité du Café, convivialité et accès toute la journée sont distincts.

- `substantiallyDifferentCoveredGroups`

> Partition Reviewer : [storm-03-a-knowledge-013] / [storm-03-a-knowledge-018] / [storm-03-a-knowledge-049].

### Reviewer B

- Classification : `artificialOrMalformed`
- Mécanisme : non applicable
- Groupes couverts substantiellement différents : non applicables dans cette décision.

Rationales Reviewer B :

- `ambiguityFamilyDisposition`

> Finalité conviviale, disponibilité toute la journée et offre alimentaire du Café sont des attributs distincts du même lieu ; le brief ne montre pas une ambiguïté structurelle entre réponses concurrentes.

### Comparaison A/B

- Statut exact de la matrice : `DECISION_VALUE_DISAGREEMENT`
- Accord de premier niveau : non
- Accord complet : non
- Dimensions strictement égales : aucune
- Dimensions en désaccord consignées par la matrice : `ambiguityFamilyDisposition.value` (`DECISION_VALUE_DISAGREEMENT`), `ambiguityFamilyDisposition.conditionalDecisions` (`CONDITIONAL_STRUCTURE_DISAGREEMENT`)

Crosswalk curator-only utilisé :

- Reviewer A : item local `storm-03-a-item-023`
  - `storm-03-a-knowledge-013` → `equinoxe-q063`
  - `storm-03-a-knowledge-018` → `equinoxe-q032`
  - `storm-03-a-knowledge-049` → `equinoxe-q093`
- Reviewer B : item local `storm-03-b-item-032`
  - `storm-03-b-knowledge-012` → `equinoxe-q063`
  - `storm-03-b-knowledge-064` → `equinoxe-q093`
  - `storm-03-b-knowledge-031` → `equinoxe-q032`

### Connaissances publiées nécessaires

| q-id canonique | Question canonique | Réponse canonique |
|---|---|---|
| `equinoxe-q032` | Y a-t-il un espace pour les échanges informels ? | Oui, le Café central et la Terrasse sont pensés pour la convivialité et les échanges informels. |
| `equinoxe-q063` | Le café central sert-il aussi à manger ? | Le Café central est surtout pensé pour la convivialité -- l’offre précise sera communiquée avant l’ouverture. |
| `equinoxe-q093` | Le café central est-il accessible toute la journée ? | Oui, le Café central est pensé comme un lieu de convivialité accessible tout au long de la journée. |

### Décision humaine — à remplir

```text
HUMAN_ADJUDICATION:
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 7. ambiguity-capacity-11 — Famille candidate 11

### Identification

- Item canonique : `ambiguity-capacity-11`
- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- Famille source : Famille candidate 11
- Formulation source disponible — contexte métier : Usages possibles de la terrasse
- `scenarioFamilyId` : non attribué dans les artefacts sources.

### Reviewer A

- Classification : `structuralAmbiguity`
- Mécanisme : `competingPublishedKnowledge`
- Groupes couverts substantiellement différents :
  - Groupe 1 : `equinoxe-q032`
  - Groupe 2 : `equinoxe-q064`

Rationales Reviewer A :

- `ambiguityFamilyDisposition`

> La terrasse est publiée comme lieu de déjeuner et comme lieu de convivialité ou d’échanges.

- `ambiguityMechanism`

> Mécanisme retenu : competingPublishedKnowledge. La terrasse est publiée comme lieu de déjeuner et comme lieu de convivialité ou d’échanges.

- `substantiallyDifferentCoveredGroups`

> Partition Reviewer : [storm-03-a-knowledge-012] / [storm-03-a-knowledge-018].

### Reviewer B

- Classification : `structuralAmbiguity`
- Mécanisme : `alternativeIntentReadings`
- Groupes couverts substantiellement différents :
  - Groupe 1 : `equinoxe-q032`
  - Groupe 2 : `equinoxe-q064`

Rationales Reviewer B :

- `ambiguityFamilyDisposition`

> La Terrasse est couverte pour deux usages métier différents : échanges informels et déjeuner dehors.

- `ambiguityMechanism`

> Une demande sur l’usage de la Terrasse peut viser la convivialité ou la restauration.

- `substantiallyDifferentCoveredGroups`

> Partition des groupes de réponses substantiellement différents : G1 convivialité/échanges informels = [storm-03-b-knowledge-031] ; G2 déjeuner en extérieur = [storm-03-b-knowledge-016].
> Rationale courte : Les groupes conduisent à des réponses métier substantiellement différentes.

### Comparaison A/B

- Statut exact de la matrice : `MECHANISM_DISAGREEMENT`
- Accord de premier niveau : oui
- Accord complet : non
- Dimensions strictement égales : `ambiguityFamilyDisposition.value`, `substantiallyDifferentCoveredGroups.value`, `substantiallyDifferentCoveredGroups.canonicalPartition`
- Dimensions en désaccord consignées par la matrice : `ambiguityMechanism.value` (`MECHANISM_DISAGREEMENT`)

Crosswalk curator-only utilisé :

- Reviewer A : item local `storm-03-a-item-017`
  - `storm-03-a-knowledge-012` → `equinoxe-q064`
  - `storm-03-a-knowledge-018` → `equinoxe-q032`
- Reviewer B : item local `storm-03-b-item-005`
  - `storm-03-b-knowledge-031` → `equinoxe-q032`
  - `storm-03-b-knowledge-016` → `equinoxe-q064`

### Connaissances publiées nécessaires

| q-id canonique | Question canonique | Réponse canonique |
|---|---|---|
| `equinoxe-q032` | Y a-t-il un espace pour les échanges informels ? | Oui, le Café central et la Terrasse sont pensés pour la convivialité et les échanges informels. |
| `equinoxe-q064` | Puis-je déjeuner dehors quand il fait beau ? | Oui, une terrasse d’environ 70 places est prévue. |

### Décision humaine — à remplir

```text
HUMAN_ADJUDICATION:
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 8. ambiguity-capacity-13 — Famille candidate 13

### Identification

- Item canonique : `ambiguity-capacity-13`
- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- Famille source : Famille candidate 13
- Formulation source disponible — contexte métier : Portée de l’offre alimentaire, snacks et menu
- `scenarioFamilyId` : non attribué dans les artefacts sources.

### Reviewer A

- Classification : `structuralAmbiguity`
- Mécanisme : `alternativeIntentReadings`
- Groupes couverts substantiellement différents :
  - Groupe 1 : `equinoxe-q062`
  - Groupe 2 : `equinoxe-q102`
  - Groupe 3 : `equinoxe-q103`

Rationales Reviewer A :

- `ambiguityFamilyDisposition`

> Menu ou offre générale, option végétarienne et snack ou restauration rapide sont des lectures distinctes.

- `ambiguityMechanism`

> Mécanisme retenu : alternativeIntentReadings. Menu ou offre générale, option végétarienne et snack ou restauration rapide sont des lectures distinctes.

- `substantiallyDifferentCoveredGroups`

> Partition Reviewer : [storm-03-a-knowledge-081] / [storm-03-a-knowledge-004] / [storm-03-a-knowledge-035].

### Reviewer B

- Classification : `blockedTemporalInstability`
- Mécanisme : non applicable
- Groupes couverts substantiellement différents : non applicables dans cette décision.

Rationales Reviewer B :

- `ambiguityFamilyDisposition`

> Une offre végétarienne est confirmée, mais le détail du menu et l’offre précise de restauration rapide sont explicitement reportés à plus tard ; la portée complète de l’offre n’est pas encore stabilisée.

### Comparaison A/B

- Statut exact de la matrice : `DECISION_VALUE_DISAGREEMENT`
- Accord de premier niveau : non
- Accord complet : non
- Dimensions strictement égales : aucune
- Dimensions en désaccord consignées par la matrice : `ambiguityFamilyDisposition.value` (`DECISION_VALUE_DISAGREEMENT`), `ambiguityFamilyDisposition.conditionalDecisions` (`CONDITIONAL_STRUCTURE_DISAGREEMENT`)

Crosswalk curator-only utilisé :

- Reviewer A : item local `storm-03-a-item-002`
  - `storm-03-a-knowledge-081` → `equinoxe-q103`
  - `storm-03-a-knowledge-004` → `equinoxe-q062`
  - `storm-03-a-knowledge-035` → `equinoxe-q102`
- Reviewer B : item local `storm-03-b-item-016`
  - `storm-03-b-knowledge-070` → `equinoxe-q102`
  - `storm-03-b-knowledge-005` → `equinoxe-q103`
  - `storm-03-b-knowledge-001` → `equinoxe-q062`

### Connaissances publiées nécessaires

| q-id canonique | Question canonique | Réponse canonique |
|---|---|---|
| `equinoxe-q062` | Y aura-t-il une offre végétarienne ? | Oui, une offre chaude, végétarienne et rapide est prévue au restaurant. |
| `equinoxe-q102` | Y a-t-il des distributeurs si je veux juste un snack ? | L’offre précise de restauration rapide sera détaillée avant l’ouverture du site. |
| `equinoxe-q103` | Le restaurant propose-t-il un menu différent chaque jour ? | Le Restaurant proposera une offre chaude, végétarienne et rapide -- le détail de la carte sera communiqué plus tard. |

### Décision humaine — à remplir

```text
HUMAN_ADJUDICATION:
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 9. ambiguity-capacity-14 — Famille candidate 14

### Identification

- Item canonique : `ambiguity-capacity-14`
- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- Famille source : Famille candidate 14
- Formulation source disponible — contexte métier : Lieux de restauration et permission d’usage
- `scenarioFamilyId` : non attribué dans les artefacts sources.

### Reviewer A

- Classification : `artificialOrMalformed`
- Mécanisme : non applicable
- Groupes couverts substantiellement différents : non applicables dans cette décision.

Rationales Reviewer A :

- `ambiguityFamilyDisposition`

> Les connaissances sont complémentaires ; le brief force artificiellement une ambiguïté.

### Reviewer B

- Classification : `structuralAmbiguity`
- Mécanisme : `alternativeIntentReadings`
- Groupes couverts substantiellement différents :
  - Groupe 1 : `equinoxe-q064`
  - Groupe 2 : `equinoxe-q072`
  - Groupe 3 : `equinoxe-q092`

Rationales Reviewer B :

- `ambiguityFamilyDisposition`

> Les connaissances couvrent la permission d’usage des postes, le choix général d’un lieu de déjeuner et le cas spécifique de la Terrasse.

- `ambiguityMechanism`

> L’intention peut être une règle d’usage, un choix de lieu ou un déjeuner extérieur.

- `substantiallyDifferentCoveredGroups`

> Partition des groupes de réponses substantiellement différents : G1 permission et lieux adaptés pour manger = [storm-03-b-knowledge-025] ; G2 options générales pour le déjeuner = [storm-03-b-knowledge-003] ; G3 déjeuner dehors sur la Terrasse = [storm-03-b-knowledge-016].
> Rationale courte : Les groupes conduisent à des réponses métier substantiellement différentes.

### Comparaison A/B

- Statut exact de la matrice : `DECISION_VALUE_DISAGREEMENT`
- Accord de premier niveau : non
- Accord complet : non
- Dimensions strictement égales : aucune
- Dimensions en désaccord consignées par la matrice : `ambiguityFamilyDisposition.value` (`DECISION_VALUE_DISAGREEMENT`), `ambiguityFamilyDisposition.conditionalDecisions` (`CONDITIONAL_STRUCTURE_DISAGREEMENT`)

Crosswalk curator-only utilisé :

- Reviewer A : item local `storm-03-a-item-021`
  - `storm-03-a-knowledge-054` → `equinoxe-q072`
  - `storm-03-a-knowledge-016` → `equinoxe-q092`
  - `storm-03-a-knowledge-012` → `equinoxe-q064`
- Reviewer B : item local `storm-03-b-item-008`
  - `storm-03-b-knowledge-025` → `equinoxe-q092`
  - `storm-03-b-knowledge-003` → `equinoxe-q072`
  - `storm-03-b-knowledge-016` → `equinoxe-q064`

### Connaissances publiées nécessaires

| q-id canonique | Question canonique | Réponse canonique |
|---|---|---|
| `equinoxe-q064` | Puis-je déjeuner dehors quand il fait beau ? | Oui, une terrasse d’environ 70 places est prévue. |
| `equinoxe-q072` | Et pour manger le midi, on fait comment ? | Vous pourrez utiliser le restaurant (environ 220 places), le Café central ou la Terrasse selon vos envies. |
| `equinoxe-q092` | Peut-on manger à son poste ? | Les espaces prévus pour la restauration sont le Café central, le Restaurant et la Terrasse, plutôt que les postes de travail. |

### Décision humaine — à remplir

```text
HUMAN_ADJUDICATION:
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 10. ambiguity-capacity-16 — Famille candidate 16

### Identification

- Item canonique : `ambiguity-capacity-16`
- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- Famille source : Famille candidate 16
- Formulation source disponible — contexte métier : Règle projet, calendrier et autorité managériale de présence
- `scenarioFamilyId` : non attribué dans les artefacts sources.

### Reviewer A

- Classification : `structuralAmbiguity`
- Mécanisme : `alternativeIntentReadings`
- Groupes couverts substantiellement différents :
  - Groupe 1 : `equinoxe-q040`, `equinoxe-q042`
  - Groupe 2 : `equinoxe-q043`
  - Groupe 3 : `equinoxe-q044`

Rationales Reviewer A :

- `ambiguityFamilyDisposition`

> Autorité managériale, règles de télétravail et présence minimale sont des lectures distinctes.

- `ambiguityMechanism`

> Mécanisme retenu : alternativeIntentReadings. Autorité managériale, règles de télétravail et présence minimale sont des lectures distinctes.

- `substantiallyDifferentCoveredGroups`

> Partition Reviewer : [storm-03-a-knowledge-036] / [storm-03-a-knowledge-009, storm-03-a-knowledge-021] / [storm-03-a-knowledge-076].

### Reviewer B

- Classification : `structuralAmbiguity`
- Mécanisme : `alternativeIntentReadings`
- Groupes couverts substantiellement différents :
  - Groupe 1 : `equinoxe-q040`, `equinoxe-q042`, `equinoxe-q043`
  - Groupe 2 : `equinoxe-q044`

Rationales Reviewer B :

- `ambiguityFamilyDisposition`

> Le projet n’impose pas de changement de télétravail ni de présence minimale, tandis que les règles en vigueur dans l’équipe restent applicables.

- `ambiguityMechanism`

> Une contrainte de présence peut être attribuée soit au projet Cobalt, soit aux règles de l’équipe ou du manager.

- `substantiallyDifferentCoveredGroups`

> Partition des groupes de réponses substantiellement différents : G1 règle du projet sur télétravail/présence = [storm-03-b-knowledge-033, storm-03-b-knowledge-062, storm-03-b-knowledge-050] ; G2 autorité ou règles de l’équipe/manager = [storm-03-b-knowledge-035].
> Rationale courte : Les groupes conduisent à des réponses métier substantiellement différentes.

### Comparaison A/B

- Statut exact de la matrice : `PARTITION_DISAGREEMENT`
- Accord de premier niveau : oui
- Accord complet : non
- Dimensions strictement égales : `ambiguityFamilyDisposition.value`, `ambiguityMechanism.value`, `substantiallyDifferentCoveredGroups.value`
- Dimensions en désaccord consignées par la matrice : `substantiallyDifferentCoveredGroups.canonicalPartition` (`PARTITION_DISAGREEMENT`)

Crosswalk curator-only utilisé :

- Reviewer A : item local `storm-03-a-item-001`
  - `storm-03-a-knowledge-036` → `equinoxe-q044`
  - `storm-03-a-knowledge-009` → `equinoxe-q040`
  - `storm-03-a-knowledge-021` → `equinoxe-q042`
  - `storm-03-a-knowledge-076` → `equinoxe-q043`
- Reviewer B : item local `storm-03-b-item-026`
  - `storm-03-b-knowledge-033` → `equinoxe-q040`
  - `storm-03-b-knowledge-062` → `equinoxe-q042`
  - `storm-03-b-knowledge-050` → `equinoxe-q043`
  - `storm-03-b-knowledge-035` → `equinoxe-q044`

### Connaissances publiées nécessaires

| q-id canonique | Question canonique | Réponse canonique |
|---|---|---|
| `equinoxe-q040` | Le projet change-t-il le télétravail ? | Non. |
| `equinoxe-q042` | Les jours de télétravail restent-ils les mêmes ? | Oui, aucun changement n’est prévu sur l’organisation du télétravail. |
| `equinoxe-q043` | Cobalt va-t-il imposer une présence minimale ? | Non, le projet Cobalt porte sur les espaces, pas sur les règles de présence. |
| `equinoxe-q044` | Mon manager peut-il m’imposer des jours fixes au bureau ? | Les règles de télétravail restent celles en vigueur dans votre équipe, inchangées par le projet. |

### Décision humaine — à remplir

```text
HUMAN_ADJUDICATION:
decision: PENDING
rationale: PENDING
future_rule: PENDING
```
