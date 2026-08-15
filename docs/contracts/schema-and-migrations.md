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

Ne pas ajouter maintenant de hiérarchie Programme/Sous-projet récursive. Un projet n'est jamais supposé équivaloir à un seul bâtiment, une seule population ou une seule vague — voir `MANIFEST.md`.

## Concurrence

Optimistic concurrency par défaut sur le contenu édité (Phase 2/3). Le multi-user réel (P3/P4, Phase 6) pourra faire évoluer certaines entités vers une représentation collaborative (Y.Doc) — voir `docs/contracts/collaboration/schema-migration.md` pour la façon dont un contenu P3 devient collaborative-ready en P4 sans réécriture douloureuse.

## Ce qui reste à trancher avant le premier schéma DB

- ORM/query builder retenu, ou SQL direct avec migrations versionnées à la main ;
- stratégie exacte de migration réversible (down migrations systématiques ou non) ;
- granularité des tables de contenu (une table générique polymorphe vs une table par type de contenu).
