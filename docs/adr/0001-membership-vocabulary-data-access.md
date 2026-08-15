Status: Accepted
Generation: Orogeny

# ADR 0001 — Vocabulaire Organization/Tenant, structure des memberships, accès aux données, report de Yjs

## Contexte

Avant d'écrire le premier schéma de base de données (Phase 0 — Foundations), quatre décisions structurantes devaient être tranchées explicitement plutôt que laissées ouvertes jusqu'au premier vrai code — elles conditionnent directement la forme du schéma et seraient coûteuses à changer après coup.

## Décisions

### 1. Organization (produit) vs Tenant (technique)

*Tenant* reste le terme technique de l'isolation en base de données. *Organization* est le seul terme visible côté produit, notamment dans Storm Control. On ne doit jamais voir « Tenant settings » dans l'interface.

### 2. Deux tables de membership distinctes, jamais confondues

```
tenant_memberships    — appartenance à l'organisation
project_memberships   — accès réel à un projet donné, UNIQUE(project_id, user_id)
```

L'appartenance au tenant ne donne jamais automatiquement accès aux projets. Une `project_membership` porte au minimum un bundle de permissions, un statut et des métadonnées d'attribution. Pour la V1, un bundle principal par membership suffit (Contributeur, Éditeur, Pilote, Administrateur projet) — pas d'overrides de capabilities individuelles avant qu'un vrai besoin ne l'exige.

### 3. Accès aux données : SQL-first

Migrations explicites en SQL/PostgreSQL, avec une couche d'accès typée par-dessus. Ni SQL brut éparpillé dans chaque route, ni un ORM masquant les contraintes PostgreSQL au point de les faire oublier. Le choix exact de la librairie de couche typée se fait pendant Foundations, après un mini-spike — il ne doit pas retarder l'écriture du schéma métier.

### 4. Yjs : rien maintenant

Les six contrats de `docs/contracts/collaboration/` restent Draft. Foundations construit les entités structurées et l'optimistic concurrency (P3) ; P4 (Yjs) viendra plus tard, seulement si l'audit technique reste favorable au moment de l'implémentation.

## Conséquences

- Le schéma Phase 0 inclut dès le départ deux tables de membership séparées, pas une table unique générique qu'il faudrait scinder plus tard.
- Le code serveur ne teste jamais de rôle nommé (`if (role === 'admin')`) — toujours une capability précise (`content.edit`, `publication.publish`).
- Aucune dépendance Yjs/Hocuspocus n'entre dans Foundations.

## Documents mis à jour en conséquence

`docs/OROGENY_MANIFESTO.md` (renommé depuis `MANIFEST.md`, pour ne jamais confondre avec le Manifest technique publié consommé par Ivory), `docs/ARCHITECTURE.md`, `docs/contracts/permissions.md`, `docs/contracts/schema-and-migrations.md`.
