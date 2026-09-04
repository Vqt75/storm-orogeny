# Storm Match — benchmark hybride V0

- Corpus officiel : `55f5df84538e53a21f3c9fa3c2363587fb1e80d39ec5ff8288e1796a3f0559f1`
- Questions canoniques : 112
- Cas : 320, dont 290 résolubles, 10 `trueAmbiguous` et 20 hors corpus
- Score sémantique : cosinus borné à `[0,1]` pour le mélange
- Score lexical : vrai `scoreEntry()` normalisé par `clamp(score / 28, 0, 1)`
- Soutien lexical moyen : `18/28 = 0.642857` (seuil existant, non calibré)
- Modèles hybrides mesurés : 2/2
- Exécution : CPU, Hugging Face / Transformers offline

## Règle du Confidence Gate testée

Le classement porte sur `W_sem × semantic + W_lex × lexical`, avec `W_sem + W_lex = 1`. Le candidat Top-1 est accepté si son plancher sémantique et sa marge sont satisfaits, puis soit son score hybride atteint le seuil haut (lexical optionnel), soit il atteint le seuil moyen avec le soutien lexical existant. Dans tous les autres cas, le matcher s'abstient.

Un faux positif est `dangerous` s'il passe la voie haute ou si son score lexical brut atteint 28 ; il est `medium` s'il passe la voie moyenne avec soutien lexical, sinon `weak`.

## Espace de calibration systématique

- `W_sem` : 0.500 à 0.950 par pas de 0.050 ; `W_lex = 1 - W_sem` (les deux signaux restent non nuls)
- seuil haut : 0.500 à 0.950 par pas de 0.050
- seuil moyen : 0.300 à 0.850 par pas de 0.050, strictement inférieur au seuil haut
- marge : 0.005 à 0.150 par pas de 0.005
- plancher sémantique : absent, ou 0.300 à 0.850 par pas de 0.050
- configurations prévues par modèle : 327 600

Admissibilité : zéro acceptation dangereuse parmi les 30 cas à attendu nul et au plus 3 faux positifs hors corpus. Le filtre V0 ajoute Top-1 ≥ 218/290, paraphrase ≥ 23/30, `differentVocab` ≥ 15/30 et abstention sur 10/10 `trueAmbiguous`.

## Meilleures configurations admissibles

| paramètre | E5-small | DistilUSE |
|---|---:|---:|
| W_sem | 0.800 | 0.850 |
| W_lex | 0.200 | 0.150 |
| Seuil haut | 0.500 | 0.800 |
| Seuil moyen | 0.300 | 0.300 |
| Seuil marge | 0.080 | 0.025 |
| Plancher sémantique | aucun | aucun |

## Comparaison heuristique / sémantique / hybride

| métrique | Heuristique | E5 sémantique | E5 hybride | DistilUSE sémantique | DistilUSE hybride |
|---|---:|---:|---:|---:|---:|
| Top-1 résoluble | 132/290 (45.5%) | 218/290 (75.2%) | 88/290 (30.3%) | 221/290 (76.2%) | 88/290 (30.3%) |
| Top-3 diagnostic | 217/290 (74.8%) | 254/290 (87.6%) | 241/290 (83.1%) | 256/290 (88.3%) | 259/290 (89.3%) |
| TrueAmbiguous abstentions | 1/10 (10.0%) | n/a | 10/10 (100.0%) | n/a | 7/10 (70.0%) |
| Hors corpus abstentions | 16/20 (80.0%) | n/a | 20/20 (100.0%) | n/a | 20/20 (100.0%) |
| Hors corpus faux positifs | 4/20 (20.0%) | n/a | 0/20 (0.0%) | n/a | 0/20 (0.0%) |
| Sur-abstentions | 114 | 0 (pas de gate) | 200 | 0 (pas de gate) | 199 |

## Résultats Top-1 / Top-3 par catégorie

| catégorie | Heuristique | E5 sémantique | E5 hybride | DistilUSE sémantique | DistilUSE hybride |
|---|---:|---:|---:|---:|---:|
| `quasi_identique` | 30/30 · 30/30 | 30/30 · 30/30 | 29/30 · 30/30 | 30/30 · 30/30 | 30/30 · 30/30 |
| `paraphrase_naturelle` | 8/30 · 19/30 | 21/30 · 26/30 | 3/30 · 24/30 | 24/30 · 27/30 | 2/30 · 28/30 |
| `conversationnel` | 11/30 · 19/30 | 19/30 · 26/30 | 0/30 · 23/30 | 19/30 · 25/30 | 4/30 · 25/30 |
| `formulation_courte` | 11/30 · 27/30 | 25/30 · 28/30 | 9/30 · 28/30 | 23/30 · 27/30 | 6/30 · 27/30 |
| `synonymes` | 4/30 · 17/30 | 18/30 · 22/30 | 1/30 · 22/30 | 19/30 · 26/30 | 3/30 · 26/30 |
| `vocabulaire_different` | 1/30 · 8/30 | 9/30 · 15/30 | 0/30 · 10/30 | 13/30 · 17/30 | 0/30 · 17/30 |
| `syntaxe_imparfaite` | 22/30 · 27/30 | 29/30 · 30/30 | 14/30 · 29/30 | 29/30 · 30/30 | 13/30 · 30/30 |
| `faute_de_frappe` | 21/30 · 27/30 | 28/30 · 30/30 | 15/30 · 30/30 | 26/30 · 29/30 | 15/30 · 29/30 |
| `mots_cles_seuls` | 17/30 · 25/30 | 27/30 · 29/30 | 11/30 · 26/30 | 26/30 · 30/30 | 9/30 · 30/30 |
| `ambiguite_adjacent` | 7/20 · 18/20 | 12/20 · 18/20 | 6/20 · 19/20 | 12/20 · 15/20 | 6/20 · 17/20 |

## Calibration et erreurs

| mesure | E5 hybride | DistilUSE hybride |
|---|---:|---:|
| Configurations évaluées | 327600 | 327600 |
| Configurations admissibles | 216398 | 189720 |
| Configurations satisfaisant tous les critères V0 | 0 | 0 |
| Échecs heuristiques corrigés | 5 | 5 |
| Nouvelles erreurs vs heuristique | 49 | 49 |
| Matches résolubles erronés | 2 | 3 |
| Faux positifs faibles | 0 | 0 |
| Faux positifs moyens | 0 | 0 |
| Faux positifs dangereux | 0 | 0 |

## Exemples — intfloat/multilingual-e5-small

Configuration conforme à tous les critères V0 : **non**.

### Échecs heuristiques corrigés

- `equinoxe-q003-mots_cles_seuls` — calendrier changement — expected `equinoxe-q003`, outcome `matched`, actual `equinoxe-q003`, top1 `equinoxe-q003` hybrid=0.7594 semantic=0.8957 lexical=0.2143, margin=0.0852, gate=high.
- `equinoxe-q025-faute_de_frappe` — Ou travaller au calme ? — expected `equinoxe-q025`, outcome `matched`, actual `equinoxe-q025`, top1 `equinoxe-q025` hybrid=0.7889 semantic=0.9325 lexical=0.2143, margin=0.0845, gate=high.
- `equinoxe-q047-faute_de_frappe` — Y aura-t-il du wfi partout ? — expected `equinoxe-q047`, outcome `matched`, actual `equinoxe-q047`, top1 `equinoxe-q047` hybrid=0.7744 semantic=0.9145 lexical=0.2143, margin=0.0855, gate=high.
- `equinoxe-q062-formulation_courte` — Option végétarienne ? — expected `equinoxe-q062`, outcome `matched`, actual `equinoxe-q062`, top1 `equinoxe-q062` hybrid=0.7906 semantic=0.9347 lexical=0.2143, margin=0.1002, gate=high.
- `equinoxe-q062-faute_de_frappe` — Y aura-t-il une offre végétariene ? — expected `equinoxe-q062`, outcome `matched`, actual `equinoxe-q062`, top1 `equinoxe-q062` hybrid=0.8087 semantic=0.9573 lexical=0.2143, margin=0.1079, gate=high.

### Nouvelles erreurs introduites

- `equinoxe-q003-conversationnel` — On est sûrs du planning ou ça peut encore changer ? — expected `equinoxe-q003`, outcome `abstained`, actual `None`, top1 `equinoxe-q003` hybrid=0.8588 semantic=0.9128 lexical=0.6429, margin=0.0568, gate=None.
- `equinoxe-q005-paraphrase_naturelle` — Des visites du site sont-elles prévues avant notre arrivée ? — expected `equinoxe-q005`, outcome `abstained`, actual `None`, top1 `equinoxe-q005` hybrid=0.7875 semantic=0.8772 lexical=0.4286, margin=0.0459, gate=None.
- `equinoxe-q005-conversationnel` — On pourra aller voir Cobalt avant de s’installer ? — expected `equinoxe-q005`, outcome `abstained`, actual `None`, top1 `equinoxe-q005` hybrid=0.8126 semantic=0.9086 lexical=0.4286, margin=0.0632, gate=None.
- `equinoxe-q005-formulation_courte` — Visite avant déménagement ? — expected `equinoxe-q005`, outcome `abstained`, actual `None`, top1 `equinoxe-q005` hybrid=0.8622 semantic=0.9170 lexical=0.6429, margin=0.0575, gate=None.
- `equinoxe-q005-synonymes` — Peut-on découvrir les nouveaux locaux avant le transfert ? — expected `equinoxe-q005`, outcome `abstained`, actual `None`, top1 `equinoxe-q005` hybrid=0.7829 semantic=0.8715 lexical=0.4286, margin=0.0114, gate=None.
- `equinoxe-q005-faute_de_frappe` — Peut-on vistier Cobalt avant ? — expected `equinoxe-q005`, outcome `abstained`, actual `None`, top1 `equinoxe-q005` hybrid=0.8088 semantic=0.9038 lexical=0.4286, margin=0.0677, gate=None.
- `equinoxe-q010-conversationnel` — J’aurai ma place à moi au bureau ? — expected `equinoxe-q010`, outcome `abstained`, actual `None`, top1 `equinoxe-q010` hybrid=0.8022 semantic=0.8957 lexical=0.4286, margin=0.0595, gate=None.
- `equinoxe-q010-mots_cles_seuls` — bureau attitré — expected `equinoxe-q010`, outcome `abstained`, actual `None`, top1 `equinoxe-q010` hybrid=0.9059 semantic=0.8913 lexical=0.9643, margin=0.0391, gate=None.

### Sur-abstentions représentatives

- `equinoxe-q019-formulation_courte` — Réserver une salle ? — expected `equinoxe-q019`, outcome `abstained`, actual `None`, top1 `equinoxe-q053` hybrid=0.9161 semantic=0.9041 lexical=0.9643, margin=0.0178, gate=None.
- `equinoxe-q010-mots_cles_seuls` — bureau attitré — expected `equinoxe-q010`, outcome `abstained`, actual `None`, top1 `equinoxe-q010` hybrid=0.9059 semantic=0.8913 lexical=0.9643, margin=0.0391, gate=None.
- `equinoxe-q045-ambiguite_adjacent` — Le matériel fourni comprend-il les écrans partagés entre postes ? — expected `equinoxe-q049`, outcome `abstained`, actual `None`, top1 `equinoxe-q049` hybrid=0.8962 semantic=0.9060 lexical=0.8571, margin=0.0420, gate=None.
- `equinoxe-q011-syntaxe_imparfaite` — flex office ça veut dire quoi — expected `equinoxe-q011`, outcome `abstained`, actual `None`, top1 `equinoxe-q016` hybrid=0.8933 semantic=0.9023 lexical=0.8571, margin=0.0709, gate=None.
- `equinoxe-q022-faute_de_frappe` — Peut-on résrever une Project Room ? — expected `equinoxe-q022`, outcome `abstained`, actual `None`, top1 `equinoxe-q090` hybrid=0.8847 semantic=0.9452 lexical=0.6429, margin=0.0040, gate=None.
- `equinoxe-q043-syntaxe_imparfaite` — Cobalt imposer présence minimum ou pas — expected `equinoxe-q043`, outcome `abstained`, actual `None`, top1 `equinoxe-q043` hybrid=0.8799 semantic=0.9391 lexical=0.6429, margin=0.0775, gate=None.
- `equinoxe-q022-formulation_courte` — Réservation Project Room ? — expected `equinoxe-q022`, outcome `abstained`, actual `None`, top1 `equinoxe-q090` hybrid=0.8708 semantic=0.9278 lexical=0.6429, margin=0.0445, gate=None.
- `equinoxe-q022-syntaxe_imparfaite` — project room réserver avant possible — expected `equinoxe-q022`, outcome `abstained`, actual `None`, top1 `equinoxe-q022` hybrid=0.8660 semantic=0.9218 lexical=0.6429, margin=0.0695, gate=None.

### Faux positifs hors corpus

- Aucun.

### Cas trueAmbiguous

- `equinoxe-q001-ambiguite_adjacent` — Quand commence-t-on à préparer puis à déménager ? — expected `None`, outcome `abstained`, actual `None`, top1 `equinoxe-q007` hybrid=0.8002 semantic=0.8931 lexical=0.4286, margin=0.0211, gate=None.
- `equinoxe-q010-ambiguite_adjacent` — Aurai-je mon bureau ou seulement un casier personnel ? — expected `None`, outcome `abstained`, actual `None`, top1 `equinoxe-q035` hybrid=0.8520 semantic=0.9043 lexical=0.6429, margin=0.0572, gate=None.
- `equinoxe-q028-ambiguite_adjacent` — La capacité des salles est-elle comparable à celle des Project Rooms ? — expected `None`, outcome `abstained`, actual `None`, top1 `equinoxe-q028` hybrid=0.8386 semantic=0.8875 lexical=0.6429, margin=0.0528, gate=None.
- `equinoxe-q034-ambiguite_adjacent` — Le nombre de places vélos inclut-il les emplacements avec recharge ? — expected `None`, outcome `abstained`, actual `None`, top1 `equinoxe-q034` hybrid=0.8011 semantic=0.8942 lexical=0.4286, margin=0.0023, gate=None.
- `equinoxe-q038-ambiguite_adjacent` — Les prises vélo sont-elles les mêmes que les bornes pour voitures électriques ? — expected `None`, outcome `abstained`, actual `None`, top1 `equinoxe-q100` hybrid=0.8443 semantic=0.8947 lexical=0.6429, margin=0.0395, gate=None.
- `equinoxe-q040-ambiguite_adjacent` — Le télétravail change-t-il avec une présence minimale à Cobalt ? — expected `None`, outcome `abstained`, actual `None`, top1 `equinoxe-q043` hybrid=0.8502 semantic=0.9021 lexical=0.6429, margin=0.0609, gate=None.
- `equinoxe-q054-ambiguite_adjacent` — Pour accéder à Cobalt, le RER est-il plus simple que le bus ? — expected `None`, outcome `abstained`, actual `None`, top1 `equinoxe-q054` hybrid=0.8411 semantic=0.8907 lexical=0.6429, margin=0.0642, gate=None.
- `equinoxe-q062-ambiguite_adjacent` — L’offre végétarienne changera-t-elle chaque jour avec le menu ? — expected `None`, outcome `abstained`, actual `None`, top1 `equinoxe-q103` hybrid=0.8472 semantic=0.8982 lexical=0.6429, margin=0.0537, gate=None.


## Exemples — sentence-transformers/distiluse-base-multilingual-cased-v2

Configuration conforme à tous les critères V0 : **non**.

### Échecs heuristiques corrigés

- `equinoxe-q011-faute_de_frappe` — C’est quoi le flex ofice ? — expected `equinoxe-q011`, outcome `matched`, actual `equinoxe-q011`, top1 `equinoxe-q011` hybrid=0.8263 semantic=0.9343 lexical=0.2143, margin=0.3684, gate=high.
- `equinoxe-q030-faute_de_frappe` — Y aura-t-il un espace pour se détandre ? — expected `equinoxe-q030`, outcome `matched`, actual `equinoxe-q030`, top1 `equinoxe-q030` hybrid=0.8111 semantic=0.9165 lexical=0.2143, margin=0.1694, gate=high.
- `equinoxe-q034-synonymes` — Combien d’emplacements pour bicyclettes ? — expected `equinoxe-q034`, outcome `matched`, actual `equinoxe-q034`, top1 `equinoxe-q034` hybrid=0.8220 semantic=0.9293 lexical=0.2143, margin=0.2671, gate=high.
- `equinoxe-q045-ambiguite_adjacent` — Le matériel fourni comprend-il les écrans partagés entre postes ? — expected `equinoxe-q049`, outcome `matched`, actual `equinoxe-q049`, top1 `equinoxe-q049` hybrid=0.7949 semantic=0.7840 lexical=0.8571, margin=0.3525, gate=mediumLexical.
- `equinoxe-q062-faute_de_frappe` — Y aura-t-il une offre végétariene ? — expected `equinoxe-q062`, outcome `matched`, actual `equinoxe-q062`, top1 `equinoxe-q062` hybrid=0.8799 semantic=0.9974 lexical=0.2143, margin=0.3712, gate=high.

### Nouvelles erreurs introduites

- `equinoxe-q003-conversationnel` — On est sûrs du planning ou ça peut encore changer ? — expected `equinoxe-q003`, outcome `abstained`, actual `None`, top1 `equinoxe-q111` hybrid=0.6474 semantic=0.6860 lexical=0.4286, margin=0.0121, gate=None.
- `equinoxe-q003-faute_de_frappe` — Le calandrier peut-il changer ? — expected `equinoxe-q003`, outcome `abstained`, actual `None`, top1 `equinoxe-q003` hybrid=0.6594 semantic=0.7001 lexical=0.4286, margin=0.1769, gate=None.
- `equinoxe-q003-ambiguite_adjacent` — Les dates des visites peuvent-elles encore changer ? — expected `equinoxe-q003`, outcome `abstained`, actual `None`, top1 `equinoxe-q003` hybrid=0.7590 semantic=0.8173 lexical=0.4286, margin=0.3017, gate=None.
- `equinoxe-q005-paraphrase_naturelle` — Des visites du site sont-elles prévues avant notre arrivée ? — expected `equinoxe-q005`, outcome `abstained`, actual `None`, top1 `equinoxe-q005` hybrid=0.4406 semantic=0.4428 lexical=0.4286, margin=0.0086, gate=None.
- `equinoxe-q005-synonymes` — Peut-on découvrir les nouveaux locaux avant le transfert ? — expected `equinoxe-q005`, outcome `abstained`, actual `None`, top1 `equinoxe-q078` hybrid=0.5191 semantic=0.5729 lexical=0.2143, margin=0.0087, gate=None.
- `equinoxe-q005-faute_de_frappe` — Peut-on vistier Cobalt avant ? — expected `equinoxe-q005`, outcome `abstained`, actual `None`, top1 `equinoxe-q005` hybrid=0.7626 semantic=0.8215 lexical=0.4286, margin=0.1674, gate=None.
- `equinoxe-q010-faute_de_frappe` — Aurai-je un burreau attitré ? — expected `equinoxe-q010`, outcome `abstained`, actual `None`, top1 `equinoxe-q010` hybrid=0.6820 semantic=0.7267 lexical=0.4286, margin=0.0194, gate=None.
- `equinoxe-q011-paraphrase_naturelle` — Pouvez-vous expliquer précisément le fonctionnement du flex office ? — expected `equinoxe-q011`, outcome `abstained`, actual `None`, top1 `equinoxe-q011` hybrid=0.7160 semantic=0.7668 lexical=0.4286, margin=0.1076, gate=None.

### Sur-abstentions représentatives

- `equinoxe-q034-conversationnel` — On pourra garer combien de vélos ? — expected `equinoxe-q034`, outcome `abstained`, actual `None`, top1 `equinoxe-q034` hybrid=0.7958 semantic=0.8606 lexical=0.4286, margin=0.1754, gate=None.
- `equinoxe-q043-faute_de_frappe` — Cobalt impose une présance minimale ? — expected `equinoxe-q043`, outcome `abstained`, actual `None`, top1 `equinoxe-q043` hybrid=0.7894 semantic=0.8531 lexical=0.4286, margin=0.2712, gate=None.
- `equinoxe-q013-formulation_courte` — Définition quartier d’équipe ? — expected `equinoxe-q013`, outcome `abstained`, actual `None`, top1 `equinoxe-q013` hybrid=0.7886 semantic=0.8522 lexical=0.4286, margin=0.1602, gate=None.
- `equinoxe-q019-syntaxe_imparfaite` — comment réserver salle réunion — expected `equinoxe-q019`, outcome `abstained`, actual `None`, top1 `equinoxe-q019` hybrid=0.7882 semantic=0.8517 lexical=0.4286, margin=0.1847, gate=None.
- `equinoxe-q022-conversationnel` — Je peux booker une Project Room pour demain ? — expected `equinoxe-q022`, outcome `abstained`, actual `None`, top1 `equinoxe-q022` hybrid=0.7813 semantic=0.8435 lexical=0.4286, margin=0.0867, gate=None.
- `equinoxe-q038-conversationnel` — Je peux brancher mon vélo électrique sur place ? — expected `equinoxe-q038`, outcome `abstained`, actual `None`, top1 `equinoxe-q073` hybrid=0.7805 semantic=0.8426 lexical=0.4286, margin=0.0869, gate=None.
- `equinoxe-q050-paraphrase_naturelle` — Comment préserver des échanges confidentiels en espace ouvert ? — expected `equinoxe-q050`, outcome `abstained`, actual `None`, top1 `equinoxe-q050` hybrid=0.7750 semantic=0.9118 lexical=0.0000, margin=0.3054, gate=None.
- `equinoxe-q020-conversationnel` — Je dois booker avant de m’installer à la Bibliothèque ? — expected `equinoxe-q020`, outcome `abstained`, actual `None`, top1 `equinoxe-q020` hybrid=0.7688 semantic=0.8667 lexical=0.2143, margin=0.2645, gate=None.

### Faux positifs hors corpus

- Aucun.

### Cas trueAmbiguous

- `equinoxe-q001-ambiguite_adjacent` — Quand commence-t-on à préparer puis à déménager ? — expected `None`, outcome `abstained`, actual `None`, top1 `equinoxe-q007` hybrid=0.6714 semantic=0.7142 lexical=0.4286, margin=0.0219, gate=None.
- `equinoxe-q010-ambiguite_adjacent` — Aurai-je mon bureau ou seulement un casier personnel ? — expected `None`, outcome `matched`, actual `equinoxe-q035`, top1 `equinoxe-q035` hybrid=0.7056 semantic=0.7167 lexical=0.6429, margin=0.0692, gate=mediumLexical.
- `equinoxe-q028-ambiguite_adjacent` — La capacité des salles est-elle comparable à celle des Project Rooms ? — expected `None`, outcome `abstained`, actual `None`, top1 `equinoxe-q052` hybrid=0.7001 semantic=0.7480 lexical=0.4286, margin=0.0781, gate=None.
- `equinoxe-q034-ambiguite_adjacent` — Le nombre de places vélos inclut-il les emplacements avec recharge ? — expected `None`, outcome `abstained`, actual `None`, top1 `equinoxe-q034` hybrid=0.7092 semantic=0.7587 lexical=0.4286, margin=0.0060, gate=None.
- `equinoxe-q038-ambiguite_adjacent` — Les prises vélo sont-elles les mêmes que les bornes pour voitures électriques ? — expected `None`, outcome `abstained`, actual `None`, top1 `equinoxe-q038` hybrid=0.7148 semantic=0.7653 lexical=0.4286, margin=0.0424, gate=None.
- `equinoxe-q040-ambiguite_adjacent` — Le télétravail change-t-il avec une présence minimale à Cobalt ? — expected `None`, outcome `matched`, actual `equinoxe-q043`, top1 `equinoxe-q043` hybrid=0.7927 semantic=0.8192 lexical=0.6429, margin=0.1985, gate=mediumLexical.
- `equinoxe-q054-ambiguite_adjacent` — Pour accéder à Cobalt, le RER est-il plus simple que le bus ? — expected `None`, outcome `abstained`, actual `None`, top1 `equinoxe-q054` hybrid=0.5822 semantic=0.5715 lexical=0.6429, margin=0.0052, gate=None.
- `equinoxe-q062-ambiguite_adjacent` — L’offre végétarienne changera-t-elle chaque jour avec le menu ? — expected `None`, outcome `abstained`, actual `None`, top1 `equinoxe-q062` hybrid=0.7045 semantic=0.7532 lexical=0.4286, margin=0.0131, gate=None.

## Verdict V0

Aucune configuration ne satisfait simultanément tous les critères V0. Aucun choix n'est forcé.

## Limites

- Calibration et mesure utilisent le même corpus officiel : ces résultats mesurent l'aptitude sur la baseline, pas la généralisation hors échantillon.
- La gravité est une taxonomie benchmark explicite, pas encore une politique produit.
- Aucun `SemanticProvider`, index, branchement Ivory ou modification du moteur produit n'est inclus.
