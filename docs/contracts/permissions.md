Status: Draft — à stabiliser avant le premier schéma DB
Generation: Orogeny

# Contrat de permissions

Le serveur vérifie des **capabilities**, jamais des rôles codés en dur dispersés dans le produit. Les rôles/bundles humains sont une couche de composition de ces capabilities, jamais l'inverse.

## Première base de capabilities

```
project.view
content.edit
publication.publish
pilotage.view
members.manage
project.manage
```

Cette liste est délibérément minimale pour Phase 0/1. Elle s'enrichira avec Storm Control V1 (Phase 1C) — a minima : gestion des utilisateurs et projets au niveau tenant.

## Principe

Jamais :

```js
if (role === 'admin') { ... }
```

dispersé dans le produit. Une capability se vérifie côté serveur, à chaque action sensible — jamais uniquement côté client.

## Deux niveaux distincts

- **Capabilities de tenant** — gérées par Storm Control (créer/archiver un projet, gérer les utilisateurs de l'organisation).
- **Capabilities de projet** — gérées via les Memberships d'un projet donné (éditer le contenu, publier, consulter Pilotage).

Un utilisateur peut avoir des capabilities de projet différentes selon le projet (plusieurs memberships avec des rôles différents), sans que ça nécessite de dupliquer son identité au niveau tenant.

**L'appartenance au tenant ne donne jamais automatiquement accès aux projets.** Une `project_membership` représente l'accès réel d'un utilisateur à un projet — distincte d'une `tenant_membership` (appartenance à l'organisation). Voir `docs/contracts/schema-and-migrations.md` pour la structure exacte des deux tables.

Pour la V1, un bundle principal par membership suffit (Contributeur, Éditeur, Pilote, Administrateur projet) ; pas besoin d'inventer tout de suite des overrides de capabilities utilisateur par utilisateur — cette granularité fine pourra venir plus tard si un vrai besoin l'exige.

Le code demande toujours une capability précise (`content.edit`, `publication.publish`), jamais un rôle nommé (`est-il Éditeur ?`) — les bundles composent les capabilities, dans un seul sens.

## Organization, pas Tenant, dans l'interface

**Tenant** reste le terme technique de l'isolation en base de données — c'est le mot qu'on trouvera dans le schéma, les migrations, le code serveur.

**Organization** (Organisation) est le concept produit, le seul terme visible dans Storm Control. On ne doit jamais voir « Tenant settings » dans l'interface — l'utilisateur ne devrait jamais avoir besoin de connaître ce mot.

## Connexions temps réel (P3/P4 multi-user)

« Connecté à une session collaborative » et « autorisé à écrire » sont deux choses distinctes. Une connexion peut être établie en lecture seule ; les permissions peuvent être réévaluées en cours de session (token de session synchronisé), pas seulement vérifiées une fois à la connexion.

## Ce qui reste à trancher avant le premier schéma DB

- Mécanisme d'héritage éventuel entre rôles et capabilities si un jour un bundle a besoin de composer un autre bundle (pas nécessaire pour la V1, ni anticipé avant qu'un vrai besoin ne se présente).
