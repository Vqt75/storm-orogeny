# Storm Match — benchmark sémantique pur V0

- Commit de la baseline heuristique : `fae81cb674595729f41cc550d58f6ee6d97583c4`
- Corpus officiel : `55f5df84538e53a21f3c9fa3c2363587fb1e80d39ec5ff8288e1796a3f0559f1`
- Questions canoniques : 112
- Cas officiels : 320, dont 290 résolubles, 10 trueAmbiguous et 20 hors corpus
- Retrieval : similarité cosinus sur les seules questions canoniques
- Abstention : non évaluée ; chaque embedding retourne toujours un voisin
- Score lexical/hybride : absent
- Modèles mesurés : 0/3

## Comparatif

| métrique | intfloat/multilingual-e5-small | sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2 | sentence-transformers/distiluse-base-multilingual-cased-v2 |
|---|---|---|---|
| Statut | NOT_RUN | NOT_RUN | NOT_RUN |
| Dimensions | — | — | — |
| Longueur maximale | — | — | — |
| Poids réellement sélectionnés | — | — | — |
| Artefact local total | — | — | — |
| RAM processus après chargement | — | — | — |
| RAM incrémentale après chargement | — | — | — |
| Pic RAM processus benchmark | — | — | — |
| Chargement modèle | — | — | — |
| Première requête à froid (modèle chargé) | — | — | — |
| Cold start chargement + première requête | — | — | — |
| Vectorisation des 112 questions | — | — | — |
| Requête chaude moyenne | — | — | — |
| Requête chaude p50 | — | — | — |
| Requête chaude p95 | — | — | — |
| Top-1 résoluble | — | — | — |
| Top-3 résoluble | — | — | — |
| Résoluble similarité Top-1 moyenne | — | — | — |
| Résoluble marge p50 | — | — | — |
| Résoluble marge p95 | — | — | — |
| Quasi-identique Top-1 | — | — | — |
| Quasi-identique Top-3 | — | — | — |
| Paraphrase naturelle Top-1 | — | — | — |
| Paraphrase naturelle Top-3 | — | — | — |
| Conversationnel Top-1 | — | — | — |
| Conversationnel Top-3 | — | — | — |
| Formulation courte Top-1 | — | — | — |
| Formulation courte Top-3 | — | — | — |
| Synonymes Top-1 | — | — | — |
| Synonymes Top-3 | — | — | — |
| DifferentVocab Top-1 | — | — | — |
| DifferentVocab Top-3 | — | — | — |
| Syntaxe imparfaite Top-1 | — | — | — |
| Syntaxe imparfaite Top-3 | — | — | — |
| Fautes de frappe Top-1 | — | — | — |
| Fautes de frappe Top-3 | — | — | — |
| Mots-clés seuls Top-1 | — | — | — |
| Mots-clés seuls Top-3 | — | — | — |
| Adjacent résoluble Top-1 | — | — | — |
| Adjacent résoluble Top-3 | — | — | — |
| TrueAmbiguous similarité Top-1 moyenne | — | — | — |
| TrueAmbiguous similarité Top-1 p95 | — | — | — |
| TrueAmbiguous similarité Top-1 max | — | — | — |
| TrueAmbiguous marge p50 | — | — | — |
| Hors corpus similarité Top-1 moyenne | — | — | — |
| Hors corpus similarité Top-1 p95 | — | — | — |
| Hors corpus similarité Top-1 max | — | — | — |
| Hors corpus marge p50 | — | — | — |
| Hors corpus marge p95 | — | — | — |
| Diagnostic fr Top-1 | — | — | — |
| Diagnostic fr Top-3 | — | — | — |
| Diagnostic en Top-1 | — | — | — |
| Diagnostic en Top-3 | — | — | — |
| Diagnostic nl Top-1 | — | — | — |
| Diagnostic nl Top-3 | — | — | — |
| Diagnostic es Top-1 | — | — | — |
| Diagnostic es Top-3 | — | — | — |

## Contrats imposés par les adapters

- `intfloat/multilingual-e5-small` : Transformer → Pooling → Normalize, pooling mean, l2, query=`query: `, passage=`passage: `, max 512 tokens, 384 dimensions.
- `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` : Transformer → Pooling, pooling mean, l2-for-cosine, aucun préfixe, max 128 tokens, 384 dimensions.
- `sentence-transformers/distiluse-base-multilingual-cased-v2` : Transformer → Pooling → Dense, pooling mean, l2-for-cosine, aucun préfixe, max 128 tokens, 512 dimensions.

## Environnement et versions

- `e5-small` : NOT_RUN — local model path not configured.
- `multilingual-minilm` : NOT_RUN — local model path not configured.
- `distiluse-cased-v2` : NOT_RUN — local model path not configured.

## Exemples diagnostiques

### intfloat/multilingual-e5-small

Non mesuré : local model path not configured.

### sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2

Non mesuré : local model path not configured.

### sentence-transformers/distiluse-base-multilingual-cased-v2

Non mesuré : local model path not configured.

## Sanity check multilingue

Les 24 formulations françaises, anglaises, néerlandaises et espagnoles sont diagnostiques seulement et ne contribuent à aucun score officiel V0.

## Décision

Aucune recommandation : aucun des trois modèles n’a été exécuté avec ses poids locaux dans cet environnement.
