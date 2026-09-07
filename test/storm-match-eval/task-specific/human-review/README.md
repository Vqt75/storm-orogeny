# Infrastructure de revue humaine indépendante

Cette infrastructure prépare les futurs paquets de revue du classifieur
task-specific. Elle ne crée aucun dataset, ne préremplit aucun jugement et
n'ouvre aucun holdout. Le manifeste du Quality Gate reste obligatoirement :

`PENDING_HUMAN_REVIEW`

Les paquets structurels désormais matérialisés se trouvent dans
`generated-structural-review/`. Le mode d’emploi distribuable est
`STRUCTURAL-REVIEW-MODE-D-EMPLOI.md`. Ils peuvent être régénérés de façon
déterministe avec :

```text
node test/storm-match-eval/task-specific/human-review/generate-structural-review-packages.js
```

et vérifiés sans écriture avec l’option `--check`. Cette matérialisation ne
génère aucune formulation ou annotation et ne modifie jamais
`generationAuthorized`.

## Rôles et artefacts séparés

- Reviewer A et Reviewer B sont deux rôles indépendants **par strate
  linguistique**, pas deux personnes globales.
- Chaque bundle distribué porte une seule strate parmi FR, EN, DE, ES, IT ou
  NL. La personne qui le traite doit attester sa compétence dans cette langue.
- Une même personne peut intervenir dans plusieurs langues si elle est
  compétente, mais ne peut jamais tenir A et B pour le même contenu.
- Les personnes physiques sont affectées curator-side ; aucun nom global, y
  compris Vivien, n'est codé dans les paquets.
- Curateur : seul rôle autorisé à conserver la liaison entre identifiants source
  et références aveugles A/B, ainsi que les seeds bruts.
- Adjudicateur : intervient uniquement après réception et scellement des deux
  réponses indépendantes.

Quatre catégories d'artefacts doivent rester physiquement séparées :

1. le paquet distribué à Reviewer A et celui distribué à Reviewer B ;
2. la liaison `curatorLinkage`, jamais distribuée aux reviewers ;
3. deux journaux append-only de réponses, un par reviewer ;
4. le journal append-only d'adjudication, créé seulement à partir des deux
   soumissions humaines scellées.

Le bundle construit par `createIndependentReviewPackets` n'est qu'un objet de
préparation curator-side. Seuls `reviewerA.packet` et `reviewerB.packet` sont
distribuables, séparément. Le `qualityGateManifest` et `curatorLinkage` restent
chez le curateur. La source d'un bundle doit contenir une seule langue ; des
bundles indépendants permettent donc d'affecter des humains différents selon
la strate.

La politique query-level est distincte de la double revue structurelle :

- calibration et holdout : deux revues indépendantes exhaustives ;
- train et development : une revue primaire suffit ; une seconde revue peut
  cibler, selon un plan préenregistré et aveugle aux modèles, des cas litigieux,
  dangereux ou un échantillon QA ; elle n'est pas exhaustive ;
- groupes d'équivalence, `preferredEntryId`, arêtes et clusters : toujours deux
  revues indépendantes suivies d'une adjudication avant scellement métier.

Le contrat `STRUCTURAL_REVIEW_PACKET_SCHEMA` vérifie dès maintenant que ces
futurs paquets structurels pourront être monolingues et aveugles. Il sépare
strictement trois décisions : partition d'équivalence, choix ultérieur du
`preferredEntryId`, puis partition/frontières des knowledge clusters. Il permet
donc d'examiner les cinq comparaisons q001/q002, q019/q053,
q050/q051/q099, q066/q069 et q078/q085 ainsi que les frontières
arrivée/préparation, flex/télétravail, communication/pilote et salles/Focus.
Le schéma n'autorise ni regroupement ou préféré proposé, ni cluster courant, ni
score, output modèle ou rang du diagnostic DistilUSE. Il ne génère aucun paquet
final : `finalPacketGenerationAuthorized` reste `false` tant que la composition
et les comparaisons métier ne sont pas gelées.

## Source neutre et contenu visible

Le générateur accepte uniquement une source neutre : Q+A canoniques, rang de
départage préenregistré, requêtes, langue, candidats à examiner et contexte
métier non décisionnel. Les golds, labels, groupes proposés, risques, scores,
probabilités, prédictions, outputs modèle et métadonnées de split sont rejetés.

Chaque paquet distribué contient seulement :

- des références aveugles propres au reviewer ;
- les Q+A canoniques et leur rang de départage non décisionnel ;
- les requêtes, leur langue, leur contexte métier strictement utile et les Q+A
  candidates via références aveugles ;
- la même grille de décision et le même contrat de réponse, fingerprintés.

Il ne contient ni objet réponse vide, ni champ de jugement à `null`, ni mapping
source. Le reviewer crée son journal séparément avec
`createEmptyReviewerResponseLog`, puis y consigne explicitement ses décisions.

## Randomisation et indépendance

Les connaissances, les requêtes et l'ordre interne des candidats sont classés
par SHA-256 (`sha256-rank-v1`) avec un seed propre à chaque reviewer. Les seeds
bruts restent chez le curateur ; seuls leurs engagements SHA-256 figurent dans
les paquets. Une rotation déterministe élimine toute collision d'ordre A/B sur
un niveau comportant au moins deux éléments.

Le contrôle statique vérifie, avec la liaison curator-only :

- même multiensemble de contenus pour A et B ;
- namespaces et aliases A/B disjoints ;
- ordres A/B effectivement différents et fingerprints cohérents ;
- reproductibilité exacte lorsque les seeds curator-only sont fournis ;
- absence récursive de champs source, décisionnels ou modèle dans les contenus
  distribués ;
- rôles A/B non nominatifs, affectables par langue, avec compétence linguistique
  explicitement requise ;
- Quality Gate toujours pending, sans transition automatique.

## Grille et journaux de réponses

La grille identique demande à chaque humain, sans valeur par défaut :

1. `covered | notCovered` pour chaque paire candidate-level ;
2. une partition exhaustive des connaissances en groupes d'équivalence métier ;
3. un `preferredKnowledgeRef` dans chaque groupe, selon la règle préenregistrée ;
4. un gold système explicite `notCovered | covered | ambiguous` pour chaque cas ;
5. `dangerousFalsePositiveOpportunity: true | false`, catégorie et justification.

Le gold système n'est jamais dérivé en direct pour suggérer une réponse au
reviewer. Les contrôles de cohérence s'exécutent uniquement au scellement.
`review-response-log.js` impose un journal hash-chain distinct par packet,
exhaustif avant scellement et lié à une attestation humaine comprenant la
strate et l'attestation de compétence linguistique. Les tests emploient
uniquement des fixtures synthétiques en mémoire ; ils ne constituent pas une
annotation du futur dataset.

## Adjudication append-only

`createEmptyAdjudicationLog` refuse de créer le registre tant que deux
soumissions humaines valides, complètes, scellées, distinctes et portant sur le
même contenu ne sont pas fournies avec leurs paquets et la liaison curator-only.
Le sujet source est dérivé de cette liaison : il ne peut pas être saisi
librement. Les événements A et B doivent avoir un type compatible, viser le même
cas ou la même connaissance source et contenir un désaccord substantiel. Chaque
événement conserve :

- les références aux deux soumissions ;
- les deux jugements initiaux extraits de leurs soumissions, leurs identifiants
  d'événement et leurs hashes ;
- la décision arbitrée, l'adjudicateur, la justification et l'horodatage ;
- le hash de l'événement précédent et son propre hash ;
- un statut `OPEN`, `RESOLVED` ou `REPLACEMENT_REQUIRED` ;
- une filiation explicite pour tout événement qui en remplace un autre.

La décision arbitrée suit un schéma propre au type de désaccord ; un événement
`RESOLVED` ne peut pas porter une décision vide. Une supersession conserve le
même désaccord et le même sujet source, et prolonge uniquement la tête courante
de sa chaîne. Aucune API de mise à jour ou suppression n'existe. Une correction
ajoute un événement ; elle ne réécrit jamais un jugement initial. Même après les
revues et l'adjudication, cette infrastructure ne fait pas passer le holdout à
un état exécutable : tous les autres Quality Gates du protocole restent requis.
