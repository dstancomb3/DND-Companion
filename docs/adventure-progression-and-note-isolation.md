# Adventure progression, encounter rewards, and isolated story knowledge
Decision: 2026-10-27. Status: design contract, implementation pending.

## Separate character progression from story records

**Persistent character ledger:** committed XP, levels, currency, acquired loot, consumable expenditure, and lasting sheet effects persist whether earned in live-DM play, an AI one-off, or an AI campaign. No one-off termination may revert these.

**Story knowledge is scoped:**
- `character`: character-sheet notes, people, quests, planes, and locations authored or gained through live-DM play. Never used as default world context for a one-off or AI campaign.
- `one_off:<sessionId>`: notes, people, quests, planes, and locations created/discovered in that one-off; visible in that one-off's Notes panel while active. Ending or quitting removes the active view and archives/cleans the ephemeral records. It must not merge these into character-sheet/live-DM notes.
- `campaign:<campaignId>`: permanent campaign-specific story records. Closing preserves them for resume. Ending archives the campaign and removes its live notes from active views; a completed/ended campaign can be viewed in its archived adventure history, not silently merged with the live-DM sheet.
- `party:<partyId>` when explicitly supplied by a human DM: share only what the human-DM party authorizes; otherwise keep character-sheet notes private.

All Notes / People / Quests / Planes / Locations APIs, prompts, AI memory retrieval, quest graph operations, person/plane/location creation, relation links, and UI views must require a scope ID. Missing scope must not quietly default to character notes for AI adventure submissions. Human-DM legacy paths can retain explicit `character` scope during migration.

Every scoped entry needs `scopeKind`, `scopeId`, `characterId`, `sourceSessionId` (where applicable), owner/visibility, timestamps, and stable IDs. Authorization must verify membership and prevent users from reading other campaigns' or other characters' notes. Provide deliberate **Copy to Character Notes** only when a player requests it, never automatic promotion.

## XP from combat and quests

- A defeated encounter generates an authoritative reward event identified by `encounterId` and `awardId`, not by an AI claim that an enemy died. Award XP **once** when encounter closure confirms the defeated hostiles and eligibility. Do not award again on reload, replay, manual End Encounter, or looting.
- Derive encounter XP from the verified monster/encounter stat blocks and configured 5e rule set; distinguish encounter building multipliers from *actual XP awarded*. Where the monster's CR/XP is unknown, require DM adjudication rather than guessing.
- For group awards, a campaign-defined split policy determines eligible player characters (e.g. evenly divided among participating PCs). Store precise recipient XP and rounding/leftover policy in the reward receipt. NPC allies don't silently take a PC share.
- Quests have individually confirmed completion receipts and optional DM-approved reward amounts. One-off quests may award persistent XP even though their story records remain scoped to the one-off. Do not award XP from merely displaying or accepting a quest.
- Validate nonnegative bounded XP, unique receipt IDs, character ownership, level-up thresholds and eligible advancement mode (XP versus milestone). Apply progression exactly once with existing level-up mechanics, retaining class-level selection/player review where required; do not silently choose multiclass options.
- A fatal one-off can still preserve earned XP and loot on dream awakening. Ending or archiving any adventure does not duplicate rewards or restore consumed items.

## UX and acceptance

Each adventure has its own **Notes** panel with Notes / People / Quests / Planes / Locations tabs and a clear current-session/campaign label. Closing a campaign preserves these; terminating a one-off removes them from the active sheet and AI context. The regular character sheet continues to display live-DM character records only.

Test a player with existing live-DM notes entering a one-off (no contamination), writing one-off notes (no character-sheet mutation), ending the one-off (ephemeral notes no longer active), resuming a closed campaign (notes retained), archiving an ended campaign (notes no longer live), cross-character access denied, a combat XP grant once, repeated defeat closure, quest reward once, XP level threshold, and persistence through a death-dream exit.

**Do not claim shipped:** current legacy quest/note mutation surfaces are not scoped end-to-end, and encounter/quest XP reward receipts and leveling integration still need implementation.

## Clarification: complete Notes system scope

In this project, **Notes** is the entire related five-part world-information system: **Notes, People, Quests, Planes, and Locations**. Scope all five together, including parent/child locations, plane-location containment, person-location associations, quest people and places, relationship graphs, status/history, AI retrieval/indexing, and generated records. References must be checked against the same scope; reject cross-scope links unless the player explicitly chooses a supported import/copy flow. Ending a one-off removes that scope from active retrieval and UI without deleting persistent character progression. Closing a campaign keeps all five categories for later continuation; ending a campaign archives them as a unit.

## Quest items: inventory and narrative scope boundary

Quest objects are a special inventory category because a character can carry them physically without owning them as permanent rewards.

- **Adventure-bound quest item:** has a stable inventory instance ID, owner character, source session/campaign scope, source quest ID, `disposition: "quest_bound"`, and explicit visibility/equip/use permissions. It belongs to the relevant one-off or campaign scope even though it appears in the current character inventory. This includes letters, keys, evidence, relics held for delivery, and other unresolved plot objects. Do not expose them in unrelated adventures or live-DM inventory.
- **Earned reward / ordinary loot:** `disposition: "persistent_reward"`, with a verified award/transfer receipt. Its inventory remains with the character when a one-off ends, including items that used to be quest objects but were deliberately awarded or released by an authoritative quest outcome.
- **Existing character-owned items:** retain their original provenance and cannot be deleted by cleanup for an adventure they were merely brought into.
- **One-off termination:** retire only still-quest-bound instances associated with that exact one-off after recording the ending. Never match or delete by item name, category, or shared item definition. Preserve consumed-item debits and all persistent loot.
- **Campaign close:** retain quest items for its next session; **campaign end:** archive/retire still-bound quest objects with that campaign, while preserving explicitly granted permanent rewards.
- **Death awakening:** follows the same one-off/campaign termination cleanup policy. A quest object cannot follow the character out merely because it was present when they died; an explicitly awarded object can.
- **Quest completion:** may consume/turn in the object, return it to an NPC, or award ownership. Each operation needs one authoritative, idempotent inventory/quest receipt and updates the linked quest state. Never assume the player keeps the item just because the quest became completed.
- **UI:** show a `Quest Item · [Adventure]` badge, distinguish temporary from permanent items, and before End Adventure / End Campaign optionally explain which bound items will be left behind. Scope-aware inventory and AI prompts must filter them correctly.
- **Security and recovery:** verify exact owner and adventure scope on creation, use, trade, consumption, promotion and cleanup. Promotion to persistent inventory must be DM/game-authorized rather than a client toggle. Atomic ending cleanup must not run twice, delete similarly named real items, or duplicate rewards.

Acceptance: acquire two same-named keys from different scopes; retain an imported real key; close/reopen campaign; complete quest and convert relic to awarded item; end one-off after death and preserve XP/reward but retire quest key; duplicate end request; disconnected device reconciliation. These are proposed rules; runtime implementation remains outstanding.
