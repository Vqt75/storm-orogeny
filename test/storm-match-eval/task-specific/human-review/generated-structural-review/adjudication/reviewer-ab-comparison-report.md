# Storm Match — concordance/divergence structurelle Reviewer A ↔ Reviewer B

- Statut : `PENDING_HUMAN_REVIEW`
- Autorisation de génération : `false`
- Adjudication effectuée : `false`
- Fingerprint matrice : `2661f9530fc20272043a621cfbf43b836e883522cdc7dfae861e4a58e2db21dd`
- Seal A : `79ea358a594c5b91eee9e5fe453582cb515f11d542571816981b2b2155fde5a8` (182 événements)
- Seal B : `3b24eefdf1b200fc94ebbd83003a796aa3fc1593d55efbbf0a4cf86749438549` (164 événements)

## Méthode

Les items sont reliés exclusivement par le `sourceItemId` du linkage curator-only et les connaissances par leur `entryId`. Les références locales A/B ne sont jamais comparées directement. Les partitions sont des ensembles de groupes : l’ordre des groupes et l’ordre interne sont ignorés. Les rationales sont conservées pour affichage ; seules leurs références locales explicitement structurées servent à reconstruire partitions, sélections préférées et cibles de fusion.

L’accord de premier niveau porte sur `substantiveEquivalencePartition`, `knowledgeComponentBoundary`, `ambiguityFamilyDisposition` et `fragmentationAssessment` selon le paquet. L’accord complet exige l’égalité de toutes les décisions normalisées applicables ; le texte libre des rationales et des règles de frontière n’est pas interprété sémantiquement.

## Synthèse

- Items comparés : **77**
- Accords de premier niveau : **46**
- Accords complets : **23**
- Items nécessitant adjudication : **54**
- Crosswalk non résolus : **0**
- Statuts primaires : `{"DECISION_VALUE_DISAGREEMENT":31,"EXACT_AGREEMENT":23,"MECHANISM_DISAGREEMENT":3,"PARTITION_DISAGREEMENT":15,"PREFERRED_SELECTION_DISAGREEMENT":5}`
- Constats de divergence (non exclusifs) : `{"CONDITIONAL_STRUCTURE_DISAGREEMENT":19,"DECISION_VALUE_DISAGREEMENT":32,"MECHANISM_DISAGREEMENT":3,"PARTITION_DISAGREEMENT":31,"PREFERRED_SELECTION_DISAGREEMENT":5}`

## Détail par paquet

### EQUIVALENCE_AND_PREFERRED

- Items : 5
- Accords de premier niveau : 5
- Accords complets : 0
- À adjudicer : 5
- Crosswalk non résolus : 0
- Statuts primaires : `{"PREFERRED_SELECTION_DISAGREEMENT":5}`

### KNOWLEDGE_BOUNDARIES

- Items : 4
- Accords de premier niveau : 3
- Accords complets : 1
- À adjudicer : 3
- Crosswalk non résolus : 0
- Statuts primaires : `{"DECISION_VALUE_DISAGREEMENT":1,"EXACT_AGREEMENT":1,"PARTITION_DISAGREEMENT":2}`

### AMBIGUITY_CAPACITY_FAMILIES

- Items : 34
- Accords de premier niveau : 21
- Accords complets : 14
- À adjudicer : 20
- Crosswalk non résolus : 0
- Statuts primaires : `{"DECISION_VALUE_DISAGREEMENT":13,"EXACT_AGREEMENT":14,"MECHANISM_DISAGREEMENT":3,"PARTITION_DISAGREEMENT":4}`

### SCENARIO_FAMILY_PREFLIGHT

- Items : 34
- Accords de premier niveau : 17
- Accords complets : 8
- À adjudicer : 26
- Crosswalk non résolus : 0
- Statuts primaires : `{"DECISION_VALUE_DISAGREEMENT":17,"EXACT_AGREEMENT":8,"PARTITION_DISAGREEMENT":9}`

## Items nécessitant adjudication

### equivalence-comparison-01 — PREFERRED_SELECTION_DISAGREEMENT

- Paquet : `EQUIVALENCE_AND_PREFERRED`
- Références : A `storm-01-a-item-003` · B `storm-01-b-item-002`
- Connaissances canoniques : `["equinoxe-q001","equinoxe-q002"]`
- Constats : `[{"field":"preferredEntrySelection","status":"PREFERRED_SELECTION_DISAGREEMENT"}]`
- Décision normalisée A : `{"preferredEntrySelection":{"preferredEntryId":"equinoxe-q002","value":"chooseOneDisplayedKnowledgeRef"},"substantiveEquivalencePartition":{"canonicalPartition":[["equinoxe-q001","equinoxe-q002"]],"value":"oneEquivalentGroup"}}`
- Décision normalisée B : `{"preferredEntrySelection":{"preferredEntryId":null,"value":"insufficientEvidence"},"substantiveEquivalencePartition":{"canonicalPartition":[["equinoxe-q001","equinoxe-q002"]],"value":"oneEquivalentGroup"}}`
- Rationales A :
  - `preferredEntrySelection` : preferredKnowledgeRef=storm-01-a-knowledge-009. La connaissance 009 contextualise explicitement l’événement, le site et la date.
  - `substantiveEquivalencePartition` : Groupe équivalent unique : [storm-01-a-knowledge-009, storm-01-a-knowledge-002]. Même fait métier concernant le déménagement du 18 janvier 2027.
- Rationales B :
  - `preferredEntrySelection` : Groupe(s) confirmé(s) → `knowledgeRef` préféré(s) : G1 [storm-01-b-knowledge-009, storm-01-b-knowledge-003] → aucun knowledgeRef préféré.
Rationale courte : Les deux entrées sont substantiellement interchangeables et aucun critère métier de préférence n’est affiché.
  - `substantiveEquivalencePartition` : Partition explicite des `knowledgeRef` (si nécessaire) : G1 = [storm-01-b-knowledge-009, storm-01-b-knowledge-003]
Rationale courte : Les deux réponses donnent exactement la même date d’emménagement, le 18 janvier 2027.

### equivalence-comparison-02 — PREFERRED_SELECTION_DISAGREEMENT

- Paquet : `EQUIVALENCE_AND_PREFERRED`
- Références : A `storm-01-a-item-005` · B `storm-01-b-item-001`
- Connaissances canoniques : `["equinoxe-q019","equinoxe-q053"]`
- Constats : `[{"field":"preferredEntrySelection","status":"PREFERRED_SELECTION_DISAGREEMENT"}]`
- Décision normalisée A : `{"preferredEntrySelection":{"preferredEntryId":"equinoxe-q019","value":"chooseOneDisplayedKnowledgeRef"},"substantiveEquivalencePartition":{"canonicalPartition":[["equinoxe-q019","equinoxe-q053"]],"value":"oneEquivalentGroup"}}`
- Décision normalisée B : `{"preferredEntrySelection":{"preferredEntryId":null,"value":"insufficientEvidence"},"substantiveEquivalencePartition":{"canonicalPartition":[["equinoxe-q019","equinoxe-q053"]],"value":"oneEquivalentGroup"}}`
- Rationales A :
  - `preferredEntrySelection` : preferredKnowledgeRef=storm-01-a-knowledge-007. La connaissance 007 précise également que l’outil reste inchangé.
  - `substantiveEquivalencePartition` : Groupe équivalent unique : [storm-01-a-knowledge-006, storm-01-a-knowledge-007]. Même procédure de réservation des salles via l’outil habituel.
- Rationales B :
  - `preferredEntrySelection` : Groupe(s) confirmé(s) → `knowledgeRef` préféré(s) : G1 [storm-01-b-knowledge-002, storm-01-b-knowledge-006] → aucun knowledgeRef préféré.
Rationale courte : Aucun critère métier de préférence n’est fourni ; le rang de départage ne doit pas être utilisé automatiquement.
  - `substantiveEquivalencePartition` : Partition explicite des `knowledgeRef` (si nécessaire) : G1 = [storm-01-b-knowledge-002, storm-01-b-knowledge-006]
Rationale courte : Les deux réponses renvoient au même outil habituel de réservation des salles de réunion ; la précision sur l’entretien annuel ne change pas la règle métier.

### equivalence-comparison-03 — PREFERRED_SELECTION_DISAGREEMENT

- Paquet : `EQUIVALENCE_AND_PREFERRED`
- Références : A `storm-01-a-item-004` · B `storm-01-b-item-005`
- Connaissances canoniques : `["equinoxe-q050","equinoxe-q051","equinoxe-q099"]`
- Constats : `[{"field":"preferredEntrySelection","status":"PREFERRED_SELECTION_DISAGREEMENT"}]`
- Décision normalisée A : `{"preferredEntrySelection":{"preferredEntryId":"equinoxe-q050","value":"chooseOneDisplayedKnowledgeRef"},"substantiveEquivalencePartition":{"canonicalPartition":[["equinoxe-q050","equinoxe-q051","equinoxe-q099"]],"value":"oneEquivalentGroup"}}`
- Décision normalisée B : `{"preferredEntrySelection":{"preferredEntryId":null,"value":"insufficientEvidence"},"substantiveEquivalencePartition":{"canonicalPartition":[["equinoxe-q050","equinoxe-q051","equinoxe-q099"]],"value":"oneEquivalentGroup"}}`
- Rationales A :
  - `preferredEntrySelection` : preferredKnowledgeRef=storm-01-a-knowledge-004. La connaissance 004 est la formulation la plus générale et autonome.
  - `substantiveEquivalencePartition` : Groupe équivalent unique : [storm-01-a-knowledge-001, storm-01-a-knowledge-008, storm-01-a-knowledge-004]. Même règle métier : utiliser une salle de réunion ou une bulle pour un échange confidentiel.
- Rationales B :
  - `preferredEntrySelection` : Groupe(s) confirmé(s) → `knowledgeRef` préféré(s) : G1 [storm-01-b-knowledge-010, storm-01-b-knowledge-001, storm-01-b-knowledge-004] → aucun knowledgeRef préféré.
Rationale courte : Les trois entrées sont substantiellement équivalentes et aucun critère métier de préférence n’est affiché.
  - `substantiveEquivalencePartition` : Partition explicite des `knowledgeRef` (si nécessaire) : G1 = [storm-01-b-knowledge-010, storm-01-b-knowledge-001, storm-01-b-knowledge-004]
Rationale courte : Les trois réponses donnent la même règle : utiliser une salle de réunion ou une bulle pour un échange nécessitant de la confidentialité.

### equivalence-comparison-04 — PREFERRED_SELECTION_DISAGREEMENT

- Paquet : `EQUIVALENCE_AND_PREFERRED`
- Références : A `storm-01-a-item-001` · B `storm-01-b-item-004`
- Connaissances canoniques : `["equinoxe-q066","equinoxe-q069"]`
- Constats : `[{"field":"preferredEntrySelection","status":"PREFERRED_SELECTION_DISAGREEMENT"}]`
- Décision normalisée A : `{"preferredEntrySelection":{"preferredEntryId":"equinoxe-q069","value":"chooseOneDisplayedKnowledgeRef"},"substantiveEquivalencePartition":{"canonicalPartition":[["equinoxe-q066","equinoxe-q069"]],"value":"oneEquivalentGroup"}}`
- Décision normalisée B : `{"preferredEntrySelection":{"preferredEntryId":null,"value":"insufficientEvidence"},"substantiveEquivalencePartition":{"canonicalPartition":[["equinoxe-q066","equinoxe-q069"]],"value":"oneEquivalentGroup"}}`
- Rationales A :
  - `preferredEntrySelection` : preferredKnowledgeRef=storm-01-a-knowledge-011. La connaissance 011 formule la règle générale de manière plus explicite et autonome.
  - `substantiveEquivalencePartition` : Groupe équivalent unique : [storm-01-a-knowledge-010, storm-01-a-knowledge-011]. Même point d’entrée métier pour une demande d’adaptation ou d’ergonomie via les circuits RH/santé.
- Rationales B :
  - `preferredEntrySelection` : Groupe(s) confirmé(s) → `knowledgeRef` préféré(s) : G1 [storm-01-b-knowledge-008, storm-01-b-knowledge-005] → aucun knowledgeRef préféré.
Rationale courte : La connaissance affichée ne fournit pas de règle métier permettant de départager ces deux entrées équivalentes.
  - `substantiveEquivalencePartition` : Partition explicite des `knowledgeRef` (si nécessaire) : G1 = [storm-01-b-knowledge-008, storm-01-b-knowledge-005]
Rationale courte : Les deux réponses désignent les circuits RH/santé habituels comme point d’entrée pour une adaptation de poste ou un besoin d’ergonomie.

### equivalence-comparison-05 — PREFERRED_SELECTION_DISAGREEMENT

- Paquet : `EQUIVALENCE_AND_PREFERRED`
- Références : A `storm-01-a-item-002` · B `storm-01-b-item-003`
- Connaissances canoniques : `["equinoxe-q078","equinoxe-q085"]`
- Constats : `[{"field":"preferredEntrySelection","status":"PREFERRED_SELECTION_DISAGREEMENT"}]`
- Décision normalisée A : `{"preferredEntrySelection":{"preferredEntryId":"equinoxe-q078","value":"chooseOneDisplayedKnowledgeRef"},"substantiveEquivalencePartition":{"canonicalPartition":[["equinoxe-q078","equinoxe-q085"]],"value":"oneEquivalentGroup"}}`
- Décision normalisée B : `{"preferredEntrySelection":{"preferredEntryId":null,"value":"insufficientEvidence"},"substantiveEquivalencePartition":{"canonicalPartition":[["equinoxe-q078","equinoxe-q085"]],"value":"oneEquivalentGroup"}}`
- Rationales A :
  - `preferredEntrySelection` : preferredKnowledgeRef=storm-01-a-knowledge-003. La connaissance 003 explicite mieux le projet et la fonction de suivi.
  - `substantiveEquivalencePartition` : Groupe équivalent unique : [storm-01-a-knowledge-005, storm-01-a-knowledge-003]. Même information métier sur le suivi des actualités et jalons du projet dans Storm.
- Rationales B :
  - `preferredEntrySelection` : Groupe(s) confirmé(s) → `knowledgeRef` préféré(s) : G1 [storm-01-b-knowledge-011, storm-01-b-knowledge-007] → aucun knowledgeRef préféré.
Rationale courte : Aucun élément affiché ne justifie de préférer l’une des deux formulations métier.
  - `substantiveEquivalencePartition` : Partition explicite des `knowledgeRef` (si nécessaire) : G1 = [storm-01-b-knowledge-011, storm-01-b-knowledge-007]
Rationale courte : Les deux réponses indiquent que les actualités et jalons du projet sont publiés ou mis à jour régulièrement dans Storm.

### boundary-arrival-preparation — DECISION_VALUE_DISAGREEMENT

- Paquet : `KNOWLEDGE_BOUNDARIES`
- Références : A `storm-02-a-item-001` · B `storm-02-b-item-001`
- Connaissances canoniques : `["equinoxe-q001","equinoxe-q002","equinoxe-q003","equinoxe-q004","equinoxe-q005","equinoxe-q007","equinoxe-q009","equinoxe-q108"]`
- Constats : `[{"field":"knowledgeComponentBoundary.value","status":"DECISION_VALUE_DISAGREEMENT"},{"field":"knowledgeComponentBoundary.canonicalPartition","status":"PARTITION_DISAGREEMENT"}]`
- Décision normalisée A : `{"futureCoverageBoundaryRules":{"text":"Règles futures : ARRIVAL = date, timing ou phasage d’arrivée ; PREPARATION = visites, semaine, guide, accompagnement ou étapes préparatoires ; une formulation vague peut rester ambiguë.","value":"rulesDocumented"},"knowledgeComponentBoundary":{"canonicalPartition":[["equinoxe-q001","equinoxe-q002","equinoxe-q009"],["equinoxe-q003","equinoxe-q004","equinoxe-q005","equinoxe-q007","equinoxe-q108"]],"value":"partitionRequired"}}`
- Décision normalisée B : `{"futureCoverageBoundaryRules":{"text":"Règles de frontière futures documentées : Couvert : faits affichés sur la date d’emménagement, le guide, les visites, la semaine de préparation, les modalités annoncées et la stabilité des jalons. Non couvert : détail logistique absent des connaissances affichées. Réellement ambigu : demande portant sur une date ou une préparation sans permettre d’identifier le jalon concerné parmi emménagement, visites, guide ou semaine de préparation.\nRationale courte : Les `knowledgeRef` storm-02-b-knowledge-004, -007, -009, -014, -021, -034, -038 et -040 couvrent des jalons distincts mais reliés du même calendrier d’arrivée.","value":"rulesDocumented"},"knowledgeComponentBoundary":{"canonicalPartition":[["equinoxe-q001","equinoxe-q002","equinoxe-q003","equinoxe-q004","equinoxe-q005","equinoxe-q007","equinoxe-q009","equinoxe-q108"]],"value":"sameConnectedComponent"}}`
- Règles de frontière A : Règles futures : ARRIVAL = date, timing ou phasage d’arrivée ; PREPARATION = visites, semaine, guide, accompagnement ou étapes préparatoires ; une formulation vague peut rester ambiguë.
- Règles de frontière B : Règles de frontière futures documentées : Couvert : faits affichés sur la date d’emménagement, le guide, les visites, la semaine de préparation, les modalités annoncées et la stabilité des jalons. Non couvert : détail logistique absent des connaissances affichées. Réellement ambigu : demande portant sur une date ou une préparation sans permettre d’identifier le jalon concerné parmi emménagement, visites, guide ou semaine de préparation.
Rationale courte : Les `knowledgeRef` storm-02-b-knowledge-004, -007, -009, -014, -021, -034, -038 et -040 couvrent des jalons distincts mais reliés du même calendrier d’arrivée.
- Rationales A :
  - `futureCoverageBoundaryRules` : Règles futures : ARRIVAL = date, timing ou phasage d’arrivée ; PREPARATION = visites, semaine, guide, accompagnement ou étapes préparatoires ; une formulation vague peut rester ambiguë.
  - `knowledgeComponentBoundary` : Partition : ARRIVAL=[storm-02-a-knowledge-023, storm-02-a-knowledge-040, storm-02-a-knowledge-024]; PREPARATION=[storm-02-a-knowledge-032, storm-02-a-knowledge-018, storm-02-a-knowledge-011, storm-02-a-knowledge-004, storm-02-a-knowledge-027]. Le calendrier relie les connaissances, mais arrivée/déménagement et préparation en amont sont deux besoins métier distincts.
- Rationales B :
  - `futureCoverageBoundaryRules` : Règles de frontière futures documentées : Couvert : faits affichés sur la date d’emménagement, le guide, les visites, la semaine de préparation, les modalités annoncées et la stabilité des jalons. Non couvert : détail logistique absent des connaissances affichées. Réellement ambigu : demande portant sur une date ou une préparation sans permettre d’identifier le jalon concerné parmi emménagement, visites, guide ou semaine de préparation.
Rationale courte : Les `knowledgeRef` storm-02-b-knowledge-004, -007, -009, -014, -021, -034, -038 et -040 couvrent des jalons distincts mais reliés du même calendrier d’arrivée.
  - `knowledgeComponentBoundary` : Les connaissances décrivent un même continuum d’arrivée à Cobalt : date d’emménagement, jalons de préparation, visites, guide et stabilité du calendrier, avec plusieurs réponses explicitement positionnées par rapport à l’emménagement.

### boundary-communication-pilot — PARTITION_DISAGREEMENT

- Paquet : `KNOWLEDGE_BOUNDARIES`
- Références : A `storm-02-a-item-002` · B `storm-02-b-item-004`
- Connaissances canoniques : `["equinoxe-q006","equinoxe-q008","equinoxe-q077","equinoxe-q078","equinoxe-q079","equinoxe-q083","equinoxe-q085","equinoxe-q106","equinoxe-q107","equinoxe-q110","equinoxe-q111","equinoxe-q112"]`
- Constats : `[{"field":"knowledgeComponentBoundary.canonicalPartition","status":"PARTITION_DISAGREEMENT"}]`
- Décision normalisée A : `{"futureCoverageBoundaryRules":{"text":"Règles futures : Distinguer information et questions projet, contacts ambassadeurs, et expérimentation, retours ou évolution.","value":"rulesDocumented"},"knowledgeComponentBoundary":{"canonicalPartition":[["equinoxe-q006","equinoxe-q079","equinoxe-q110","equinoxe-q111","equinoxe-q112"],["equinoxe-q008","equinoxe-q078","equinoxe-q085"],["equinoxe-q077","equinoxe-q083","equinoxe-q106","equinoxe-q107"]],"value":"partitionRequired"}}`
- Décision normalisée B : `{"futureCoverageBoundaryRules":{"text":"Règles de frontière futures documentées : Couvert : réception d’actualités et canal de question, rôle/désignation des ambassadeurs, ou faits affichés sur le plateau témoin, les retours et les ajustements. Non couvert : gouvernance ou procédure détaillée non affichée. Réellement ambigu : interaction avec le projet sans distinguer recherche d’information, rôle d’un ambassadeur ou transmission d’un retour/idée.\nRationale courte : Les connaissances affichent des canaux et acteurs communs, mais des fonctions différentes : informer, relayer, tester et recueillir des retours.","value":"rulesDocumented"},"knowledgeComponentBoundary":{"canonicalPartition":[["equinoxe-q006","equinoxe-q079","equinoxe-q110","equinoxe-q111","equinoxe-q112"],["equinoxe-q008","equinoxe-q078","equinoxe-q083","equinoxe-q085"],["equinoxe-q077","equinoxe-q106","equinoxe-q107"]],"value":"partitionRequired"}}`
- Règles de frontière A : Règles futures : Distinguer information et questions projet, contacts ambassadeurs, et expérimentation, retours ou évolution.
- Règles de frontière B : Règles de frontière futures documentées : Couvert : réception d’actualités et canal de question, rôle/désignation des ambassadeurs, ou faits affichés sur le plateau témoin, les retours et les ajustements. Non couvert : gouvernance ou procédure détaillée non affichée. Réellement ambigu : interaction avec le projet sans distinguer recherche d’information, rôle d’un ambassadeur ou transmission d’un retour/idée.
Rationale courte : Les connaissances affichent des canaux et acteurs communs, mais des fonctions différentes : informer, relayer, tester et recueillir des retours.
- Rationales A :
  - `futureCoverageBoundaryRules` : Règles futures : Distinguer information et questions projet, contacts ambassadeurs, et expérimentation, retours ou évolution.
  - `knowledgeComponentBoundary` : Partition : INFO_QUESTIONS=[storm-02-a-knowledge-003, storm-02-a-knowledge-006, storm-02-a-knowledge-020]; AMBASSADORS_CONTACTS=[storm-02-a-knowledge-012, storm-02-a-knowledge-038, storm-02-a-knowledge-041, storm-02-a-knowledge-050]; EXPERIMENT_FEEDBACK=[storm-02-a-knowledge-021, storm-02-a-knowledge-049, storm-02-a-knowledge-043, storm-02-a-knowledge-048, storm-02-a-knowledge-030]. Trois situations métier : information/questions projet, relais humains, et expérimentation ou amélioration.
- Rationales B :
  - `futureCoverageBoundaryRules` : Règles de frontière futures documentées : Couvert : réception d’actualités et canal de question, rôle/désignation des ambassadeurs, ou faits affichés sur le plateau témoin, les retours et les ajustements. Non couvert : gouvernance ou procédure détaillée non affichée. Réellement ambigu : interaction avec le projet sans distinguer recherche d’information, rôle d’un ambassadeur ou transmission d’un retour/idée.
Rationale courte : Les connaissances affichent des canaux et acteurs communs, mais des fonctions différentes : informer, relayer, tester et recueillir des retours.
  - `knowledgeComponentBoundary` : Trois groupes métier ressortent : information/questions projet = [storm-02-b-knowledge-025, storm-02-b-knowledge-045, storm-02-b-knowledge-036, storm-02-b-knowledge-033] ; rôle et implantation des ambassadeurs = [storm-02-b-knowledge-006, storm-02-b-knowledge-003, storm-02-b-knowledge-037] ; pilote, contribution, feedback et évolution = [storm-02-b-knowledge-044, storm-02-b-knowledge-019, storm-02-b-knowledge-018, storm-02-b-knowledge-017, storm-02-b-knowledge-026].

### boundary-rooms-focus — PARTITION_DISAGREEMENT

- Paquet : `KNOWLEDGE_BOUNDARIES`
- Références : A `storm-02-a-item-003` · B `storm-02-b-item-002`
- Connaissances canoniques : `["equinoxe-q019","equinoxe-q020","equinoxe-q022","equinoxe-q023","equinoxe-q024","equinoxe-q025","equinoxe-q026","equinoxe-q027","equinoxe-q028","equinoxe-q029","equinoxe-q031","equinoxe-q050","equinoxe-q051","equinoxe-q052","equinoxe-q053","equinoxe-q089","equinoxe-q090","equinoxe-q091","equinoxe-q099","equinoxe-q105"]`
- Constats : `[{"field":"knowledgeComponentBoundary.canonicalPartition","status":"PARTITION_DISAGREEMENT"}]`
- Décision normalisée A : `{"futureCoverageBoundaryRules":{"text":"Règles futures : Distinguer meeting rooms, Project Rooms, Forum, bulles et Focus/Library ; la confidentialité reste transverse pour les connaissances 002, 034 et 019.","value":"rulesDocumented"},"knowledgeComponentBoundary":{"canonicalPartition":[["equinoxe-q019","equinoxe-q028","equinoxe-q050","equinoxe-q051","equinoxe-q053","equinoxe-q089","equinoxe-q099"],["equinoxe-q020","equinoxe-q025","equinoxe-q026","equinoxe-q091"],["equinoxe-q022","equinoxe-q031","equinoxe-q052","equinoxe-q090"],["equinoxe-q023","equinoxe-q027"],["equinoxe-q024","equinoxe-q029","equinoxe-q105"]],"value":"partitionRequired"}}`
- Décision normalisée B : `{"futureCoverageBoundaryRules":{"text":"Règles de frontière futures documentées : Couvert : capacité, réservation, disponibilité, confidentialité ou usage d’un espace lorsqu’un type d’espace ou un besoin fonctionnel affiché permet de rattacher la demande au bon groupe. Non couvert : équipement, service ou règle d’usage non présent dans ces connaissances. Réellement ambigu : espace non identifié alors que plusieurs types affichés ont des règles différentes de réservation, d’accès ou d’usage.\nRationale courte : Les connaissances distinguent notamment salles, Project Rooms, Forum et bulles des espaces Focus/Bibliothèque ; certaines sont réservables, d’autres en accès libre ou spontanées.","value":"rulesDocumented"},"knowledgeComponentBoundary":{"canonicalPartition":[["equinoxe-q019","equinoxe-q022","equinoxe-q023","equinoxe-q024","equinoxe-q027","equinoxe-q028","equinoxe-q029","equinoxe-q031","equinoxe-q050","equinoxe-q051","equinoxe-q052","equinoxe-q053","equinoxe-q089","equinoxe-q090","equinoxe-q099","equinoxe-q105"],["equinoxe-q020","equinoxe-q025","equinoxe-q026","equinoxe-q091"]],"value":"partitionRequired"}}`
- Règles de frontière A : Règles futures : Distinguer meeting rooms, Project Rooms, Forum, bulles et Focus/Library ; la confidentialité reste transverse pour les connaissances 002, 034 et 019.
- Règles de frontière B : Règles de frontière futures documentées : Couvert : capacité, réservation, disponibilité, confidentialité ou usage d’un espace lorsqu’un type d’espace ou un besoin fonctionnel affiché permet de rattacher la demande au bon groupe. Non couvert : équipement, service ou règle d’usage non présent dans ces connaissances. Réellement ambigu : espace non identifié alors que plusieurs types affichés ont des règles différentes de réservation, d’accès ou d’usage.
Rationale courte : Les connaissances distinguent notamment salles, Project Rooms, Forum et bulles des espaces Focus/Bibliothèque ; certaines sont réservables, d’autres en accès libre ou spontanées.
- Rationales A :
  - `futureCoverageBoundaryRules` : Règles futures : Distinguer meeting rooms, Project Rooms, Forum, bulles et Focus/Library ; la confidentialité reste transverse pour les connaissances 002, 034 et 019.
  - `knowledgeComponentBoundary` : Partition : MEETING_ROOMS=[storm-02-a-knowledge-026, storm-02-a-knowledge-037, storm-02-a-knowledge-046, storm-02-a-knowledge-042, storm-02-a-knowledge-002, storm-02-a-knowledge-034, storm-02-a-knowledge-019]; PROJECT_ROOMS=[storm-02-a-knowledge-005, storm-02-a-knowledge-047, storm-02-a-knowledge-045, storm-02-a-knowledge-031]; FORUM=[storm-02-a-knowledge-008, storm-02-a-knowledge-015, storm-02-a-knowledge-013]; BUBBLES=[storm-02-a-knowledge-017, storm-02-a-knowledge-036]; FOCUS_LIBRARY=[storm-02-a-knowledge-001, storm-02-a-knowledge-039, storm-02-a-knowledge-009, storm-02-a-knowledge-033]. Les cinq familles d’espaces ont des finalités, capacités et règles de réservation distinctes.
- Rationales B :
  - `futureCoverageBoundaryRules` : Règles de frontière futures documentées : Couvert : capacité, réservation, disponibilité, confidentialité ou usage d’un espace lorsqu’un type d’espace ou un besoin fonctionnel affiché permet de rattacher la demande au bon groupe. Non couvert : équipement, service ou règle d’usage non présent dans ces connaissances. Réellement ambigu : espace non identifié alors que plusieurs types affichés ont des règles différentes de réservation, d’accès ou d’usage.
Rationale courte : Les connaissances distinguent notamment salles, Project Rooms, Forum et bulles des espaces Focus/Bibliothèque ; certaines sont réservables, d’autres en accès libre ou spontanées.
  - `knowledgeComponentBoundary` : Partition métier nécessaire : espaces de collaboration/réservation/confidentialité = [storm-02-b-knowledge-028, storm-02-b-knowledge-016, storm-02-b-knowledge-032, storm-02-b-knowledge-002, storm-02-b-knowledge-027, storm-02-b-knowledge-051, storm-02-b-knowledge-013, storm-02-b-knowledge-010, storm-02-b-knowledge-023, storm-02-b-knowledge-008, storm-02-b-knowledge-049, storm-02-b-knowledge-039, storm-02-b-knowledge-005, storm-02-b-knowledge-042, storm-02-b-knowledge-011, storm-02-b-knowledge-041] ; espaces de travail calme Focus/Bibliothèque = [storm-02-b-knowledge-048, storm-02-b-knowledge-050, storm-02-b-knowledge-020, storm-02-b-knowledge-046]. Les finalités et règles d’accès ne sont pas interchangeables.

### ambiguity-capacity-01 — MECHANISM_DISAGREEMENT

- Paquet : `AMBIGUITY_CAPACITY_FAMILIES`
- Références : A `storm-03-a-item-005` · B `storm-03-b-item-006`
- Connaissances canoniques : `["equinoxe-q010","equinoxe-q012","equinoxe-q014","equinoxe-q015"]`
- Constats : `[{"field":"ambiguityMechanism.value","status":"MECHANISM_DISAGREEMENT"}]`
- Décision normalisée A : `{"ambiguityFamilyDisposition":{"value":"structuralAmbiguity"},"ambiguityMechanism":{"value":"alternativeIntentReadings"},"substantiallyDifferentCoveredGroups":{"canonicalPartition":[["equinoxe-q010","equinoxe-q012","equinoxe-q015"],["equinoxe-q014"]],"value":"reviewerDefinedPartitionOfDisplayedKnowledge"}}`
- Décision normalisée B : `{"ambiguityFamilyDisposition":{"value":"structuralAmbiguity"},"ambiguityMechanism":{"value":"underspecifiedReference"},"substantiallyDifferentCoveredGroups":{"canonicalPartition":[["equinoxe-q010","equinoxe-q012","equinoxe-q015"],["equinoxe-q014"]],"value":"reviewerDefinedPartitionOfDisplayedKnowledge"}}`
- Rationales A :
  - `ambiguityFamilyDisposition` : Stabilité du quartier d’équipe et permanence ou choix quotidien du poste sont distincts.
  - `ambiguityMechanism` : Mécanisme retenu : alternativeIntentReadings. Stabilité du quartier d’équipe et permanence ou choix quotidien du poste sont distincts.
  - `substantiallyDifferentCoveredGroups` : Partition Reviewer : [storm-03-a-knowledge-057] / [storm-03-a-knowledge-075, storm-03-a-knowledge-033, storm-03-a-knowledge-065].
- Rationales B :
  - `ambiguityFamilyDisposition` : Les connaissances distinguent une zone d’équipe stable d’un poste individuel non nominatif et choisi avec flexibilité.
  - `ambiguityMechanism` : Une référence à une place ou une position « stable » est ambiguë si elle ne précise pas quartier d’équipe ou poste individuel.
  - `substantiallyDifferentCoveredGroups` : Partition des groupes de réponses substantiellement différents : G1 stabilité du quartier d’équipe = [storm-03-b-knowledge-076] ; G2 statut et choix du poste individuel au quotidien = [storm-03-b-knowledge-032, storm-03-b-knowledge-073, storm-03-b-knowledge-060].
Rationale courte : Les groupes conduisent à des réponses métier substantiellement différentes.

### ambiguity-capacity-03 — DECISION_VALUE_DISAGREEMENT

- Paquet : `AMBIGUITY_CAPACITY_FAMILIES`
- Références : A `storm-03-a-item-028` · B `storm-03-b-item-010`
- Connaissances canoniques : `["equinoxe-q047","equinoxe-q048"]`
- Constats : `[{"field":"ambiguityFamilyDisposition.value","status":"DECISION_VALUE_DISAGREEMENT"},{"field":"ambiguityFamilyDisposition.conditionalDecisions","status":"CONDITIONAL_STRUCTURE_DISAGREEMENT"}]`
- Décision normalisée A : `{"ambiguityFamilyDisposition":{"value":"structuralAmbiguity"},"ambiguityMechanism":{"value":"alternativeIntentReadings"},"substantiallyDifferentCoveredGroups":{"canonicalPartition":[["equinoxe-q047"],["equinoxe-q048"]],"value":"reviewerDefinedPartitionOfDisplayedKnowledge"}}`
- Décision normalisée B : `{"ambiguityFamilyDisposition":{"value":"artificialOrMalformed"},"ambiguityMechanism":{"value":null},"substantiallyDifferentCoveredGroups":{"canonicalPartition":null,"value":null}}`
- Rationales A :
  - `ambiguityFamilyDisposition` : Branchement physique du poste et connexion wifi sont distincts.
  - `ambiguityMechanism` : Mécanisme retenu : alternativeIntentReadings. Branchement physique du poste et connexion wifi sont distincts.
  - `substantiallyDifferentCoveredGroups` : Partition Reviewer : [storm-03-a-knowledge-079] / [storm-03-a-knowledge-043].
- Rationales B :
  - `ambiguityFamilyDisposition` : Le wifi du bâtiment et l’assistance au branchement physique d’un poste sont deux sujets IT distincts ; leur rapprochement repose sur le mot « connexion » plutôt que sur une ambiguïté métier commune.

### ambiguity-capacity-05 — DECISION_VALUE_DISAGREEMENT

- Paquet : `AMBIGUITY_CAPACITY_FAMILIES`
- Références : A `storm-03-a-item-029` · B `storm-03-b-item-009`
- Connaissances canoniques : `["equinoxe-q038","equinoxe-q100"]`
- Constats : `[{"field":"ambiguityFamilyDisposition.value","status":"DECISION_VALUE_DISAGREEMENT"},{"field":"ambiguityFamilyDisposition.conditionalDecisions","status":"CONDITIONAL_STRUCTURE_DISAGREEMENT"}]`
- Décision normalisée A : `{"ambiguityFamilyDisposition":{"value":"structuralAmbiguity"},"ambiguityMechanism":{"value":"underspecifiedReference"},"substantiallyDifferentCoveredGroups":{"canonicalPartition":[["equinoxe-q038"],["equinoxe-q100"]],"value":"reviewerDefinedPartitionOfDisplayedKnowledge"}}`
- Décision normalisée B : `{"ambiguityFamilyDisposition":{"value":"blockedTemporalInstability"},"ambiguityMechanism":{"value":null},"substantiallyDifferentCoveredGroups":{"canonicalPartition":null,"value":null}}`
- Rationales A :
  - `ambiguityFamilyDisposition` : La recharge électrique peut viser un vélo ou une automobile.
  - `ambiguityMechanism` : Mécanisme retenu : underspecifiedReference. La recharge électrique peut viser un vélo ou une automobile.
  - `substantiallyDifferentCoveredGroups` : Partition Reviewer : [storm-03-a-knowledge-051] / [storm-03-a-knowledge-067].
- Rationales B :
  - `ambiguityFamilyDisposition` : La recharge vélo est explicitement prévue, tandis que les modalités de stationnement et de recharge automobile doivent encore être précisées avant l’emménagement ; la branche automobile n’est pas assez stabilisée pour former deux groupes couverts stables.

### ambiguity-capacity-06 — DECISION_VALUE_DISAGREEMENT

- Paquet : `AMBIGUITY_CAPACITY_FAMILIES`
- Références : A `storm-03-a-item-014` · B `storm-03-b-item-002`
- Connaissances canoniques : `["equinoxe-q035","equinoxe-q036","equinoxe-q037","equinoxe-q073","equinoxe-q094","equinoxe-q095"]`
- Constats : `[{"field":"ambiguityFamilyDisposition.value","status":"DECISION_VALUE_DISAGREEMENT"},{"field":"ambiguityFamilyDisposition.conditionalDecisions","status":"CONDITIONAL_STRUCTURE_DISAGREEMENT"}]`
- Décision normalisée A : `{"ambiguityFamilyDisposition":{"value":"insufficientEvidence"},"ambiguityMechanism":{"value":null},"substantiallyDifferentCoveredGroups":{"canonicalPartition":null,"value":null}}`
- Décision normalisée B : `{"ambiguityFamilyDisposition":{"value":"structuralAmbiguity"},"ambiguityMechanism":{"value":"underspecifiedReference"},"substantiallyDifferentCoveredGroups":{"canonicalPartition":[["equinoxe-q035","equinoxe-q036","equinoxe-q094","equinoxe-q095"],["equinoxe-q037","equinoxe-q073"]],"value":"reviewerDefinedPartitionOfDisplayedKnowledge"}}`
- Rationales A :
  - `ambiguityFamilyDisposition` : Le corpus ne permet pas de distinguer avec assez de certitude les casiers du local vélos des casiers personnels.
- Rationales B :
  - `ambiguityFamilyDisposition` : Le terme de rangement/casier renvoie à deux contextes affichés : effets personnels au poste et équipements à proximité du local vélos.
  - `ambiguityMechanism` : Sans précision sur le contexte du casier ou du rangement, le référent peut être différent.
  - `substantiallyDifferentCoveredGroups` : Partition des groupes de réponses substantiellement différents : G1 casier personnel de travail = [storm-03-b-knowledge-071, storm-03-b-knowledge-022, storm-03-b-knowledge-042, storm-03-b-knowledge-075] ; G2 équipements du local vélos = [storm-03-b-knowledge-037, storm-03-b-knowledge-009].
Rationale courte : Les groupes conduisent à des réponses métier substantiellement différentes.

### ambiguity-capacity-07 — PARTITION_DISAGREEMENT

- Paquet : `AMBIGUITY_CAPACITY_FAMILIES`
- Références : A `storm-03-a-item-031` · B `storm-03-b-item-024`
- Connaissances canoniques : `["equinoxe-q003","equinoxe-q004","equinoxe-q005","equinoxe-q007","equinoxe-q108"]`
- Constats : `[{"field":"substantiallyDifferentCoveredGroups.canonicalPartition","status":"PARTITION_DISAGREEMENT"}]`
- Décision normalisée A : `{"ambiguityFamilyDisposition":{"value":"structuralAmbiguity"},"ambiguityMechanism":{"value":"underspecifiedReference"},"substantiallyDifferentCoveredGroups":{"canonicalPartition":[["equinoxe-q003"],["equinoxe-q004","equinoxe-q005","equinoxe-q007","equinoxe-q108"]],"value":"reviewerDefinedPartitionOfDisplayedKnowledge"}}`
- Décision normalisée B : `{"ambiguityFamilyDisposition":{"value":"structuralAmbiguity"},"ambiguityMechanism":{"value":"underspecifiedReference"},"substantiallyDifferentCoveredGroups":{"canonicalPartition":[["equinoxe-q003"],["equinoxe-q004"],["equinoxe-q005","equinoxe-q108"],["equinoxe-q007"]],"value":"reviewerDefinedPartitionOfDisplayedKnowledge"}}`
- Rationales A :
  - `ambiguityFamilyDisposition` : Jalons concrets de préparation et stabilité générale du calendrier sont distincts.
  - `ambiguityMechanism` : Mécanisme retenu : underspecifiedReference. Jalons concrets de préparation et stabilité générale du calendrier sont distincts.
  - `substantiallyDifferentCoveredGroups` : Partition Reviewer : [storm-03-a-knowledge-063, storm-03-a-knowledge-032, storm-03-a-knowledge-005, storm-03-a-knowledge-074] / [storm-03-a-knowledge-014].
- Rationales B :
  - `ambiguityFamilyDisposition` : Plusieurs jalons de préparation distincts sont affichés, avec des dates ou statuts différents.
  - `ambiguityMechanism` : Une référence à un jalon ou à la préparation sans préciser lequel peut viser le guide, les visites, la semaine de préparation ou la stabilité du calendrier.
  - `substantiallyDifferentCoveredGroups` : Partition des groupes de réponses substantiellement différents : G1 préparation via le guide = [storm-03-b-knowledge-039] ; G2 stabilité/ajustement du calendrier = [storm-03-b-knowledge-079] ; G3 visites et activités préparatoires = [storm-03-b-knowledge-034, storm-03-b-knowledge-063] ; G4 semaine de préparation = [storm-03-b-knowledge-067].
Rationale courte : Les groupes conduisent à des réponses métier substantiellement différentes.

### ambiguity-capacity-10 — DECISION_VALUE_DISAGREEMENT

- Paquet : `AMBIGUITY_CAPACITY_FAMILIES`
- Références : A `storm-03-a-item-023` · B `storm-03-b-item-032`
- Connaissances canoniques : `["equinoxe-q032","equinoxe-q063","equinoxe-q093"]`
- Constats : `[{"field":"ambiguityFamilyDisposition.value","status":"DECISION_VALUE_DISAGREEMENT"},{"field":"ambiguityFamilyDisposition.conditionalDecisions","status":"CONDITIONAL_STRUCTURE_DISAGREEMENT"}]`
- Décision normalisée A : `{"ambiguityFamilyDisposition":{"value":"structuralAmbiguity"},"ambiguityMechanism":{"value":"alternativeIntentReadings"},"substantiallyDifferentCoveredGroups":{"canonicalPartition":[["equinoxe-q032"],["equinoxe-q063"],["equinoxe-q093"]],"value":"reviewerDefinedPartitionOfDisplayedKnowledge"}}`
- Décision normalisée B : `{"ambiguityFamilyDisposition":{"value":"artificialOrMalformed"},"ambiguityMechanism":{"value":null},"substantiallyDifferentCoveredGroups":{"canonicalPartition":null,"value":null}}`
- Rationales A :
  - `ambiguityFamilyDisposition` : Offre ou finalité du Café, convivialité et accès toute la journée sont distincts.
  - `ambiguityMechanism` : Mécanisme retenu : alternativeIntentReadings. Offre ou finalité du Café, convivialité et accès toute la journée sont distincts.
  - `substantiallyDifferentCoveredGroups` : Partition Reviewer : [storm-03-a-knowledge-013] / [storm-03-a-knowledge-018] / [storm-03-a-knowledge-049].
- Rationales B :
  - `ambiguityFamilyDisposition` : Finalité conviviale, disponibilité toute la journée et offre alimentaire du Café sont des attributs distincts du même lieu ; le brief ne montre pas une ambiguïté structurelle entre réponses concurrentes.

### ambiguity-capacity-11 — MECHANISM_DISAGREEMENT

- Paquet : `AMBIGUITY_CAPACITY_FAMILIES`
- Références : A `storm-03-a-item-017` · B `storm-03-b-item-005`
- Connaissances canoniques : `["equinoxe-q032","equinoxe-q064"]`
- Constats : `[{"field":"ambiguityMechanism.value","status":"MECHANISM_DISAGREEMENT"}]`
- Décision normalisée A : `{"ambiguityFamilyDisposition":{"value":"structuralAmbiguity"},"ambiguityMechanism":{"value":"competingPublishedKnowledge"},"substantiallyDifferentCoveredGroups":{"canonicalPartition":[["equinoxe-q032"],["equinoxe-q064"]],"value":"reviewerDefinedPartitionOfDisplayedKnowledge"}}`
- Décision normalisée B : `{"ambiguityFamilyDisposition":{"value":"structuralAmbiguity"},"ambiguityMechanism":{"value":"alternativeIntentReadings"},"substantiallyDifferentCoveredGroups":{"canonicalPartition":[["equinoxe-q032"],["equinoxe-q064"]],"value":"reviewerDefinedPartitionOfDisplayedKnowledge"}}`
- Rationales A :
  - `ambiguityFamilyDisposition` : La terrasse est publiée comme lieu de déjeuner et comme lieu de convivialité ou d’échanges.
  - `ambiguityMechanism` : Mécanisme retenu : competingPublishedKnowledge. La terrasse est publiée comme lieu de déjeuner et comme lieu de convivialité ou d’échanges.
  - `substantiallyDifferentCoveredGroups` : Partition Reviewer : [storm-03-a-knowledge-012] / [storm-03-a-knowledge-018].
- Rationales B :
  - `ambiguityFamilyDisposition` : La Terrasse est couverte pour deux usages métier différents : échanges informels et déjeuner dehors.
  - `ambiguityMechanism` : Une demande sur l’usage de la Terrasse peut viser la convivialité ou la restauration.
  - `substantiallyDifferentCoveredGroups` : Partition des groupes de réponses substantiellement différents : G1 convivialité/échanges informels = [storm-03-b-knowledge-031] ; G2 déjeuner en extérieur = [storm-03-b-knowledge-016].
Rationale courte : Les groupes conduisent à des réponses métier substantiellement différentes.

### ambiguity-capacity-13 — DECISION_VALUE_DISAGREEMENT

- Paquet : `AMBIGUITY_CAPACITY_FAMILIES`
- Références : A `storm-03-a-item-002` · B `storm-03-b-item-016`
- Connaissances canoniques : `["equinoxe-q062","equinoxe-q102","equinoxe-q103"]`
- Constats : `[{"field":"ambiguityFamilyDisposition.value","status":"DECISION_VALUE_DISAGREEMENT"},{"field":"ambiguityFamilyDisposition.conditionalDecisions","status":"CONDITIONAL_STRUCTURE_DISAGREEMENT"}]`
- Décision normalisée A : `{"ambiguityFamilyDisposition":{"value":"structuralAmbiguity"},"ambiguityMechanism":{"value":"alternativeIntentReadings"},"substantiallyDifferentCoveredGroups":{"canonicalPartition":[["equinoxe-q062"],["equinoxe-q102"],["equinoxe-q103"]],"value":"reviewerDefinedPartitionOfDisplayedKnowledge"}}`
- Décision normalisée B : `{"ambiguityFamilyDisposition":{"value":"blockedTemporalInstability"},"ambiguityMechanism":{"value":null},"substantiallyDifferentCoveredGroups":{"canonicalPartition":null,"value":null}}`
- Rationales A :
  - `ambiguityFamilyDisposition` : Menu ou offre générale, option végétarienne et snack ou restauration rapide sont des lectures distinctes.
  - `ambiguityMechanism` : Mécanisme retenu : alternativeIntentReadings. Menu ou offre générale, option végétarienne et snack ou restauration rapide sont des lectures distinctes.
  - `substantiallyDifferentCoveredGroups` : Partition Reviewer : [storm-03-a-knowledge-081] / [storm-03-a-knowledge-004] / [storm-03-a-knowledge-035].
- Rationales B :
  - `ambiguityFamilyDisposition` : Une offre végétarienne est confirmée, mais le détail du menu et l’offre précise de restauration rapide sont explicitement reportés à plus tard ; la portée complète de l’offre n’est pas encore stabilisée.

### ambiguity-capacity-14 — DECISION_VALUE_DISAGREEMENT

- Paquet : `AMBIGUITY_CAPACITY_FAMILIES`
- Références : A `storm-03-a-item-021` · B `storm-03-b-item-008`
- Connaissances canoniques : `["equinoxe-q064","equinoxe-q072","equinoxe-q092"]`
- Constats : `[{"field":"ambiguityFamilyDisposition.value","status":"DECISION_VALUE_DISAGREEMENT"},{"field":"ambiguityFamilyDisposition.conditionalDecisions","status":"CONDITIONAL_STRUCTURE_DISAGREEMENT"}]`
- Décision normalisée A : `{"ambiguityFamilyDisposition":{"value":"artificialOrMalformed"},"ambiguityMechanism":{"value":null},"substantiallyDifferentCoveredGroups":{"canonicalPartition":null,"value":null}}`
- Décision normalisée B : `{"ambiguityFamilyDisposition":{"value":"structuralAmbiguity"},"ambiguityMechanism":{"value":"alternativeIntentReadings"},"substantiallyDifferentCoveredGroups":{"canonicalPartition":[["equinoxe-q064"],["equinoxe-q072"],["equinoxe-q092"]],"value":"reviewerDefinedPartitionOfDisplayedKnowledge"}}`
- Rationales A :
  - `ambiguityFamilyDisposition` : Les connaissances sont complémentaires ; le brief force artificiellement une ambiguïté.
- Rationales B :
  - `ambiguityFamilyDisposition` : Les connaissances couvrent la permission d’usage des postes, le choix général d’un lieu de déjeuner et le cas spécifique de la Terrasse.
  - `ambiguityMechanism` : L’intention peut être une règle d’usage, un choix de lieu ou un déjeuner extérieur.
  - `substantiallyDifferentCoveredGroups` : Partition des groupes de réponses substantiellement différents : G1 permission et lieux adaptés pour manger = [storm-03-b-knowledge-025] ; G2 options générales pour le déjeuner = [storm-03-b-knowledge-003] ; G3 déjeuner dehors sur la Terrasse = [storm-03-b-knowledge-016].
Rationale courte : Les groupes conduisent à des réponses métier substantiellement différentes.

### ambiguity-capacity-16 — PARTITION_DISAGREEMENT

- Paquet : `AMBIGUITY_CAPACITY_FAMILIES`
- Références : A `storm-03-a-item-001` · B `storm-03-b-item-026`
- Connaissances canoniques : `["equinoxe-q040","equinoxe-q042","equinoxe-q043","equinoxe-q044"]`
- Constats : `[{"field":"substantiallyDifferentCoveredGroups.canonicalPartition","status":"PARTITION_DISAGREEMENT"}]`
- Décision normalisée A : `{"ambiguityFamilyDisposition":{"value":"structuralAmbiguity"},"ambiguityMechanism":{"value":"alternativeIntentReadings"},"substantiallyDifferentCoveredGroups":{"canonicalPartition":[["equinoxe-q040","equinoxe-q042"],["equinoxe-q043"],["equinoxe-q044"]],"value":"reviewerDefinedPartitionOfDisplayedKnowledge"}}`
- Décision normalisée B : `{"ambiguityFamilyDisposition":{"value":"structuralAmbiguity"},"ambiguityMechanism":{"value":"alternativeIntentReadings"},"substantiallyDifferentCoveredGroups":{"canonicalPartition":[["equinoxe-q040","equinoxe-q042","equinoxe-q043"],["equinoxe-q044"]],"value":"reviewerDefinedPartitionOfDisplayedKnowledge"}}`
- Rationales A :
  - `ambiguityFamilyDisposition` : Autorité managériale, règles de télétravail et présence minimale sont des lectures distinctes.
  - `ambiguityMechanism` : Mécanisme retenu : alternativeIntentReadings. Autorité managériale, règles de télétravail et présence minimale sont des lectures distinctes.
  - `substantiallyDifferentCoveredGroups` : Partition Reviewer : [storm-03-a-knowledge-036] / [storm-03-a-knowledge-009, storm-03-a-knowledge-021] / [storm-03-a-knowledge-076].
- Rationales B :
  - `ambiguityFamilyDisposition` : Le projet n’impose pas de changement de télétravail ni de présence minimale, tandis que les règles en vigueur dans l’équipe restent applicables.
  - `ambiguityMechanism` : Une contrainte de présence peut être attribuée soit au projet Cobalt, soit aux règles de l’équipe ou du manager.
  - `substantiallyDifferentCoveredGroups` : Partition des groupes de réponses substantiellement différents : G1 règle du projet sur télétravail/présence = [storm-03-b-knowledge-033, storm-03-b-knowledge-062, storm-03-b-knowledge-050] ; G2 autorité ou règles de l’équipe/manager = [storm-03-b-knowledge-035].
Rationale courte : Les groupes conduisent à des réponses métier substantiellement différentes.

### ambiguity-capacity-17 — DECISION_VALUE_DISAGREEMENT

- Paquet : `AMBIGUITY_CAPACITY_FAMILIES`
- Références : A `storm-03-a-item-022` · B `storm-03-b-item-030`
- Connaissances canoniques : `["equinoxe-q006","equinoxe-q079","equinoxe-q110"]`
- Constats : `[{"field":"ambiguityFamilyDisposition.value","status":"DECISION_VALUE_DISAGREEMENT"},{"field":"ambiguityFamilyDisposition.conditionalDecisions","status":"CONDITIONAL_STRUCTURE_DISAGREEMENT"}]`
- Décision normalisée A : `{"ambiguityFamilyDisposition":{"value":"structuralAmbiguity"},"ambiguityMechanism":{"value":"alternativeIntentReadings"},"substantiallyDifferentCoveredGroups":{"canonicalPartition":[["equinoxe-q006"],["equinoxe-q079"],["equinoxe-q110"]],"value":"reviewerDefinedPartitionOfDisplayedKnowledge"}}`
- Décision normalisée B : `{"ambiguityFamilyDisposition":{"value":"artificialOrMalformed"},"ambiguityMechanism":{"value":null},"substantiallyDifferentCoveredGroups":{"canonicalPartition":null,"value":null}}`
- Rationales A :
  - `ambiguityFamilyDisposition` : Date d’ouverture du pilote, rôle expérimental et collecte de retours sont distincts.
  - `ambiguityMechanism` : Mécanisme retenu : alternativeIntentReadings. Date d’ouverture du pilote, rôle expérimental et collecte de retours sont distincts.
  - `substantiallyDifferentCoveredGroups` : Partition Reviewer : [storm-03-a-knowledge-022] / [storm-03-a-knowledge-070] / [storm-03-a-knowledge-058].
- Rationales B :
  - `ambiguityFamilyDisposition` : La date d’ouverture du plateau témoin, sa fonction expérimentale et la collecte de retours sont trois attributs complémentaires du même pilote, sans deux réponses concurrentes à une même lecture.

### ambiguity-capacity-18 — PARTITION_DISAGREEMENT

- Paquet : `AMBIGUITY_CAPACITY_FAMILIES`
- Références : A `storm-03-a-item-008` · B `storm-03-b-item-034`
- Connaissances canoniques : `["equinoxe-q079","equinoxe-q110","equinoxe-q111"]`
- Constats : `[{"field":"substantiallyDifferentCoveredGroups.canonicalPartition","status":"PARTITION_DISAGREEMENT"}]`
- Décision normalisée A : `{"ambiguityFamilyDisposition":{"value":"structuralAmbiguity"},"ambiguityMechanism":{"value":"alternativeIntentReadings"},"substantiallyDifferentCoveredGroups":{"canonicalPartition":[["equinoxe-q079"],["equinoxe-q110"],["equinoxe-q111"]],"value":"reviewerDefinedPartitionOfDisplayedKnowledge"}}`
- Décision normalisée B : `{"ambiguityFamilyDisposition":{"value":"structuralAmbiguity"},"ambiguityMechanism":{"value":"alternativeIntentReadings"},"substantiallyDifferentCoveredGroups":{"canonicalPartition":[["equinoxe-q079","equinoxe-q110"],["equinoxe-q111"]],"value":"reviewerDefinedPartitionOfDisplayedKnowledge"}}`
- Rationales A :
  - `ambiguityFamilyDisposition` : Test du pilote, feedback avant déménagement et évolution ultérieure sont distincts.
  - `ambiguityMechanism` : Mécanisme retenu : alternativeIntentReadings. Test du pilote, feedback avant déménagement et évolution ultérieure sont distincts.
  - `substantiallyDifferentCoveredGroups` : Partition Reviewer : [storm-03-a-knowledge-070] / [storm-03-a-knowledge-058] / [storm-03-a-knowledge-007].
- Rationales B :
  - `ambiguityFamilyDisposition` : Les connaissances couvrent des ajustements à deux moments différents : essais et retours avant le déménagement, puis observation et évolution après l’emménagement.
  - `ambiguityMechanism` : Un besoin concernant la possibilité d’ajuster le projet peut viser la phase pilote avant déménagement ou l’évolution ultérieure.
  - `substantiallyDifferentCoveredGroups` : Partition des groupes de réponses substantiellement différents : G1 expérimentation et feedback avant déménagement = [storm-03-b-knowledge-080, storm-03-b-knowledge-069] ; G2 évolution/ajustements après emménagement = [storm-03-b-knowledge-020].
Rationale courte : Les groupes conduisent à des réponses métier substantiellement différentes.

### ambiguity-capacity-19 — DECISION_VALUE_DISAGREEMENT

- Paquet : `AMBIGUITY_CAPACITY_FAMILIES`
- Références : A `storm-03-a-item-030` · B `storm-03-b-item-020`
- Connaissances canoniques : `["equinoxe-q008","equinoxe-q078","equinoxe-q085"]`
- Constats : `[{"field":"ambiguityFamilyDisposition.value","status":"DECISION_VALUE_DISAGREEMENT"},{"field":"ambiguityFamilyDisposition.conditionalDecisions","status":"CONDITIONAL_STRUCTURE_DISAGREEMENT"}]`
- Décision normalisée A : `{"ambiguityFamilyDisposition":{"value":"structuralAmbiguity"},"ambiguityMechanism":{"value":"alternativeIntentReadings"},"substantiallyDifferentCoveredGroups":{"canonicalPartition":[["equinoxe-q008"],["equinoxe-q078","equinoxe-q085"]],"value":"reviewerDefinedPartitionOfDisplayedKnowledge"}}`
- Décision normalisée B : `{"ambiguityFamilyDisposition":{"value":"artificialOrMalformed"},"ambiguityMechanism":{"value":null},"substantiallyDifferentCoveredGroups":{"canonicalPartition":null,"value":null}}`
- Rationales A :
  - `ambiguityFamilyDisposition` : Poser une question et recevoir ou suivre les actualités projet sont distincts.
  - `ambiguityMechanism` : Mécanisme retenu : alternativeIntentReadings. Poser une question et recevoir ou suivre les actualités projet sont distincts.
  - `substantiallyDifferentCoveredGroups` : Partition Reviewer : [storm-03-a-knowledge-059] / [storm-03-a-knowledge-077, storm-03-a-knowledge-061].
- Rationales B :
  - `ambiguityFamilyDisposition` : Poser une question à tout moment via Storm et recevoir des actualités/jalons dans Storm sont deux flux de communication différents ; les connaissances ne montrent pas de concurrence entre réponses.

### ambiguity-capacity-20 — DECISION_VALUE_DISAGREEMENT

- Paquet : `AMBIGUITY_CAPACITY_FAMILIES`
- Références : A `storm-03-a-item-003` · B `storm-03-b-item-023`
- Connaissances canoniques : `["equinoxe-q077","equinoxe-q106","equinoxe-q107"]`
- Constats : `[{"field":"ambiguityFamilyDisposition.value","status":"DECISION_VALUE_DISAGREEMENT"},{"field":"ambiguityFamilyDisposition.conditionalDecisions","status":"CONDITIONAL_STRUCTURE_DISAGREEMENT"}]`
- Décision normalisée A : `{"ambiguityFamilyDisposition":{"value":"structuralAmbiguity"},"ambiguityMechanism":{"value":"alternativeIntentReadings"},"substantiallyDifferentCoveredGroups":{"canonicalPartition":[["equinoxe-q077"],["equinoxe-q106"],["equinoxe-q107"]],"value":"reviewerDefinedPartitionOfDisplayedKnowledge"}}`
- Décision normalisée B : `{"ambiguityFamilyDisposition":{"value":"artificialOrMalformed"},"ambiguityMechanism":{"value":null},"substantiallyDifferentCoveredGroups":{"canonicalPartition":null,"value":null}}`
- Rationales A :
  - `ambiguityFamilyDisposition` : Rôle des ambassadeurs, mode de désignation et présence dans le service sont des lectures distinctes.
  - `ambiguityMechanism` : Mécanisme retenu : alternativeIntentReadings. Rôle des ambassadeurs, mode de désignation et présence dans le service sont des lectures distinctes.
  - `substantiallyDifferentCoveredGroups` : Partition Reviewer : [storm-03-a-knowledge-042] / [storm-03-a-knowledge-008] / [storm-03-a-knowledge-029].
- Rationales B :
  - `ambiguityFamilyDisposition` : Les trois connaissances décrivent de façon compatible le même dispositif d’ambassadeurs : un relais présent dans chaque service et désigné au sein de celui-ci. Elles sont complémentaires plutôt que substantiellement concurrentes.

### ambiguity-capacity-21 — DECISION_VALUE_DISAGREEMENT

- Paquet : `AMBIGUITY_CAPACITY_FAMILIES`
- Références : A `storm-03-a-item-004` · B `storm-03-b-item-004`
- Connaissances canoniques : `["equinoxe-q083","equinoxe-q112"]`
- Constats : `[{"field":"ambiguityFamilyDisposition.value","status":"DECISION_VALUE_DISAGREEMENT"},{"field":"ambiguityFamilyDisposition.conditionalDecisions","status":"CONDITIONAL_STRUCTURE_DISAGREEMENT"}]`
- Décision normalisée A : `{"ambiguityFamilyDisposition":{"value":"structuralAmbiguity"},"ambiguityMechanism":{"value":"alternativeIntentReadings"},"substantiallyDifferentCoveredGroups":{"canonicalPartition":[["equinoxe-q083"],["equinoxe-q112"]],"value":"reviewerDefinedPartitionOfDisplayedKnowledge"}}`
- Décision normalisée B : `{"ambiguityFamilyDisposition":{"value":"artificialOrMalformed"},"ambiguityMechanism":{"value":null},"substantiallyDifferentCoveredGroups":{"canonicalPartition":null,"value":null}}`
- Rationales A :
  - `ambiguityFamilyDisposition` : Proposer une amélioration et chercher un contact pour poser une question sont des intentions distinctes.
  - `ambiguityMechanism` : Mécanisme retenu : alternativeIntentReadings. Proposer une amélioration et chercher un contact pour poser une question sont des intentions distinctes.
  - `substantiallyDifferentCoveredGroups` : Partition Reviewer : [storm-03-a-knowledge-073] / [storm-03-a-knowledge-037].
- Rationales B :
  - `ambiguityFamilyDisposition` : Les deux connaissances distinguent question et proposition d’amélioration, mais elles renvoient toutes deux aux ambassadeurs ou à l’équipe projet ; elles ne forment pas deux groupes de réponses substantiellement différents.

### ambiguity-capacity-22 — DECISION_VALUE_DISAGREEMENT

- Paquet : `AMBIGUITY_CAPACITY_FAMILIES`
- Références : A `storm-03-a-item-034` · B `storm-03-b-item-018`
- Connaissances canoniques : `["equinoxe-q078","equinoxe-q085","equinoxe-q110","equinoxe-q111","equinoxe-q112"]`
- Constats : `[{"field":"ambiguityFamilyDisposition.value","status":"DECISION_VALUE_DISAGREEMENT"},{"field":"ambiguityFamilyDisposition.conditionalDecisions","status":"CONDITIONAL_STRUCTURE_DISAGREEMENT"}]`
- Décision normalisée A : `{"ambiguityFamilyDisposition":{"value":"structuralAmbiguity"},"ambiguityMechanism":{"value":"alternativeIntentReadings"},"substantiallyDifferentCoveredGroups":{"canonicalPartition":[["equinoxe-q078","equinoxe-q085"],["equinoxe-q110","equinoxe-q111"],["equinoxe-q112"]],"value":"reviewerDefinedPartitionOfDisplayedKnowledge"}}`
- Décision normalisée B : `{"ambiguityFamilyDisposition":{"value":"artificialOrMalformed"},"ambiguityMechanism":{"value":null},"substantiallyDifferentCoveredGroups":{"canonicalPartition":null,"value":null}}`
- Rationales A :
  - `ambiguityFamilyDisposition` : Suivre l’information, donner du feedback ou faire évoluer le projet, et proposer une idée sont distincts.
  - `ambiguityMechanism` : Mécanisme retenu : alternativeIntentReadings. Suivre l’information, donner du feedback ou faire évoluer le projet, et proposer une idée sont distincts.
  - `substantiallyDifferentCoveredGroups` : Partition Reviewer : [storm-03-a-knowledge-077, storm-03-a-knowledge-061] / [storm-03-a-knowledge-058, storm-03-a-knowledge-007] / [storm-03-a-knowledge-073].
- Rationales B :
  - `ambiguityFamilyDisposition` : Actualités, collecte de feedback, évolution du projet et proposition d’idée sont des interactions différentes avec le projet ; le brief les agrège sans référent ou intention unique susceptible de porter l’ambiguïté.

### ambiguity-capacity-25 — MECHANISM_DISAGREEMENT

- Paquet : `AMBIGUITY_CAPACITY_FAMILIES`
- Références : A `storm-03-a-item-007` · B `storm-03-b-item-007`
- Connaissances canoniques : `["equinoxe-q028","equinoxe-q029","equinoxe-q031"]`
- Constats : `[{"field":"ambiguityMechanism.value","status":"MECHANISM_DISAGREEMENT"}]`
- Décision normalisée A : `{"ambiguityFamilyDisposition":{"value":"structuralAmbiguity"},"ambiguityMechanism":{"value":"competingPublishedKnowledge"},"substantiallyDifferentCoveredGroups":{"canonicalPartition":[["equinoxe-q028"],["equinoxe-q029"],["equinoxe-q031"]],"value":"reviewerDefinedPartitionOfDisplayedKnowledge"}}`
- Décision normalisée B : `{"ambiguityFamilyDisposition":{"value":"structuralAmbiguity"},"ambiguityMechanism":{"value":"alternativeIntentReadings"},"substantiallyDifferentCoveredGroups":{"canonicalPartition":[["equinoxe-q028"],["equinoxe-q029"],["equinoxe-q031"]],"value":"reviewerDefinedPartitionOfDisplayedKnowledge"}}`
- Rationales A :
  - `ambiguityFamilyDisposition` : Plusieurs espaces publiés peuvent convenir à un groupe de six à dix personnes avec des fonctions différentes.
  - `ambiguityMechanism` : Mécanisme retenu : competingPublishedKnowledge. Plusieurs espaces publiés peuvent convenir à un groupe de six à dix personnes avec des fonctions différentes.
  - `substantiallyDifferentCoveredGroups` : Partition Reviewer : [storm-03-a-knowledge-023] / [storm-03-a-knowledge-028] / [storm-03-a-knowledge-082].
- Rationales B :
  - `ambiguityFamilyDisposition` : Pour six à dix personnes, plusieurs espaces affichés peuvent être envisagés, mais leur capacité et leur finalité ne sont pas les mêmes.
  - `ambiguityMechanism` : Le choix dépend de l’usage du groupe, non précisé par la seule taille.
  - `substantiallyDifferentCoveredGroups` : Partition des groupes de réponses substantiellement différents : G1 salle de réunion = [storm-03-b-knowledge-049] ; G2 Project Room = [storm-03-b-knowledge-028] ; G3 Forum = [storm-03-b-knowledge-082].
Rationale courte : Les groupes conduisent à des réponses métier substantiellement différentes.

### ambiguity-capacity-29 — DECISION_VALUE_DISAGREEMENT

- Paquet : `AMBIGUITY_CAPACITY_FAMILIES`
- Références : A `storm-03-a-item-012` · B `storm-03-b-item-011`
- Connaissances canoniques : `["equinoxe-q020","equinoxe-q089","equinoxe-q091"]`
- Constats : `[{"field":"ambiguityFamilyDisposition.value","status":"DECISION_VALUE_DISAGREEMENT"},{"field":"ambiguityFamilyDisposition.conditionalDecisions","status":"CONDITIONAL_STRUCTURE_DISAGREEMENT"}]`
- Décision normalisée A : `{"ambiguityFamilyDisposition":{"value":"structuralAmbiguity"},"ambiguityMechanism":{"value":"alternativeIntentReadings"},"substantiallyDifferentCoveredGroups":{"canonicalPartition":[["equinoxe-q020"],["equinoxe-q089"],["equinoxe-q091"]],"value":"reviewerDefinedPartitionOfDisplayedKnowledge"}}`
- Décision normalisée B : `{"ambiguityFamilyDisposition":{"value":"artificialOrMalformed"},"ambiguityMechanism":{"value":null},"substantiallyDifferentCoveredGroups":{"canonicalPartition":null,"value":null}}`
- Rationales A :
  - `ambiguityFamilyDisposition` : Accès libre, ouverture physique et disponibilité instantanée sont distincts.
  - `ambiguityMechanism` : Mécanisme retenu : alternativeIntentReadings. Accès libre, ouverture physique et disponibilité instantanée sont distincts.
  - `substantiallyDifferentCoveredGroups` : Partition Reviewer : [storm-03-a-knowledge-011] / [storm-03-a-knowledge-040] / [storm-03-a-knowledge-044].
- Rationales B :
  - `ambiguityFamilyDisposition` : Disponibilité d’une salle, ouverture physique d’un espace Focus et accès libre à la Bibliothèque sont trois sens différents de « libre/ouvert » sans référent métier commun.

### ambiguity-capacity-30 — PARTITION_DISAGREEMENT

- Paquet : `AMBIGUITY_CAPACITY_FAMILIES`
- Références : A `storm-03-a-item-010` · B `storm-03-b-item-003`
- Connaissances canoniques : `["equinoxe-q019","equinoxe-q022","equinoxe-q053","equinoxe-q089","equinoxe-q090"]`
- Constats : `[{"field":"substantiallyDifferentCoveredGroups.canonicalPartition","status":"PARTITION_DISAGREEMENT"}]`
- Décision normalisée A : `{"ambiguityFamilyDisposition":{"value":"structuralAmbiguity"},"ambiguityMechanism":{"value":"alternativeIntentReadings"},"substantiallyDifferentCoveredGroups":{"canonicalPartition":[["equinoxe-q019","equinoxe-q022","equinoxe-q053"],["equinoxe-q089"],["equinoxe-q090"]],"value":"reviewerDefinedPartitionOfDisplayedKnowledge"}}`
- Décision normalisée B : `{"ambiguityFamilyDisposition":{"value":"structuralAmbiguity"},"ambiguityMechanism":{"value":"alternativeIntentReadings"},"substantiallyDifferentCoveredGroups":{"canonicalPartition":[["equinoxe-q019","equinoxe-q053"],["equinoxe-q022"],["equinoxe-q089"],["equinoxe-q090"]],"value":"reviewerDefinedPartitionOfDisplayedKnowledge"}}`
- Rationales A :
  - `ambiguityFamilyDisposition` : Créer une réservation, vérifier une disponibilité et annuler sont des intentions distinctes.
  - `ambiguityMechanism` : Mécanisme retenu : alternativeIntentReadings. Créer une réservation, vérifier une disponibilité et annuler sont des intentions distinctes.
  - `substantiallyDifferentCoveredGroups` : Partition Reviewer : [storm-03-a-knowledge-031, storm-03-a-knowledge-030, storm-03-a-knowledge-019] / [storm-03-a-knowledge-044] / [storm-03-a-knowledge-066].
- Rationales B :
  - `ambiguityFamilyDisposition` : Le même domaine de réservation couvre des actions différentes et, pour la création, des règles différentes selon le type d’espace.
  - `ambiguityMechanism` : L’intention opérationnelle — vérifier, annuler ou créer — change la réponse à fournir.
  - `substantiallyDifferentCoveredGroups` : Partition des groupes de réponses substantiellement différents : G1 vérifier la disponibilité = [storm-03-b-knowledge-077] ; G2 annuler une réservation = [storm-03-b-knowledge-045] ; G3 réserver une Project Room = [storm-03-b-knowledge-047] ; G4 réserver une salle de réunion = [storm-03-b-knowledge-006, storm-03-b-knowledge-053].
Rationale courte : Les groupes conduisent à des réponses métier substantiellement différentes.

### ambiguity-capacity-33 — DECISION_VALUE_DISAGREEMENT

- Paquet : `AMBIGUITY_CAPACITY_FAMILIES`
- Références : A `storm-03-a-item-032` · B `storm-03-b-item-012`
- Connaissances canoniques : `["equinoxe-q075","equinoxe-q076"]`
- Constats : `[{"field":"ambiguityFamilyDisposition.value","status":"DECISION_VALUE_DISAGREEMENT"},{"field":"ambiguityFamilyDisposition.conditionalDecisions","status":"CONDITIONAL_STRUCTURE_DISAGREEMENT"}]`
- Décision normalisée A : `{"ambiguityFamilyDisposition":{"value":"structuralAmbiguity"},"ambiguityMechanism":{"value":"underspecifiedReference"},"substantiallyDifferentCoveredGroups":{"canonicalPartition":[["equinoxe-q075"],["equinoxe-q076"]],"value":"reviewerDefinedPartitionOfDisplayedKnowledge"}}`
- Décision normalisée B : `{"ambiguityFamilyDisposition":{"value":"artificialOrMalformed"},"ambiguityMechanism":{"value":null},"substantiallyDifferentCoveredGroups":{"canonicalPartition":null,"value":null}}`
- Rationales A :
  - `ambiguityFamilyDisposition` : Le nombre peut viser les collaborateurs ou les niveaux du bâtiment.
  - `ambiguityMechanism` : Mécanisme retenu : underspecifiedReference. Le nombre peut viser les collaborateurs ou les niveaux du bâtiment.
  - `substantiallyDifferentCoveredGroups` : Partition Reviewer : [storm-03-a-knowledge-002] / [storm-03-a-knowledge-068].
- Rationales B :
  - `ambiguityFamilyDisposition` : Le nombre de niveaux du bâtiment et le nombre de collaborateurs sont deux quantités sans même objet métier ; la proximité repose seulement sur une question de comptage.

### scenario-family-preflight-02 — DECISION_VALUE_DISAGREEMENT

- Paquet : `SCENARIO_FAMILY_PREFLIGHT`
- Références : A `storm-04-a-item-004` · B `storm-04-b-item-028`
- Connaissances canoniques : `["equinoxe-q018","equinoxe-q021"]`
- Constats : `[{"field":"fragmentationAssessment.value","status":"DECISION_VALUE_DISAGREEMENT"},{"field":"reviewerScenarioFamilyPartition.canonicalPartition","status":"PARTITION_DISAGREEMENT"}]`
- Décision normalisée A : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"distinct"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q018","equinoxe-q021"]],"value":"reviewerDefinedFamilyGroups"}}`
- Décision normalisée B : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"tooBroad"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q018"],["equinoxe-q021"]],"value":"reviewerDefinedFamilyGroups"}}`
- Rationales A :
  - `fragmentationAssessment` : Organisation de sa venue : réservation du poste et déclaration de présence.
  - `reviewerScenarioFamilyPartition` : Groupe Reviewer local F03 : [storm-04-a-knowledge-057, storm-04-a-knowledge-027]. Organisation de sa venue : réservation du poste et déclaration de présence.
- Rationales B :
  - `fragmentationAssessment` : Le brief réunit deux obligations opérationnelles distinctes qui doivent rester séparées.
  - `reviewerScenarioFamilyPartition` : Groupes/familles proposés : G1 déclaration de présence = [storm-04-b-knowledge-020] ; G2 réservation d’un poste = [storm-04-b-knowledge-033].
Rationale courte : Les deux opérations sont différentes : signaler sa venue et réserver une assise.

### scenario-family-preflight-03 — DECISION_VALUE_DISAGREEMENT

- Paquet : `SCENARIO_FAMILY_PREFLIGHT`
- Références : A `storm-04-a-item-027` · B `storm-04-b-item-012`
- Connaissances canoniques : `["equinoxe-q047","equinoxe-q048"]`
- Constats : `[{"field":"fragmentationAssessment.value","status":"DECISION_VALUE_DISAGREEMENT"},{"field":"reviewerScenarioFamilyPartition.canonicalPartition","status":"PARTITION_DISAGREEMENT"}]`
- Décision normalisée A : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"distinct"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q047","equinoxe-q048"]],"value":"reviewerDefinedFamilyGroups"}}`
- Décision normalisée B : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"tooBroad"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q047"],["equinoxe-q048"]],"value":"reviewerDefinedFamilyGroups"}}`
- Rationales A :
  - `fragmentationAssessment` : Connexion wifi et branchement physique du poste.
  - `reviewerScenarioFamilyPartition` : Groupe Reviewer local F20 : [storm-04-a-knowledge-040, storm-04-a-knowledge-060]. Connexion wifi et branchement physique du poste.
- Rationales B :
  - `fragmentationAssessment` : Le brief rapproche deux situations techniques distinctes qui ne partagent pas la même réponse opérationnelle.
  - `reviewerScenarioFamilyPartition` : Groupes/familles proposés : G1 couverture wifi = [storm-04-b-knowledge-036] ; G2 branchement physique du poste/assistance IT = [storm-04-b-knowledge-035].
Rationale courte : Connexion réseau sans fil et installation physique du poste sont deux besoins IT différents.

### scenario-family-preflight-04 — DECISION_VALUE_DISAGREEMENT

- Paquet : `SCENARIO_FAMILY_PREFLIGHT`
- Références : A `storm-04-a-item-019` · B `storm-04-b-item-018`
- Connaissances canoniques : `["equinoxe-q054","equinoxe-q055","equinoxe-q059","equinoxe-q067","equinoxe-q074","equinoxe-q101"]`
- Constats : `[{"field":"fragmentationAssessment.value","status":"DECISION_VALUE_DISAGREEMENT"},{"field":"reviewerScenarioFamilyPartition.canonicalPartition","status":"PARTITION_DISAGREEMENT"}]`
- Décision normalisée A : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"distinct"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q054","equinoxe-q055","equinoxe-q059","equinoxe-q067","equinoxe-q074","equinoxe-q101"]],"value":"reviewerDefinedFamilyGroups"}}`
- Décision normalisée B : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"tooBroad"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q054","equinoxe-q055","equinoxe-q059","equinoxe-q074","equinoxe-q101"],["equinoxe-q067"]],"value":"reviewerDefinedFamilyGroups"}}`
- Rationales A :
  - `fragmentationAssessment` : Ambiguïté lexicale entre accessibilité PMR et transport ou géographie.
  - `reviewerScenarioFamilyPartition` : Groupe Reviewer local F16 : [storm-04-a-knowledge-037, storm-04-a-knowledge-032, storm-04-a-knowledge-080, storm-04-a-knowledge-073, storm-04-a-knowledge-072, storm-04-a-knowledge-061]. Ambiguïté lexicale entre accessibilité PMR et transport ou géographie.
- Rationales B :
  - `fragmentationAssessment` : Le brief mélange accessibilité des personnes à mobilité réduite et desserte géographique, qui doivent être traitées comme deux situations.
  - `reviewerScenarioFamilyPartition` : Groupes/familles proposés : G1 accessibilité PMR = [storm-04-b-knowledge-013] ; G2 accessibilité géographique/transports = [storm-04-b-knowledge-032, storm-04-b-knowledge-001, storm-04-b-knowledge-009, storm-04-b-knowledge-064, storm-04-b-knowledge-029].
Rationale courte : Les connaissances utilisent deux sens métier distincts de l’accessibilité.

### scenario-family-preflight-05 — PARTITION_DISAGREEMENT

- Paquet : `SCENARIO_FAMILY_PREFLIGHT`
- Références : A `storm-04-a-item-009` · B `storm-04-b-item-004`
- Connaissances canoniques : `["equinoxe-q038","equinoxe-q100"]`
- Constats : `[{"field":"reviewerScenarioFamilyPartition.canonicalPartition","status":"PARTITION_DISAGREEMENT"}]`
- Décision normalisée A : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"distinct"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q038","equinoxe-q100"]],"value":"reviewerDefinedFamilyGroups"}}`
- Décision normalisée B : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"distinct"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q038"],["equinoxe-q100"]],"value":"reviewerDefinedFamilyGroups"}}`
- Rationales A :
  - `fragmentationAssessment` : Recharge électrique selon le type de véhicule.
  - `reviewerScenarioFamilyPartition` : Groupe Reviewer local F07 : [storm-04-a-knowledge-012, storm-04-a-knowledge-049]. Recharge électrique selon le type de véhicule.
- Rationales B :
  - `fragmentationAssessment` : Le besoin commun est la recharge d’un véhicule électrique, avec une partition naturelle par véhicule ; aucun autre brief affiché ne couvre directement cette même distinction.
  - `reviewerScenarioFamilyPartition` : Groupes/familles proposés : G1 recharge automobile = [storm-04-b-knowledge-028] ; G2 recharge vélo électrique = [storm-04-b-knowledge-017].
Rationale courte : Le type de véhicule détermine la connaissance applicable ; l’une est encore à préciser et l’autre confirme des prises au local vélos.

### scenario-family-preflight-06 — DECISION_VALUE_DISAGREEMENT

- Paquet : `SCENARIO_FAMILY_PREFLIGHT`
- Références : A `storm-04-a-item-003` · B `storm-04-b-item-031`
- Connaissances canoniques : `["equinoxe-q035","equinoxe-q036","equinoxe-q037","equinoxe-q073","equinoxe-q094","equinoxe-q095"]`
- Constats : `[{"field":"fragmentationAssessment.value","status":"DECISION_VALUE_DISAGREEMENT"},{"field":"reviewerScenarioFamilyPartition.value","status":"DECISION_VALUE_DISAGREEMENT"},{"field":"reviewerScenarioFamilyPartition.conditionalGroups","status":"CONDITIONAL_STRUCTURE_DISAGREEMENT"}]`
- Décision normalisée A : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"insufficientEvidence"},"reviewerScenarioFamilyPartition":{"canonicalPartition":null,"value":"insufficientEvidence"}}`
- Décision normalisée B : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"tooBroad"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q035","equinoxe-q036","equinoxe-q094","equinoxe-q095"],["equinoxe-q037","equinoxe-q073"]],"value":"reviewerDefinedFamilyGroups"}}`
- Rationales A :
  - `fragmentationAssessment` : Éléments insuffisants pour séparer les casiers personnels du rangement autour du local vélos.
  - `reviewerScenarioFamilyPartition` : Éléments insuffisants pour séparer les casiers personnels du rangement autour du local vélos.
- Rationales B :
  - `fragmentationAssessment` : Le brief mélange rangement individuel au poste et services liés au stationnement vélo.
  - `reviewerScenarioFamilyPartition` : Groupes/familles proposés : G1 casier personnel pour effets de travail = [storm-04-b-knowledge-042, storm-04-b-knowledge-072, storm-04-b-knowledge-026, storm-04-b-knowledge-053] ; G2 équipements associés au local vélos = [storm-04-b-knowledge-056, storm-04-b-knowledge-073].
Rationale courte : Les casiers personnels de flex office et les équipements du local vélos relèvent de deux contextes d’usage différents.

### scenario-family-preflight-07 — PARTITION_DISAGREEMENT

- Paquet : `SCENARIO_FAMILY_PREFLIGHT`
- Références : A `storm-04-a-item-025` · B `storm-04-b-item-017`
- Connaissances canoniques : `["equinoxe-q003","equinoxe-q004","equinoxe-q005","equinoxe-q007","equinoxe-q108"]`
- Constats : `[{"field":"reviewerScenarioFamilyPartition.canonicalPartition","status":"PARTITION_DISAGREEMENT"}]`
- Décision normalisée A : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"tooBroad"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q003"],["equinoxe-q004","equinoxe-q005","equinoxe-q007","equinoxe-q108"]],"value":"reviewerDefinedFamilyGroups"}}`
- Décision normalisée B : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"tooBroad"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q003"],["equinoxe-q004"],["equinoxe-q005","equinoxe-q108"],["equinoxe-q007"]],"value":"reviewerDefinedFamilyGroups"}}`
- Rationales A :
  - `fragmentationAssessment` : Deux branches : jalons concrets de préparation et stabilité générale du calendrier.
  - `reviewerScenarioFamilyPartition` : Partition Reviewer : [storm-04-a-knowledge-075, storm-04-a-knowledge-024, storm-04-a-knowledge-026, storm-04-a-knowledge-076] / [storm-04-a-knowledge-023]. Deux branches : jalons concrets de préparation et stabilité générale du calendrier.
- Rationales B :
  - `fragmentationAssessment` : Guide, visites, semaine de préparation et stabilité du calendrier sont des situations séparables malgré leur appartenance au même calendrier projet.
  - `reviewerScenarioFamilyPartition` : Groupes/familles proposés : G1 guide de préparation = [storm-04-b-knowledge-016] ; G2 visites/activités préparatoires = [storm-04-b-knowledge-066, storm-04-b-knowledge-037] ; G3 semaine de préparation = [storm-04-b-knowledge-018] ; G4 stabilité du calendrier = [storm-04-b-knowledge-046].
Rationale courte : Le brief contient plusieurs jalons ou modalités distincts de la préparation au déménagement.

### scenario-family-preflight-08 — DECISION_VALUE_DISAGREEMENT

- Paquet : `SCENARIO_FAMILY_PREFLIGHT`
- Références : A `storm-04-a-item-031` · B `storm-04-b-item-020`
- Connaissances canoniques : `["equinoxe-q066","equinoxe-q067","equinoxe-q069","equinoxe-q104"]`
- Constats : `[{"field":"fragmentationAssessment.value","status":"DECISION_VALUE_DISAGREEMENT"},{"field":"reviewerScenarioFamilyPartition.canonicalPartition","status":"PARTITION_DISAGREEMENT"}]`
- Décision normalisée A : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"distinct"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q066","equinoxe-q067","equinoxe-q069","equinoxe-q104"]],"value":"reviewerDefinedFamilyGroups"}}`
- Décision normalisée B : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"tooBroad"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q066","equinoxe-q069","equinoxe-q104"],["equinoxe-q067"]],"value":"reviewerDefinedFamilyGroups"}}`
- Rationales A :
  - `fragmentationAssessment` : Adaptation individuelle du poste, accessibilité et canal RH/santé.
  - `reviewerScenarioFamilyPartition` : Groupe Reviewer local F22 : [storm-04-a-knowledge-006, storm-04-a-knowledge-072, storm-04-a-knowledge-045, storm-04-a-knowledge-052]. Adaptation individuelle du poste, accessibilité et canal RH/santé.
- Rationales B :
  - `fragmentationAssessment` : Le brief confond le processus de demande d’adaptation avec une propriété générale d’accessibilité du site.
  - `reviewerScenarioFamilyPartition` : Groupes/familles proposés : G1 adaptation individuelle du poste/ergonomie = [storm-04-b-knowledge-063, storm-04-b-knowledge-079, storm-04-b-knowledge-049] ; G2 accessibilité générale PMR du site = [storm-04-b-knowledge-013].
Rationale courte : Une démarche d’aménagement individuel et l’accessibilité générale du bâtiment relèvent de situations différentes.

### scenario-family-preflight-09 — PARTITION_DISAGREEMENT

- Paquet : `SCENARIO_FAMILY_PREFLIGHT`
- Références : A `storm-04-a-item-008` · B `storm-04-b-item-011`
- Connaissances canoniques : `["equinoxe-q061","equinoxe-q064"]`
- Constats : `[{"field":"reviewerScenarioFamilyPartition.canonicalPartition","status":"PARTITION_DISAGREEMENT"}]`
- Décision normalisée A : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"distinct"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q061","equinoxe-q064"]],"value":"reviewerDefinedFamilyGroups"}}`
- Décision normalisée B : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"distinct"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q061"],["equinoxe-q064"]],"value":"reviewerDefinedFamilyGroups"}}`
- Rationales A :
  - `fragmentationAssessment` : Capacité des espaces de restauration.
  - `reviewerScenarioFamilyPartition` : Groupe Reviewer local F06 : [storm-04-a-knowledge-043, storm-04-a-knowledge-015]. Capacité des espaces de restauration.
- Rationales B :
  - `fragmentationAssessment` : La comparaison des capacités des deux lieux de restauration constitue un besoin identifié et ne duplique pas exactement un autre brief.
  - `reviewerScenarioFamilyPartition` : Groupes/familles proposés : G1 capacité de la Terrasse = [storm-04-b-knowledge-004] ; G2 capacité du Restaurant = [storm-04-b-knowledge-044].
Rationale courte : Les capacités portent sur deux lieux de restauration différents.

### scenario-family-preflight-10 — DECISION_VALUE_DISAGREEMENT

- Paquet : `SCENARIO_FAMILY_PREFLIGHT`
- Références : A `storm-04-a-item-010` · B `storm-04-b-item-009`
- Connaissances canoniques : `["equinoxe-q032","equinoxe-q063","equinoxe-q093"]`
- Constats : `[{"field":"fragmentationAssessment.value","status":"DECISION_VALUE_DISAGREEMENT"},{"field":"reviewerScenarioFamilyPartition.canonicalPartition","status":"PARTITION_DISAGREEMENT"}]`
- Décision normalisée A : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"distinct"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q032","equinoxe-q063","equinoxe-q093"]],"value":"reviewerDefinedFamilyGroups"}}`
- Décision normalisée B : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"tooBroad"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q032"],["equinoxe-q063"],["equinoxe-q093"]],"value":"reviewerDefinedFamilyGroups"}}`
- Rationales A :
  - `fragmentationAssessment` : Café central : finalité, offre et horaires ou accès.
  - `reviewerScenarioFamilyPartition` : Groupe Reviewer local F08 : [storm-04-a-knowledge-078, storm-04-a-knowledge-062, storm-04-a-knowledge-063]. Café central : finalité, offre et horaires ou accès.
- Rationales B :
  - `fragmentationAssessment` : Le brief rassemble plusieurs situations distinctes autour du même lieu sans besoin métier unique.
  - `reviewerScenarioFamilyPartition` : Groupes/familles proposés : G1 accès temporel au Café = [storm-04-b-knowledge-041] ; G2 finalité conviviale = [storm-04-b-knowledge-038] ; G3 offre alimentaire = [storm-04-b-knowledge-059].
Rationale courte : Les connaissances répondent à trois attributs différents du Café : horaires d’accès, usage convivial et possibilité de restauration.

### scenario-family-preflight-13 — DECISION_VALUE_DISAGREEMENT

- Paquet : `SCENARIO_FAMILY_PREFLIGHT`
- Références : A `storm-04-a-item-014` · B `storm-04-b-item-001`
- Connaissances canoniques : `["equinoxe-q062","equinoxe-q102","equinoxe-q103"]`
- Constats : `[{"field":"fragmentationAssessment.value","status":"DECISION_VALUE_DISAGREEMENT"},{"field":"reviewerScenarioFamilyPartition.canonicalPartition","status":"PARTITION_DISAGREEMENT"}]`
- Décision normalisée A : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"distinct"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q062","equinoxe-q102","equinoxe-q103"]],"value":"reviewerDefinedFamilyGroups"}}`
- Décision normalisée B : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"tooBroad"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q062","equinoxe-q103"],["equinoxe-q102"]],"value":"reviewerDefinedFamilyGroups"}}`
- Rationales A :
  - `fragmentationAssessment` : Contenu de l’offre alimentaire.
  - `reviewerScenarioFamilyPartition` : Groupe Reviewer local F12 : [storm-04-a-knowledge-034, storm-04-a-knowledge-069, storm-04-a-knowledge-074]. Contenu de l’offre alimentaire.
- Rationales B :
  - `fragmentationAssessment` : Le brief réunit deux situations de restauration différentes : composition du menu du Restaurant et disponibilité d’une offre rapide/snack.
  - `reviewerScenarioFamilyPartition` : Groupes/familles proposés : G1 menu/offre du Restaurant = [storm-04-b-knowledge-006, storm-04-b-knowledge-065] ; G2 restauration rapide/snack = [storm-04-b-knowledge-011].
Rationale courte : Les connaissances distinguent le contenu de l’offre du Restaurant et l’offre de snack/restauration rapide.

### scenario-family-preflight-14 — PARTITION_DISAGREEMENT

- Paquet : `SCENARIO_FAMILY_PREFLIGHT`
- Références : A `storm-04-a-item-001` · B `storm-04-b-item-024`
- Connaissances canoniques : `["equinoxe-q064","equinoxe-q072","equinoxe-q092"]`
- Constats : `[{"field":"reviewerScenarioFamilyPartition.canonicalPartition","status":"PARTITION_DISAGREEMENT"}]`
- Décision normalisée A : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"distinct"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q064","equinoxe-q072","equinoxe-q092"]],"value":"reviewerDefinedFamilyGroups"}}`
- Décision normalisée B : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"distinct"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q064"],["equinoxe-q072","equinoxe-q092"]],"value":"reviewerDefinedFamilyGroups"}}`
- Rationales A :
  - `fragmentationAssessment` : Lieux de restauration et permission de manger à son poste.
  - `reviewerScenarioFamilyPartition` : Groupe Reviewer local F01 : [storm-04-a-knowledge-054, storm-04-a-knowledge-019, storm-04-a-knowledge-015]. Lieux de restauration et permission de manger à son poste.
- Rationales B :
  - `fragmentationAssessment` : Le brief reste centré sur la situation de restauration sur site et ne duplique pas entièrement le brief consacré aux usages plus larges de la Terrasse.
  - `reviewerScenarioFamilyPartition` : Groupes/familles proposés : G1 règle et lieux adaptés pour manger = [storm-04-b-knowledge-067, storm-04-b-knowledge-030] ; G2 déjeuner en extérieur sur la Terrasse = [storm-04-b-knowledge-004].
Rationale courte : Les connaissances couvrent où manger et le cas spécifique du déjeuner dehors, dans un même besoin de choix de lieu de restauration.

### scenario-family-preflight-16 — DECISION_VALUE_DISAGREEMENT

- Paquet : `SCENARIO_FAMILY_PREFLIGHT`
- Références : A `storm-04-a-item-020` · B `storm-04-b-item-027`
- Connaissances canoniques : `["equinoxe-q040","equinoxe-q042","equinoxe-q043","equinoxe-q044"]`
- Constats : `[{"field":"fragmentationAssessment.value","status":"DECISION_VALUE_DISAGREEMENT"},{"field":"reviewerScenarioFamilyPartition.canonicalPartition","status":"PARTITION_DISAGREEMENT"},{"field":"fragmentationAssessment.mergeCanonicalReviewItemIds","status":"CONDITIONAL_STRUCTURE_DISAGREEMENT"}]`
- Décision normalisée A : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"distinct"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q040","equinoxe-q042","equinoxe-q043","equinoxe-q044"]],"value":"reviewerDefinedFamilyGroups"}}`
- Décision normalisée B : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":["scenario-family-preflight-15"],"value":"mergeWithAnotherDisplayedBrief"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q040","equinoxe-q042","equinoxe-q043"],["equinoxe-q044"]],"value":"reviewerDefinedFamilyGroups"}}`
- Rationales A :
  - `fragmentationAssessment` : Règles de télétravail, présence minimale et autorité managériale.
  - `reviewerScenarioFamilyPartition` : Groupe Reviewer local F15 : [storm-04-a-knowledge-013, storm-04-a-knowledge-068, storm-04-a-knowledge-001, storm-04-a-knowledge-050]. Règles de télétravail, présence minimale et autorité managériale.
- Rationales B :
  - `fragmentationAssessment` : storm-04-b-item-030 couvre le même besoin de politique de présence et de fréquence sur site ; le présent brief ajoute l’angle manager mais reste dans la même famille.
  - `reviewerScenarioFamilyPartition` : Groupes/familles proposés : G1 règle du projet sur télétravail/présence = [storm-04-b-knowledge-027, storm-04-b-knowledge-008, storm-04-b-knowledge-022] ; G2 règle d’équipe/autorité du manager = [storm-04-b-knowledge-071].
Rationale courte : Les connaissances distinguent ce que Cobalt change ou non de ce qui relève des règles en vigueur dans l’équipe.

### scenario-family-preflight-17 — DECISION_VALUE_DISAGREEMENT

- Paquet : `SCENARIO_FAMILY_PREFLIGHT`
- Références : A `storm-04-a-item-002` · B `storm-04-b-item-032`
- Connaissances canoniques : `["equinoxe-q006","equinoxe-q079","equinoxe-q110"]`
- Constats : `[{"field":"fragmentationAssessment.value","status":"DECISION_VALUE_DISAGREEMENT"},{"field":"reviewerScenarioFamilyPartition.canonicalPartition","status":"PARTITION_DISAGREEMENT"},{"field":"fragmentationAssessment.mergeCanonicalReviewItemIds","status":"CONDITIONAL_STRUCTURE_DISAGREEMENT"}]`
- Décision normalisée A : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"distinct"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q006","equinoxe-q079","equinoxe-q110"]],"value":"reviewerDefinedFamilyGroups"}}`
- Décision normalisée B : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":["scenario-family-preflight-18"],"value":"mergeWithAnotherDisplayedBrief"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q006"],["equinoxe-q079"],["equinoxe-q110"]],"value":"reviewerDefinedFamilyGroups"}}`
- Rationales A :
  - `fragmentationAssessment` : Pilote : ouverture, rôle expérimental et collecte de retours.
  - `reviewerScenarioFamilyPartition` : Groupe Reviewer local F02 : [storm-04-a-knowledge-048, storm-04-a-knowledge-011, storm-04-a-knowledge-051]. Pilote : ouverture, rôle expérimental et collecte de retours.
- Rationales B :
  - `fragmentationAssessment` : storm-04-b-item-021 couvre déjà le rôle expérimental et les retours du plateau témoin, dans le même cycle d’essai et d’ajustement.
  - `reviewerScenarioFamilyPartition` : Groupes/familles proposés : G1 ouverture du plateau témoin = [storm-04-b-knowledge-081] ; G2 rôle expérimental = [storm-04-b-knowledge-019] ; G3 collecte de retours = [storm-04-b-knowledge-054].
Rationale courte : Les trois connaissances décrivent le même dispositif pilote sous ses dimensions de calendrier, finalité et feedback.

### scenario-family-preflight-18 — PARTITION_DISAGREEMENT

- Paquet : `SCENARIO_FAMILY_PREFLIGHT`
- Références : A `storm-04-a-item-007` · B `storm-04-b-item-021`
- Connaissances canoniques : `["equinoxe-q079","equinoxe-q110","equinoxe-q111"]`
- Constats : `[{"field":"reviewerScenarioFamilyPartition.canonicalPartition","status":"PARTITION_DISAGREEMENT"}]`
- Décision normalisée A : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":["scenario-family-preflight-17"],"value":"mergeWithAnotherDisplayedBrief"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q079","equinoxe-q110","equinoxe-q111"]],"value":"reviewerDefinedFamilyGroups"}}`
- Décision normalisée B : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":["scenario-family-preflight-17"],"value":"mergeWithAnotherDisplayedBrief"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q079"],["equinoxe-q110"],["equinoxe-q111"]],"value":"reviewerDefinedFamilyGroups"}}`
- Rationales A :
  - `fragmentationAssessment` : Même scénario pilote que l’item 002 : test, feedback et ajustement.
  - `reviewerScenarioFamilyPartition` : Groupe Reviewer local F02 : [storm-04-a-knowledge-020, storm-04-a-knowledge-051, storm-04-a-knowledge-048]. Même scénario pilote que l’item 002 : test, feedback et ajustement.
- Rationales B :
  - `fragmentationAssessment` : storm-04-b-item-032 couvre le même pilote avec son rôle expérimental et la collecte de retours ; les deux briefs décrivent le même besoin de compréhension du cycle du plateau témoin.
  - `reviewerScenarioFamilyPartition` : Groupes/familles proposés : G1 expérimentation du plateau témoin = [storm-04-b-knowledge-019] ; G2 collecte de feedback avant déménagement = [storm-04-b-knowledge-054] ; G3 évolution après emménagement = [storm-04-b-knowledge-055].
Rationale courte : Les connaissances décrivent le cycle d’essai, de retour et d’ajustement du projet.

### scenario-family-preflight-19 — DECISION_VALUE_DISAGREEMENT

- Paquet : `SCENARIO_FAMILY_PREFLIGHT`
- Références : A `storm-04-a-item-011` · B `storm-04-b-item-005`
- Connaissances canoniques : `["equinoxe-q008","equinoxe-q078","equinoxe-q085"]`
- Constats : `[{"field":"fragmentationAssessment.value","status":"DECISION_VALUE_DISAGREEMENT"},{"field":"reviewerScenarioFamilyPartition.canonicalPartition","status":"PARTITION_DISAGREEMENT"}]`
- Décision normalisée A : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"distinct"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q008","equinoxe-q078","equinoxe-q085"]],"value":"reviewerDefinedFamilyGroups"}}`
- Décision normalisée B : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"tooBroad"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q008"],["equinoxe-q078","equinoxe-q085"]],"value":"reviewerDefinedFamilyGroups"}}`
- Rationales A :
  - `fragmentationAssessment` : Poser une question et suivre l’information ou les actualités projet.
  - `reviewerScenarioFamilyPartition` : Groupe Reviewer local F09 : [storm-04-a-knowledge-035, storm-04-a-knowledge-066, storm-04-a-knowledge-056]. Poser une question et suivre l’information ou les actualités projet.
- Rationales B :
  - `fragmentationAssessment` : Le brief combine une situation de demande d’information et une situation de suivi d’actualités.
  - `reviewerScenarioFamilyPartition` : Groupes/familles proposés : G1 canal pour poser des questions = [storm-04-b-knowledge-045] ; G2 réception d’actualités/jalons = [storm-04-b-knowledge-080, storm-04-b-knowledge-062].
Rationale courte : Le flux de question vers le projet et le flux d’information depuis le projet sont distincts.

### scenario-family-preflight-21 — DECISION_VALUE_DISAGREEMENT

- Paquet : `SCENARIO_FAMILY_PREFLIGHT`
- Références : A `storm-04-a-item-017` · B `storm-04-b-item-019`
- Connaissances canoniques : `["equinoxe-q083","equinoxe-q112"]`
- Constats : `[{"field":"fragmentationAssessment.value","status":"DECISION_VALUE_DISAGREEMENT"},{"field":"reviewerScenarioFamilyPartition.canonicalPartition","status":"PARTITION_DISAGREEMENT"}]`
- Décision normalisée A : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"tooBroad"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q083"],["equinoxe-q112"]],"value":"reviewerDefinedFamilyGroups"}}`
- Décision normalisée B : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"distinct"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q083","equinoxe-q112"]],"value":"reviewerDefinedFamilyGroups"}}`
- Rationales A :
  - `fragmentationAssessment` : Deux branches : question ou contact rattachable à F09, et contribution distincte.
  - `reviewerScenarioFamilyPartition` : Partition Reviewer : [storm-04-a-knowledge-081] / [storm-04-a-knowledge-036]. Deux branches : question ou contact rattachable à F09, et contribution distincte.
- Rationales B :
  - `fragmentationAssessment` : Question et proposition partagent ici le même canal opérationnel et forment une famille cohérente de contact direct.
  - `reviewerScenarioFamilyPartition` : Groupes/familles proposés : G1 contact pour question ou proposition au projet = [storm-04-b-knowledge-051, storm-04-b-knowledge-075].
Rationale courte : Les deux connaissances renvoient aux mêmes relais — ambassadeur ou équipe projet — pour interagir directement avec le projet.

### scenario-family-preflight-22 — PARTITION_DISAGREEMENT

- Paquet : `SCENARIO_FAMILY_PREFLIGHT`
- Références : A `storm-04-a-item-033` · B `storm-04-b-item-002`
- Connaissances canoniques : `["equinoxe-q078","equinoxe-q085","equinoxe-q110","equinoxe-q111","equinoxe-q112"]`
- Constats : `[{"field":"reviewerScenarioFamilyPartition.canonicalPartition","status":"PARTITION_DISAGREEMENT"}]`
- Décision normalisée A : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"tooBroad"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q078","equinoxe-q085"],["equinoxe-q110","equinoxe-q111"],["equinoxe-q112"]],"value":"reviewerDefinedFamilyGroups"}}`
- Décision normalisée B : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"tooBroad"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q078","equinoxe-q085"],["equinoxe-q110","equinoxe-q112"],["equinoxe-q111"]],"value":"reviewerDefinedFamilyGroups"}}`
- Rationales A :
  - `fragmentationAssessment` : Trois branches : actualités vers F09, feedback ou évolution vers F02, et contribution distincte.
  - `reviewerScenarioFamilyPartition` : Partition Reviewer : [storm-04-a-knowledge-056, storm-04-a-knowledge-035] / [storm-04-a-knowledge-051, storm-04-a-knowledge-020] / [storm-04-a-knowledge-036]. Trois branches : actualités vers F09, feedback ou évolution vers F02, et contribution distincte.
- Rationales B :
  - `fragmentationAssessment` : Le brief agrège plusieurs modes d’interaction avec le projet qui appellent des réponses métier différentes.
  - `reviewerScenarioFamilyPartition` : Groupes/familles proposés : G1 actualités/jalons = [storm-04-b-knowledge-062, storm-04-b-knowledge-080] ; G2 contribution et collecte de feedback = [storm-04-b-knowledge-075, storm-04-b-knowledge-054] ; G3 évolution du projet = [storm-04-b-knowledge-055].
Rationale courte : Recevoir des nouvelles, transmettre une contribution/feedback et savoir si le projet évolue sont des situations distinctes.

### scenario-family-preflight-23 — PARTITION_DISAGREEMENT

- Paquet : `SCENARIO_FAMILY_PREFLIGHT`
- Références : A `storm-04-a-item-024` · B `storm-04-b-item-026`
- Connaissances canoniques : `["equinoxe-q019","equinoxe-q020","equinoxe-q022","equinoxe-q023","equinoxe-q024","equinoxe-q053"]`
- Constats : `[{"field":"reviewerScenarioFamilyPartition.canonicalPartition","status":"PARTITION_DISAGREEMENT"}]`
- Décision normalisée A : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"distinct"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q019","equinoxe-q020","equinoxe-q022","equinoxe-q023","equinoxe-q024","equinoxe-q053"]],"value":"reviewerDefinedFamilyGroups"}}`
- Décision normalisée B : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"distinct"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q019","equinoxe-q053"],["equinoxe-q020"],["equinoxe-q022"],["equinoxe-q023"],["equinoxe-q024"]],"value":"reviewerDefinedFamilyGroups"}}`
- Rationales A :
  - `fragmentationAssessment` : Règle de réservation lorsque l’espace n’est pas précisé.
  - `reviewerScenarioFamilyPartition` : Groupe Reviewer local F19 : [storm-04-a-knowledge-065, storm-04-a-knowledge-018, storm-04-a-knowledge-039, storm-04-a-knowledge-014, storm-04-a-knowledge-029, storm-04-a-knowledge-025]. Règle de réservation lorsque l’espace n’est pas précisé.
- Rationales B :
  - `fragmentationAssessment` : Le brief porte un besoin transversal unique — savoir quelle règle de réservation s’applique lorsque l’espace doit être identifié — et sa partition par espace est explicite.
  - `reviewerScenarioFamilyPartition` : Groupes/familles proposés : G1 Project Room = [storm-04-b-knowledge-077] ; G2 bulles = [storm-04-b-knowledge-003] ; G3 Bibliothèque = [storm-04-b-knowledge-031] ; G4 salles de réunion = [storm-04-b-knowledge-069, storm-04-b-knowledge-061] ; G5 Forum = [storm-04-b-knowledge-052].
Rationale courte : Les règles de réservation changent selon l’espace concerné.

### scenario-family-preflight-24 — PARTITION_DISAGREEMENT

- Paquet : `SCENARIO_FAMILY_PREFLIGHT`
- Références : A `storm-04-a-item-026` · B `storm-04-b-item-007`
- Connaissances canoniques : `["equinoxe-q026","equinoxe-q028","equinoxe-q029","equinoxe-q031","equinoxe-q076"]`
- Constats : `[{"field":"reviewerScenarioFamilyPartition.canonicalPartition","status":"PARTITION_DISAGREEMENT"}]`
- Décision normalisée A : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":["scenario-family-preflight-34"],"value":"mergeWithAnotherDisplayedBrief"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q026","equinoxe-q028","equinoxe-q029","equinoxe-q031","equinoxe-q076"]],"value":"reviewerDefinedFamilyGroups"}}`
- Décision normalisée B : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":["scenario-family-preflight-34"],"value":"mergeWithAnotherDisplayedBrief"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q026"],["equinoxe-q028"],["equinoxe-q029"],["equinoxe-q031"],["equinoxe-q076"]],"value":"reviewerDefinedFamilyGroups"}}`
- Rationales A :
  - `fragmentationAssessment` : Même scénario de capacité non spécifiée que l’item 016.
  - `reviewerScenarioFamilyPartition` : Groupe Reviewer local F14 : [storm-04-a-knowledge-008, storm-04-a-knowledge-028, storm-04-a-knowledge-010, storm-04-a-knowledge-009, storm-04-a-knowledge-002]. Même scénario de capacité non spécifiée que l’item 016.
- Rationales B :
  - `fragmentationAssessment` : Le même besoin de capacité avec référent de lieu à distinguer est aussi porté par storm-04-b-item-013 ; les deux briefs doivent être fusionnés.
  - `reviewerScenarioFamilyPartition` : Groupes/familles proposés : G1 capacité du site = [storm-04-b-knowledge-010] ; G2 Project Room = [storm-04-b-knowledge-023] ; G3 salle de réunion = [storm-04-b-knowledge-015] ; G4 Forum = [storm-04-b-knowledge-068] ; G5 Bibliothèque/Focus = [storm-04-b-knowledge-025].
Rationale courte : Une demande de capacité doit être rattachée à l’objet ou au lieu concerné.

### scenario-family-preflight-25 — DECISION_VALUE_DISAGREEMENT

- Paquet : `SCENARIO_FAMILY_PREFLIGHT`
- Références : A `storm-04-a-item-034` · B `storm-04-b-item-008`
- Connaissances canoniques : `["equinoxe-q028","equinoxe-q029","equinoxe-q031"]`
- Constats : `[{"field":"fragmentationAssessment.value","status":"DECISION_VALUE_DISAGREEMENT"},{"field":"fragmentationAssessment.mergeCanonicalReviewItemIds","status":"CONDITIONAL_STRUCTURE_DISAGREEMENT"}]`
- Décision normalisée A : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":["scenario-family-preflight-31"],"value":"mergeWithAnotherDisplayedBrief"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q028","equinoxe-q029","equinoxe-q031"]],"value":"reviewerDefinedFamilyGroups"}}`
- Décision normalisée B : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"distinct"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q028","equinoxe-q029","equinoxe-q031"]],"value":"reviewerDefinedFamilyGroups"}}`
- Rationales A :
  - `fragmentationAssessment` : Même scénario salle de réunion ou Project Room que l’item 021.
  - `reviewerScenarioFamilyPartition` : Groupe Reviewer local F17 : [storm-04-a-knowledge-002, storm-04-a-knowledge-010, storm-04-a-knowledge-028]. Même scénario salle de réunion ou Project Room que l’item 021.
- Rationales B :
  - `fragmentationAssessment` : Le besoin de sélectionner un espace pour une taille de groupe donnée est plus spécifique qu’une simple demande de capacité.
  - `reviewerScenarioFamilyPartition` : Groupes/familles proposés : G1 choix d’un espace pour 6–10 personnes = [storm-04-b-knowledge-015, storm-04-b-knowledge-023, storm-04-b-knowledge-068].
Rationale courte : Les trois connaissances servent le même besoin de choix d’espace en confrontant capacité et finalité des salles de réunion, Project Rooms et Forum.

### scenario-family-preflight-27 — DECISION_VALUE_DISAGREEMENT

- Paquet : `SCENARIO_FAMILY_PREFLIGHT`
- Références : A `storm-04-a-item-006` · B `storm-04-b-item-003`
- Connaissances canoniques : `["equinoxe-q025","equinoxe-q027","equinoxe-q050","equinoxe-q051","equinoxe-q099"]`
- Constats : `[{"field":"fragmentationAssessment.value","status":"DECISION_VALUE_DISAGREEMENT"},{"field":"reviewerScenarioFamilyPartition.canonicalPartition","status":"PARTITION_DISAGREEMENT"}]`
- Décision normalisée A : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"distinct"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q025","equinoxe-q027","equinoxe-q050","equinoxe-q051","equinoxe-q099"]],"value":"reviewerDefinedFamilyGroups"}}`
- Décision normalisée B : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"tooBroad"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q025"],["equinoxe-q027"],["equinoxe-q050","equinoxe-q051","equinoxe-q099"]],"value":"reviewerDefinedFamilyGroups"}}`
- Rationales A :
  - `fragmentationAssessment` : Choix d’un espace selon le besoin : calme, appel ou confidentialité.
  - `reviewerScenarioFamilyPartition` : Groupe Reviewer local F05 : [storm-04-a-knowledge-082, storm-04-a-knowledge-067, storm-04-a-knowledge-004, storm-04-a-knowledge-059, storm-04-a-knowledge-007]. Choix d’un espace selon le besoin : calme, appel ou confidentialité.
- Rationales B :
  - `fragmentationAssessment` : Le brief regroupe trois besoins fonctionnels distincts plutôt qu’une seule famille de situation.
  - `reviewerScenarioFamilyPartition` : Groupes/familles proposés : G1 appel court = [storm-04-b-knowledge-070] ; G2 échange confidentiel = [storm-04-b-knowledge-012, storm-04-b-knowledge-040, storm-04-b-knowledge-039] ; G3 travail calme = [storm-04-b-knowledge-047].
Rationale courte : Les espaces recommandés changent selon le besoin acoustique : appel court, confidentialité ou concentration.

### scenario-family-preflight-28 — DECISION_VALUE_DISAGREEMENT

- Paquet : `SCENARIO_FAMILY_PREFLIGHT`
- Références : A `storm-04-a-item-013` · B `storm-04-b-item-015`
- Connaissances canoniques : `["equinoxe-q050","equinoxe-q051","equinoxe-q052","equinoxe-q091","equinoxe-q099"]`
- Constats : `[{"field":"fragmentationAssessment.value","status":"DECISION_VALUE_DISAGREEMENT"},{"field":"reviewerScenarioFamilyPartition.canonicalPartition","status":"PARTITION_DISAGREEMENT"}]`
- Décision normalisée A : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"distinct"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q050","equinoxe-q051","equinoxe-q052","equinoxe-q091","equinoxe-q099"]],"value":"reviewerDefinedFamilyGroups"}}`
- Décision normalisée B : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"tooBroad"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q050","equinoxe-q051","equinoxe-q099"],["equinoxe-q052"],["equinoxe-q091"]],"value":"reviewerDefinedFamilyGroups"}}`
- Rationales A :
  - `fragmentationAssessment` : Propriétés physiques et acoustiques d’un espace.
  - `reviewerScenarioFamilyPartition` : Groupe Reviewer local F11 : [storm-04-a-knowledge-007, storm-04-a-knowledge-059, storm-04-a-knowledge-067, storm-04-a-knowledge-041, storm-04-a-knowledge-064]. Propriétés physiques et acoustiques d’un espace.
- Rationales B :
  - `fragmentationAssessment` : Le brief réunit plusieurs propriétés acoustiques ou spatiales qui doivent être séparées en situations distinctes.
  - `reviewerScenarioFamilyPartition` : Groupes/familles proposés : G1 isolation acoustique Project Room = [storm-04-b-knowledge-024] ; G2 confidentialité des échanges = [storm-04-b-knowledge-012, storm-04-b-knowledge-039, storm-04-b-knowledge-040] ; G3 fermeture physique des Focus = [storm-04-b-knowledge-005].
Rationale courte : Isolation acoustique, confidentialité d’un échange et fermeture physique d’un poste ne sont pas le même besoin.

### scenario-family-preflight-30 — DECISION_VALUE_DISAGREEMENT

- Paquet : `SCENARIO_FAMILY_PREFLIGHT`
- Références : A `storm-04-a-item-005` · B `storm-04-b-item-033`
- Connaissances canoniques : `["equinoxe-q019","equinoxe-q022","equinoxe-q053","equinoxe-q089","equinoxe-q090"]`
- Constats : `[{"field":"fragmentationAssessment.value","status":"DECISION_VALUE_DISAGREEMENT"},{"field":"reviewerScenarioFamilyPartition.canonicalPartition","status":"PARTITION_DISAGREEMENT"}]`
- Décision normalisée A : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"distinct"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q019","equinoxe-q022","equinoxe-q053","equinoxe-q089","equinoxe-q090"]],"value":"reviewerDefinedFamilyGroups"}}`
- Décision normalisée B : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"tooBroad"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q019","equinoxe-q053"],["equinoxe-q022"],["equinoxe-q089"],["equinoxe-q090"]],"value":"reviewerDefinedFamilyGroups"}}`
- Rationales A :
  - `fragmentationAssessment` : Gestion opérationnelle d’une réservation : créer, vérifier et annuler.
  - `reviewerScenarioFamilyPartition` : Groupe Reviewer local F04 : [storm-04-a-knowledge-065, storm-04-a-knowledge-025, storm-04-a-knowledge-070, storm-04-a-knowledge-003, storm-04-a-knowledge-039]. Gestion opérationnelle d’une réservation : créer, vérifier et annuler.
- Rationales B :
  - `fragmentationAssessment` : Le brief regroupe plusieurs étapes opérationnelles du cycle de réservation qui constituent des situations utilisateur distinctes.
  - `reviewerScenarioFamilyPartition` : Groupes/familles proposés : G1 créer une réservation de salle de réunion = [storm-04-b-knowledge-061, storm-04-b-knowledge-069] ; G2 annuler une réservation = [storm-04-b-knowledge-021] ; G3 vérifier une disponibilité = [storm-04-b-knowledge-043] ; G4 réserver une Project Room = [storm-04-b-knowledge-077].
Rationale courte : Créer, annuler et vérifier sont des actions différentes ; la création dépend aussi du type d’espace.

### scenario-family-preflight-31 — PARTITION_DISAGREEMENT

- Paquet : `SCENARIO_FAMILY_PREFLIGHT`
- Références : A `storm-04-a-item-021` · B `storm-04-b-item-023`
- Connaissances canoniques : `["equinoxe-q019","equinoxe-q022","equinoxe-q028","equinoxe-q031","equinoxe-q052","equinoxe-q053"]`
- Constats : `[{"field":"reviewerScenarioFamilyPartition.canonicalPartition","status":"PARTITION_DISAGREEMENT"}]`
- Décision normalisée A : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"distinct"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q019","equinoxe-q022","equinoxe-q028","equinoxe-q031","equinoxe-q052","equinoxe-q053"]],"value":"reviewerDefinedFamilyGroups"}}`
- Décision normalisée B : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"distinct"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q019","equinoxe-q028","equinoxe-q053"],["equinoxe-q022","equinoxe-q031","equinoxe-q052"]],"value":"reviewerDefinedFamilyGroups"}}`
- Rationales A :
  - `fragmentationAssessment` : Salle de réunion générique et Project Room.
  - `reviewerScenarioFamilyPartition` : Groupe Reviewer local F17 : [storm-04-a-knowledge-010, storm-04-a-knowledge-041, storm-04-a-knowledge-039, storm-04-a-knowledge-065, storm-04-a-knowledge-002, storm-04-a-knowledge-025]. Salle de réunion générique et Project Room.
- Rationales B :
  - `fragmentationAssessment` : Le besoin est précisément de distinguer une salle de réunion générique de l’espace nommé Project Room ; aucun autre brief n’a cette même frontière complète.
  - `reviewerScenarioFamilyPartition` : Groupes/familles proposés : G1 salles de réunion génériques = [storm-04-b-knowledge-015, storm-04-b-knowledge-069, storm-04-b-knowledge-061] ; G2 Project Rooms = [storm-04-b-knowledge-077, storm-04-b-knowledge-023, storm-04-b-knowledge-024].
Rationale courte : Les deux types d’espace ont des capacités, propriétés et modalités de réservation propres.

### scenario-family-preflight-32 — DECISION_VALUE_DISAGREEMENT

- Paquet : `SCENARIO_FAMILY_PREFLIGHT`
- Références : A `storm-04-a-item-029` · B `storm-04-b-item-029`
- Connaissances canoniques : `["equinoxe-q025","equinoxe-q027","equinoxe-q029","equinoxe-q052"]`
- Constats : `[{"field":"fragmentationAssessment.value","status":"DECISION_VALUE_DISAGREEMENT"},{"field":"reviewerScenarioFamilyPartition.canonicalPartition","status":"PARTITION_DISAGREEMENT"},{"field":"fragmentationAssessment.mergeCanonicalReviewItemIds","status":"CONDITIONAL_STRUCTURE_DISAGREEMENT"}]`
- Décision normalisée A : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":["scenario-family-preflight-27"],"value":"mergeWithAnotherDisplayedBrief"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q025","equinoxe-q027","equinoxe-q029","equinoxe-q052"]],"value":"reviewerDefinedFamilyGroups"}}`
- Décision normalisée B : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"tooBroad"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q025"],["equinoxe-q027"],["equinoxe-q029"],["equinoxe-q052"]],"value":"reviewerDefinedFamilyGroups"}}`
- Rationales A :
  - `fragmentationAssessment` : Même scénario de choix d’espace selon l’usage que l’item 006.
  - `reviewerScenarioFamilyPartition` : Groupe Reviewer local F05 : [storm-04-a-knowledge-082, storm-04-a-knowledge-004, storm-04-a-knowledge-028, storm-04-a-knowledge-041]. Même scénario de choix d’espace selon l’usage que l’item 006.
- Rationales B :
  - `fragmentationAssessment` : Un brief générique d’« usage d’un espace » agrège plusieurs situations fonctionnelles substantiellement distinctes.
  - `reviewerScenarioFamilyPartition` : Groupes/familles proposés : G1 appel court/bulle = [storm-04-b-knowledge-070] ; G2 Project Room = [storm-04-b-knowledge-024] ; G3 travail calme Bibliothèque/Focus = [storm-04-b-knowledge-047] ; G4 Forum = [storm-04-b-knowledge-068].
Rationale courte : Chaque espace répond à une finalité différente.

### scenario-family-preflight-34 — DECISION_VALUE_DISAGREEMENT

- Paquet : `SCENARIO_FAMILY_PREFLIGHT`
- Références : A `storm-04-a-item-016` · B `storm-04-b-item-013`
- Connaissances canoniques : `["equinoxe-q028","equinoxe-q029","equinoxe-q031","equinoxe-q076"]`
- Constats : `[{"field":"fragmentationAssessment.value","status":"DECISION_VALUE_DISAGREEMENT"},{"field":"reviewerScenarioFamilyPartition.canonicalPartition","status":"PARTITION_DISAGREEMENT"},{"field":"fragmentationAssessment.mergeCanonicalReviewItemIds","status":"CONDITIONAL_STRUCTURE_DISAGREEMENT"}]`
- Décision normalisée A : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":[],"value":"distinct"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q028","equinoxe-q029","equinoxe-q031","equinoxe-q076"]],"value":"reviewerDefinedFamilyGroups"}}`
- Décision normalisée B : `{"fragmentationAssessment":{"mergeCanonicalReviewItemIds":["scenario-family-preflight-24"],"value":"mergeWithAnotherDisplayedBrief"},"reviewerScenarioFamilyPartition":{"canonicalPartition":[["equinoxe-q028"],["equinoxe-q029"],["equinoxe-q031"],["equinoxe-q076"]],"value":"reviewerDefinedFamilyGroups"}}`
- Rationales A :
  - `fragmentationAssessment` : Capacité lorsque le lieu n’est pas précisé.
  - `reviewerScenarioFamilyPartition` : Groupe Reviewer local F14 : [storm-04-a-knowledge-010, storm-04-a-knowledge-002, storm-04-a-knowledge-028, storm-04-a-knowledge-009]. Capacité lorsque le lieu n’est pas précisé.
- Rationales B :
  - `fragmentationAssessment` : storm-04-b-item-007 porte déjà le même besoin de capacité lorsque le référent de lieu n’est pas précisé ; fusion recommandée.
  - `reviewerScenarioFamilyPartition` : Groupes/familles proposés : G1 capacité du site = [storm-04-b-knowledge-010] ; G2 salle de réunion = [storm-04-b-knowledge-015] ; G3 Project Room = [storm-04-b-knowledge-023] ; G4 Forum = [storm-04-b-knowledge-068].
Rationale courte : Les valeurs de capacité doivent être rattachées au site ou au type de salle.

## Crosswalk non résolus

Aucun.

## Garde-fous

- Aucune décision A ou B n’est modifiée.
- Aucun champ d’adjudication ou de gold n’est produit.
- `generationAuthorized=false`.
- Statut maintenu à `PENDING_HUMAN_REVIEW`.
