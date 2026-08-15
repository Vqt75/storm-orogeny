Status: Draft
Generation: Orogeny

# Collaboration — Draft History & Recovery Contract

## Ce qu'il faut décider, dans cet ordre précis

**Décider l'expérience de récupération avant la technique de stockage** — pas l'inverse.

1. Ce qu'est une « version » compréhensible pour un humain (pas la structure causale brute du CRDT) ;
2. Quand Storm en crée une ;
3. Combien de temps elle est conservée ;
4. Comment restaurer ;
5. Si une restauration produit un nouvel état plutôt que de réécrire le passé ;
6. Comment articuler l'historique humain et les données CRDT sous-jacentes ;
7. Politique de compactage ;
8. Politique de récupération après corruption.

## Ce que Yjs fournit réellement (ne pas sous-estimer, ne pas sur-supposer)

Yjs ne donne pas gratuitement l'historique éditorial produit que Storm veut montrer aux humains ("Aujourd'hui 14:32 — Doriane a modifié « Votre arrivée »"). Les updates Yjs transportent l'information nécessaire à la convergence, pas un journal humainement lisible. Ce n'est pas la même chose que conserver la structure causale complète d'un CRDT.

## Croissance et compaction

Le journal Yjs n'est pas borné naturellement — dédupliquer (`mergeUpdates`) ne suffit pas à réduire le contenu supprimé, il faut charger l'état dans un Y.Doc pour réellement le compacter. Une politique de vie du document doit exister avant P4 :

```
updates → persist → consolidation périodique → politique de rétention/historique → points de récupération
```

Pas besoin de fixer aujourd'hui le seuil exact (nombre d'updates, durée) — mais une stratégie de compaction et de rétention doit exister avant P4.

## Ce qui reste à trancher

- Format exact de l'historique humain (liste d'événements séparée du CRDT, ou dérivée dynamiquement) ;
- Seuils précis de compaction et de rétention.
