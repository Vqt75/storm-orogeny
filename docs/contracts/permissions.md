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

## Connexions temps réel (P3/P4 multi-user)

« Connecté à une session collaborative » et « autorisé à écrire » sont deux choses distinctes. Une connexion peut être établie en lecture seule ; les permissions peuvent être réévaluées en cours de session (token de session synchronisé), pas seulement vérifiées une fois à la connexion.

## Ce qui reste à trancher avant le premier schéma DB

- Modélisation exacte des Memberships (table de jointure simple vs table avec métadonnées de rôle) ;
- Granularité exacte des capabilities de Phase 1C (Storm Control V1) ;
- Mécanisme d'héritage éventuel entre rôles et capabilities (bundles nommés vs capabilities atomiques exposées directement).
