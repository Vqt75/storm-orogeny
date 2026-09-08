# Adjudication structurelle — Batch 04 : scenario families 01

- Batch : `adjudication-batch-04-scenario-families-01`
- Statut : `PENDING_HUMAN_REVIEW`
- Autorisation de génération : `false`
- Adjudication effectuée : `false`
- Items : 10

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

## 1. scenario-family-preflight-02 — Brief de famille 02

### Identification

- Item canonique : `scenario-family-preflight-02`
- Contexte métier réellement disponible : Réservation du poste et déclaration de présence

generated user formulation: NOT AVAILABLE

### Reviewer A

- Disposition : `distinct`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q018`, `equinoxe-q021`
- Candidats de fusion : aucun

Rationales Reviewer A :

- Disposition : Organisation de sa venue : réservation du poste et déclaration de présence.
- Partition : Groupe Reviewer local F03 : [storm-04-a-knowledge-057, storm-04-a-knowledge-027]. Organisation de sa venue : réservation du poste et déclaration de présence.

### Reviewer B

- Disposition : `tooBroad`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q018`
  - Groupe 2 : `equinoxe-q021`
- Candidats de fusion : aucun

Rationales Reviewer B :

- Disposition : Le brief réunit deux obligations opérationnelles distinctes qui doivent rester séparées.
- Partition : Groupes/familles proposés : G1 déclaration de présence = [storm-04-b-knowledge-020] ; G2 réservation d’un poste = [storm-04-b-knowledge-033].
Rationale courte : Les deux opérations sont différentes : signaler sa venue et réserver une assise.

### Comparaison A/B

- Statut exact : `DECISION_VALUE_DISAGREEMENT`
- Accord de premier niveau : non
- Accord complet : non
- Accords stricts : `fragmentationAssessment.mergeCanonicalReviewItemIds`, `reviewerScenarioFamilyPartition.value`
- Désaccords consignés : `fragmentationAssessment.value` (`DECISION_VALUE_DISAGREEMENT`), `reviewerScenarioFamilyPartition.canonicalPartition` (`PARTITION_DISAGREEMENT`)

Partition / crosswalk réel :

- Reviewer A : item local `storm-04-a-item-004`
  - `storm-04-a-knowledge-057` → `equinoxe-q018`
  - `storm-04-a-knowledge-027` → `equinoxe-q021`
- Reviewer B : item local `storm-04-b-item-028`
  - `storm-04-b-knowledge-020` → `equinoxe-q021`
  - `storm-04-b-knowledge-033` → `equinoxe-q018`

### Candidate knowledge

| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente | Scenario family existante |
|---|---|---|---|---|
| `equinoxe-q018` | Dois-je réserver un poste ? | Pas systématiquement en V1. | — | non attribuée |
| `equinoxe-q021` | Je dois prévenir si je viens un jour précis ? | Aucune obligation de déclarer sa présence n’est prévue pour le moment. | — | non attribuée |

### Human decision

```text
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 2. scenario-family-preflight-03 — Brief de famille 03

### Identification

- Item canonique : `scenario-family-preflight-03`
- Contexte métier réellement disponible : Connexion réseau sans fil et branchement physique du poste

generated user formulation: NOT AVAILABLE

### Reviewer A

- Disposition : `distinct`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q047`, `equinoxe-q048`
- Candidats de fusion : aucun

Rationales Reviewer A :

- Disposition : Connexion wifi et branchement physique du poste.
- Partition : Groupe Reviewer local F20 : [storm-04-a-knowledge-040, storm-04-a-knowledge-060]. Connexion wifi et branchement physique du poste.

### Reviewer B

- Disposition : `tooBroad`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q047`
  - Groupe 2 : `equinoxe-q048`
- Candidats de fusion : aucun

Rationales Reviewer B :

- Disposition : Le brief rapproche deux situations techniques distinctes qui ne partagent pas la même réponse opérationnelle.
- Partition : Groupes/familles proposés : G1 couverture wifi = [storm-04-b-knowledge-036] ; G2 branchement physique du poste/assistance IT = [storm-04-b-knowledge-035].
Rationale courte : Connexion réseau sans fil et installation physique du poste sont deux besoins IT différents.

### Comparaison A/B

- Statut exact : `DECISION_VALUE_DISAGREEMENT`
- Accord de premier niveau : non
- Accord complet : non
- Accords stricts : `fragmentationAssessment.mergeCanonicalReviewItemIds`, `reviewerScenarioFamilyPartition.value`
- Désaccords consignés : `fragmentationAssessment.value` (`DECISION_VALUE_DISAGREEMENT`), `reviewerScenarioFamilyPartition.canonicalPartition` (`PARTITION_DISAGREEMENT`)

Partition / crosswalk réel :

- Reviewer A : item local `storm-04-a-item-027`
  - `storm-04-a-knowledge-040` → `equinoxe-q048`
  - `storm-04-a-knowledge-060` → `equinoxe-q047`
- Reviewer B : item local `storm-04-b-item-012`
  - `storm-04-b-knowledge-036` → `equinoxe-q047`
  - `storm-04-b-knowledge-035` → `equinoxe-q048`

### Candidate knowledge

| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente | Scenario family existante |
|---|---|---|---|---|
| `equinoxe-q047` | Y aura-t-il du wifi partout dans le bâtiment ? | Oui, une couverture wifi est prévue sur l’ensemble des espaces de Cobalt. | — | non attribuée |
| `equinoxe-q048` | Comment se passera le branchement de mon poste le premier jour ? | Une assistance IT sera présente lors de la semaine de préparation, début janvier 2027. | — | non attribuée |

### Existing adjudication context

#### ambiguity-capacity-03

- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- q-ids du présent brief directement concernés : `equinoxe-q047`, `equinoxe-q048`
- Classification scellée : `artificialOrMalformed`
- Mécanisme scellé : non applicable
- Rationale humaine scellée : Wifi et branchement physique du poste sont deux sujets IT distincts rapprochés principalement par le terme générique « connexion ». En l’absence d’une formulation utilisateur réelle qui crée effectivement cette hésitation, la famille fabrique une ambiguïté lexicale plutôt qu’une ambiguïté métier.
- Règle future scellée : Une proximité lexicale seule ne suffit pas à créer une famille d’ambiguïté : les lectures doivent correspondre à une ambiguïté métier plausible, pas simplement partager un mot générique.

> Ce contexte scellé est restitué sans réinterprétation et ne préremplit pas la décision scenario-family.

### Human decision

```text
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 3. scenario-family-preflight-04 — Brief de famille 04

### Identification

- Item canonique : `scenario-family-preflight-04`
- Contexte métier réellement disponible : Accessibilité PMR et accessibilité géographique ou transport

generated user formulation: NOT AVAILABLE

### Reviewer A

- Disposition : `distinct`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q054`, `equinoxe-q055`, `equinoxe-q059`, `equinoxe-q067`, `equinoxe-q074`, `equinoxe-q101`
- Candidats de fusion : aucun

Rationales Reviewer A :

- Disposition : Ambiguïté lexicale entre accessibilité PMR et transport ou géographie.
- Partition : Groupe Reviewer local F16 : [storm-04-a-knowledge-037, storm-04-a-knowledge-032, storm-04-a-knowledge-080, storm-04-a-knowledge-073, storm-04-a-knowledge-072, storm-04-a-knowledge-061]. Ambiguïté lexicale entre accessibilité PMR et transport ou géographie.

### Reviewer B

- Disposition : `tooBroad`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q054`, `equinoxe-q055`, `equinoxe-q059`, `equinoxe-q074`, `equinoxe-q101`
  - Groupe 2 : `equinoxe-q067`
- Candidats de fusion : aucun

Rationales Reviewer B :

- Disposition : Le brief mélange accessibilité des personnes à mobilité réduite et desserte géographique, qui doivent être traitées comme deux situations.
- Partition : Groupes/familles proposés : G1 accessibilité PMR = [storm-04-b-knowledge-013] ; G2 accessibilité géographique/transports = [storm-04-b-knowledge-032, storm-04-b-knowledge-001, storm-04-b-knowledge-009, storm-04-b-knowledge-064, storm-04-b-knowledge-029].
Rationale courte : Les connaissances utilisent deux sens métier distincts de l’accessibilité.

### Comparaison A/B

- Statut exact : `DECISION_VALUE_DISAGREEMENT`
- Accord de premier niveau : non
- Accord complet : non
- Accords stricts : `fragmentationAssessment.mergeCanonicalReviewItemIds`, `reviewerScenarioFamilyPartition.value`
- Désaccords consignés : `fragmentationAssessment.value` (`DECISION_VALUE_DISAGREEMENT`), `reviewerScenarioFamilyPartition.canonicalPartition` (`PARTITION_DISAGREEMENT`)

Partition / crosswalk réel :

- Reviewer A : item local `storm-04-a-item-019`
  - `storm-04-a-knowledge-037` → `equinoxe-q059`
  - `storm-04-a-knowledge-032` → `equinoxe-q074`
  - `storm-04-a-knowledge-080` → `equinoxe-q101`
  - `storm-04-a-knowledge-073` → `equinoxe-q055`
  - `storm-04-a-knowledge-072` → `equinoxe-q067`
  - `storm-04-a-knowledge-061` → `equinoxe-q054`
- Reviewer B : item local `storm-04-b-item-018`
  - `storm-04-b-knowledge-032` → `equinoxe-q059`
  - `storm-04-b-knowledge-013` → `equinoxe-q067`
  - `storm-04-b-knowledge-001` → `equinoxe-q055`
  - `storm-04-b-knowledge-009` → `equinoxe-q101`
  - `storm-04-b-knowledge-064` → `equinoxe-q074`
  - `storm-04-b-knowledge-029` → `equinoxe-q054`

### Candidate knowledge

| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente | Scenario family existante |
|---|---|---|---|---|
| `equinoxe-q054` | Comment accéder à Cobalt en transport en commun ? | Cobalt est desservi par le métro et le RER -- le détail des accès sera communiqué avant l’emménagement. | — | non attribuée |
| `equinoxe-q055` | Y a-t-il un accès facile en RER ? | Oui, Cobalt est situé à proximité d’une gare RER. | — | non attribuée |
| `equinoxe-q059` | Le site est-il accessible facilement depuis le centre de Paris ? | Oui, Cobalt bénéficie d’un accès direct en RER et métro. | — | non attribuée |
| `equinoxe-q067` | Cobalt est-il accessible aux personnes à mobilité réduite ? | Oui, l’accessibilité fait partie des principes du projet, avec une attention portée à tous. | — | non attribuée |
| `equinoxe-q074` | C’est loin de la gare ? | Cobalt est situé à Saint-Denis Pleyel, avec un accès direct en RER et métro. | — | non attribuée |
| `equinoxe-q101` | Le site est-il proche d’un arrêt de bus ? | Les détails de desserte complète (bus, RER, métro) seront communiqués avant l’emménagement. | — | non attribuée |

### Human decision

```text
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 4. scenario-family-preflight-05 — Brief de famille 05

### Identification

- Item canonique : `scenario-family-preflight-05`
- Contexte métier réellement disponible : Recharge électrique pour vélo ou automobile

generated user formulation: NOT AVAILABLE

### Reviewer A

- Disposition : `distinct`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q038`, `equinoxe-q100`
- Candidats de fusion : aucun

Rationales Reviewer A :

- Disposition : Recharge électrique selon le type de véhicule.
- Partition : Groupe Reviewer local F07 : [storm-04-a-knowledge-012, storm-04-a-knowledge-049]. Recharge électrique selon le type de véhicule.

### Reviewer B

- Disposition : `distinct`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q038`
  - Groupe 2 : `equinoxe-q100`
- Candidats de fusion : aucun

Rationales Reviewer B :

- Disposition : Le besoin commun est la recharge d’un véhicule électrique, avec une partition naturelle par véhicule ; aucun autre brief affiché ne couvre directement cette même distinction.
- Partition : Groupes/familles proposés : G1 recharge automobile = [storm-04-b-knowledge-028] ; G2 recharge vélo électrique = [storm-04-b-knowledge-017].
Rationale courte : Le type de véhicule détermine la connaissance applicable ; l’une est encore à préciser et l’autre confirme des prises au local vélos.

### Comparaison A/B

- Statut exact : `PARTITION_DISAGREEMENT`
- Accord de premier niveau : oui
- Accord complet : non
- Accords stricts : `fragmentationAssessment.value`, `fragmentationAssessment.mergeCanonicalReviewItemIds`, `reviewerScenarioFamilyPartition.value`
- Désaccords consignés : `reviewerScenarioFamilyPartition.canonicalPartition` (`PARTITION_DISAGREEMENT`)

Partition / crosswalk réel :

- Reviewer A : item local `storm-04-a-item-009`
  - `storm-04-a-knowledge-012` → `equinoxe-q038`
  - `storm-04-a-knowledge-049` → `equinoxe-q100`
- Reviewer B : item local `storm-04-b-item-004`
  - `storm-04-b-knowledge-028` → `equinoxe-q100`
  - `storm-04-b-knowledge-017` → `equinoxe-q038`

### Candidate knowledge

| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente | Scenario family existante |
|---|---|---|---|---|
| `equinoxe-q038` | Y a-t-il des prises de recharge pour vélos électriques ? | Oui, le local vélos prévoit des prises de recharge. | — | non attribuée |
| `equinoxe-q100` | Y a-t-il des bornes de recharge pour voitures électriques ? | Les modalités de stationnement et de recharge seront précisées avant l’emménagement. | — | non attribuée |

### Existing adjudication context

#### ambiguity-capacity-05

- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- q-ids du présent brief directement concernés : `equinoxe-q038`, `equinoxe-q100`
- Classification scellée : `blockedTemporalInstability`
- Mécanisme scellé : non applicable
- Rationale humaine scellée : La recharge des vélos électriques est confirmée, tandis que les modalités de stationnement/recharge automobile restent explicitement à préciser. Les deux branches ne constituent donc pas encore deux groupes métier suffisamment stabilisés pour générer une ambiguïté fiable.
- Règle future scellée : Une branche dont la connaissance substantielle est encore explicitement reportée ne constitue pas un groupe couvert stable pour générer une ambiguïté, sauf si « l’information n’est pas encore disponible » est elle-même la vérité canonique recherchée.

> Ce contexte scellé est restitué sans réinterprétation et ne préremplit pas la décision scenario-family.

### Human decision

```text
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 5. scenario-family-preflight-06 — Brief de famille 06

### Identification

- Item canonique : `scenario-family-preflight-06`
- Contexte métier réellement disponible : Casier personnel et équipement de rangement du local vélos

generated user formulation: NOT AVAILABLE

### Reviewer A

- Disposition : `insufficientEvidence`
- Structure de partition : `insufficientEvidence`
- Groupes de scénario : non établis (`insufficientEvidence`).
- Candidats de fusion : aucun

Rationales Reviewer A :

- Disposition : Éléments insuffisants pour séparer les casiers personnels du rangement autour du local vélos.
- Partition : Éléments insuffisants pour séparer les casiers personnels du rangement autour du local vélos.

### Reviewer B

- Disposition : `tooBroad`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q035`, `equinoxe-q036`, `equinoxe-q094`, `equinoxe-q095`
  - Groupe 2 : `equinoxe-q037`, `equinoxe-q073`
- Candidats de fusion : aucun

Rationales Reviewer B :

- Disposition : Le brief mélange rangement individuel au poste et services liés au stationnement vélo.
- Partition : Groupes/familles proposés : G1 casier personnel pour effets de travail = [storm-04-b-knowledge-042, storm-04-b-knowledge-072, storm-04-b-knowledge-026, storm-04-b-knowledge-053] ; G2 équipements associés au local vélos = [storm-04-b-knowledge-056, storm-04-b-knowledge-073].
Rationale courte : Les casiers personnels de flex office et les équipements du local vélos relèvent de deux contextes d’usage différents.

### Comparaison A/B

- Statut exact : `DECISION_VALUE_DISAGREEMENT`
- Accord de premier niveau : non
- Accord complet : non
- Accords stricts : `fragmentationAssessment.mergeCanonicalReviewItemIds`
- Désaccords consignés : `fragmentationAssessment.value` (`DECISION_VALUE_DISAGREEMENT`), `reviewerScenarioFamilyPartition.value` (`DECISION_VALUE_DISAGREEMENT`), `reviewerScenarioFamilyPartition.conditionalGroups` (`CONDITIONAL_STRUCTURE_DISAGREEMENT`)

Partition / crosswalk réel :

- Reviewer A : item local `storm-04-a-item-003`
  - `storm-04-a-knowledge-046` → `equinoxe-q094`
  - `storm-04-a-knowledge-079` → `equinoxe-q037`
  - `storm-04-a-knowledge-053` → `equinoxe-q036`
  - `storm-04-a-knowledge-071` → `equinoxe-q095`
  - `storm-04-a-knowledge-022` → `equinoxe-q035`
  - `storm-04-a-knowledge-047` → `equinoxe-q073`
- Reviewer B : item local `storm-04-b-item-031`
  - `storm-04-b-knowledge-042` → `equinoxe-q095`
  - `storm-04-b-knowledge-072` → `equinoxe-q036`
  - `storm-04-b-knowledge-026` → `equinoxe-q094`
  - `storm-04-b-knowledge-053` → `equinoxe-q035`
  - `storm-04-b-knowledge-056` → `equinoxe-q073`
  - `storm-04-b-knowledge-073` → `equinoxe-q037`

### Candidate knowledge

| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente | Scenario family existante |
|---|---|---|---|---|
| `equinoxe-q035` | J’aurai un casier personnel ? | Oui, des casiers seront disponibles -- la réservation ouvrira début décembre 2026. | — | non attribuée |
| `equinoxe-q036` | Où je mets mes affaires si je n’ai pas de bureau fixe ? | Dans votre casier personnel, réservable à partir de début décembre 2026. | — | non attribuée |
| `equinoxe-q037` | Le local vélos a des douches à proximité ? | Oui, des casiers et des douches sont prévus à proximité du local vélos. | — | non attribuée |
| `equinoxe-q073` | Je peux amener mon vélo à l’intérieur ? | Non, un local vélos dédié de 160 places est prévu, avec douches et casiers à proximité. | — | non attribuée |
| `equinoxe-q094` | Le casier est-il suffisant pour un carton de dossiers ? | Les casiers sont dimensionnés pour les effets personnels et documents courants -- le détail des tailles sera précisé avec l’ouverture des réservations. | — | non attribuée |
| `equinoxe-q095` | Y a-t-il un casier par personne ou par équipe ? | Les casiers sont individuels, réservables par chaque collaborateur. | — | non attribuée |

### Existing adjudication context

#### ambiguity-capacity-06

- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- q-ids du présent brief directement concernés : `equinoxe-q035`, `equinoxe-q036`, `equinoxe-q037`, `equinoxe-q073`, `equinoxe-q094`, `equinoxe-q095`
- Classification scellée : `structuralAmbiguity`
- Mécanisme scellé : `underspecifiedReference`
- Groupes scellés :
  - Groupe 1 : `equinoxe-q035`, `equinoxe-q036`, `equinoxe-q094`, `equinoxe-q095`
  - Groupe 2 : `equinoxe-q037`, `equinoxe-q073`
- Rationale humaine scellée : Le corpus distingue réellement deux objets : les casiers personnels associés aux effets personnels et les casiers situés à proximité du local vélos. Une référence générique à un « casier » ou rangement sans contexte peut viser l’un ou l’autre.
- Règle future scellée : Lorsqu’un même nom d’équipement désigne plusieurs objets physiques distincts selon leur localisation ou leur usage, exiger le contexte et traiter comme `underspecifiedReference`.

> Ce contexte scellé est restitué sans réinterprétation et ne préremplit pas la décision scenario-family.

### Human decision

```text
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 6. scenario-family-preflight-07 — Brief de famille 07

### Identification

- Item canonique : `scenario-family-preflight-07`
- Contexte métier réellement disponible : Portée des jalons de préparation au déménagement

generated user formulation: NOT AVAILABLE

### Reviewer A

- Disposition : `tooBroad`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q003`
  - Groupe 2 : `equinoxe-q004`, `equinoxe-q005`, `equinoxe-q007`, `equinoxe-q108`
- Candidats de fusion : aucun

Rationales Reviewer A :

- Disposition : Deux branches : jalons concrets de préparation et stabilité générale du calendrier.
- Partition : Partition Reviewer : [storm-04-a-knowledge-075, storm-04-a-knowledge-024, storm-04-a-knowledge-026, storm-04-a-knowledge-076] / [storm-04-a-knowledge-023]. Deux branches : jalons concrets de préparation et stabilité générale du calendrier.

### Reviewer B

- Disposition : `tooBroad`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q003`
  - Groupe 2 : `equinoxe-q004`
  - Groupe 3 : `equinoxe-q005`, `equinoxe-q108`
  - Groupe 4 : `equinoxe-q007`
- Candidats de fusion : aucun

Rationales Reviewer B :

- Disposition : Guide, visites, semaine de préparation et stabilité du calendrier sont des situations séparables malgré leur appartenance au même calendrier projet.
- Partition : Groupes/familles proposés : G1 guide de préparation = [storm-04-b-knowledge-016] ; G2 visites/activités préparatoires = [storm-04-b-knowledge-066, storm-04-b-knowledge-037] ; G3 semaine de préparation = [storm-04-b-knowledge-018] ; G4 stabilité du calendrier = [storm-04-b-knowledge-046].
Rationale courte : Le brief contient plusieurs jalons ou modalités distincts de la préparation au déménagement.

### Comparaison A/B

- Statut exact : `PARTITION_DISAGREEMENT`
- Accord de premier niveau : oui
- Accord complet : non
- Accords stricts : `fragmentationAssessment.value`, `fragmentationAssessment.mergeCanonicalReviewItemIds`, `reviewerScenarioFamilyPartition.value`
- Désaccords consignés : `reviewerScenarioFamilyPartition.canonicalPartition` (`PARTITION_DISAGREEMENT`)

Partition / crosswalk réel :

- Reviewer A : item local `storm-04-a-item-025`
  - `storm-04-a-knowledge-023` → `equinoxe-q003`
  - `storm-04-a-knowledge-075` → `equinoxe-q108`
  - `storm-04-a-knowledge-024` → `equinoxe-q007`
  - `storm-04-a-knowledge-026` → `equinoxe-q004`
  - `storm-04-a-knowledge-076` → `equinoxe-q005`
- Reviewer B : item local `storm-04-b-item-017`
  - `storm-04-b-knowledge-016` → `equinoxe-q007`
  - `storm-04-b-knowledge-018` → `equinoxe-q004`
  - `storm-04-b-knowledge-066` → `equinoxe-q005`
  - `storm-04-b-knowledge-037` → `equinoxe-q108`
  - `storm-04-b-knowledge-046` → `equinoxe-q003`

### Candidate knowledge

| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente | Scenario family existante |
|---|---|---|---|---|
| `equinoxe-q003` | Le calendrier peut-il encore changer ? | Le calendrier est stabilisé, mais certaines dates intermédiaires (ateliers, visites) peuvent être ajustées en fonction de l’avancement. | — | non attribuée |
| `equinoxe-q004` | Quand aura lieu la semaine de préparation ? | La semaine de préparation est prévue le 11 janvier 2027, juste avant l’emménagement. | — | non attribuée |
| `equinoxe-q005` | Est-ce que je peux visiter Cobalt avant le déménagement ? | Oui, des visites sont prévues fin novembre 2026 -- les créneaux seront communiqués par les ambassadeurs. | — | non attribuée |
| `equinoxe-q007` | On aura combien de temps pour préparer notre déménagement personnel ? | Le guide des nouveaux usages sera disponible début octobre, plusieurs mois avant le déménagement. | — | non attribuée |
| `equinoxe-q108` | Le projet prévoit-il d’autres ateliers après le choix des quartiers ? | Oui, des visites et une semaine de préparation sont prévues avant l’emménagement. | — | non attribuée |

### Existing adjudication context

#### boundary-arrival-preparation

- Type : `KNOWLEDGE_BOUNDARIES`
- q-ids du présent brief directement concernés : `equinoxe-q003`, `equinoxe-q004`, `equinoxe-q005`, `equinoxe-q007`, `equinoxe-q108`
- Partition de frontière scellée :
  - `ARRIVAL` : `equinoxe-q001`, `equinoxe-q002`, `equinoxe-q009`
  - `PREPARATION` : `equinoxe-q004`, `equinoxe-q005`, `equinoxe-q007`, `equinoxe-q108`
  - `CALENDAR_STABILITY` : `equinoxe-q003`
- Règles de frontière scellées :
  - `ARRIVAL` : date, timing ou phasage d’arrivée
  - `PREPARATION` : visites, semaine, guide, accompagnement ou étapes préparatoires
  - `CALENDAR_STABILITY` : caractère stabilisé, ajustable ou susceptible de changer du calendrier
  - `AMBIGUITY` : une formulation insuffisamment précise peut rester ambiguë entre ces composantes
- Rationale humaine scellée : Le fait que ces connaissances appartiennent toutes au calendrier d’arrivée à Cobalt ne constitue pas un besoin métier unique.

La date, le timing et le phasage de l’emménagement forment un besoin ARRIVAL.

Les visites, la semaine de préparation, le guide et les étapes précédant l’arrivée forment un besoin PREPARATION.

La stabilité ou la possibilité d’évolution du calendrier constitue un besoin distinct CALENDAR_STABILITY : equinoxe-q003 porte sur la fiabilité du calendrier dans son ensemble et ne doit pas être artificiellement absorbée par PREPARATION.

#### ambiguity-capacity-07

- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- q-ids du présent brief directement concernés : `equinoxe-q003`, `equinoxe-q004`, `equinoxe-q005`, `equinoxe-q007`, `equinoxe-q108`
- Classification scellée : `structuralAmbiguity`
- Mécanisme scellé : `underspecifiedReference`
- Groupes scellés :
  - Groupe 1 : `equinoxe-q003`
  - Groupe 2 : `equinoxe-q004`, `equinoxe-q005`, `equinoxe-q007`, `equinoxe-q108`
- Rationale humaine scellée : `q003` porte sur la stabilité générale du calendrier. Les quatre autres entrées décrivent ensemble le parcours de préparation avant déménagement : semaine de préparation, visites, anticipation et autres étapes. Les éclater en groupes distincts par jalon serait une granularité artificiellement fine.
- Règle future scellée : Partitionner au niveau de l’intention métier, pas automatiquement au niveau de chaque date ou jalon : plusieurs étapes peuvent constituer un même groupe « préparation », distinct de la question de stabilité générale du calendrier.

> Ce contexte scellé est restitué sans réinterprétation et ne préremplit pas la décision scenario-family.

### Human decision

```text
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 7. scenario-family-preflight-08 — Brief de famille 08

### Identification

- Item canonique : `scenario-family-preflight-08`
- Contexte métier réellement disponible : Adaptation du poste, accessibilité et équipement spécifique

generated user formulation: NOT AVAILABLE

### Reviewer A

- Disposition : `distinct`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q066`, `equinoxe-q067`, `equinoxe-q069`, `equinoxe-q104`
- Candidats de fusion : aucun

Rationales Reviewer A :

- Disposition : Adaptation individuelle du poste, accessibilité et canal RH/santé.
- Partition : Groupe Reviewer local F22 : [storm-04-a-knowledge-006, storm-04-a-knowledge-072, storm-04-a-knowledge-045, storm-04-a-knowledge-052]. Adaptation individuelle du poste, accessibilité et canal RH/santé.

### Reviewer B

- Disposition : `tooBroad`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q066`, `equinoxe-q069`, `equinoxe-q104`
  - Groupe 2 : `equinoxe-q067`
- Candidats de fusion : aucun

Rationales Reviewer B :

- Disposition : Le brief confond le processus de demande d’adaptation avec une propriété générale d’accessibilité du site.
- Partition : Groupes/familles proposés : G1 adaptation individuelle du poste/ergonomie = [storm-04-b-knowledge-063, storm-04-b-knowledge-079, storm-04-b-knowledge-049] ; G2 accessibilité générale PMR du site = [storm-04-b-knowledge-013].
Rationale courte : Une démarche d’aménagement individuel et l’accessibilité générale du bâtiment relèvent de situations différentes.

### Comparaison A/B

- Statut exact : `DECISION_VALUE_DISAGREEMENT`
- Accord de premier niveau : non
- Accord complet : non
- Accords stricts : `fragmentationAssessment.mergeCanonicalReviewItemIds`, `reviewerScenarioFamilyPartition.value`
- Désaccords consignés : `fragmentationAssessment.value` (`DECISION_VALUE_DISAGREEMENT`), `reviewerScenarioFamilyPartition.canonicalPartition` (`PARTITION_DISAGREEMENT`)

Partition / crosswalk réel :

- Reviewer A : item local `storm-04-a-item-031`
  - `storm-04-a-knowledge-006` → `equinoxe-q104`
  - `storm-04-a-knowledge-072` → `equinoxe-q067`
  - `storm-04-a-knowledge-045` → `equinoxe-q069`
  - `storm-04-a-knowledge-052` → `equinoxe-q066`
- Reviewer B : item local `storm-04-b-item-020`
  - `storm-04-b-knowledge-063` → `equinoxe-q066`
  - `storm-04-b-knowledge-079` → `equinoxe-q069`
  - `storm-04-b-knowledge-013` → `equinoxe-q067`
  - `storm-04-b-knowledge-049` → `equinoxe-q104`

### Candidate knowledge

| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente | Scenario family existante |
|---|---|---|---|---|
| `equinoxe-q066` | Comment demander un poste adapté ? | Via les circuits RH/santé habituels. | Groupe scellé : `equinoxe-q066`, `equinoxe-q069` ; preferredEntryId : `equinoxe-q069` | non attribuée |
| `equinoxe-q067` | Cobalt est-il accessible aux personnes à mobilité réduite ? | Oui, l’accessibilité fait partie des principes du projet, avec une attention portée à tous. | — | non attribuée |
| `equinoxe-q069` | Qui contacter pour un besoin spécifique d’ergonomie ? | Les circuits RH/santé habituels restent le point d’entrée pour toute demande d’adaptation de poste. | Groupe scellé : `equinoxe-q066`, `equinoxe-q069` ; preferredEntryId : `equinoxe-q069` | non attribuée |
| `equinoxe-q104` | Qui puis-je contacter pour une question d’accessibilité avant même le déménagement ? | Vous pouvez vous adresser dès maintenant aux circuits RH/santé habituels ou à un ambassadeur. | — | non attribuée |

### Existing adjudication context

#### equivalence-comparison-04

- Type : `EQUIVALENCE_AND_PREFERRED`
- q-ids du présent brief directement concernés : `equinoxe-q066`, `equinoxe-q069`
- Groupe d’équivalence scellé : `equinoxe-q066`, `equinoxe-q069`
- preferredEntryId scellé : `equinoxe-q069`
- Rationale humaine scellée : equinoxe-q069 formule explicitement la règle générale : les circuits RH/santé sont le point d’entrée pour toute demande d’adaptation de poste. Elle représente mieux l’ensemble du groupe.

> Ce contexte scellé est restitué sans réinterprétation et ne préremplit pas la décision scenario-family.

### Human decision

```text
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 8. scenario-family-preflight-09 — Brief de famille 09

### Identification

- Item canonique : `scenario-family-preflight-09`
- Contexte métier réellement disponible : Capacité du restaurant et capacité de la terrasse

generated user formulation: NOT AVAILABLE

### Reviewer A

- Disposition : `distinct`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q061`, `equinoxe-q064`
- Candidats de fusion : aucun

Rationales Reviewer A :

- Disposition : Capacité des espaces de restauration.
- Partition : Groupe Reviewer local F06 : [storm-04-a-knowledge-043, storm-04-a-knowledge-015]. Capacité des espaces de restauration.

### Reviewer B

- Disposition : `distinct`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q061`
  - Groupe 2 : `equinoxe-q064`
- Candidats de fusion : aucun

Rationales Reviewer B :

- Disposition : La comparaison des capacités des deux lieux de restauration constitue un besoin identifié et ne duplique pas exactement un autre brief.
- Partition : Groupes/familles proposés : G1 capacité de la Terrasse = [storm-04-b-knowledge-004] ; G2 capacité du Restaurant = [storm-04-b-knowledge-044].
Rationale courte : Les capacités portent sur deux lieux de restauration différents.

### Comparaison A/B

- Statut exact : `PARTITION_DISAGREEMENT`
- Accord de premier niveau : oui
- Accord complet : non
- Accords stricts : `fragmentationAssessment.value`, `fragmentationAssessment.mergeCanonicalReviewItemIds`, `reviewerScenarioFamilyPartition.value`
- Désaccords consignés : `reviewerScenarioFamilyPartition.canonicalPartition` (`PARTITION_DISAGREEMENT`)

Partition / crosswalk réel :

- Reviewer A : item local `storm-04-a-item-008`
  - `storm-04-a-knowledge-043` → `equinoxe-q061`
  - `storm-04-a-knowledge-015` → `equinoxe-q064`
- Reviewer B : item local `storm-04-b-item-011`
  - `storm-04-b-knowledge-004` → `equinoxe-q064`
  - `storm-04-b-knowledge-044` → `equinoxe-q061`

### Candidate knowledge

| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente | Scenario family existante |
|---|---|---|---|---|
| `equinoxe-q061` | Combien de places au restaurant ? | Le restaurant proposera environ 220 places. | — | non attribuée |
| `equinoxe-q064` | Puis-je déjeuner dehors quand il fait beau ? | Oui, une terrasse d’environ 70 places est prévue. | — | non attribuée |

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
- q-ids du présent brief directement concernés : `equinoxe-q064`
- Classification scellée : `artificialOrMalformed`
- Mécanisme scellé : non applicable
- Rationale humaine scellée : `q072` couvre déjà l’intention générale de choix d’un lieu de déjeuner. `q064` affine le cas spécifique du déjeuner en terrasse et `q092` ajoute une contrainte d’usage concernant les postes de travail. Il s’agit d’une structure général → cas particulier → règle, pas de trois lectures qu’il faudrait nécessairement départager.
- Règle future scellée : Lorsqu’une entrée générale couvre l’intention et que les autres sont des raffinements ou contraintes, ne pas fabriquer une ambiguïté simplement parce que plusieurs Q&A concernent le même domaine.

> Ce contexte scellé est restitué sans réinterprétation et ne préremplit pas la décision scenario-family.

### Human decision

```text
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 9. scenario-family-preflight-10 — Brief de famille 10

### Identification

- Item canonique : `scenario-family-preflight-10`
- Contexte métier réellement disponible : Finalité, offre et accès du Café

generated user formulation: NOT AVAILABLE

### Reviewer A

- Disposition : `distinct`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q032`, `equinoxe-q063`, `equinoxe-q093`
- Candidats de fusion : aucun

Rationales Reviewer A :

- Disposition : Café central : finalité, offre et horaires ou accès.
- Partition : Groupe Reviewer local F08 : [storm-04-a-knowledge-078, storm-04-a-knowledge-062, storm-04-a-knowledge-063]. Café central : finalité, offre et horaires ou accès.

### Reviewer B

- Disposition : `tooBroad`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q032`
  - Groupe 2 : `equinoxe-q063`
  - Groupe 3 : `equinoxe-q093`
- Candidats de fusion : aucun

Rationales Reviewer B :

- Disposition : Le brief rassemble plusieurs situations distinctes autour du même lieu sans besoin métier unique.
- Partition : Groupes/familles proposés : G1 accès temporel au Café = [storm-04-b-knowledge-041] ; G2 finalité conviviale = [storm-04-b-knowledge-038] ; G3 offre alimentaire = [storm-04-b-knowledge-059].
Rationale courte : Les connaissances répondent à trois attributs différents du Café : horaires d’accès, usage convivial et possibilité de restauration.

### Comparaison A/B

- Statut exact : `DECISION_VALUE_DISAGREEMENT`
- Accord de premier niveau : non
- Accord complet : non
- Accords stricts : `fragmentationAssessment.mergeCanonicalReviewItemIds`, `reviewerScenarioFamilyPartition.value`
- Désaccords consignés : `fragmentationAssessment.value` (`DECISION_VALUE_DISAGREEMENT`), `reviewerScenarioFamilyPartition.canonicalPartition` (`PARTITION_DISAGREEMENT`)

Partition / crosswalk réel :

- Reviewer A : item local `storm-04-a-item-010`
  - `storm-04-a-knowledge-078` → `equinoxe-q032`
  - `storm-04-a-knowledge-062` → `equinoxe-q093`
  - `storm-04-a-knowledge-063` → `equinoxe-q063`
- Reviewer B : item local `storm-04-b-item-009`
  - `storm-04-b-knowledge-041` → `equinoxe-q093`
  - `storm-04-b-knowledge-038` → `equinoxe-q032`
  - `storm-04-b-knowledge-059` → `equinoxe-q063`

### Candidate knowledge

| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente | Scenario family existante |
|---|---|---|---|---|
| `equinoxe-q032` | Y a-t-il un espace pour les échanges informels ? | Oui, le Café central et la Terrasse sont pensés pour la convivialité et les échanges informels. | — | non attribuée |
| `equinoxe-q063` | Le café central sert-il aussi à manger ? | Le Café central est surtout pensé pour la convivialité -- l’offre précise sera communiquée avant l’ouverture. | — | non attribuée |
| `equinoxe-q093` | Le café central est-il accessible toute la journée ? | Oui, le Café central est pensé comme un lieu de convivialité accessible tout au long de la journée. | — | non attribuée |

### Existing adjudication context

#### ambiguity-capacity-10

- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- q-ids du présent brief directement concernés : `equinoxe-q032`, `equinoxe-q063`, `equinoxe-q093`
- Classification scellée : `artificialOrMalformed`
- Mécanisme scellé : non applicable
- Rationale humaine scellée : Finalité conviviale, offre alimentaire et accessibilité tout au long de la journée sont des attributs complémentaires du même Café central. Ils peuvent être restitués ensemble et ne forcent pas un choix entre des réponses substantiellement différentes.
- Règle future scellée : Des facettes complémentaires d’un même lieu ne constituent pas une ambiguïté structurelle si elles peuvent être restituées ensemble sans contradiction ni choix d’intention exclusif.

#### ambiguity-capacity-11

- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- q-ids du présent brief directement concernés : `equinoxe-q032`
- Classification scellée : `structuralAmbiguity`
- Mécanisme scellé : `alternativeIntentReadings`
- Groupes scellés :
  - Groupe 1 : `equinoxe-q032`
  - Groupe 2 : `equinoxe-q064`
- Rationale humaine scellée : La terrasse peut servir aux échanges informels et au déjeuner extérieur. Ces connaissances ne sont pas concurrentes ou contradictoires. Elles représentent deux intentions compatibles mais différentes qu’une formulation insuffisamment spécifique sur « l’usage de la terrasse » peut viser.
- Règle future scellée : Des usages compatibles ne sont jamais `competingPublishedKnowledge`; s’ils représentent des intentions distinctes sous une formulation réellement ambiguë, utiliser `alternativeIntentReadings`.

> Ce contexte scellé est restitué sans réinterprétation et ne préremplit pas la décision scenario-family.

### Human decision

```text
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 10. scenario-family-preflight-13 — Brief de famille 13

### Identification

- Item canonique : `scenario-family-preflight-13`
- Contexte métier réellement disponible : Portée de l’offre alimentaire, snacks et menu

generated user formulation: NOT AVAILABLE

### Reviewer A

- Disposition : `distinct`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q062`, `equinoxe-q102`, `equinoxe-q103`
- Candidats de fusion : aucun

Rationales Reviewer A :

- Disposition : Contenu de l’offre alimentaire.
- Partition : Groupe Reviewer local F12 : [storm-04-a-knowledge-034, storm-04-a-knowledge-069, storm-04-a-knowledge-074]. Contenu de l’offre alimentaire.

### Reviewer B

- Disposition : `tooBroad`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q062`, `equinoxe-q103`
  - Groupe 2 : `equinoxe-q102`
- Candidats de fusion : aucun

Rationales Reviewer B :

- Disposition : Le brief réunit deux situations de restauration différentes : composition du menu du Restaurant et disponibilité d’une offre rapide/snack.
- Partition : Groupes/familles proposés : G1 menu/offre du Restaurant = [storm-04-b-knowledge-006, storm-04-b-knowledge-065] ; G2 restauration rapide/snack = [storm-04-b-knowledge-011].
Rationale courte : Les connaissances distinguent le contenu de l’offre du Restaurant et l’offre de snack/restauration rapide.

### Comparaison A/B

- Statut exact : `DECISION_VALUE_DISAGREEMENT`
- Accord de premier niveau : non
- Accord complet : non
- Accords stricts : `fragmentationAssessment.mergeCanonicalReviewItemIds`, `reviewerScenarioFamilyPartition.value`
- Désaccords consignés : `fragmentationAssessment.value` (`DECISION_VALUE_DISAGREEMENT`), `reviewerScenarioFamilyPartition.canonicalPartition` (`PARTITION_DISAGREEMENT`)

Partition / crosswalk réel :

- Reviewer A : item local `storm-04-a-item-014`
  - `storm-04-a-knowledge-034` → `equinoxe-q102`
  - `storm-04-a-knowledge-069` → `equinoxe-q062`
  - `storm-04-a-knowledge-074` → `equinoxe-q103`
- Reviewer B : item local `storm-04-b-item-001`
  - `storm-04-b-knowledge-006` → `equinoxe-q103`
  - `storm-04-b-knowledge-065` → `equinoxe-q062`
  - `storm-04-b-knowledge-011` → `equinoxe-q102`

### Candidate knowledge

| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente | Scenario family existante |
|---|---|---|---|---|
| `equinoxe-q062` | Y aura-t-il une offre végétarienne ? | Oui, une offre chaude, végétarienne et rapide est prévue au restaurant. | — | non attribuée |
| `equinoxe-q102` | Y a-t-il des distributeurs si je veux juste un snack ? | L’offre précise de restauration rapide sera détaillée avant l’ouverture du site. | — | non attribuée |
| `equinoxe-q103` | Le restaurant propose-t-il un menu différent chaque jour ? | Le Restaurant proposera une offre chaude, végétarienne et rapide -- le détail de la carte sera communiqué plus tard. | — | non attribuée |

### Existing adjudication context

#### ambiguity-capacity-13

- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- q-ids du présent brief directement concernés : `equinoxe-q062`, `equinoxe-q102`, `equinoxe-q103`
- Classification scellée : `blockedTemporalInstability`
- Mécanisme scellé : non applicable
- Rationale humaine scellée : L’existence d’une offre chaude/végétarienne/rapide est confirmée, mais le détail du menu et l’offre précise de snack/restauration rapide restent explicitement reportés. La famille mélange donc un fait stable avec des branches dont la connaissance substantielle n’est pas encore stabilisée.
- Règle future scellée : Ne construire une famille multi-branche d’offre que lorsque chaque branche possède une connaissance substantielle suffisamment stabilisée ; une promesse de précision future ne vaut pas automatiquement couverture stable.

> Ce contexte scellé est restitué sans réinterprétation et ne préremplit pas la décision scenario-family.

### Human decision

```text
decision: PENDING
rationale: PENDING
future_rule: PENDING
```
