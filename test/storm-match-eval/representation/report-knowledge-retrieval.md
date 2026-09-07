# Storm Match — knowledge representation retrieval

- Corpus officiel : `55f5df84538e53a21f3c9fa3c2363587fb1e80d39ec5ff8288e1796a3f0559f1` — 290 cas résolubles.
- Decision Corpus : `7965afbd8fe9d63bffc27dd3f59b87733a24e302f75ab36e56dc3a6bce61f35f` — 100 positifs, sans négatifs ni décision d’abstention.
- Sous-ensemble diagnostique : les 16 `retrievalMisses` Top-3 du holdout verifier précédent.
- Retrieval sémantique pur : aucun verifier, score lexical, seuil ou gate.
- Modèles : snapshots locaux épinglés E5-small et DistilUSE; CPU; Transformers/Hugging Face offline.

## Représentations

- `question` : un vecteur par question canonique.
- `answer` : un vecteur par réponse canonique.
- `questionAnswer` : un vecteur par concaténation libellée de la question et de la réponse.
- `multi` : trois vecteurs par entrée (Q, A, Q+A); score d’entrée = maximum des trois similarités, puis déduplication par `entryId`.

## Corpus officiel

| modèle | représentation | Recall@1 | Recall@3 | Recall@5 |
|---|---|---:|---:|---:|
| `e5-small` | Question | 218/290 (75.2%) | 254/290 (87.6%) | 264/290 (91.0%) |
| `e5-small` | Réponse | 91/290 (31.4%) | 144/290 (49.7%) | 168/290 (57.9%) |
| `e5-small` | Question + réponse | 207/290 (71.4%) | 257/290 (88.6%) | 267/290 (92.1%) |
| `e5-small` | Multi-représentation (max Q/A/Q+A) | 215/290 (74.1%) | 259/290 (89.3%) | 268/290 (92.4%) |
| `distiluse-cased-v2` | Question | 221/290 (76.2%) | 256/290 (88.3%) | 266/290 (91.7%) |
| `distiluse-cased-v2` | Réponse | 84/290 (29.0%) | 152/290 (52.4%) | 181/290 (62.4%) |
| `distiluse-cased-v2` | Question + réponse | 203/290 (70.0%) | 250/290 (86.2%) | 265/290 (91.4%) |
| `distiluse-cased-v2` | Multi-représentation (max Q/A/Q+A) | 219/290 (75.5%) | 257/290 (88.6%) | 269/290 (92.8%) |

### Catégories officielles — Recall@1 / @3 / @5

| catégorie | e5-small/question | e5-small/answer | e5-small/questionAnswer | e5-small/multi | distiluse-cased-v2/question | distiluse-cased-v2/answer | distiluse-cased-v2/questionAnswer | distiluse-cased-v2/multi |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `quasi_identique` | 30/30/30 (30) | 13/17/21 (30) | 29/30/30 (30) | 30/30/30 (30) | 30/30/30 (30) | 13/19/20 (30) | 30/30/30 (30) | 30/30/30 (30) |
| `paraphrase_naturelle` | 21/26/29 (30) | 10/15/16 (30) | 20/27/29 (30) | 21/27/29 (30) | 24/27/30 (30) | 11/16/19 (30) | 21/24/27 (30) | 24/27/30 (30) |
| `conversationnel` | 19/26/27 (30) | 7/12/14 (30) | 18/25/27 (30) | 20/26/27 (30) | 19/25/26 (30) | 8/11/14 (30) | 20/23/25 (30) | 19/25/26 (30) |
| `formulation_courte` | 25/28/29 (30) | 7/13/16 (30) | 22/28/28 (30) | 25/28/29 (30) | 23/27/27 (30) | 5/11/17 (30) | 19/24/26 (30) | 23/27/27 (30) |
| `synonymes` | 18/22/25 (30) | 7/15/19 (30) | 15/25/26 (30) | 18/23/25 (30) | 19/26/27 (30) | 8/16/19 (30) | 17/25/27 (30) | 19/26/28 (30) |
| `vocabulaire_different` | 9/15/17 (30) | 5/11/13 (30) | 8/16/19 (30) | 7/18/19 (30) | 13/17/19 (30) | 5/14/18 (30) | 15/18/20 (30) | 13/17/19 (30) |
| `syntaxe_imparfaite` | 29/30/30 (30) | 13/16/18 (30) | 28/30/30 (30) | 29/30/30 (30) | 29/30/30 (30) | 11/17/18 (30) | 26/30/30 (30) | 29/30/30 (30) |
| `faute_de_frappe` | 28/30/30 (30) | 11/17/19 (30) | 29/30/30 (30) | 28/30/30 (30) | 26/29/30 (30) | 5/15/20 (30) | 23/30/30 (30) | 26/29/30 (30) |
| `mots_cles_seuls` | 27/29/29 (30) | 12/16/20 (30) | 23/28/29 (30) | 24/28/29 (30) | 26/30/30 (30) | 9/19/20 (30) | 21/28/30 (30) | 25/30/30 (30) |
| `ambiguite_adjacent` | 12/18/18 (20) | 6/12/12 (20) | 15/18/19 (20) | 13/19/20 (20) | 12/15/17 (20) | 9/14/16 (20) | 11/18/20 (20) | 11/16/19 (20) |

## Decision Corpus — 100 positifs

| modèle | représentation | Recall@1 | Recall@3 | Recall@5 |
|---|---|---:|---:|---:|
| `e5-small` | Question | 53/100 (53.0%) | 69/100 (69.0%) | 73/100 (73.0%) |
| `e5-small` | Réponse | 32/100 (32.0%) | 56/100 (56.0%) | 66/100 (66.0%) |
| `e5-small` | Question + réponse | 50/100 (50.0%) | 80/100 (80.0%) | 82/100 (82.0%) |
| `e5-small` | Multi-représentation (max Q/A/Q+A) | 56/100 (56.0%) | 77/100 (77.0%) | 81/100 (81.0%) |
| `distiluse-cased-v2` | Question | 50/100 (50.0%) | 66/100 (66.0%) | 75/100 (75.0%) |
| `distiluse-cased-v2` | Réponse | 41/100 (41.0%) | 60/100 (60.0%) | 66/100 (66.0%) |
| `distiluse-cased-v2` | Question + réponse | 53/100 (53.0%) | 82/100 (82.0%) | 85/100 (85.0%) |
| `distiluse-cased-v2` | Multi-représentation (max Q/A/Q+A) | 54/100 (54.0%) | 73/100 (73.0%) | 81/100 (81.0%) |

### Catégories décisionnelles — Recall@1 / @3 / @5

| catégorie | e5-small/question | e5-small/answer | e5-small/questionAnswer | e5-small/multi | distiluse-cased-v2/question | distiluse-cased-v2/answer | distiluse-cased-v2/questionAnswer | distiluse-cased-v2/multi |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `paraphrase_naturelle` | 21/22/23 (25) | 9/12/15 (25) | 17/22/23 (25) | 19/23/24 (25) | 22/23/24 (25) | 11/14/15 (25) | 18/21/22 (25) | 22/23/24 (25) |
| `synonymes` | 14/17/18 (25) | 6/13/17 (25) | 10/21/21 (25) | 13/18/19 (25) | 14/20/22 (25) | 8/13/16 (25) | 13/23/24 (25) | 14/20/22 (25) |
| `vocabulaire_different` | 7/12/13 (25) | 7/11/13 (25) | 8/13/14 (25) | 9/14/15 (25) | 7/10/13 (25) | 8/11/13 (25) | 9/14/14 (25) | 8/12/15 (25) |
| `adjacentButResolvable` | 11/18/19 (25) | 10/20/21 (25) | 15/24/24 (25) | 15/22/23 (25) | 7/13/16 (25) | 14/22/22 (25) | 13/24/25 (25) | 10/18/20 (25) |

## Les 16 misses du holdout précédent

| modèle | représentation | Recall@1 | Recall@3 | Recall@5 |
|---|---|---:|---:|---:|
| `e5-small` | Question | 3/16 (18.8%) | 6/16 (37.5%) | 8/16 (50.0%) |
| `e5-small` | Réponse | 3/16 (18.8%) | 9/16 (56.2%) | 9/16 (56.2%) |
| `e5-small` | Question + réponse | 6/16 (37.5%) | 10/16 (62.5%) | 10/16 (62.5%) |
| `e5-small` | Multi-représentation (max Q/A/Q+A) | 5/16 (31.2%) | 9/16 (56.2%) | 11/16 (68.8%) |
| `distiluse-cased-v2` | Question | 0/16 (0.0%) | 0/16 (0.0%) | 5/16 (31.2%) |
| `distiluse-cased-v2` | Réponse | 5/16 (31.2%) | 9/16 (56.2%) | 9/16 (56.2%) |
| `distiluse-cased-v2` | Question + réponse | 3/16 (18.8%) | 10/16 (62.5%) | 11/16 (68.8%) |
| `distiluse-cased-v2` | Multi-représentation (max Q/A/Q+A) | 3/16 (18.8%) | 5/16 (31.2%) | 8/16 (50.0%) |

### Misses récupérés par la multi-représentation


#### e5-small

- `decision-pos-equinoxe-q045-adjacentButResolvable` — attendu `equinoxe-q045`, rang multi 1 — Les écrans et équipements standards seront-ils fournis sur les postes partagés ?
- `decision-pos-equinoxe-q050-adjacentButResolvable` — attendu `equinoxe-q050`, rang multi 1 — Les salles et bulles sont-elles prévues pour protéger les échanges confidentiels ?
- `decision-pos-equinoxe-q054-adjacentButResolvable` — attendu `equinoxe-q054`, rang multi 3 — Les détails d’accès par métro et RER seront-ils communiqués avant l’emménagement ?

#### distiluse-cased-v2

- `decision-pos-equinoxe-q045-adjacentButResolvable` — attendu `equinoxe-q045`, rang multi 2 — Les écrans et équipements standards seront-ils fournis sur les postes partagés ?
- `decision-pos-equinoxe-q050-adjacentButResolvable` — attendu `equinoxe-q050`, rang multi 1 — Les salles et bulles sont-elles prévues pour protéger les échanges confidentiels ?
- `decision-pos-equinoxe-q054-adjacentButResolvable` — attendu `equinoxe-q054`, rang multi 1 — Les détails d’accès par métro et RER seront-ils communiqués avant l’emménagement ?
- `decision-pos-equinoxe-q066-vocabulaire_different` — attendu `equinoxe-q066`, rang multi 1 — Quel circuit utiliser si mon état de santé nécessite un équipement particulier pour travailler ?
- `decision-pos-equinoxe-q066-adjacentButResolvable` — attendu `equinoxe-q066`, rang multi 3 — Une adaptation de poste doit-elle passer par les interlocuteurs RH et santé habituels ?

## Coût de vectorisation

| modèle | chargement | 390 requêtes | 112 Q | 112 A | 112 Q+A | RAM chargée |
|---|---:|---:|---:|---:|---:|---:|
| `e5-small` | 13418.9 ms | 3238.3 ms | 740.8 ms | 993.6 ms | 1712.9 ms | 704.83 MiB |
| `distiluse-cased-v2` | 10510.3 ms | 5180.3 ms | 1818.0 ms | 2486.3 ms | 4497.2 ms | 424.33 MiB |

## Conclusions de l’expérience A

- E5 Decision positif : question 69/100 (69.0%) à R@3; multi 77/100 (77.0%).
- DistilUSE Decision positif : question 66/100 (66.0%) à R@3; multi 73/100 (73.0%).
- La concaténation Q+A est la meilleure représentation sur les 100 positifs : E5 80/100 et DistilUSE 82/100 à R@3. Elle récupère 10/16 anciens misses pour chacun des deux modèles.
- Le `max(Q,A,Q+A)` naïf améliore légèrement le corpus officiel à R@3/R@5, mais reste inférieur à Q+A sur les positifs décisionnels et sur les 16 misses. Multiplier les représentations sans calibrer leur fusion crée donc aussi du bruit.
- La réponse seule est insuffisante comme index principal. Son gain ponctuel confirme néanmoins que la réponse publiée contient un signal absent de certaines questions canoniques.
- Le meilleur choix de représentation doit être lu comme un résultat de retrieval seulement : cette expérience ne mesure aucune capacité d’abstention.
- Les résultats ne modifient ni le corpus officiel, ni la baseline, ni le code produit.
