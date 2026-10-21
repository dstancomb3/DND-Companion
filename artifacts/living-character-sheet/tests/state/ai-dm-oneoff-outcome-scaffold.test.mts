import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOneOffLootPreview,
  createInitialOneOffOutcomeState,
  reduceOneOffOutcomeState,
} from "../../utils/adventure/aiDmOneOffOutcomeScaffold.ts";

test("buildOneOffLootPreview returns rich tier for deadly", () => {
  const preview = buildOneOffLootPreview({
    title: "Catacomb Breach",
    difficulty: "deadly",
    stylePreset: "grim",
    startInCombat: true,
  });

  assert.equal(preview.rewardTier, "rich");
  assert.equal(preview.rewardLines.length, 3);
  assert.match(preview.rewardLines[0] ?? "", /Catacomb Breach/);
});

test("reduceOneOffOutcomeState transitions to loot_ready on loot hook", () => {
  const state = reduceOneOffOutcomeState(createInitialOneOffOutcomeState(), {
    toolName: "outcome.loot_hook",
    structuredKind: "loot_hook_preview",
    toolStatus: "needs_follow_up",
    title: "Bridge Fight",
    difficulty: "balanced",
    stylePreset: "heroic",
    startInCombat: false,
  });

  assert.equal(state.status, "loot_ready");
  assert.ok(state.lootPreview);
});

test("reduceOneOffOutcomeState transitions to encounter_closed and preserves loot preview", () => {
  const withLoot = reduceOneOffOutcomeState(createInitialOneOffOutcomeState(), {
    toolName: "outcome.loot_hook",
    structuredKind: "loot_hook_preview",
    toolStatus: "applied",
    title: "Bridge Fight",
    difficulty: "balanced",
    stylePreset: "heroic",
    startInCombat: false,
  });

  const closed = reduceOneOffOutcomeState(withLoot, {
    toolName: "session.end_encounter",
    structuredKind: "encounter_closed",
    toolStatus: "needs_follow_up",
    title: "Bridge Fight",
    difficulty: "balanced",
    stylePreset: "heroic",
    startInCombat: false,
    now: 1234,
  });

  assert.equal(closed.status, "encounter_closed");
  assert.equal(closed.closedAt, 1234);
  assert.ok(closed.lootPreview);
});
