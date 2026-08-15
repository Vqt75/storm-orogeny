Status: Draft — à compléter avant implémentation
Generation: Orogeny

# Command Layer — machine d'état

## Modèle conceptuel de départ

```
COMMAND_LAYER
  navigation.expanded
  navigation.compact
  navigation.hidden
  status.saving
  status.saved
  status.error
  action.publish
  action.retry
```

Les états exacts restent à concevoir en détail — ce document liste l'intention, pas encore la machine complète. Avant tout code, ce fichier doit contenir :

- la liste exhaustive des états possibles ;
- les transitions autorisées entre ces états ;
- les déclencheurs précis de chaque transition ;
- les transitions explicitement interdites.

## Principe directeur

L'arbitre (résolveur de priorité, voir `priority-table.md`) décide quel état gagne. Le renderer décide ensuite uniquement de la forme — jamais l'inverse. La machine doit rester une fonction pure, testable sans DOM (`resolve(signaux) → état suivant`).

## À faire avant Phase 4

Ce document doit passer de Draft à Accepted avant la première ligne de code de la Command Layer elle-même (voir condition d'entrée en développement dans `README.md`).
