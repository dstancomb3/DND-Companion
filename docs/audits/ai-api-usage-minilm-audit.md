# AI API usage and MiniLM suitability audit

Date: 2026-10-22. Inspected main: `35e2441e72c3da43a0f9c3c337e461d23959ec6d`
(after PR #22). User requested an API-use audit before deciding whether to add
MiniLM. This is evidence and a proposed sequence, not implementation or measured
savings. No paid model request, model download, production traffic inspection,
connected database write or device benchmark was performed.

## Recommendation

Do not replace the current generative parsers or combat engine with MiniLM.
First measure request usage and add a bounded deterministic Quick Update fast
path. Consider MiniLM afterward as an optional retrieval/ranking component if
benchmarks show useful gains over existing exact/alias/token matching.

Assumed candidate: `sentence-transformers/all-MiniLM-L6-v2`, with a compatible
ONNX export if JavaScript inference is chosen. MiniLM is a model family; a
fine-tuned classifier or token tagger would be a separate trained/evaluated
artifact, not a capability supplied automatically by the sentence encoder.

The sentence model maps short text to 384-dimensional vectors. It can rank a
known rule, item or journal entry by similarity. It does not generate a nested
QuickUpdateResult, read a loot screenshot, narrate an adventure, prove that two
people are the same person, or execute negation, quantities and combat effects.
Default input truncation is 256 word pieces: long histories need scoped chunks,
not a single truncated embedding. Primary model documentation is linked below.

Embedding similarity is not gameplay determinism. Even repeatable inference
cannot establish rules correctness. Keep explicit structured actions, validation,
entity IDs, rule versions and deterministic resolvers as authority. Existing
`getDeterministicDecodeOptions` lowers sampling variability; it is not a
replacement for this authority boundary.

## Method and coverage

Inspected server route declarations and all model-call sites; traced production
client URL references and shared adapters; checked the existing local progression,
quest identity matching, item effects and combat resolver; reviewed idempotency,
retries and context construction. Sources include:

- [AI routes](../../artifacts/api-server/src/routes/ai/index.ts)
- [Adventure routes](../../artifacts/api-server/src/routes/adventure.ts)
- [Router mounts](../../artifacts/api-server/src/routes/index.ts)
- [Progression engine](../../artifacts/living-character-sheet/data/progression/engine.ts)
- [Quest name/alias matching](../../artifacts/living-character-sheet/utils/questGraphReview.ts)
- [Combat resolver](../../artifacts/living-character-sheet/utils/combat/resolveCombatAction.ts)
- [Item mechanics adapter](../../artifacts/living-character-sheet/utils/mechanics/itemMechanicsAdapters.ts)
- [Live-response retry helper](../../artifacts/living-character-sheet/utils/adventure/aiDmLiveResponseApi.ts)
- [Replay worker](../../artifacts/living-character-sheet/context/SyncContext.tsx)

Static source coverage is not traffic measurement. No `.env` values, private
prompts, provider bills or player records were read. There is no MiniLM,
Transformers.js, ONNX runtime or embedding API integration in the scanned
application sources/dependency manifests.

## Actual model-calling inventory

There are **12 handlers with a model call path**: eleven under `/api/ai`, plus
one `/api/adventure/campaign-runtime/turn`. The adventure handler invokes a
helper containing its model call. Ten have a direct first-party client caller
found; two have no first-party caller found. Counts are static declarations,
not call frequencies. Every non-replayed valid request on these paths currently
needs the model unless rejected or otherwise short-circuited.

Default model configuration in source:

- AI text routes use `OPENAI_MODEL`, falling back to `gpt-3.5-turbo`.
- Loot image analysis uses `OPENAI_VISION_MODEL`, falling back to `gpt-4o-mini`.
- Adventure turn uses `OPENAI_MODEL`, falling back to `gpt-4o-mini`.
- Feat recommendation hardcodes `gpt-4o-mini`.
- Both server modules use `AI_INTEGRATIONS_OPENAI_API_KEY` and
  `AI_INTEGRATIONS_OPENAI_BASE_URL`. Actual deployed models, provider and rates
  are unknown; defaults are not a recommendation or a bill estimate.

Output limits below are configured ceilings, not measured use. Most use
`max_completion_tokens`; recommend-feat uses `max_tokens`.

| Route | Known first-party caller(s) | Current job / output ceiling | Keyed route replay | Replacement decision |
| --- | --- | --- | --- | --- |
| `/api/ai/parse-update` | Quick Update, loot-review, loot-generator, DM Notes, inventory import, queued replay | Free text to mixed HP/resources/inventory/currency/world proposals; 4096 | Yes, if a key is supplied and persistence works | Highest-value deterministic bypass candidate for fully explicit commands. MiniLM can suggest a route or candidates, not produce authoritative changes. |
| `/api/ai/analyze-loot` | loot-review image upload, queued replay | Vision to item/currency proposals; 8192 | Yes, same conditions | Text MiniLM cannot replace image interpretation. OCR plus parsing would be a separate measured pipeline. |
| `/api/ai/generate-loot` | DM Party prompt generation | Invent item proposals; 4096 | No | Keep creative generation optional. Explicit catalog selection or structured/random tables can avoid generation; embeddings can retrieve existing catalog candidates. |
| `/api/ai/parse-quest-reward` | QuestsTab completion/reward preview | Extract rewards and propose killed people/impossible quests; 2048 | No | Structured stored rewards/dependency rules could avoid calls after schema work. Similarity cannot establish death, causality or quest failure. Free-text inference still needs review. |
| `/api/ai/repair-import` | Edit Character repair action | Reconstruct malformed/foreign snapshot JSON; 8192 | No | Keep strict local parsing/adapters first. MiniLM does not repair JSON. Add only bounded, explicit format repairs with review; retain LLM/manual fallback. |
| `/api/ai/level-up` | LevelUpModal fallback | Local server level/slot math plus generated features/known-spell gains; 1500 | No | Local `auditLevelUp` already bypasses this for supported data. Extend versioned progression coverage rather than add embeddings for rule arithmetic. |
| `/api/ai/recommend-feat` | No production client caller found | Generate feat name and reason; 200 | No | No demonstrated active cost to remove. Future deterministic eligibility/ranking plus optional explanation; MiniLM could rank descriptions but cannot enforce prerequisites. |
| `/api/ai/generate-class-features` | No production client caller found | Generate categorized class/subclass features; 4096 | No | Prefer canonical progression data if reactivated. A route existing does not prove savings from removing it. |
| `/api/ai/parse-quest-update` | Quest Update block, character creation/import/repair backstory extraction, queued replay | Text to quest/person/location/realm actions; 4096 | Yes, same conditions | Exact IDs/aliases and explicit updates belong in local rules. Open-ended entity/relation extraction is not supplied by a sentence encoder. |
| `/api/ai/npc-appearance` | DM NPC editor | Appearance prose; 600 | No | Optional templates can avoid calls. MiniLM could retrieve a curated description, but would change creative behavior. |
| `/api/ai/item-properties` | Item Designer | Mechanical prose plus flavor; 800 | No | Client already ignores returned mechanical properties and rebuilds them locally. Remove redundant mechanical generation from the prompt/contract; keep optional flavor or templates. MiniLM unnecessary. |
| `/api/adventure/campaign-runtime/turn` | Adventure session via requestLiveResponse; separate direct runtime adapter also exists | Narrative, choices and proposed item/encounter/adjudication outputs; 1200 | No | Keep generative narration. Retrieval may improve context selection/continuity; it does not replace the turn generator or adjudication engine. |

Additional distinctions:

- `useWhatsThis` requests `/api/ai/whats-this`, but no corresponding mounted route
  or production hook consumer was found. This is a disconnected feature path,
  not a currently demonstrated paid-call saving or a working MiniLM replacement.
- Adventure handoff/scaffold/checkpoint ingest and snapshot reads do not call an
  LLM. Their idempotency/persistence APIs must remain authoritative.
- Party sync, initiative, encounter, rest and delivery routes do not call an LLM.
  MiniLM cannot remove their authentication, persistence or multiplayer network
  requirements. The local combat resolver has no model call to eliminate.
- Open5e is a data-fetch API, not model inference. Monster fetching already has
  memory/persisted caching and in-flight refresh reuse. Semantic search can rank
  cached records; it does not replace fetching/versioning the catalog itself.

## Findings and priorities

These AIU IDs belong to this user-requested usage audit, not the unrecovered
original fifteen. Recommendations are not automatically authorized runtime work.

| ID | Finding | Current evidence and implication | Recommended next action |
| --- | --- | --- | --- |
| AIU01 | Usage economics are unmeasured | Model responses are consumed without a provider-token/cost usage ledger in these routes. HTTP logs are not a token ledger. No production request mix or device inference timings inspected. | Record endpoint/model, provider usage when available, latency, replay/attempt/operation IDs and normalized failure status. Avoid raw private prompts in routine metrics. Establish baseline before claiming savings. |
| AIU02 | Explicit bookkeeping still takes a generative path | Quick Update submits any nonempty parse request to parse-update; there is no pre-call exact-command grammar. Manual structured editing already exists separately. | First implementation candidate: a narrow full-input deterministic proposal parser for explicit commands such as `HP -7`, using existing schema/review/application paths. Do not treat reported HP bookkeeping as automatic raw combat damage resolution. |
| AIU03 | Some rule/description work is already local | LevelUpModal calls auditLevelUp first; valid array item imports parse locally; Item Designer rebuilds properties from equippedEffects and only uses generated description. | Preserve these bypasses. Extend canonical coverage where gaps are known. Make item flavor generation explicit and stop asking the model for discarded mechanics prose. |
| AIU04 | Retrieval is a possible context optimization, not an automatic call saving | parse-update includes complete supplied quest/person/location/realm lists. Adventure currently keeps the last ten transcript entries; it has no full campaign memory retrieval. | Benchmark lexical filtering first, then embeddings on scoped candidates. Pin required live state and recent turns; measure prompt-size and answer-quality changes. Retrieval could add tokens as well as remove them. |
| AIU05 | Replay/timeout work may cost more than similarity | Only three paid AI routes implement keyed replay, and many foreground callers do not send keys. The active live-response helper defaults to one retry at 30 seconds, while campaign runtime has no turn idempotency. A client abort need not cancel an already-running upstream call. | Design stable logical operation/turn IDs and context-aware keyed receipts before retrying. Count attempts. This is a separate reliability/cost fix, not semantic caching. Do not confuse reused parse responses with exactly-once game mutation. |
| AIU06 | Apparent endpoint coverage exceeds observed use | Two implemented AI endpoints have no first-party caller found; one help hook points to a missing endpoint and has no consumer found. | Instrument or confirm owners before removing endpoints or budgeting savings. Do not build an embedding service merely to replace an inactive path. |
| AIU07 | Embedding runtime is absent and cross-platform integration has cost | App is Expo/React Native plus web. No embedding model/runtime is installed. Browser WASM/WebGPU and native ONNX require different packaging/integration validation. | Conditional retrieval spike only, behind a disabled-by-default feature flag. Benchmark actual Windows/Android hardware, cold download, warm latency, memory and fallback. |
| AIU08 | Similarity cannot close existing semantic/authority gaps | Existing questGraphReview already resolves exact names/aliases and offers token suggestions; item proposal validation/review and party proofs remain partial. O05 caller/usage controls are still open. | Use embeddings as ranked suggestions after exact filters. Never auto-merge identities, approve mechanics, waive access checks or apply state changes from similarity alone. Continue original permission/AI quota work independently. |

## What should be deterministic, retrieved or generated

| Work | Recommended owner | What MiniLM may contribute |
| --- | --- | --- |
| Explicit HP/currency/resource deltas | Exact grammar or structured UI, validated proposals and existing mutation path | Optional intent suggestion only; no numeric extraction or authority from cosine score |
| Item/spell/condition names | Stable IDs and exact/alias lookup first | Rank candidate existing records for user or parser review |
| Rule math, spell slots, eligibility, damage negation/reflection | Versioned declarations, rules tables and deterministic resolver | Retrieve the relevant description; do not decide the result |
| New quests, NPCs, flavor and narration | Generative model or explicitly selected templates | Retrieve relevant prior context or templates |
| Entity identity and graph links | Scoped stable IDs, aliases, ambiguity/review flow | Suggest related records; semantic similarity is not identity |
| Persisting party/campaign state | Existing authenticated server contracts | None; embedding inference is not database synchronization |

For the fire-negating, 1d8-reflecting ring example, retrieval might find the ring
entry or a defense rule. The actual equipped/active state, incoming damage type,
negation order, reflection trigger, original source, dice/roll record and loop
limits must be structured and resolved in code. Adding MiniLM does not implement
that missing engine behavior or fix the separately reported quest-status defect.

## Bounded architecture if work is approved

1. Check explicit structured actions and exact full-input grammar first. A grammar
   fast path emits the same validated proposal contract; retain the existing
   review/apply/undo-containment behavior. Match the whole input or abstain.
2. Use exact IDs, edition/category filters and stored aliases for retrieval.
3. Optionally rank remaining authorized candidates with MiniLM; show suggestions
   or pass a bounded candidate set to a generator. A score is not a calibrated
   probability, and no universal cosine threshold is accepted as a mutation gate.
4. Keep LLM/manual fallback for mixed/unknown input, generation and ambiguity.
5. Preserve server proofs and current state validation at commit. Client inference
   is untrusted input; a local model does not grant host or member permissions.

Initially leave the optional model out of startup and offline-critical paths.
A server-side retrieval experiment is easier to centralize and benchmark across
clients, but still uses the app's API and adds server CPU/RAM. It does not create
on-device offline functionality. A later web-worker implementation can avoid
blocking the UI and run after asset caching; a native Android implementation
needs a compatible native runtime/tokenizer/model pipeline and build validation.
Do not claim browser success establishes Expo Go or native support.

A published compatible export currently lists about 23 MB for an int8/quantized
ONNX file, versus about 90 MB fp32. This is a model-file size, not installed bundle
size, RAM use or cold-start cost; tokenizer/runtime/cache/index overhead is extra.
Pin model/export revision, pooling, normalization, quantization and tokenizer.
Do not download every variant or add a vector database for a small local catalog
before showing that a simple in-memory index is inadequate.

## Acceptance gates before any MiniLM shipping decision

- Build a labeled D&D sample set with explicit commands, mixed updates, quoted
  dialogue, negation, hypothetical speech, quantities, similarly named NPCs,
  2014/other-edition collisions and the fire ring interaction. Include holdout
  examples and out-of-domain input. Do not evaluate only positive paraphrases.
- Compare exact/alias/token matching, a cheap lexical baseline and MiniLM. For a
  proposed grammar fast path measure coverage, incorrect proposals and abstention.
  Zero errors on a finite test set is necessary evidence, not universal proof.
- For retrieval measure recall@k, incorrect entity suggestions and downstream
  prompt/answer quality. Similar records must never auto-merge or acquire rights.
- Never split mixed text into a partially applied deterministic change followed
  by replaying the entire original input through the LLM. Either fully parse it
  into one proposal or abstain with no effects.
- Scope every candidate/index/cache to allowed campaign/character/audience. Keep
  current inventory, equipment, active effects, pending rolls, canonical IDs,
  revision and required recent events in deterministic context. Retrieve older
  optional facts without silently dropping mandatory state or DM-private data.
- Use source hashes/revisions and index schema/model versions for invalidation.
  Cached generated mutation proposals need exact operation/context identity,
  not merely similar text. Identical words can describe two legitimate actions.
- Benchmark cold/warm p50/p95 latency, main-thread stalls, download/runtime/index
  storage, RAM and battery impact where applicable on target Windows/Android.
  Compare CPU-only fallback and unavailable/offline model behavior. No model
  quality or performance number has been measured for this app by this audit.
- Record measured end-to-end calls/tokens avoided, inference/index cost and user
  corrections. Use observed configured-provider rates, not guessed list pricing.

For a bypass, net benefit is avoided eligible calls times observed average call
cost, minus embedding/runtime/maintenance cost and error/review cost. For
retrieval, use net prompt tokens removed minus added context/inference overhead;
call count may remain identical. There is no defensible percentage or dollar
saving estimate from source inspection alone.

## Recommended work order

1. Small usage/attempt telemetry pass and deterministic Quick Update grammar
   evaluation, without adding model dependencies. Exact-command optimization
   must coexist with existing permission and idempotency safeguards.
2. A bounded grammar/proposal implementation if the labeled cases justify it;
   optional flavor/template cleanup and coverage-driven canonical data expansion.
3. Stable AI-turn/request replay design, tracked separately from embeddings.
4. Conditional MiniLM retrieval experiment only if existing lexical matching or
   context assembly has a measured gap. Do not turn the experiment into the new
   combat authority or an automatic entity deduplication layer.

This does not complete O02/O05, full deterministic combat, AI DM orchestration,
rollback or pending QA-N01/QA-N02. The user requested this audit explicitly;
implementation order is a recommendation pending the next scope decision.

## Primary external sources checked

Accessed 2026-10-22. These support model/runtime facts, not this app's savings.

- [Sentence Transformers model card](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2): short-text embedding, 384 dimensions, default 256-word-piece truncation.
- [Semantic textual similarity](https://sbert.net/docs/sentence_transformer/usage/semantic_textual_similarity.html): embeddings and similarity scoring.
- [Transformers.js versioned documentation](https://huggingface.co/docs/transformers.js/v3.8.1/index): browser WASM/WebGPU and quantization options. The unversioned main docs are not a dependency pin.
- [Compatible ONNX export file listing](https://huggingface.co/Xenova/all-MiniLM-L6-v2/tree/main/onnx): separate fp32/int8/quantized artifacts; no runtime benchmark implied.
- [ONNX Runtime React Native documentation](https://onnxruntime.ai/docs/get-started/with-javascript/react-native.html): native package integration.
- [Expo custom native code](https://docs.expo.dev/workflow/customizing/): custom native library/development-build requirements; no Expo Go compatibility assumption.
