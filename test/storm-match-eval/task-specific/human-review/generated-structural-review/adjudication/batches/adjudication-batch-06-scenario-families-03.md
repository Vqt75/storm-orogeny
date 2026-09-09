# Adjudication structurelle — Batch 06 : scenario families 03

- Batch : `adjudication-batch-06-scenario-families-03`
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

## 1. scenario-family-preflight-24 — Brief de famille 24

### Identification

- Item canonique : `scenario-family-preflight-24`
- Contexte métier réellement disponible : Capacité lorsque le lieu n’est pas précisé

generated user formulation: NOT AVAILABLE

### Reviewer A

- Disposition : `mergeWithAnotherDisplayedBrief`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q026`, `equinoxe-q028`, `equinoxe-q029`, `equinoxe-q031`, `equinoxe-q076`
- Candidats de fusion : `scenario-family-preflight-34`

Rationales Reviewer A :

- Disposition : Même scénario de capacité non spécifiée que l’item 016.
- Partition : Groupe Reviewer local F14 : [storm-04-a-knowledge-008, storm-04-a-knowledge-028, storm-04-a-knowledge-010, storm-04-a-knowledge-009, storm-04-a-knowledge-002]. Même scénario de capacité non spécifiée que l’item 016.

### Reviewer B

- Disposition : `mergeWithAnotherDisplayedBrief`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q026`
  - Groupe 2 : `equinoxe-q028`
  - Groupe 3 : `equinoxe-q029`
  - Groupe 4 : `equinoxe-q031`
  - Groupe 5 : `equinoxe-q076`
- Candidats de fusion : `scenario-family-preflight-34`

Rationales Reviewer B :

- Disposition : Le même besoin de capacité avec référent de lieu à distinguer est aussi porté par storm-04-b-item-013 ; les deux briefs doivent être fusionnés.
- Partition : Groupes/familles proposés : G1 capacité du site = [storm-04-b-knowledge-010] ; G2 Project Room = [storm-04-b-knowledge-023] ; G3 salle de réunion = [storm-04-b-knowledge-015] ; G4 Forum = [storm-04-b-knowledge-068] ; G5 Bibliothèque/Focus = [storm-04-b-knowledge-025].
Rationale courte : Une demande de capacité doit être rattachée à l’objet ou au lieu concerné.

### Comparaison A/B

- Statut exact : `PARTITION_DISAGREEMENT`
- Accord de premier niveau : oui
- Accord complet : non
- Accords stricts : `fragmentationAssessment.value`, `fragmentationAssessment.mergeCanonicalReviewItemIds`, `reviewerScenarioFamilyPartition.value`
- Désaccords consignés : `reviewerScenarioFamilyPartition.canonicalPartition` (`PARTITION_DISAGREEMENT`)

Partition / crosswalk réel :

- Reviewer A : item local `storm-04-a-item-026`
  - `storm-04-a-knowledge-008` → `equinoxe-q026`
  - `storm-04-a-knowledge-028` → `equinoxe-q029`
  - `storm-04-a-knowledge-010` → `equinoxe-q031`
  - `storm-04-a-knowledge-009` → `equinoxe-q076`
  - `storm-04-a-knowledge-002` → `equinoxe-q028`
- Reviewer B : item local `storm-04-b-item-007`
  - `storm-04-b-knowledge-025` → `equinoxe-q026`
  - `storm-04-b-knowledge-010` → `equinoxe-q076`
  - `storm-04-b-knowledge-023` → `equinoxe-q031`
  - `storm-04-b-knowledge-015` → `equinoxe-q028`
  - `storm-04-b-knowledge-068` → `equinoxe-q029`

### Candidate knowledge

| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente | Scenario family existante |
|---|---|---|---|---|
| `equinoxe-q026` | C’est quoi la différence entre Focus et Bibliothèque ? | Les espaces Focus sont des postes individuels isolés ; la Bibliothèque est un espace collectif à silence renforcé, 24 places. | — | non attribuée |
| `equinoxe-q028` | Quelle est la capacité des salles de réunion ? | Les salles de réunion accueillent de 4 à 16 personnes, en présentiel ou hybride. | — | non attribuée |
| `equinoxe-q029` | Le Forum, c’est pour quoi ? | Le Forum est un espace pour les événements et prises de parole, jusqu’à 120 personnes. | — | non attribuée |
| `equinoxe-q031` | Combien de personnes dans une Project Room ? | Les Project Rooms accueillent de 6 à 10 personnes. | — | non attribuée |
| `equinoxe-q076` | Combien de personnes vont travailler à Cobalt ? | Environ 640 collaborateurs sont concernés par le projet. | — | non attribuée |

### Existing adjudication context

#### boundary-rooms-focus

- Type : `KNOWLEDGE_BOUNDARIES`
- q-ids du présent brief directement concernés : `equinoxe-q026`, `equinoxe-q028`, `equinoxe-q029`, `equinoxe-q031`
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

#### ambiguity-capacity-25

- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- q-ids du présent brief directement concernés : `equinoxe-q028`, `equinoxe-q029`, `equinoxe-q031`
- Classification scellée : `structuralAmbiguity`
- Mécanisme scellé : `alternativeIntentReadings`
- Groupes scellés :
  - Groupe 1 : `equinoxe-q028`
  - Groupe 2 : `equinoxe-q029`
  - Groupe 3 : `equinoxe-q031`
- Rationale humaine scellée : Un groupe de six à dix personnes entre dans la capacité d’une salle de réunion, d’une Project Room et d’un Forum. Ces connaissances ne sont pas concurrentes ou contradictoires : le bon choix dépend de la finalité du groupe — réunion, travail projet ou événement/prise de parole — qui n’est pas exprimée par la seule taille.
- Règle future scellée : Quand plusieurs espaces satisfont une contrainte quantitative, l’ambiguïté porte sur l’usage recherché ; des capacités qui se recouvrent ne constituent pas une contradiction de connaissance.

#### ambiguity-capacity-33

- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- q-ids du présent brief directement concernés : `equinoxe-q076`
- Classification scellée : `artificialOrMalformed`
- Mécanisme scellé : non applicable
- Rationale humaine scellée : Le nombre de niveaux du bâtiment et le nombre de collaborateurs concernés sont deux quantités portant sur des objets métier sans rapport. Leur seule similarité est la structure interrogative de comptage.
- Règle future scellée : Une structure interrogative ou quantitative commune ne suffit jamais à créer une ambiguïté lorsque les objets mesurés sont métierment distincts.

> Ce contexte scellé est restitué sans réinterprétation et ne préremplit pas la décision scenario-family.

### Cadre de décision et portée non résolue

- Statut structurel non résolu : `PARTITION_DISAGREEMENT`.
- Champs concernés : `reviewerScenarioFamilyPartition.canonicalPartition` (`PARTITION_DISAGREEMENT`).
- Dispositions autorisées : `distinct`, `mergeWithAnotherDisplayedBrief`, `tooBroad`, `artificiallyFragmented`, `insufficientEvidence`.
- Structures de partition autorisées : `reviewerDefinedFamilyGroups`, `insufficientEvidence`.
- Targets de fusion affichés et valides :
  - `scenario-family-preflight-34` — statut d’adjudication : `PENDING_HUMAN_REVIEW`.
- Conséquences structurelles possibles :
  - `distinct` : Le brief reste une unité de scénario autonome, avec la partition interne explicitement retenue.
  - `mergeWithAnotherDisplayedBrief` : Le brief est relié uniquement au ou aux targets explicitement sélectionnés ; la partition retenue demeure explicite.
  - `tooBroad` : Les groupes de la partition retenue deviennent des unités de scénario distinctes.
  - `artificiallyFragmented` : Le brief est marqué comme fragment d’un scénario plus large ; tout regroupement futur doit rester explicitement traçable.
  - `insufficientEvidence` : La structure finale de ce brief reste non résolue et ne peut pas autoriser la génération.

### Human decision

```text
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 2. scenario-family-preflight-25 — Brief de famille 25

### Identification

- Item canonique : `scenario-family-preflight-25`
- Contexte métier réellement disponible : Choix d’espace pour un groupe de six à dix personnes

generated user formulation: NOT AVAILABLE

### Reviewer A

- Disposition : `mergeWithAnotherDisplayedBrief`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q028`, `equinoxe-q029`, `equinoxe-q031`
- Candidats de fusion : `scenario-family-preflight-31`

Rationales Reviewer A :

- Disposition : Même scénario salle de réunion ou Project Room que l’item 021.
- Partition : Groupe Reviewer local F17 : [storm-04-a-knowledge-002, storm-04-a-knowledge-010, storm-04-a-knowledge-028]. Même scénario salle de réunion ou Project Room que l’item 021.

### Reviewer B

- Disposition : `distinct`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q028`, `equinoxe-q029`, `equinoxe-q031`
- Candidats de fusion : aucun

Rationales Reviewer B :

- Disposition : Le besoin de sélectionner un espace pour une taille de groupe donnée est plus spécifique qu’une simple demande de capacité.
- Partition : Groupes/familles proposés : G1 choix d’un espace pour 6–10 personnes = [storm-04-b-knowledge-015, storm-04-b-knowledge-023, storm-04-b-knowledge-068].
Rationale courte : Les trois connaissances servent le même besoin de choix d’espace en confrontant capacité et finalité des salles de réunion, Project Rooms et Forum.

### Comparaison A/B

- Statut exact : `DECISION_VALUE_DISAGREEMENT`
- Accord de premier niveau : non
- Accord complet : non
- Accords stricts : `reviewerScenarioFamilyPartition.value`, `reviewerScenarioFamilyPartition.canonicalPartition`
- Désaccords consignés : `fragmentationAssessment.value` (`DECISION_VALUE_DISAGREEMENT`), `fragmentationAssessment.mergeCanonicalReviewItemIds` (`CONDITIONAL_STRUCTURE_DISAGREEMENT`)

Partition / crosswalk réel :

- Reviewer A : item local `storm-04-a-item-034`
  - `storm-04-a-knowledge-002` → `equinoxe-q028`
  - `storm-04-a-knowledge-010` → `equinoxe-q031`
  - `storm-04-a-knowledge-028` → `equinoxe-q029`
- Reviewer B : item local `storm-04-b-item-008`
  - `storm-04-b-knowledge-015` → `equinoxe-q028`
  - `storm-04-b-knowledge-068` → `equinoxe-q029`
  - `storm-04-b-knowledge-023` → `equinoxe-q031`

### Candidate knowledge

| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente | Scenario family existante |
|---|---|---|---|---|
| `equinoxe-q028` | Quelle est la capacité des salles de réunion ? | Les salles de réunion accueillent de 4 à 16 personnes, en présentiel ou hybride. | — | non attribuée |
| `equinoxe-q029` | Le Forum, c’est pour quoi ? | Le Forum est un espace pour les événements et prises de parole, jusqu’à 120 personnes. | — | non attribuée |
| `equinoxe-q031` | Combien de personnes dans une Project Room ? | Les Project Rooms accueillent de 6 à 10 personnes. | — | non attribuée |

### Existing adjudication context

#### boundary-rooms-focus

- Type : `KNOWLEDGE_BOUNDARIES`
- q-ids du présent brief directement concernés : `equinoxe-q028`, `equinoxe-q029`, `equinoxe-q031`
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

#### ambiguity-capacity-25

- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- q-ids du présent brief directement concernés : `equinoxe-q028`, `equinoxe-q029`, `equinoxe-q031`
- Classification scellée : `structuralAmbiguity`
- Mécanisme scellé : `alternativeIntentReadings`
- Groupes scellés :
  - Groupe 1 : `equinoxe-q028`
  - Groupe 2 : `equinoxe-q029`
  - Groupe 3 : `equinoxe-q031`
- Rationale humaine scellée : Un groupe de six à dix personnes entre dans la capacité d’une salle de réunion, d’une Project Room et d’un Forum. Ces connaissances ne sont pas concurrentes ou contradictoires : le bon choix dépend de la finalité du groupe — réunion, travail projet ou événement/prise de parole — qui n’est pas exprimée par la seule taille.
- Règle future scellée : Quand plusieurs espaces satisfont une contrainte quantitative, l’ambiguïté porte sur l’usage recherché ; des capacités qui se recouvrent ne constituent pas une contradiction de connaissance.

> Ce contexte scellé est restitué sans réinterprétation et ne préremplit pas la décision scenario-family.

### Cadre de décision et portée non résolue

- Statut structurel non résolu : `DECISION_VALUE_DISAGREEMENT`.
- Champs concernés : `fragmentationAssessment.value` (`DECISION_VALUE_DISAGREEMENT`), `fragmentationAssessment.mergeCanonicalReviewItemIds` (`CONDITIONAL_STRUCTURE_DISAGREEMENT`).
- Dispositions autorisées : `distinct`, `mergeWithAnotherDisplayedBrief`, `tooBroad`, `artificiallyFragmented`, `insufficientEvidence`.
- Structures de partition autorisées : `reviewerDefinedFamilyGroups`, `insufficientEvidence`.
- Targets de fusion affichés et valides :
  - `scenario-family-preflight-31` — statut d’adjudication : `PENDING_HUMAN_REVIEW`.
- Conséquences structurelles possibles :
  - `distinct` : Le brief reste une unité de scénario autonome, avec la partition interne explicitement retenue.
  - `mergeWithAnotherDisplayedBrief` : Le brief est relié uniquement au ou aux targets explicitement sélectionnés ; la partition retenue demeure explicite.
  - `tooBroad` : Les groupes de la partition retenue deviennent des unités de scénario distinctes.
  - `artificiallyFragmented` : Le brief est marqué comme fragment d’un scénario plus large ; tout regroupement futur doit rester explicitement traçable.
  - `insufficientEvidence` : La structure finale de ce brief reste non résolue et ne peut pas autoriser la génération.

### Human decision

```text
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 3. scenario-family-preflight-27 — Brief de famille 27

### Identification

- Item canonique : `scenario-family-preflight-27`
- Contexte métier réellement disponible : Travail calme, appel rapide et confidentialité

generated user formulation: NOT AVAILABLE

### Reviewer A

- Disposition : `distinct`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q025`, `equinoxe-q027`, `equinoxe-q050`, `equinoxe-q051`, `equinoxe-q099`
- Candidats de fusion : aucun

Rationales Reviewer A :

- Disposition : Choix d’un espace selon le besoin : calme, appel ou confidentialité.
- Partition : Groupe Reviewer local F05 : [storm-04-a-knowledge-082, storm-04-a-knowledge-067, storm-04-a-knowledge-004, storm-04-a-knowledge-059, storm-04-a-knowledge-007]. Choix d’un espace selon le besoin : calme, appel ou confidentialité.

### Reviewer B

- Disposition : `tooBroad`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q025`
  - Groupe 2 : `equinoxe-q027`
  - Groupe 3 : `equinoxe-q050`, `equinoxe-q051`, `equinoxe-q099`
- Candidats de fusion : aucun

Rationales Reviewer B :

- Disposition : Le brief regroupe trois besoins fonctionnels distincts plutôt qu’une seule famille de situation.
- Partition : Groupes/familles proposés : G1 appel court = [storm-04-b-knowledge-070] ; G2 échange confidentiel = [storm-04-b-knowledge-012, storm-04-b-knowledge-040, storm-04-b-knowledge-039] ; G3 travail calme = [storm-04-b-knowledge-047].
Rationale courte : Les espaces recommandés changent selon le besoin acoustique : appel court, confidentialité ou concentration.

### Comparaison A/B

- Statut exact : `DECISION_VALUE_DISAGREEMENT`
- Accord de premier niveau : non
- Accord complet : non
- Accords stricts : `fragmentationAssessment.mergeCanonicalReviewItemIds`, `reviewerScenarioFamilyPartition.value`
- Désaccords consignés : `fragmentationAssessment.value` (`DECISION_VALUE_DISAGREEMENT`), `reviewerScenarioFamilyPartition.canonicalPartition` (`PARTITION_DISAGREEMENT`)

Partition / crosswalk réel :

- Reviewer A : item local `storm-04-a-item-006`
  - `storm-04-a-knowledge-082` → `equinoxe-q025`
  - `storm-04-a-knowledge-067` → `equinoxe-q051`
  - `storm-04-a-knowledge-004` → `equinoxe-q027`
  - `storm-04-a-knowledge-059` → `equinoxe-q099`
  - `storm-04-a-knowledge-007` → `equinoxe-q050`
- Reviewer B : item local `storm-04-b-item-003`
  - `storm-04-b-knowledge-070` → `equinoxe-q027`
  - `storm-04-b-knowledge-012` → `equinoxe-q099`
  - `storm-04-b-knowledge-040` → `equinoxe-q051`
  - `storm-04-b-knowledge-047` → `equinoxe-q025`
  - `storm-04-b-knowledge-039` → `equinoxe-q050`

### Candidate knowledge

| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente | Scenario family existante |
|---|---|---|---|---|
| `equinoxe-q025` | Où travailler au calme ? | À la Bibliothèque ou dans les espaces Focus. | — | non attribuée |
| `equinoxe-q027` | Où puis-je passer un appel rapide sans déranger personne ? | Utilisez une bulle, pensée pour les appels et visioconférences courtes. | — | non attribuée |
| `equinoxe-q050` | Comment garantir la confidentialité dans un open space ? | Les salles de réunion et bulles sont prévues pour les échanges nécessitant de la confidentialité. | Groupe scellé : `equinoxe-q050`, `equinoxe-q051`, `equinoxe-q099` ; preferredEntryId : `equinoxe-q050` | non attribuée |
| `equinoxe-q051` | Puis-je passer un entretien RH confidentiel sur site ? | Oui, utilisez une salle de réunion ou une bulle pour ce type d’échange. | Groupe scellé : `equinoxe-q050`, `equinoxe-q051`, `equinoxe-q099` ; preferredEntryId : `equinoxe-q050` | non attribuée |
| `equinoxe-q099` | Puis-je réserver une salle pour un appel client confidentiel ? | Oui, les salles de réunion et bulles conviennent à ce type d’échange. | Groupe scellé : `equinoxe-q050`, `equinoxe-q051`, `equinoxe-q099` ; preferredEntryId : `equinoxe-q050` | non attribuée |

### Existing adjudication context

#### equivalence-comparison-03

- Type : `EQUIVALENCE_AND_PREFERRED`
- q-ids du présent brief directement concernés : `equinoxe-q050`, `equinoxe-q051`, `equinoxe-q099`
- Groupe d’équivalence scellé : `equinoxe-q050`, `equinoxe-q051`, `equinoxe-q099`
- preferredEntryId scellé : `equinoxe-q050`
- Rationale humaine scellée : equinoxe-q050 exprime la règle générale et autonome relative aux échanges confidentiels. Les cas RH et appel client sont des instanciations de cette même règle.

#### boundary-rooms-focus

- Type : `KNOWLEDGE_BOUNDARIES`
- q-ids du présent brief directement concernés : `equinoxe-q025`, `equinoxe-q027`, `equinoxe-q050`, `equinoxe-q051`, `equinoxe-q099`
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

> Ce contexte scellé est restitué sans réinterprétation et ne préremplit pas la décision scenario-family.

### Cadre de décision et portée non résolue

- Statut structurel non résolu : `DECISION_VALUE_DISAGREEMENT`.
- Champs concernés : `fragmentationAssessment.value` (`DECISION_VALUE_DISAGREEMENT`), `reviewerScenarioFamilyPartition.canonicalPartition` (`PARTITION_DISAGREEMENT`).
- Dispositions autorisées : `distinct`, `mergeWithAnotherDisplayedBrief`, `tooBroad`, `artificiallyFragmented`, `insufficientEvidence`.
- Structures de partition autorisées : `reviewerDefinedFamilyGroups`, `insufficientEvidence`.
- Targets de fusion affichés et valides :
  - aucun target de fusion n’est proposé dans les décisions A/B scellées.
- Conséquences structurelles possibles :
  - `distinct` : Le brief reste une unité de scénario autonome, avec la partition interne explicitement retenue.
  - `mergeWithAnotherDisplayedBrief` : Le brief est relié uniquement au ou aux targets explicitement sélectionnés ; la partition retenue demeure explicite.
  - `tooBroad` : Les groupes de la partition retenue deviennent des unités de scénario distinctes.
  - `artificiallyFragmented` : Le brief est marqué comme fragment d’un scénario plus large ; tout regroupement futur doit rester explicitement traçable.
  - `insufficientEvidence` : La structure finale de ce brief reste non résolue et ne peut pas autoriser la génération.

### Human decision

```text
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 4. scenario-family-preflight-28 — Brief de famille 28

### Identification

- Item canonique : `scenario-family-preflight-28`
- Contexte métier réellement disponible : Isolation acoustique et fermeture physique

generated user formulation: NOT AVAILABLE

### Reviewer A

- Disposition : `distinct`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q050`, `equinoxe-q051`, `equinoxe-q052`, `equinoxe-q091`, `equinoxe-q099`
- Candidats de fusion : aucun

Rationales Reviewer A :

- Disposition : Propriétés physiques et acoustiques d’un espace.
- Partition : Groupe Reviewer local F11 : [storm-04-a-knowledge-007, storm-04-a-knowledge-059, storm-04-a-knowledge-067, storm-04-a-knowledge-041, storm-04-a-knowledge-064]. Propriétés physiques et acoustiques d’un espace.

### Reviewer B

- Disposition : `tooBroad`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q050`, `equinoxe-q051`, `equinoxe-q099`
  - Groupe 2 : `equinoxe-q052`
  - Groupe 3 : `equinoxe-q091`
- Candidats de fusion : aucun

Rationales Reviewer B :

- Disposition : Le brief réunit plusieurs propriétés acoustiques ou spatiales qui doivent être séparées en situations distinctes.
- Partition : Groupes/familles proposés : G1 isolation acoustique Project Room = [storm-04-b-knowledge-024] ; G2 confidentialité des échanges = [storm-04-b-knowledge-012, storm-04-b-knowledge-039, storm-04-b-knowledge-040] ; G3 fermeture physique des Focus = [storm-04-b-knowledge-005].
Rationale courte : Isolation acoustique, confidentialité d’un échange et fermeture physique d’un poste ne sont pas le même besoin.

### Comparaison A/B

- Statut exact : `DECISION_VALUE_DISAGREEMENT`
- Accord de premier niveau : non
- Accord complet : non
- Accords stricts : `fragmentationAssessment.mergeCanonicalReviewItemIds`, `reviewerScenarioFamilyPartition.value`
- Désaccords consignés : `fragmentationAssessment.value` (`DECISION_VALUE_DISAGREEMENT`), `reviewerScenarioFamilyPartition.canonicalPartition` (`PARTITION_DISAGREEMENT`)

Partition / crosswalk réel :

- Reviewer A : item local `storm-04-a-item-013`
  - `storm-04-a-knowledge-007` → `equinoxe-q050`
  - `storm-04-a-knowledge-059` → `equinoxe-q099`
  - `storm-04-a-knowledge-067` → `equinoxe-q051`
  - `storm-04-a-knowledge-041` → `equinoxe-q052`
  - `storm-04-a-knowledge-064` → `equinoxe-q091`
- Reviewer B : item local `storm-04-b-item-015`
  - `storm-04-b-knowledge-024` → `equinoxe-q052`
  - `storm-04-b-knowledge-012` → `equinoxe-q099`
  - `storm-04-b-knowledge-039` → `equinoxe-q050`
  - `storm-04-b-knowledge-040` → `equinoxe-q051`
  - `storm-04-b-knowledge-005` → `equinoxe-q091`

### Candidate knowledge

| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente | Scenario family existante |
|---|---|---|---|---|
| `equinoxe-q050` | Comment garantir la confidentialité dans un open space ? | Les salles de réunion et bulles sont prévues pour les échanges nécessitant de la confidentialité. | Groupe scellé : `equinoxe-q050`, `equinoxe-q051`, `equinoxe-q099` ; preferredEntryId : `equinoxe-q050` | non attribuée |
| `equinoxe-q051` | Puis-je passer un entretien RH confidentiel sur site ? | Oui, utilisez une salle de réunion ou une bulle pour ce type d’échange. | Groupe scellé : `equinoxe-q050`, `equinoxe-q051`, `equinoxe-q099` ; preferredEntryId : `equinoxe-q050` | non attribuée |
| `equinoxe-q052` | Les Project Rooms sont-elles insonorisées ? | Les Project Rooms sont conçues pour le travail de projet en petit groupe, avec une bonne isolation sonore. | — | non attribuée |
| `equinoxe-q091` | Les espaces Focus sont-ils fermés ou ouverts ? | Ce sont des postes individuels isolés, pensés pour limiter les distractions sans être totalement cloisonnés. | — | non attribuée |
| `equinoxe-q099` | Puis-je réserver une salle pour un appel client confidentiel ? | Oui, les salles de réunion et bulles conviennent à ce type d’échange. | Groupe scellé : `equinoxe-q050`, `equinoxe-q051`, `equinoxe-q099` ; preferredEntryId : `equinoxe-q050` | non attribuée |

### Existing adjudication context

#### equivalence-comparison-03

- Type : `EQUIVALENCE_AND_PREFERRED`
- q-ids du présent brief directement concernés : `equinoxe-q050`, `equinoxe-q051`, `equinoxe-q099`
- Groupe d’équivalence scellé : `equinoxe-q050`, `equinoxe-q051`, `equinoxe-q099`
- preferredEntryId scellé : `equinoxe-q050`
- Rationale humaine scellée : equinoxe-q050 exprime la règle générale et autonome relative aux échanges confidentiels. Les cas RH et appel client sont des instanciations de cette même règle.

#### boundary-rooms-focus

- Type : `KNOWLEDGE_BOUNDARIES`
- q-ids du présent brief directement concernés : `equinoxe-q050`, `equinoxe-q051`, `equinoxe-q052`, `equinoxe-q091`, `equinoxe-q099`
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
- q-ids du présent brief directement concernés : `equinoxe-q091`
- Classification scellée : `artificialOrMalformed`
- Mécanisme scellé : non applicable
- Rationale humaine scellée : Le terme « libre/ouvert » recouvre ici trois significations portant sur trois objets différents : accès sans réservation à la Bibliothèque, disponibilité instantanée d’une salle, et degré d’ouverture physique d’un espace Focus. La proximité est lexicale, pas métier.
- Règle future scellée : La polysémie d’un mot générique ne constitue pas une ambiguïté structurelle lorsque chaque sens porte sur un objet métier différent et clairement identifiable.

> Ce contexte scellé est restitué sans réinterprétation et ne préremplit pas la décision scenario-family.

### Cadre de décision et portée non résolue

- Statut structurel non résolu : `DECISION_VALUE_DISAGREEMENT`.
- Champs concernés : `fragmentationAssessment.value` (`DECISION_VALUE_DISAGREEMENT`), `reviewerScenarioFamilyPartition.canonicalPartition` (`PARTITION_DISAGREEMENT`).
- Dispositions autorisées : `distinct`, `mergeWithAnotherDisplayedBrief`, `tooBroad`, `artificiallyFragmented`, `insufficientEvidence`.
- Structures de partition autorisées : `reviewerDefinedFamilyGroups`, `insufficientEvidence`.
- Targets de fusion affichés et valides :
  - aucun target de fusion n’est proposé dans les décisions A/B scellées.
- Conséquences structurelles possibles :
  - `distinct` : Le brief reste une unité de scénario autonome, avec la partition interne explicitement retenue.
  - `mergeWithAnotherDisplayedBrief` : Le brief est relié uniquement au ou aux targets explicitement sélectionnés ; la partition retenue demeure explicite.
  - `tooBroad` : Les groupes de la partition retenue deviennent des unités de scénario distinctes.
  - `artificiallyFragmented` : Le brief est marqué comme fragment d’un scénario plus large ; tout regroupement futur doit rester explicitement traçable.
  - `insufficientEvidence` : La structure finale de ce brief reste non résolue et ne peut pas autoriser la génération.

### Human decision

```text
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 5. scenario-family-preflight-30 — Brief de famille 30

### Identification

- Item canonique : `scenario-family-preflight-30`
- Contexte métier réellement disponible : Créer, vérifier ou annuler une réservation

generated user formulation: NOT AVAILABLE

### Reviewer A

- Disposition : `distinct`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q019`, `equinoxe-q022`, `equinoxe-q053`, `equinoxe-q089`, `equinoxe-q090`
- Candidats de fusion : aucun

Rationales Reviewer A :

- Disposition : Gestion opérationnelle d’une réservation : créer, vérifier et annuler.
- Partition : Groupe Reviewer local F04 : [storm-04-a-knowledge-065, storm-04-a-knowledge-025, storm-04-a-knowledge-070, storm-04-a-knowledge-003, storm-04-a-knowledge-039]. Gestion opérationnelle d’une réservation : créer, vérifier et annuler.

### Reviewer B

- Disposition : `tooBroad`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q019`, `equinoxe-q053`
  - Groupe 2 : `equinoxe-q022`
  - Groupe 3 : `equinoxe-q089`
  - Groupe 4 : `equinoxe-q090`
- Candidats de fusion : aucun

Rationales Reviewer B :

- Disposition : Le brief regroupe plusieurs étapes opérationnelles du cycle de réservation qui constituent des situations utilisateur distinctes.
- Partition : Groupes/familles proposés : G1 créer une réservation de salle de réunion = [storm-04-b-knowledge-061, storm-04-b-knowledge-069] ; G2 annuler une réservation = [storm-04-b-knowledge-021] ; G3 vérifier une disponibilité = [storm-04-b-knowledge-043] ; G4 réserver une Project Room = [storm-04-b-knowledge-077].
Rationale courte : Créer, annuler et vérifier sont des actions différentes ; la création dépend aussi du type d’espace.

### Comparaison A/B

- Statut exact : `DECISION_VALUE_DISAGREEMENT`
- Accord de premier niveau : non
- Accord complet : non
- Accords stricts : `fragmentationAssessment.mergeCanonicalReviewItemIds`, `reviewerScenarioFamilyPartition.value`
- Désaccords consignés : `fragmentationAssessment.value` (`DECISION_VALUE_DISAGREEMENT`), `reviewerScenarioFamilyPartition.canonicalPartition` (`PARTITION_DISAGREEMENT`)

Partition / crosswalk réel :

- Reviewer A : item local `storm-04-a-item-005`
  - `storm-04-a-knowledge-065` → `equinoxe-q019`
  - `storm-04-a-knowledge-025` → `equinoxe-q053`
  - `storm-04-a-knowledge-070` → `equinoxe-q090`
  - `storm-04-a-knowledge-003` → `equinoxe-q089`
  - `storm-04-a-knowledge-039` → `equinoxe-q022`
- Reviewer B : item local `storm-04-b-item-033`
  - `storm-04-b-knowledge-061` → `equinoxe-q019`
  - `storm-04-b-knowledge-021` → `equinoxe-q090`
  - `storm-04-b-knowledge-069` → `equinoxe-q053`
  - `storm-04-b-knowledge-043` → `equinoxe-q089`
  - `storm-04-b-knowledge-077` → `equinoxe-q022`

### Candidate knowledge

| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente | Scenario family existante |
|---|---|---|---|---|
| `equinoxe-q019` | Comment je réserve une salle de réunion ? | Via l’outil de réservation habituel, qui reste inchangé pour les salles de réunion. | Groupe scellé : `equinoxe-q019`, `equinoxe-q053` ; preferredEntryId : `equinoxe-q019` | non attribuée |
| `equinoxe-q022` | Peut-on réserver une Project Room à l’avance ? | Oui, les Project Rooms se réservent à la demi-journée ou à la journée. | — | non attribuée |
| `equinoxe-q053` | Comment réserver une salle pour un entretien annuel ? | Via l’outil de réservation habituel des salles de réunion. | Groupe scellé : `equinoxe-q019`, `equinoxe-q053` ; preferredEntryId : `equinoxe-q019` | non attribuée |
| `equinoxe-q089` | Comment savoir si une salle est libre ? | L’outil de réservation habituel indique la disponibilité des salles en temps réel. | — | non attribuée |
| `equinoxe-q090` | Peut-on annuler une réservation de Project Room ? | Oui, les réservations peuvent être annulées via l’outil de réservation. | — | non attribuée |

### Existing adjudication context

#### equivalence-comparison-02

- Type : `EQUIVALENCE_AND_PREFERRED`
- q-ids du présent brief directement concernés : `equinoxe-q019`, `equinoxe-q053`
- Groupe d’équivalence scellé : `equinoxe-q019`, `equinoxe-q053`
- preferredEntryId scellé : `equinoxe-q019`
- Rationale humaine scellée : equinoxe-q019 formule la règle générale de réservation des salles de réunion et précise que l’outil habituel reste inchangé. equinoxe-q053 est un cas particulier appliqué à un entretien annuel.

#### boundary-rooms-focus

- Type : `KNOWLEDGE_BOUNDARIES`
- q-ids du présent brief directement concernés : `equinoxe-q019`, `equinoxe-q022`, `equinoxe-q053`, `equinoxe-q089`, `equinoxe-q090`
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
- q-ids du présent brief directement concernés : `equinoxe-q089`
- Classification scellée : `artificialOrMalformed`
- Mécanisme scellé : non applicable
- Rationale humaine scellée : Le terme « libre/ouvert » recouvre ici trois significations portant sur trois objets différents : accès sans réservation à la Bibliothèque, disponibilité instantanée d’une salle, et degré d’ouverture physique d’un espace Focus. La proximité est lexicale, pas métier.
- Règle future scellée : La polysémie d’un mot générique ne constitue pas une ambiguïté structurelle lorsque chaque sens porte sur un objet métier différent et clairement identifiable.

#### ambiguity-capacity-30

- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- q-ids du présent brief directement concernés : `equinoxe-q019`, `equinoxe-q022`, `equinoxe-q053`, `equinoxe-q089`, `equinoxe-q090`
- Classification scellée : `structuralAmbiguity`
- Mécanisme scellé : `alternativeIntentReadings`
- Groupes scellés :
  - Groupe 1 : `equinoxe-q019`, `equinoxe-q053`
  - Groupe 2 : `equinoxe-q022`
  - Groupe 3 : `equinoxe-q089`
  - Groupe 4 : `equinoxe-q090`
- Rationale humaine scellée : Le domaine réservation comprend plusieurs opérations distinctes : créer, vérifier une disponibilité et annuler. En outre, la création d’une réservation n’obéit pas aux mêmes règles pour une salle de réunion (`q019/q053`) et une Project Room (`q022`). La partition doit donc conserver cette différence métier plutôt que fusionner toutes les créations.
- Règle future scellée : Dans un domaine transactionnel, partitionner d’abord par opération puis, si nécessaire, par type de ressource lorsque les règles opérationnelles diffèrent.

#### scenario-family-preflight-23

- Type : `SCENARIO_FAMILY_PREFLIGHT`
- q-ids du présent brief directement concernés : `equinoxe-q019`, `equinoxe-q022`, `equinoxe-q053`
- Disposition scellée : `distinct`
- Candidats de fusion scellés : aucun
- Structure de partition scellée : `reviewerDefinedFamilyGroups`
- Groupes de scénario scellés :
  - Groupe 1 : `equinoxe-q019`, `equinoxe-q053`
  - Groupe 2 : `equinoxe-q020`
  - Groupe 3 : `equinoxe-q022`
  - Groupe 4 : `equinoxe-q023`
  - Groupe 5 : `equinoxe-q024`
- Rationale humaine scellée : Le besoin général est cohérent : comprendre la règle de réservation lorsque l’espace concerné varie.

Mais la connaissance applicable dépend structurellement du type d’espace :

* `q019`, `q053` : salles de réunion;
* `q020` : Bibliothèque;
* `q022` : Project Room;
* `q023` : bulles;
* `q024` : Forum.

La scenario family reste donc valide, avec le type d’espace comme variable structurante.

Cette partition respecte les frontières déjà scellées dans `boundary-rooms-focus` et les décisions d’ambiguïté relatives aux règles d’usage/réservation des différents espaces.
- Règle future scellée : Une scenario family peut couvrir une même opération appliquée à plusieurs types de ressources, à condition de partitionner explicitement par ressource lorsque celle-ci détermine la règle applicable.

> Ce contexte scellé est restitué sans réinterprétation et ne préremplit pas la décision scenario-family.

### Cadre de décision et portée non résolue

- Statut structurel non résolu : `DECISION_VALUE_DISAGREEMENT`.
- Champs concernés : `fragmentationAssessment.value` (`DECISION_VALUE_DISAGREEMENT`), `reviewerScenarioFamilyPartition.canonicalPartition` (`PARTITION_DISAGREEMENT`).
- Dispositions autorisées : `distinct`, `mergeWithAnotherDisplayedBrief`, `tooBroad`, `artificiallyFragmented`, `insufficientEvidence`.
- Structures de partition autorisées : `reviewerDefinedFamilyGroups`, `insufficientEvidence`.
- Targets de fusion affichés et valides :
  - aucun target de fusion n’est proposé dans les décisions A/B scellées.
- Conséquences structurelles possibles :
  - `distinct` : Le brief reste une unité de scénario autonome, avec la partition interne explicitement retenue.
  - `mergeWithAnotherDisplayedBrief` : Le brief est relié uniquement au ou aux targets explicitement sélectionnés ; la partition retenue demeure explicite.
  - `tooBroad` : Les groupes de la partition retenue deviennent des unités de scénario distinctes.
  - `artificiallyFragmented` : Le brief est marqué comme fragment d’un scénario plus large ; tout regroupement futur doit rester explicitement traçable.
  - `insufficientEvidence` : La structure finale de ce brief reste non résolue et ne peut pas autoriser la génération.

### Human decision

```text
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 6. scenario-family-preflight-31 — Brief de famille 31

### Identification

- Item canonique : `scenario-family-preflight-31`
- Contexte métier réellement disponible : Salle projet générique et espaces nommés Project Room

generated user formulation: NOT AVAILABLE

### Reviewer A

- Disposition : `distinct`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q019`, `equinoxe-q022`, `equinoxe-q028`, `equinoxe-q031`, `equinoxe-q052`, `equinoxe-q053`
- Candidats de fusion : aucun

Rationales Reviewer A :

- Disposition : Salle de réunion générique et Project Room.
- Partition : Groupe Reviewer local F17 : [storm-04-a-knowledge-010, storm-04-a-knowledge-041, storm-04-a-knowledge-039, storm-04-a-knowledge-065, storm-04-a-knowledge-002, storm-04-a-knowledge-025]. Salle de réunion générique et Project Room.

### Reviewer B

- Disposition : `distinct`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q019`, `equinoxe-q028`, `equinoxe-q053`
  - Groupe 2 : `equinoxe-q022`, `equinoxe-q031`, `equinoxe-q052`
- Candidats de fusion : aucun

Rationales Reviewer B :

- Disposition : Le besoin est précisément de distinguer une salle de réunion générique de l’espace nommé Project Room ; aucun autre brief n’a cette même frontière complète.
- Partition : Groupes/familles proposés : G1 salles de réunion génériques = [storm-04-b-knowledge-015, storm-04-b-knowledge-069, storm-04-b-knowledge-061] ; G2 Project Rooms = [storm-04-b-knowledge-077, storm-04-b-knowledge-023, storm-04-b-knowledge-024].
Rationale courte : Les deux types d’espace ont des capacités, propriétés et modalités de réservation propres.

### Comparaison A/B

- Statut exact : `PARTITION_DISAGREEMENT`
- Accord de premier niveau : oui
- Accord complet : non
- Accords stricts : `fragmentationAssessment.value`, `fragmentationAssessment.mergeCanonicalReviewItemIds`, `reviewerScenarioFamilyPartition.value`
- Désaccords consignés : `reviewerScenarioFamilyPartition.canonicalPartition` (`PARTITION_DISAGREEMENT`)

Partition / crosswalk réel :

- Reviewer A : item local `storm-04-a-item-021`
  - `storm-04-a-knowledge-010` → `equinoxe-q031`
  - `storm-04-a-knowledge-041` → `equinoxe-q052`
  - `storm-04-a-knowledge-039` → `equinoxe-q022`
  - `storm-04-a-knowledge-065` → `equinoxe-q019`
  - `storm-04-a-knowledge-002` → `equinoxe-q028`
  - `storm-04-a-knowledge-025` → `equinoxe-q053`
- Reviewer B : item local `storm-04-b-item-023`
  - `storm-04-b-knowledge-077` → `equinoxe-q022`
  - `storm-04-b-knowledge-023` → `equinoxe-q031`
  - `storm-04-b-knowledge-015` → `equinoxe-q028`
  - `storm-04-b-knowledge-069` → `equinoxe-q053`
  - `storm-04-b-knowledge-024` → `equinoxe-q052`
  - `storm-04-b-knowledge-061` → `equinoxe-q019`

### Candidate knowledge

| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente | Scenario family existante |
|---|---|---|---|---|
| `equinoxe-q019` | Comment je réserve une salle de réunion ? | Via l’outil de réservation habituel, qui reste inchangé pour les salles de réunion. | Groupe scellé : `equinoxe-q019`, `equinoxe-q053` ; preferredEntryId : `equinoxe-q019` | non attribuée |
| `equinoxe-q022` | Peut-on réserver une Project Room à l’avance ? | Oui, les Project Rooms se réservent à la demi-journée ou à la journée. | — | non attribuée |
| `equinoxe-q028` | Quelle est la capacité des salles de réunion ? | Les salles de réunion accueillent de 4 à 16 personnes, en présentiel ou hybride. | — | non attribuée |
| `equinoxe-q031` | Combien de personnes dans une Project Room ? | Les Project Rooms accueillent de 6 à 10 personnes. | — | non attribuée |
| `equinoxe-q052` | Les Project Rooms sont-elles insonorisées ? | Les Project Rooms sont conçues pour le travail de projet en petit groupe, avec une bonne isolation sonore. | — | non attribuée |
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
- q-ids du présent brief directement concernés : `equinoxe-q019`, `equinoxe-q022`, `equinoxe-q028`, `equinoxe-q031`, `equinoxe-q052`, `equinoxe-q053`
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

#### ambiguity-capacity-25

- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- q-ids du présent brief directement concernés : `equinoxe-q028`, `equinoxe-q031`
- Classification scellée : `structuralAmbiguity`
- Mécanisme scellé : `alternativeIntentReadings`
- Groupes scellés :
  - Groupe 1 : `equinoxe-q028`
  - Groupe 2 : `equinoxe-q029`
  - Groupe 3 : `equinoxe-q031`
- Rationale humaine scellée : Un groupe de six à dix personnes entre dans la capacité d’une salle de réunion, d’une Project Room et d’un Forum. Ces connaissances ne sont pas concurrentes ou contradictoires : le bon choix dépend de la finalité du groupe — réunion, travail projet ou événement/prise de parole — qui n’est pas exprimée par la seule taille.
- Règle future scellée : Quand plusieurs espaces satisfont une contrainte quantitative, l’ambiguïté porte sur l’usage recherché ; des capacités qui se recouvrent ne constituent pas une contradiction de connaissance.

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

#### scenario-family-preflight-23

- Type : `SCENARIO_FAMILY_PREFLIGHT`
- q-ids du présent brief directement concernés : `equinoxe-q019`, `equinoxe-q022`, `equinoxe-q053`
- Disposition scellée : `distinct`
- Candidats de fusion scellés : aucun
- Structure de partition scellée : `reviewerDefinedFamilyGroups`
- Groupes de scénario scellés :
  - Groupe 1 : `equinoxe-q019`, `equinoxe-q053`
  - Groupe 2 : `equinoxe-q020`
  - Groupe 3 : `equinoxe-q022`
  - Groupe 4 : `equinoxe-q023`
  - Groupe 5 : `equinoxe-q024`
- Rationale humaine scellée : Le besoin général est cohérent : comprendre la règle de réservation lorsque l’espace concerné varie.

Mais la connaissance applicable dépend structurellement du type d’espace :

* `q019`, `q053` : salles de réunion;
* `q020` : Bibliothèque;
* `q022` : Project Room;
* `q023` : bulles;
* `q024` : Forum.

La scenario family reste donc valide, avec le type d’espace comme variable structurante.

Cette partition respecte les frontières déjà scellées dans `boundary-rooms-focus` et les décisions d’ambiguïté relatives aux règles d’usage/réservation des différents espaces.
- Règle future scellée : Une scenario family peut couvrir une même opération appliquée à plusieurs types de ressources, à condition de partitionner explicitement par ressource lorsque celle-ci détermine la règle applicable.

> Ce contexte scellé est restitué sans réinterprétation et ne préremplit pas la décision scenario-family.

### Cadre de décision et portée non résolue

- Statut structurel non résolu : `PARTITION_DISAGREEMENT`.
- Champs concernés : `reviewerScenarioFamilyPartition.canonicalPartition` (`PARTITION_DISAGREEMENT`).
- Dispositions autorisées : `distinct`, `mergeWithAnotherDisplayedBrief`, `tooBroad`, `artificiallyFragmented`, `insufficientEvidence`.
- Structures de partition autorisées : `reviewerDefinedFamilyGroups`, `insufficientEvidence`.
- Targets de fusion affichés et valides :
  - aucun target de fusion n’est proposé dans les décisions A/B scellées.
- Conséquences structurelles possibles :
  - `distinct` : Le brief reste une unité de scénario autonome, avec la partition interne explicitement retenue.
  - `mergeWithAnotherDisplayedBrief` : Le brief est relié uniquement au ou aux targets explicitement sélectionnés ; la partition retenue demeure explicite.
  - `tooBroad` : Les groupes de la partition retenue deviennent des unités de scénario distinctes.
  - `artificiallyFragmented` : Le brief est marqué comme fragment d’un scénario plus large ; tout regroupement futur doit rester explicitement traçable.
  - `insufficientEvidence` : La structure finale de ce brief reste non résolue et ne peut pas autoriser la génération.

### Human decision

```text
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 7. scenario-family-preflight-32 — Brief de famille 32

### Identification

- Item canonique : `scenario-family-preflight-32`
- Contexte métier réellement disponible : Usage d’un espace non précisé

generated user formulation: NOT AVAILABLE

### Reviewer A

- Disposition : `mergeWithAnotherDisplayedBrief`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q025`, `equinoxe-q027`, `equinoxe-q029`, `equinoxe-q052`
- Candidats de fusion : `scenario-family-preflight-27`

Rationales Reviewer A :

- Disposition : Même scénario de choix d’espace selon l’usage que l’item 006.
- Partition : Groupe Reviewer local F05 : [storm-04-a-knowledge-082, storm-04-a-knowledge-004, storm-04-a-knowledge-028, storm-04-a-knowledge-041]. Même scénario de choix d’espace selon l’usage que l’item 006.

### Reviewer B

- Disposition : `tooBroad`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q025`
  - Groupe 2 : `equinoxe-q027`
  - Groupe 3 : `equinoxe-q029`
  - Groupe 4 : `equinoxe-q052`
- Candidats de fusion : aucun

Rationales Reviewer B :

- Disposition : Un brief générique d’« usage d’un espace » agrège plusieurs situations fonctionnelles substantiellement distinctes.
- Partition : Groupes/familles proposés : G1 appel court/bulle = [storm-04-b-knowledge-070] ; G2 Project Room = [storm-04-b-knowledge-024] ; G3 travail calme Bibliothèque/Focus = [storm-04-b-knowledge-047] ; G4 Forum = [storm-04-b-knowledge-068].
Rationale courte : Chaque espace répond à une finalité différente.

### Comparaison A/B

- Statut exact : `DECISION_VALUE_DISAGREEMENT`
- Accord de premier niveau : non
- Accord complet : non
- Accords stricts : `reviewerScenarioFamilyPartition.value`
- Désaccords consignés : `fragmentationAssessment.value` (`DECISION_VALUE_DISAGREEMENT`), `reviewerScenarioFamilyPartition.canonicalPartition` (`PARTITION_DISAGREEMENT`), `fragmentationAssessment.mergeCanonicalReviewItemIds` (`CONDITIONAL_STRUCTURE_DISAGREEMENT`)

Partition / crosswalk réel :

- Reviewer A : item local `storm-04-a-item-029`
  - `storm-04-a-knowledge-082` → `equinoxe-q025`
  - `storm-04-a-knowledge-004` → `equinoxe-q027`
  - `storm-04-a-knowledge-028` → `equinoxe-q029`
  - `storm-04-a-knowledge-041` → `equinoxe-q052`
- Reviewer B : item local `storm-04-b-item-029`
  - `storm-04-b-knowledge-070` → `equinoxe-q027`
  - `storm-04-b-knowledge-024` → `equinoxe-q052`
  - `storm-04-b-knowledge-047` → `equinoxe-q025`
  - `storm-04-b-knowledge-068` → `equinoxe-q029`

### Candidate knowledge

| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente | Scenario family existante |
|---|---|---|---|---|
| `equinoxe-q025` | Où travailler au calme ? | À la Bibliothèque ou dans les espaces Focus. | — | non attribuée |
| `equinoxe-q027` | Où puis-je passer un appel rapide sans déranger personne ? | Utilisez une bulle, pensée pour les appels et visioconférences courtes. | — | non attribuée |
| `equinoxe-q029` | Le Forum, c’est pour quoi ? | Le Forum est un espace pour les événements et prises de parole, jusqu’à 120 personnes. | — | non attribuée |
| `equinoxe-q052` | Les Project Rooms sont-elles insonorisées ? | Les Project Rooms sont conçues pour le travail de projet en petit groupe, avec une bonne isolation sonore. | — | non attribuée |

### Existing adjudication context

#### boundary-rooms-focus

- Type : `KNOWLEDGE_BOUNDARIES`
- q-ids du présent brief directement concernés : `equinoxe-q025`, `equinoxe-q027`, `equinoxe-q029`, `equinoxe-q052`
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

#### ambiguity-capacity-25

- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- q-ids du présent brief directement concernés : `equinoxe-q029`
- Classification scellée : `structuralAmbiguity`
- Mécanisme scellé : `alternativeIntentReadings`
- Groupes scellés :
  - Groupe 1 : `equinoxe-q028`
  - Groupe 2 : `equinoxe-q029`
  - Groupe 3 : `equinoxe-q031`
- Rationale humaine scellée : Un groupe de six à dix personnes entre dans la capacité d’une salle de réunion, d’une Project Room et d’un Forum. Ces connaissances ne sont pas concurrentes ou contradictoires : le bon choix dépend de la finalité du groupe — réunion, travail projet ou événement/prise de parole — qui n’est pas exprimée par la seule taille.
- Règle future scellée : Quand plusieurs espaces satisfont une contrainte quantitative, l’ambiguïté porte sur l’usage recherché ; des capacités qui se recouvrent ne constituent pas une contradiction de connaissance.

> Ce contexte scellé est restitué sans réinterprétation et ne préremplit pas la décision scenario-family.

### Cadre de décision et portée non résolue

- Statut structurel non résolu : `DECISION_VALUE_DISAGREEMENT`.
- Champs concernés : `fragmentationAssessment.value` (`DECISION_VALUE_DISAGREEMENT`), `reviewerScenarioFamilyPartition.canonicalPartition` (`PARTITION_DISAGREEMENT`), `fragmentationAssessment.mergeCanonicalReviewItemIds` (`CONDITIONAL_STRUCTURE_DISAGREEMENT`).
- Dispositions autorisées : `distinct`, `mergeWithAnotherDisplayedBrief`, `tooBroad`, `artificiallyFragmented`, `insufficientEvidence`.
- Structures de partition autorisées : `reviewerDefinedFamilyGroups`, `insufficientEvidence`.
- Targets de fusion affichés et valides :
  - `scenario-family-preflight-27` — statut d’adjudication : `PENDING_HUMAN_REVIEW`.
- Conséquences structurelles possibles :
  - `distinct` : Le brief reste une unité de scénario autonome, avec la partition interne explicitement retenue.
  - `mergeWithAnotherDisplayedBrief` : Le brief est relié uniquement au ou aux targets explicitement sélectionnés ; la partition retenue demeure explicite.
  - `tooBroad` : Les groupes de la partition retenue deviennent des unités de scénario distinctes.
  - `artificiallyFragmented` : Le brief est marqué comme fragment d’un scénario plus large ; tout regroupement futur doit rester explicitement traçable.
  - `insufficientEvidence` : La structure finale de ce brief reste non résolue et ne peut pas autoriser la génération.

### Human decision

```text
decision: PENDING
rationale: PENDING
future_rule: PENDING
```

## 8. scenario-family-preflight-34 — Brief de famille 34

### Identification

- Item canonique : `scenario-family-preflight-34`
- Contexte métier réellement disponible : Capacité du site et capacité d’une salle

generated user formulation: NOT AVAILABLE

### Reviewer A

- Disposition : `distinct`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q028`, `equinoxe-q029`, `equinoxe-q031`, `equinoxe-q076`
- Candidats de fusion : aucun

Rationales Reviewer A :

- Disposition : Capacité lorsque le lieu n’est pas précisé.
- Partition : Groupe Reviewer local F14 : [storm-04-a-knowledge-010, storm-04-a-knowledge-002, storm-04-a-knowledge-028, storm-04-a-knowledge-009]. Capacité lorsque le lieu n’est pas précisé.

### Reviewer B

- Disposition : `mergeWithAnotherDisplayedBrief`
- Structure de partition : `reviewerDefinedFamilyGroups`
- Groupes de scénario :
  - Groupe 1 : `equinoxe-q028`
  - Groupe 2 : `equinoxe-q029`
  - Groupe 3 : `equinoxe-q031`
  - Groupe 4 : `equinoxe-q076`
- Candidats de fusion : `scenario-family-preflight-24`

Rationales Reviewer B :

- Disposition : storm-04-b-item-007 porte déjà le même besoin de capacité lorsque le référent de lieu n’est pas précisé ; fusion recommandée.
- Partition : Groupes/familles proposés : G1 capacité du site = [storm-04-b-knowledge-010] ; G2 salle de réunion = [storm-04-b-knowledge-015] ; G3 Project Room = [storm-04-b-knowledge-023] ; G4 Forum = [storm-04-b-knowledge-068].
Rationale courte : Les valeurs de capacité doivent être rattachées au site ou au type de salle.

### Comparaison A/B

- Statut exact : `DECISION_VALUE_DISAGREEMENT`
- Accord de premier niveau : non
- Accord complet : non
- Accords stricts : `reviewerScenarioFamilyPartition.value`
- Désaccords consignés : `fragmentationAssessment.value` (`DECISION_VALUE_DISAGREEMENT`), `reviewerScenarioFamilyPartition.canonicalPartition` (`PARTITION_DISAGREEMENT`), `fragmentationAssessment.mergeCanonicalReviewItemIds` (`CONDITIONAL_STRUCTURE_DISAGREEMENT`)

Partition / crosswalk réel :

- Reviewer A : item local `storm-04-a-item-016`
  - `storm-04-a-knowledge-010` → `equinoxe-q031`
  - `storm-04-a-knowledge-002` → `equinoxe-q028`
  - `storm-04-a-knowledge-028` → `equinoxe-q029`
  - `storm-04-a-knowledge-009` → `equinoxe-q076`
- Reviewer B : item local `storm-04-b-item-013`
  - `storm-04-b-knowledge-015` → `equinoxe-q028`
  - `storm-04-b-knowledge-010` → `equinoxe-q076`
  - `storm-04-b-knowledge-068` → `equinoxe-q029`
  - `storm-04-b-knowledge-023` → `equinoxe-q031`

### Candidate knowledge

| q-id canonique | Question canonique | Réponse canonique | Équivalence / preferred pertinente | Scenario family existante |
|---|---|---|---|---|
| `equinoxe-q028` | Quelle est la capacité des salles de réunion ? | Les salles de réunion accueillent de 4 à 16 personnes, en présentiel ou hybride. | — | non attribuée |
| `equinoxe-q029` | Le Forum, c’est pour quoi ? | Le Forum est un espace pour les événements et prises de parole, jusqu’à 120 personnes. | — | non attribuée |
| `equinoxe-q031` | Combien de personnes dans une Project Room ? | Les Project Rooms accueillent de 6 à 10 personnes. | — | non attribuée |
| `equinoxe-q076` | Combien de personnes vont travailler à Cobalt ? | Environ 640 collaborateurs sont concernés par le projet. | — | non attribuée |

### Existing adjudication context

#### boundary-rooms-focus

- Type : `KNOWLEDGE_BOUNDARIES`
- q-ids du présent brief directement concernés : `equinoxe-q028`, `equinoxe-q029`, `equinoxe-q031`
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

#### ambiguity-capacity-25

- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- q-ids du présent brief directement concernés : `equinoxe-q028`, `equinoxe-q029`, `equinoxe-q031`
- Classification scellée : `structuralAmbiguity`
- Mécanisme scellé : `alternativeIntentReadings`
- Groupes scellés :
  - Groupe 1 : `equinoxe-q028`
  - Groupe 2 : `equinoxe-q029`
  - Groupe 3 : `equinoxe-q031`
- Rationale humaine scellée : Un groupe de six à dix personnes entre dans la capacité d’une salle de réunion, d’une Project Room et d’un Forum. Ces connaissances ne sont pas concurrentes ou contradictoires : le bon choix dépend de la finalité du groupe — réunion, travail projet ou événement/prise de parole — qui n’est pas exprimée par la seule taille.
- Règle future scellée : Quand plusieurs espaces satisfont une contrainte quantitative, l’ambiguïté porte sur l’usage recherché ; des capacités qui se recouvrent ne constituent pas une contradiction de connaissance.

#### ambiguity-capacity-33

- Type : `AMBIGUITY_CAPACITY_FAMILIES`
- q-ids du présent brief directement concernés : `equinoxe-q076`
- Classification scellée : `artificialOrMalformed`
- Mécanisme scellé : non applicable
- Rationale humaine scellée : Le nombre de niveaux du bâtiment et le nombre de collaborateurs concernés sont deux quantités portant sur des objets métier sans rapport. Leur seule similarité est la structure interrogative de comptage.
- Règle future scellée : Une structure interrogative ou quantitative commune ne suffit jamais à créer une ambiguïté lorsque les objets mesurés sont métierment distincts.

> Ce contexte scellé est restitué sans réinterprétation et ne préremplit pas la décision scenario-family.

### Cadre de décision et portée non résolue

- Statut structurel non résolu : `DECISION_VALUE_DISAGREEMENT`.
- Champs concernés : `fragmentationAssessment.value` (`DECISION_VALUE_DISAGREEMENT`), `reviewerScenarioFamilyPartition.canonicalPartition` (`PARTITION_DISAGREEMENT`), `fragmentationAssessment.mergeCanonicalReviewItemIds` (`CONDITIONAL_STRUCTURE_DISAGREEMENT`).
- Dispositions autorisées : `distinct`, `mergeWithAnotherDisplayedBrief`, `tooBroad`, `artificiallyFragmented`, `insufficientEvidence`.
- Structures de partition autorisées : `reviewerDefinedFamilyGroups`, `insufficientEvidence`.
- Targets de fusion affichés et valides :
  - `scenario-family-preflight-24` — statut d’adjudication : `PENDING_HUMAN_REVIEW`.
- Conséquences structurelles possibles :
  - `distinct` : Le brief reste une unité de scénario autonome, avec la partition interne explicitement retenue.
  - `mergeWithAnotherDisplayedBrief` : Le brief est relié uniquement au ou aux targets explicitement sélectionnés ; la partition retenue demeure explicite.
  - `tooBroad` : Les groupes de la partition retenue deviennent des unités de scénario distinctes.
  - `artificiallyFragmented` : Le brief est marqué comme fragment d’un scénario plus large ; tout regroupement futur doit rester explicitement traçable.
  - `insufficientEvidence` : La structure finale de ce brief reste non résolue et ne peut pas autoriser la génération.

### Human decision

```text
decision: PENDING
rationale: PENDING
future_rule: PENDING
```
