import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_GAMEPLAY_RULES_PROFILE,
  TACTICAL_GAMEPLAY_RULES_PROFILE,
  parseGameplayRulesProfile,
  previewEquipmentSwitch,
} from "../../utils/combat/gameplayProfile.ts";

test("absent session profile retains existing tabletop baseline", () => {
  assert.deepEqual(parseGameplayRulesProfile(undefined), DEFAULT_GAMEPLAY_RULES_PROFILE);
});
test("rejects mismatched preset cost and unknown versions rather than weakening authority", () => {
  assert.equal(parseGameplayRulesProfile({ schemaVersion: 1, id: "tactical_bg3_inspired", equipment: { switchWeaponCost: "object_interaction" } }), null);
  assert.equal(parseGameplayRulesProfile({ schemaVersion: 2, id: "dnd5e_2014", equipment: { switchWeaponCost: "object_interaction" } }), null);
  assert.equal(parseGameplayRulesProfile({ schemaVersion: 1, id: "unknown", equipment: { switchWeaponCost: "action" } }), null);
});
test("tactical equipment preview requires an available action", () => {
  assert.deepEqual(previewEquipmentSwitch(TACTICAL_GAMEPLAY_RULES_PROFILE, {
    isMyTurn: true, incapacitated: false, remainingActions: 0, objectInteractionUsed: false,
  }), { available: false, cost: "action", reason: "no_action_available" });
});
test("tabletop equipment preview reflects object interaction state", () => {
  assert.deepEqual(previewEquipmentSwitch(DEFAULT_GAMEPLAY_RULES_PROFILE, {
    isMyTurn: true, incapacitated: false, remainingActions: 0, objectInteractionUsed: false,
  }), { available: true, cost: "object_interaction" });
  assert.deepEqual(previewEquipmentSwitch(DEFAULT_GAMEPLAY_RULES_PROFILE, {
    isMyTurn: true, incapacitated: false, remainingActions: 1, objectInteractionUsed: true,
  }), { available: false, cost: "object_interaction", reason: "object_interaction_used" });
});
test("preview disallows out-of-turn and incapacitated changes in both profiles", () => {
  for (const profile of [DEFAULT_GAMEPLAY_RULES_PROFILE, TACTICAL_GAMEPLAY_RULES_PROFILE]) {
    assert.equal(previewEquipmentSwitch(profile, {
      isMyTurn: false, incapacitated: false, remainingActions: 1, objectInteractionUsed: false,
    }).available, false);
    assert.equal(previewEquipmentSwitch(profile, {
      isMyTurn: true, incapacitated: true, remainingActions: 1, objectInteractionUsed: false,
    }).available, false);
  }
});
