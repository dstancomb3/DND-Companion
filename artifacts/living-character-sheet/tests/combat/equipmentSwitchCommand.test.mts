import assert from "node:assert/strict";
import test from "node:test";
import { preflightEquipmentSwitch } from "../../utils/combat/equipmentSwitchCommand.ts";
import { DEFAULT_GAMEPLAY_RULES_PROFILE, TACTICAL_GAMEPLAY_RULES_PROFILE } from "../../utils/combat/gameplayProfile.ts";

const item = { id: "sword", name: "Longsword", category: "weapon" as const, equipped: false, quantity: 1 };
const request = {
  requestId: "req-1", battleId: "battle-1", actorMemberId: "hero", itemId: "sword",
  rulesProfile: TACTICAL_GAMEPLAY_RULES_PROFILE, expectedEquipmentVersion: 3, expectedTurnId: "hero",
};
const state = {
  inventory: [item], currentTurnId: "hero", isActiveBattle: true,
  incapacitated: false, remainingActions: 1, objectInteractionUsed: false, equipmentVersion: 3,
};
test("tactical preview requires an action but never changes item state", () => {
  assert.deepEqual(preflightEquipmentSwitch(request, state), { ok: true, cost: "action", command: request });
  assert.equal(item.equipped, false);
  assert.deepEqual(preflightEquipmentSwitch(request, { ...state, remainingActions: 0 }), { ok: false, reason: "no_action_available" });
});
test("tabletop rules use object interaction without action charge", () => {
  const command = { ...request, rulesProfile: DEFAULT_GAMEPLAY_RULES_PROFILE };
  assert.equal(preflightEquipmentSwitch(command, { ...state, remainingActions: 0 }).ok, true);
  assert.deepEqual(preflightEquipmentSwitch(command, { ...state, objectInteractionUsed: true }), {
    ok: false, reason: "object_interaction_used",
  });
});
test("request must belong to authoritative active turn", () => {
  assert.deepEqual(preflightEquipmentSwitch(request, { ...state, currentTurnId: "enemy" }), { ok: false, reason: "not_your_turn" });
  assert.deepEqual(preflightEquipmentSwitch(request, { ...state, isActiveBattle: false }), { ok: false, reason: "not_your_turn" });
  assert.deepEqual(preflightEquipmentSwitch(request, { ...state, incapacitated: true }), { ok: false, reason: "incapacitated" });
});
test("stale equipment revision, item and profile are rejected", () => {
  assert.deepEqual(preflightEquipmentSwitch(request, { ...state, equipmentVersion: 4 }), { ok: false, reason: "invalid_request" });
  assert.deepEqual(preflightEquipmentSwitch(request, { ...state, inventory: [] }), { ok: false, reason: "missing_weapon" });
  assert.deepEqual(preflightEquipmentSwitch(request, { ...state, inventory: [{ ...item, equipped: true }] }), { ok: false, reason: "already_equipped" });
  assert.deepEqual(preflightEquipmentSwitch({ ...request, rulesProfile: { schemaVersion: 1, id: "tactical_bg3_inspired", equipment: { switchWeaponCost: "object_interaction" } } as any }, state), { ok: false, reason: "invalid_profile" });
});
