# Procedural World Foundry: Specification and Implementation Plan

**Status:** Approved product direction; implementation proposed, not implemented  
**Date:** 2026-10-28  
**Repository:** dstancomb3/DND-Companion  
**Scope:** AI one-offs, AI campaigns, human-DM parties, shared adventure workspace  
**Primary goal:** A tangible, diverse, persistent and mechanically authoritative world. Generate routine world content procedurally, with AI/human DM direction for story-specific details.

## 1. Product contract

Create a shared **World Foundry** with specialized NPC, Item, Container, Security, and Scene Interaction modules. Generate reproducible, context-sensitive world inhabitants, ordinary contents and security rules without routine model calls. The AI DM acts as a director that selects/adapts existing candidates, contributes authorized story facts and narrates acknowledged results. Human DMs have equivalent edit and override affordances. No parallel combat/inventory/rules engine.

**Determinism:** target >=99% of *eligible routine generation operations* completed without generative-model calls in a reference scenario suite (report denominator, sample set and exceptions). All accepted inventory, HP, conditions, ownership, locks, traps, currencies, quest flags and transfers use deterministic validated mutations. Freeform NPC dialogue and creative DM narration are not counted as routine generation. Deterministic generation does not imply that storytelling is deterministic.

**Authoritative rules:** choose and persist ruleset/version per campaign (5e compatibility may span versions); never silently mix editions or invent mechanics. Support explicit homebrew with review/approval.

## 2. Codebase audit and integration points (main inspected 2026-10-28)

| Existing surface | Observed role | Foundry integration |
| --- | --- | --- |
| `artifacts/living-character-sheet/app/dm-npc.tsx`, `data/dmTables`, `utils/dmNpcStorage`, `components/DmNpcGearPicker.tsx` | Current NPC creator and randomized tables, NPC inventory groundwork | Preserve DM creator; extract data-driven generators and add seeded candidate/casting support, not a second NPC editor |
| `app/loot-generator.tsx`, `utils/lootGeneratorFilters`, `utils/lootTailorAnalyzer`, `app/loot-review.tsx` | Existing loot generation, local/AI tailoring, reviews | Reuse item discovery and review; replace ad hoc randomness on new Foundry path with seeded weighted pools and constraints; no forced legacy migration |
| `app/dm-item.tsx`, `types`, `api-server/src/lib/mechanics/itemMechanicsBoundary.ts`, `itemProposalValidation.ts` | Item data and AI mechanics validation, with unverified effects quarantined | Canonical immutable item definition + mutable instance; validate that executable effects are supported; do not auto-promote AI mechanics to verified |
| `app/adventure/session/[sessionId].tsx`, `components/adventure/workspace/AdventureWorkspace.tsx`, `utils/adventure/workspaceLayoutPreferences.ts` | Active adventure and six-panel layout | Add Nearby and contextual object/dialogue panels as interchangeable widgets; preserve narrative center and existing six-slot preferences |
| `utils/adventure/sessionWorkspace.ts` | Mode and authority projection (human_dm, ai_one_off, ai_campaign) | Read-only scene/entity projection; never treat client role flags as authorization |
| `utils/adventure/aiDmOneOffToolBridge.ts`, `types/aiDmContracts.ts`, `api-server/src/routes/adventure.ts` | Bounded AI action/tool path; existing loot hook is a handoff | Add versioned structured examine/dialogue/cast/override intents via validated orchestration after existing gating; do not allow arbitrary model-authored state edits |
| `context/CombatContext.tsx`, `utils/combat/applyDamagePacket.ts`, `utils/combat/actionableItemEffects.ts`, `api-server/src/routes/party.ts` | Combat/effects, mixed local and remote authority | Reuse effect execution for real traps, damage, saves, conditions; fail closed for unsupported remote consequences |
| `components/notes/PeopleTab.tsx`, `app/(tabs)/notes.tsx`, `app/dm-notes.tsx` | People/notes and DM private notes | Append event-derived conversation summaries and knowledge provenance; protect private DM facts |
| `lib/db/`, `lib/api-zod/`, `lib/api-spec/openapi.yaml` | DB and API contract authorities | Add additive normalized schemas, mutation endpoints and migration steps; check compatibility |
| `docs/modular-adventure-workspace-ui-ux-spec.md`, `docs/adventure-dm-session-runtime-spec.md` | Workspace and session design | Honor narrative priority, six slots, mode parity and existing session authority boundaries |

**Audit limitations:** This is a targeted repository-path/source audit, not a complete execution audit. No local build, tests, real database migration, deployed HTTP smoke test, or device QA was executed for this planning document. Existing docs explicitly mark remote authority and schema convergence as partial. Before implementation, examine exact current structures, schemas, endpoint guards and tests at the chosen commit. Avoid claiming the Foundry exists today.

## 3. Architecture and authority

```text
Scene / Quest / World Context (authorized)
       |
Context Resolver -> Constraint/weight rules -> Seeded generators
       |                         |
       v                         v
NPC candidate pool          Item/Container/Security definitions
       \                         /
        -> Stable Entity Registry and Ownership Graph
                        |
             Validated Command/Effect Engine
                        |
           Atomic World Event + State Commit
                 /                 \
       Player-visible projection   DM-only projection
                 |                   |
         Nearby, Examine, Dialogue, Loot
                 |
         AI DM narrative on committed outcomes
```

Rules:
- Every entity has stable ID, session/world scope, template/catalog version and revision; each generation records seed, algorithm version, inputs, context hash and selected definitions. Use a stable PRNG, not Math.random for replay.
- Generate candidate NPCs lazily from seeds; persist full instances only on casting/interaction or explicit DM save. Do not pre-store millions of copies.
- Store definition/instance distinction: canonical gear stats/effects vs individual condition, owner, history; fungible stacks retain quantity and auditable transfer receipts.
- Every consequential command includes actor identity, host/member proof, authorized scope, expected revision, idempotency key, and validated target; one transaction commits state + event + receipt. Retry must return same result.
- World event log supports audit/replay, undo/snapshot integration and knowledge projections. DM-only secrets, concealed container contents and unrevealed traps must not leak via player reads, errors or AI prompts to unauthorized participants.
- Generation quotas, content budgets, input validation and bounded queries prevent costly/infinite world expansion.
- Versioned templates and explicit override provenance; resolved world truth cannot be silently retconned by generation or AI. Exposed facts remain consistent.
- AI/human DM can propose overrides to cast a person, add quest loot, alter a lock or place a clue. The validator applies only authorized, schema-compatible, budget/rule-compliant edits; human-DM explicit override logs provenance.

## 4. NPC Foundry

**Data:** ancestry/culture (avoid stereotyping), role, occupation, background, social network, personality vectors, motives, fears, ethics, relationships, situational behavior, observable appearance, voice tendencies, knowledge/belief/secret triples, possessions/equipment, location, schedule, faction, disposition, memory and story flags.

**Composition:** weighted constrained combinations, conditional dependencies, anti-repetition diversity windows, physically plausible age/occupation/history and local population demographics configured by DM. Traits are tendencies, not direct outcome rules. Ordinary NPCs need not have secrets, trauma, quest functions, or elaborate pasts. Evaluate distribution and pattern leakage with seeded scenario suites.

**Tiering:** ambient mention -> candidate assigned to scene -> interacted NPC (identity, knowledge and disposition) -> mechanically relevant NPC (combat stats, inventory, skills) -> recurring story NPC (relationships, time evolution and detailed history). Make each tier expansion compatible with established facts. Keep nameless-but-rich candidates reusable until cast, then persist identity.

**Dialogue:** Nearby shows real scene participants and distance/visibility where supported. Talk switches composer to conversation, with optional generated suggested prompts plus unrestricted free text. Branching suggestions are affordances, not hard restrictions. Low-stakes greetings can use local templates; open-ended exchanges go to AI with bounded context. NPC may lie or believe false things but must not know hidden world facts they have no legitimate knowledge path to. Store transcript in scoped session log; journal receives concise, provenance-aware summaries with player/DM privacy control. Relationship changes and rumor spread are event-driven, not omniscient.

## 5. Examine, Nearby and contextual actions

- On supported desktop/web text selection, context menu includes **Examine** with stable entity/span reference, sanitized selected text and scene revision; touch/mobile provides selection/action sheet fallback. Do not use selected text as authoritative identity.
- Examine yields visible facts immediately; additional gated facts require a declared relevant check (Arcana/History/Religion/Nature/Investigation/Perception/etc), DC, actor, modifier and pending roll. Use existing deterministic dice and roll prompt controls, with no duplicate submissions. Failing a check does not imply no observable information; information tiers are DM-authored or rule-backed, not automatic arbitrary rewards for high roll.
- Nearby lists visible/interactable NPCs and objects with distance/relative-position metadata from the existing positioning layer when reliable; unknown range is displayed as unknown, never invented. Actions include Talk, Examine, Interact, Steal/Pickpocket, Search, Open and more based on authority and capability.
- Keep Narrative/Actions central and preserve six customizable workspace slots. Nearby and Journal are new swappable widget identities, not forced replacements or permanent seventh/eighth columns. Player sees only public/observed information.

## 6. Container and loot Foundry

**Container definition:** kind (chest, wardrobe, trunk, crate, barrel, desk, corpse, bag, shelf, vault), capacity, material, durability, location tags, owner/custodian, accessibility, search compartments, trap slots, lock slots, appearance, generation version.

**Context input:** biome, location (dungeon/castle/tavern/ship/etc), room function, faction, economy/wealth, culture, encounter tier, narrative era, owner occupation, faction equipment, quest and treasure-budget allocation. Context changes weighted loot pools without making impossible items likely. Common overlap across locations is expected.

**Loot selector:** curated item-definition IDs; seeded weighted picks conditioned on constraints, family, rarity, budget, container geometry and location. Distinguish ordinary property, deliberate treasure reward, quest objects, unique artifacts, and currency. Unique items register global uniqueness. Quest-critical items use explicit placement, discovery and recovery rules so random rolls cannot make the main quest impossible. Once materialized, contents persist; no reroll on reopening, retry, rejoin or scene re-entry.

**Item definition:** ruleset, type, source/version, rarity, value, weight, damage dice/type, reach/range and ammunition where applicable, weapon properties, AC/armor constraints, proficiency, charges, uses/recharge, save DC, effects, attunement, equip slots, magic tags and description. Generic longsword inherits canonical stats; do not invent range from a label. **Item instance:** stable ID or stack identity, quantity, owner/container, current holder, equipped state, durability, custom mechanics, origin and transfer history. Generated magical/homebrew mechanics require explicit review and executable rules validation. Unknown effects remain descriptive and cannot auto-apply.

## 7. Security and access

Mechanical locks, Arcane Lock and other explicitly supported magical security are distinct layers that can coexist on one object. Store DCs, key IDs, eligible checks/actions, lockpick prerequisites, material HP/AC as appropriate, suppression intervals, access credentials, bypass conditions, attempt state and optional DM restrictions. Opening and unlocking are separate operations. Knock resolves according to the selected ruleset and target spell definition, including applicable one-lock/suppression behavior and audible consequence; it is not a general lockpicking DC roll or universal magic bypass. Keys, thieves' tools, attacks, spells and DM-authored puzzles resolve via the existing rules/effect pipeline. No general retry farming or magical bypass of unsupported protections.

Traps have persistent identity, discover/disarm/trigger rules, save/DC, effects, target geometry, reset state, disclosure policy and permissions. On triggering, execute actual supported damage, resistance/immunity, HP, conditions, noise/alerts, summons or environmental effects via validated mechanics. Failed disarm triggers only when that trap's rules state so. Never narrate applied damage/loot before authoritative commit.

## 8. Ownership, theft and consequences

Separate ownership from faction hostility, affection, permission and legal right. Interaction projection derives **Open** for authorized access, **Loot** for legitimately claimable objects, and **Steal** for unauthorized taking/opening. Highlight theft-risk containers in red with accessible icon/label, not color alone. A friendly owner's goods can still be theft; a defeated enemy's loot may be claimable. Support mixed-ownership contents.

Unauthorized attempts create deterministic stealth/perception/evidence/witness events when warranted. Do not make all NPCs automatically know a hidden theft. Discoveries propagate through legitimate observation and communication and can change disposition, guard alerts, bounty, dialog, combat, pricing and quests. Provenance attaches to transferred items, not just the container. Player cannot steal from an NPC merely because it is listed Nearby; visibility, reach, skill rules, turn economy and valid targets still matter.

## 9. Phases, slices and gates

**Prerequisite G0: existing runtime stabilization (outside Foundry delivery).** Combat/rest/encounter lifecycle, inventory transfers, party auth and remote effect application must reach an explicitly tested safe baseline. Foundry work may develop isolated pure generators earlier, but live consequences cannot route through incomplete mutation authority.

| Phase | Slices | Deliverables | Exit gate |
| --- | --- | --- | --- |
| F1: Contracts & authority | F1.1 catalog/seed schema; F1.2 entity/instance/ownership schema; F1.3 permissions/event/idempotency contract; F1.4 migration plan | Shared types, threat model, migration fixtures | versioned, read-compatible, security review |
| F2: Generation core | F2.1 PRNG/replay; F2.2 constraint/weight DSL; F2.3 catalogs; F2.4 context/anti-repeat; F2.5 budget benchmark | Pure engine, seeded fixtures | repeatable and bounded offline output |
| F3: Item & containers | F3.1 canonical item bridge; F3.2 weighted loot; F3.3 containers/search compartments; F3.4 quest/unique injection; F3.5 persistent transfers | Rich mechanically valid loot and containers | no duplication on reopen/retry |
| F4: NPC population | F4.1 NPC component catalog; F4.2 candidate/tier casting; F4.3 knowledge and relationship graph; F4.4 DM editor; F4.5 NPC inventory integration | Stable cast and NPC mechanics | no retcon/secret leak |
| F5: Security/effects | F5.1 mechanical locks; F5.2 magical layers and Knock; F5.3 traps; F5.4 real effect apply; F5.5 timers/alarms | Lock/trap actions | actual validated consequences, no phantom HP |
| F6: Ownership & crime | F6.1 owner/permission projection; F6.2 steal/loot UI; F6.3 atomic theft/transfer; F6.4 witnesses/evidence; F6.5 relationship consequences | Coherent theft lifecycle | red label, legitimate access and privacy correct |
| F7: Scene actions & dialogue | F7.1 scene entity projection/Nearby; F7.2 selection-based Examine + mobile; F7.3 check/roll bridge; F7.4 dialogue UI/free text; F7.5 notes/knowledge summaries | Interactive persistent exploration | all three modes, roll and journal smoke pass |
| F8: DM orchestration | F8.1 scene casting intents; F8.2 constrained overrides; F8.3 dialogue prompt assembly; F8.4 story consequences; F8.5 AI cost routing/telemetry | AI/human parity | AI cannot bypass authority; 99% eligible generation |
| F9: Hardening & release | F9.1 DB migration/rollback; F9.2 multiplayer concurrency; F9.3 recovery/undo; F9.4 accessibility/platform; F9.5 performance/diversity; F9.6 end-to-end adventure | Gated pilot | CI + DB + devices + canonical adventure acceptance |

**Total: 9 phases, 45 slices.** Progress per slice is **planned → implemented → unit-tested → integrated → user-accepted**, never inferred from a merged PR alone. No parallel high-risk changes to existing combat authority without prerequisite gates.

## 10. Acceptance matrix (minimum automated and manual)

**D01 Determinism:** same seed + catalog/rules/context versions gives byte-equivalent normalized outputs across supported platforms; different seeds show appropriate diversity; generation never changes past revealed facts.  
**D02 Quality:** >=99% of eligible routine generation requests complete with zero AI calls across a declared >=10,000-case seeded benchmark; report exclusions, p50/p95 times, invalid combinations, per-category repetition and budget distribution. Diversity checked by recurring pattern/compatibility tests, not only total combination count.  
**D03 Item correctness:** ordinary longsword inherits proper chosen-edition mechanics including damage, range/reach, equipment properties, weight; magic effects cannot execute if unverified; unique items cannot duplicate.  
**D04 Containers:** dungeon vs castle vs tavern vs ship pools statistically reflect context while overlapping common items; wardrobes reject implausible bulk gear unless story override; generated contents persist across reloads and mode transitions.  
**D05 Quest safety:** a DM can inject a quest letter in a hidden compartment with investigation condition, and no random item budget evicts it; quest recovery/fallback is explicit.  
**D06 Transfer atomicity:** two players looting simultaneously yield one winner per indivisible item, correct remaining quantities, zero dupes, retry-safe receipt and consistent event history.  
**D07 Locks:** keys, tools, force and Knock obey actual configured mechanical/magical layers and campaign rules; suppressing a magical lock does not silently unlock other layers; audible events enter world log and nearby NPC awareness only when justified.  
**D08 Traps:** detection, disarm, trigger, resistance/immunity, condition, HP/tempHP and reset behavior are real; no narration-only damage; unsupported effects fail closed with clear DM intervention.  
**D09 Ownership:** authorized chest shows Open/Loot; unauthorized shows accessible red Steal; friendship alone does not transfer ownership; unobserved theft does not omnisciently alert guards.  
**D10 NPC continuity:** cast NPC retains identity/relationships/inventory after reconnect; knowledge derived only from witnessed/learned facts; DM secrets excluded from player API/logs and wrong-NPC prompts.  
**D11 Examine:** selected text resolves to a scene target safely; skill check uses one pending roll and verified outcome, with correct failure/partial/success narration; stale spans handled explicitly.  
**D12 Dialogue:** suggested choices and unrestricted free text; NPC can provide clues consistent with knowledge; transcript retained; concise journal entry links to NPC and preserves user/DM privacy.  
**D13 Workspace:** Nearby and dialogue work as interchangeable panels, including small-screen action sheets; moving panels never mutates world or loses draft; narrative remains readable.  
**D14 Multiplayer:** role/host/member proof enforced server-side, no client spoofed DM flag; cross-party IDs rejected; stale revision and concurrent update handled transactionally; party privacy follows existing permissions.  
**D15 Modes:** scripted end-to-end scenario works in human DM party, AI one-off and AI campaign using the same entity/command model, without duplicating state.  
**D16 Recovery:** refresh, crash, reconnect, AI timeout/retry, undo/rollback and migration rollback preserve exact committed ownership, locks, trap state and item counts; no ghost events.  
**D17 Security/performance:** cap catalog fanout, scene count, prompt context, NPC expansions and generator runtime; fuzz invalid templates, malicious AI instructions in selected text and unauthorized reads; produce benchmark and threat-model results.  
**D18 Regression:** existing combat baseline, party authorization, roll request sizing/placement, rest safety scoring, healing, NPC attack/damage and encounter closure continue passing; no unsafe new AI request on deterministic action.

**Representative acceptance adventure:** In one session encounter a nameless villager and a noble's guarded chest; inspect runes, request Arcana, open a legitimate barrel, pick the mechanical lock, use Knock on a separate magical layer, trigger poison trap, suffer actual HP damage, take a defined longsword and story letter, leave coins behind, get witnessed stealing, speak to villager freely and via suggested dialogue, then return after a rest/reconnect. Verify persistent world facts, journal and different player vs DM views, and repeat with a human DM and an AI campaign.

## 11. Test and rollout strategy

- New pure unit/property tests for PRNG reproducibility, catalog compatibility, graph consistency and budget invariants.
- Contract tests against `lib/api-zod` and `lib/api-spec/openapi.yaml`; DB transactions/concurrency against PostgreSQL, not mocked-only evidence.
- Focused existing runtime tests for item mechanics review, combat HP and condition effects, NPC creation, host authorization, roll prompts, party ownership, inventory transfers and adventure handoffs.
- Baseline commands per repo guidance: `pnpm run typecheck`, `pnpm run validate:combat-baseline`; add Foundry-specific `pnpm run validate:world-foundry` after actual scripts exist.
- Stage additive migrations with backup, shadow read/mirror instrumentation, opt-in feature flag for development worlds, canary scenarios, migration rollback and idempotent recovery. Never silently rewrite legacy items or NPCs.
- Validate web desktop context menu and touch long-press/mobile experience separately.
- Record completion evidence and remaining limitations in `docs/feature-status.md`, `docs/implementation-log.md`, `docs/migrations.md` when implementation occurs.

## 12. Explicit exclusions from initial release

No continuously simulated full-world population, infinite background ticking, full economic simulation, AI-authored arbitrary executable spells, guaranteed unlimited NPC dialogue offline, automatic edition conversion, unrestricted retroactive quest placement, or new combat engine. Advanced schedules, faction economies and wide rumor networks can extend the event-driven core only after F9 acceptance.

## 13. Immediate engineering starting point

After G0 baseline verification, begin **F1.1-F1.3** on a focused branch. Inventory exact existing NPC/item types and adapters; define versioned pure `WorldSeed`, `EntityDefinition`, `EntityInstance`, `WorldEvent`, `WorldCommand`, `OwnershipRecord` and `VisibilityPolicy` schemas; specify one authoritative commit path plus backward-compatible storage migration. Then implement F2 pure generation without wiring live UI or AI mutations. Do not expand live gameplay until persistence/auth gates pass.
