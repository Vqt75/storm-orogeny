# Adjudication structurelle — Batch 05 : scenario families 02

- Batch : `adjudication-batch-05-scenario-families-02`
- Statut : `PENDING_HUMAN_REVIEW`
- Autorisation de génération : `false`
- Adjudication effectuée : `false`
- Items : 8

## Doctrine de revue

- Une scenario family n’est pas un groupe d’équivalence de réponses.
- Une scenario family peut regrouper des formulations proches sans que leurs réponses soient équivalentes.
- La famille doit néanmoins représenter un même scénario métier suffisamment stable.
- Une proximité seulement lexicale ou thématique ne suffit pas.
- Une famille trop large ne doit pas mélanger plusieurs décisions utilisateur.
- Les décisions humaines structurent la future génération du corpus.
- `generationAuthorized` reste `false`.

> Question d’arbitrage : ces connaissances décrivent-elles le même scénario utilisateur suffisamment cohérent pour partager une famille de génération, ou faut-il les séparer ?
> Aucun `scenarioFamilyId` ni aucune formulation utilisateur générée n’existe encore dans les artefacts sources.

## 1. scenario-family-preflight-14 — Brief de famille 14

### Identification

- Item canonique : `scenario-family-preflight-14`
- Contexte métier réellement disponible : Lieux de restauration et permission d’usage

generated user formulation: NOT AVAILABLE

### Reviewer A

- Disposition : `distinct`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q064`, `equinoxe-q072`, `equinoxe-q092`
- Candidats de fusion : aucun

Rationales Reviewer A :

- Disposition : Lieux de restauration et permission de manger à son poste.
- Partition : Groupe Reviewer local F01 : [storm-04-a-knowledge-054, storm-04-a-knowledge-019, storm-04-a-knowledge-015]. Lieux de restauration et permission de manger à son poste.

### Reviewer B

- Disposition : `distinct`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q064`
  - Groupe 2 : `equinoxe-q072`, `equinoxe-q092`
- Candidats de fusion : aucun

Rationales Reviewer B :

- Disposition : Le brief reste centré sur la situation de restauration sur site et ne duplique pas entièrement le brief consacré aux usages plus larges de la Terrasse.
- Partition : Groupes/familles proposés : G1 règle et lieux adaptés pour manger = [storm-04-b-knowledge-067, storm-04-b-knowledge-030] ; G2 déjeuner en extérieur sur la Terrasse = [storm-04-b-knowledge-004].
Rationale courte : Les connaissances couvrent où manger et le cas spécifique du déjeuner dehors, dans un même besoin de choix de lieu de restauration.

### Comparaison A/B

- Statut exact : `PARTITION_DISAGREEMENT`
- Accord de premier niveau : oui
- Accord complet : non
- Accords stricts : `fragmentationAssessment.value`, `fragmentationAssessment.mergeCanonicalReviewItemIds`, `reviewerScenarioFamilyPartition.value`
- Désaccords consignés : `reviewerScenarioFamilyPartition.canonicalPartition` (`PARTITION_DISAGREEMENT`)

Partition / crosswalk réel :

- Reviewer A : item local `storm-04-a-item-001`
  - `storm-04-a-knowledge-054` → `equinoxe-q072`
  - `storm-04-a-knowledge-019` → `equinoxe-q092`
  - `storm-04-a-knowledge-015` → `equinoxe-q064`
- Reviewer B : item local `storm-04-b-item-024`
  - `storm-04-b-knowledge-004` → `equinoxe-q064`
  - `storm-04-b-knowledge-067` → `equinoxe-q092`
  - `storm-04-b-knowledge-030` → `equinoxe-q072`

### Candidate knowledge

| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente | Scenario family existante |
|---|---|---|---|---|
| `equinoxe-q064` | Puis-je déjeuner dehors quand il fait beau ? | Oui, une terrasse d’environ 70 places est prévue. | — | non attribuée |
| `equinoxe-q072` | Et pour manger le midi, on fait comment ? | Vous pourrez utiliser le restaurant (environ 220 places), le Café central ou la Terrasse selon vos envies. | — | non attribuée |
| `equinoxe-q092` | Peut-on manger à son poste ? | Les espaces prévus pour la restauration sont le Café central, le Restaurant et la Terrasse, plutôt que les postes de travail. | — | non attribuée |

### Existing adjudication context

#### ambiguity-capacity-11

- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- q-ids du présent brief directement concernés : `equinoxe-q064`
- Classification scellée : `structuralAmbiguity`
- Mécanisme scellé : `alternativeIntentReadings`
- Groupes scellés :
  - Groupe 1 : `equinoxe-q032`
  - Groupe 2 : `equinoxe-q064`
- Rationale humaine scellée : La terrasse peut servir aux échanges informels et au déjeuner extérieur. Ces connaissances ne sont pas concurrentes ou contradictoires. Elles représentent deux intentions compatibles mais différentes qu’une formulation insuffisamment spécifique sur « l’usage de la terrasse » peut viser.
- Règle future scellée : Des usages compatibles ne sont jamais `competingPublishedKnowledge`; s’ils représentent des intentions distinctes sous une formulation réellement ambiguë, utiliser `alternativeIntentReadings`.

#### ambiguity-capacity-14

- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- q-ids du présent brief directement concernés : `equinoxe-q064`, `equinoxe-q072`, `equinoxe-q092`
- Classification scellée : `artificialOrMalformed`
- Mécanisme scellé : non applicable
- Rationale humaine scellée : `q072` couvre déjà l’intention générale de choix d’un lieu de déjeuner. `q064` affine le cas spécifique du déjeuner en terrasse et `q092` ajoute une contrainte d’usage concernant les postes de travail. Il s’agit d’une structure général → cas particulier → règle, pas de trois lectures qu’il faudrait nécessairement départager.
- Règle future scellée : Lorsqu’une entrée générale couvre l’intention et que les autres sont des raffinements ou contraintes, ne pas fabriquer une ambiguïté simplement parce que plusieurs Q&A concernent le même domaine.

#### scenario-family-preflight-09

- Type : `SCENARIO_FAMILY_PREFLIGHT`
- q-ids du présent brief directement concernés : `equinoxe-q064`
- Disposition scellée : `distinct`
- Candidats de fusion scellés : aucun
- Structure de partition scellée : `reviewerDefinedFamilyGroups`
- Groupes de scénario scellés :
  - Groupe 1 : `equinoxe-q061`
  - Groupe 2 : `equinoxe-q064`
- Rationale humaine scellée : Restaurant et Terrasse appartiennent au même univers d’usage lié au déjeuner, mais les questions portent sur deux ressources et deux besoins différents : capacité du restaurant pour `q061`, possibilité de déjeuner dehors sur la Terrasse pour `q064`.

La partition doit donc conserver le type de lieu comme variable structurante.
- Règle future scellée : Une scenario family peut regrouper des besoins appartenant au même moment d’usage, mais les branches doivent rester séparées lorsque le lieu ou la ressource modifie substantiellement la question et la réponse.

> Ce contexte scellé est restitué sans réinterprétation et ne préremplit pas la décision scenario-family.

### Human decision

```text
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 2. scenario-family-preflight-16 — Brief de famille 16

### Identification

- Item canonique : `scenario-family-preflight-16`
- Contexte métier réellement disponible : Règle projet, calendrier et autorité managériale de présence

generated user formulation: NOT AVAILABLE

### Reviewer A

- Disposition : `distinct`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q040`, `equinoxe-q042`, `equinoxe-q043`, `equinoxe-q044`
- Candidats de fusion : aucun

Rationales Reviewer A :

- Disposition : Règles de télétravail, présence minimale et autorité managériale.
- Partition : Groupe Reviewer local F15 : [storm-04-a-knowledge-013, storm-04-a-knowledge-068, storm-04-a-knowledge-001, storm-04-a-knowledge-050]. Règles de télétravail, présence minimale et autorité managériale.

### Reviewer B

- Disposition : `mergeWithAnotherDisplayedBrief`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q040`, `equinoxe-q042`, `equinoxe-q043`
  - Groupe 2 : `equinoxe-q044`
- Candidats de fusion : `scenario-family-preflight-15`

Rationales Reviewer B :

- Disposition : storm-04-b-item-030 couvre le même besoin de politique de présence et de fréquence sur site ; le présent brief ajoute l’angle manager mais reste dans la même famille.
- Partition : Groupes/familles proposés : G1 règle du projet sur télétravail/présence = [storm-04-b-knowledge-027, storm-04-b-knowledge-008, storm-04-b-knowledge-022] ; G2 règle d’équipe/autorité du manager = [storm-04-b-knowledge-071].
Rationale courte : Les connaissances distinguent ce que Cobalt change ou non de ce qui relève des règles en vigueur dans l’équipe.

### Comparaison A/B

- Statut exact : `DECISION_VALUE_DISAGREEMENT`
- Accord de premier niveau : non
- Accord complet : non
- Accords stricts : `reviewerScenarioFamilyPartition.value`
- Désaccords consignés : `fragmentationAssessment.value` (`DECISION_VALUE_DISAGREEMENT`), `reviewerScenarioFamilyPartition.canonicalPartition` (`PARTITION_DISAGREEMENT`), `fragmentationAssessment.mergeCanonicalReviewItemIds` (`CONDITIONAL_STRUCTURE_DISAGREEMENT`)

Partition / crosswalk réel :

- Reviewer A : item local `storm-04-a-item-020`
  - `storm-04-a-knowledge-013` → `equinoxe-q044`
  - `storm-04-a-knowledge-068` → `equinoxe-q043`
  - `storm-04-a-knowledge-001` → `equinoxe-q042`
  - `storm-04-a-knowledge-050` → `equinoxe-q040`
- Reviewer B : item local `storm-04-b-item-027`
  - `storm-04-b-knowledge-027` → `equinoxe-q042`
  - `storm-04-b-knowledge-071` → `equinoxe-q044`
  - `storm-04-b-knowledge-008` → `equinoxe-q043`
  - `storm-04-b-knowledge-022` → `equinoxe-q040`

### Candidate knowledge

| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente | Scenario family existante |
|---|---|---|---|---|
| `equinoxe-q040` | Le projet change-t-il le télétravail ? | Non. | — | non attribuée |
| `equinoxe-q042` | Les jours de télétravail restent-ils les mêmes ? | Oui, aucun changement n’est prévu sur l’organisation du télétravail. | — | non attribuée |
| `equinoxe-q043` | Cobalt va-t-il imposer une présence minimale ? | Non, le projet Cobalt porte sur les espaces, pas sur les règles de présence. | — | non attribuée |
| `equinoxe-q044` | Mon manager peut-il m’imposer des jours fixes au bureau ? | Les règles de télétravail restent celles en vigueur dans votre équipe, inchangées par le projet. | — | non attribuée |

### Existing adjudication context

#### ambiguity-capacity-16

- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- q-ids du présent brief directement concernés : `equinoxe-q040`, `equinoxe-q042`, `equinoxe-q043`, `equinoxe-q044`
- Classification scellée : `structuralAmbiguity`
- Mécanisme scellé : `alternativeIntentReadings`
- Groupes scellés :
  - Groupe 1 : `equinoxe-q040`, `equinoxe-q042`, `equinoxe-q043`
  - Groupe 2 : `equinoxe-q044`
- Rationale humaine scellée : `q040`, `q042` et `q043` expriment une même vérité de portée projet : Cobalt ne modifie pas les règles de télétravail ni n’impose de présence minimale. `q044` relève d’une autre source d’autorité : les règles en vigueur dans l’équipe et l’autorité managériale. La bonne partition est donc la source de la règle, pas la formulation de surface.
- Règle future scellée : Pour les règles d’organisation du travail, partitionner d’abord par source d’autorité : règle du projet vs règle de l’équipe/du manager, plutôt que par vocabulaire de surface.

> Ce contexte scellé est restitué sans réinterprétation et ne préremplit pas la décision scenario-family.

### Human decision

```text
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 3. scenario-family-preflight-17 — Brief de famille 17

### Identification

- Item canonique : `scenario-family-preflight-17`
- Contexte métier réellement disponible : Ouverture, rôle expérimental et collecte de retours du pilote

generated user formulation: NOT AVAILABLE

### Reviewer A

- Disposition : `distinct`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q006`, `equinoxe-q079`, `equinoxe-q110`
- Candidats de fusion : aucun

Rationales Reviewer A :

- Disposition : Pilote : ouverture, rôle expérimental et collecte de retours.
- Partition : Groupe Reviewer local F02 : [storm-04-a-knowledge-048, storm-04-a-knowledge-011, storm-04-a-knowledge-051]. Pilote : ouverture, rôle expérimental et collecte de retours.

### Reviewer B

- Disposition : `mergeWithAnotherDisplayedBrief`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q006`
  - Groupe 2 : `equinoxe-q079`
  - Groupe 3 : `equinoxe-q110`
- Candidats de fusion : `scenario-family-preflight-18`

Rationales Reviewer B :

- Disposition : storm-04-b-item-021 couvre déjà le rôle expérimental et les retours du plateau témoin, dans le même cycle d’essai et d’ajustement.
- Partition : Groupes/familles proposés : G1 ouverture du plateau témoin = [storm-04-b-knowledge-081] ; G2 rôle expérimental = [storm-04-b-knowledge-019] ; G3 collecte de retours = [storm-04-b-knowledge-054].
Rationale courte : Les trois connaissances décrivent le même dispositif pilote sous ses dimensions de calendrier, finalité et feedback.

### Comparaison A/B

- Statut exact : `DECISION_VALUE_DISAGREEMENT`
- Accord de premier niveau : non
- Accord complet : non
- Accords stricts : `reviewerScenarioFamilyPartition.value`
- Désaccords consignés : `fragmentationAssessment.value` (`DECISION_VALUE_DISAGREEMENT`), `reviewerScenarioFamilyPartition.canonicalPartition` (`PARTITION_DISAGREEMENT`), `fragmentationAssessment.mergeCanonicalReviewItemIds` (`CONDITIONAL_STRUCTURE_DISAGREEMENT`)

Partition / crosswalk réel :

- Reviewer A : item local `storm-04-a-item-002`
  - `storm-04-a-knowledge-048` → `equinoxe-q079`
  - `storm-04-a-knowledge-011` → `equinoxe-q006`
  - `storm-04-a-knowledge-051` → `equinoxe-q110`
- Reviewer B : item local `storm-04-b-item-032`
  - `storm-04-b-knowledge-081` → `equinoxe-q006`
  - `storm-04-b-knowledge-054` → `equinoxe-q110`
  - `storm-04-b-knowledge-019` → `equinoxe-q079`

### Candidate knowledge

| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente | Scenario family existante |
|---|---|---|---|---|
| `equinoxe-q006` | Quand le plateau témoin a-t-il ouvert ? | Le plateau témoin a ouvert ses portes le 27 juillet 2026. | — | non attribuée |
| `equinoxe-q079` | Le mobilier du plateau témoin, c’est celui qu’on aura à Cobalt ? | Le plateau témoin permet de tester les mobiliers et futurs usages envisagés pour Cobalt. | — | non attribuée |
| `equinoxe-q110` | Qui gère les premiers retours après l’ouverture du plateau témoin ? | L’équipe projet recueille les retours pour ajuster les choix avant le déménagement définitif. | — | non attribuée |

### Existing adjudication context

#### boundary-communication-pilot

- Type : `KNOWLEDGE_BOUNDARIES`
- q-ids du présent brief directement concernés : `equinoxe-q006`, `equinoxe-q079`, `equinoxe-q110`
- Partition de frontière scellée :
  - `EXPERIMENT_FEEDBACK` : `equinoxe-q006`, `equinoxe-q079`, `equinoxe-q110`, `equinoxe-q111`, `equinoxe-q112`
  - `INFO_QUESTIONS` : `equinoxe-q008`, `equinoxe-q078`, `equinoxe-q085`
  - `AMBASSADORS_CONTACTS` : `equinoxe-q077`, `equinoxe-q083`, `equinoxe-q106`, `equinoxe-q107`
- Règles de frontière scellées :
  - `INFO_QUESTIONS` : information / questions projet
  - `AMBASSADORS_CONTACTS` : acteurs humains / ambassadeurs / contacts
  - `EXPERIMENT_FEEDBACK` : expérimentation / retours / contribution / évolution du projet
- Rationale humaine scellée : Conserver la structure Reviewer A.

equinoxe-q083 appartient à AMBASSADORS_CONTACTS : la demande porte explicitement sur la personne à contacter lorsqu’une réponse n’est pas disponible, et la connaissance désigne un ambassadeur ou l’équipe projet.

Ne pas la rattacher au simple canal d’information au motif qu’elle contient le mot « question ».

#### ambiguity-capacity-17

- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- q-ids du présent brief directement concernés : `equinoxe-q006`, `equinoxe-q079`, `equinoxe-q110`
- Classification scellée : `artificialOrMalformed`
- Mécanisme scellé : non applicable
- Rationale humaine scellée : La date d’ouverture, le rôle expérimental du plateau témoin et la collecte des retours sont des propriétés complémentaires du même dispositif. Elles peuvent être expliquées ensemble et ne forcent pas un choix entre plusieurs réponses substantiellement concurrentes.
- Règle future scellée : Des attributs complémentaires d’un même dispositif ne forment pas une ambiguïté structurelle lorsqu’ils peuvent être expliqués ensemble sans contradiction ni choix exclusif.

#### ambiguity-capacity-18

- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- q-ids du présent brief directement concernés : `equinoxe-q079`, `equinoxe-q110`
- Classification scellée : `structuralAmbiguity`
- Mécanisme scellé : `alternativeIntentReadings`
- Groupes scellés :
  - Groupe 1 : `equinoxe-q079`, `equinoxe-q110`
  - Groupe 2 : `equinoxe-q111`
- Rationale humaine scellée : `q079` et `q110` décrivent la phase d’essai et de collecte des retours avant le déménagement définitif. `q111` décrit l’observation et les ajustements possibles après l’emménagement. Une demande générale sur la possibilité de tester ou faire évoluer le projet peut donc viser deux phases métier différentes.
- Règle future scellée : Quand une possibilité d’ajustement existe à plusieurs phases du projet, partitionner par phase métier si les mécanismes et temporalités de décision diffèrent substantiellement.

#### ambiguity-capacity-22

- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- q-ids du présent brief directement concernés : `equinoxe-q110`
- Classification scellée : `artificialOrMalformed`
- Mécanisme scellé : non applicable
- Rationale humaine scellée : Suivre les actualités, donner du feedback, constater l’évolution du projet et proposer une idée sont plusieurs formes d’interaction avec le projet agrégées sous un thème très large. Aucun référent ou intention unique ne crée ici une hésitation plausible entre réponses substantiellement différentes.
- Règle future scellée : Ne pas transformer une catégorie thématique large en famille d’ambiguïté : il faut une formulation plausible pouvant réellement hésiter entre plusieurs réponses substantielles.

> Ce contexte scellé est restitué sans réinterprétation et ne préremplit pas la décision scenario-family.

### Human decision

```text
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 4. scenario-family-preflight-18 — Brief de famille 18

### Identification

- Item canonique : `scenario-family-preflight-18`
- Contexte métier réellement disponible : Essai, feedback avant déménagement et évolution ultérieure

generated user formulation: NOT AVAILABLE

### Reviewer A

- Disposition : `mergeWithAnotherDisplayedBrief`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q079`, `equinoxe-q110`, `equinoxe-q111`
- Candidats de fusion : `scenario-family-preflight-17`

Rationales Reviewer A :

- Disposition : Même scénario pilote que l’item 002 : test, feedback et ajustement.
- Partition : Groupe Reviewer local F02 : [storm-04-a-knowledge-020, storm-04-a-knowledge-051, storm-04-a-knowledge-048]. Même scénario pilote que l’item 002 : test, feedback et ajustement.

### Reviewer B

- Disposition : `mergeWithAnotherDisplayedBrief`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q079`
  - Groupe 2 : `equinoxe-q110`
  - Groupe 3 : `equinoxe-q111`
- Candidats de fusion : `scenario-family-preflight-17`

Rationales Reviewer B :

- Disposition : storm-04-b-item-032 couvre le même pilote avec son rôle expérimental et la collecte de retours ; les deux briefs décrivent le même besoin de compréhension du cycle du plateau témoin.
- Partition : Groupes/familles proposés : G1 expérimentation du plateau témoin = [storm-04-b-knowledge-019] ; G2 collecte de feedback avant déménagement = [storm-04-b-knowledge-054] ; G3 évolution après emménagement = [storm-04-b-knowledge-055].
Rationale courte : Les connaissances décrivent le cycle d’essai, de retour et d’ajustement du projet.

### Comparaison A/B

- Statut exact : `PARTITION_DISAGREEMENT`
- Accord de premier niveau : oui
- Accord complet : non
- Accords stricts : `fragmentationAssessment.value`, `fragmentationAssessment.mergeCanonicalReviewItemIds`, `reviewerScenarioFamilyPartition.value`
- Désaccords consignés : `reviewerScenarioFamilyPartition.canonicalPartition` (`PARTITION_DISAGREEMENT`)

Partition / crosswalk réel :

- Reviewer A : item local `storm-04-a-item-007`
  - `storm-04-a-knowledge-020` → `equinoxe-q111`
  - `storm-04-a-knowledge-051` → `equinoxe-q110`
  - `storm-04-a-knowledge-048` → `equinoxe-q079`
- Reviewer B : item local `storm-04-b-item-021`
  - `storm-04-b-knowledge-019` → `equinoxe-q079`
  - `storm-04-b-knowledge-054` → `equinoxe-q110`
  - `storm-04-b-knowledge-055` → `equinoxe-q111`

### Candidate knowledge

| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente | Scenario family existante |
|---|---|---|---|---|
| `equinoxe-q079` | Le mobilier du plateau témoin, c’est celui qu’on aura à Cobalt ? | Le plateau témoin permet de tester les mobiliers et futurs usages envisagés pour Cobalt. | — | non attribuée |
| `equinoxe-q110` | Qui gère les premiers retours après l’ouverture du plateau témoin ? | L’équipe projet recueille les retours pour ajuster les choix avant le déménagement définitif. | — | non attribuée |
| `equinoxe-q111` | Le projet est-il définitif ou peut-il encore évoluer ? | Le projet reste ajustable : les usages seront observés après l’emménagement et des ajustements resteront possibles. | — | non attribuée |

### Existing adjudication context

#### boundary-communication-pilot

- Type : `KNOWLEDGE_BOUNDARIES`
- q-ids du présent brief directement concernés : `equinoxe-q079`, `equinoxe-q110`, `equinoxe-q111`
- Partition de frontière scellée :
  - `EXPERIMENT_FEEDBACK` : `equinoxe-q006`, `equinoxe-q079`, `equinoxe-q110`, `equinoxe-q111`, `equinoxe-q112`
  - `INFO_QUESTIONS` : `equinoxe-q008`, `equinoxe-q078`, `equinoxe-q085`
  - `AMBASSADORS_CONTACTS` : `equinoxe-q077`, `equinoxe-q083`, `equinoxe-q106`, `equinoxe-q107`
- Règles de frontière scellées :
  - `INFO_QUESTIONS` : information / questions projet
  - `AMBASSADORS_CONTACTS` : acteurs humains / ambassadeurs / contacts
  - `EXPERIMENT_FEEDBACK` : expérimentation / retours / contribution / évolution du projet
- Rationale humaine scellée : Conserver la structure Reviewer A.

equinoxe-q083 appartient à AMBASSADORS_CONTACTS : la demande porte explicitement sur la personne à contacter lorsqu’une réponse n’est pas disponible, et la connaissance désigne un ambassadeur ou l’équipe projet.

Ne pas la rattacher au simple canal d’information au motif qu’elle contient le mot « question ».

#### ambiguity-capacity-17

- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- q-ids du présent brief directement concernés : `equinoxe-q079`, `equinoxe-q110`
- Classification scellée : `artificialOrMalformed`
- Mécanisme scellé : non applicable
- Rationale humaine scellée : La date d’ouverture, le rôle expérimental du plateau témoin et la collecte des retours sont des propriétés complémentaires du même dispositif. Elles peuvent être expliquées ensemble et ne forcent pas un choix entre plusieurs réponses substantiellement concurrentes.
- Règle future scellée : Des attributs complémentaires d’un même dispositif ne forment pas une ambiguïté structurelle lorsqu’ils peuvent être expliqués ensemble sans contradiction ni choix exclusif.

#### ambiguity-capacity-18

- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- q-ids du présent brief directement concernés : `equinoxe-q079`, `equinoxe-q110`, `equinoxe-q111`
- Classification scellée : `structuralAmbiguity`
- Mécanisme scellé : `alternativeIntentReadings`
- Groupes scellés :
  - Groupe 1 : `equinoxe-q079`, `equinoxe-q110`
  - Groupe 2 : `equinoxe-q111`
- Rationale humaine scellée : `q079` et `q110` décrivent la phase d’essai et de collecte des retours avant le déménagement définitif. `q111` décrit l’observation et les ajustements possibles après l’emménagement. Une demande générale sur la possibilité de tester ou faire évoluer le projet peut donc viser deux phases métier différentes.
- Règle future scellée : Quand une possibilité d’ajustement existe à plusieurs phases du projet, partitionner par phase métier si les mécanismes et temporalités de décision diffèrent substantiellement.

#### ambiguity-capacity-22

- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- q-ids du présent brief directement concernés : `equinoxe-q110`, `equinoxe-q111`
- Classification scellée : `artificialOrMalformed`
- Mécanisme scellé : non applicable
- Rationale humaine scellée : Suivre les actualités, donner du feedback, constater l’évolution du projet et proposer une idée sont plusieurs formes d’interaction avec le projet agrégées sous un thème très large. Aucun référent ou intention unique ne crée ici une hésitation plausible entre réponses substantiellement différentes.
- Règle future scellée : Ne pas transformer une catégorie thématique large en famille d’ambiguïté : il faut une formulation plausible pouvant réellement hésiter entre plusieurs réponses substantielles.

> Ce contexte scellé est restitué sans réinterprétation et ne préremplit pas la décision scenario-family.

### Human decision

```text
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 5. scenario-family-preflight-19 — Brief de famille 19

### Identification

- Item canonique : `scenario-family-preflight-19`
- Contexte métier réellement disponible : Poser une question et recevoir les actualités projet

generated user formulation: NOT AVAILABLE

### Reviewer A

- Disposition : `distinct`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q008`, `equinoxe-q078`, `equinoxe-q085`
- Candidats de fusion : aucun

Rationales Reviewer A :

- Disposition : Poser une question et suivre l’information ou les actualités projet.
- Partition : Groupe Reviewer local F09 : [storm-04-a-knowledge-035, storm-04-a-knowledge-066, storm-04-a-knowledge-056]. Poser une question et suivre l’information ou les actualités projet.

### Reviewer B

- Disposition : `tooBroad`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q008`
  - Groupe 2 : `equinoxe-q078`, `equinoxe-q085`
- Candidats de fusion : aucun

Rationales Reviewer B :

- Disposition : Le brief combine une situation de demande d’information et une situation de suivi d’actualités.
- Partition : Groupes/familles proposés : G1 canal pour poser des questions = [storm-04-b-knowledge-045] ; G2 réception d’actualités/jalons = [storm-04-b-knowledge-080, storm-04-b-knowledge-062].
Rationale courte : Le flux de question vers le projet et le flux d’information depuis le projet sont distincts.

### Comparaison A/B

- Statut exact : `DECISION_VALUE_DISAGREEMENT`
- Accord de premier niveau : non
- Accord complet : non
- Accords stricts : `fragmentationAssessment.mergeCanonicalReviewItemIds`, `reviewerScenarioFamilyPartition.value`
- Désaccords consignés : `fragmentationAssessment.value` (`DECISION_VALUE_DISAGREEMENT`), `reviewerScenarioFamilyPartition.canonicalPartition` (`PARTITION_DISAGREEMENT`)

Partition / crosswalk réel :

- Reviewer A : item local `storm-04-a-item-011`
  - `storm-04-a-knowledge-035` → `equinoxe-q085`
  - `storm-04-a-knowledge-066` → `equinoxe-q008`
  - `storm-04-a-knowledge-056` → `equinoxe-q078`
- Reviewer B : item local `storm-04-b-item-005`
  - `storm-04-b-knowledge-045` → `equinoxe-q008`
  - `storm-04-b-knowledge-080` → `equinoxe-q078`
  - `storm-04-b-knowledge-062` → `equinoxe-q085`

### Candidate knowledge

| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente | Scenario family existante |
|---|---|---|---|---|
| `equinoxe-q008` | Y a-t-il une date limite pour poser des questions sur le projet ? | Non, vous pouvez poser vos questions à tout moment via Storm. | — | non attribuée |
| `equinoxe-q078` | On peut suivre l’avancement du projet quelque part ? | Oui, les actualités et les jalons du projet sont mis à jour régulièrement dans Storm. | Groupe scellé : `equinoxe-q078`, `equinoxe-q085` ; preferredEntryId : `equinoxe-q078` | non attribuée |
| `equinoxe-q085` | Est-ce qu’il y aura des points d’étape réguliers ? | Oui, des actualités et jalons sont publiés régulièrement dans Storm au fil de l’avancement. | Groupe scellé : `equinoxe-q078`, `equinoxe-q085` ; preferredEntryId : `equinoxe-q078` | non attribuée |

### Existing adjudication context

#### equivalence-comparison-05

- Type : `EQUIVALENCE_AND_PREFERRED`
- q-ids du présent brief directement concernés : `equinoxe-q078`, `equinoxe-q085`
- Groupe d’équivalence scellé : `equinoxe-q078`, `equinoxe-q085`
- preferredEntryId scellé : `equinoxe-q078`
- Rationale humaine scellée : equinoxe-q078 représente le besoin général de suivi de l’avancement du projet. equinoxe-q085 est une formulation plus spécifique portant sur l’existence de points d’étape réguliers.

#### boundary-communication-pilot

- Type : `KNOWLEDGE_BOUNDARIES`
- q-ids du présent brief directement concernés : `equinoxe-q008`, `equinoxe-q078`, `equinoxe-q085`
- Partition de frontière scellée :
  - `EXPERIMENT_FEEDBACK` : `equinoxe-q006`, `equinoxe-q079`, `equinoxe-q110`, `equinoxe-q111`, `equinoxe-q112`
  - `INFO_QUESTIONS` : `equinoxe-q008`, `equinoxe-q078`, `equinoxe-q085`
  - `AMBASSADORS_CONTACTS` : `equinoxe-q077`, `equinoxe-q083`, `equinoxe-q106`, `equinoxe-q107`
- Règles de frontière scellées :
  - `INFO_QUESTIONS` : information / questions projet
  - `AMBASSADORS_CONTACTS` : acteurs humains / ambassadeurs / contacts
  - `EXPERIMENT_FEEDBACK` : expérimentation / retours / contribution / évolution du projet
- Rationale humaine scellée : Conserver la structure Reviewer A.

equinoxe-q083 appartient à AMBASSADORS_CONTACTS : la demande porte explicitement sur la personne à contacter lorsqu’une réponse n’est pas disponible, et la connaissance désigne un ambassadeur ou l’équipe projet.

Ne pas la rattacher au simple canal d’information au motif qu’elle contient le mot « question ».

#### ambiguity-capacity-19

- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- q-ids du présent brief directement concernés : `equinoxe-q008`, `equinoxe-q078`, `equinoxe-q085`
- Classification scellée : `artificialOrMalformed`
- Mécanisme scellé : non applicable
- Rationale humaine scellée : Poser une question à tout moment et recevoir les actualités ou jalons sont deux flux de communication distincts dans Storm. Leur rapprochement provient du thème général de la communication projet, mais ils ne constituent pas des réponses concurrentes à une même lecture métier.
- Règle future scellée : Le fait que plusieurs fonctions passent par le même canal ou outil ne suffit pas à créer une ambiguïté entre elles.

#### ambiguity-capacity-22

- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- q-ids du présent brief directement concernés : `equinoxe-q078`, `equinoxe-q085`
- Classification scellée : `artificialOrMalformed`
- Mécanisme scellé : non applicable
- Rationale humaine scellée : Suivre les actualités, donner du feedback, constater l’évolution du projet et proposer une idée sont plusieurs formes d’interaction avec le projet agrégées sous un thème très large. Aucun référent ou intention unique ne crée ici une hésitation plausible entre réponses substantiellement différentes.
- Règle future scellée : Ne pas transformer une catégorie thématique large en famille d’ambiguïté : il faut une formulation plausible pouvant réellement hésiter entre plusieurs réponses substantielles.

> Ce contexte scellé est restitué sans réinterprétation et ne préremplit pas la décision scenario-family.

### Human decision

```text
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 6. scenario-family-preflight-21 — Brief de famille 21

### Identification

- Item canonique : `scenario-family-preflight-21`
- Contexte métier réellement disponible : Canal de question et canal de proposition d’amélioration

generated user formulation: NOT AVAILABLE

### Reviewer A

- Disposition : `tooBroad`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q083`
  - Groupe 2 : `equinoxe-q112`
- Candidats de fusion : aucun

Rationales Reviewer A :

- Disposition : Deux branches : question ou contact rattachable à F09, et contribution distincte.
- Partition : Partition Reviewer : [storm-04-a-knowledge-081] / [storm-04-a-knowledge-036]. Deux branches : question ou contact rattachable à F09, et contribution distincte.

### Reviewer B

- Disposition : `distinct`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q083`, `equinoxe-q112`
- Candidats de fusion : aucun

Rationales Reviewer B :

- Disposition : Question et proposition partagent ici le même canal opérationnel et forment une famille cohérente de contact direct.
- Partition : Groupes/familles proposés : G1 contact pour question ou proposition au projet = [storm-04-b-knowledge-051, storm-04-b-knowledge-075].
Rationale courte : Les deux connaissances renvoient aux mêmes relais — ambassadeur ou équipe projet — pour interagir directement avec le projet.

### Comparaison A/B

- Statut exact : `DECISION_VALUE_DISAGREEMENT`
- Accord de premier niveau : non
- Accord complet : non
- Accords stricts : `fragmentationAssessment.mergeCanonicalReviewItemIds`, `reviewerScenarioFamilyPartition.value`
- Désaccords consignés : `fragmentationAssessment.value` (`DECISION_VALUE_DISAGREEMENT`), `reviewerScenarioFamilyPartition.canonicalPartition` (`PARTITION_DISAGREEMENT`)

Partition / crosswalk réel :

- Reviewer A : item local `storm-04-a-item-017`
  - `storm-04-a-knowledge-036` → `equinoxe-q112`
  - `storm-04-a-knowledge-081` → `equinoxe-q083`
- Reviewer B : item local `storm-04-b-item-019`
  - `storm-04-b-knowledge-051` → `equinoxe-q083`
  - `storm-04-b-knowledge-075` → `equinoxe-q112`

### Candidate knowledge

| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente | Scenario family existante |
|---|---|---|---|---|
| `equinoxe-q083` | Y a-t-il un contact si j’ai une question qui n’est pas dans Storm ? | Vous pouvez contacter un ambassadeur de votre service ou l’équipe projet directement. | — | non attribuée |
| `equinoxe-q112` | Puis-je proposer une idée d’amélioration ? | Oui, vous pouvez transmettre vos idées à votre ambassadeur ou à l’équipe projet. | — | non attribuée |

### Existing adjudication context

#### boundary-communication-pilot

- Type : `KNOWLEDGE_BOUNDARIES`
- q-ids du présent brief directement concernés : `equinoxe-q083`, `equinoxe-q112`
- Partition de frontière scellée :
  - `EXPERIMENT_FEEDBACK` : `equinoxe-q006`, `equinoxe-q079`, `equinoxe-q110`, `equinoxe-q111`, `equinoxe-q112`
  - `INFO_QUESTIONS` : `equinoxe-q008`, `equinoxe-q078`, `equinoxe-q085`
  - `AMBASSADORS_CONTACTS` : `equinoxe-q077`, `equinoxe-q083`, `equinoxe-q106`, `equinoxe-q107`
- Règles de frontière scellées :
  - `INFO_QUESTIONS` : information / questions projet
  - `AMBASSADORS_CONTACTS` : acteurs humains / ambassadeurs / contacts
  - `EXPERIMENT_FEEDBACK` : expérimentation / retours / contribution / évolution du projet
- Rationale humaine scellée : Conserver la structure Reviewer A.

equinoxe-q083 appartient à AMBASSADORS_CONTACTS : la demande porte explicitement sur la personne à contacter lorsqu’une réponse n’est pas disponible, et la connaissance désigne un ambassadeur ou l’équipe projet.

Ne pas la rattacher au simple canal d’information au motif qu’elle contient le mot « question ».

#### ambiguity-capacity-21

- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- q-ids du présent brief directement concernés : `equinoxe-q083`, `equinoxe-q112`
- Classification scellée : `artificialOrMalformed`
- Mécanisme scellé : non applicable
- Rationale humaine scellée : Poser une question non couverte et proposer une amélioration sont deux intentions différentes, mais elles conduisent ici à la même orientation opérationnelle : contacter un ambassadeur du service ou l’équipe projet. La bifurcation n’entraîne donc pas de réponse substantiellement différente.
- Règle future scellée : Deux intentions lexicalement différentes ne forment pas une ambiguïté utile si elles conduisent à la même action ou réponse canonique.

#### ambiguity-capacity-22

- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- q-ids du présent brief directement concernés : `equinoxe-q112`
- Classification scellée : `artificialOrMalformed`
- Mécanisme scellé : non applicable
- Rationale humaine scellée : Suivre les actualités, donner du feedback, constater l’évolution du projet et proposer une idée sont plusieurs formes d’interaction avec le projet agrégées sous un thème très large. Aucun référent ou intention unique ne crée ici une hésitation plausible entre réponses substantiellement différentes.
- Règle future scellée : Ne pas transformer une catégorie thématique large en famille d’ambiguïté : il faut une formulation plausible pouvant réellement hésiter entre plusieurs réponses substantielles.

> Ce contexte scellé est restitué sans réinterprétation et ne préremplit pas la décision scenario-family.

### Human decision

```text
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 7. scenario-family-preflight-22 — Brief de famille 22

### Identification

- Item canonique : `scenario-family-preflight-22`
- Contexte métier réellement disponible : Actualités, feedback, évolution et contribution au projet

generated user formulation: NOT AVAILABLE

### Reviewer A

- Disposition : `tooBroad`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q078`, `equinoxe-q085`
  - Groupe 2 : `equinoxe-q110`, `equinoxe-q111`
  - Groupe 3 : `equinoxe-q112`
- Candidats de fusion : aucun

Rationales Reviewer A :

- Disposition : Trois branches : actualités vers F09, feedback ou évolution vers F02, et contribution distincte.
- Partition : Partition Reviewer : [storm-04-a-knowledge-056, storm-04-a-knowledge-035] / [storm-04-a-knowledge-051, storm-04-a-knowledge-020] / [storm-04-a-knowledge-036]. Trois branches : actualités vers F09, feedback ou évolution vers F02, et contribution distincte.

### Reviewer B

- Disposition : `tooBroad`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q078`, `equinoxe-q085`
  - Groupe 2 : `equinoxe-q110`, `equinoxe-q112`
  - Groupe 3 : `equinoxe-q111`
- Candidats de fusion : aucun

Rationales Reviewer B :

- Disposition : Le brief agrège plusieurs modes d’interaction avec le projet qui appellent des réponses métier différentes.
- Partition : Groupes/familles proposés : G1 actualités/jalons = [storm-04-b-knowledge-062, storm-04-b-knowledge-080] ; G2 contribution et collecte de feedback = [storm-04-b-knowledge-075, storm-04-b-knowledge-054] ; G3 évolution du projet = [storm-04-b-knowledge-055].
Rationale courte : Recevoir des nouvelles, transmettre une contribution/feedback et savoir si le projet évolue sont des situations distinctes.

### Comparaison A/B

- Statut exact : `PARTITION_DISAGREEMENT`
- Accord de premier niveau : oui
- Accord complet : non
- Accords stricts : `fragmentationAssessment.value`, `fragmentationAssessment.mergeCanonicalReviewItemIds`, `reviewerScenarioFamilyPartition.value`
- Désaccords consignés : `reviewerScenarioFamilyPartition.canonicalPartition` (`PARTITION_DISAGREEMENT`)

Partition / crosswalk réel :

- Reviewer A : item local `storm-04-a-item-033`
  - `storm-04-a-knowledge-056` → `equinoxe-q078`
  - `storm-04-a-knowledge-036` → `equinoxe-q112`
  - `storm-04-a-knowledge-035` → `equinoxe-q085`
  - `storm-04-a-knowledge-051` → `equinoxe-q110`
  - `storm-04-a-knowledge-020` → `equinoxe-q111`
- Reviewer B : item local `storm-04-b-item-002`
  - `storm-04-b-knowledge-075` → `equinoxe-q112`
  - `storm-04-b-knowledge-054` → `equinoxe-q110`
  - `storm-04-b-knowledge-062` → `equinoxe-q085`
  - `storm-04-b-knowledge-055` → `equinoxe-q111`
  - `storm-04-b-knowledge-080` → `equinoxe-q078`

### Candidate knowledge

| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente | Scenario family existante |
|---|---|---|---|---|
| `equinoxe-q078` | On peut suivre l’avancement du projet quelque part ? | Oui, les actualités et les jalons du projet sont mis à jour régulièrement dans Storm. | Groupe scellé : `equinoxe-q078`, `equinoxe-q085` ; preferredEntryId : `equinoxe-q078` | non attribuée |
| `equinoxe-q085` | Est-ce qu’il y aura des points d’étape réguliers ? | Oui, des actualités et jalons sont publiés régulièrement dans Storm au fil de l’avancement. | Groupe scellé : `equinoxe-q078`, `equinoxe-q085` ; preferredEntryId : `equinoxe-q078` | non attribuée |
| `equinoxe-q110` | Qui gère les premiers retours après l’ouverture du plateau témoin ? | L’équipe projet recueille les retours pour ajuster les choix avant le déménagement définitif. | — | non attribuée |
| `equinoxe-q111` | Le projet est-il définitif ou peut-il encore évoluer ? | Le projet reste ajustable : les usages seront observés après l’emménagement et des ajustements resteront possibles. | — | non attribuée |
| `equinoxe-q112` | Puis-je proposer une idée d’amélioration ? | Oui, vous pouvez transmettre vos idées à votre ambassadeur ou à l’équipe projet. | — | non attribuée |

### Existing adjudication context

#### equivalence-comparison-05

- Type : `EQUIVALENCE_AND_PREFERRED`
- q-ids du présent brief directement concernés : `equinoxe-q078`, `equinoxe-q085`
- Groupe d’équivalence scellé : `equinoxe-q078`, `equinoxe-q085`
- preferredEntryId scellé : `equinoxe-q078`
- Rationale humaine scellée : equinoxe-q078 représente le besoin général de suivi de l’avancement du projet. equinoxe-q085 est une formulation plus spécifique portant sur l’existence de points d’étape réguliers.

#### boundary-communication-pilot

- Type : `KNOWLEDGE_BOUNDARIES`
- q-ids du présent brief directement concernés : `equinoxe-q078`, `equinoxe-q085`, `equinoxe-q110`, `equinoxe-q111`, `equinoxe-q112`
- Partition de frontière scellée :
  - `EXPERIMENT_FEEDBACK` : `equinoxe-q006`, `equinoxe-q079`, `equinoxe-q110`, `equinoxe-q111`, `equinoxe-q112`
  - `INFO_QUESTIONS` : `equinoxe-q008`, `equinoxe-q078`, `equinoxe-q085`
  - `AMBASSADORS_CONTACTS` : `equinoxe-q077`, `equinoxe-q083`, `equinoxe-q106`, `equinoxe-q107`
- Règles de frontière scellées :
  - `INFO_QUESTIONS` : information / questions projet
  - `AMBASSADORS_CONTACTS` : acteurs humains / ambassadeurs / contacts
  - `EXPERIMENT_FEEDBACK` : expérimentation / retours / contribution / évolution du projet
- Rationale humaine scellée : Conserver la structure Reviewer A.

equinoxe-q083 appartient à AMBASSADORS_CONTACTS : la demande porte explicitement sur la personne à contacter lorsqu’une réponse n’est pas disponible, et la connaissance désigne un ambassadeur ou l’équipe projet.

Ne pas la rattacher au simple canal d’information au motif qu’elle contient le mot « question ».

#### ambiguity-capacity-17

- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- q-ids du présent brief directement concernés : `equinoxe-q110`
- Classification scellée : `artificialOrMalformed`
- Mécanisme scellé : non applicable
- Rationale humaine scellée : La date d’ouverture, le rôle expérimental du plateau témoin et la collecte des retours sont des propriétés complémentaires du même dispositif. Elles peuvent être expliquées ensemble et ne forcent pas un choix entre plusieurs réponses substantiellement concurrentes.
- Règle future scellée : Des attributs complémentaires d’un même dispositif ne forment pas une ambiguïté structurelle lorsqu’ils peuvent être expliqués ensemble sans contradiction ni choix exclusif.

#### ambiguity-capacity-18

- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- q-ids du présent brief directement concernés : `equinoxe-q110`, `equinoxe-q111`
- Classification scellée : `structuralAmbiguity`
- Mécanisme scellé : `alternativeIntentReadings`
- Groupes scellés :
  - Groupe 1 : `equinoxe-q079`, `equinoxe-q110`
  - Groupe 2 : `equinoxe-q111`
- Rationale humaine scellée : `q079` et `q110` décrivent la phase d’essai et de collecte des retours avant le déménagement définitif. `q111` décrit l’observation et les ajustements possibles après l’emménagement. Une demande générale sur la possibilité de tester ou faire évoluer le projet peut donc viser deux phases métier différentes.
- Règle future scellée : Quand une possibilité d’ajustement existe à plusieurs phases du projet, partitionner par phase métier si les mécanismes et temporalités de décision diffèrent substantiellement.

#### ambiguity-capacity-19

- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- q-ids du présent brief directement concernés : `equinoxe-q078`, `equinoxe-q085`
- Classification scellée : `artificialOrMalformed`
- Mécanisme scellé : non applicable
- Rationale humaine scellée : Poser une question à tout moment et recevoir les actualités ou jalons sont deux flux de communication distincts dans Storm. Leur rapprochement provient du thème général de la communication projet, mais ils ne constituent pas des réponses concurrentes à une même lecture métier.
- Règle future scellée : Le fait que plusieurs fonctions passent par le même canal ou outil ne suffit pas à créer une ambiguïté entre elles.

#### ambiguity-capacity-21

- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- q-ids du présent brief directement concernés : `equinoxe-q112`
- Classification scellée : `artificialOrMalformed`
- Mécanisme scellé : non applicable
- Rationale humaine scellée : Poser une question non couverte et proposer une amélioration sont deux intentions différentes, mais elles conduisent ici à la même orientation opérationnelle : contacter un ambassadeur du service ou l’équipe projet. La bifurcation n’entraîne donc pas de réponse substantiellement différente.
- Règle future scellée : Deux intentions lexicalement différentes ne forment pas une ambiguïté utile si elles conduisent à la même action ou réponse canonique.

#### ambiguity-capacity-22

- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- q-ids du présent brief directement concernés : `equinoxe-q078`, `equinoxe-q085`, `equinoxe-q110`, `equinoxe-q111`, `equinoxe-q112`
- Classification scellée : `artificialOrMalformed`
- Mécanisme scellé : non applicable
- Rationale humaine scellée : Suivre les actualités, donner du feedback, constater l’évolution du projet et proposer une idée sont plusieurs formes d’interaction avec le projet agrégées sous un thème très large. Aucun référent ou intention unique ne crée ici une hésitation plausible entre réponses substantiellement différentes.
- Règle future scellée : Ne pas transformer une catégorie thématique large en famille d’ambiguïté : il faut une formulation plausible pouvant réellement hésiter entre plusieurs réponses substantielles.

> Ce contexte scellé est restitué sans réinterprétation et ne préremplit pas la décision scenario-family.

### Human decision

```text
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 8. scenario-family-preflight-23 — Brief de famille 23

### Identification

- Item canonique : `scenario-family-preflight-23`
- Contexte métier réellement disponible : Règle de réservation lorsque l’espace n’est pas précisé

generated user formulation: NOT AVAILABLE

### Reviewer A

- Disposition : `distinct`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q019`, `equinoxe-q020`, `equinoxe-q022`, `equinoxe-q023`, `equinoxe-q024`, `equinoxe-q053`
- Candidats de fusion : aucun

Rationales Reviewer A :

- Disposition : Règle de réservation lorsque l’espace n’est pas précisé.
- Partition : Groupe Reviewer local F19 : [storm-04-a-knowledge-065, storm-04-a-knowledge-018, storm-04-a-knowledge-039, storm-04-a-knowledge-014, storm-04-a-knowledge-029, storm-04-a-knowledge-025]. Règle de réservation lorsque l’espace n’est pas précisé.

### Reviewer B

- Disposition : `distinct`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q019`, `equinoxe-q053`
  - Groupe 2 : `equinoxe-q020`
  - Groupe 3 : `equinoxe-q022`
  - Groupe 4 : `equinoxe-q023`
  - Groupe 5 : `equinoxe-q024`
- Candidats de fusion : aucun

Rationales Reviewer B :

- Disposition : Le brief porte un besoin transversal unique — savoir quelle règle de réservation s’applique lorsque l’espace doit être identifié — et sa partition par espace est explicite.
- Partition : Groupes/familles proposés : G1 Project Room = [storm-04-b-knowledge-077] ; G2 bulles = [storm-04-b-knowledge-003] ; G3 Bibliothèque = [storm-04-b-knowledge-031] ; G4 salles de réunion = [storm-04-b-knowledge-069, storm-04-b-knowledge-061] ; G5 Forum = [storm-04-b-knowledge-052].
Rationale courte : Les règles de réservation changent selon l’espace concerné.

### Comparaison A/B

- Statut exact : `PARTITION_DISAGREEMENT`
- Accord de premier niveau : oui
- Accord complet : non
- Accords stricts : `fragmentationAssessment.value`, `fragmentationAssessment.mergeCanonicalReviewItemIds`, `reviewerScenarioFamilyPartition.value`
- Désaccords consignés : `reviewerScenarioFamilyPartition.canonicalPartition` (`PARTITION_DISAGREEMENT`)

Partition / crosswalk réel :

- Reviewer A : item local `storm-04-a-item-024`
  - `storm-04-a-knowledge-065` → `equinoxe-q019`
  - `storm-04-a-knowledge-018` → `equinoxe-q020`
  - `storm-04-a-knowledge-039` → `equinoxe-q022`
  - `storm-04-a-knowledge-014` → `equinoxe-q024`
  - `storm-04-a-knowledge-029` → `equinoxe-q023`
  - `storm-04-a-knowledge-025` → `equinoxe-q053`
- Reviewer B : item local `storm-04-b-item-026`
  - `storm-04-b-knowledge-077` → `equinoxe-q022`
  - `storm-04-b-knowledge-003` → `equinoxe-q023`
  - `storm-04-b-knowledge-031` → `equinoxe-q020`
  - `storm-04-b-knowledge-069` → `equinoxe-q053`
  - `storm-04-b-knowledge-052` → `equinoxe-q024`
  - `storm-04-b-knowledge-061` → `equinoxe-q019`

### Candidate knowledge

| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente | Scenario family existante |
|---|---|---|---|---|
| `equinoxe-q019` | Comment je réserve une salle de réunion ? | Via l’outil de réservation habituel, qui reste inchangé pour les salles de réunion. | Groupe scellé : `equinoxe-q019`, `equinoxe-q053` ; preferredEntryId : `equinoxe-q019` | non attribuée |
| `equinoxe-q020` | Faut-il réserver pour aller à la Bibliothèque ? | Non, la Bibliothèque fonctionne en accès libre. | — | non attribuée |
| `equinoxe-q022` | Peut-on réserver une Project Room à l’avance ? | Oui, les Project Rooms se réservent à la demi-journée ou à la journée. | — | non attribuée |
| `equinoxe-q023` | Et les bulles, on les réserve aussi ? | Non, les bulles sont pensées pour un usage court et spontané, sans réservation. | — | non attribuée |
| `equinoxe-q024` | Le Forum est-il réservable pour un événement d’équipe ? | Oui, le Forum peut être réservé pour des événements, sur demande auprès de l’équipe projet. | — | non attribuée |
| `equinoxe-q053` | Comment réserver une salle pour un entretien annuel ? | Via l’outil de réservation habituel des salles de réunion. | Groupe scellé : `equinoxe-q019`, `equinoxe-q053` ; preferredEntryId : `equinoxe-q019` | non attribuée |

### Existing adjudication context

#### equivalence-comparison-02

- Type : `EQUIVALENCE_AND_PREFERRED`
- q-ids du présent brief directement concernés : `equinoxe-q019`, `equinoxe-q053`
- Groupe d’équivalence scellé : `equinoxe-q019`, `equinoxe-q053`
- preferredEntryId scellé : `equinoxe-q019`
- Rationale humaine scellée : equinoxe-q019 formule la règle générale de réservation des salles de réunion et précise que l’outil habituel reste inchangé. equinoxe-q053 est un cas particulier appliqué à un entretien annuel.

#### boundary-rooms-focus

- Type : `KNOWLEDGE_BOUNDARIES`
- q-ids du présent brief directement concernés : `equinoxe-q019`, `equinoxe-q020`, `equinoxe-q022`, `equinoxe-q023`, `equinoxe-q024`, `equinoxe-q053`
- Partition de frontière scellée :
  - `MEETING_ROOMS` : `equinoxe-q019`, `equinoxe-q028`, `equinoxe-q053`, `equinoxe-q089`
  - `PROJECT_ROOMS` : `equinoxe-q022`, `equinoxe-q031`, `equinoxe-q052`, `equinoxe-q090`
  - `BUBBLES` : `equinoxe-q023`, `equinoxe-q027`
  - `FORUM` : `equinoxe-q024`, `equinoxe-q029`, `equinoxe-q105`
  - `FOCUS_LIBRARY` : `equinoxe-q020`, `equinoxe-q025`, `equinoxe-q026`, `equinoxe-q091`
  - `CONFIDENTIALITY` : `equinoxe-q050`, `equinoxe-q051`, `equinoxe-q099`
- Règles de frontière scellées :
  - `IDENTIFIED_SPACE` : si un type d’espace est explicitement identifié, rattacher la demande à sa famille d’espace
  - `CONFIDENTIALITY` : besoin fonctionnel portant sur un échange confidentiel, lorsque plusieurs types d’espaces peuvent satisfaire ce besoin
  - `AMBIGUITY` : une demande vague sur le fait de « s’isoler », « être au calme » ou « trouver un espace » peut rester ambiguë lorsque l’activité recherchée ne permet pas de distinguer Focus/Library, bulle, salle ou autre espace
- Rationale humaine scellée : Les différents types d’espaces ont des finalités, capacités et règles d’accès/réservation suffisamment distinctes pour ne pas être fusionnés dans un grand composant « espaces de collaboration ».

La confidentialité constitue en revanche un besoin fonctionnel transverse : les connaissances equinoxe-q050, equinoxe-q051 et equinoxe-q099 couvrent explicitement à la fois salles de réunion et bulles.

Elles ne doivent donc pas être rangées artificiellement dans le composant MEETING_ROOMS uniquement.

#### ambiguity-capacity-29

- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- q-ids du présent brief directement concernés : `equinoxe-q020`
- Classification scellée : `artificialOrMalformed`
- Mécanisme scellé : non applicable
- Rationale humaine scellée : Le terme « libre/ouvert » recouvre ici trois significations portant sur trois objets différents : accès sans réservation à la Bibliothèque, disponibilité instantanée d’une salle, et degré d’ouverture physique d’un espace Focus. La proximité est lexicale, pas métier.
- Règle future scellée : La polysémie d’un mot générique ne constitue pas une ambiguïté structurelle lorsque chaque sens porte sur un objet métier différent et clairement identifiable.

#### ambiguity-capacity-30

- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- q-ids du présent brief directement concernés : `equinoxe-q019`, `equinoxe-q022`, `equinoxe-q053`
- Classification scellée : `structuralAmbiguity`
- Mécanisme scellé : `alternativeIntentReadings`
- Groupes scellés :
  - Groupe 1 : `equinoxe-q019`, `equinoxe-q053`
  - Groupe 2 : `equinoxe-q022`
  - Groupe 3 : `equinoxe-q089`
  - Groupe 4 : `equinoxe-q090`
- Rationale humaine scellée : Le domaine réservation comprend plusieurs opérations distinctes : créer, vérifier une disponibilité et annuler. En outre, la création d’une réservation n’obéit pas aux mêmes règles pour une salle de réunion (`q019/q053`) et une Project Room (`q022`). La partition doit donc conserver cette différence métier plutôt que fusionner toutes les créations.
- Règle future scellée : Dans un domaine transactionnel, partitionner d’abord par opération puis, si nécessaire, par type de ressource lorsque les règles opérationnelles diffèrent.

> Ce contexte scellé est restitué sans réinterprétation et ne préremplit pas la décision scenario-family.

### Human decision

```text
decision: PENDING
rationale: PENDING
future_rule: PENDING
```
