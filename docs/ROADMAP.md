Status: Draft
Generation: Orogeny

# Storm Orogeny — Roadmap

Deux pistes parallèles, jamais confondues : une piste produit (bloquante, séquentielle) et une piste de présentation (jamais bloquante, ne prend jamais d'avance sur ce que le produit sait réellement faire).

```
PRODUCT TRACK
0   Foundations
1A  Storm Home
1B  Project Setup
1C  Storm Control V1
2   Project Shell + Studio
3   Publication
4   Storm Command Layer
5   Pilotage Orogeny
6   Multi-user
7   LiquidCore
8   Enterprise hardening

SHOWCASE TRACK
Meet Orogeny
  ↳ commence quand Storm Home existe réellement
  ↳ s'enrichit au fil des fonctionnalités disponibles
  ↳ ne simule jamais une capacité qui n'existe pas
```

---

## Phase 0 — Foundations

Objectif : faire exister Orogeny techniquement — y compris les fondations de données dont Storm Control aura besoin plus tard (Home dépend précisément des organisations, utilisateurs, projets et memberships qu'il faudra un jour administrer).

- nouveau repo ;
- Node côté serveur ;
- PostgreSQL réel dès le développement local ;
- migrations ;
- véritable architecture de routing/API ;
- Tenant ;
- User ;
- Project ;
- Membership ;
- capabilities/permissions ;
- ressources organisationnelles (Groups, Templates, Policies, Integrations) ;
- adapters infrastructure ;
- error model ;
- logs ;
- premières conventions de tests ;
- design tokens structurants.

**Aucun Yjs. Aucune Command Layer. Aucun LiquidCore.**

## Phase 1A — Storm Home

Première verticale produit visible.

- authentification locale/dev ;
- projets accessibles à l'utilisateur ;
- identité projet ;
- sélection de carte ;
- Ouvrir ;
- permissions réelles côté serveur.

**Milestone 1 :**
> Je me connecte. Storm sait qui je suis. Il me montre mes projets. J'ouvre Clermont.

## Phase 1B — Project Setup

- Nouveau projet ;
- parcours guidé de configuration initiale ;
- création réelle du Project ;
- configuration de départ ;
- arrivée dans le Project Shell.

Reprendre le comportement produit du parcours de création déjà présent dans Tectonic, après audit — sans porter automatiquement son implémentation actuelle. Deux points d'entrée (Storm Home, Storm Control), un seul moteur de Project Setup.

**Milestone 1, complété :**
> ... Ou j'en crée un nouveau, guidé par Storm.

## Phase 1C — Storm Control V1

- liste des projets de l'organisation ;
- utilisateurs ;
- memberships ;
- création/archivage de projet ;
- attribution des accès ;
- configuration organisationnelle minimale.

Pas encore : dashboard technique, logs système énormes, SSO avancé, secrets, observabilité complète — ça viendra avec l'industrialisation (Phase 8).

## Phase 2 — Project Shell + Studio

Reconstruire Studio à partir du domaine métier, jamais par portage de `studio.js`.

- navigation projet ;
- identité ;
- structure ;
- contenus ;
- preview ;
- autosave ;
- optimistic concurrency ;
- erreurs/retry ;
- permissions contextuelles.

## Phase 3 — Publication

- Candidate ;
- Compiler ;
- immutable publication ;
- Manifest ;
- Ivory ;
- draft vs published ;
- historique de publications.

## Phase 4 — Storm Command Layer

Seulement lorsque les vrais états autosave/publication existent.

**Avant code :**
- table de priorité ;
- machine d'état ;
- contrat d'interaction ;
- matrice de tests.

**Invariants :**
> State before shape.
> One owner. One arbiter.
> Focus freezes geometry.
> Motion explains continuity. It never creates it.
> No transient state without an exit.
> The state machine must survive without the interface.

## Phase 5 — Pilotage Orogeny

Les quatre questions produit restent :

1. Est-ce que Storm est utilisé ?
2. Est-ce que les collaborateurs trouvent ce qu'ils cherchent ?
3. Qu'est-ce qui mérite notre attention ?
4. Comment évolue le climat du projet ?

Reprendre les apprentissages de Tectonic, pas nécessairement son implémentation.

## Phase 6 — Multi-user

- P1 identities/memberships — déjà couvert par Foundations.
- P2 présence.
- P3 plusieurs utilisateurs travaillant simultanément sur des contenus différents.
- P4 même contenu en temps réel.

Ne pas commencer directement par P4. P4 pourra utiliser Yjs + Hocuspocus si l'audit technique est toujours favorable au moment de l'implémentation.

## Phase 7 — LiquidCore

En parallèle, construire le benchmark de formulations réelles. Puis :

- Engine lexical ;
- concepts ;
- relations ;
- similarité sémantique ;
- fusion de confiance.

Pas de grand modèle magique remplaçant la connaissance projet.

## Phase 8 — Enterprise hardening

La sécurité commence dès Phase 0, mais l'industrialisation complète comprend ensuite :

- SSO ;
- annuaire ;
- stockage objet ;
- secrets ;
- observabilité ;
- sauvegardes ;
- audit ;
- DPO/RGPD ;
- rétention ;
- incident/recovery ;
- deployment doctrine.

## Après Orogeny

Strata reste R&D/concept pendant Orogeny. Ne pas coder Strata prématurément.

---

## SHOWCASE TRACK — Meet Orogeny

Route provisoire : `/orogeny`. Titre de page : *Meet Storm Orogeny*.

Ne bloque aucune phase produit. Commence dès que Storm Home existe réellement, s'enrichit au fil des fonctionnalités disponibles. Ne simule jamais une capacité qui n'existe pas — une vision peut être annoncée comme vision, mais toute interaction montrée comme fonctionnelle doit correspondre à quelque chose qu'Orogeny sait réellement faire, ou à un prototype clairement assumé comme tel.

Storyboard de référence (à affiner avec le produit réel, jamais figé à l'avance) : ouverture ("Meet Orogeny. Tectonic a prouvé que Storm fonctionnait. Orogeny en fait un produit.") → Storm Home → Project Setup → Multi-user → Permissions → Studio/autosave → Command Layer → Pilotage → LiquidCore (quand prêt) → clôture ("Plusieurs projets. Plusieurs personnes. Une seule matière.").
