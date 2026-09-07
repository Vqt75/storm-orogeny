# Knowledge Representation Retrieval

Expérience test-only de retrieval sémantique pur. Elle compare, pour E5-small
et DistilUSE, quatre représentations d’une entrée canonique : question, réponse,
concaténation libellée question + réponse, et trois vecteurs Q/A/Q+A fusionnés
par le maximum des similarités puis dédupliqués par `entryId`.

Le corpus comprend les 290 cas officiels résolubles et les 100 positifs du
Decision Corpus. Les 16 misses Top-3 du holdout verifier précédent sont figés
explicitement comme sous-ensemble diagnostique. Les cas négatifs sont exclus :
cette expérience ne mesure ni l’answerability, ni l’abstention.

Le runner réutilise strictement les adapters E5/DistilUSE existants et exige des
chemins locaux absolus. Hugging Face et Transformers sont forcés offline. Aucun
verifier, score lexical, seuil, DB ou code produit n’est utilisé.

```text
python test/storm-match-eval/representation/benchmark.py \
  --model e5-small=/absolute/external/e5-small \
  --model distiluse-cased-v2=/absolute/external/distiluse-cased-v2 \
  --output test/storm-match-eval/representation/report-knowledge-retrieval.md \
  --raw-output /absolute/external/representation-raw.json
```

Le JSON brut reste hors repo. `--from-raw` permet de reproduire le rapport sans
recharger les modèles.
