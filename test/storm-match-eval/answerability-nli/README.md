# Answerability NLI spike

Ce harness test-only mesure une architecture `retrieve → NLI → abstain`. Il ne
modifie ni Storm Match, ni Ivory, ni Studio, ni Pilotage, et n’utilise aucune
base de données.

## Séparation des données

- Les 200 cas de l’ancien Decision Corpus sont désormais **development only**.
  Ses anciens splits ont été observés et ne constituent plus un holdout pour
  cette famille NLI.
- Le nouveau holdout compte 96 formulations inédites : 32 `covered`, 32
  `notCovered`, 32 `ambiguous`. Il a été écrit et fingerprinté avant la première
  inférence NLI. Ses 32 sources positives sont disjointes de celles des corpus
  déjà observés.
- L’export `development` ne contient ni les cas ni le fingerprint du nouveau
  holdout. Le runner verrouille une configuration par modèle NLI, puis seulement
  il exporte et exécute le holdout. Toute modification du corpus invalide son
  sceau.

## Contrats mesurés

Retrieval DistilUSE ou E5, représentation `question` ou `questionAnswer`,
Top-K 3 ou 5. Chaque paire récupérée est classée séparément dans les deux sens :

- `knowledgeToQuery` : prémisse = question canonique + réponse canonique (ou la
  question seule dans l’ablation), hypothèse = requête utilisateur ;
- `queryToKnowledge` : prémisse = requête utilisateur, hypothèse = connaissance
  candidate.

Les probabilités `entailment`, `neutral` et `contradiction` sont conservées
séparément. Un candidat est entailed si sa probabilité dépasse le seuil calibré.
Zéro candidat donne `notCovered`, un donne `covered(entryId)`, plusieurs donnent
`ambiguous`. Les directions ne sont jamais fusionnées.

Le seuil parcourt toutes les valeurs d’entailment qui changent une décision sur
le development set, plus les bornes d’acceptation totale et d’abstention totale.
La sécurité (zéro faux positif dangereux) est prioritaire. Le holdout n’est pas
utilisé pour réviser le choix.

## Artefacts externes et exécution

Les deux modèles NLI et les deux retrievers sont des snapshots locaux épinglés,
hors Git. Le chargement impose `local_files_only=True`,
`trust_remote_code=False`, ainsi que les modes offline Hugging Face et
Transformers. Aucun poids, cache ML ou chemin machine n’est versionné.

```text
python answerability-nli/benchmark.py \
  --retriever e5-small=/absolute/path/e5 \
  --retriever distiluse-cased-v2=/absolute/path/distiluse \
  --nli nli-minilm-l6=/absolute/path/nli-minilm \
  --nli nli-mdeberta-base=/absolute/path/nli-mdeberta \
  --output answerability-nli/report-answerability-nli.md
```

Le modèle QA extractif SQuAD2 est volontairement différé : ce spike évalue
uniquement l’hypothèse NLI, sans reranker BGE, génération, score lexical ou seuil
produit.

## Conclusion expérimentale

Cette famille est falsifiée pour Liquid Core V0 : un modèle NLI générique
zero-shot n’est pas un Answerability Gate Storm fiable. Le rapport mesuré établit
que :

- le retrieval n’est plus le principal facteur d’échec ;
- le bon candidat est souvent présent dans le Top-K, mais rejeté par le NLI ;
- MiniLM et mDeBERTa provoquent une sur-abstention massive ;
- aucun des deux n’atteint zéro faux positif dangereux sur le holdout vierge ;
- mDeBERTa n’apporte aucun gain de qualité et impose une latence incompatible
  avec la cible CPU.

Il ne faut donc ni retuner ces modèles, ni chercher un nouveau seuil, une marge
ou une combinaison retrieval/reranking pour sauver cette architecture. SQuAD2
n’est pas exécuté dans le prolongement de ce spike.
