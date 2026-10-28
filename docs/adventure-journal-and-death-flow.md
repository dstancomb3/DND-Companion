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

## C. Death exit: waking from a vivid dream (approved presentation concept, pending implementation)

When a **confirmed dead** character chooses **Quit Adventure**, show a cinematic, accessible transition rather than a plain route change:

1. Preserve and close/leave only the character's session participation under the proper authority; store the session ending and cause-of-death receipt. Do not silently resurrect or change the persistent character's HP.
2. Fade the active adventure narrative and controls smoothly to full black.
3. Navigate to the character sheet **under** the black cover. The new sheet starts with a substantial Gaussian blur.
4. As the black veil fades out, reveal the blurred sheet and a restrained text overlay: “You awaken suddenly from a very vivid dream.” Follow with a short, causally grounded sensory echo of the killing event.
5. Ease the sheet blur down to zero as the text fades. Controls remain unavailable during the brief transition, then normal sheet interaction resumes. Provide reduced-motion alternative with no blur and a short static narrative, and allow Skip.

Example death echoes (generated only from *committed cause-of-death facts*, never guessed):
- Dragon breath: “For a moment, the scorched scent of the dragon still seems to cling to the air.”
- Fatal fall: “Your legs tense as though the ground is still rushing up to meet you.”
- Poison: “A bitter taste lingers at the back of your throat.”
- Unknown cause: no invented monster or material; use a generic fading-memory line.

**Crucial rules distinction:** the dream presentation is a cinematic epilogue, not proof the death was a dream in-world, not a free mechanical revival and not permission to resume a dead character at full health. If the intended product decision is that quitting a one-off *actually resets the character*, that requires an explicit separate noncanonical/dream-mode adventure setting and clear save semantics. Preserve real-campaign deaths until a legal revival is committed.

Persist source session ID, character ID, confirmed ending, structured fatal event (cause, damage type, source, height for falls), and a presentation version; resume safely if interrupted. Do not expose private DM details through cause-of-death narration.

## D. Fall damage: deterministic environmental hazard (implementation backlog)

Rules baseline: 2014 and 2024 D&D 5e falling hazards deal **1d6 bludgeoning per full 10 feet**, maximum 20d6; landing causes Prone unless damage is avoided entirely. Apply the configured edition's supplementary rules (e.g. 2024 water reaction where eligible).

Require a server-authoritative fall event with actor, start/end elevation or confirmed drop distance, landing surface, current encounter/session state, and event/command ID. Height must come from DM-confirmed environmental geometry or an explicit adjudication, not ungrounded AI narration.

Resolution pipeline: validate fall and any prevention (flight, feather fall, hover, safe landing abilities), resolve permitted reactions, calculate damage dice and reductions/resistance/immunity, update temp HP/HP and death saves including massive damage where applicable, apply Prone when eligible, emit single committed event and narration receipt, then evaluate death or encounter consequences. The client must never deduct fall damage twice on retry.

Test 0–9, 10, 30, 200, and >200 feet; water; prevented fall; resisted bludgeoning; temp HP; downed-at-zero damage; lethal massive damage; duplicate command; death-to-quit transition and fatal-fall epilogue. Vertical position is separate from two-dimensional encounter coordinates and cannot be inferred solely from them.

**Status:** design captured; not a claim of implemented fall mechanics or exit animation.

## E. Campaign Close vs End — clarified product contract (2026-10-27)

**Close Campaign** is temporary navigation out of a long-running campaign. Save state, party/session context, quest progress, journal and recent narrative so the player can resume. No ending summary, no death/dream presentation, no campaign termination. Label action clearly as **Close / Return Later**.

**End Campaign** is a deliberate, irreversible conclusion of that campaign's playable story; it is not the same as closing it. Before ending, show a confirmation explaining that the unfinished story and future campaign turns will be cut short. Preserve the character and historical record rather than deleting them. Mark campaign status `ended_early` if ended while alive (distinct from `completed` for a natural story conclusion), disable continuation, and optionally archive a truthful unfinished-story journal summary later. Do **not** use the dream awakening for a living character deliberately ending an unfinished campaign.

**End Campaign after confirmed character death**: this is the same cinematic **vivid-dream awakening** presentation as Quit Adventure after death: fade the adventure to full black, navigate to the character sheet behind the veil, reveal the sheet through a Gaussian blur, show “You awaken suddenly from a very vivid dream” followed by an actual death-cause sensory echo, then fade text and blur away. Distinguish the campaign's ended/death outcome from the character's mechanical death state; the transition itself does not grant a rules resurrection. Preserve the session history and committed character state.

**Revive** remains available on confirmed death when eligible and does **not** terminate the campaign. The player may continue their saved campaign after valid revival. A dead player's **Close Campaign / Return Later** retains the awaiting-revival-or-end state instead of forcing a death ending.

### Expected state transitions

| Current state | User action | Campaign state | Presentation |
| --- | --- | --- | --- |
| Active, alive | Close Campaign | Paused / resumable | Ordinary return to sheet/home |
| Active, alive | End Campaign | Ended early / not resumable | Confirmation and bittersweet unfinished-story exit |
| Active, dead | Close Campaign | Paused / resumable | Awaiting death decision on resume |
| Active, dead | Revive | Active after authorized recovery | Return to story |
| Active, dead | End Campaign | Ended after death / not resumable | Black fade, dream awakening, blurred sheet, death-cause echo |
| Natural campaign finale | Complete Campaign | Completed / archived | Ending summary / future adventure journal |

Guard against duplicate termination, preserve multiplayer participant boundaries, offer an explicit confirmation before End, and record one authoritative ending command receipt. The later AI journal should label `ended_early`, `ended_after_death`, and `completed` honestly.

**Status:** product behavior agreed, implementation and acceptance pending.

## F. Dream awakening canon and persistent character consequences (2026-10-27 — clarified creative direction)

**Core intent:** AI one-offs are optional/noncanonical to the shared world timeline, **not** mechanically inconsequential. Their events genuinely change the player's persistent character: XP earned, items and consumables spent, gear and currency gained or lost, and other committed sheet changes survive the adventure. The "vivid dream" epilogue is **deliberately uncanny**, suggesting the adventure was real in some way even though the player awakens elsewhere.

- The death/quit dream awakening represents **temporary adventure death** in this product mode. It ends the current one-off (or an explicitly ended-after-death campaign) and returns the persistent character to a playable sheet via an **explicitly authorized mode-specific recovery transition**, rather than leaving a permanently dead sheet. This is **not** an ordinary healing spell, nor should the cinematic animation itself mutate HP.
- A one-off may be noncanonical to campaign/world story continuity while retaining canonical **character mechanical consequences**. Distinguish `worldCanon: optional/noncanonical` from `characterProgression: persistent` in future session contracts.
- Track XP, loot gained, consumed items, spent resources, inventory changes, and other approved outcomes as committed facts with unique transaction IDs; reconcile exactly once when ending. Do not reset inventory/XP to a pre-adventure snapshot and do not invent rewards to make the epilogue work.
- The dream epilogue implies continuity through **physical residue**: salt on the lips after drowning, sand in boots after a desert, a whiff of scorched flesh after dragon fire, fingers still aching after a fatal fall. These details come from the committed adventure event/setting. Sensory trace is atmospheric unless a specific material item has actually been awarded; don't inject unrecorded sand, water, injuries or loot into mechanical inventory.
- The narrator does **not** assert “it was only a dream” or explain the mystery. The default opening is “You awaken suddenly from a very vivid dream,” followed by a restrained, personalized sensory echo. Let the player infer that something crossed over.
- A real long campaign still has **Close** (resumable) and **End** (permanent termination). If ended after death, use this same uncanny awakening and explicitly recover the persistent character under the campaign's configured ending policy, carrying legitimate consequences forward; don't silently revive the character in active shared combat or undo committed death for other party members.
- Recovery must have an authoritative, idempotent end-of-adventure receipt recording the final death state, sheet transition/revival semantics, retained progression, and ended session. A retry must never duplicate XP or loot; failure must be reconcilable.
- Show a **character change summary** after the awakening, optionally expandable: XP gained, items obtained, provisions consumed, significant status changes. Keep the story's reality mysterious while showing mechanically truthful results.

**Previous design correction:** Earlier sections said the dream transition does not itself resurrect a dead character. This remains true at the animation layer, but the *actual user-facing desired outcome* is that a character who ends a one-off after death wakes up alive and retains real sheet consequences. Implement that as a distinct authorized story-mode death resolution, not as generic D&D resurrection. Apply the same philosophy to explicitly ended-after-death campaigns, with the campaign's agreed persistence rules.

**Status:** Product intent recorded; server-side recovery, reconciliation, character delta receipts and animated transition are not yet implemented.
