Status: Draft — à stabiliser avant le premier schéma DB
Generation: Orogeny

# Contrat de schéma et migrations

## Principes

- PostgreSQL réel dès le développement local — jamais un fichier JSON unique comme source de vérité, contrairement à Tectonic ;
- `schemaVersion` explicite sur les entités versionnées ;
- migrations explicites, jamais de modification silencieuse d'un schéma existant ;
- IDs stables et opaques, jamais dérivés d'une information métier qui pourrait changer ;
- contenu structuré (champs typés), jamais un blob HTML canonique comme représentation de stockage — condition nécessaire pour rester CRDT-ready sans être CRDT-dependent (voir `docs/contracts/collaboration/scope.md`).

## Premier modèle (Phase 0)

```
Tenant
  ├── Users
  ├── Groups
  ├── Templates
  ├── Policies
  ├── Integrations
  ├── Organization resources
  └── Projects
        ├── Memberships
        ├── Project identity
        ├── Content
        ├── Draft state
        ├── Publications
        ├── Pilotage
        └── Configuration
```

Ne pas ajouter maintenant de hiérarchie Programme/Sous-projet récursive. Un projet n'est jamais supposé équivaloir à un seul bâtiment, une seule population ou une seule vague — voir `OROGENY_MANIFESTO.md`.

## Memberships — deux tables distinctes, jamais confondues

```
tenant_memberships
  user_id, tenant_id, ...

project_memberships
  user_id, project_id, permission_bundle, status, ...
  UNIQUE(project_id, user_id)
```

Une `tenant_membership` porte l'appartenance à l'organisation. Une `project_membership` porte l'accès réel à un projet précis — bundle de permissions au minimum, statut, métadonnées d'attribution. L'une ne donne jamais automatiquement l'autre : appartenir à l'organisation ne donne jamais accès à un projet sans membership de projet explicite.

## Accès aux données : SQL-first

Migrations explicites en SQL/PostgreSQL, avec une couche d'accès typée par-dessus — jamais du SQL brut éparpillé dans chaque route, jamais un ORM qui masque les contraintes PostgreSQL au point de les faire oublier. Le choix exact de la librairie d'accès (couche typée) peut se faire pendant Foundations après un mini-spike ; il ne doit pas retarder l'écriture du schéma métier lui-même.

## Collaboration temps réel (Yjs)

Rien maintenant. Les six contrats de `docs/contracts/collaboration/` restent Draft. Foundations construit les entités structurées et l'optimistic concurrency (P3) ; P4 (Yjs) viendra plus tard, seulement si l'audit technique reste favorable au moment de l'implémentation — voir `docs/contracts/collaboration/scope.md`.

## Concurrence

Optimistic concurrency par défaut sur le contenu édité (Phase 2/3). Le multi-user réel (P3/P4, Phase 6) pourra faire évoluer certaines entités vers une représentation collaborative (Y.Doc) — voir `docs/contracts/collaboration/schema-migration.md` pour la façon dont un contenu P3 devient collaborative-ready en P4 sans réécriture douloureuse.

## Ce qui reste à trancher avant le premier schéma DB

- Librairie exacte de la couche d'accès typée (après mini-spike en Phase 0, sans retarder le schéma métier) ;
- stratégie exacte de migration réversible (down migrations systématiques ou non) ;
- granularité des tables de contenu (une table générique polymorphe vs une table par type de contenu).
