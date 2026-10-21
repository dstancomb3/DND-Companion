import assert from "node:assert/strict";
import test from "node:test";

import { createInitialOneOffOutcomeState } from "../../utils/adventure/aiDmOneOffOutcomeScaffold.ts";
import { buildOneOffSessionRecap, canApplyOneOffHandoff } from "../../utils/adventure/aiDmOneOffRecapScaffold.ts";

test("buildOneOffSessionRecap creates deterministic handoff metadata", () => {
  const outcomeState = {
    ...createInitialOneOffOutcomeState(),
    status: "encounter_closed" as const,
    closedAt: 1700,
    lootPreview: {
      rewardTier: "standard" as const,
      rewardLines: ["line 1"],
    },
  };

  const recap = buildOneOffSessionRecap({
    sessionId: "oneoff-recap-1",
    title: "Bridge Fight",
    difficulty: "balanced",
    stylePreset: "heroic",
    guidanceSource: "user",
    startInCombat: true,
    entries: [
      { id: "a", role: "system", text: "open" },
      { id: "b", role: "player", text: "act" },
      { id: "c", role: "tool", text: "outcome" },
    ],
    outcomeState,
  });

  assert.equal(recap.handoff.sessionId, "oneoff-recap-1");
  assert.equal(recap.handoff.schemaVersion, "oneoff-handoff.v1");
  assert.equal(recap.handoff.finalOutcomeStatus, "encounter_closed");
  assert.equal(recap.handoff.hasLootPreview, true);
  assert.equal(recap.handoff.entryCount, 3);
  assert.equal(recap.handoff.closedAt, 1700);
  assert.equal(recap.recapLines.length, 5);
  assert.match(recap.recapLines[0] ?? "", /Bridge Fight/);
  assert.match(recap.recapLines[3] ?? "", /Feed roles/);
});

test("canApplyOneOffHandoff requires closure and approval", () => {
  assert.equal(canApplyOneOffHandoff({ outcomeStatus: "loot_ready", isApproved: true }), false);
  assert.equal(canApplyOneOffHandoff({ outcomeStatus: "encounter_closed", isApproved: false }), false);
  assert.equal(canApplyOneOffHandoff({ outcomeStatus: "encounter_closed", isApproved: true }), true);
});
