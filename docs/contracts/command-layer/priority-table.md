Status: Draft
Generation: Orogeny

# Command Layer — table de priorité des signaux

| Situation | Ce que montre la couche | Pourquoi |
|---|---|---|
| Erreur bloquante (sauvegarde impossible, conflit, publication échouée) | *Impossible d'enregistrer* / erreur correspondante | Une action sûre est impossible tant que le problème n'est pas traité |
| Action explicite en cours (publication, retry) | *Publication…* | Le résultat de l'action déclenchée prime |
| Intention explicite de navigation (remontée) | Navigation | Une intention explicite bat un statut passif |
| Brouillon ≠ version publique, utilisateur reste dans le contenu | *Publier* | Prochaine décision réellement humaine |
| Sauvegarde en cours, aucune intention de navigation | *Enregistrement…* | Informatif, non décisionnel |
| Sauvegarde terminée, rien d'autre à faire | *Tout est enregistré*, bref, puis disparition | Feedback sans encombrement permanent |
| Aucun état pertinent, utilisateur descend | Rien | Storm s'efface devant le projet |

## Règle fondamentale

Une erreur bloquante bat tout. Une action explicitement déclenchée bat les états ambiants. Une intention utilisateur explicite bat les informations passives. Une décision utile bat un simple statut. Sinon, Storm s'efface.

## Exemples de résolution

- L'utilisateur remonte pendant qu'une sauvegarde **échoue** → l'erreur gagne. Rendre simplement la navigation alors que le travail n'est plus sauvegardé serait dangereux.
- L'utilisateur remonte pendant un autosave **normal** → la navigation gagne. Aucune raison de prendre l'écran en otage avec *Enregistrement…*.

## Signaux non encore couverts, à ajouter avant implémentation

- Hors ligne / resynchronisation (voir `docs/contracts/collaboration/offline-sync.md`) ;
- Timeout d'un signal attendu qui n'arrive jamais (voir invariant *No transient state without an exit* dans le README).

Cette table reste une liste vivante — à affiner au fil des cas réels rencontrés en développement, jamais figée avant la première implémentation.
