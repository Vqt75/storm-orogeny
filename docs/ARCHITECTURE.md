Status: Draft
Generation: Orogeny

# Storm Orogeny — Architecture

## Architecture de départ

```
                              STORM
                                │
        ┌───────────────────────┼────────────────────────┐
        │                       │                        │
 Storm Control              Storm Home          Meet Storm Orogeny
   gouverner                s'orienter             découvrir
  (organisation)         (espace personnel)      (surface de présentation,
                                │                  indépendante du produit)
                     ┌──────────┴──────────┐
                     │                     │
               Projet existant       Nouveau projet
                     │                     │
                     │               Project Setup
                     │                (guidé, amorce
                     │                 seulement)
                     └──────────┬──────────┘
                                │
                         Project Shell
                        (environnement
                         persistant du projet)
                                │
                 ┌──────────────┼──────────────┐
                 │              │              │
               Studio        Pilotage        Ivory
             (construit)    (observe)      (exprime)
```

Storm Control administre le niveau **Tenant** (appelé **Organisation** dans l'interface — voir note de vocabulaire ci-dessous). Project Setup/Studio administrent le niveau **Project**. Cette frontière est volontaire : on ne place jamais « gérer tous les utilisateurs de l'organisation » dans les réglages d'un projet particulier, faute d'avoir donné un domicile à cette fonction ailleurs.

> **Vocabulaire.** *Tenant* reste le terme technique de l'isolation en base de données — celui du schéma, des migrations, du code serveur. *Organization* est le concept produit, le seul terme visible dans Storm Control. On ne doit jamais voir « Tenant settings » dans l'interface.

## Backend

```
HTTP/API
   ↓
AuthN
   ↓
Tenant isolation
   ↓
Authorization / capabilities
   ↓
Domain services
   ↓
PostgreSQL
```

Infrastructure externe derrière des adapters :

```
auth/
storage/
email/
sso/
observability/
```

En développement, ces adapters peuvent avoir des implémentations simples. La base reste PostgreSQL — pas de fichier JSON unique comme source de vérité, dès le premier jour de développement local.

## Premier modèle de données

```
Tenant (Organisation, côté produit)
  ├── Users
  ├── Tenant memberships   (appartenance à l'organisation)
  ├── Groups
  ├── Templates
  ├── Policies
  ├── Integrations
  ├── Organization resources
  └── Projects
        ├── Project memberships   (accès réel à CE projet — jamais hérité du tenant)
        ├── Project identity
        ├── Content
        ├── Draft state
        ├── Publications
        ├── Pilotage
        └── Configuration
```

Une `tenant_membership` ne donne jamais automatiquement accès à un projet. L'accès réel à un projet passe toujours par une `project_membership` explicite, porteuse au minimum d'un bundle de permissions, d'un statut et de métadonnées d'attribution — voir `docs/contracts/schema-and-migrations.md` et `docs/contracts/permissions.md`.

### Identité, adressage et accès d'un projet — frontière posée, pas encore implémentée

```
Project
  └── future Project Experience
      ├── addressing        (slug / domaine / URL)
      ├── access policy     (ouvert / authentifié / restreint)
      └── published experience
```

`project.id` est l'identité technique stable ; `project.name` est le nom métier modifiable. L'adresse de diffusion publique (futur) est un mécanisme séparé, stable à travers les publications. Connaître l'URL ne constitue jamais une autorisation. Voir `docs/adr/0002-project-experience-addressing.md` — aucune implémentation avant Project Setup/Publication (Phases 1B/3).

Le tenant est l'unité d'isolation fondamentale. Le projet est l'unité principale de travail, mais pas nécessairement l'unité organisationnelle maximale. Ne pas ajouter maintenant de hiérarchie Programme/Sous-projet récursive — Orogeny ne doit simplement jamais supposer qu'un projet équivaut à un seul bâtiment, une seule population ou une seule vague ; ces dimensions de contexte pourront être introduites plus tard (Strata) sans que le modèle actuel ne s'y oppose.

## Permissions

Le serveur vérifie des **capabilities**, jamais des rôles codés en dur dispersés dans le produit — voir `docs/contracts/permissions.md` pour le modèle complet (capabilities de projet, capabilities organisationnelles Storm Control, et l'invariant central : visibilité/gouvernance transverse ≠ droit automatique d'édition sur tous les projets).

Les rôles/bundles humains sont une couche de composition de ces capabilities, jamais l'inverse. Jamais :

```js
if (role === 'admin') { ... }
```

### AuthN ≠ Authorization

> AuthN answers "who are you?" Authorization answers "what may you do?"

```
DevAuth (Phase 0) → user_id
SSO DSI (futur)   → user_id
                       ↓
                  memberships → capabilities → allow / deny
```

Un seul moteur d'autorisation, inchangé quel que soit le mécanisme d'identité en amont — voir `docs/contracts/privacy-and-data-governance.md`.

dispersé dans le produit.

## Données

- IDs stables et opaques ;
- tenant explicite ;
- project explicite lorsqu'applicable ;
- contenu structuré, jamais un blob HTML canonique ;
- `schemaVersion` ;
- migrations explicites ;
- optimistic concurrency ;
- une seule autorité de brouillon par entité.

**P3 (multi-user, plusieurs personnes sur des contenus différents) doit être CRDT-ready without being CRDT-dependent.** Le contenu stocké en P3 doit pouvoir migrer vers une représentation collaborative en P4 sans réécriture douloureuse — champs structurés dès le départ, jamais un schéma Yjs préconstruit avant que la vraie concurrence éditoriale ne le justifie.

## Multi-user futur (P4)

Lorsqu'un contenu devient réellement collaboratif :

```
Project
   │
Content entity
   │
Y.Doc if collaboration is required
   │
collaborative draft
   │
publication checkpoint
   │
canonical JSON
   │
Candidate → Compiler → Manifest
```

Le CRDT ne devient jamais directement la version publique. Le Y.Doc vivant et sa persistance binaire durable forment une seule vérité logique (le brouillon collaboratif), pas deux couches métier distinctes — voir `docs/contracts/collaboration/publication-boundary.md`.

## Chaîne de publication héritée de Tectonic

Le contrat traverse la génération ; l'implémentation Tectonic ne doit pas être copiée aveuglément.

```
Draft → Candidate → Compiler → Manifest → Ivory
```
