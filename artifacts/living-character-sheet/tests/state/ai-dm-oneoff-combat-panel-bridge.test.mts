import assert from "node:assert/strict";
import test from "node:test";

import { buildOneOffToolCall, executeOneOffToolCall } from "../../utils/adventure/aiDmOneOffToolBridge.ts";

test("combat.start_oneoff_encounter returns needs_follow_up", () => {
  const result = executeOneOffToolCall(
    buildOneOffToolCall({
      toolName: "combat.start_oneoff_encounter",
      payload: { source: "combat-panel" },
      sessionId: "oneoff-c1",
    }),
  );

  assert.equal(result.status, "needs_follow_up");
  assert.match(result.outcomeSummary, /combat/i);
});

test("session.end_encounter returns needs_follow_up", () => {
  const result = executeOneOffToolCall(
    buildOneOffToolCall({
      toolName: "session.end_encounter",
      payload: { source: "combat-panel" },
      sessionId: "oneoff-c2",
    }),
  );

  assert.equal(result.status, "needs_follow_up");
  assert.match(result.outcomeSummary, /encounter/i);
});
