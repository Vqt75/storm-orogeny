Status: Draft
Generation: Orogeny

# Collaboration — Publication Boundary Contract

## Question centrale

Qu'est-ce qu'exactement Storm considère comme publié à l'instant où quelqu'un appuie sur Publier ?

## Une seule vérité logique, deux formes physiques

Le Y.Doc vivant (en mémoire) et sa persistance binaire durable sont le **même brouillon collaboratif**, pas deux couches métier distinctes. Ne jamais reconstruire le Y.Doc depuis une projection JSON comme stockage primaire — les propriétés nécessaires à la fusion correcte seraient perdues. Le JSON est une projection dérivée, jamais la source.

```
COLLABORATIVE DRAFT
Y.Doc vivant ↕ persistance binaire durable   (une seule vérité, deux formes)
        │
        │  PUBLISH — checkpoint serveur
        ▼
PUBLISHED SNAPSHOT
JSON immuable → Candidate → Compiler → Manifest → Ivory
```

## Garantie de publication — à écrire noir sur blanc, jamais laissée implicite

> Une publication Storm garantit un état cohérent de **chaque contenu** inclus dans le checkpoint. Elle ne garantit **pas** une transaction strictement atomique entre plusieurs documents collaboratifs indépendants. Le checkpoint enregistre explicitement la révision retenue pour chaque contenu.

```
Publication #N
article:welcome        @ revision X
article:move-guide     @ revision Y
faq                    @ revision Z
spaces                 @ revision Q
```

Une publication est un manifeste de révisions avant d'être le Manifest public. Ne jamais promettre davantage que ce qui est réellement garanti — capturer une révision par Y.Doc, l'un après l'autre, n'est pas une transaction atomique au sens base de données, c'est une série de lectures cohérentes prises à des instants légèrement différents.

## Règle offline

Une publication contient tous les changements **synchronisés avec Storm** au moment du checkpoint — pas tous les changements que quelqu'un pense avoir faits quelque part dans le monde. Voir [`offline-sync.md`](./offline-sync.md).

## Ce qui reste à trancher

- Mécanisme exact du checkpoint serveur (transaction DB, verrou, ou autre) ;
- Comportement si un contenu inclus dans le checkpoint change entre le moment du checkpoint et la matérialisation JSON.
