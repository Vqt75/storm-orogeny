Status: Draft
Generation: Orogeny

# Collaboration — Offline & Synchronization Contract

## Cas produit

```
Doriane travaille hors ligne.
Ses changements existent sur son ordinateur.
Vivien publie depuis un autre ordinateur.
```

Les modifications de Doriane ne peuvent évidemment pas faire partie du snapshot serveur puisqu'elles ne sont pas encore arrivées au serveur.

## Règle

Une publication contient tous les changements synchronisés avec Storm au moment du checkpoint — jamais tous les changements que quelqu'un pense avoir faits quelque part dans le monde.

## États à définir précisément

- `local` — modifications existant uniquement sur l'appareil, jamais transmises ;
- `synced` — modifications confirmées reçues par le serveur ;
- `saving` — transmission en cours ;
- `offline` — aucune connexion au serveur ;
- `resynchronizing` — reconnexion en cours, rattrapage des modifications locales.

Séquence honnête côté utilisateur : *Hors ligne — modifications enregistrées sur cet appareil* → *Resynchronisation…* → *Tout est enregistré*. Ces états sont des signaux supplémentaires à intégrer à la table de priorité de la Command Layer (voir `docs/contracts/command-layer/priority-table.md`).

## Ce qui reste à trancher

- Durée maximale de rétention locale avant qu'une resynchronisation soit considérée comme ayant échoué ;
- Comportement si les modifications locales entrent en conflit avec une publication survenue entre-temps.
