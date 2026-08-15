Status: Draft
Generation: Orogeny

# Storm Command Layer — contrat

Une seule couche de commande unique et contextuelle (navigation / statut / action), plutôt que trois composants indépendants (topbar figée, toast de sauvegarde, bouton d'action séparé).

> Une seule couche. La bonne forme au bon moment.

**Règle de contrôle avant toute implémentation :** si la transformation ne diminue ni la charge cognitive ni le bruit visuel, elle n'a aucune raison d'exister.

## Condition d'entrée en développement

La Command Layer ne peut pas être implémentée tant que son comportement n'est pas spécifié indépendamment de son animation. Quatre artefacts doivent exister et être cohérents entre eux avant tout code :

1. [Table de priorité des signaux](./priority-table.md)
2. [Machine d'état complète](./state-machine.md)
3. [Contrat d'interaction](./interaction-contract.md) (focus, clavier, reduced motion)
4. [Matrice de vérification combinatoire](./test-matrix.md)

Aucune animation ne doit être conçue avant que ces quatre éléments fonctionnent sans animation.

## Invariants

- **State before shape.** La machine d'état décide ce qui est vrai et ce qui doit être montré ; le renderer/l'animation décide seulement comment cette décision se matérialise.
- **One owner. One arbiter.** Un root DOM persistant, jamais recréé — l'identité de la couche est toujours présente techniquement, seule sa forme visuelle change.
- **Focus freezes geometry.** Tant que le focus clavier appartient à la Command Layer, sa géométrie est gelée. Un événement passif du système ne déplace jamais le focus.
- **Motion explains continuity. It never creates it.** Si toutes les animations sont désactivées, la Command Layer doit continuer à fonctionner parfaitement.
- **No transient state without an exit.** Un signal attendu qui n'arrive jamais (timeout réseau) ne doit jamais laisser le résolveur bloqué indéfiniment sur un état transitoire.
- **The state machine must survive without the interface.** Testable en isolation complète (`resolve(signaux) → état suivant`), sans DOM, sans navigateur.

## Non-objectifs

- Ne pas construire ce système dans Tectonic.
- Ne pas remplacer tous les contrôles existants par la Command Layer.
- Pas de Liquid Glass partout, pas d'animation pour démontrer la technologie.
- Ne pas rendre l'interface moins prévisible au nom du minimalisme.
- Ne pas cacher des fonctions rares mais importantes au point qu'elles deviennent introuvables.
