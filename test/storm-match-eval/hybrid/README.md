# Storm Match — benchmark hybride V0

Ce dossier est un harness d'évaluation autonome. Il ne constitue ni un
`SemanticProvider`, ni un index, ni un branchement du runtime Storm Match.

## Résultat expérimental

Cette famille d'architecture est **réfutée pour Liquid Core V0** sur le corpus
officiel : aucune des 327 600 configurations testées par modèle n'a satisfait
simultanément les critères V0. La combinaison linéaire sémantique/lexical,
complétée par des seuils haut et moyen ainsi qu'un seuil de marge, atteint zéro
faux positif dangereux seulement au prix d'une sur-abstention massive et d'un
Top-1 résoluble de 30,3 % pour E5 comme pour DistilUSE.

Elle n'est donc **pas retenue pour une intégration produit** et ce harness ne
doit pas servir de point de départ à un nouveau tuning de la même combinaison.
Le rapport `report-hybrid.md` conserve le résultat négatif et les paramètres
mesurés comme preuve expérimentale.

Il utilise sans les modifier :

- le snapshot officiel de 112 questions et les 320 cas du benchmark ;
- `scoreEntry()` et `matchFaq()` depuis `public/ivory/faq-engine.js` via
  l'adapter heuristique existant ;
- les adapters sémantiques locaux déjà validés pour E5 et DistilUSE.

## Signaux et décision

Le score lexical est `clamp(scoreEntry / 28, 0, 1)`. Le diviseur 28 est le
seuil de confiance haute du moteur actuel ; il n'est pas calibré par ce
benchmark. Le soutien lexical moyen reste fixé à `18/28`.

Le classement est obtenu par :

```text
hybridScore = W_sem * clip(cosine, 0, 1) + W_lex * lexicalNormalized
W_sem + W_lex = 1
```

Le Confidence Gate accepte le Top-1 seulement si le plancher sémantique et la
marge sont satisfaits, puis si l'une des voies suivantes passe :

1. score hybride supérieur au seuil haut — lexical optionnel ;
2. score hybride supérieur au seuil moyen avec soutien lexical `>= 18/28`.

Sinon le matcher s'abstient. Une marge sous le seuil entraîne toujours une
abstention, même avec un score élevé.

## Calibration

La grille est exhaustive sur les valeurs déclarées dans `calibration.py` :

- `W_sem` de 0.50 à 0.95 par 0.05, donc `W_lex` de 0.50 à 0.05 ;
- seuil haut de 0.50 à 0.95 par 0.05 ;
- seuil moyen de 0.30 à 0.85 par 0.05, toujours inférieur au seuil haut ;
- marge de 0.005 à 0.150 par 0.005 ;
- plancher sémantique absent ou de 0.30 à 0.85 par 0.05.

Une configuration admissible doit produire zéro acceptation dangereuse parmi
les 30 attendus nuls et au plus 3 faux positifs hors corpus. Le filtre V0 exige
en plus 218/290 au Top-1, 23/30 en paraphrase, 15/30 en vocabulaire différent
et 10/10 abstentions `trueAmbiguous`.

La sélection est lexicographique dans l'ordre demandé : Top-1, paraphrase,
vocabulaire différent, synonymes, hors corpus, ambiguïtés, sur-abstentions et
nouvelles erreurs. Calibration et mesure portent sur le même corpus : le
rapport ne prétend donc pas mesurer la généralisation hors échantillon.

## Exécution offline

Les poids doivent être des snapshots locaux absolus, hors du dépôt. Après leur
provisionnement, l'exécution ne fait aucun accès réseau :

```powershell
$env:HF_HUB_OFFLINE = '1'
$env:TRANSFORMERS_OFFLINE = '1'
$env:HF_DATASETS_OFFLINE = '1'

& C:\path\to\python.exe test\storm-match-eval\hybrid\benchmark.py `
  --model "e5-small=C:\path\to\multilingual-e5-small" `
  --model "distiluse-cased-v2=C:\path\to\distiluse-base-multilingual-cased-v2" `
  --cpu-threads 10 --batch-size 16 --require-all `
  --output test\storm-match-eval\hybrid\report-hybrid.md
```

`--validate-only` contrôle corpus, grille et artefacts configurés sans charger
les modèles. `--raw-output chemin.json` conserve les résultats détaillés.
