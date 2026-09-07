# Storm Match — relevance verifier spike

Ce dossier est une expérience test-only de l’architecture
`retrieve → rerank/verify → abstain`. Il ne contient ni code produit, ni
`SemanticProvider`, ni index, ni connexion PostgreSQL, ni branchement Storm
Match/Ivory/Studio/Pilotage. Aucun score lexical n’entre dans le classement ou
la décision.

## Corpus et séparation

Le corpus officiel de 320 cas reste inchangé et sert à mesurer la régression de
retrieval/reranking. Le fichier `decision-corpus.js` ajoute 200 cas explicites,
sans génération runtime : 100 positifs et 100 négatifs.

- Calibration : 120 cas (60 positifs, 60 négatifs).
- Holdout : 80 cas (40 positifs, 40 négatifs).
- Positifs : 25 questions canoniques, quatre reformulations chacune
  (`paraphrase_naturelle`, `synonymes`, `vocabulaire_different`,
  `adjacentButResolvable`). Les 15 sources de calibration et les 10 sources de
  holdout sont disjointes.
- Négatifs : dix familles de dix cas : hors corpus clair, hard negatives,
  besoins workplace non publiés, collisions lexicales, demandes voisines non
  publiées, ambiguïtés réelles, intentions mixtes, prémisses fausses,
  formulations courtes indécidables et ressemblances fortes non couvertes.

La calibration exporte les 320 cas officiels et seulement les 120 cas
`calibration`. Le holdout est exporté séparément après verrouillage global du
retriever, du Top-K, du verifier, du contrat de paire et des deux seuils. Le
worker final est la seule voie qui accepte cet export et inscrit
`holdoutPasses: 1` dans le résultat. Il est interdit d’ajuster un choix après ce
passage.

Comme le corpus officiel, les `equinoxe-qNNN` sont des IDs synthétiques stables
strictement test-only, jamais des UUID/`entryId` de production.

## Candidats

Retrievers conservés : E5-small et DistilUSE, avec leurs adapters sémantiques
figés. Verifiers exécutés :

- `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1`, révision
  `1427fd652930e4ba29e8149678df786c240d8825`, Apache-2.0, contexte benchmark
  512 tokens ;
- `BAAI/bge-reranker-v2-m3`, révision
  `953dc6f6f85a1b2dbfca4c34a2796e7dde08d41e`, Apache-2.0, contexte benchmark
  1024 tokens (contexte déclaré par le modèle : 8192).

Les deux utilisent leur tête
`XLMRobertaForSequenceClassification` standard via Transformers, en local,
`trust_remote_code=False`, avec `sigmoid(logit)` comme score de pertinence.
MiniLM mMARCO est le candidat léger ; BGE est volontairement conservé comme
comparateur qualité/coût nettement plus lourd.

`Alibaba-NLP/gte-multilingual-reranker-base` a été écarté du run principal car
son chargement exige `trust_remote_code` et du code provenant d’un autre dépôt.
`jinaai/jina-reranker-v2-base-multilingual` a été écarté car sa licence
CC-BY-NC-4.0 ne convient pas à l’usage commercial visé. Cette sélection est une
décision de benchmark, pas un contrat produit.

Deux contrats de paire sont mesurés séparément :

    query × canonical question
    query × (canonical question + canonical answer)

Le Top-K initial reste celui du retriever. Le verifier reranke seulement les
candidats récupérés. La décision accepte le premier candidat si son score et sa
marge sur le second dépassent les seuils calibrés. Les seuils explorés sont
toutes les valeurs qui modifient effectivement une décision de calibration,
plus l’abstention totale ; ils ne sont pas choisis intuitivement.

## Artefacts externes et exécution offline

Les quatre modèles restent hors Git. Chaque chemin est absolu et fourni à la
commande ; aucun chemin machine n’est codé dans le harness. Avant chargement,
les verifiers sont contrôlés contre leur révision épinglée, architecture,
structure, taille exacte des poids, SHA-256 et fingerprint complet. Le runtime
force `HF_HUB_OFFLINE=1`, `TRANSFORMERS_OFFLINE=1` et
`HF_DATASETS_OFFLINE=1`; `local_files_only=True` empêche tout repli réseau.

Exécution complète, depuis la racine du repo, avec un environnement Python CPU
déjà préparé :

```text
python test/storm-match-eval/verifier/benchmark.py \
  --retriever e5-small=/absolute/external/e5-small \
  --retriever distiluse-cased-v2=/absolute/external/distiluse-cased-v2 \
  --verifier mmarco-minilm-l12=/absolute/external/mmarco-minilm \
  --verifier bge-reranker-v2-m3=/absolute/external/bge-reranker-v2-m3 \
  --output test/storm-match-eval/verifier/report-verifier.md \
  --raw-output /absolute/external/verifier-raw.json
```

Le JSON brut est volontairement externe au repo. Un rapport peut être rendu de
nouveau sans inférence avec `--from-raw /absolute/external/verifier-raw.json`.

## Lecture des résultats

`retrievalMiss` signifie que l’attendu n’est pas dans le Top-K. Une
`verifierError` n’existe que lorsque l’attendu était récupéré mais que le
verifier ne le classe pas premier. Une abstention sur un positif est une
sur-abstention. Les faux positifs négatifs reprennent la gravité explicite de la
fixture (`weak`, `medium`, `dangerous`).

Le rapport mesuré est un résultat expérimental négatif : aucune des 16
architectures de calibration ne satisfait les critères V0 et la configuration
de sécurité retenue pour le passage holdout échoue également. Elle ne doit pas
être intégrée au produit ni présentée comme une recommandation.
