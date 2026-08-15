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

## Modèle d'invitation (Phase 1B — enregistrement seulement, rien de plus)

`invitation.locale` vit sur une invitation en attente, jamais directement sur un utilisateur avant activation :

```
project_invitation
  id, tenant_id, project_id
  email, permission_bundle, locale
  status = 'pending'
  invited_by_user_id, created_at
```

Phase 1B crée l'invitation `pending` au moment de la validation finale du Setup — dans la même transaction que la création du projet. Elle ne construit ni l'envoi du mail, ni le token, ni l'activation de compte : ce sera le périmètre d'une phase ultérieure (Invitation / Account Activation), qui transformera l'invitation acceptée en `project_membership` réel.

- Utilisateur Storm déjà existant qui accepte : reçoit le membership, `user.interfaceLocale` **jamais écrasé**.
- Nouvel utilisateur qui active son compte : `invitation.locale` initialise `user.interfaceLocale`.

## Registre des locales supportées — source unique

Une seule source de vérité pour la liste des locales supportées (aujourd'hui `fr, en, it, es, nl, de`), consommée par la validation serveur, l'API et le front — jamais dupliquée à plusieurs endroits. Toute contrainte DB (`CHECK`) doit rester cohérente avec ce registre, pas une liste indépendante à maintenir en parallèle.

## Ce qui reste à trancher, le moment venu

- Mécanisme technique exact de résolution en cascade (calculé à la lecture, ou matérialisé) ;
- Ce qui se passe si `project_membership.workspaceLocaleOverride` est retiré alors qu'un utilisateur l'utilisait activement.
