# Storm Match — relevance verifier spike V0

- Corpus officiel inchangé : `55f5df84538e53a21f3c9fa3c2363587fb1e80d39ec5ff8288e1796a3f0559f1` (320 cas; 290 résolubles)
- Corpus décisionnel : `7965afbd8fe9d63bffc27dd3f59b87733a24e302f75ab36e56dc3a6bce61f35f` (200 cas; calibration 120, holdout 80)
- Séparation : 60 positifs + 60 négatifs en calibration; 40 positifs + 40 négatifs en holdout; sources positives disjointes.
- Holdout : exporté et exécuté une seule fois après verrouillage global du retriever, Top-K, verifier, contrat et seuils.
- Exécution : CPU; Hugging Face/Transformers offline; aucun lexical, aucune génération, aucun branchement produit.

## Modèles de vérification retenus

| modèle | révision | paramètres | artefact effectif | licence | fingerprint |
|---|---|---:|---:|---|---|
| `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1` | `1427fd652930e4ba29e8149678df786c240d8825` | 117,641,603 | 469.92 MiB | apache-2.0 | `cc7db1b3d4f6aa2113a9660f08b1c7de61dbeb6a8d84b38fb9e3ca9e323578b9` |
| `BAAI/bge-reranker-v2-m3` | `953dc6f6f85a1b2dbfca4c34a2796e7dde08d41e` | 567,755,777 | 2187.02 MiB | apache-2.0 | `fcf6fedc582be5deb50a74e15279a7eccf68f96ac04941338a74570ac8635f96` |

Checksums des poids : `mmarco-minilm-l12` = `5daeca2481a76b5976a2bdc32f0a78532b6716da4f8cd3ff59460ef8d2f359b4`; `bge-reranker-v2-m3` = `d9e3e081faff1eefb84019509b2f5558fd74c1a05a2c7db22f74174fcedb5286`.

`Alibaba-NLP/gte-multilingual-reranker-base` a été écarté du run principal car il exige `trust_remote_code` et du code externe. `jinaai/jina-reranker-v2-base-multilingual` a été écarté car sa licence CC-BY-NC-4.0 est incompatible avec l’usage produit commercial visé.

## Retrieval avant vérification

| retriever | officiel R@1 | officiel R@3 | officiel R@5 | calibration R@1 | calibration R@3 | calibration R@5 |
|---|---:|---:|---:|---:|---:|---:|
| `e5-small` | 218/290 (75.2%) | 254/290 (87.6%) | 264/290 (91.0%) | 33/60 (55.0%) | 42/60 (70.0%) | 43/60 (71.7%) |
| `distiluse-cased-v2` | 221/290 (76.2%) | 256/290 (88.3%) | 266/290 (91.7%) | 31/60 (51.7%) | 42/60 (70.0%) | 46/60 (76.7%) |

Un `retrievalMiss` signifie que l’attendu est absent du Top-K. Une `verifierError` n’est comptée que si l’attendu était présent dans le Top-K mais n’a pas été classé premier.

## Reranking brut sur les 290 cas officiels résolubles

Cette mesure n’applique aucun seuil d’abstention. Elle isole l’effet du reranking sur le Top-K du retriever.

| retriever | verifier | K | paire | Top-1 | Top-3 | retrieval misses | verifier errors |
|---|---|---:|---|---:|---:|---:|---:|
| `e5-small` | `mmarco-minilm-l12` | 3 | `question` | 197/290 (67.9%) | 254/290 (87.6%) | 36 | 57 |
| `e5-small` | `mmarco-minilm-l12` | 3 | `questionAnswer` | 212/290 (73.1%) | 254/290 (87.6%) | 36 | 42 |
| `e5-small` | `mmarco-minilm-l12` | 5 | `question` | 196/290 (67.6%) | 248/290 (85.5%) | 26 | 68 |
| `e5-small` | `mmarco-minilm-l12` | 5 | `questionAnswer` | 212/290 (73.1%) | 259/290 (89.3%) | 26 | 52 |
| `e5-small` | `bge-reranker-v2-m3` | 3 | `question` | 232/290 (80.0%) | 254/290 (87.6%) | 36 | 22 |
| `e5-small` | `bge-reranker-v2-m3` | 3 | `questionAnswer` | 225/290 (77.6%) | 254/290 (87.6%) | 36 | 29 |
| `e5-small` | `bge-reranker-v2-m3` | 5 | `question` | 236/290 (81.4%) | 260/290 (89.7%) | 26 | 28 |
| `e5-small` | `bge-reranker-v2-m3` | 5 | `questionAnswer` | 227/290 (78.3%) | 263/290 (90.7%) | 26 | 37 |
| `distiluse-cased-v2` | `mmarco-minilm-l12` | 3 | `question` | 205/290 (70.7%) | 256/290 (88.3%) | 34 | 51 |
| `distiluse-cased-v2` | `mmarco-minilm-l12` | 3 | `questionAnswer` | 223/290 (76.9%) | 256/290 (88.3%) | 34 | 33 |
| `distiluse-cased-v2` | `mmarco-minilm-l12` | 5 | `question` | 202/290 (69.7%) | 251/290 (86.6%) | 24 | 64 |
| `distiluse-cased-v2` | `mmarco-minilm-l12` | 5 | `questionAnswer` | 217/290 (74.8%) | 258/290 (89.0%) | 24 | 49 |
| `distiluse-cased-v2` | `bge-reranker-v2-m3` | 3 | `question` | 238/290 (82.1%) | 256/290 (88.3%) | 34 | 18 |
| `distiluse-cased-v2` | `bge-reranker-v2-m3` | 3 | `questionAnswer` | 228/290 (78.6%) | 256/290 (88.3%) | 34 | 28 |
| `distiluse-cased-v2` | `bge-reranker-v2-m3` | 5 | `question` | 238/290 (82.1%) | 264/290 (91.0%) | 24 | 28 |
| `distiluse-cased-v2` | `bge-reranker-v2-m3` | 5 | `questionAnswer` | 228/290 (78.6%) | 262/290 (90.3%) | 24 | 38 |

## Calibration — 16 architectures comparées

Les seuils de score et de marge sont balayés sur toutes les valeurs qui changent effectivement une décision dans les 120 cas de calibration, plus l’abstention totale. L’admissibilité impose zéro faux positif dangereux et zéro acceptation `clearOutOfCorpus` (≤15 % de six cas).

| retriever | verifier | K | paire | Top-1 | para. | synonymes | diff. vocab | adjacent | FP f/m/d | sur-abst. | V0 |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---|
| `e5-small` | `mmarco-minilm-l12` | 3 | `question` | 5/60 (8.3%) | 3/15 | 1/15 | 0/15 | 1/15 | 0/0/0 | 55 | non |
| `e5-small` | `mmarco-minilm-l12` | 3 | `questionAnswer` | 9/60 (15.0%) | 4/15 | 1/15 | 0/15 | 4/15 | 0/0/0 | 51 | non |
| `e5-small` | `mmarco-minilm-l12` | 5 | `question` | 5/60 (8.3%) | 3/15 | 1/15 | 0/15 | 1/15 | 0/0/0 | 55 | non |
| `e5-small` | `mmarco-minilm-l12` | 5 | `questionAnswer` | 9/60 (15.0%) | 4/15 | 1/15 | 0/15 | 4/15 | 0/0/0 | 51 | non |
| `e5-small` | `bge-reranker-v2-m3` | 3 | `question` | 4/60 (6.7%) | 4/15 | 0/15 | 0/15 | 0/15 | 0/0/0 | 56 | non |
| `e5-small` | `bge-reranker-v2-m3` | 3 | `questionAnswer` | 18/60 (30.0%) | 6/15 | 4/15 | 0/15 | 8/15 | 0/1/0 | 39 | non |
| `e5-small` | `bge-reranker-v2-m3` | 5 | `question` | 5/60 (8.3%) | 3/15 | 2/15 | 0/15 | 0/15 | 0/0/0 | 55 | non |
| `e5-small` | `bge-reranker-v2-m3` | 5 | `questionAnswer` | 18/60 (30.0%) | 6/15 | 4/15 | 0/15 | 8/15 | 0/1/0 | 39 | non |
| `distiluse-cased-v2` | `mmarco-minilm-l12` | 3 | `question` | 5/60 (8.3%) | 3/15 | 1/15 | 0/15 | 1/15 | 0/0/0 | 55 | non |
| `distiluse-cased-v2` | `mmarco-minilm-l12` | 3 | `questionAnswer` | 9/60 (15.0%) | 3/15 | 1/15 | 0/15 | 5/15 | 0/1/0 | 50 | non |
| `distiluse-cased-v2` | `mmarco-minilm-l12` | 5 | `question` | 5/60 (8.3%) | 3/15 | 1/15 | 0/15 | 1/15 | 0/0/0 | 55 | non |
| `distiluse-cased-v2` | `mmarco-minilm-l12` | 5 | `questionAnswer` | 8/60 (13.3%) | 4/15 | 1/15 | 0/15 | 3/15 | 0/0/0 | 52 | non |
| `distiluse-cased-v2` | `bge-reranker-v2-m3` | 3 | `question` | 4/60 (6.7%) | 4/15 | 0/15 | 0/15 | 0/15 | 0/0/0 | 56 | non |
| `distiluse-cased-v2` | `bge-reranker-v2-m3` | 3 | `questionAnswer` | 19/60 (31.7%) | 8/15 | 4/15 | 0/15 | 7/15 | 0/1/0 | 36 | non |
| `distiluse-cased-v2` | `bge-reranker-v2-m3` | 5 | `question` | 4/60 (6.7%) | 4/15 | 0/15 | 0/15 | 0/15 | 0/0/0 | 56 | non |
| `distiluse-cased-v2` | `bge-reranker-v2-m3` | 5 | `questionAnswer` | 18/60 (30.0%) | 7/15 | 4/15 | 0/15 | 7/15 | 0/1/0 | 39 | non |

## Coût isolé des verifiers

Les latences ci-dessous mesurent seulement la vérification d’un Top-K, sur les mêmes 32 requêtes de calibration. La latence bout-en-bout exacte n’est mesurée que pour la configuration finale au holdout.

| verifier | paire | K | mean | p50 | p95 |
|---|---|---:|---:|---:|---:|
| `mmarco-minilm-l12` | `question` | 3 | 62.4 ms | 62.3 ms | 74.4 ms |
| `mmarco-minilm-l12` | `question` | 5 | 103.0 ms | 101.7 ms | 120.5 ms |
| `mmarco-minilm-l12` | `questionAnswer` | 3 | 94.9 ms | 92.5 ms | 121.6 ms |
| `mmarco-minilm-l12` | `questionAnswer` | 5 | 153.9 ms | 150.4 ms | 197.7 ms |
| `bge-reranker-v2-m3` | `question` | 3 | 793.5 ms | 817.0 ms | 933.9 ms |
| `bge-reranker-v2-m3` | `question` | 5 | 1217.8 ms | 1231.8 ms | 1406.7 ms |
| `bge-reranker-v2-m3` | `questionAnswer` | 3 | 1180.3 ms | 1190.0 ms | 1317.2 ms |
| `bge-reranker-v2-m3` | `questionAnswer` | 5 | 2020.7 ms | 1898.2 ms | 2761.9 ms |

| verifier | chargement | RAM chargée | pic RAM worker |
|---|---:|---:|---:|
| `mmarco-minilm-l12` | 17288.9 ms | 692.68 MiB | 838.81 MiB |
| `bge-reranker-v2-m3` | 21540.6 ms | 694.88 MiB | 1528.45 MiB |

Signal de la réponse canonique : sur le reranking officiel, `questionAnswer` améliore systématiquement MiniLM (par exemple 205→223 Top-1 avec DistilUSE/K=3), mais dégrade BGE (238→228 dans la même configuration). Sur le corpus décisionnel et sous contrainte de sécurité, BGE ne récupère pratiquement des positifs qu’avec la réponse (4→19/60), sans toutefois approcher les critères V0. Le signal est donc réel mais dépend du verifier et ne constitue pas une validation générale du contrat Q+A.

## Configuration verrouillée avant holdout

- Retriever : `distiluse-cased-v2`; Top-K : 3.
- Verifier : `bge-reranker-v2-m3`; paire : `questionAnswer`.
- Seuil pertinence : `0.6415073`; seuil marge : `0.4810125`.
- Calibration : 19/60 (31.7%), 1 faux positifs, 0 dangereux; 14641 décisions de seuil évaluées pour cette architecture.

## Holdout final — passage unique

- Top-1 résoluble : 11/40 (27.5%).
- Top-3 après reranking : 24/40 (60.0%).
- Retrieval misses : 16; verifier errors : 5; sur-abstentions : 26; matches positifs erronés : 3.
- Paraphrases : 5/10; synonymes : 4/10; differentVocab : 0/10; adjacentButResolvable : 2/10.
- Négatifs correctement rejetés : 36/40; trueAmbiguous : 3/4; clearOutOfCorpus : 4/4; hard negatives : 4/4; mixed intents : 2/4.
- Faux positifs faibles/moyens/dangereux : 1/0/3.
- Corrections vs Top-1 retrieval : 2; nouvelles erreurs : 10.

### Résultats holdout par type

| type | cas | correct | acceptés | abstentions |
|---|---:|---:|---:|---:|
| `paraphrase_naturelle` | 10 | 5 | 6 | 4 |
| `synonymes` | 10 | 4 | 4 | 6 |
| `vocabulaire_different` | 10 | 0 | 0 | 10 |
| `adjacentButResolvable` | 10 | 2 | 4 | 6 |
| `clearOutOfCorpus` | 4 | 4 | 0 | 4 |
| `hardNegative` | 4 | 4 | 0 | 4 |
| `workplaceUncovered` | 4 | 4 | 0 | 4 |
| `lexicalCollision` | 4 | 4 | 0 | 4 |
| `nearButUnpublished` | 4 | 4 | 0 | 4 |
| `trueAmbiguous` | 4 | 3 | 1 | 3 |
| `mixedIntents` | 4 | 2 | 2 | 2 |
| `falsePremise` | 4 | 4 | 0 | 4 |
| `shortUnresolvable` | 4 | 3 | 1 | 3 |
| `strongResemblanceUncovered` | 4 | 4 | 0 | 4 |

## Performance CPU

- Matériel : Intel64 Family 6 Model 186 Stepping 3, GenuineIntel; 10 cœurs physiques / 12 logiques; 6 threads utilisés.
- Cold start combiné : 47464.9 ms (retriever 40183.2; verifier 7281.7).
- Vectorisation des 112 questions : 2089.1 ms.
- Latence chaude totale mean/p50/p95 : 1295.8 / 1241.1 / 1631.7 ms.
- Retrieval chaud mean/p50/p95 : 36.0 / 34.9 / 50.0 ms.
- Verification chaude mean/p50/p95 : 1259.7 / 1199.9 / 1592.0 ms.
- RAM processus avant / modèles chargés / pic : 198.49 / 743.73 / 2104.93 MiB.

## Exemples holdout

### Corrections du retrieval

- `decision-pos-equinoxe-q043-synonymes` — Cobalt introduira-t-il un quota de présence au bureau ? — attendu `equinoxe-q043`, top verifier `equinoxe-q043` score=0.9265, marge=0.6418, décision `equinoxe-q043`.
- `decision-pos-equinoxe-q070-adjacentButResolvable` — L’acoustique fait-elle partie des attentions explicites du projet ? — attendu `equinoxe-q070`, top verifier `equinoxe-q070` score=0.9998, marge=0.9985, décision `equinoxe-q070`.

### Nouvelles erreurs

- `decision-pos-equinoxe-q047-vocabulaire_different` — Pourrai-je me connecter à Internet sans câble depuis n’importe quel espace ? — attendu `equinoxe-q047`, top verifier `equinoxe-q047` score=0.0037, marge=0.0037, décision `None`.
- `decision-pos-equinoxe-q060-paraphrase_naturelle` — Un restaurant sera-t-il disponible sur le site ? — attendu `equinoxe-q060`, top verifier `equinoxe-q060` score=0.1882, marge=0.1765, décision `None`.
- `decision-pos-equinoxe-q060-vocabulaire_different` — Pourra-t-on prendre un repas dans un service de restauration intégré au bâtiment ? — attendu `equinoxe-q060`, top verifier `equinoxe-q092` score=0.0077, marge=0.0075, décision `None`.
- `decision-pos-equinoxe-q062-paraphrase_naturelle` — Le restaurant proposera-t-il des plats végétariens ? — attendu `equinoxe-q062`, top verifier `equinoxe-q103` score=0.9955, marge=0.0035, décision `None`.
- `decision-pos-equinoxe-q062-synonymes` — Une option sans viande sera-t-elle disponible au déjeuner ? — attendu `equinoxe-q062`, top verifier `equinoxe-q062` score=0.0390, marge=0.0389, décision `None`.
- `decision-pos-equinoxe-q062-vocabulaire_different` — Les personnes ne consommant pas de produits carnés trouveront-elles un repas chaud adapté ? — attendu `equinoxe-q062`, top verifier `equinoxe-q062` score=0.0032, marge=0.0031, décision `None`.

### Faux positifs

- `decision-neg-06-10` — Les prises électriques concernent-elles les vélos ou les voitures ? — attendu `None`, top verifier `equinoxe-q038` score=0.7979, marge=0.7948, décision `equinoxe-q038`.
- `decision-neg-07-07` — Le wifi couvrira-t-il le site et qui sont les ambassadeurs ? — attendu `None`, top verifier `equinoxe-q077` score=0.7136, marge=0.6981, décision `equinoxe-q077`.
- `decision-neg-07-08` — Comment réserver une Project Room et combien de personnes tient-elle ? — attendu `None`, top verifier `equinoxe-q031` score=0.9593, marge=0.5341, décision `equinoxe-q031`.
- `decision-neg-09-10` — Quelle capacité ? — attendu `None`, top verifier `equinoxe-q028` score=0.6478, marge=0.6475, décision `equinoxe-q028`.

### Sur-abstentions

- `decision-pos-equinoxe-q043-paraphrase_naturelle` — Le projet fixe-t-il un nombre minimal de jours sur site ? — attendu `equinoxe-q043`, top verifier `equinoxe-q008` score=0.0029, marge=0.0021, décision `None`.
- `decision-pos-equinoxe-q043-vocabulaire_different` — Faudra-t-il obligatoirement travailler depuis les nouveaux locaux une partie définie de la semaine ? — attendu `equinoxe-q043`, top verifier `equinoxe-q108` score=0.0044, marge=0.0042, décision `None`.
- `decision-pos-equinoxe-q043-adjacentButResolvable` — La conception des espaces entraîne-t-elle une nouvelle obligation de présence ? — attendu `equinoxe-q043`, top verifier `equinoxe-q082` score=0.0005, marge=0.0000, décision `None`.
- `decision-pos-equinoxe-q045-vocabulaire_different` — Quels périphériques seront installés là où nous nous asseyons pour travailler ? — attendu `equinoxe-q045`, top verifier `equinoxe-q025` score=0.0014, marge=0.0012, décision `None`.
- `decision-pos-equinoxe-q047-vocabulaire_different` — Pourrai-je me connecter à Internet sans câble depuis n’importe quel espace ? — attendu `equinoxe-q047`, top verifier `equinoxe-q047` score=0.0037, marge=0.0037, décision `None`.
- `decision-pos-equinoxe-q047-adjacentButResolvable` — La couverture réseau est-elle prévue jusque dans les salles et espaces communs ? — attendu `equinoxe-q047`, top verifier `equinoxe-q047` score=0.5111, marge=0.5108, décision `None`.

## Verdict

Le holdout ne satisfait pas simultanément les critères Liquid Core V0. Aucune architecture n’est recommandée et aucun choix produit n’est forcé.

## Limites

- Le corpus décisionnel est une fixture expérimentale test-only; la taxonomie de gravité n’est pas une politique produit.
- La calibration a comparé deux retrievers, deux verifiers, deux Top-K et deux contrats; le holdout n’a servi qu’au passage final verrouillé.
- Aucun score lexical, seuil produit, `SemanticProvider`, index, branchement Storm Match, Ivory, Studio ou Pilotage n’est inclus.
