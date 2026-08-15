Status: Accepted
Generation: Orogeny

# Contrat de gouvernance des données — Privacy by design and by default

## Invariant architectural

**Privacy by design and by default is an architectural requirement.**

Toute nouvelle donnée doit avoir, avant implémentation : une finalité, une justification de nécessité, un périmètre d'accès, une durée de conservation et une stratégie d'effacement.

> **If Storm does not need the data, Storm does not collect it.**

Ce principe traverse Tectonic (télémétrie minimisée, abstention avant hallucination) et se poursuit dans Orogeny comme exigence de conception, pas comme conformité ajoutée après coup. La CNIL recommande explicitement d'intégrer la protection des données dans le cycle de développement, pas comme un correctif de dernière minute avant mise en production.

## Ce que cet invariant signifie concrètement dans Orogeny

- **Storm Control n'est pas un passe-partout.** `control.access`, `projects.view_all`, `organization.members.manage` sont des droits explicites — voir `docs/contracts/permissions.md`. Gouverner le parc de projets ne donne jamais automatiquement le droit de lire ou modifier leur contenu.
- **Isolation tenant dès PostgreSQL** — une incohérence cross-tenant est refusée par la base elle-même, pas seulement par une condition applicative (voir `docs/contracts/schema-and-migrations.md`, prouvé par tests réels).
- **Accès au moindre privilège** — un membre de l'organisation ne voit pas automatiquement tous les projets. Une `project_membership` ou une capability transverse explicite est nécessaire.
- **AuthN ≠ Authorization** — voir la section dédiée ci-dessous.
- **Télémétrie minimisée** — pas de verbatim, d'URL, de contentId ou d'userId conservés par défaut, cohérent avec le principe de minimisation déjà appliqué dans Tectonic.
- **Durées de conservation explicites** — chaque catégorie de donnée a un contrat de rétention, pas une conservation indéfinie par défaut.
- **Pas de surveillance individuelle dans Pilotage** — observer sans surveiller, signaux collectifs, protection contre les petits effectifs (voir `docs/OROGENY_MANIFESTO.md`).
- **Sécurité dès la dalle** — contrôle serveur, isolation, secrets hors du navigateur, sauvegardes, recovery, journalisation appropriée.

## AuthN et Authorization — deux couches qui ne fusionnent jamais

> **AuthN answers "who are you?" Authorization answers "what may you do?"**

```
DevAuth (Phase 0) → user_id
SSO DSI (futur)   → user_id
                       ↓
                  memberships
                       ↓
                  capabilities
                       ↓
                  allow / deny
```

Le mécanisme d'identité (dev header aujourd'hui, SSO d'entreprise demain) ne fait que résoudre un `user_id`. Tout ce qui suit — memberships, capabilities, décision d'autorisation — est un moteur unique, inchangé quel que soit le mécanisme d'authentification en amont. Si une DSI branche un jour son SSO, elle ne doit jamais avoir à reconstruire les droits Storm.

## Doctrine Storm Control — administrer ne vaut pas accès général

**Pouvoir administrer Storm ne donne accès qu'aux données nécessaires à cette administration.**

Une personne chargée de gouverner 80 projets peut voir : nom du projet, statut, propriétaires, membres, permissions, dates, configuration technique — sans nécessairement pouvoir ouvrir : les contenus éditoriaux, les données Pilotage détaillées, les communications internes, si sa mission n'en a pas besoin. Voir `docs/contracts/permissions.md` pour le modèle de capabilities organisationnelles qui rend cette distinction réelle, pas seulement déclarée.

## Ce qui reste hors de portée d'une architecture, à faire avant tout déploiement client réel

Une architecture privacy-by-design ne suffit pas, à elle seule, à certifier la conformité RGPD. Avant un vrai déploiement :

- déterminer, pour chaque usage, si le client est responsable de traitement et Parella sous-traitant (ou l'inverse) ;
- tenir le registre des traitements (finalités, catégories, destinataires, durées, mesures de sécurité) ;
- contractualiser correctement la sous-traitance le cas échéant ;
- évaluer si une AIPD (analyse d'impact) est nécessaire — la CNIL cite notamment la surveillance systématique, le scoring/profilage et les données sensibles parmi les critères déclenchants. Pilotage, les populations de contexte, et une future contextualisation Strata sont les zones les plus susceptibles de déclencher cette évaluation.

Ce contrat ne remplace pas une validation DPO/juridique avant production — il garantit que l'architecture ne parte pas d'une position à corriger après coup.
