# DND Companion — Adaptive Adventure Combat UI & Living Bestiary

**Product specification · 2026-10-25 · Proposed features (unless explicitly marked implemented)**

**Goal:** Deliver a Baldur's Gate-inspired *interaction pattern* within the existing DND Companion, preserving open-ended tabletop play, player creativity, deterministic D&D mechanics, and the narrative continuity of an AI or human DM.

**Related plans:** [AI DM + deterministic combat](ai-dm-combat-convergence-plan.md), [combat runtime](combat-runtime.md), [feature status](feature-status.md). **Do not rebuild the existing character sheet or create a parallel combat engine.**

## 1. Locked product decisions

1. **Immersive, adaptive session:** A continuously accessible scene/story feed with a persistent contextual action dock. The active interaction (exploration, dialogue, pending roll, combat, loot) changes the dock. Do not build another endlessly scrolling stack of unrelated controls. Mobile-first, responsive desktop layout; full sheet/inventory/journal remain one tap away.
2. **Action-category composer:** Select Attack, Spells, Items, Other, etc., then reveal the legal, relevant options for the character. In the Attack category, filter melee, ranged, thrown, unarmed/natural, and feature-granted actions from *actual owned/equipped capabilities*. Do not show an empty ranged-weapons button when the character has no ranged weapon attack; spells and non-weapon ranged abilities are their own supported capabilities.
3. **Equipment-aware choices:** Equipped attacks appear ready; carried but unequipped weapons may appear with an explicit, rules-profile-dependent equip cost and confirmation. Never claim that *all* 5e equipment changes cost an action: distinguish tabletop RAW from the optional BG3-inspired tactical profile. Equipment changes, prerequisites, ammo, proficiency, resources, and action cost are validated and committed by the shared deterministic authority, not just described in the UI. Action-cost decisions are atomic and fail closed.
4. **Availability, not clutter:** Hide categories lacking any applicable capability. Show an expected but currently unavailable known option disabled *with a reason* (e.g. spent action, no ammo, empty slot, not your turn). Legal targeting, range, cover, concentration, spell preparation, bonus action, reaction, and party turn ownership are respected.
5. **Describe Action:** Every meaningful action may include an **optional** natural-language intent field (e.g. \"I feint high and strike toward his groin\"). Preserve this description with the selected target(s), ability/attack, action identifier, and authoritative result. The description influences AI DM narrative reaction; it **cannot guarantee hits, inflict extra conditions, disarm, alter damage, or bypass rules**. Creative improvised actions may require a DM ruling/check before state changes.
6. **Authoritative outcome → narration:** Submit a typed, idempotent action command; receive verified hit/miss/save/damage/conditions/resource expenditure/turn outcome; commit mechanically once; show concise result + optional expanded combat log; then request AI narration strictly grounded in that committed result. A failed/uncertain command is **never narrated as successful**. Avoid duplicate narration on refresh/retry, and preserve replay/remote authority safety.
7. **Gameplay profiles:** Separate **mechanical rules profile** (5e RAW, tactical/BG3-inspired, custom) from **presentation/automation** (cinematic narration, dice automation, compact menus, combat-log visibility). Cinematic is a presentation preference, not permission to invent mechanics. Host/DM owns shared mechanics; players own allowed personal UI preferences. Profile IDs and explicit options must be persisted/versioned for a session; no player-only rules divergence.
8. **Combat Effectiveness Advisor:** For a selected target, annotate eligible actions with known useful/ineffective interactions: immunity, resistance, vulnerability, creature-type-specific feature bonuses (e.g. undead smite if applicable in the selected rules revision), saving throws, conditions, range, etc. **Read-only** evaluation; never changes hit chances or damage independently. Distinguish confirmed mechanical interactions from probabilistic tactics. No blanket \"dragons resist fire\" rule; consult actual stat blocks/rules versions.
9. **Knowledge gating:** The rules engine may know a creature's full stat block, but the player UI may use only permitted/discovered knowledge. Advisor modes: Off, Discovered (default proposed), Assisted (non-secret suggestions), Full Tactical (explicit DM permission). Unseen defenses stay unknown. Zero damage after a miss is *not* evidence of immunity.
10. **Living Bestiary:** A searchable character-specific encounter and lore ledger, tied directly to the advisor; records creatures met, when/where (real timestamp + in-world time if known), campaign/session, identity uncertainty, observations, learned mechanics, rumors, source, confidence, and later corrections. Automatic evidence from **confirmed encounter and combat events**; AI/lore generates **proposals**, not automatic verified facts. No spontaneous numerical bonuses for learning; authorized class features still apply. Party sharing is explicit/permissioned.

## 2. Proposed interaction flow

**Exploration:** story + natural-language composer; choices optional.  
**DM requests a check:** replace dock with named skill/save, character modifier, roll button, pending/recovery state; narration resumes after authoritative acknowledgment.  
**Encounter active:** show turn/HP/status header and action-category dock; select target → choose legal attack/spell/item → inspect known effectiveness → optional **Describe Action** → review cost → roll/resolve → show canonical outcome → AI DM reacts in the established tone. A player can still speak/taunt or propose creative actions without falsely resolving attacks as prose.  
**Loot:** compact review/claim panel, with authoritative inventory/party mutation.

### Example
Player targets an identified fire-immune red dragon, selects Fireball. If the character previously confirmed fire immunity (or full tactical disclosure is authorized), the composer warns **Fire damage immune**. It does not prevent a permitted cast unless player/profile selects an explicit confirmation option. If immunity is secret, no privileged stat-block hint appears. Player may still cast; engine resolves; DM narrates the committed result.

## 3. Bestiary record contract (proposed)

- **Creature identity:** stable rules/source ID and edition or custom-creature instance ID; aliases, unidentified silhouette, DM visibility policy; avoid equating every creature of the same family with identical traits.
- **Encounter event:** immutable ID, character/party/campaign/session, creature instance, observed name, location ID/text, in-world date if provided, wall-clock time, encounter status, evidence/event reference.
- **Knowledge claim:** claim ID, trait type/value, applies-to scope (individual, variant, species only when justified), source (combat, study, NPC testimony, observation, DM revelation), confidence (`unknown` / `suspected` / `confirmed` / `refuted`), visibility, event provenance, revision history.
- **Disclosure projection:** server filters secret data *before* sending player-visible bestiary/advisor payload. Do not merely hide in React; prevent spoilers through sync, cached state, AI prompts, and party views.
- **Reconciliation:** deduplicate/replay-safe event ingestion; revisions do not erase provenance; contradictory claims remain traceable and can be corrected. No inference from an uncommitted or preview-only damage result.
- **Sharing:** player-to-party explicit reveal/grant, DM override and revocation policy, no automatic transfer of private creature information.

## 4. Implementation sequence and acceptance gates

| Slice | Deliverable | Acceptance |
| --- | --- | --- |
| **A — Shell (partially implemented)** | Persistent action dock and separate scrolling story, contextual entry to existing combat | PR #53 merged; still requires real browser/mobile layout and keyboard/scroll acceptance |
| **B — Profile contract** | Versioned rules-profile + personal UI preferences; explicit host authority | Tests prove two party members cannot disagree on equipment/action costs; safe migration/defaults |
| **C — Composer** | Category drill-down and capability filtering backed by current equipment/character/state | No phantom ranged-weapon attacks; unready actions disabled with explanation; no duplicate alternative engine |
| **D — Equip semantics** | Authoritative equip/change command with profile-sensitive costs | RAW vs tactical profile tests; no free equipment changes or double action deduction; remote failures reject safely |
| **E — Describe Action & result** | Optional description attached to stable action receipt and visible deterministic result | Misses are narrated as misses; intent cannot add mechanical effects; retries don't double apply/narrate |
| **F — Bestiary foundation** | Persist encounter history, creature identity, provenance-rich claims, personal ledger UI | Recorded where/when; reconnect persistence; no accidental hidden stat-block disclosure |
| **G — Advisor** | Read-only targeted assessment from permitted knowledge + versioned rules | Known immunity flagged; unknown stays unknown; exact type-specific effects only; no modifier mutation |
| **H — Knowledge acquisition & sharing** | Event-backed discovery, lore proposals, verified/refuted claims, party permissions | Miss ≠ immunity; rumors ≠ facts; controlled sharing, repeat/reconnect and cross-device regression |
| **I — E2E polish** | Desktop/mobile responsive panels, keyboard/focus, A11y, combat log and encounter narrative | Complete one-off: scene→roll→encounter→target→describe→resolve→narrate→bestiary→repeat |

**Non-goals for these slices:** wholesale sheet rewrite, invented AI rules, exposure of hidden creature data, live cloud deployment as prerequisite, or visually copying BG3 protected art/UI.

## 5. Current status / caveats

- **Already merged:** PR #48 story/combat navigation, #49 target picker, #51 explicit skill names, #52 prominent combat entry plus guard against prose attacks, #53 persistent contextual dock.
- **Not yet implemented:** category-drilldown composer; new equip semantics/profile authority; optional Describe Action binding; authoritative action-to-DM-narration round trip; Living Bestiary; effectiveness advisor; knowledge-gated server projection.
- **Known risk:** combat authority remains partly split between client and server; ensure resolution/apply, idempotency, authorization and party sync are robust before exposing richer automated mechanics. PR/CI success ≠ live mobile/multiplayer end-to-end validation.

**Work rule:** Before each slice, inspect the actual data contracts and prior changes; implement UI + deterministic behavior + focused tests together, report precisely what passed, update this document/status, and avoid drifting into unrelated features.
