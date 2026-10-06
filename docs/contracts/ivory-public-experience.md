# Ivory controlled replacement

One renderer (`public/ivory/renderers/ivory.js`), one stylesheet (`ivory.css`),
one public loader. The accepted clean-room information architecture and
interaction reference are maintained outside the product repository. No
prototype fixtures, client names, feature flags or legacy renderer fallback.

## Published identity and grammar

The renderer consumes project name, published logo/colors/font assets, editorial
content and media. Primary font remains the main font; secondary font serves
supporting editorial details. Color contrast resolves readable foregrounds
without discarding either configured source color: source colors remain on
controls, surfaces and non-text accents; foregrounds/tints are resolved for
contrast. No external font request. Uploaded font files receive distinct internal
CSS aliases per role, so display names containing punctuation or identical
family names cannot discard or overwrite an uploaded face. When there is no
secondary font, the primary face serves both roles. A configured logo appears
alongside the project name; without a logo the name remains the home identity.

`presentation.expressionProfile` selects balanced, editorial or panoramic
composition, spacing, media proportions, navigation emphasis and motion.
It does not select content, imagery, colors or font family. An unknown value
is rejected. Historical publications predating the profile contract receive
an explicit balanced compatibility grammar when the field is absent; no
profile is inferred from brand inputs and no stored publication is rewritten.

## Public knowledge host

GET `/public/:clientSlug/:projectSlug/:capability/knowledge` resolves the
existing public access lifecycle and active publication, then uses
`activePublicationCorpusForAccess` and `prepareCorpus`. It returns corpus
availability, publication revision/locale and eligible question identities.
Prepared handles, caller scope and tenant/project IDs never cross HTTP.

POST at the same base `/match` accepts exactly `query`, `locale` and
`publicationRevision`. Origin must be same-origin; cross-site requests,
additional fields and invalid input are rejected. The host checks the page's
publication binding, supplies trusted caller scope and invokes stable `match`.
Corpus states remain distinct from semantic results. HTTP deliveries use
no-store and inherit existing noindex/no-referrer/security headers. No Studio
reads, model state, training, Gold metadata or database architecture changes.

The UI submits explicitly, retains its question and morphs results in place.
Covered displays the exact published answer with existing emphasis syntax;
ambiguity offers separate published questions, never merged answers. Selecting
one is direct reading of that published entry, not a caller-injected match
result. notCovered provides only configured human contact channels. Empty and
unavailable omit search; unavailability preserves all other site surfaces.

## Content and interaction preservation

Home consumes compiled featured/latest, now/next and display toggles. Narrative
preserves all nine published block types and author order, including milestones
and team. Spaces preserve media/documents/usages; news preserves structured
runs and safe author links. Ambassadors preserve published contact/join links.
Images open in a native zoom dialog; PDFs use their public document URL.

Existing route hashes (`home`, `timeline`, `spaces`, `space-{id}`, `news`,
`news-{id}`, `ambassadors`, `questions`, `team`) remain reachable. Back navigation
restores collection position and focus. Rails retain native scrolling, keyboard
and boundary-aware controls. Native dialogs restore focus and preserve context.
Reduced motion keeps all destinations/states without animation/smooth scrolling.
Optional anonymous mood response has one canonical entry: a compact fixed
“Météo du projet” button at the lower right. Manual activation opens a small
non-modal contextual panel. The unchanged shared `mood-engine.js` alone governs
meaningful exposure (35-second fallback), calm moments and the 25–40-second
attention threshold. Its invitation briefly reveals the label and emits one
expanding ring; it never opens the panel. Reduced motion retains the label
without the ring. Global historical daily invitation/answer keys are respected,
as are the replacement’s existing answer keys. Already-answered visitors can
still open the acknowledgement manually. Storage failures cannot break the site;
failed submission can be retried. The anonymous mood telemetry API is unchanged.

## Material and scope

Opaque editorial content throughout. The only blur is the transient dialog
backdrop for navigation and media layers. The weather panel is opaque. Disabling blur leaves opaque
readable layers; no content glass, decorative arrows, universal round cards,
synthetic badges, chat framing or client-specific branches.

Superseded renderer/CSS/markup, legacy FAQ presentation glue and the unused
brand-engine script are removed. The historical FAQ facade remains solely for
compatibility and uses the single shared lexical algorithm; Ivory imports no
lexical engine. Generic mood scheduling remains; its floating weather interaction is preserved
inside the accepted presentation, without reinstating the old renderer.
Old presentation-specific source assertions are replaced by behavioral content,
security/state/profile/accessibility tests. Public lifecycle/publication tests
and the domain runtime contracts remain acceptance gates.
