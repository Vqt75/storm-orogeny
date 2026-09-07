# Storm Match — benchmark portable V0

Ce dossier est un harness d’évaluation uniquement. Il ne branche aucun moteur
sémantique, ne touche ni Studio, ni Pilotage, ni les migrations, et ne se
connecte jamais à PostgreSQL ou au réseau.

## Corpus canonique

Le fichier equinoxe-corpus.snapshot.json est un snapshot des 112 couples
question/réponse du tableau QUESTIONS de src/db/seedDemo.js, dans leur ordre
source. Il a été dérivé au commit
d0243f15c4c390098663a9d31a462e5244ee6e60.

Le seed laisse PostgreSQL générer un UUID différent à chaque insertion : il
n’existe donc pas d’entryId de production stable dans le fichier source. Les
valeurs `equinoxe-q001` à `equinoxe-q112` sont des identifiants synthétiques,
stables et strictement test-only. Malgré le nom du champ de fixture `entryId`,
ce ne sont ni des UUID, ni des `entryId` de la DB de production, et aucune
correspondance avec ces derniers ne doit être supposée. Ils ne doivent jamais
entrer dans le Manifest, la DB ou un contrat produit.

Le module source-corpus.js lit le littéral statique QUESTIONS sans importer
seedDemo.js. Le test de dérive compare exactement l’ordre, les questions et les
réponses extraites au snapshot. Toute évolution du corpus source force une
revue et une mise à jour explicite du snapshot.

Cette comparaison est un contrôle de provenance transitoire, pas une dépendance
du benchmark au seed. Le snapshot versionné est désormais une fixture
d’évaluation autonome et durable. Lorsque le seed Équinoxe sera retiré du
produit, le test de dérive sera ignoré automatiquement ; le benchmark continuera
à utiliser les 112 Q&A du snapshot, avec le chemin et le commit d’origine
conservés comme métadonnées historiques. Une évolution ultérieure de la fixture
devra alors être faite explicitement dans ce dossier, avec revue du corpus et
mise à jour de sa provenance, sans réintroduire de dépendance au runtime produit.

## Corpus d’évaluation

Le fichier evaluation-corpus.js contient 30 questions sélectionnées et dix
formulations littérales par question, dans l’ordre des dix catégories
convenues, puis vingt requêtes hors corpus. Le tableau exporté contient
exactement 320 cas. Aucun texte n’est produit aléatoirement au runtime.

La dixième formulation de chaque question est auditée dans `ambiguityReview`.
`trueAmbiguous` impose `expectedEntryId: null` et donc l’abstention ;
`adjacentButResolvable` désigne la Q&A canonique précise attendue, qui peut être
différente de la question ayant servi de point de départ aux neuf autres
formulations. `sourceEntryId` conserve cette provenance sans modifier l’attendu.

## Contrat du harness

Un matcher expose la forme conceptuelle suivante :

    matcher.match(query, entries) -> {
      outcome,
      matchedEntryId,
      rankedCandidates,
      disambiguationCandidates
    }

Le module matchers/heuristic.js est le premier adapter. Il importe directement
matchFaq et scoreEntry depuis public/ivory/faq-engine.js ; il ne réimplémente
pas le scoring. Les seuils 12/18/28 sont seulement recopiés pour représenter le
choix de candidats et les buckets déjà présents dans Ivory.

## Commandes offline

    node --test test/storm-match-eval/benchmark.test.js
    node test/storm-match-eval/evaluate.js
    node test/storm-match-eval/evaluate.js --check
    node test/storm-match-eval/evaluate.js --write

La première commande valide les tailles, les références, la dérive du snapshot,
l’appel au vrai moteur, le déterminisme et le rapport versionné. L’option
--write remplace explicitement report-baseline.txt ; --check échoue s’il est
périmé.

Top-1 global compte une entrée correcte ou toute abstention explicitement
requise, qu’il s’agisse d’une ambiguïté réelle ou d’un cas hors corpus. Les
métriques séparent les 300 cas issus des questions sélectionnées, leurs cas
résolubles et les ambiguïtés réelles. Top-3 est un diagnostic de rang limité aux
cas résolubles ; il ne change jamais la décision du moteur.

Le rapport inscrit le commit Git de provenance stocké dans le snapshot, pas le
HEAD au moment de l’exécution : un rapport versionné ne peut pas référencer son
propre futur commit sans devenir immédiatement périmé. La date d’exécution est
également omise pour conserver des diffs déterministes.
