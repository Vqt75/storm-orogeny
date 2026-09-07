# Storm Match — Answerability NLI spike

- Corpus canonique : 112 Q&A; baseline officielle inchangée `55f5df84538e53a21f3c9fa3c2363587fb1e80d39ec5ff8288e1796a3f0559f1`.
- Development : 200 cas de l’ancien Decision Corpus observé `7965afbd8fe9d63bffc27dd3f59b87733a24e302f75ab36e56dc3a6bce61f35f` — 100 covered, 80 notCovered, 20 ambiguous.
- Nouveau holdout scellé avant toute inférence : `f157f8ec0e15d2bb2ef3f8c9dd25e3225a86a656a14a9c24e7c174dcdb0c10ff` — 96 cas équilibrés 32/32/32.
- Les configurations et seuils ci-dessous ont été verrouillés sur development avant export du holdout. Le holdout a été exécuté une seule fois par modèle NLI.
- CPU uniquement; snapshots locaux épinglés; Transformers/Hugging Face offline; aucun reranker BGE, lexical, génération ou code produit.

## Artefacts NLI

| modèle | révision | paramètres | artefact | fingerprint artefact | poids SHA-256 | licence |
|---|---|---:|---:|---|---|---|
| `MoritzLaurer/multilingual-MiniLMv2-L6-mnli-xnli` | `0a71e92a985b6e1ad1828cf67ce9c459639c1dca` | 106,995,589 | 429.30 MiB | `b4d6f349661b525bb13b3c381211db35ea56daca0f6a023121fdb31dbcdf7bec` | `91b323ccf247ec1e3b5925d566230bae7c52de8147e6062b42e250089a3fc80b` | mit |
| `MoritzLaurer/mDeBERTa-v3-base-mnli-xnli` | `8adb042d524ecd5c26d3e3ba0e3fbcf7e2d0864c` | 278,812,163 | 551.51 MiB | `055e72a84c906209af56807cd8d4bf19d1ff200de2995772ad9126829e4b2d6d` | `65af59b1ff4450b09ecbf13ca35c840dbf038b26ff8e10e5ea89ca724828ed1e` | mit |

## Retrieval development — 100 cas covered

| retriever | représentation | Recall@1 | Recall@3 | Recall@5 |
|---|---|---:|---:|---:|
| `e5-small` | `question` | 53/100 (53.0%) | 69/100 (69.0%) | 73/100 (73.0%) |
| `e5-small` | `questionAnswer` | 50/100 (50.0%) | 80/100 (80.0%) | 82/100 (82.0%) |
| `distiluse-cased-v2` | `question` | 50/100 (50.0%) | 66/100 (66.0%) | 75/100 (75.0%) |
| `distiluse-cased-v2` | `questionAnswer` | 53/100 (53.0%) | 82/100 (82.0%) | 85/100 (85.0%) |

## Ablation directionnelle sur development

Chaque ligne est la meilleure configuration sûre de cette direction. Les directions ne sont pas fusionnées.

| modèle | direction | retriever | représentation | K | seuil E | exact | covered Top-1 | notCovered exact | ambiguous exact | FP dangereux | V0 |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| `nli-minilm-l6` | `knowledgeToQuery` | `distiluse-cased-v2` | `questionAnswer` | 5 | 0.9137838 | 91/200 (45.5%) | 17/100 (17.0%) | 74/80 (92.5%) | 0/20 (0.0%) | 0 | non |
| `nli-minilm-l6` | `queryToKnowledge` | `e5-small` | `questionAnswer` | 3 | 0.9033882 | 85/200 (42.5%) | 6/100 (6.0%) | 79/80 (98.8%) | 0/20 (0.0%) | 0 | non |
| `nli-mdeberta-base` | `knowledgeToQuery` | `distiluse-cased-v2` | `questionAnswer` | 5 | 0.0001689 | 21/200 (10.5%) | 1/100 (1.0%) | 0/80 (0.0%) | 20/20 (100.0%) | 0 | non |
| `nli-mdeberta-base` | `queryToKnowledge` | `distiluse-cased-v2` | `questionAnswer` | 3 | 0.0905762 | 90/200 (45.0%) | 10/100 (10.0%) | 80/80 (100.0%) | 0/20 (0.0%) | 0 | non |

## Ablation représentation / Top-K sur development

Chaque ligne retient la meilleure direction et le meilleur retriever sûrs pour le couple représentation/K; elle ne modifie pas la sélection globale.

| modèle | représentation | K | direction | retriever | exact | covered Top-1 | retrieval misses | FP dangereux |
|---|---|---:|---|---|---:|---:|---:|---:|
| `nli-minilm-l6` | `question` | 3 | `knowledgeToQuery` | `distiluse-cased-v2` | 84/200 (42.0%) | 13/100 (13.0%) | 34 | 0 |
| `nli-minilm-l6` | `question` | 5 | `knowledgeToQuery` | `e5-small` | 80/200 (40.0%) | 8/100 (8.0%) | 27 | 0 |
| `nli-minilm-l6` | `questionAnswer` | 3 | `knowledgeToQuery` | `e5-small` | 90/200 (45.0%) | 16/100 (16.0%) | 20 | 0 |
| `nli-minilm-l6` | `questionAnswer` | 5 | `knowledgeToQuery` | `distiluse-cased-v2` | 91/200 (45.5%) | 17/100 (17.0%) | 15 | 0 |
| `nli-mdeberta-base` | `question` | 3 | `knowledgeToQuery` | `e5-small` | 20/200 (10.0%) | 0/100 (0.0%) | 31 | 0 |
| `nli-mdeberta-base` | `question` | 5 | `knowledgeToQuery` | `e5-small` | 20/200 (10.0%) | 0/100 (0.0%) | 27 | 0 |
| `nli-mdeberta-base` | `questionAnswer` | 3 | `queryToKnowledge` | `distiluse-cased-v2` | 90/200 (45.0%) | 10/100 (10.0%) | 18 | 0 |
| `nli-mdeberta-base` | `questionAnswer` | 5 | `queryToKnowledge` | `distiluse-cased-v2` | 90/200 (45.0%) | 10/100 (10.0%) | 15 | 0 |

## Configurations verrouillées avant holdout

### nli-minilm-l6

- `distiluse-cased-v2` / `questionAnswer` / Top-5 / `knowledgeToQuery`.
- Seuil entailment : `0.9137838`; 17/100 (17.0%) covered corrects; 0 faux positif dangereux; V0 development : non.

### nli-mdeberta-base

- `distiluse-cased-v2` / `questionAnswer` / Top-3 / `queryToKnowledge`.
- Seuil entailment : `0.0905762`; 10/100 (10.0%) covered corrects; 0 faux positif dangereux; V0 development : non.

## Holdout final — passage unique

| modèle | exact global | covered Top-1 | notCovered exact | ambiguous exact | ambiguous sans match | FP f/m/d | sur-abst. | retrieval misses | erreurs NLI candidat présent | V0 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `nli-minilm-l6` | 38/96 (39.6%) | 5/32 (15.6%) | 31/32 (96.9%) | 2/32 (6.2%) | 27/32 (84.4%) | 0/0/6 | 25 | 5 | 22 | non |
| `nli-mdeberta-base` | 32/96 (33.3%) | 1/32 (3.1%) | 31/32 (96.9%) | 0/32 (0.0%) | 31/32 (96.9%) | 0/0/2 | 28 | 7 | 24 | non |

### Holdout par type — correct exact

| type | cas | MiniLM NLI | mDeBERTa NLI |
|---|---:|---:|---:|
| `paraphrase_naturelle` | 8 | 3 | 0 |
| `synonymes` | 8 | 1 | 0 |
| `vocabulaire_different` | 8 | 1 | 0 |
| `adjacentButResolvable` | 8 | 0 | 1 |
| `hardNegative` | 8 | 8 | 8 |
| `nearButUnpublished` | 8 | 7 | 7 |
| `falsePremise` | 8 | 8 | 8 |
| `clearOutOfCorpus` | 8 | 8 | 8 |
| `mixedIntents` | 16 | 0 | 0 |
| `trueAmbiguous` | 16 | 2 | 0 |

### Catégories covered — Top-1 correct

| catégorie | cas | MiniLM NLI | mDeBERTa NLI |
|---|---:|---:|---:|
| `paraphrase_naturelle` | 8 | 3 | 0 |
| `synonymes` | 8 | 1 | 0 |
| `vocabulaire_different` | 8 | 1 | 0 |
| `adjacentButResolvable` | 8 | 0 | 1 |

## Performance CPU

Latence Top-3/Top-5 : mêmes 36 cas development (12 par label), configuration verrouillée, modèle déjà chargé.

| modèle | K | total mean / p50 / p95 | NLI mean / p50 / p95 |
|---|---:|---:|---:|
| `nli-minilm-l6` | 3 | 63.5 / 61.8 / 76.3 ms | 38.7 / 37.5 / 45.7 ms |
| `nli-minilm-l6` | 5 | 80.5 / 80.9 / 91.6 ms | 57.7 / 57.5 / 65.8 ms |
| `nli-mdeberta-base` | 3 | 4278.0 / 4233.7 / 5290.3 ms | 4253.2 / 4209.3 / 5260.6 ms |
| `nli-mdeberta-base` | 5 | 7002.4 / 6980.4 / 8358.6 ms | 6976.8 / 6955.8 / 8331.1 ms |

| modèle | premier chargement NLI | cold start processus combiné | vectorisation 112 | RAM chargée | pic RAM |
|---|---:|---:|---:|---:|---:|
| `nli-minilm-l6` | 27378.7 ms | 12733.5 ms | 3513.7 ms | 744.02 MiB | 996.09 MiB |
| `nli-mdeberta-base` | 28201.9 ms | 10620.2 ms | 3427.4 ms | 658.86 MiB | 1041.82 MiB |

Matériel : Intel64 Family 6 Model 186 Stepping 3, GenuineIntel; 10 cœurs physiques / 12 logiques; 6 threads utilisés.
Le `premier chargement NLI` est le premier chargement du worker development. Le `cold start processus combiné` est un nouveau processus retriever+NLI lancé après calibration, avec fichiers potentiellement présents dans le cache disque de l’OS. Les durées globales du scoring development ne sont pas publiées, car la machine a été suspendue pendant ce run et leur temps mural serait trompeur; les latences chaudes ci-dessus ont été mesurées sur une fenêtre active dédiée.

## Exemples — nli-minilm-l6

### Faux positifs dangereux

- `answerability-holdout-not-covered-16` — Quelle référence précise d’écran sera installée dans les quartiers ? — attendu `notCovered`, prédit `covered` / `equinoxe-q045` — equinoxe-q049 E/N/C=0.057/0.931/0.011; equinoxe-q013 E/N/C=0.054/0.923/0.023; equinoxe-q045 E/N/C=0.964/0.026/0.009.
- `answerability-holdout-ambiguous-06` — Les bulles sont-elles réservables et quand ouvre la réservation des casiers ? — attendu `ambiguous`, prédit `covered` / `equinoxe-q094` — equinoxe-q039 E/N/C=0.014/0.978/0.008; equinoxe-q023 E/N/C=0.002/0.975/0.023; equinoxe-q035 E/N/C=0.037/0.943/0.020.
- `answerability-holdout-ambiguous-13` — Comment demander un poste adapté et à quelle date a lieu la préparation ? — attendu `ambiguous`, prédit `covered` / `equinoxe-q048` — equinoxe-q004 E/N/C=0.065/0.919/0.016; equinoxe-q048 E/N/C=0.950/0.040/0.010; equinoxe-q066 E/N/C=0.049/0.939/0.012.
- `answerability-holdout-ambiguous-19` — Combien de personnes peuvent tenir dans la salle ? — attendu `ambiguous`, prédit `covered` / `equinoxe-q028` — equinoxe-q031 E/N/C=0.762/0.224/0.015; equinoxe-q028 E/N/C=0.927/0.053/0.020; equinoxe-q034 E/N/C=0.281/0.316/0.404.
- `answerability-holdout-ambiguous-23` — Cela sera-t-il disponible dès le premier jour ? — attendu `ambiguous`, prédit `covered` / `equinoxe-q065` — equinoxe-q065 E/N/C=0.953/0.046/0.001; equinoxe-q022 E/N/C=0.453/0.142/0.405; equinoxe-q048 E/N/C=0.389/0.231/0.381.

### Sur-abstentions covered

- `answerability-holdout-covered-01` — À quelle date se déroulera la semaine prévue pour préparer notre arrivée ? — attendu `equinoxe-q004`, prédit `ambiguous` / `None` — equinoxe-q004 E/N/C=0.957/0.033/0.011; equinoxe-q108 E/N/C=0.830/0.100/0.070; equinoxe-q007 E/N/C=0.032/0.050/0.918.
- `answerability-holdout-covered-02` — Depuis quand peut-on découvrir le plateau témoin ? — attendu `equinoxe-q006`, prédit `notCovered` / `None` — equinoxe-q006 E/N/C=0.858/0.111/0.031; equinoxe-q001 E/N/C=0.100/0.877/0.023; equinoxe-q039 E/N/C=0.412/0.561/0.027.
- `answerability-holdout-covered-03` — Aurons-nous assez de temps pour organiser nos affaires avant le transfert ? — attendu `equinoxe-q007`, prédit `notCovered` / `None` — equinoxe-q007 E/N/C=0.710/0.227/0.062; equinoxe-q001 E/N/C=0.004/0.857/0.139; equinoxe-q108 E/N/C=0.333/0.451/0.216.
- `answerability-holdout-covered-04` — Peut-on continuer à interroger l’équipe projet sans date de clôture ? — attendu `equinoxe-q008`, prédit `notCovered` / `None` — equinoxe-q008 E/N/C=0.092/0.766/0.142; equinoxe-q044 E/N/C=0.620/0.222/0.158; equinoxe-q024 E/N/C=0.012/0.951/0.037.
- `answerability-holdout-covered-05` — Le transfert de tous les collaborateurs aura-t-il lieu simultanément ? — attendu `equinoxe-q009`, prédit `notCovered` / `None` — equinoxe-q014 E/N/C=0.789/0.177/0.034; equinoxe-q087 E/N/C=0.134/0.799/0.066; equinoxe-q082 E/N/C=0.034/0.877/0.089.

### Erreurs NLI avec bon candidat récupéré

- `answerability-holdout-covered-01` — À quelle date se déroulera la semaine prévue pour préparer notre arrivée ? — attendu `equinoxe-q004`, prédit `ambiguous` / `None` — equinoxe-q004 E/N/C=0.957/0.033/0.011; equinoxe-q108 E/N/C=0.830/0.100/0.070; equinoxe-q007 E/N/C=0.032/0.050/0.918.
- `answerability-holdout-covered-02` — Depuis quand peut-on découvrir le plateau témoin ? — attendu `equinoxe-q006`, prédit `notCovered` / `None` — equinoxe-q006 E/N/C=0.858/0.111/0.031; equinoxe-q001 E/N/C=0.100/0.877/0.023; equinoxe-q039 E/N/C=0.412/0.561/0.027.
- `answerability-holdout-covered-03` — Aurons-nous assez de temps pour organiser nos affaires avant le transfert ? — attendu `equinoxe-q007`, prédit `notCovered` / `None` — equinoxe-q007 E/N/C=0.710/0.227/0.062; equinoxe-q001 E/N/C=0.004/0.857/0.139; equinoxe-q108 E/N/C=0.333/0.451/0.216.
- `answerability-holdout-covered-04` — Peut-on continuer à interroger l’équipe projet sans date de clôture ? — attendu `equinoxe-q008`, prédit `notCovered` / `None` — equinoxe-q008 E/N/C=0.092/0.766/0.142; equinoxe-q044 E/N/C=0.620/0.222/0.158; equinoxe-q024 E/N/C=0.012/0.951/0.037.
- `answerability-holdout-covered-09` — Pourquoi abandonner les postes nominatifs au profit de places partagées ? — attendu `equinoxe-q017`, prédit `notCovered` / `None` — equinoxe-q017 E/N/C=0.559/0.333/0.108; equinoxe-q011 E/N/C=0.512/0.145/0.343; equinoxe-q107 E/N/C=0.005/0.156/0.839.

### Ambiguïtés correctement identifiées

- `answerability-holdout-ambiguous-20` — Qui dois-je contacter pour régler ce problème ? — attendu `ambiguous`, prédit `ambiguous` / `None` — equinoxe-q104 E/N/C=0.962/0.036/0.002; equinoxe-q027 E/N/C=0.562/0.401/0.037; equinoxe-q069 E/N/C=0.960/0.037/0.003.
- `answerability-holdout-ambiguous-27` — Est-ce mon équipe ou le projet qui décide ? — attendu `ambiguous`, prédit `ambiguous` / `None` — equinoxe-q081 E/N/C=0.967/0.023/0.010; equinoxe-q082 E/N/C=0.499/0.461/0.039; equinoxe-q086 E/N/C=0.873/0.088/0.039.

## Exemples — nli-mdeberta-base

### Faux positifs dangereux

- `answerability-holdout-not-covered-12` — Quel numéro de quai RER faut-il emprunter pour rejoindre Cobalt ? — attendu `notCovered`, prédit `covered` / `equinoxe-q055` — equinoxe-q055 E/N/C=0.284/0.715/0.000; equinoxe-q054 E/N/C=0.000/0.999/0.000; equinoxe-q076 E/N/C=0.000/0.998/0.002.
- `answerability-holdout-ambiguous-25` — Je dois le réserver pour une heure ou pour toute la journée ? — attendu `ambiguous`, prédit `covered` / `equinoxe-q022` — equinoxe-q022 E/N/C=0.238/0.761/0.002; equinoxe-q015 E/N/C=0.001/0.999/0.000; equinoxe-q021 E/N/C=0.000/0.002/0.998.

### Sur-abstentions covered

- `answerability-holdout-covered-01` — À quelle date se déroulera la semaine prévue pour préparer notre arrivée ? — attendu `equinoxe-q004`, prédit `notCovered` / `None` — equinoxe-q004 E/N/C=0.000/0.999/0.001; equinoxe-q108 E/N/C=0.022/0.978/0.000; equinoxe-q007 E/N/C=0.000/0.983/0.016.
- `answerability-holdout-covered-02` — Depuis quand peut-on découvrir le plateau témoin ? — attendu `equinoxe-q006`, prédit `notCovered` / `None` — equinoxe-q006 E/N/C=0.000/0.992/0.008; equinoxe-q001 E/N/C=0.001/0.904/0.096; equinoxe-q039 E/N/C=0.000/0.992/0.008.
- `answerability-holdout-covered-03` — Aurons-nous assez de temps pour organiser nos affaires avant le transfert ? — attendu `equinoxe-q007`, prédit `notCovered` / `None` — equinoxe-q007 E/N/C=0.000/1.000/0.000; equinoxe-q001 E/N/C=0.000/0.999/0.001; equinoxe-q108 E/N/C=0.000/1.000/0.000.
- `answerability-holdout-covered-04` — Peut-on continuer à interroger l’équipe projet sans date de clôture ? — attendu `equinoxe-q008`, prédit `notCovered` / `None` — equinoxe-q008 E/N/C=0.001/0.989/0.010; equinoxe-q044 E/N/C=0.002/0.997/0.001; equinoxe-q024 E/N/C=0.004/0.996/0.000.
- `answerability-holdout-covered-06` — Est-ce que mon emplacement de travail devra varier quotidiennement ? — attendu `equinoxe-q012`, prédit `notCovered` / `None` — equinoxe-q015 E/N/C=0.001/0.999/0.000; equinoxe-q012 E/N/C=0.004/0.668/0.327; equinoxe-q044 E/N/C=0.001/0.988/0.011.

### Erreurs NLI avec bon candidat récupéré

- `answerability-holdout-covered-01` — À quelle date se déroulera la semaine prévue pour préparer notre arrivée ? — attendu `equinoxe-q004`, prédit `notCovered` / `None` — equinoxe-q004 E/N/C=0.000/0.999/0.001; equinoxe-q108 E/N/C=0.022/0.978/0.000; equinoxe-q007 E/N/C=0.000/0.983/0.016.
- `answerability-holdout-covered-02` — Depuis quand peut-on découvrir le plateau témoin ? — attendu `equinoxe-q006`, prédit `notCovered` / `None` — equinoxe-q006 E/N/C=0.000/0.992/0.008; equinoxe-q001 E/N/C=0.001/0.904/0.096; equinoxe-q039 E/N/C=0.000/0.992/0.008.
- `answerability-holdout-covered-03` — Aurons-nous assez de temps pour organiser nos affaires avant le transfert ? — attendu `equinoxe-q007`, prédit `notCovered` / `None` — equinoxe-q007 E/N/C=0.000/1.000/0.000; equinoxe-q001 E/N/C=0.000/0.999/0.001; equinoxe-q108 E/N/C=0.000/1.000/0.000.
- `answerability-holdout-covered-04` — Peut-on continuer à interroger l’équipe projet sans date de clôture ? — attendu `equinoxe-q008`, prédit `notCovered` / `None` — equinoxe-q008 E/N/C=0.001/0.989/0.010; equinoxe-q044 E/N/C=0.002/0.997/0.001; equinoxe-q024 E/N/C=0.004/0.996/0.000.
- `answerability-holdout-covered-06` — Est-ce que mon emplacement de travail devra varier quotidiennement ? — attendu `equinoxe-q012`, prédit `notCovered` / `None` — equinoxe-q015 E/N/C=0.001/0.999/0.000; equinoxe-q012 E/N/C=0.004/0.668/0.327; equinoxe-q044 E/N/C=0.001/0.988/0.011.

### Ambiguïtés correctement identifiées

- Aucun.

## Verdict

Aucune des deux architectures NLI ne satisfait les critères Liquid Core V0 sur le nouveau holdout. Aucune architecture n’est recommandée et aucun choix produit n’est forcé.

L’approche QA extractive SQuAD2 n’a pas été exécutée. Elle reste une troisième voie distincte à décider séparément à partir de ce résultat NLI.

## Limites

- Le seuil unique d’entailment est une règle expérimentale, pas un Confidence Gate produit.
- Les modèles NLI ont été entraînés pour l’inférence textuelle générale, pas spécifiquement pour la couverture d’une base de connaissances projet.
- Les identifiants `equinoxe-qNNN` sont des fixtures synthétiques stables test-only, jamais des UUID ni des `entryId` PostgreSQL.
- Aucun modèle, cache, chemin local, index, `SemanticProvider` ou fichier produit n’est inclus.
