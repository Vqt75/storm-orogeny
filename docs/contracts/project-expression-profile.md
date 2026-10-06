# Project expression profile — V1

`expressionProfile` is a first-class persisted project setting, independent of
brand identity. It lives in `project_identity.expression_profile` to reuse the
existing identity editor, optimistic version and author attribution. No new
table is required. Some publishable projects have identity but no locale
settings row; this contract does not synthesize locale settings.

| Value | Frozen V1 semantics |
| --- | --- |
| `balanced` | Neutral composition, moderate spacing, balanced text/media proportions, neutral navigation emphasis, calm standard transition timing. |
| `editorial` | More generous vertical rhythm, greater asymmetry tolerance, stronger narrative emphasis, immersive media proportions, calmer/slightly longer transitions, project/story-first navigation emphasis. |
| `panoramic` | Denser vertical rhythm, broader/panoramic media, distributed composition, faster/direct transitions, exploration/content-surface emphasis. |

Profiles never select colors, font families, imagery, copy or logos. Those remain
configured identity/content inputs. No inference from name, brand, fonts or industry.
No client-specific profiles. This lot defines semantics only, with no renderer mapping.

## Persistence and editing

Migration 0020 adds a NOT NULL column with a closed CHECK and explicit database
default `balanced`. PostgreSQL backfills existing identity rows; new identity
rows persist the same value unless explicitly changed. Historical publications
are not rewritten. Existing publications predating this contract may therefore
lack `presentation`; the future consumer must address that compatibility
explicitly, not invent a project expression profile.

Studio Identity exposes Balanced / Éditorial / Panoramique and one short
description. PATCH `/api/projects/:projectId/expression-profile` requires
`project.manage`, canonical `expressionProfile` and integer `version`. The
write is tenant/project scoped, uses identity optimistic versioning and the
project deletion guard. Stale writes return 409; invalid values return 400.
Changing a draft never changes the public access identity or active publication.

## Publication

The publication's REPEATABLE READ snapshot captures the stored profile as
`snapshot.expressionProfile`; Candidate explicitly whitelists it. Compiler
rejects missing/unknown/noncanonical values with `EXPRESSION_PROFILE_INVALID`.
The only public occurrence is:

```json
{"presentation":{"expressionProfile":"balanced"}}
```

The additive Manifest V1 field does not modify branding, navigation, content,
public access or workspace settings. Publication N freezes its profile;
changing Studio leaves N and historical N unchanged; N+1 captures the new draft.
The compiler never normalizes an unknown or missing selection to `balanced`.
Ivory and Storm Match do not consume or reinterpret the profile in this lot.
