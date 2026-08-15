Status: Draft
Generation: Orogeny

# Collaboration — Schema & Migration Contract

## Question

Comment un contenu P3 (concurrence optimiste classique, pas de CRDT) devient-il éventuellement collaboratif en P4, et comment les Y.Docs évoluent-ils quand le modèle Storm change ?

## Contrainte de départ

Un Y.Doc n'a pas de schéma versionné natif — c'est une responsabilité applicative entière, pas quelque chose que Yjs résout pour nous. Si demain le modèle de contenu change, un Y.Doc existant créé sous l'ancien schéma doit pouvoir être migré, pas silencieusement corrompu ou ignoré.

## Ce que P3 doit garantir dès aujourd'hui pour que P4 reste possible

Voir `docs/contracts/collaboration/scope.md` — champs structurés, jamais un blob monolithique. Dans P3 :

```
Article
  id
  title
  lead
  body
  audience
  status
  updatedAt
  version
```

Puis en P4, certains champs deviennent collaboratifs :

```
title → Y.Text éventuellement
body  → Y.XmlFragment / structure éditeur
```

sans devoir déconstruire un unique blob HTML pour y arriver.

## Ce qui reste à trancher

- Stratégie de migration exacte d'un contenu P3 existant vers sa représentation Y.Doc en P4 (migration à la volée au premier accès collaboratif, ou migration batch) ;
- Politique de version pour les Y.Docs eux-mêmes une fois créés.
