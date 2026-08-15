Status: Draft — backlog, aucune implémentation prévue avant la phase Invitation & Account Activation
Generation: Orogeny

# Invitation & Account Activation

Phase 1B (Project Setup) stocke les invitations en `pending` — voir `docs/contracts/locales.md`. Ce document capture ce qu'il restera à construire, pas maintenant.

## Doctrine

**Le mail d'invitation est une surface produit à part entière, pas un détail technique.** C'est potentiellement la toute première chose qu'une personne verra de Storm. Le wording, les variantes et la localisation seront définis côté Human Experience **avant** implémentation de l'envoi — Phase 1B ne construit ni l'envoi, ni le token, ni l'activation.

Deux expériences distinctes, jamais confondues :

- **Nouvelle personne sur Storm** — invitation complète (contexte, projet, niveau d'accès en langage humain, création de compte ou SSO selon l'organisation).
- **Personne déjà utilisatrice de Storm** — pas de récit de découverte ; juste « un nouveau projet vous attend », ouverture directe.

Le mail ne détaille jamais les capabilities techniques (`content.edit`, `publication.publish`) — il traduit en langage humain (« vous pourrez contribuer aux contenus »). Le détail des capabilities appartient à Storm, pas au mail.

## Invitation Experience Contract (structure, pas encore le wording final)

```
Invitation
├── sender / inviter
├── organization
├── project
├── recipient email
├── invitation locale
├── permission bundle
├── recipient state
│   ├── new Storm user
│   └── existing Storm user
└── authentication mode
    ├── local account
    └── SSO
```

Contenu du mail, structure à respecter (contenu réel à définir en Human Experience) :
```
Subject
Preheader
Greeting
Invitation context
Project name
Human-readable access explanation
Primary CTA
Language information if relevant
Security / expiration information
Storm signature
```

## Ce qui reste à construire (pas maintenant)

- Envoi technique (SMTP/service d'envoi) ;
- Génération et validation de token d'invitation, expiration ;
- Écran de création de compte local (mot de passe) ou redirection SSO selon l'organisation ;
- Transformation de l'invitation `pending` en `project_membership` réelle à l'acceptation ;
- Initialisation de `user.interfaceLocale` depuis `invitation.locale` pour un nouvel utilisateur, sans jamais écraser la préférence d'un utilisateur existant (voir `docs/contracts/locales.md`).

## Sur la localisation

Le wording source (français) et ses variantes UX (nouveau/existant) se travaillent d'abord. La traduction dans les six locales supportées (`fr, en, it, es, nl, de`) se fera une fois le parcours Account Activation construit — le mail et les écrans qui suivent doivent parler exactement la même langue et le même vocabulaire, jamais traduits séparément à des moments différents.
