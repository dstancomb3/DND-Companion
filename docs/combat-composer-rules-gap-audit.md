# Combat Composer — Rules & Architecture Gap Audit (2026-10-25)

**Status:** Research and code audit; implementation gates, not a declaration of feature completion.
**Related:** [Adaptive Combat UI and Living Bestiary](adventure-combat-ui-and-living-bestiary-spec.md), [Combat runtime](combat-runtime.md).

## Critical findings

1. **2014 and 2024 D&D are mechanically different.** The current profile module describes a 2014 baseline and tactical house rules, but omits the 2024 rules revision. 2024 Attack action explicitly permits equipping *or* unequipping one weapon when making an attack, before or after each attack. Do not model this as a generic free weapon swap, or charge a full action for all 2024 draws. Source: https://www.roll20.net/compendium/dnd5e/Rules%3ARules%20Definitions (Attack action, 2024). 2014 free object interactions also require precise modeling of timing and additional interactions. Add an explicit edition identifier and action-context capability before enabling equipment execution.
2. **Party equipment mutations are not authoritative yet.** In `context/CombatContext.tsx`, party `useAction` invokes asynchronous `spendPlayerEconomy(...)`, then refreshes. In `CharacterContext.tsx`, `updateItem` directly updates local inventory. Connecting them naively can equip despite a server rejection. The PR #58 preflight is *read-only*: it cannot solve transactionality. Need an authenticated, atomic, idempotent server command persisting the equipment revision and economy change together, or an explicit fail-closed equivalent.
3. **Existing combat resolution also has broader asynchronous party-economy behavior.** Audit accepted-vs-committed semantics for all actions, not only equipment, before feeding results to the AI narrator. Narration must await committed receipts; retries need stable IDs; out-of-order refresh and multiple devices must not double-spend.
4. **Attack-card/action economy granularity is incomplete.** The current `AttackCard` submits `actionKind: "action"` per attack. Multiattack/Extra Attack needs per-Attack-action attack budgets, not an action per strike. Evaluate off-hand attack, two-weapon fighting, bonus action triggers, held/readied actions, reactions, opportunity attacks, movement between attacks, grappling/shoving and improvised actions.
5. **Capability projection needs provenance.** Equipped weapons are generated in `app/(tabs)/attacks.tsx` and now projected separately in the session. Consolidate both to one tested pure projector; account for unarmed/natural attacks, thrown-vs-ranged weapon capabilities, ammo/loading, weapon properties and masteries, handedness, proficiency, reach, item charges, buffs, temporary transformations, custom features and equipped-effect stacking.
6. **Legality vs tactical hints are different.** Attack eligibility must validate range, line of sight, cover, targets, resources, timing, conditions, and spell components/saves. Effectiveness assessment is a knowledge-gated read-only overlay, not an attack damage modifier. Unknown immunities must not leak through labels, sorting, logging, sync or AI prompts.
7. **Spell-specific mechanics must not be approximated by weapon defaults.** Prepared/known, concentration, ritual, components, slot consumption, reactions, action/bonus action, AOE targeting, saves, ongoing effects and version-dependent casting rules need independent typed contracts.
8. **Bestiary identity and evidence:** Per-creature instance/variant/edition, aliases and misidentification; record first and repeated encounters, place, game and real-world timestamps, source event ID, supported/rumored/refuted claims, source visibility. Zero damage can mean miss, successful save, temporary HP, resistance or immunity: don't automatically infer immunity. Handle party share/revoke, offline conflict, and AI-DM lore approval.
9. **Immersive UX acceptance:** Keyboard-safe sticky dock on mobile, correct scroll-to-roll/targets, compact combat drawer, accessibility labels and screen reader focus, loading/expired pending receipts, deliberate disabled states, authoritative action feedback, no debug cards by default, one-off end-to-end and multiplayer reconnection tests.

## Required changes to upcoming work

| Priority | Gate | Acceptance |
| --- | --- | --- |
| P0 | Preserve functioning in-session attack flow | Browser/mobile checks: equipped weapon, Unarmed Strike, target, verified damage; no empty composer regression |
| P0 | Atomic party action receipt audit | Server rejects stale/duplicate/wrong-turn spends without local equip; accepted receipt is committed, not merely queued |
| P0 | Edition-aware equipment rule model | Explicit 2014, 2024, tactical and custom policies; 2024 Attack action draw/stow semantics; tests per edition |
| P1 | Unified capabilities and per-action attack budget | Extra Attack, offhand, thrown, ammo, loading, reach, transformations; no phantom ranged weapon options |
| P1 | Authoritative equipment change UI | Equip costs visibly explained, disabled/available correctly, one confirmed mutation and rollback-safe refresh |
| P1 | Describe Action + grounded AI narration | Creative intent does not mutate outcomes; narration exactly reflects accepted hit/miss/effects |
| P2 | Bestiary + effectiveness projection | Provenance, confidence, server knowledge redaction and target-specific advisor tests |
| P2 | Gameplay profiles and accessibility polish | Host-rule lock + player presentation choices; desktop/mobile and multiplayer E2E acceptance |

## Immediate engineering caution

Do not enable a player-facing equipment switch control off `preflightEquipmentSwitch` alone. It is advisory and carries a proposed profile from a client request, not proof of the host-approved profile. The server must fetch the canonical profile, party role, inventory version, turn and resources itself.

## Research references

- D&D 2024 Attack action, weapon equipping, and Utilize: https://www.roll20.net/compendium/dnd5e/Rules%3ARules%20Definitions
- SRD 5.2.1 glossary: https://dungeontoolbox.com/library/dnd-2024/rules-glossary/
- Core repo review of `context/CombatContext.tsx`, `context/CharacterContext.tsx`, `app/(tabs)/attacks.tsx`, `components/attacks/AttackCard.tsx`, `utils/combat/gameplayProfile.ts`, `utils/combat/equipmentSwitchCommand.ts`.

**Acceptance discipline:** Unit/CI green is not evidence of actual live encounter, cross-device synchronization, or reliable AI DM narrative. Report separately.
