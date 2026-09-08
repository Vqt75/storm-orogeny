# Adjudication structurelle — Batch 03 : ambiguïtés 02

- Batch : `adjudication-batch-03-ambiguities-02`
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
- Catégories possibles : `structuralAmbiguity`, `artificialOrMalformed`, `blockedTemporalInstability`, `insufficientEvidence`.
- Mécanismes possibles avec `structuralAmbiguity` : `alternativeIntentReadings`, `underspecifiedReference`, `competingPublishedKnowledge`.
- L’arbitrage humain doit établir une structure de vérité propre pour la future génération du corpus.
- `generationAuthorized` reste `false`.

> Le paquet restitue uniquement le contexte réellement présent dans les sources scellées. Il ne reconstruit aucune formulation utilisateur absente et ne propose aucune décision.

## 1. ambiguity-capacity-17 — Famille candidate 17

### Identification

- Item canonique : `ambiguity-capacity-17`
- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- Contexte métier réellement disponible : Ouverture, rôle expérimental et collecte de retours du pilote

generated user formulation: NOT AVAILABLE

### Reviewer A

- Classification : `structuralAmbiguity`
- Mécanisme : `alternativeIntentReadings`
- Groupes couverts substantiellement différents :
  - Groupe 1 : `equinoxe-q006`
  - Groupe 2 : `equinoxe-q079`
  - Groupe 3 : `equinoxe-q110`

Rationales Reviewer A :

- `ambiguityFamilyDisposition`

> Date d’ouverture du pilote, rôle expérimental et collecte de retours sont distincts.

- `ambiguityMechanism`

> Mécanisme retenu : alternativeIntentReadings. Date d’ouverture du pilote, rôle expérimental et collecte de retours sont distincts.

- `substantiallyDifferentCoveredGroups`

> Partition Reviewer : [storm-03-a-knowledge-022] / [storm-03-a-knowledge-070] / [storm-03-a-knowledge-058].

### Reviewer B

- Classification : `artificialOrMalformed`
- Mécanisme : non applicable
- Groupes couverts substantiellement différents : non applicables dans cette décision.

Rationales Reviewer B :

- `ambiguityFamilyDisposition`

> La date d’ouverture du plateau témoin, sa fonction expérimentale et la collecte de retours sont trois attributs complémentaires du même pilote, sans deux réponses concurrentes à une même lecture.

### Comparaison A/B

- Statut exact : `DECISION_VALUE_DISAGREEMENT`
- Accord de premier niveau : non
- Accord complet : non
- Accords stricts : aucun
- Désaccords consignés : `ambiguityFamilyDisposition.value` (`DECISION_VALUE_DISAGREEMENT`), `ambiguityFamilyDisposition.conditionalDecisions` (`CONDITIONAL_STRUCTURE_DISAGREEMENT`)

Partition / crosswalk réel :

- Reviewer A : item local `storm-03-a-item-022`
  - `storm-03-a-knowledge-058` → `equinoxe-q110`
  - `storm-03-a-knowledge-022` → `equinoxe-q006`
  - `storm-03-a-knowledge-070` → `equinoxe-q079`
- Reviewer B : item local `storm-03-b-item-030`
  - `storm-03-b-knowledge-080` → `equinoxe-q079`
  - `storm-03-b-knowledge-069` → `equinoxe-q110`
  - `storm-03-b-knowledge-065` → `equinoxe-q006`

### Candidate knowledge

| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente |
|---|---|---|---|
| `equinoxe-q006` | Quand le plateau témoin a-t-il ouvert ? | Le plateau témoin a ouvert ses portes le 27 juillet 2026. | — |
| `equinoxe-q079` | Le mobilier du plateau témoin, c’est celui qu’on aura à Cobalt ? | Le plateau témoin permet de tester les mobiliers et futurs usages envisagés pour Cobalt. | — |
| `equinoxe-q110` | Qui gère les premiers retours après l’ouverture du plateau témoin ? | L’équipe projet recueille les retours pour ajuster les choix avant le déménagement définitif. | — |

### Human decision

```text
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 2. ambiguity-capacity-18 — Famille candidate 18

### Identification

- Item canonique : `ambiguity-capacity-18`
- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- Contexte métier réellement disponible : Essai, feedback avant déménagement et évolution ultérieure

generated user formulation: NOT AVAILABLE

### Reviewer A

- Classification : `structuralAmbiguity`
- Mécanisme : `alternativeIntentReadings`
- Groupes couverts substantiellement différents :
  - Groupe 1 : `equinoxe-q079`
  - Groupe 2 : `equinoxe-q110`
  - Groupe 3 : `equinoxe-q111`

Rationales Reviewer A :

- `ambiguityFamilyDisposition`

> Test du pilote, feedback avant déménagement et évolution ultérieure sont distincts.

- `ambiguityMechanism`

> Mécanisme retenu : alternativeIntentReadings. Test du pilote, feedback avant déménagement et évolution ultérieure sont distincts.

- `substantiallyDifferentCoveredGroups`

> Partition Reviewer : [storm-03-a-knowledge-070] / [storm-03-a-knowledge-058] / [storm-03-a-knowledge-007].

### Reviewer B

- Classification : `structuralAmbiguity`
- Mécanisme : `alternativeIntentReadings`
- Groupes couverts substantiellement différents :
  - Groupe 1 : `equinoxe-q079`, `equinoxe-q110`
  - Groupe 2 : `equinoxe-q111`

Rationales Reviewer B :

- `ambiguityFamilyDisposition`

> Les connaissances couvrent des ajustements à deux moments différents : essais et retours avant le déménagement, puis observation et évolution après l’emménagement.

- `ambiguityMechanism`

> Un besoin concernant la possibilité d’ajuster le projet peut viser la phase pilote avant déménagement ou l’évolution ultérieure.

- `substantiallyDifferentCoveredGroups`

> Partition des groupes de réponses substantiellement différents : G1 expérimentation et feedback avant déménagement = [storm-03-b-knowledge-080, storm-03-b-knowledge-069] ; G2 évolution/ajustements après emménagement = [storm-03-b-knowledge-020].
> Rationale courte : Les groupes conduisent à des réponses métier substantiellement différentes.

### Comparaison A/B

- Statut exact : `PARTITION_DISAGREEMENT`
- Accord de premier niveau : oui
- Accord complet : non
- Accords stricts : `ambiguityFamilyDisposition.value`, `ambiguityMechanism.value`, `substantiallyDifferentCoveredGroups.value`
- Désaccords consignés : `substantiallyDifferentCoveredGroups.canonicalPartition` (`PARTITION_DISAGREEMENT`)

Partition / crosswalk réel :

- Reviewer A : item local `storm-03-a-item-008`
  - `storm-03-a-knowledge-070` → `equinoxe-q079`
  - `storm-03-a-knowledge-058` → `equinoxe-q110`
  - `storm-03-a-knowledge-007` → `equinoxe-q111`
- Reviewer B : item local `storm-03-b-item-034`
  - `storm-03-b-knowledge-020` → `equinoxe-q111`
  - `storm-03-b-knowledge-080` → `equinoxe-q079`
  - `storm-03-b-knowledge-069` → `equinoxe-q110`

### Candidate knowledge

| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente |
|---|---|---|---|
| `equinoxe-q079` | Le mobilier du plateau témoin, c’est celui qu’on aura à Cobalt ? | Le plateau témoin permet de tester les mobiliers et futurs usages envisagés pour Cobalt. | — |
| `equinoxe-q110` | Qui gère les premiers retours après l’ouverture du plateau témoin ? | L’équipe projet recueille les retours pour ajuster les choix avant le déménagement définitif. | — |
| `equinoxe-q111` | Le projet est-il définitif ou peut-il encore évoluer ? | Le projet reste ajustable : les usages seront observés après l’emménagement et des ajustements resteront possibles. | — |

### Human decision

```text
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 3. ambiguity-capacity-19 — Famille candidate 19

### Identification

- Item canonique : `ambiguity-capacity-19`
- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- Contexte métier réellement disponible : Poser une question et recevoir les actualités projet

generated user formulation: NOT AVAILABLE

### Reviewer A

- Classification : `structuralAmbiguity`
- Mécanisme : `alternativeIntentReadings`
- Groupes couverts substantiellement différents :
  - Groupe 1 : `equinoxe-q008`
  - Groupe 2 : `equinoxe-q078`, `equinoxe-q085`

Rationales Reviewer A :

- `ambiguityFamilyDisposition`

> Poser une question et recevoir ou suivre les actualités projet sont distincts.

- `ambiguityMechanism`

> Mécanisme retenu : alternativeIntentReadings. Poser une question et recevoir ou suivre les actualités projet sont distincts.

- `substantiallyDifferentCoveredGroups`

> Partition Reviewer : [storm-03-a-knowledge-059] / [storm-03-a-knowledge-077, storm-03-a-knowledge-061].

### Reviewer B

- Classification : `artificialOrMalformed`
- Mécanisme : non applicable
- Groupes couverts substantiellement différents : non applicables dans cette décision.

Rationales Reviewer B :

- `ambiguityFamilyDisposition`

> Poser une question à tout moment via Storm et recevoir des actualités/jalons dans Storm sont deux flux de communication différents ; les connaissances ne montrent pas de concurrence entre réponses.

### Comparaison A/B

- Statut exact : `DECISION_VALUE_DISAGREEMENT`
- Accord de premier niveau : non
- Accord complet : non
- Accords stricts : aucun
- Désaccords consignés : `ambiguityFamilyDisposition.value` (`DECISION_VALUE_DISAGREEMENT`), `ambiguityFamilyDisposition.conditionalDecisions` (`CONDITIONAL_STRUCTURE_DISAGREEMENT`)

Partition / crosswalk réel :

- Reviewer A : item local `storm-03-a-item-030`
  - `storm-03-a-knowledge-059` → `equinoxe-q008`
  - `storm-03-a-knowledge-077` → `equinoxe-q085`
  - `storm-03-a-knowledge-061` → `equinoxe-q078`
- Reviewer B : item local `storm-03-b-item-020`
  - `storm-03-b-knowledge-051` → `equinoxe-q085`
  - `storm-03-b-knowledge-011` → `equinoxe-q008`
  - `storm-03-b-knowledge-041` → `equinoxe-q078`

### Candidate knowledge

| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente |
|---|---|---|---|
| `equinoxe-q008` | Y a-t-il une date limite pour poser des questions sur le projet ? | Non, vous pouvez poser vos questions à tout moment via Storm. | — |
| `equinoxe-q078` | On peut suivre l’avancement du projet quelque part ? | Oui, les actualités et les jalons du projet sont mis à jour régulièrement dans Storm. | Groupe scellé : `equinoxe-q078`, `equinoxe-q085` ; preferredEntryId : `equinoxe-q078` |
| `equinoxe-q085` | Est-ce qu’il y aura des points d’étape réguliers ? | Oui, des actualités et jalons sont publiés régulièrement dans Storm au fil de l’avancement. | Groupe scellé : `equinoxe-q078`, `equinoxe-q085` ; preferredEntryId : `equinoxe-q078` |

### Human decision

```text
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 4. ambiguity-capacity-20 — Famille candidate 20

### Identification

- Item canonique : `ambiguity-capacity-20`
- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- Contexte métier réellement disponible : Rôle, présence locale et désignation des ambassadeurs

generated user formulation: NOT AVAILABLE

### Reviewer A

- Classification : `structuralAmbiguity`
- Mécanisme : `alternativeIntentReadings`
- Groupes couverts substantiellement différents :
  - Groupe 1 : `equinoxe-q077`
  - Groupe 2 : `equinoxe-q106`
  - Groupe 3 : `equinoxe-q107`

Rationales Reviewer A :

- `ambiguityFamilyDisposition`

> Rôle des ambassadeurs, mode de désignation et présence dans le service sont des lectures distinctes.

- `ambiguityMechanism`

> Mécanisme retenu : alternativeIntentReadings. Rôle des ambassadeurs, mode de désignation et présence dans le service sont des lectures distinctes.

- `substantiallyDifferentCoveredGroups`

> Partition Reviewer : [storm-03-a-knowledge-042] / [storm-03-a-knowledge-008] / [storm-03-a-knowledge-029].

### Reviewer B

- Classification : `artificialOrMalformed`
- Mécanisme : non applicable
- Groupes couverts substantiellement différents : non applicables dans cette décision.

Rationales Reviewer B :

- `ambiguityFamilyDisposition`

> Les trois connaissances décrivent de façon compatible le même dispositif d’ambassadeurs : un relais présent dans chaque service et désigné au sein de celui-ci. Elles sont complémentaires plutôt que substantiellement concurrentes.

### Comparaison A/B

- Statut exact : `DECISION_VALUE_DISAGREEMENT`
- Accord de premier niveau : non
- Accord complet : non
- Accords stricts : aucun
- Désaccords consignés : `ambiguityFamilyDisposition.value` (`DECISION_VALUE_DISAGREEMENT`), `ambiguityFamilyDisposition.conditionalDecisions` (`CONDITIONAL_STRUCTURE_DISAGREEMENT`)

Partition / crosswalk réel :

- Reviewer A : item local `storm-03-a-item-003`
  - `storm-03-a-knowledge-042` → `equinoxe-q077`
  - `storm-03-a-knowledge-008` → `equinoxe-q107`
  - `storm-03-a-knowledge-029` → `equinoxe-q106`
- Reviewer B : item local `storm-03-b-item-023`
  - `storm-03-b-knowledge-018` → `equinoxe-q106`
  - `storm-03-b-knowledge-078` → `equinoxe-q077`
  - `storm-03-b-knowledge-052` → `equinoxe-q107`

### Candidate knowledge

| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente |
|---|---|---|---|
| `equinoxe-q077` | Qui sont les ambassadeurs, ils servent à quoi ? | Les ambassadeurs sont des relais de proximité dans chaque service, pour répondre à vos questions au quotidien. | — |
| `equinoxe-q106` | Les ambassadeurs sont-ils dans mon service ? | Oui, chaque service dispose d’un ambassadeur qui sert de relais de proximité. | — |
| `equinoxe-q107` | Comment sont choisis les ambassadeurs ? | Les ambassadeurs sont désignés au sein de chaque service comme relais de proximité pour le projet. | — |

### Human decision

```text
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 5. ambiguity-capacity-21 — Famille candidate 21

### Identification

- Item canonique : `ambiguity-capacity-21`
- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- Contexte métier réellement disponible : Canal de question et canal de proposition d’amélioration

generated user formulation: NOT AVAILABLE

### Reviewer A

- Classification : `structuralAmbiguity`
- Mécanisme : `alternativeIntentReadings`
- Groupes couverts substantiellement différents :
  - Groupe 1 : `equinoxe-q083`
  - Groupe 2 : `equinoxe-q112`

Rationales Reviewer A :

- `ambiguityFamilyDisposition`

> Proposer une amélioration et chercher un contact pour poser une question sont des intentions distinctes.

- `ambiguityMechanism`

> Mécanisme retenu : alternativeIntentReadings. Proposer une amélioration et chercher un contact pour poser une question sont des intentions distinctes.

- `substantiallyDifferentCoveredGroups`

> Partition Reviewer : [storm-03-a-knowledge-073] / [storm-03-a-knowledge-037].

### Reviewer B

- Classification : `artificialOrMalformed`
- Mécanisme : non applicable
- Groupes couverts substantiellement différents : non applicables dans cette décision.

Rationales Reviewer B :

- `ambiguityFamilyDisposition`

> Les deux connaissances distinguent question et proposition d’amélioration, mais elles renvoient toutes deux aux ambassadeurs ou à l’équipe projet ; elles ne forment pas deux groupes de réponses substantiellement différents.

### Comparaison A/B

- Statut exact : `DECISION_VALUE_DISAGREEMENT`
- Accord de premier niveau : non
- Accord complet : non
- Accords stricts : aucun
- Désaccords consignés : `ambiguityFamilyDisposition.value` (`DECISION_VALUE_DISAGREEMENT`), `ambiguityFamilyDisposition.conditionalDecisions` (`CONDITIONAL_STRUCTURE_DISAGREEMENT`)

Partition / crosswalk réel :

- Reviewer A : item local `storm-03-a-item-004`
  - `storm-03-a-knowledge-073` → `equinoxe-q112`
  - `storm-03-a-knowledge-037` → `equinoxe-q083`
- Reviewer B : item local `storm-03-b-item-004`
  - `storm-03-b-knowledge-030` → `equinoxe-q083`
  - `storm-03-b-knowledge-029` → `equinoxe-q112`

### Candidate knowledge

| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente |
|---|---|---|---|
| `equinoxe-q083` | Y a-t-il un contact si j’ai une question qui n’est pas dans Storm ? | Vous pouvez contacter un ambassadeur de votre service ou l’équipe projet directement. | — |
| `equinoxe-q112` | Puis-je proposer une idée d’amélioration ? | Oui, vous pouvez transmettre vos idées à votre ambassadeur ou à l’équipe projet. | — |

### Human decision

```text
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 6. ambiguity-capacity-22 — Famille candidate 22

### Identification

- Item canonique : `ambiguity-capacity-22`
- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- Contexte métier réellement disponible : Actualités, feedback, évolution et contribution au projet

generated user formulation: NOT AVAILABLE

### Reviewer A

- Classification : `structuralAmbiguity`
- Mécanisme : `alternativeIntentReadings`
- Groupes couverts substantiellement différents :
  - Groupe 1 : `equinoxe-q078`, `equinoxe-q085`
  - Groupe 2 : `equinoxe-q110`, `equinoxe-q111`
  - Groupe 3 : `equinoxe-q112`

Rationales Reviewer A :

- `ambiguityFamilyDisposition`

> Suivre l’information, donner du feedback ou faire évoluer le projet, et proposer une idée sont distincts.

- `ambiguityMechanism`

> Mécanisme retenu : alternativeIntentReadings. Suivre l’information, donner du feedback ou faire évoluer le projet, et proposer une idée sont distincts.

- `substantiallyDifferentCoveredGroups`

> Partition Reviewer : [storm-03-a-knowledge-077, storm-03-a-knowledge-061] / [storm-03-a-knowledge-058, storm-03-a-knowledge-007] / [storm-03-a-knowledge-073].

### Reviewer B

- Classification : `artificialOrMalformed`
- Mécanisme : non applicable
- Groupes couverts substantiellement différents : non applicables dans cette décision.

Rationales Reviewer B :

- `ambiguityFamilyDisposition`

> Actualités, collecte de feedback, évolution du projet et proposition d’idée sont des interactions différentes avec le projet ; le brief les agrège sans référent ou intention unique susceptible de porter l’ambiguïté.

### Comparaison A/B

- Statut exact : `DECISION_VALUE_DISAGREEMENT`
- Accord de premier niveau : non
- Accord complet : non
- Accords stricts : aucun
- Désaccords consignés : `ambiguityFamilyDisposition.value` (`DECISION_VALUE_DISAGREEMENT`), `ambiguityFamilyDisposition.conditionalDecisions` (`CONDITIONAL_STRUCTURE_DISAGREEMENT`)

Partition / crosswalk réel :

- Reviewer A : item local `storm-03-a-item-034`
  - `storm-03-a-knowledge-077` → `equinoxe-q085`
  - `storm-03-a-knowledge-007` → `equinoxe-q111`
  - `storm-03-a-knowledge-058` → `equinoxe-q110`
  - `storm-03-a-knowledge-061` → `equinoxe-q078`
  - `storm-03-a-knowledge-073` → `equinoxe-q112`
- Reviewer B : item local `storm-03-b-item-018`
  - `storm-03-b-knowledge-069` → `equinoxe-q110`
  - `storm-03-b-knowledge-020` → `equinoxe-q111`
  - `storm-03-b-knowledge-041` → `equinoxe-q078`
  - `storm-03-b-knowledge-051` → `equinoxe-q085`
  - `storm-03-b-knowledge-029` → `equinoxe-q112`

### Candidate knowledge

| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente |
|---|---|---|---|
| `equinoxe-q078` | On peut suivre l’avancement du projet quelque part ? | Oui, les actualités et les jalons du projet sont mis à jour régulièrement dans Storm. | Groupe scellé : `equinoxe-q078`, `equinoxe-q085` ; preferredEntryId : `equinoxe-q078` |
| `equinoxe-q085` | Est-ce qu’il y aura des points d’étape réguliers ? | Oui, des actualités et jalons sont publiés régulièrement dans Storm au fil de l’avancement. | Groupe scellé : `equinoxe-q078`, `equinoxe-q085` ; preferredEntryId : `equinoxe-q078` |
| `equinoxe-q110` | Qui gère les premiers retours après l’ouverture du plateau témoin ? | L’équipe projet recueille les retours pour ajuster les choix avant le déménagement définitif. | — |
| `equinoxe-q111` | Le projet est-il définitif ou peut-il encore évoluer ? | Le projet reste ajustable : les usages seront observés après l’emménagement et des ajustements resteront possibles. | — |
| `equinoxe-q112` | Puis-je proposer une idée d’amélioration ? | Oui, vous pouvez transmettre vos idées à votre ambassadeur ou à l’équipe projet. | — |

### Human decision

```text
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 7. ambiguity-capacity-25 — Famille candidate 25

### Identification

- Item canonique : `ambiguity-capacity-25`
- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- Contexte métier réellement disponible : Choix d’espace pour un groupe de six à dix personnes

generated user formulation: NOT AVAILABLE

### Reviewer A

- Classification : `structuralAmbiguity`
- Mécanisme : `competingPublishedKnowledge`
- Groupes couverts substantiellement différents :
  - Groupe 1 : `equinoxe-q028`
  - Groupe 2 : `equinoxe-q029`
  - Groupe 3 : `equinoxe-q031`

Rationales Reviewer A :

- `ambiguityFamilyDisposition`

> Plusieurs espaces publiés peuvent convenir à un groupe de six à dix personnes avec des fonctions différentes.

- `ambiguityMechanism`

> Mécanisme retenu : competingPublishedKnowledge. Plusieurs espaces publiés peuvent convenir à un groupe de six à dix personnes avec des fonctions différentes.

- `substantiallyDifferentCoveredGroups`

> Partition Reviewer : [storm-03-a-knowledge-023] / [storm-03-a-knowledge-028] / [storm-03-a-knowledge-082].

### Reviewer B

- Classification : `structuralAmbiguity`
- Mécanisme : `alternativeIntentReadings`
- Groupes couverts substantiellement différents :
  - Groupe 1 : `equinoxe-q028`
  - Groupe 2 : `equinoxe-q029`
  - Groupe 3 : `equinoxe-q031`

Rationales Reviewer B :

- `ambiguityFamilyDisposition`

> Pour six à dix personnes, plusieurs espaces affichés peuvent être envisagés, mais leur capacité et leur finalité ne sont pas les mêmes.

- `ambiguityMechanism`

> Le choix dépend de l’usage du groupe, non précisé par la seule taille.

- `substantiallyDifferentCoveredGroups`

> Partition des groupes de réponses substantiellement différents : G1 salle de réunion = [storm-03-b-knowledge-049] ; G2 Project Room = [storm-03-b-knowledge-028] ; G3 Forum = [storm-03-b-knowledge-082].
> Rationale courte : Les groupes conduisent à des réponses métier substantiellement différentes.

### Comparaison A/B

- Statut exact : `MECHANISM_DISAGREEMENT`
- Accord de premier niveau : oui
- Accord complet : non
- Accords stricts : `ambiguityFamilyDisposition.value`, `substantiallyDifferentCoveredGroups.value`, `substantiallyDifferentCoveredGroups.canonicalPartition`
- Désaccords consignés : `ambiguityMechanism.value` (`MECHANISM_DISAGREEMENT`)

Partition / crosswalk réel :

- Reviewer A : item local `storm-03-a-item-007`
  - `storm-03-a-knowledge-023` → `equinoxe-q031`
  - `storm-03-a-knowledge-028` → `equinoxe-q028`
  - `storm-03-a-knowledge-082` → `equinoxe-q029`
- Reviewer B : item local `storm-03-b-item-007`
  - `storm-03-b-knowledge-049` → `equinoxe-q028`
  - `storm-03-b-knowledge-082` → `equinoxe-q029`
  - `storm-03-b-knowledge-028` → `equinoxe-q031`

### Candidate knowledge

| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente |
|---|---|---|---|
| `equinoxe-q028` | Quelle est la capacité des salles de réunion ? | Les salles de réunion accueillent de 4 à 16 personnes, en présentiel ou hybride. | — |
| `equinoxe-q029` | Le Forum, c’est pour quoi ? | Le Forum est un espace pour les événements et prises de parole, jusqu’à 120 personnes. | — |
| `equinoxe-q031` | Combien de personnes dans une Project Room ? | Les Project Rooms accueillent de 6 à 10 personnes. | — |

### Human decision

```text
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 8. ambiguity-capacity-29 — Famille candidate 29

### Identification

- Item canonique : `ambiguity-capacity-29`
- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- Contexte métier réellement disponible : Accès libre, disponibilité et espace ouvert

generated user formulation: NOT AVAILABLE

### Reviewer A

- Classification : `structuralAmbiguity`
- Mécanisme : `alternativeIntentReadings`
- Groupes couverts substantiellement différents :
  - Groupe 1 : `equinoxe-q020`
  - Groupe 2 : `equinoxe-q089`
  - Groupe 3 : `equinoxe-q091`

Rationales Reviewer A :

- `ambiguityFamilyDisposition`

> Accès libre, ouverture physique et disponibilité instantanée sont distincts.

- `ambiguityMechanism`

> Mécanisme retenu : alternativeIntentReadings. Accès libre, ouverture physique et disponibilité instantanée sont distincts.

- `substantiallyDifferentCoveredGroups`

> Partition Reviewer : [storm-03-a-knowledge-011] / [storm-03-a-knowledge-040] / [storm-03-a-knowledge-044].

### Reviewer B

- Classification : `artificialOrMalformed`
- Mécanisme : non applicable
- Groupes couverts substantiellement différents : non applicables dans cette décision.

Rationales Reviewer B :

- `ambiguityFamilyDisposition`

> Disponibilité d’une salle, ouverture physique d’un espace Focus et accès libre à la Bibliothèque sont trois sens différents de « libre/ouvert » sans référent métier commun.

### Comparaison A/B

- Statut exact : `DECISION_VALUE_DISAGREEMENT`
- Accord de premier niveau : non
- Accord complet : non
- Accords stricts : aucun
- Désaccords consignés : `ambiguityFamilyDisposition.value` (`DECISION_VALUE_DISAGREEMENT`), `ambiguityFamilyDisposition.conditionalDecisions` (`CONDITIONAL_STRUCTURE_DISAGREEMENT`)

Partition / crosswalk réel :

- Reviewer A : item local `storm-03-a-item-012`
  - `storm-03-a-knowledge-011` → `equinoxe-q020`
  - `storm-03-a-knowledge-040` → `equinoxe-q091`
  - `storm-03-a-knowledge-044` → `equinoxe-q089`
- Reviewer B : item local `storm-03-b-item-011`
  - `storm-03-b-knowledge-077` → `equinoxe-q089`
  - `storm-03-b-knowledge-007` → `equinoxe-q091`
  - `storm-03-b-knowledge-036` → `equinoxe-q020`

### Candidate knowledge

| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente |
|---|---|---|---|
| `equinoxe-q020` | Faut-il réserver pour aller à la Bibliothèque ? | Non, la Bibliothèque fonctionne en accès libre. | — |
| `equinoxe-q089` | Comment savoir si une salle est libre ? | L’outil de réservation habituel indique la disponibilité des salles en temps réel. | — |
| `equinoxe-q091` | Les espaces Focus sont-ils fermés ou ouverts ? | Ce sont des postes individuels isolés, pensés pour limiter les distractions sans être totalement cloisonnés. | — |

### Human decision

```text
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 9. ambiguity-capacity-30 — Famille candidate 30

### Identification

- Item canonique : `ambiguity-capacity-30`
- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- Contexte métier réellement disponible : Créer, vérifier ou annuler une réservation

generated user formulation: NOT AVAILABLE

### Reviewer A

- Classification : `structuralAmbiguity`
- Mécanisme : `alternativeIntentReadings`
- Groupes couverts substantiellement différents :
  - Groupe 1 : `equinoxe-q019`, `equinoxe-q022`, `equinoxe-q053`
  - Groupe 2 : `equinoxe-q089`
  - Groupe 3 : `equinoxe-q090`

Rationales Reviewer A :

- `ambiguityFamilyDisposition`

> Créer une réservation, vérifier une disponibilité et annuler sont des intentions distinctes.

- `ambiguityMechanism`

> Mécanisme retenu : alternativeIntentReadings. Créer une réservation, vérifier une disponibilité et annuler sont des intentions distinctes.

- `substantiallyDifferentCoveredGroups`

> Partition Reviewer : [storm-03-a-knowledge-031, storm-03-a-knowledge-030, storm-03-a-knowledge-019] / [storm-03-a-knowledge-044] / [storm-03-a-knowledge-066].

### Reviewer B

- Classification : `structuralAmbiguity`
- Mécanisme : `alternativeIntentReadings`
- Groupes couverts substantiellement différents :
  - Groupe 1 : `equinoxe-q019`, `equinoxe-q053`
  - Groupe 2 : `equinoxe-q022`
  - Groupe 3 : `equinoxe-q089`
  - Groupe 4 : `equinoxe-q090`

Rationales Reviewer B :

- `ambiguityFamilyDisposition`

> Le même domaine de réservation couvre des actions différentes et, pour la création, des règles différentes selon le type d’espace.

- `ambiguityMechanism`

> L’intention opérationnelle — vérifier, annuler ou créer — change la réponse à fournir.

- `substantiallyDifferentCoveredGroups`

> Partition des groupes de réponses substantiellement différents : G1 vérifier la disponibilité = [storm-03-b-knowledge-077] ; G2 annuler une réservation = [storm-03-b-knowledge-045] ; G3 réserver une Project Room = [storm-03-b-knowledge-047] ; G4 réserver une salle de réunion = [storm-03-b-knowledge-006, storm-03-b-knowledge-053].
> Rationale courte : Les groupes conduisent à des réponses métier substantiellement différentes.

### Comparaison A/B

- Statut exact : `PARTITION_DISAGREEMENT`
- Accord de premier niveau : oui
- Accord complet : non
- Accords stricts : `ambiguityFamilyDisposition.value`, `ambiguityMechanism.value`, `substantiallyDifferentCoveredGroups.value`
- Désaccords consignés : `substantiallyDifferentCoveredGroups.canonicalPartition` (`PARTITION_DISAGREEMENT`)

Partition / crosswalk réel :

- Reviewer A : item local `storm-03-a-item-010`
  - `storm-03-a-knowledge-031` → `equinoxe-q019`
  - `storm-03-a-knowledge-030` → `equinoxe-q053`
  - `storm-03-a-knowledge-044` → `equinoxe-q089`
  - `storm-03-a-knowledge-066` → `equinoxe-q090`
  - `storm-03-a-knowledge-019` → `equinoxe-q022`
- Reviewer B : item local `storm-03-b-item-003`
  - `storm-03-b-knowledge-077` → `equinoxe-q089`
  - `storm-03-b-knowledge-045` → `equinoxe-q090`
  - `storm-03-b-knowledge-047` → `equinoxe-q022`
  - `storm-03-b-knowledge-006` → `equinoxe-q053`
  - `storm-03-b-knowledge-053` → `equinoxe-q019`

### Candidate knowledge

| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente |
|---|---|---|---|
| `equinoxe-q019` | Comment je réserve une salle de réunion ? | Via l’outil de réservation habituel, qui reste inchangé pour les salles de réunion. | Groupe scellé : `equinoxe-q019`, `equinoxe-q053` ; preferredEntryId : `equinoxe-q019` |
| `equinoxe-q022` | Peut-on réserver une Project Room à l’avance ? | Oui, les Project Rooms se réservent à la demi-journée ou à la journée. | — |
| `equinoxe-q053` | Comment réserver une salle pour un entretien annuel ? | Via l’outil de réservation habituel des salles de réunion. | Groupe scellé : `equinoxe-q019`, `equinoxe-q053` ; preferredEntryId : `equinoxe-q019` |
| `equinoxe-q089` | Comment savoir si une salle est libre ? | L’outil de réservation habituel indique la disponibilité des salles en temps réel. | — |
| `equinoxe-q090` | Peut-on annuler une réservation de Project Room ? | Oui, les réservations peuvent être annulées via l’outil de réservation. | — |

### Human decision

```text
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 10. ambiguity-capacity-33 — Famille candidate 33

### Identification

- Item canonique : `ambiguity-capacity-33`
- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- Contexte métier réellement disponible : Nombre de niveaux du bâtiment et population accueillie

generated user formulation: NOT AVAILABLE

### Reviewer A

- Classification : `structuralAmbiguity`
- Mécanisme : `underspecifiedReference`
- Groupes couverts substantiellement différents :
  - Groupe 1 : `equinoxe-q075`
  - Groupe 2 : `equinoxe-q076`

Rationales Reviewer A :

- `ambiguityFamilyDisposition`

> Le nombre peut viser les collaborateurs ou les niveaux du bâtiment.

- `ambiguityMechanism`

> Mécanisme retenu : underspecifiedReference. Le nombre peut viser les collaborateurs ou les niveaux du bâtiment.

- `substantiallyDifferentCoveredGroups`

> Partition Reviewer : [storm-03-a-knowledge-002] / [storm-03-a-knowledge-068].

### Reviewer B

- Classification : `artificialOrMalformed`
- Mécanisme : non applicable
- Groupes couverts substantiellement différents : non applicables dans cette décision.

Rationales Reviewer B :

- `ambiguityFamilyDisposition`

> Le nombre de niveaux du bâtiment et le nombre de collaborateurs sont deux quantités sans même objet métier ; la proximité repose seulement sur une question de comptage.

### Comparaison A/B

- Statut exact : `DECISION_VALUE_DISAGREEMENT`
- Accord de premier niveau : non
- Accord complet : non
- Accords stricts : aucun
- Désaccords consignés : `ambiguityFamilyDisposition.value` (`DECISION_VALUE_DISAGREEMENT`), `ambiguityFamilyDisposition.conditionalDecisions` (`CONDITIONAL_STRUCTURE_DISAGREEMENT`)

Partition / crosswalk réel :

- Reviewer A : item local `storm-03-a-item-032`
  - `storm-03-a-knowledge-002` → `equinoxe-q076`
  - `storm-03-a-knowledge-068` → `equinoxe-q075`
- Reviewer B : item local `storm-03-b-item-012`
  - `storm-03-b-knowledge-002` → `equinoxe-q075`
  - `storm-03-b-knowledge-038` → `equinoxe-q076`

### Candidate knowledge

| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente |
|---|---|---|---|
| `equinoxe-q075` | Il y a combien d’étages ? | Le bâtiment compte 8 niveaux. | — |
| `equinoxe-q076` | Combien de personnes vont travailler à Cobalt ? | Environ 640 collaborateurs sont concernés par le projet. | — |

### Human decision

```text
decision: PENDING
rationale: PENDING
future_rule: PENDING
```
