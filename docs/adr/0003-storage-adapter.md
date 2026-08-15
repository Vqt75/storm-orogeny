Status: Accepted
Generation: Orogeny

# ADR 0003 — Storage adapter, implémentation locale strictement derrière l'interface

## Contexte

Le Project Setup (Phase 1B) a besoin de persister un logo réel, pas un simple objet URL local qui disparaît à la fermeture de l'onglet. Aucun object storage réel n'est encore décidé pour Orogeny (sujet d'industrialisation, Phase 8).

## Décision

Une interface de storage minimale, définie une fois, jamais couplée à son implémentation :

```js
adapter.save(buffer, { contentType, extension }) → { storageKey }
adapter.read(storageKey) → Buffer
```

L'implémentation locale (`src/adapters/storage/local.js`, écriture sur disque) respecte strictement cette interface. Aucune route ni aucun domaine ne connaît le mécanisme réel de stockage — tout passe par l'adapter.

## Conséquence

Remplacer l'implémentation locale par un vrai object storage (S3 ou équivalent) plus tard ne change que `src/adapters/storage/`, jamais les routes ni le domaine qui consomment `save()`/`read()`. Le filesystem local n'est jamais gravé comme solution métier — seulement comme implémentation de développement, remplaçable sans changer le contrat.

## Contrat de séquence création + logo

`POST /api/projects/:projectId/logo` suppose que le projet existe déjà — cohérent avec la règle « le projet n'existe qu'au geste final » : le logo ne peut être réellement persisté qu'une fois ce geste effectué.

```
validation finale du Setup
  → POST /api/projects → 201 + projectId
  → si un logo a été choisi → POST /api/projects/:projectId/logo
```

Si cet upload échoue, **le projet n'est jamais recréé** — il existe déjà et reste valide. Le Setup reste sur son état final, avec un feedback explicite ; « Réessayer » ne réexécute que l'upload du logo, jamais `POST /api/projects`. Pas de draft persistant ni de transaction distribuée DB+filesystem pour résoudre ce cas : le logo est une configuration optionnelle, retentable indépendamment de la création elle-même.

## Formats acceptés (Phase 1B)

PNG et JPEG uniquement. **SVG volontairement exclu** — un SVG est du XML actif, pas une image inerte ; le servir depuis le même origin sans sanitisation serait un vrai risque. Réintroduction possible plus tard, derrière une politique de sanitisation explicite et testée.

Le Content-Type annoncé par le client n'est jamais suffisant : la signature binaire réelle du fichier est vérifiée avant toute persistance.

## Modèle de données

Table `assets` (tenant_id + project_id, isolation garantie par FK composite comme partout ailleurs) — une ligne par fichier persistant, `storage_key` opaque référençant l'adapter, jamais un chemin filesystem exposé au domaine ou au front.
