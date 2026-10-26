# Modular Adventure Workspace: Desktop UI/UX Concept

**Status:** Proposed design specification, not an implementation or acceptance claim  
**Date:** 2026-10-25  
**Product:** DND Companion · AI DM / Adventure / Combat  
**Design priority:** Desktop first; mobile adaptation later  
**Related:** [Adaptive Adventure Combat UI & Living Bestiary](adventure-combat-ui-and-living-bestiary-spec.md), [Adventure DM Session Runtime](adventure-dm-session-runtime-spec.md), [AI DM + Combat Convergence](ai-dm-combat-convergence-plan.md)

## 1. Vision

Turn the existing adventure session into an immersive, rearrangeable workspace: **the narrative is the center of play**, while combat, party state, equipment, objectives and history are useful supporting surfaces rather than a wall of permanent controls.

Players should be free to choose a focused story experience or an information-rich tactical view, without switching between their character sheet and session to complete normal actions.

**Do not rebuild the character sheet, introduce a new combat engine, or substitute visually appealing placeholder controls for validated gameplay.** Reuse existing components and canonical session state.

## 2. Design references

Two generated concept images informed this specification:

1. **Narrative-focused desktop combat concept**: `a_high_resolution_dark_themed_ui_screenshot_of_a.png`. Shows the story occupying the main center view, with contextual action controls and supporting side rails. This establishes narrative hierarchy, not the final side-rail content.
2. **Six-zone modular desktop workspace concept**: `d_d_companion_sunken_temple_encounter.png`. Shows a two-row, three-column layout with movable panel headers, inventory snapshot, objectives, encounter pressure, story, player action composer, event log, **Simplify View**, **Customize Layout**, and preset picker. This is the primary layout reference, not a final implementation mockup.

**Asset handoff:** The original PNGs are retained as separate reference files from this design session. The GitHub text connector cannot directly attach these binary assets; add them under `docs/assets/adventure-workspace/` using the above filenames in a later binary-capable upload. Do not treat the images as already committed. Their content and the contract below should be reconciled before implementation, especially where generated placeholder gameplay details differ.

## 3. Six workspace zones

Initial **Balanced** preset:

| Position | Initial panel | Purpose |
| --- | --- | --- |
| Top left | Party | Character portraits, health, relevant conditions, active-turn cue |
| Bottom left | Inventory Snapshot | Relevant equipment/consumables, optionally a character summary |
| Top middle | Adventure Narrative | Continuously unfolding DM narration, dialogue, player actions, authoritative consequences |
| Bottom middle | Action Composer | Contextual controls: exploration, dialogue, check, combat or loot |
| Top right | Objectives & Encounter | Current objective, active threat/clock, conditions and encounter cues |
| Bottom right | Event Log | Recent committed actions, damage, rolls and recoverable session events |

These are **defaults, not permanently assigned positions**. A player can swap top-left and bottom-right, top-middle and bottom-middle, or any other pair.

### Slot and widget model

- **Slot** = spatial location in the saved layout; **widget** = reusable view backed by existing app state.
- Every slot supports **Replace panel**, **Swap with**, **Collapse/Expand**, and optional **Panel settings**.
- A dedicated **Customize Layout** mode enables drag-and-drop, swap handles, insertion/replacement menus, resizing, reset and Save/Cancel. Outside that mode, panels are not draggable.
- Widgets may include Party, Narrative, Combat Actions, Inventory, Character Summary, Spellbook, Journal/Notes, Objectives, Encounter/Initiative, Event Log, Bestiary and Map, but only when real data/features exist. Empty or unsupported widgets must say so.
- Swapping widgets swaps slot assignments **without losing local widget settings** or altering character/game state. Replacing a widget does not delete its underlying data.
- Initially, one instance per widget type is a reasonable default. Multiple independent views of the same underlying data are future work and require explicit state/scoping design.

## 4. Narrative priority and adventure loop

The top-middle story region is **not a hero image, map or decorative illustration**. It is a readable chronological feed of what happened, who spoke, what the player did, and how the DM responded.

- Maintain generous line length, spacing and legible type; distinguish DM text, player actions, NPC dialogue, system-verified results and optional timestamp/turn metadata.
- Narrative scroll is independent of other panels. When a player scrolls backward, do not yank them to new messages. Provide a clear Jump to Latest affordance.
- New turn, pending check, dialog choice or loot review should be evident even if the story widget was moved/collapsed.
- AI suggested choices remain optional. Freeform input is always accessible while permitted. Fictional action descriptions do not override mechanical results.
- AI DM narration must follow acknowledged authoritative outcome; no invented hits, damage, inventory changes or conditions.
- The optional future 'Show me' scene illustration is a user-triggered accessory, never the permanent center-pane default and never blocks play.

## 5. Adaptive action composer

The bottom-middle composer follows session mode:

| State | Composer behavior |
| --- | --- |
| Exploration | Freeform intent plus optional suggested actions |
| Dialogue | NPC response/choices and freeform conversation |
| Required roll | Clearly named check/save, modifier, roll control, pending/acknowledged/expired/retry states |
| Combat | Active turn, legal action categories, equipment-aware choices, target selector, economy, optional Describe Action and authoritative results |
| Loot/rewards | Inspect/review/claim with authoritative inventory and party changes |
| Not player's turn | Controls disabled/dimmed with a reason, but story and permitted observation accessible |

- Categories appear only if meaningful for that character/state; expected but unavailable abilities can remain disabled with an explanation.
- No phantom ranged attack for a character without a corresponding capability.
- **Self is absent from hostile target choices.** Show self only when targeting rules allow it; if an action can *only* target self, no redundant target list.
- Targeting supports multiple targets/AOE only when the selected action rules demand it; target knowledge and visibility constraints apply.
- Show costs and conflicts before submitting; command is committed once by shared authority and narrated afterward.
- NPCs/companions use real allowed action, equipment, resource and turn contracts. NPC turn progression cannot rely on a player-facing hidden debug button.
- Keep mechanics profiles (5e rules/edition, host tactical variant) distinct from personal presentation settings.

## 6. Simplify View

**Simplify View** should meaningfully reduce cognitive load, not simply hide labels.

- Preserve the narrative and the **current required interaction** as the primary focus.
- Collapse secondary widgets into compact title rows/chips or an accessible drawer; show only essential party/turn status and any urgent condition.
- Preserve the six-zone Balanced/Tactical layout configuration unchanged in the background and restore it when leaving Simplify.
- **Critical signals never vanish:** pending required roll, active player turn, authoritative action failure, resource cost confirmation, expiring reaction, current objective when needed.
- An optional focused presentation can give the center region more width while retaining a one-click way back.
- Narration, game rules and session authority do not change merely because Simplify is toggled.

## 7. Layout presets and preferences

Initial presets:

- **Immersive:** large story area, compact contextual controls, optional drawers for secondary widgets.
- **Balanced:** six-zone starter layout in §3.
- **Tactical:** expanded action composer, encounter order/resources and log for combat-heavy play.

Presets are starting points, not locked modes. Players can customize and save their own layouts. A preset switch must not silently overwrite a customized layout without offering save/restore.

Recommended saved settings: versioned layout ID; slot-to-widget mappings; panel visibility/collapsed state; panel-specific view configuration; column widths and vertical splits; selected preset/custom name; simplify preference; device class and user/character scope as appropriate.

Do **not** store canonical HP, items, rolls or session authority in layout preferences.

## 8. Resizing, collapse, and accessibility

- Draggable vertical column dividers and horizontal split boundaries with minimum usable sizes. **No arbitrary free-floating overlapping windows** in the initial version.
- Sensible minimum sizes for narrative and action controls. On small desktop widths, optional columns may collapse into drawers without losing actions.
- Keyboard-accessible **Move to position** and **Swap with** menus so customization is not drag-only.
- Clear focus outline, high contrast, labeled icon buttons, screen reader panel names, live-region announcements for meaningful turn/roll outcomes and readable disabled reasons.
- Do not let fixed bottom composers obscure the latest narrative or required roll. Respect window zoom and resizes.
- Remember panel state across navigation/refresh; provide Reset to Balanced and recovery for corrupt/obsolete preference payloads.

## 9. UI hierarchy and visual language

Follow the current app screenshots: dark charcoal/navy surfaces, restrained violet action/accent glow, thin subdued borders, clean modern controls, succinct labels, compact status badges, and differentiated HP/resource indicators.

- Story typography may be slightly more literary, while controls stay practical and scannable.
- Avoid duplicate initiative/combatant lists, repeated action economy panels, permanently expanded attribute tables or verbose debugging information in the default workspace.
- Header contains campaign/session identification and concise controls for **Simplify**, **Customize Layout** and preset selection.
- In gameplay mode, panel chrome remains subtle. Editing mode exposes drag handles, slot outlines and replacement affordances prominently.

## 10. State and technical boundaries

1. Render widgets as projections of existing canonical session, combat, character, equipment, party and AI DM state. Avoid alternate local 'truth' for combat.
2. Layout changes are strictly view preferences, with no gameplay commands or state mutations.
3. Multi-user party participants may each have different layouts, while sharing server-authoritative mechanics, permissions and event results.
4. Role-gated tools and private information must be filtered server-side, not merely hidden when the widget changes.
5. Use stable widget and slot IDs; version persisted layouts for migration. Fallback gracefully when a feature is unavailable.
6. Async loading, reconnect, pending actions and duplicate submissions should remain correct when widgets are moved, collapsed or remounted.
7. Presentation controls must never expose secret bestiary information or private DM notes.

## 11. Recommended incremental implementation

**A. Inventory existing UI/data contracts.** Map reusable Party, Story, Composer, Objectives, Inventory, Event Log and status components; identify who currently owns scrolling, pending rolls and turn state.

**B. Six-zone shell.** Build layout containers using existing panels with a fixed Balanced default first; desktop resize/scroll/focus acceptance.

**C. Customize.** Add intentional edit mode, keyboard-accessible swap/replace, then drag/drop and resizable gutters; persist layout with schema version and reset flow.

**D. Simplify + presets.** Implement genuine focus behavior and Immersive/Balanced/Tactical templates without losing per-player customization.

**E. Gameplay hardening.** Confirm targeted actions, NPC turns, pending rolls, disabled states, reconnect and authorized data isolation across moved/collapsed widgets.

**F. Polish and mobile.** Improve responsive arrangements, ergonomic focus and reduced motion; mobile is separate design acceptance, not merely a squeezed desktop grid.

## 12. Acceptance scenarios

- Swap **Party ↔ Event Log**; their content changes place immediately and remains correct after reload.
- Swap **Narrative ↔ Action Composer**; required roll and next player action remain obvious, usable and keyboard reachable.
- Replace **Inventory Snapshot** with **Character Summary**, then restore inventory without data loss.
- Resize columns and vertical split; no clipped commands, overlapping panels or missing roll prompts.
- Enable Simplify in combat: nonessential panels collapse, but the active turn, legal next action, pending check, targets, and outcome still surface.
- Switch to Tactical then back to saved custom Balanced layout without losing personal settings.
- Move/collapse narrative during an AI DM response; no duplicate messages, rerolls, actions or dropped scroll state.
- On NPC turn, player action buttons are disabled; NPC resolution advances and updates event log/narrative appropriately.
- Host/DM-only widgets remain unauthorized for ordinary party members regardless of widget placement.
- Keyboard-only users can reorder, replace, collapse and reset all six panels.

## 13. Design questions to resolve during implementation

- Should personalization be scoped per account, character, campaign, or combination? Prefer a sane per-user default with optional per-character layouts.
- How long should the narrative and log remain mounted versus virtualized when off-screen?
- What panel combinations warrant linked selection (e.g. target selected in an Encounter widget surfaces in the Composer)?
- How should currently active required interactions interrupt a heavily customized layout without overriding the user's rearrangement?

**Decision:** Proceed with desktop modular workspace as a design direction. This document authorizes no production deployment or assertion of completed implementation.
