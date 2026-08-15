Status: Draft
Generation: Orogeny

# Multi-user / Studio collaboratif — contrat

Objectif : un Studio réellement multi-utilisateur, avec une trajectoire progressive vers l'édition simultanée temps réel sur certains contenus — sans jamais reconstruire un moteur de collaboration propriétaire quand un socle mature (Yjs) existe déjà.

## Paliers (montée progressive, jamais un flag `MULTIPLAYER=true`)

- **P1 — Multi-user projet.** Comptes, memberships, permissions. Déjà couvert par Foundations (Phase 0).
- **P2 — Présence.** Qui est dans Studio, éventuellement qui travaille sur quel contenu. Éphémère par nature.
- **P3 — Collaboration parallèle.** Plusieurs personnes travaillent simultanément sur des contenus différents. **Ne nécessite pas Yjs** — concurrence optimiste classique côté serveur suffit.
- **P4 — Same-document realtime.** Deux personnes éditent réellement le même contenu, curseurs/sélections distants, fusion CRDT.

**Invariant central : P3 doit être CRDT-ready sans être CRDT-dependent.** Voir [`scope.md`](./scope.md).

## Les six contrats

1. [Scope](./scope.md) — quelle est l'unité collaborative ?
2. [Permissions](./permissions.md) — qui peut lire/éditer/publier/gérer les accès, y compris au niveau WebSocket.
3. [Publication Boundary](./publication-boundary.md) — CRDT → checkpoint → représentation canonique → Candidate → Compiler → Manifest.
4. [Offline & Synchronization](./offline-sync.md) — sémantique exacte de *local*, *synced*, *saving*, *offline*, *resynchronizing*.
5. [Schema & Migration](./schema-migration.md) — comment un contenu P3 devient éventuellement collaboratif en P4.
6. [History & Recovery](./history-recovery.md) — versions éditoriales, restauration, rétention, compaction.

Ces six contrats doivent être formalisés avant P4. Aucune raison de faire entrer Yjs dans tout Storm uniquement pour pouvoir écrire « real-time collaboration » — la technologie arrive uniquement là où la concurrence éditoriale la justifie réellement.
