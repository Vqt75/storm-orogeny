Status: Accepted
Generation: Orogeny

# ADR 0002 — Séparation identité / adressage / politique d'accès d'un projet

## Contexte

Avant Project Setup et Publication (Phases 1B/3), une frontière architecturale doit être posée maintenant, sans être implémentée maintenant : l'identité technique d'un projet, son adresse de diffusion publique et sa politique d'accès sont trois choses distinctes, qui ne doivent jamais être confondues dans le modèle de données ni dans le code, même si Phase 0 n'a besoin d'aucune des deux dernières.

## Décision

**L'identité d'un projet ≠ son adresse de diffusion ≠ sa politique d'accès.**

- `project.id` — identité technique stable, jamais réutilisée, jamais dérivée d'une information métier qui pourrait changer.
- `project.name` — nom métier, modifiable librement, sans aucune conséquence sur l'identité ni l'adressage.
- Le futur slug/domaine/URL publique est un **mécanisme d'adressage**, séparé de l'identité. L'URL appartient à l'expérience du projet et reste stable à travers les publications — Publier change la version servie, jamais l'adresse.
- **Connaître l'URL ne constitue jamais une autorisation.** L'accès à un projet reste entièrement gouverné par les memberships et capabilities (voir `docs/contracts/permissions.md`), indépendamment de la question de savoir si l'adresse est publique, devinable ou secrète.
- Futurs modes d'accès envisagés, non implémentés : lien ouvert, authentifié, accès restreint.
- Domaines personnalisés et SSO sont des capacités futures d'infrastructure (Phase 8 — Enterprise hardening), pas une extension du modèle d'identité du projet.

## Conséquence immédiate pour Phase 0

**Ne pas créer de `ProjectExperience` (ou équivalent) en base pendant Phase 0.** Aucun dossier `src/project-experience/`, `src/domains/`, `src/url-engine/` maintenant. Cette frontière est gravée maintenant ; la capacité sera codée plus tard, au moment logique — probablement Project Setup + Publication, quand un nouveau projet devra réserver une adresse et qu'Ivory devra savoir quel projet servir.

## Schéma conceptuel visé, plus tard

```
Project
  └── future Project Experience
      ├── addressing        (slug / domaine / URL)
      ├── access policy     (ouvert / authentifié / restreint)
      └── published experience
```

`Project` (Phase 0) porte l'identité et les données de travail. `Project Experience` (futur) portera tout ce qui concerne comment ce projet est effectivement adressé et exposé — une extension, jamais une fusion avec l'identité.
