# Item creation API and application audit

Baseline: `d4cacecb75bc408f13fc90809e9f364e7899f805` (main after PR #11).
Date: 2026-10-22. Scope: item proposal/generation APIs, Item Designer, loot and
quest reward consumers, review, DM storage and inventory application. This audit
adds evidence and a fix plan only. No production request, AI call, database write
or gameplay fix was performed.

## Main conclusion

There is no single authoritative item-creation transaction today. Item Designer
builds effects locally and calls a description API. Other APIs produce loot or
inventory proposals. Clients then convert those proposals into drafts, DM notes,
assignments or inventory through different field mappings and merge rules.

Reliability is limited by contract and preservation gaps before model quality.
Changing the AI model alone cannot fix discarded mechanics, incompatible item
merges, unverified “official” badges or duplicate local application.

## Actual paths and authority

| Path | Request/result | Actual application and ownership |
| --- | --- | --- |
| `app/dm-item.tsx::generateItemPropertiesWithAi` → `POST /api/ai/item-properties` | Sends item details and an effect summary; receives mechanical prose and flavor | Effects remain locally authored; UI ignores returned properties and regenerates them from local effects. Save to DM Notes and JSON export are separate representations |
| `dm-party.tsx::handleGenerateLootFromPrompt` → `POST /api/ai/generate-loot` | Prompt plus rarity/category constraints; normalized proposed items | Client reconstructs LootDraftItems, then assignment/claim workflow. It clears several returned fields |
| `loot-review.tsx::sendImageAsset` → `POST /api/ai/analyze-loot` | Multipart image; normalized item proposals | Photo results are deduped, priced and selected in review, then locally applied |
| `loot-generator.tsx`, Quick Update → `POST /api/ai/parse-update` | Free text; inventory changes plus other character/world changes | Inventory changes may go through review or direct apply; mixed updates can have prior consequences |
| `components/notes/QuestsTab.tsx` → `POST /api/ai/parse-quest-reward` | Quest text and context; item/currency/world proposals | Client reward workflow applies consequences; generation receipt is not a durable inventory commit |
| Inventory JSON import | Designer exports legacy effect fields plus optional canonical mechanics | A different normalization path in `app/(tabs)/inventory.tsx` handles equipped/consumption effects. Do not assume every import path has the same field fidelity |

API code is `artifacts/api-server/src/routes/ai/index.ts`. Client paths above are
under `artifacts/living-character-sheet/`. Existing APIs are proposal boundaries;
this audit does not propose giving a model permission to mutate live inventory.

## Confirmed findings and required changes

Priority P0 means a blocker for trustworthy item creation or safe deployment;
P1 means required reliability work; P2 means correctness/diagnostics cleanup.

| ID | Priority | Evidence and failure | Required change |
| --- | --- | --- | --- |
| I01 | P0 | Designer calls literal `http://localhost:3000/api/ai/item-properties` instead of API_BASE_URL. On another device localhost identifies that device; hosted HTTPS also cannot rely on this local HTTP URL. | Use the existing API URL adapter; test local web, hosted web and native device configuration. Surface service failure rather than silently presenting fallback as AI success |
| I02 | P0 | `/item-properties` ignores request `equippedEffects` when constructing the model prompt, yet asks for creative mechanical properties. Designer sends only part of each effect and then ignores returned properties. Probe confirms the provided Fireproof effect never reaches the model. | Define this route as flavor-only against an authoritative mechanics summary, or explicitly return a typed unapproved mechanics proposal. Do not maintain contradictory prose and executable effects |
| I03 | P1 | Designer awaits a response and applies old `itemToGenerate` properties to `prev` without checking the current draft ID/revision. Clear, edit or another generation can change the current item while a request is in flight; fallback follows the same pattern. | Bind response to draft ID/revision, cancel obsolete requests, and reject stale responses. Keep the current draft on failure; label deterministic fallback flavor explicitly |
| I04 | P0 | `dm-item::handleSaveToNotes` omits equippedEffects/mechanics; `dmNotesStorage::normalizeItem` also strips them. Probe confirms saved Fire Ward retains prose but loses its structured behavior. JSON export follows another richer path. | Preserve a versioned canonical item payload in DM campaign storage and every save/edit/load/assignment adapter. Keep flavor and compatibility projections distinct; add designer→save→load→equip tests |
| I05 | P0 | DM party generation mapping drops effects/mechanics and hardcodes properties, description, weapon dice/type/range to empty. `buildLootDraftItems` clears these fields again and clears tags/subtype; it defaults weapon ability/proficiency. | Normalize once through a shared lossless draft adapter. Preserve validated fields and unresolved segments; leave unknown weapon choices unknown until reviewed |
| I06 | P0 | `normalizeProposedItem` accepts negative/fractional quantity, arbitrary dice/damage strings, empty/AI IDs and weak numeric effect values. Probes preserve -2, 0.5 and `not-dice`. Negative amounts mean removal in `applyProposedItems`, so creation and update semantics must differ. | Shared operation-specific schemas: positive integer creation quantity, bounded numeric fields, supported dice grammar/types, stable server/draft IDs and validated uses/reset rules. Allow negative deltas only in explicitly authorized update commands |
| I07 | P1 | `/generate-loot` constraints are prompt text only. A mocked model returned a Legendary weapon for a common consumable request and the route returned 200. | Validate generated proposals against requested categories, rarity and quantity/count limits after parsing. Return a structured violation/review result or bounded repair, not silent coercion |
| I08 | P1 | `normalizeLootAnalysisResult({})` becomes success-shaped empty loot; missing/non-array items fall back to an empty list and malformed entries may be dropped. Text generation always becomes `sourceType: photo`. Empty item-properties strings also pass before trim. | Distinguish valid no-detection, incomplete/invalid model output and successful generation. Validate required fields/nonempty content per operation; preserve true text/photo/generated provenance |
| I09 | P0 | `normalizeParserItemMechanics` filters mechanic entries only to objects, rewrites envelope labels to v1/item and can retain model `reviewStatus: verified` even with invalid source version/owner and unsupported metadata. Probe retains `{nonsense:true}` with verified review. This is not proof a client will execute it, but the API assurance is inconsistent. | Validate discriminated mechanic payloads against shared schemas and supported compiler capabilities. Only deterministic validation/catalog checks and explicit human approval can grant verified/executable status; preserve raw unsupported content as review evidence |
| I10 | P0 | Mechanical-claim review heuristics mainly detect `+N` stat claims and bounded conditional attack language. Probe: “Negates fire damage and reflects 1d8 fire damage to its source” returns no executable effect and `needsReview:false`. | Track coverage of every mechanical claim, with source evidence and unsupported/ambiguous segments. Immunity/reflection must be typed and engine-supported or explicitly require review; flavor text must not imply implementation |
| I11 | P0 | Server dedupe uses category+name, sums quantities and combines effects while retaining some first-item weapon fields. Client review dedupe uses name alone, takes max quantity and promotes confidence/official provenance. Actual inventory apply also matches name alone. Probes merge different variants/categories with incompatible state. | Separate definition, variant, instance, source observation and stack identity. Merge only structurally compatible stackable instances; ask for review when photos might show the same object twice. Use one explicit counting/stack policy across boundaries |
| I12 | P1 | `normalizeProposedItem` drops supplied value/weight/subtype/attunement. `applyProposedItems` omits weight/subtype for new items and ignores incoming weapon/effect details when a same-name stack exists, apart from canonical mechanics merging. | Define a field-preservation matrix and a shared validated converter. Round-trip complete supported metadata or report explicit unsupported fields. Never silently overwrite/ignore differing variant attributes |
| I13 | P0 | `applyProposedItems` creates local IDs and has no application receipt. Probe applies the same proposal ID twice and quantity becomes 2. Review approve handlers do not establish a durable command commit, even if their navigation usually prevents repeat taps. | Separate generation ID from a single accepted application command. Persist an idempotent inventory receipt with the resulting state/history, serialize acceptance and show already-applied status. A generation replay key alone cannot protect local application |
| I14 | P1 | Generation, reward parsing and item-properties have no route idempotency wrapper. Photo analysis supports a key, but `sendImageAsset` does not send one and wrapper failures can proceed without persistence. Probe repeats a generation key and calls the model twice. | Stable operation-scoped keys and request hashes for all retryable proposal routes; visible degraded replay protection. Keep proposal retries separate from inventory acceptance receipts. Do not claim exactly-once creation from best-effort AI cache |
| I15 | P0 | `officialMatch` is model-controlled and becomes an Official UI/source tag; dedupe ORs it across merged items and promotes confidence. No catalog verification occurs in this normalization path. | Resolve against an edition/source/version-specific trusted catalog; retain catalog ID and proof. Model confidence is evidence to inspect, not official status or permission to execute effects |
| I16 | P1 | OpenAPI has generic object contracts for covered parsing/photo routes; item-properties, generate-loot and parse-quest-reward are absent. Consumers cast unknown JSON or use `any`; type assertions do not validate network data. | One shared request/result/item schema, stable error codes, generated contracts and runtime validation at API and client boundaries. Extend existing adapters instead of creating a competing item system |
| I17 | P0 | AI routes have no application authentication, per-user/party authorization or usage budgets. App uses permissive CORS; CORS itself is not authorization. Uploads are memory-buffered up to 20 MB and the app accepts 25 MB JSON. | Authenticate callers, authorize relevant campaign/DM scope, enforce per-actor quotas/concurrency and bounded input/image dimensions before expensive model work; preserve test/local workflows explicitly |
| I18 | P1 | These routes depend on prompt-only JSON instructions rather than a strict response schema; finish/truncation/refusal states are not explicitly handled. There is no route-specific end-to-end deadline/cancellation policy; SDK retry defaults were not audited. Error paths can return raw model output/provider detail. | Strict structured output where supported plus independent validation, typed failure states, bounded recovery and deadlines, request cancellation, sanitized errors and diagnostic trace IDs. Test provider defaults instead of assuming retry semantics |
| I19 | P1 | DM Notes read failure becomes empty data, then read-modify-write can replace the store; save errors are swallowed by Designer. Assignment acceptance and recipient inventory are separate commits. No complete durable item history/undo exists. | Fail closed on unreadable/corrupt storage, serialize/version writes, surface save failure and record durable creation/transfer/claim history. Follow the existing undo audit rather than adding another partial snapshot mechanism |
| I20 | P1/P2 | No edition/rules profile, source version or explicit attunement/equipped trigger policy is required by generation contracts. `/item-properties` destructures missing req.body outside its try block; probe throws instead of a typed 400. Some numeric context uses truthiness, omitting legitimate zero. | Add rules/edition and capability context to validated drafts. Use one input schema before destructuring, distinguish missing from zero, and expose missing mechanical decisions rather than invent defaults |

## Field fidelity checks that must become contract tests

| Field group | Observed weak boundary | Required test |
| --- | --- | --- |
| Definition/variant/instance IDs and stack count | Name-based merge and different sum/max rules | Two identical names with different dice/category/attunement remain distinct; true stack merge is explicit and consistent |
| Effects, mechanics and unsupported segments | Designer→DM Notes; AI loot→DM draft; API shallow mechanics coercion | Both supported and unsupported authored claims survive every boundary with accurate review status |
| Weight/value/currency/subtype/tags/attunement | API proposal normalization; DM draft constructor; inventory application | Export/import/save/assignment round-trip each field with units and validation; unknown is not a fabricated value |
| Attack ability, proficiency, dice/type/range | DM draft defaults/clears fields; same-name inventory update ignores them | Validate and preserve supported profiles, and require review for missing decisions |
| Charges/remaining uses/reset/activation | Prose/legacy/canonical representations differ | Authored maximum and reset policy stay distinct from per-instance remaining uses; PR #11 usage persistence must still pass |
| Origin, confidence and official source | Text→photo normalization, model flag and confidence promotion | Source IDs/edition/version are preserved; official provenance is verified, not inferred from a name or model confidence |
| Acceptance and history | Generation key, review selection and local add are separate | Retry accepted command without duplicate award; inspect receipt and recover after restart without losing or duplicating items |

## Existing protections worth retaining

- AI routes generally produce proposals, with client review before broad item
  application. Quick Update partitions review-required and low-confidence
  structured inventory changes instead of blindly applying all of them.
- Parser normalization preserves some review flags/unsupported segments and has
  bounded stat/usage/conditional-trigger extraction. Do not discard that evidence
  when tightening schemas.
- Photo analysis has a MIME allowlist, upload-size limit and optional replay
  handling. Strengthen these rather than claiming there are no checks.
- Canonical mechanics compatibility adapters already exist; some client adapters
  degrade/preserve unsupported content. API review-label gaps do not prove every
  arbitrary mechanic executes successfully.
- Limited-use counts now survive supported character save/load paths from PR #11.
  Current unsafe MutationHistory undo remains blocked, as intended.

## Fix order and acceptance gates

1. **Reachability and stale drafts:** fix I01-I03 with a shared URL, truthful
   flavor-only API contract, visible errors and draft revision checks. Test an
   edit/clear during an in-flight request and a device that cannot use localhost.
2. **One canonical item contract:** validate create/update operations separately,
   strengthen mechanic/review guarantees and source provenance (I06-I10/I15-I16/
   I20). Keep model output a proposal. Reject fake verified envelopes; unknown
   reflection logic must remain preserved and explicitly unsupported/reviewable.
3. **Lossless save and conversion:** update existing DM store/draft/review/
   inventory adapters together (I04-I05/I12), including versioned migration of
   richer item data. Do not advertise saved functional items until their mechanics
   survive reload, export/import, assignment and equip.
4. **Identity and acceptance:** replace name-only merging and add durable
   application receipts/transactional history (I11/I13-I14/I19). Two variants must
   stay distinct; duplicate acceptance, interrupted save and reconnect must not
   duplicate or lose inventory. Handle proposal retries independently.
5. **Deployment and provider reliability:** authorization, usage controls,
   structured failures, upload constraints and observability (I17-I18) are release
   prerequisites, not optional model tuning. These can proceed independently of
   mechanics improvements.

After those gates, evaluate model/prompt quality against a labeled fixture set
with measured field preservation, claim coverage, invalid-output rate, required
review rate, latency, cost and retry/duplicate counts. Test mundane weapons,
armor, charged equipment, consumables, attuned items, quest items, mixed effects,
unknown/homebrew mechanics, negative/fractional inputs, multi-photo overlaps and
prompt-injection text treated as untrusted source content.

Mandatory custom item fixture: fire immunity plus `1d8` reflection. Require an
explicit attempted-versus-applied damage trigger, source identity, equip/attune
requirements, recursion limits, typed unsupported status until engine support,
and a save→reload→assign→claim→equip→Fireball trace. Prose alone cannot pass.

## Evidence and validation

- [11 API probes](item-api-probes.json): actual exported normalizers and direct
  route handlers; mocked SDK transport and blocked fetch. No model/network or
  database request. Covers invalid quantities/dice, lost metadata, empty output,
  provenance, unsupported reflection prose, variant merging, shallow mechanics,
  ignored constraints/idempotency, ignored authored effects and missing body.
- [4 client probes](item-client-probes.json): actual DM storage, review dedupe
  and CharacterProvider apply methods, with in-memory AsyncStorage and mocked
  React hooks. Covers mechanics loss, incompatible merges and repeat application.
- 16 existing API parser/idempotency contract tests pass. This demonstrates existing
  tested guarantees alongside the gaps; it does not certify generation quality.

Reproduce after installing dependencies, from the repository root:

```sh
node --import tsx scripts/audits/probe-item-api.mts
node --import tsx scripts/audits/probe-item-client.cjs
```

Probe assertions characterize existing gaps, so passing means reproduced, not
fixed. API probe environment values are dummy process-local placeholders. The
probe transport is replaced and network fetch is blocked; no real key is used.

Not exercised: real AI output quality, browser/mobile layouts or requests, file
sharing, live database persistence, concurrent devices, provider throttling,
large-image decoding and end-to-end combat application. Race I03 is established
by missing revision/cancellation checks in code, not a browser reproduction.
This audit does not claim a complete security review of the whole application.

Rollback: revert this audit/documentation/probe commit. No gameplay schema,
connected data, dependency manifest or runtime authority was changed.
