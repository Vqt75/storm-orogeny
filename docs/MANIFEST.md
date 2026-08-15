Status: Draft
Generation: Orogeny

# Storm Orogeny — Manifeste

Tectonic a prouvé que Storm fonctionnait.

Orogeny en fait un produit.

Storm n'est plus seulement l'expérience numérique d'un projet. Orogeny transforme Storm en une plateforme capable d'accueillir plusieurs organisations, plusieurs projets, plusieurs utilisateurs, plusieurs niveaux de responsabilité — sans faire porter cette complexité à ceux qui l'utilisent.

## Principe central

Storm absorbe la complexité. L'utilisateur garde la décision.

Plus Storm devient puissant, moins cette puissance doit encombrer son interface.

## Les cinq grandes briques

Orogeny s'organise autour de cinq espaces, chacun répondant à une question différente.

```
                              STORM
                                │
        ┌───────────────────────┼────────────────────────┐
        │                       │                        │
 Storm Control              Storm Home          Meet Storm Orogeny
   gouverner                s'orienter             découvrir
                                │
                     ┌──────────┴──────────┐
                     │                     │
               Projet existant       Nouveau projet
                     │                     │
                     │               Project Setup
                     │                     │
                     └──────────┬──────────┘
                                │
                         Project Shell
                                │
                 ┌──────────────┼──────────────┐
                 │              │              │
               Studio        Pilotage        Ivory
```

**Storm Control** — *comment Storm est administré ?* Gouvernance de l'organisation/tenant : utilisateurs, groupes, projets, memberships, bundles de permissions, ressources organisationnelles partagées, templates, politiques, intégrations. Storm Control n'est pas conçu comme un terminal sysadmin générique — il appartient au même produit Orogeny, mais son langage visuel peut être légèrement plus dense, plus graphite, davantage "engine room", sans jamais devenir un tableau de bord d'ingénieur.

**Storm Home** — *où est-ce que je travaille ?* Le vestibule personnel. Calme, visuel, peu dense. On y retrouve ses projets et on repart immédiatement travailler.

**Project Setup** — *comment ce projet vient-il à exister ?* Orogeny conserve le principe déjà validé dans Tectonic d'une création guidée de projet. La création d'un projet n'est pas un formulaire administratif ni un Studio vide. Storm collecte progressivement les informations nécessaires, produit une première configuration cohérente, puis conduit l'utilisateur dans le Project Shell.

> **Project Setup amorce. Studio approfondit.**

Le même parcours peut être lancé depuis Storm Home (pour un utilisateur disposant de la capability nécessaire) ou depuis Storm Control (pour un administrateur qui crée un projet puis l'attribue). Un seul moteur de création, deux points d'entrée — on ne construit jamais deux wizards.

**Project Shell** — *je travaille sur ce projet.* L'environnement persistant d'un projet une fois qu'il existe. Studio, Pilotage et Ivory y vivent.

**Meet Storm Orogeny** — *pourquoi tout ça existe ?* Une surface dédiée à la présentation de la génération, indépendante de Storm Home, Storm Control et Project Shell. Elle raconte le produit par l'expérience et les comportements réels, jamais par une liste de fonctionnalités, et jamais en simulant une capacité qu'Orogeny ne sait pas réellement faire.

> **Meet Orogeny montre. Le produit prouve.**

## Ce qu'Orogeny doit permettre

- plusieurs organisations ;
- plusieurs projets ;
- plusieurs utilisateurs ;
- des permissions compréhensibles ;
- un Studio réellement partagé ;
- une sauvegarde continue du travail ;
- une publication toujours explicite ;
- une expérience publique propre à chaque projet ;
- un Pilotage fondé sur des signaux réels ;
- Storm Match capable d'évoluer vers LiquidCore ;
- une architecture pouvant devenir collaborative en temps réel sans être CRDT-dependent dès le premier jour.

## Unité d'isolation et unité de travail

L'organisation/tenant est l'unité fondamentale d'isolation.

Le projet est l'unité principale de travail, mais pas nécessairement l'unité organisationnelle maximale.

Toute donnée appartient explicitement à un tenant. Toute donnée liée à un projet connaît explicitement son projet. Certaines ressources pourront exister au niveau organisation et être partagées entre plusieurs projets.

Orogeny ne doit jamais supposer :

- un projet = un bâtiment ;
- un projet = une population ;
- un projet = une vague.

Ces dimensions pourront être introduites plus tard, notamment avec Strata.

## Travail vs publication

Save = continuité du travail.

Publish = décision.

Orogeny vise l'autosave. Publier reste toujours une action humaine explicite. Le brouillon et la version visible par les collaborateurs restent deux états distincts.

La chaîne conceptuelle héritée de Tectonic reste :

```
Draft
  ↓
Candidate
  ↓
Compiler
  ↓
Published snapshot / Manifest
  ↓
Ivory
```

Le contrat traverse la génération. L'implémentation Tectonic ne doit pas être copiée aveuglément.

## Human Experience

Orogeny ne cherche pas à afficher sa puissance.

La complexité est une responsabilité du système, pas de l'utilisateur. L'interface révèle une capacité lorsqu'elle devient utile — elle ne garde pas en permanence à l'écran tout ce que Storm sait faire.

Le produit doit réduire :

- l'incertitude ;
- les confirmations inutiles ;
- les choix techniques ;
- les changements de contexte ;
- la question « est-ce que c'est enregistré ? » ;
- la question « où suis-je ? » ;
- la question « est-ce que je peux faire ça ? ».

## Design

Storm fournit le calme. Le projet apporte le caractère.

Orogeny n'hérite pas du champagne/Italiana de Tectonic. Direction :

- canvas chaud très clair ;
- surfaces blanches ;
- graphites précis ;
- `#000000` utilisé comme matière forte et rare ;
- couleur portée principalement par l'identité des projets ;
- Parella gold utilisé avec retenue ;
- une excellente famille sans-serif ;
- profondeur par les couches, matériaux, hiérarchie et mouvement ;
- pas de Liquid Glass généralisé ;
- motion fonctionnelle, jamais décorative.

## Grounding

Pas de connaissance projet → pas de réponse projet.

Grounding avant éloquence. Abstention avant hallucination. Le principe désormais éprouvé dans Tectonic est non négociable.

## Pilotage

Observer sans surveiller.

Les signaux doivent être :

- réels ;
- collectifs ;
- minimisés ;
- explicables ;
- associés à une finalité ;
- protégés contre les lectures trompeuses de petits effectifs.

Storm ne prétend jamais avoir observé ce qu'il n'a pas observé.

## Accessibilité

Focus, clavier, Escape, restitution du focus, reduced motion, touch targets, contraste et sémantique ne sont pas du polish final.

Ce sont des propriétés du produit.

## Division du travail

**Human Experience / design / front créatif** — Vivien + ChatGPT : Storm Home, design system visuel, Studio UX, Command Layer, interaction design, responsive, motion, micro-interactions, wording, prototypes/front code, **Meet Storm Orogeny** (concept, storyboard, wording, DA, motion, front, interactions, code de l'expérience).

**Claude** : architecture repo, backend, DB, migrations, permissions, adapters, intégration du front fourni, tests, Git, sécurité technique, analyse critique — et pour Meet Storm Orogeny spécifiquement : route, intégration dans storm-orogeny, assets/build, branchement éventuel aux vraies données, tests. **Aucune réinterprétation créative.**

Si une décision front pose un problème technique, le problème est remonté avant toute modification.
