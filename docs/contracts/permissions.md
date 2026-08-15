Status: Draft — à stabiliser avant le premier schéma DB
Generation: Orogeny

# Contrat de permissions

Le serveur vérifie des **capabilities**, jamais des rôles codés en dur dispersés dans le produit. Les rôles/bundles humains sont une couche de composition de ces capabilities, jamais l'inverse.

## Première base de capabilities

### Capabilities de projet

```
project.view
content.edit
publication.publish
pilotage.view
members.manage
project.manage
```

### Capabilities organisationnelles (Storm Control)

Storm Control est une surface organisationnelle réservée aux utilisateurs disposant de capabilities tenant-level explicites — ce n'est pas « le Home de quelqu'un qui aurait beaucoup de projets », c'est le cockpit de ceux qui ont les clés du parc Storm.

```
control.access
projects.view_all
projects.create
projects.manage_memberships
organization.members.manage
organization.settings.manage
```

`projects.view_all` permet de voir l'ensemble des projets du tenant dans Storm Control **sans nécessiter une `project_membership` sur chacun**.

**Important — invariant à ne jamais casser : visibilité/gouvernance transverse ≠ droit automatique d'éditer le contenu de tous les projets.** Les capacités métier d'un projet (`content.edit`, `publication.publish`, etc.) restent normalement attachées aux `project_memberships`, jamais accordées implicitement par une capability organisationnelle. Sans ça, `organization_admin` deviendrait le rôle omnipotent qu'on cherche précisément à éviter — capable d'éditer n'importe quoi partout simplement parce qu'il gouverne l'organisation.

Une capability transverse très élevée (`projects.admin_all`, donnant un droit d'édition sur tous les projets) pourra exister un jour pour deux ou trois personnes si un vrai besoin se présente — mais elle doit être explicite et distincte, jamais une conséquence accidentelle de `control.access` ou `organization_admin`.

Cette liste est délibérément minimale pour Phase 0/1.

## Principe

Jamais :

```js
if (role === 'admin') { ... }
```

dispersé dans le produit. Une capability se vérifie côté serveur, à chaque action sensible — jamais uniquement côté client.

## Deux niveaux distincts

- **Capabilities de tenant (organisation)** — gérées par Storm Control : visibilité/gouvernance transverse du parc de projets (`projects.view_all`, `projects.create`, `organization.members.manage`, ...).
- **Capabilities de projet** — gérées via les Memberships d'un projet donné (éditer le contenu, publier, consulter Pilotage).

Un utilisateur peut avoir des capabilities de projet différentes selon le projet (plusieurs memberships avec des rôles différents), sans que ça nécessite de dupliquer son identité au niveau tenant. Et une capability organisationnelle élevée (`organization_admin`) ne donne **jamais**, par elle-même, une capability de projet sur un projet où l'utilisateur n'a pas de `project_membership` — voir l'invariant ci-dessus.

**L'appartenance au tenant ne donne jamais automatiquement accès aux projets.** Une `project_membership` représente l'accès réel d'un utilisateur à un projet — distincte d'une `tenant_membership` (appartenance à l'organisation). Voir `docs/contracts/schema-and-migrations.md` pour la structure exacte des deux tables.

Pour la V1, un bundle principal par membership suffit. Côté projet : Contributeur, Éditeur, Pilote, Administrateur projet. Côté organisation, le bundle V1 doit distinguer au minimum **member** et **organization_admin**, en restant extensible plus tard à un profil intermédiaire (type opérateur/ADC — visibilité et gestion des accès transverses, sans configuration organisationnelle complète) **sans modifier le moteur d'autorisation lui-même**. Pas besoin d'inventer tout de suite des overrides de capabilities utilisateur par utilisateur.

Le code demande toujours une capability précise (`content.edit`, `publication.publish`), jamais un rôle nommé (`est-il Éditeur ?`) — les bundles composent les capabilities, dans un seul sens.

## Panorama à terme (illustratif, pas encore implémenté au-delà de member/organization_admin)

```
Member              → Storm Home + ses projets (via project_memberships).
Storm Operator/ADC  → + Storm Control, vue globale, gestion des accès.
Organization Admin   → Storm Control complet + configuration organisationnelle.
```

## AuthN ≠ Authorization

> AuthN answers "who are you?" Authorization answers "what may you do?"

Ces deux couches ne fusionnent jamais. Voir `docs/contracts/privacy-and-data-governance.md` pour le schéma complet (DevAuth aujourd'hui, SSO demain, un seul moteur d'autorisation inchangé derrière).

## Organization, pas Tenant, dans l'interface

**Tenant** reste le terme technique de l'isolation en base de données — c'est le mot qu'on trouvera dans le schéma, les migrations, le code serveur.

**Organization** (Organisation) est le concept produit, le seul terme visible dans Storm Control. On ne doit jamais voir « Tenant settings » dans l'interface — l'utilisateur ne devrait jamais avoir besoin de connaître ce mot.

## Connexions temps réel (P3/P4 multi-user)

« Connecté à une session collaborative » et « autorisé à écrire » sont deux choses distinctes. Une connexion peut être établie en lecture seule ; les permissions peuvent être réévaluées en cours de session (token de session synchronisé), pas seulement vérifiées une fois à la connexion.

## Ce qui reste à trancher avant le premier schéma DB

- Mécanisme d'héritage éventuel entre rôles et capabilities si un jour un bundle a besoin de composer un autre bundle (pas nécessaire pour la V1, ni anticipé avant qu'un vrai besoin ne se présente).
