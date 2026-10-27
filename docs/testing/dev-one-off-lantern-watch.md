# DEV One-Off: The Lantern Watch — Manual Acceptance Run

## Launch

1. Pull `feature/workspace-panel-replacement`; run the API and frontend.
2. Use a saved character with combat abilities. Before launching, note HP, maximum HP, equipped attacks, healing spells, resources, potions and inventory.
3. **Adventure → Start New Adventure → One-Off Encounter → Dev Test One-Off: The Lantern Watch → Start Adventure.**
4. This preset uses a **fixed narrative script** (not a deterministic seeded combat fixture). AI-generated encounter mechanics and some UI features still require verification. Do not mistake AI prose for verified state changes.
5. Start a fresh one-off for each full run; reused combatants from older sessions may have invalid attack definitions.

## Acceptance route and checks

| Step | Player action | Expected verified outcome | Failure evidence |
|---|---|---|---|
| 1 | Read opening, inspect wall, ask what creatures are present | Narration establishes 2 bandits, open-ground distances, cover, and environment | AI invents extra foes or details inconsistent with state |
| 2 | Ask to attack an unestablished duck or rat | DM does **not** spawn it solely because it was named | New invented combatant appears |
| 3 | Search for the hidden lookout | Relevant check appears when warranted; roll continues story exactly once | Missing prompt, repeated continuation, stuck UI |
| 4 | Attack an established bandit | Real initiative/targets; legal hit/miss; name, attack, actual damage in event log/narration | Generic log, no target, fake damage |
| 5 | Use a class-specific bonus action or multiple attacks if actually available | Legal action economy; no duplicate Unarmed Strike cards; appropriate usage count | Double-spend/over-grant |
| 6 | End player's turn | NPC chooses valid action and acts (or holds for clear reason), turn advances | Stuck NPC or DM turn |
| 7 | Let NPC hit player | Server and character HP/temp HP change once; damage flash fires | Log says hit but HP doesn't move |
| 8 | Use existing potion, spell, or healing feature | Recovery applied once, costs spent once, server and sheet agree; heal effect plays | Item decrements but HP unchanged |
| 9 | Defeat both hostiles | Confirmed HP 0, correct defeat narration; initiative automatically ends | Looped player turn, perpetual DM/environment |
| 10 | Tap **Loot** in defeat narration | Modal shows actual eligible inventory; innate attacks excluded | Unarmed Strike appears as loot |
| 11 | Transfer one item, then remaining via Transfer All | Inventory gains items once; corpse no longer offers them; survives refresh | Duplicate/missing gear, repeated claim |
| 12 | Request rest while unsafe | Denied without resource restoration | Free reset |
| 13 | Secure guardroom; request short then long rest | Each rest governed by saved safety/DM authorization; correct resource recovery | Reset all at once; unapproved rest |
| 14 | If provisions enabled, select items manually | No auto-consumption; selected food/drink spent only upon authorized finalization | Silent item loss |
| 15 | Leave and finish story | Normal narrative resumes and recap closes | Combat status remains active |

### Known limitations — do not mark as passing on prose alone

- This preset controls **guidance**, not server fixture state. An AI may diverge; verify every mechanical claim from combat state and receipts.
- Scene-safety **auto-approval** and player-selected rest provisions were specified but not fully wired into the backend yet. Those are expected gaps, not passing checks.
- The NPC tactical brain does not yet implement fully authoritative movement, cover, or retreat.
- Generic generated enemy gear may use fallback attack definitions rather than a specific compendium monster.
- Exact spell recovery depends on the character's configured spell/feature mechanics. Do not invent a missing spell or potion just to pass this test.
- The workspace browser resize regression must pass separately from this gameplay route.

## Record results

For each step mark PASS/FAIL/BLOCKED, copy the session ID, character name, timestamp, actual message, expected state, actual state and (if relevant) a screenshot plus any API/event-log error. A BLOCKED step does not count as PASS.

Stop and report after any HP duplication, missing damage, remote mutation conflict, or repeated loot claim. Keep PR #84 unmerged until all critical steps pass and CI is green.

## 2026-10-27 partial-feature reconciliation

The feature-status and implementation-log documents track older phased work and are not evidence that recent PR #84 changes passed acceptance. Outstanding domains include:
- **NPC cover:** behavior selection and coordinate movement exist, but confirmed terrain, cover bonuses, obstacle routing, opportunity attacks and reactions on movement are incomplete.
- **Rest/provisions:** client now offers an opt-in selection of existing ration/food/water items; request persistence is supported. Approval, actual inventory validation/debit, crash-safe exactly-once consumption, and AI-DM rest orchestration remain incomplete. Do not mark selections as consumed.
- **Encounter closure:** automated death cleanup and manual closure preserving defeated NPC instances exist. Verify surviving nonhostiles, repeat end requests, persistent corpse loot, active-turn removal and state reopening after restart.
- **Generalized combat:** resistances/conditions are bounded, while arbitrary item effects, reflection and full homebrew convergence are incomplete.
- **Session orchestration:** the shared AI-DM narrative/roll loop is still partially local; multiplayer/campaign restart continuity, idempotent outcome receipts and interaction with authoritative combat need integration acceptance.
- **State history:** local undo is intentionally contained/disabled in risky paths. Shared server history and DM rollback are not implemented.
- **Party security and delivery:** access controls improved, but authorization-to-commit race safety and exactly-once inventory/notes delivery need verification.
- **Workspace:** resize browser acceptance remained red on the preceding checked run. Use actual Playwright evidence, not only unit tests.

This is a QA backlog, not a completion claim. The Lantern Watch one-off is a guided story seed, not a deterministic encounter fixture.

### Rest-provision handoff update (2026-10-27)

- Approved rests on a client now validate explicitly selected provision IDs against current food/water inventory, subtract one unit per selected item, and store a per-party/member/rest local replay marker before applying local rest recovery. Ordinary polling and reload retries skip already-marked rests.
- This is **not exactly-once durable inventory delivery**. A crash between writing that marker and saving item/recovery changes can leave the result partially applied; other devices and server inventory are not committed transactionally. Server-owned inventory/recovery and a committed application receipt remain required before marking full rest provisioning complete.
- If provision validation fails, the request remains unacknowledged for review rather than silently restoring resources or losing inventory.
