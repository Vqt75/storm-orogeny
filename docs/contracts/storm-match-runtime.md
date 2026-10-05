Status: Accepted
Generation: Orogeny

# Storm Match runtime boundary

The stable service entry points are `prepareCorpus(snapshot)` and
`match({ corpus, query, locale, caller })` from `src/domain/stormMatch/runtime.js`.
This lot installs the boundary; it does not connect the current Ivory renderer,
add an endpoint, change presentation, or introduce a semantic model.

## Preparation and trust

Resolve public access and the active publication through the existing
`activePublicationCorpus.js` adapter. Pass its `snapshot` to `prepareCorpus`.
The existing V1.1 adapter brands snapshots in a process-local WeakSet without
changing their serialized content, fingerprints or identities. Null, unavailable,
constructed or JSON-copied snapshots produce `CORPUS_UNAVAILABLE` with reason
`SNAPSHOT_UNTRUSTED`. Preserve the upstream adapter reason separately when needed.
This provenance mechanism is not authorization: the host must resolve access
before creating a snapshot. A future HTTP transport must reconstruct/revalidate
snapshots on the trusted service side, not trust client JSON.

Preparation returns `{ state, reason, corpus }`:

- `CORPUS_READY`: immutable opaque handle, eligible entries retained privately.
- `CORPUS_EMPTY`: valid snapshot with no eligible entries; `corpus: null`.
- `CORPUS_UNAVAILABLE`: no trusted snapshot; `corpus: null`.

Entries whose question OR answer is blank after trim are excluded. The original
snapshot and exact eligible strings are not changed. Its corpusFingerprint
remains the V1.1 content identity, including published blank entries; preparation
does not invent a replacement identity for the filtered view. Only explicit
knowledge fields are copied; scoring, presentation and evaluation metadata are
not inputs. No cache, model readiness, training or weights exist in this lot.

Each handle retains tenantId, projectId, publicationId, publicationRevision,
corpusFingerprint, isolationKey, snapshotId, contentLocale and entryCount.
Private entries belong to that exact handle in a WeakMap; copying/serializing it
does not confer trust. Repeated preparation is deterministic but yields separate
handles. Republication creates a new binding, not retraining. Old handles retain
old facts; the hosting service must resolve the active publication for new work
and must not reuse a stale binding.

## Matching

Only four own input keys are permitted: corpus, query, locale, caller. `caller`
is the exact trusted hosting-service scope:
`{ tenantId, projectId, publicationRevision, corpusFingerprint }`.
All four values must equal the handle's scope. Do not accept this scope from an
unauthorized HTTP client as proof of access. No caller decision, selected entry,
answer or project facts are permitted. Locale must exactly equal contentLocale;
no inferred locale or silent translation. Query must be a nonblank string.

Product results:

- `{ state: 'covered', knowledgeEntryId, sourceQuestionId, answer }`: answer is
  copied byte-for-byte from the prepared corpus, never from the engine.
- `{ state: 'ambiguous', candidates: [{ knowledgeEntryId, sourceQuestionId,
  question }] }`: distinct published candidates, no answers or merged facts.
- `{ state: 'notCovered' }`: no answer.

Results are frozen. Corpus states are preparation states, never semantic results.
Invalid calls throw TypeError with stable `code`: MATCH_INPUT_INVALID,
CORPUS_UNTRUSTED, CALLER_SCOPE_MISMATCH, LOCALE_MISMATCH or QUERY_INVALID.
An invalid engine identity/result throws ENGINE_RESULT_INVALID.

## Temporary baseline and future engine

`public/shared/lexicalMatcher.js` holds the single scoring/decision algorithm,
with configurable tokenization and no project vocabulary or renderer dependency.
It is a pure ES module under the existing static root, usable by both Node and
the legacy browser facade. `public/ivory/faq-engine.js` preserves its exports,
stop words and historical synonyms; its behavior is unchanged by extraction.

`baselineMatcher.js` uses the shared algorithm with generic tokenization and
only titles/identities derived from prepared entries. Per-entry category identity
allows tied distinct questions to abstain and surface separate candidates.
On baseline refusal, at most three distinct entries scoring at least 12 become
an ambiguity, following the existing product's disambiguation threshold.
No lexical algorithm is duplicated. The legacy synonym policy is deliberately
not imported into this domain runtime. ASCII normalization is an inherited
baseline limitation, not multilingual semantic capability; a query with no
normalized tokens returns notCovered rather than selecting arbitrary facts.

The public result contract exposes neither scores nor engine details. A future
engine replaces this private adapter; it receives corpus knowledge, returns
identities, and cannot author the product answer. No browser or DOM requirement
is introduced. The current service uses the existing Node publication provenance;
no commitment is made to running a future model in the browser. No model,
ONNX, database migration, endpoint or presentation implementation is included.
