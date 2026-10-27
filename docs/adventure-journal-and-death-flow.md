# Adventure History and Character Death — Product Decision (2026-10-27)

## A. Future feature: completed adventures become character journal entries (PARKED)

When a one-off or campaign reaches a confirmed completed state, offer to create an AI-written **Adventure** entry in the *character's* journal. It should give the player a browsable history of what that character has actually experienced.

- Summarize the story from **committed** session events, completed quests, known locations, character decisions, NPC interactions, significant combat results, loot, and the ending. AI prose must not invent encounters, rewards or outcomes absent from the record.
- Store title, dates/session ID, one-off vs campaign, involved character ID, chapters or key moments, outcome, related quests/locations, and a durable source-event range/version. Longer campaigns can have chapter summaries and a final synthesis.
- Preview/edit/approve before saving, with an opt-in or user-confirmed journal action. Support revisiting saved entries on the character sheet and finding the adventure timeline.
- Idempotent entry creation keyed to character + completed session + summary version; preserve existing player notes and permit explicit regenerations/revisions without duplicate entries.
- Character privacy: do not copy private DM notes, secret NPC motives or other players' restricted details into a player's journal.
- Ending via death, retirement or abandonment is distinct from successful completion. Never describe an abandoned session as a victorious quest.
- Save and render summaries through journal persistence, not a chat-only message.

**Status:** Idea approved for later; do not divert the current stabilization branch into automatic summarization.

## B. Current priority: adventure death and recovery

### State distinctions

1. **Conscious/alive:** HP > 0.
2. **Downed:** HP = 0; use existing 5e death-save, stabilization and damage-at-zero rules. This is **not** death.
3. **Dead:** The authoritative death state is confirmed (e.g. three failed death saves or a qualifying fatal effect). An ordinary potion or generic healing action must not silently reverse it.
4. **Revived:** Only after a valid resurrection/revival pathway succeeds with its requirements/costs and an authoritative state change.
5. **Adventure ended / quit:** The player may leave the one-off or campaign; record the outcome without falsely restoring HP or deleting the character.

### UX at confirmed death

Show a narrative-first death outcome with two clear choices:

- **Revive:** Open a recovery flow. Show any genuinely available in-world resurrection spell, item or DM-granted option with eligibility, costs, timing and confirmations. In an AI-DM game, offer a clearly labeled, configurable *story-mode revival* only if that campaign's rules/settings allow it. Do not grant automatic free revival, generate resurrection inventory, or claim a cast succeeded without a committed receipt. If no valid revival is available, show why, allow a request to the DM, and keep Quit accessible.
- **Quit adventure:** Confirm ending/leaving the adventure, preserve character/journal/history and any already committed party state, then navigate to a safe destination. Do not delete the character or loot by default. For an active multiplayer party, quitting controls the dead player's participation, not everybody else's session.

Ensure player can inspect the death events before choosing; avoid permanent blocking modals over the entire party interface. On reload, restore the same awaiting-decision state. Once revived, return to normal play only after authoritative state confirms revival. Once quit, do not submit more actions on the terminated character adventure.

### Implementation acceptance

- Test HP-zero but alive, stable unconscious, genuine death, valid and invalid revival, reload mid-choice, resurrection resource spending, multiplayer dead-member turn removal, AI-DM narration continuity, and Quit without character deletion.
- Require idempotent death/revive/quit command receipts, authorization, rollback-safe resource debits, client/server HP and death-save convergence, and combat-log/narration consistency.
- Adventure journal summary comes **later**, after encounter/session closure is reliable.

## Related sources
- `docs/feature-status.md`
- `docs/ai-dm-combat-convergence-plan.md`
- `docs/testing/dev-one-off-lantern-watch.md`
- `artifacts/living-character-sheet/context/CharacterContext.tsx` (death saves and ordinary-healing block for dead characters)
