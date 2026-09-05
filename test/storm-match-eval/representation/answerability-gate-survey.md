# Expérience B — proposition Answerability Gate

## Séparation proposée

Le retriever ne décide jamais si une demande est couverte. Il fournit un Top-K
à partir de la représentation Q+A, meilleur résultat de l’expérience A sur les
positifs décisionnels. Chaque connaissance candidate est ensuite évaluée
indépendamment par un composant dont la sortie sémantique vise explicitement
`covered`, `notCovered` ou `ambiguous`.

Un reranker apprend surtout un ordre relatif entre candidats et retourne donc
un meilleur voisin même quand aucun candidat ne répond. Les approches suivantes
évaluent au contraire une relation directionnelle, une absence de réponse ou
une classe de couverture. Elles ne doivent pas réutiliser le score BGE/mMARCO
comme Answerability Gate.

## Candidats proposés

### 1. NLI ternaire compact

`MoritzLaurer/multilingual-MiniLMv2-L6-mnli-xnli` est un classifieur NLI
multilingue d’environ 0,1 milliard de paramètres, licence MIT, entraîné sur
MNLI/XNLI. Il produit explicitement `entailment`, `neutral` et `contradiction`.
Sa carte annonce 100+ langues et 71,3 % de moyenne XNLI. C’est le candidat CPU
léger.

Contrat à tester : connaissance Q+A en prémisse, demande utilisateur en
hypothèse, puis sens inverse comme ablation préenregistrée. `entailment` fournit
un signal de couverture; `neutral`/`contradiction` restent séparés dans les
mesures au lieu d’être écrasés en score de pertinence.

Source : https://huggingface.co/MoritzLaurer/multilingual-MiniLMv2-L6-mnli-xnli

### 2. NLI ternaire de référence

`MoritzLaurer/mDeBERTa-v3-base-mnli-xnli` fournit la même sémantique de classes
avec un backbone plus robuste d’environ 0,3 milliard de paramètres, licence
MIT. Sa carte annonce 100 langues, 80,8 % de moyenne XNLI et 83,4 % en français.
Il sert de borne qualité/coût, pas de choix automatique.

Il est réellement différent d’un reranker parce que les logits correspondent
à une relation NLI apprise et directionnelle, non à un ordre relatif de
relevance. La formulation interrogative reste toutefois un décalage de domaine
à mesurer honnêtement.

Source : https://huggingface.co/MoritzLaurer/mDeBERTa-v3-base-mnli-xnli

### 3. QA extractive avec absence de réponse

`deepset/xlm-roberta-base-squad2` est un XLM-RoBERTa base multilingue d’environ
0,3 milliard de paramètres, licence CC-BY-4.0, doté d’une tête extractive QA
entraînée sur SQuAD 2.0. Le signal pertinent est la préférence du modèle pour
le span nul face aux spans de la réponse canonique.

Cette voie est différente du NLI et du reranking : elle pose directement la
question utilisateur sur la réponse publiée comme contexte et modélise une
sortie `no answer`. Sa faiblesse est importante : l’entraînement SQuAD 2.0 est
anglais et les résultats multilingues publiés sont plus faibles; le français
doit donc être traité comme un test éliminatoire, pas comme une capacité acquise.

Source : https://huggingface.co/deepset/xlm-roberta-base-squad2

## Règle d’agrégation à évaluer

- Aucun candidat couvert : `notCovered`.
- Un seul candidat couvert : `covered(entryId)`.
- Plusieurs candidats couverts, ou signaux concurrents sans dominant clair :
  `ambiguous`.
- Une requête à intentions multiples doit être évaluée aussi par segments
  diagnostiques, sans génération, afin de vérifier que deux connaissances
  nécessaires ne sont pas réduites arbitrairement à une seule.

Le NLI ne détecte donc pas magiquement l’ambiguïté : celle-ci résulte soit de
plusieurs relations d’entailment concurrentes, soit d’une future tête de
classification de couverture explicitement supervisée. Le modèle extractif ne
la détecte pas seul non plus; plusieurs contextes answerable doivent conduire à
`ambiguous`.

## Protocole recommandé pour le prochain run

1. Épingler les trois révisions et télécharger uniquement les artefacts locaux
   hors repo; vérifier licence, checksum, taille et chargement sans code distant.
2. Fixer avant mesure les contrats de paire et mappings de labels. Ne pas
   inventer un seuil sur le holdout.
3. Employer le Decision Corpus existant comme développement/régression. Son
   ancien holdout ayant désormais été observé, créer et sceller un nouveau
   holdout answerability avant toute calibration de cette famille.
4. Mesurer séparément la classification candidate et l’agrégation système :
   covered/notCovered/ambiguous, faux positifs dangereux, sur-abstentions,
   mixed intents, latence et RAM CPU.
5. Ne passer à une tête de couverture supervisée que si les baselines zero-shot
   exposent un signal utile mais mal calibré. Elle devra être entraînée sans le
   nouveau holdout et avec des négatifs par entrée, pas seulement par requête.

Aucun de ces candidats n’est recommandé avant mesure sur un holdout neuf. Cette
note est une proposition d’expérience, pas une sélection produit.
