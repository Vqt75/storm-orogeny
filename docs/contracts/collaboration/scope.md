Status: Draft
Generation: Orogeny

# Collaboration — Scope Contract

## Question à trancher

Quelle est l'unité collaborative ? Article, FAQ, page, bloc ?

## Granularité du Y.Doc (pour P4, quand justifié)

Un Y.Doc par contenu (article, FAQ, espace...), avec un document séparé pour les références d'ID/structure — pattern recommandé par la documentation Yjs elle-même, notamment pour permettre des permissions différenciées par entité.

## Invariant central : Structured before collaborative

Orogeny ne doit pas nécessiter Yjs pour stocker correctement ses contenus. Mais tout contenu susceptible de devenir collaboratif doit posséder une structure suffisamment explicite pour être migré vers une représentation collaborative sans changer son sens métier.

En P3 : champs structurés (titre, corps, date...), jamais un blob HTML monolithique qu'il faudrait re-segmenter plus tard pour le faire rentrer dans une structure Yjs cohérente.

Ne pas préconstruire le schéma Yjs en P3 — ce serait coder P4 dans P3.

## Ce qui reste à trancher

- Liste précise des types de contenu qui deviendront collaboratifs en premier (probablement : articles, pas la structure projet entière) ;
- Niveau de granularité à l'intérieur d'un contenu (le document entier vs des champs individuels).
