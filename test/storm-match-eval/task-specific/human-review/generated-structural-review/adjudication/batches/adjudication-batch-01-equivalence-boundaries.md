# Adjudication structurelle — Batch 01 : équivalence et frontières métier

- Batch : `adjudication-batch-01-equivalence-boundaries`
- Matrice source : `2661f9530fc20272043a621cfbf43b836e883522cdc7dfae861e4a58e2db21dd`
- Statut : `PENDING_HUMAN_REVIEW`
- Autorisation de génération : `false`
- Adjudication effectuée : `false`
- Items : 8

> Ce document restitue les deux revues scellées et leurs divergences. Il ne contient aucune décision finale, aucun gold et aucune recommandation.

## 1. equivalence-comparison-01

- Type : `EQUIVALENCE_AND_PREFERRED`
- Accord de premier niveau : oui
- Accord complet : non
- Catégories de divergence : `PREFERRED_SELECTION_DISAGREEMENT`
- Champs nécessitant adjudication : `preferredEntrySelection` (PREFERRED_SELECTION_DISAGREEMENT)

### Connaissances concernées

| entryId | Question canonique | Réponse canonique |
|---|---|---|
| `equinoxe-q001` | Quand déménageons-nous ? | Le 18 janvier 2027. |
| `equinoxe-q002` | C’est prévu pour quand exactement, l’emménagement ? | L’emménagement à Cobalt est prévu le 18 janvier 2027. |

### Reviewer A

Décision normalisée :

```json
{
  "substantiveEquivalencePartition": {
    "value": "oneEquivalentGroup",
    "canonicalPartition": [
      [
        "equinoxe-q001",
        "equinoxe-q002"
      ]
    ]
  },
  "preferredEntrySelection": {
    "value": "chooseOneDisplayedKnowledgeRef",
    "preferredEntryId": "equinoxe-q002"
  }
}
```

- Partition A :
  - Groupe 1 : `equinoxe-q001`, `equinoxe-q002`
- Preferred selection A : valeur `chooseOneDisplayedKnowledgeRef` ; entry sélectionnée : `equinoxe-q002`

Rationales Reviewer A :

#### preferredEntrySelection

> preferredKnowledgeRef=storm-01-a-knowledge-009. La connaissance 009 contextualise explicitement l’événement, le site et la date.

#### substantiveEquivalencePartition

> Groupe équivalent unique : [storm-01-a-knowledge-009, storm-01-a-knowledge-002]. Même fait métier concernant le déménagement du 18 janvier 2027.

### Reviewer B

Décision normalisée :

```json
{
  "substantiveEquivalencePartition": {
    "value": "oneEquivalentGroup",
    "canonicalPartition": [
      [
        "equinoxe-q001",
        "equinoxe-q002"
      ]
    ]
  },
  "preferredEntrySelection": {
    "value": "insufficientEvidence",
    "preferredEntryId": null
  }
}
```

- Partition B :
  - Groupe 1 : `equinoxe-q001`, `equinoxe-q002`
- Preferred selection B : valeur `insufficientEvidence` ; entry sélectionnée : aucune

Rationales Reviewer B :

#### preferredEntrySelection

> Groupe(s) confirmé(s) → `knowledgeRef` préféré(s) : G1 [storm-01-b-knowledge-009, storm-01-b-knowledge-003] → aucun knowledgeRef préféré.
> Rationale courte : Les deux entrées sont substantiellement interchangeables et aucun critère métier de préférence n’est affiché.

#### substantiveEquivalencePartition

> Partition explicite des `knowledgeRef` (si nécessaire) : G1 = [storm-01-b-knowledge-009, storm-01-b-knowledge-003]
> Rationale courte : Les deux réponses donnent exactement la même date d’emménagement, le 18 janvier 2027.

## 2. equivalence-comparison-02

- Type : `EQUIVALENCE_AND_PREFERRED`
- Accord de premier niveau : oui
- Accord complet : non
- Catégories de divergence : `PREFERRED_SELECTION_DISAGREEMENT`
- Champs nécessitant adjudication : `preferredEntrySelection` (PREFERRED_SELECTION_DISAGREEMENT)

### Connaissances concernées

| entryId | Question canonique | Réponse canonique |
|---|---|---|
| `equinoxe-q019` | Comment je réserve une salle de réunion ? | Via l’outil de réservation habituel, qui reste inchangé pour les salles de réunion. |
| `equinoxe-q053` | Comment réserver une salle pour un entretien annuel ? | Via l’outil de réservation habituel des salles de réunion. |

### Reviewer A

Décision normalisée :

```json
{
  "substantiveEquivalencePartition": {
    "value": "oneEquivalentGroup",
    "canonicalPartition": [
      [
        "equinoxe-q019",
        "equinoxe-q053"
      ]
    ]
  },
  "preferredEntrySelection": {
    "value": "chooseOneDisplayedKnowledgeRef",
    "preferredEntryId": "equinoxe-q019"
  }
}
```

- Partition A :
  - Groupe 1 : `equinoxe-q019`, `equinoxe-q053`
- Preferred selection A : valeur `chooseOneDisplayedKnowledgeRef` ; entry sélectionnée : `equinoxe-q019`

Rationales Reviewer A :

#### preferredEntrySelection

> preferredKnowledgeRef=storm-01-a-knowledge-007. La connaissance 007 précise également que l’outil reste inchangé.

#### substantiveEquivalencePartition

> Groupe équivalent unique : [storm-01-a-knowledge-006, storm-01-a-knowledge-007]. Même procédure de réservation des salles via l’outil habituel.

### Reviewer B

Décision normalisée :

```json
{
  "substantiveEquivalencePartition": {
    "value": "oneEquivalentGroup",
    "canonicalPartition": [
      [
        "equinoxe-q019",
        "equinoxe-q053"
      ]
    ]
  },
  "preferredEntrySelection": {
    "value": "insufficientEvidence",
    "preferredEntryId": null
  }
}
```

- Partition B :
  - Groupe 1 : `equinoxe-q019`, `equinoxe-q053`
- Preferred selection B : valeur `insufficientEvidence` ; entry sélectionnée : aucune

Rationales Reviewer B :

#### preferredEntrySelection

> Groupe(s) confirmé(s) → `knowledgeRef` préféré(s) : G1 [storm-01-b-knowledge-002, storm-01-b-knowledge-006] → aucun knowledgeRef préféré.
> Rationale courte : Aucun critère métier de préférence n’est fourni ; le rang de départage ne doit pas être utilisé automatiquement.

#### substantiveEquivalencePartition

> Partition explicite des `knowledgeRef` (si nécessaire) : G1 = [storm-01-b-knowledge-002, storm-01-b-knowledge-006]
> Rationale courte : Les deux réponses renvoient au même outil habituel de réservation des salles de réunion ; la précision sur l’entretien annuel ne change pas la règle métier.

## 3. equivalence-comparison-03

- Type : `EQUIVALENCE_AND_PREFERRED`
- Accord de premier niveau : oui
- Accord complet : non
- Catégories de divergence : `PREFERRED_SELECTION_DISAGREEMENT`
- Champs nécessitant adjudication : `preferredEntrySelection` (PREFERRED_SELECTION_DISAGREEMENT)

### Connaissances concernées

| entryId | Question canonique | Réponse canonique |
|---|---|---|
| `equinoxe-q050` | Comment garantir la confidentialité dans un open space ? | Les salles de réunion et bulles sont prévues pour les échanges nécessitant de la confidentialité. |
| `equinoxe-q051` | Puis-je passer un entretien RH confidentiel sur site ? | Oui, utilisez une salle de réunion ou une bulle pour ce type d’échange. |
| `equinoxe-q099` | Puis-je réserver une salle pour un appel client confidentiel ? | Oui, les salles de réunion et bulles conviennent à ce type d’échange. |

### Reviewer A

Décision normalisée :

```json
{
  "substantiveEquivalencePartition": {
    "value": "oneEquivalentGroup",
    "canonicalPartition": [
      [
        "equinoxe-q050",
        "equinoxe-q051",
        "equinoxe-q099"
      ]
    ]
  },
  "preferredEntrySelection": {
    "value": "chooseOneDisplayedKnowledgeRef",
    "preferredEntryId": "equinoxe-q050"
  }
}
```

- Partition A :
  - Groupe 1 : `equinoxe-q050`, `equinoxe-q051`, `equinoxe-q099`
- Preferred selection A : valeur `chooseOneDisplayedKnowledgeRef` ; entry sélectionnée : `equinoxe-q050`

Rationales Reviewer A :

#### preferredEntrySelection

> preferredKnowledgeRef=storm-01-a-knowledge-004. La connaissance 004 est la formulation la plus générale et autonome.

#### substantiveEquivalencePartition

> Groupe équivalent unique : [storm-01-a-knowledge-001, storm-01-a-knowledge-008, storm-01-a-knowledge-004]. Même règle métier : utiliser une salle de réunion ou une bulle pour un échange confidentiel.

### Reviewer B

Décision normalisée :

```json
{
  "substantiveEquivalencePartition": {
    "value": "oneEquivalentGroup",
    "canonicalPartition": [
      [
        "equinoxe-q050",
        "equinoxe-q051",
        "equinoxe-q099"
      ]
    ]
  },
  "preferredEntrySelection": {
    "value": "insufficientEvidence",
    "preferredEntryId": null
  }
}
```

- Partition B :
  - Groupe 1 : `equinoxe-q050`, `equinoxe-q051`, `equinoxe-q099`
- Preferred selection B : valeur `insufficientEvidence` ; entry sélectionnée : aucune

Rationales Reviewer B :

#### preferredEntrySelection

> Groupe(s) confirmé(s) → `knowledgeRef` préféré(s) : G1 [storm-01-b-knowledge-010, storm-01-b-knowledge-001, storm-01-b-knowledge-004] → aucun knowledgeRef préféré.
> Rationale courte : Les trois entrées sont substantiellement équivalentes et aucun critère métier de préférence n’est affiché.

#### substantiveEquivalencePartition

> Partition explicite des `knowledgeRef` (si nécessaire) : G1 = [storm-01-b-knowledge-010, storm-01-b-knowledge-001, storm-01-b-knowledge-004]
> Rationale courte : Les trois réponses donnent la même règle : utiliser une salle de réunion ou une bulle pour un échange nécessitant de la confidentialité.

## 4. equivalence-comparison-04

- Type : `EQUIVALENCE_AND_PREFERRED`
- Accord de premier niveau : oui
- Accord complet : non
- Catégories de divergence : `PREFERRED_SELECTION_DISAGREEMENT`
- Champs nécessitant adjudication : `preferredEntrySelection` (PREFERRED_SELECTION_DISAGREEMENT)

### Connaissances concernées

| entryId | Question canonique | Réponse canonique |
|---|---|---|
| `equinoxe-q066` | Comment demander un poste adapté ? | Via les circuits RH/santé habituels. |
| `equinoxe-q069` | Qui contacter pour un besoin spécifique d’ergonomie ? | Les circuits RH/santé habituels restent le point d’entrée pour toute demande d’adaptation de poste. |

### Reviewer A

Décision normalisée :

```json
{
  "substantiveEquivalencePartition": {
    "value": "oneEquivalentGroup",
    "canonicalPartition": [
      [
        "equinoxe-q066",
        "equinoxe-q069"
      ]
    ]
  },
  "preferredEntrySelection": {
    "value": "chooseOneDisplayedKnowledgeRef",
    "preferredEntryId": "equinoxe-q069"
  }
}
```

- Partition A :
  - Groupe 1 : `equinoxe-q066`, `equinoxe-q069`
- Preferred selection A : valeur `chooseOneDisplayedKnowledgeRef` ; entry sélectionnée : `equinoxe-q069`

Rationales Reviewer A :

#### preferredEntrySelection

> preferredKnowledgeRef=storm-01-a-knowledge-011. La connaissance 011 formule la règle générale de manière plus explicite et autonome.

#### substantiveEquivalencePartition

> Groupe équivalent unique : [storm-01-a-knowledge-010, storm-01-a-knowledge-011]. Même point d’entrée métier pour une demande d’adaptation ou d’ergonomie via les circuits RH/santé.

### Reviewer B

Décision normalisée :

```json
{
  "substantiveEquivalencePartition": {
    "value": "oneEquivalentGroup",
    "canonicalPartition": [
      [
        "equinoxe-q066",
        "equinoxe-q069"
      ]
    ]
  },
  "preferredEntrySelection": {
    "value": "insufficientEvidence",
    "preferredEntryId": null
  }
}
```

- Partition B :
  - Groupe 1 : `equinoxe-q066`, `equinoxe-q069`
- Preferred selection B : valeur `insufficientEvidence` ; entry sélectionnée : aucune

Rationales Reviewer B :

#### preferredEntrySelection

> Groupe(s) confirmé(s) → `knowledgeRef` préféré(s) : G1 [storm-01-b-knowledge-008, storm-01-b-knowledge-005] → aucun knowledgeRef préféré.
> Rationale courte : La connaissance affichée ne fournit pas de règle métier permettant de départager ces deux entrées équivalentes.

#### substantiveEquivalencePartition

> Partition explicite des `knowledgeRef` (si nécessaire) : G1 = [storm-01-b-knowledge-008, storm-01-b-knowledge-005]
> Rationale courte : Les deux réponses désignent les circuits RH/santé habituels comme point d’entrée pour une adaptation de poste ou un besoin d’ergonomie.

## 5. equivalence-comparison-05

- Type : `EQUIVALENCE_AND_PREFERRED`
- Accord de premier niveau : oui
- Accord complet : non
- Catégories de divergence : `PREFERRED_SELECTION_DISAGREEMENT`
- Champs nécessitant adjudication : `preferredEntrySelection` (PREFERRED_SELECTION_DISAGREEMENT)

### Connaissances concernées

| entryId | Question canonique | Réponse canonique |
|---|---|---|
| `equinoxe-q078` | On peut suivre l’avancement du projet quelque part ? | Oui, les actualités et les jalons du projet sont mis à jour régulièrement dans Storm. |
| `equinoxe-q085` | Est-ce qu’il y aura des points d’étape réguliers ? | Oui, des actualités et jalons sont publiés régulièrement dans Storm au fil de l’avancement. |

### Reviewer A

Décision normalisée :

```json
{
  "substantiveEquivalencePartition": {
    "value": "oneEquivalentGroup",
    "canonicalPartition": [
      [
        "equinoxe-q078",
        "equinoxe-q085"
      ]
    ]
  },
  "preferredEntrySelection": {
    "value": "chooseOneDisplayedKnowledgeRef",
    "preferredEntryId": "equinoxe-q078"
  }
}
```

- Partition A :
  - Groupe 1 : `equinoxe-q078`, `equinoxe-q085`
- Preferred selection A : valeur `chooseOneDisplayedKnowledgeRef` ; entry sélectionnée : `equinoxe-q078`

Rationales Reviewer A :

#### preferredEntrySelection

> preferredKnowledgeRef=storm-01-a-knowledge-003. La connaissance 003 explicite mieux le projet et la fonction de suivi.

#### substantiveEquivalencePartition

> Groupe équivalent unique : [storm-01-a-knowledge-005, storm-01-a-knowledge-003]. Même information métier sur le suivi des actualités et jalons du projet dans Storm.

### Reviewer B

Décision normalisée :

```json
{
  "substantiveEquivalencePartition": {
    "value": "oneEquivalentGroup",
    "canonicalPartition": [
      [
        "equinoxe-q078",
        "equinoxe-q085"
      ]
    ]
  },
  "preferredEntrySelection": {
    "value": "insufficientEvidence",
    "preferredEntryId": null
  }
}
```

- Partition B :
  - Groupe 1 : `equinoxe-q078`, `equinoxe-q085`
- Preferred selection B : valeur `insufficientEvidence` ; entry sélectionnée : aucune

Rationales Reviewer B :

#### preferredEntrySelection

> Groupe(s) confirmé(s) → `knowledgeRef` préféré(s) : G1 [storm-01-b-knowledge-011, storm-01-b-knowledge-007] → aucun knowledgeRef préféré.
> Rationale courte : Aucun élément affiché ne justifie de préférer l’une des deux formulations métier.

#### substantiveEquivalencePartition

> Partition explicite des `knowledgeRef` (si nécessaire) : G1 = [storm-01-b-knowledge-011, storm-01-b-knowledge-007]
> Rationale courte : Les deux réponses indiquent que les actualités et jalons du projet sont publiés ou mis à jour régulièrement dans Storm.

## 6. boundary-arrival-preparation

- Type : `KNOWLEDGE_BOUNDARIES`
- Accord de premier niveau : non
- Accord complet : non
- Catégories de divergence : `DECISION_VALUE_DISAGREEMENT`, `PARTITION_DISAGREEMENT`
- Champs nécessitant adjudication : `knowledgeComponentBoundary.value` (DECISION_VALUE_DISAGREEMENT), `knowledgeComponentBoundary.canonicalPartition` (PARTITION_DISAGREEMENT)

### Connaissances concernées

| entryId | Question canonique | Réponse canonique |
|---|---|---|
| `equinoxe-q001` | Quand déménageons-nous ? | Le 18 janvier 2027. |
| `equinoxe-q002` | C’est prévu pour quand exactement, l’emménagement ? | L’emménagement à Cobalt est prévu le 18 janvier 2027. |
| `equinoxe-q003` | Le calendrier peut-il encore changer ? | Le calendrier est stabilisé, mais certaines dates intermédiaires (ateliers, visites) peuvent être ajustées en fonction de l’avancement. |
| `equinoxe-q004` | Quand aura lieu la semaine de préparation ? | La semaine de préparation est prévue le 11 janvier 2027, juste avant l’emménagement. |
| `equinoxe-q005` | Est-ce que je peux visiter Cobalt avant le déménagement ? | Oui, des visites sont prévues fin novembre 2026 -- les créneaux seront communiqués par les ambassadeurs. |
| `equinoxe-q007` | On aura combien de temps pour préparer notre déménagement personnel ? | Le guide des nouveaux usages sera disponible début octobre, plusieurs mois avant le déménagement. |
| `equinoxe-q009` | Le déménagement se fera-t-il en une fois ou par étapes ? | Les modalités précises seront communiquées dans le guide des nouveaux usages, début octobre. |
| `equinoxe-q108` | Le projet prévoit-il d’autres ateliers après le choix des quartiers ? | Oui, des visites et une semaine de préparation sont prévues avant l’emménagement. |

### Reviewer A

Décision normalisée :

```json
{
  "knowledgeComponentBoundary": {
    "value": "partitionRequired",
    "canonicalPartition": [
      [
        "equinoxe-q001",
        "equinoxe-q002",
        "equinoxe-q009"
      ],
      [
        "equinoxe-q003",
        "equinoxe-q004",
        "equinoxe-q005",
        "equinoxe-q007",
        "equinoxe-q108"
      ]
    ]
  },
  "futureCoverageBoundaryRules": {
    "value": "rulesDocumented",
    "text": "Règles futures : ARRIVAL = date, timing ou phasage d’arrivée ; PREPARATION = visites, semaine, guide, accompagnement ou étapes préparatoires ; une formulation vague peut rester ambiguë."
  }
}
```

- Partition A :
  - Groupe 1 : `equinoxe-q001`, `equinoxe-q002`, `equinoxe-q009`
  - Groupe 2 : `equinoxe-q003`, `equinoxe-q004`, `equinoxe-q005`, `equinoxe-q007`, `equinoxe-q108`

Rationales Reviewer A :

#### futureCoverageBoundaryRules

> Règles futures : ARRIVAL = date, timing ou phasage d’arrivée ; PREPARATION = visites, semaine, guide, accompagnement ou étapes préparatoires ; une formulation vague peut rester ambiguë.

#### knowledgeComponentBoundary

> Partition : ARRIVAL=[storm-02-a-knowledge-023, storm-02-a-knowledge-040, storm-02-a-knowledge-024]; PREPARATION=[storm-02-a-knowledge-032, storm-02-a-knowledge-018, storm-02-a-knowledge-011, storm-02-a-knowledge-004, storm-02-a-knowledge-027]. Le calendrier relie les connaissances, mais arrivée/déménagement et préparation en amont sont deux besoins métier distincts.

### Reviewer B

Décision normalisée :

```json
{
  "knowledgeComponentBoundary": {
    "value": "sameConnectedComponent",
    "canonicalPartition": [
      [
        "equinoxe-q001",
        "equinoxe-q002",
        "equinoxe-q003",
        "equinoxe-q004",
        "equinoxe-q005",
        "equinoxe-q007",
        "equinoxe-q009",
        "equinoxe-q108"
      ]
    ]
  },
  "futureCoverageBoundaryRules": {
    "value": "rulesDocumented",
    "text": "Règles de frontière futures documentées : Couvert : faits affichés sur la date d’emménagement, le guide, les visites, la semaine de préparation, les modalités annoncées et la stabilité des jalons. Non couvert : détail logistique absent des connaissances affichées. Réellement ambigu : demande portant sur une date ou une préparation sans permettre d’identifier le jalon concerné parmi emménagement, visites, guide ou semaine de préparation.\nRationale courte : Les `knowledgeRef` storm-02-b-knowledge-004, -007, -009, -014, -021, -034, -038 et -040 couvrent des jalons distincts mais reliés du même calendrier d’arrivée."
  }
}
```

- Partition B :
  - Groupe 1 : `equinoxe-q001`, `equinoxe-q002`, `equinoxe-q003`, `equinoxe-q004`, `equinoxe-q005`, `equinoxe-q007`, `equinoxe-q009`, `equinoxe-q108`

Rationales Reviewer B :

#### futureCoverageBoundaryRules

> Règles de frontière futures documentées : Couvert : faits affichés sur la date d’emménagement, le guide, les visites, la semaine de préparation, les modalités annoncées et la stabilité des jalons. Non couvert : détail logistique absent des connaissances affichées. Réellement ambigu : demande portant sur une date ou une préparation sans permettre d’identifier le jalon concerné parmi emménagement, visites, guide ou semaine de préparation.
> Rationale courte : Les `knowledgeRef` storm-02-b-knowledge-004, -007, -009, -014, -021, -034, -038 et -040 couvrent des jalons distincts mais reliés du même calendrier d’arrivée.

#### knowledgeComponentBoundary

> Les connaissances décrivent un même continuum d’arrivée à Cobalt : date d’emménagement, jalons de préparation, visites, guide et stabilité du calendrier, avec plusieurs réponses explicitement positionnées par rapport à l’emménagement.

## 7. boundary-communication-pilot

- Type : `KNOWLEDGE_BOUNDARIES`
- Accord de premier niveau : oui
- Accord complet : non
- Catégories de divergence : `PARTITION_DISAGREEMENT`
- Champs nécessitant adjudication : `knowledgeComponentBoundary.canonicalPartition` (PARTITION_DISAGREEMENT)

### Connaissances concernées

| entryId | Question canonique | Réponse canonique |
|---|---|---|
| `equinoxe-q006` | Quand le plateau témoin a-t-il ouvert ? | Le plateau témoin a ouvert ses portes le 27 juillet 2026. |
| `equinoxe-q008` | Y a-t-il une date limite pour poser des questions sur le projet ? | Non, vous pouvez poser vos questions à tout moment via Storm. |
| `equinoxe-q077` | Qui sont les ambassadeurs, ils servent à quoi ? | Les ambassadeurs sont des relais de proximité dans chaque service, pour répondre à vos questions au quotidien. |
| `equinoxe-q078` | On peut suivre l’avancement du projet quelque part ? | Oui, les actualités et les jalons du projet sont mis à jour régulièrement dans Storm. |
| `equinoxe-q079` | Le mobilier du plateau témoin, c’est celui qu’on aura à Cobalt ? | Le plateau témoin permet de tester les mobiliers et futurs usages envisagés pour Cobalt. |
| `equinoxe-q083` | Y a-t-il un contact si j’ai une question qui n’est pas dans Storm ? | Vous pouvez contacter un ambassadeur de votre service ou l’équipe projet directement. |
| `equinoxe-q085` | Est-ce qu’il y aura des points d’étape réguliers ? | Oui, des actualités et jalons sont publiés régulièrement dans Storm au fil de l’avancement. |
| `equinoxe-q106` | Les ambassadeurs sont-ils dans mon service ? | Oui, chaque service dispose d’un ambassadeur qui sert de relais de proximité. |
| `equinoxe-q107` | Comment sont choisis les ambassadeurs ? | Les ambassadeurs sont désignés au sein de chaque service comme relais de proximité pour le projet. |
| `equinoxe-q110` | Qui gère les premiers retours après l’ouverture du plateau témoin ? | L’équipe projet recueille les retours pour ajuster les choix avant le déménagement définitif. |
| `equinoxe-q111` | Le projet est-il définitif ou peut-il encore évoluer ? | Le projet reste ajustable : les usages seront observés après l’emménagement et des ajustements resteront possibles. |
| `equinoxe-q112` | Puis-je proposer une idée d’amélioration ? | Oui, vous pouvez transmettre vos idées à votre ambassadeur ou à l’équipe projet. |

### Reviewer A

Décision normalisée :

```json
{
  "knowledgeComponentBoundary": {
    "value": "partitionRequired",
    "canonicalPartition": [
      [
        "equinoxe-q006",
        "equinoxe-q079",
        "equinoxe-q110",
        "equinoxe-q111",
        "equinoxe-q112"
      ],
      [
        "equinoxe-q008",
        "equinoxe-q078",
        "equinoxe-q085"
      ],
      [
        "equinoxe-q077",
        "equinoxe-q083",
        "equinoxe-q106",
        "equinoxe-q107"
      ]
    ]
  },
  "futureCoverageBoundaryRules": {
    "value": "rulesDocumented",
    "text": "Règles futures : Distinguer information et questions projet, contacts ambassadeurs, et expérimentation, retours ou évolution."
  }
}
```

- Partition A :
  - Groupe 1 : `equinoxe-q006`, `equinoxe-q079`, `equinoxe-q110`, `equinoxe-q111`, `equinoxe-q112`
  - Groupe 2 : `equinoxe-q008`, `equinoxe-q078`, `equinoxe-q085`
  - Groupe 3 : `equinoxe-q077`, `equinoxe-q083`, `equinoxe-q106`, `equinoxe-q107`

Rationales Reviewer A :

#### futureCoverageBoundaryRules

> Règles futures : Distinguer information et questions projet, contacts ambassadeurs, et expérimentation, retours ou évolution.

#### knowledgeComponentBoundary

> Partition : INFO_QUESTIONS=[storm-02-a-knowledge-003, storm-02-a-knowledge-006, storm-02-a-knowledge-020]; AMBASSADORS_CONTACTS=[storm-02-a-knowledge-012, storm-02-a-knowledge-038, storm-02-a-knowledge-041, storm-02-a-knowledge-050]; EXPERIMENT_FEEDBACK=[storm-02-a-knowledge-021, storm-02-a-knowledge-049, storm-02-a-knowledge-043, storm-02-a-knowledge-048, storm-02-a-knowledge-030]. Trois situations métier : information/questions projet, relais humains, et expérimentation ou amélioration.

### Reviewer B

Décision normalisée :

```json
{
  "knowledgeComponentBoundary": {
    "value": "partitionRequired",
    "canonicalPartition": [
      [
        "equinoxe-q006",
        "equinoxe-q079",
        "equinoxe-q110",
        "equinoxe-q111",
        "equinoxe-q112"
      ],
      [
        "equinoxe-q008",
        "equinoxe-q078",
        "equinoxe-q083",
        "equinoxe-q085"
      ],
      [
        "equinoxe-q077",
        "equinoxe-q106",
        "equinoxe-q107"
      ]
    ]
  },
  "futureCoverageBoundaryRules": {
    "value": "rulesDocumented",
    "text": "Règles de frontière futures documentées : Couvert : réception d’actualités et canal de question, rôle/désignation des ambassadeurs, ou faits affichés sur le plateau témoin, les retours et les ajustements. Non couvert : gouvernance ou procédure détaillée non affichée. Réellement ambigu : interaction avec le projet sans distinguer recherche d’information, rôle d’un ambassadeur ou transmission d’un retour/idée.\nRationale courte : Les connaissances affichent des canaux et acteurs communs, mais des fonctions différentes : informer, relayer, tester et recueillir des retours."
  }
}
```

- Partition B :
  - Groupe 1 : `equinoxe-q006`, `equinoxe-q079`, `equinoxe-q110`, `equinoxe-q111`, `equinoxe-q112`
  - Groupe 2 : `equinoxe-q008`, `equinoxe-q078`, `equinoxe-q083`, `equinoxe-q085`
  - Groupe 3 : `equinoxe-q077`, `equinoxe-q106`, `equinoxe-q107`

Rationales Reviewer B :

#### futureCoverageBoundaryRules

> Règles de frontière futures documentées : Couvert : réception d’actualités et canal de question, rôle/désignation des ambassadeurs, ou faits affichés sur le plateau témoin, les retours et les ajustements. Non couvert : gouvernance ou procédure détaillée non affichée. Réellement ambigu : interaction avec le projet sans distinguer recherche d’information, rôle d’un ambassadeur ou transmission d’un retour/idée.
> Rationale courte : Les connaissances affichent des canaux et acteurs communs, mais des fonctions différentes : informer, relayer, tester et recueillir des retours.

#### knowledgeComponentBoundary

> Trois groupes métier ressortent : information/questions projet = [storm-02-b-knowledge-025, storm-02-b-knowledge-045, storm-02-b-knowledge-036, storm-02-b-knowledge-033] ; rôle et implantation des ambassadeurs = [storm-02-b-knowledge-006, storm-02-b-knowledge-003, storm-02-b-knowledge-037] ; pilote, contribution, feedback et évolution = [storm-02-b-knowledge-044, storm-02-b-knowledge-019, storm-02-b-knowledge-018, storm-02-b-knowledge-017, storm-02-b-knowledge-026].

## 8. boundary-rooms-focus

- Type : `KNOWLEDGE_BOUNDARIES`
- Accord de premier niveau : oui
- Accord complet : non
- Catégories de divergence : `PARTITION_DISAGREEMENT`
- Champs nécessitant adjudication : `knowledgeComponentBoundary.canonicalPartition` (PARTITION_DISAGREEMENT)

### Connaissances concernées

| entryId | Question canonique | Réponse canonique |
|---|---|---|
| `equinoxe-q019` | Comment je réserve une salle de réunion ? | Via l’outil de réservation habituel, qui reste inchangé pour les salles de réunion. |
| `equinoxe-q020` | Faut-il réserver pour aller à la Bibliothèque ? | Non, la Bibliothèque fonctionne en accès libre. |
| `equinoxe-q022` | Peut-on réserver une Project Room à l’avance ? | Oui, les Project Rooms se réservent à la demi-journée ou à la journée. |
| `equinoxe-q023` | Et les bulles, on les réserve aussi ? | Non, les bulles sont pensées pour un usage court et spontané, sans réservation. |
| `equinoxe-q024` | Le Forum est-il réservable pour un événement d’équipe ? | Oui, le Forum peut être réservé pour des événements, sur demande auprès de l’équipe projet. |
| `equinoxe-q025` | Où travailler au calme ? | À la Bibliothèque ou dans les espaces Focus. |
| `equinoxe-q026` | C’est quoi la différence entre Focus et Bibliothèque ? | Les espaces Focus sont des postes individuels isolés ; la Bibliothèque est un espace collectif à silence renforcé, 24 places. |
| `equinoxe-q027` | Où puis-je passer un appel rapide sans déranger personne ? | Utilisez une bulle, pensée pour les appels et visioconférences courtes. |
| `equinoxe-q028` | Quelle est la capacité des salles de réunion ? | Les salles de réunion accueillent de 4 à 16 personnes, en présentiel ou hybride. |
| `equinoxe-q029` | Le Forum, c’est pour quoi ? | Le Forum est un espace pour les événements et prises de parole, jusqu’à 120 personnes. |
| `equinoxe-q031` | Combien de personnes dans une Project Room ? | Les Project Rooms accueillent de 6 à 10 personnes. |
| `equinoxe-q050` | Comment garantir la confidentialité dans un open space ? | Les salles de réunion et bulles sont prévues pour les échanges nécessitant de la confidentialité. |
| `equinoxe-q051` | Puis-je passer un entretien RH confidentiel sur site ? | Oui, utilisez une salle de réunion ou une bulle pour ce type d’échange. |
| `equinoxe-q052` | Les Project Rooms sont-elles insonorisées ? | Les Project Rooms sont conçues pour le travail de projet en petit groupe, avec une bonne isolation sonore. |
| `equinoxe-q053` | Comment réserver une salle pour un entretien annuel ? | Via l’outil de réservation habituel des salles de réunion. |
| `equinoxe-q089` | Comment savoir si une salle est libre ? | L’outil de réservation habituel indique la disponibilité des salles en temps réel. |
| `equinoxe-q090` | Peut-on annuler une réservation de Project Room ? | Oui, les réservations peuvent être annulées via l’outil de réservation. |
| `equinoxe-q091` | Les espaces Focus sont-ils fermés ou ouverts ? | Ce sont des postes individuels isolés, pensés pour limiter les distractions sans être totalement cloisonnés. |
| `equinoxe-q099` | Puis-je réserver une salle pour un appel client confidentiel ? | Oui, les salles de réunion et bulles conviennent à ce type d’échange. |
| `equinoxe-q105` | Le Forum sera-t-il utilisé pour les réunions d’équipe classiques ? | Le Forum est plutôt réservé aux grands événements et prises de parole, jusqu’à 120 personnes. |

### Reviewer A

Décision normalisée :

```json
{
  "knowledgeComponentBoundary": {
    "value": "partitionRequired",
    "canonicalPartition": [
      [
        "equinoxe-q019",
        "equinoxe-q028",
        "equinoxe-q050",
        "equinoxe-q051",
        "equinoxe-q053",
        "equinoxe-q089",
        "equinoxe-q099"
      ],
      [
        "equinoxe-q020",
        "equinoxe-q025",
        "equinoxe-q026",
        "equinoxe-q091"
      ],
      [
        "equinoxe-q022",
        "equinoxe-q031",
        "equinoxe-q052",
        "equinoxe-q090"
      ],
      [
        "equinoxe-q023",
        "equinoxe-q027"
      ],
      [
        "equinoxe-q024",
        "equinoxe-q029",
        "equinoxe-q105"
      ]
    ]
  },
  "futureCoverageBoundaryRules": {
    "value": "rulesDocumented",
    "text": "Règles futures : Distinguer meeting rooms, Project Rooms, Forum, bulles et Focus/Library ; la confidentialité reste transverse pour les connaissances 002, 034 et 019."
  }
}
```

- Partition A :
  - Groupe 1 : `equinoxe-q019`, `equinoxe-q028`, `equinoxe-q050`, `equinoxe-q051`, `equinoxe-q053`, `equinoxe-q089`, `equinoxe-q099`
  - Groupe 2 : `equinoxe-q020`, `equinoxe-q025`, `equinoxe-q026`, `equinoxe-q091`
  - Groupe 3 : `equinoxe-q022`, `equinoxe-q031`, `equinoxe-q052`, `equinoxe-q090`
  - Groupe 4 : `equinoxe-q023`, `equinoxe-q027`
  - Groupe 5 : `equinoxe-q024`, `equinoxe-q029`, `equinoxe-q105`

Rationales Reviewer A :

#### futureCoverageBoundaryRules

> Règles futures : Distinguer meeting rooms, Project Rooms, Forum, bulles et Focus/Library ; la confidentialité reste transverse pour les connaissances 002, 034 et 019.

#### knowledgeComponentBoundary

> Partition : MEETING_ROOMS=[storm-02-a-knowledge-026, storm-02-a-knowledge-037, storm-02-a-knowledge-046, storm-02-a-knowledge-042, storm-02-a-knowledge-002, storm-02-a-knowledge-034, storm-02-a-knowledge-019]; PROJECT_ROOMS=[storm-02-a-knowledge-005, storm-02-a-knowledge-047, storm-02-a-knowledge-045, storm-02-a-knowledge-031]; FORUM=[storm-02-a-knowledge-008, storm-02-a-knowledge-015, storm-02-a-knowledge-013]; BUBBLES=[storm-02-a-knowledge-017, storm-02-a-knowledge-036]; FOCUS_LIBRARY=[storm-02-a-knowledge-001, storm-02-a-knowledge-039, storm-02-a-knowledge-009, storm-02-a-knowledge-033]. Les cinq familles d’espaces ont des finalités, capacités et règles de réservation distinctes.

### Reviewer B

Décision normalisée :

```json
{
  "knowledgeComponentBoundary": {
    "value": "partitionRequired",
    "canonicalPartition": [
      [
        "equinoxe-q019",
        "equinoxe-q022",
        "equinoxe-q023",
        "equinoxe-q024",
        "equinoxe-q027",
        "equinoxe-q028",
        "equinoxe-q029",
        "equinoxe-q031",
        "equinoxe-q050",
        "equinoxe-q051",
        "equinoxe-q052",
        "equinoxe-q053",
        "equinoxe-q089",
        "equinoxe-q090",
        "equinoxe-q099",
        "equinoxe-q105"
      ],
      [
        "equinoxe-q020",
        "equinoxe-q025",
        "equinoxe-q026",
        "equinoxe-q091"
      ]
    ]
  },
  "futureCoverageBoundaryRules": {
    "value": "rulesDocumented",
    "text": "Règles de frontière futures documentées : Couvert : capacité, réservation, disponibilité, confidentialité ou usage d’un espace lorsqu’un type d’espace ou un besoin fonctionnel affiché permet de rattacher la demande au bon groupe. Non couvert : équipement, service ou règle d’usage non présent dans ces connaissances. Réellement ambigu : espace non identifié alors que plusieurs types affichés ont des règles différentes de réservation, d’accès ou d’usage.\nRationale courte : Les connaissances distinguent notamment salles, Project Rooms, Forum et bulles des espaces Focus/Bibliothèque ; certaines sont réservables, d’autres en accès libre ou spontanées."
  }
}
```

- Partition B :
  - Groupe 1 : `equinoxe-q019`, `equinoxe-q022`, `equinoxe-q023`, `equinoxe-q024`, `equinoxe-q027`, `equinoxe-q028`, `equinoxe-q029`, `equinoxe-q031`, `equinoxe-q050`, `equinoxe-q051`, `equinoxe-q052`, `equinoxe-q053`, `equinoxe-q089`, `equinoxe-q090`, `equinoxe-q099`, `equinoxe-q105`
  - Groupe 2 : `equinoxe-q020`, `equinoxe-q025`, `equinoxe-q026`, `equinoxe-q091`

Rationales Reviewer B :

#### futureCoverageBoundaryRules

> Règles de frontière futures documentées : Couvert : capacité, réservation, disponibilité, confidentialité ou usage d’un espace lorsqu’un type d’espace ou un besoin fonctionnel affiché permet de rattacher la demande au bon groupe. Non couvert : équipement, service ou règle d’usage non présent dans ces connaissances. Réellement ambigu : espace non identifié alors que plusieurs types affichés ont des règles différentes de réservation, d’accès ou d’usage.
> Rationale courte : Les connaissances distinguent notamment salles, Project Rooms, Forum et bulles des espaces Focus/Bibliothèque ; certaines sont réservables, d’autres en accès libre ou spontanées.

#### knowledgeComponentBoundary

> Partition métier nécessaire : espaces de collaboration/réservation/confidentialité = [storm-02-b-knowledge-028, storm-02-b-knowledge-016, storm-02-b-knowledge-032, storm-02-b-knowledge-002, storm-02-b-knowledge-027, storm-02-b-knowledge-051, storm-02-b-knowledge-013, storm-02-b-knowledge-010, storm-02-b-knowledge-023, storm-02-b-knowledge-008, storm-02-b-knowledge-049, storm-02-b-knowledge-039, storm-02-b-knowledge-005, storm-02-b-knowledge-042, storm-02-b-knowledge-011, storm-02-b-knowledge-041] ; espaces de travail calme Focus/Bibliothèque = [storm-02-b-knowledge-048, storm-02-b-knowledge-050, storm-02-b-knowledge-020, storm-02-b-knowledge-046]. Les finalités et règles d’accès ne sont pas interchangeables.
