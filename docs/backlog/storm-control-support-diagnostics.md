Status: Draft — backlog, aucune implémentation prévue avant Storm Control V1 (Phase 1C) au plus tôt
Generation: Orogeny

# Storm Control — Support & Diagnostics

Ce document capture une doctrine future, pas un chantier en cours. Rien ici ne doit être implémenté avant Storm Control V1 (Phase 1C) — et même à ce moment-là, seulement si un vrai besoin de support se présente. L'objectif de ce document est de ne pas perdre la décision maintenant, pendant que Phase 0 (permissions, capabilities) vient d'être posée et que l'endroit où accrocher cette future capacité est encore clair.

## Doctrine support

**Le support Storm ne doit jamais nécessiter les credentials d'un utilisateur.**

Un opérateur/DSI doit pouvoir diagnostiquer un incident depuis Storm Control sans se connecter avec le compte de la personne concernée.

Trois niveaux futurs, conceptuels seulement — **non implémentés** :

```
support.diagnostics
support.view_as_user
support.elevated_access
```

## Actor ≠ Subject

Lors d'une future session support :

- **actor** = l'opérateur réellement connecté ;
- **subject** = l'utilisateur dont on reproduit le contexte.

L'identité réelle de l'opérateur ne doit jamais être remplacée dans les logs/audits.

> Vivien ouvre une vue support d'Alice.

et jamais :

> Vivien devient Alice.

Cette distinction actor/subject devra un jour se refléter dans le modèle d'audit (qui a fait quoi, en tant que qui), pas seulement dans l'UI — mais aucune table, aucun champ n'est créé maintenant.

## Support & Diagnostics — ce que Storm Control devra permettre

Selon les droits, consulter :

- identité et statut utilisateur ;
- tenant et project memberships ;
- capabilities effectives ;
- contexte projet ;
- état du draft / revision ;
- état d'autosave / synchronisation ;
- erreurs API et identifiants d'incident ;
- informations techniques nécessaires au diagnostic.

La collecte et l'exposition devront respecter le contrat privacy-by-design (`docs/contracts/privacy-and-data-governance.md`) : uniquement ce qui est nécessaire au diagnostic, jamais « parce que c'est un admin ».

## View as user (futur)

Fonctionnalité explicitement identifiable comme mode support :

- temporaire ;
- auditable ;
- motif obligatoire ;
- durée limitée ;
- opérateur réel toujours visible ;
- lecture seule par défaut ;
- aucune publication/suppression/modification sensible implicite.

## Elevated support / break-glass (futur, exceptionnel)

- capability dédiée ;
- justification ;
- durée courte ;
- journalisation ;
- révocation/expiration automatique ;
- **jamais un pouvoir implicite de `organization_admin`** — cohérent avec l'invariant déjà posé dans `docs/contracts/permissions.md` (visibilité/gouvernance transverse ≠ droit automatique d'agir sur tout).

## Human Experience de Storm Control

Storm Control partage la grammaire Orogeny mais n'a pas la même densité qu'Ivory ou Studio. Publics : opérateurs Storm, ADC, DSI, ingénieurs — il peut donc exposer davantage d'informations techniques (UUID, revisions, timestamps, capabilities, codes d'erreur, états système).

> **Technical does not mean hostile. Power does not mean clutter.**

Direction :

- interface plus dense mais extrêmement hiérarchisée ;
- matière graphite/noire possible pour marquer la couche système ;
- détails techniques progressifs/repliables ;
- statuts immédiatement compréhensibles ;
- logs structurés, jamais un mur de texte par défaut ;
- excellente navigation clavier ;
- aucune ambiguïté entre observer et agir ;
- confirmations réservées aux gestes sensibles ;
- erreurs indiquant l'action suivante ;
- qualité d'interaction et de finition au niveau du reste d'Orogeny.

C'est probablement l'endroit où la philosophie Cupertino sera la plus intéressante à appliquer : pas en simplifiant artificiellement l'information, mais en faisant en sorte qu'une grande quantité d'information reste calme, intelligible et maîtrisable. **Pas un `AdminDashboard.jsx` générique avec sidebar grise, tableaux et bouton bleu Bootstrap.**

## Ce qui reste à trancher, le moment venu

- Modèle exact de journalisation actor/subject (table dédiée, ou champs sur les logs existants) ;
- Granularité exacte des trois capabilities `support.*` ;
- Mécanisme technique de `view_as_user` (session parallèle, token scoped, autre) ;
- Durée par défaut d'une session support et d'un accès elevated.
