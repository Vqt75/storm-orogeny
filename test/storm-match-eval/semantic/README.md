# Storm Match — benchmark sémantique pur V0

Ce dossier étend uniquement le harness d’évaluation. Il ne crée ni
`SemanticProvider` produit, ni index sémantique produit, et ne modifie aucun
chemin d’exécution de Storm, Studio, Pilotage ou Ivory. Il ne lit aucune base.

## Corpus et portée

`export-input.mjs` importe le snapshot officiel des 112 questions et les 320
cas figés du benchmark heuristique. Il appelle également le véritable adapter
heuristique existant pour permettre les comparaisons cas par cas. Les embeddings
sont comparés par cosinus aux seules questions canoniques, jamais aux réponses.

Les 290 cas ayant un `expectedEntryId` participent aux métriques Top-1 et Top-3.
Les 10 `trueAmbiguous` et les 20 requêtes hors corpus servent à mesurer les
distributions de similarité et de marge. Aucun seuil d’abstention n’est inventé :
à cette étape, tout modèle sémantique retourne toujours un voisin.

`multilingual-diagnostic.json` contient six intentions en français, anglais,
néerlandais et espagnol, soit 24 cas. Ils sont diagnostiques uniquement et ne
contribuent jamais au score officiel V0.

## Contrats modèle

Les contrats sont déclarés dans `model-specs.json` et contrôlés contre les
fichiers de chaque artefact avant chargement :

- `intfloat/multilingual-e5-small` : Transformer → mean pooling → Normalize,
  préfixes `query: ` et `passage: `, normalisation L2, 512 tokens, 384 dimensions.
- `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` : Transformer →
  mean pooling, aucun préfixe, normalisation L2 pour le cosinus, 128 tokens,
  384 dimensions.
- `sentence-transformers/distiluse-base-multilingual-cased-v2` : Transformer →
  mean pooling → projection dense 768→512 avec Tanh, aucun préfixe,
  normalisation L2 pour le cosinus, 128 tokens, 512 dimensions.

Le runner refuse une longueur, une dimension, un pooling, une casse ou une
composition de modules inattendus. Les contrats proviennent des model cards et
des fichiers `modules.json`, `sentence_bert_config.json`, `1_Pooling/config.json`
et, pour DistilUSE, `2_Dense/config.json` publiés avec chaque modèle.

## Exécution entièrement locale

Chaque chemin doit viser un répertoire Sentence Transformers complet déjà
présent sur disque. Un identifiant Hugging Face n’est jamais accepté comme
chemin de repli. Le runner positionne les modes offline, exige un chemin absolu
existant et charge avec `local_files_only=True` et `trust_remote_code=False`.

Installer préalablement Python et les dépendances depuis un wheelhouse local :

```text
python -m venv .venv-semantic
.venv-semantic/bin/pip install --no-index --find-links /opt/storm-wheels -r test/storm-match-eval/semantic/requirements-semantic.txt
```

Commande Linux/macOS exacte, avec les trois artefacts locaux :

```text
.venv-semantic/bin/python test/storm-match-eval/semantic/benchmark.py \
  --model e5-small=/opt/storm-models/multilingual-e5-small \
  --model multilingual-minilm=/opt/storm-models/paraphrase-multilingual-MiniLM-L12-v2 \
  --model distiluse-cased-v2=/opt/storm-models/distiluse-base-multilingual-cased-v2 \
  --device cpu --cpu-threads 8 --batch-size 16 --require-all \
  --output test/storm-match-eval/semantic/report-semantic.md
```

Équivalent PowerShell :

```text
.\.venv-semantic\Scripts\python.exe test\storm-match-eval\semantic\benchmark.py `
  --model "e5-small=C:\storm-models\multilingual-e5-small" `
  --model "multilingual-minilm=C:\storm-models\paraphrase-multilingual-MiniLM-L12-v2" `
  --model "distiluse-cased-v2=C:\storm-models\distiluse-base-multilingual-cased-v2" `
  --device cpu --cpu-threads 8 --batch-size 16 --require-all `
  --output test\storm-match-eval\semantic\report-semantic.md
```

`model-paths.example.json` permet la même configuration via `--config`. L’option
`--raw-output chemin.json` conserve facultativement les 320 rangs et marges par
requête. Sans cette option, seul le rapport comparatif unique est écrit.

Chaque modèle est lancé dans un nouveau processus. Les mesures distinguent le
chargement, la première requête après chargement, le total cold start, la
vectorisation des 112 questions et 320 requêtes unitaires une fois le modèle
chaud. Le rapport enregistre aussi la taille des fichiers de poids réellement
sélectionnés, la taille totale de l’artefact, la RAM absolue et incrémentale, le
pic RAM, le CPU, le device, le nombre de threads et les versions logicielles.

Le device par défaut est `cpu`. Un device GPU peut être demandé explicitement,
mais les mesures CPU restent la référence portable.
