Status: Accepted
Generation: Orogeny

# Contrat des langues

Il n'existe pas une seule « langue Storm ». Quatre scopes distincts, jamais fusionnés dans un champ générique `language` — chacun répond à une question différente et peut légitimement diverger des trois autres.

> Storm accueille la personne dans sa langue. Le projet travaille dans la sienne. Les collaborateurs reçoivent la communication dans la leur.

## Les quatre scopes

### 1. `invitation.locale` — langue de l'invitation

Choisie par la personne qui invite, au moment de l'invitation. Sert uniquement :
- la langue du mail d'invitation ;
- la langue de la première expérience Storm d'un nouvel utilisateur.

**Ne s'applique qu'à l'invitation elle-même.** Pour un utilisateur Storm déjà existant, l'invitation ne doit jamais écraser silencieusement sa préférence personnelle déjà établie — elle détermine seulement la langue de cette invitation précise.

### 2. `user.interfaceLocale` — préférence personnelle

À l'activation du compte, `invitation.locale` devient le point de départ de `user.interfaceLocale` — jamais une valeur verrouillée à vie. La personne doit pouvoir la modifier elle-même depuis son menu de compte / Command Layer.

Sert : Storm Home et les surfaces Storm hors contexte projet (Storm Control, menu de compte).

### 3. `project.workspaceLocale` — langue de travail du projet

Langue par défaut dans laquelle l'équipe utilise les surfaces de travail : Project Shell, Studio, Pilotage, et autres surfaces project-scoped.

Peut différer de `user.interfaceLocale`. Exemple réel : Vivien a `interfaceLocale = fr` (Storm Home en français), mais le projet WTW France (équipe internationale France + Londres) a `workspaceLocale = en` — en entrant dans WTW, l'interface projet passe en anglais ; en revenant au Home, Storm redevient français.

### 4. `project.contentLocale` — langue des communications collaborateurs

Langue principale des contenus destinés aux collaborateurs, de l'expérience Ivory. **Ne dépend jamais de `workspaceLocale`.**

Exemple réel : `workspaceLocale = en` (l'équipe travaille en anglais avec Londres), `contentLocale = fr` (les communications publiées visent des collaborateurs français). Les deux choix du Setup peuvent parfaitement différer.

## Évolution future — à ne pas construire maintenant

```
project_membership.workspaceLocaleOverride
```

Préférence individuelle d'un membre pour un projet donné (ex. Joséphine préfère `fr` sur un projet en `workspaceLocale = en`). Pas implémenté en Phase 1B — mais l'architecture actuelle ne doit jamais en empêcher l'ajout ultérieur.

Résolution future envisagée, jamais construite avant qu'elle soit réellement nécessaire :

```
Dans Home / Control (hors projet) :
  user.interfaceLocale

Dans un projet :
  project_membership.workspaceLocaleOverride
      ↓ sinon
  project.workspaceLocale
      ↓ sinon
  user.interfaceLocale
```

Cette résolution n'a **jamais** d'effet sur `project.contentLocale` — les deux chaînes de résolution restent totalement indépendantes.

## Ce que ça implique pour le modèle de données

`workspaceLocale` et `contentLocale` ne sont **pas** des attributs d'identité visuelle — ils vivent avec la configuration du projet (`project_settings` ou équivalent), jamais dans la même table que logo/couleurs/typographies/thème (`project_identity`). Le découpage sémantique est explicite, même si les noms exacts de table peuvent suivre les conventions déjà établies dans le repo.

## Ce qui reste à trancher, le moment venu

- Mécanisme technique exact de résolution en cascade (calculé à la lecture, ou matérialisé) ;
- Ce qui se passe si `project_membership.workspaceLocaleOverride` est retiré alors qu'un utilisateur l'utilisait activement.
