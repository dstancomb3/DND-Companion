import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOneOffToolCall,
  executeOneOffToolCall,
  isAiDmOneOffToolAllowed,
  policyForOneOffTool,
} from "../../utils/adventure/aiDmOneOffToolBridge.ts";

test("one-off tool allowlist accepts supported key", () => {
  assert.equal(isAiDmOneOffToolAllowed("session.offer_choices"), true);
  assert.equal(policyForOneOffTool("session.offer_choices"), "safe_auto_apply");
});

test("one-off tool allowlist rejects unsupported key", () => {
  assert.equal(isAiDmOneOffToolAllowed("session.spawn_world_map"), false);
  assert.equal(policyForOneOffTool("session.spawn_world_map"), "deny_unsupported");
});

test("executeOneOffToolCall rejects unsupported tool", () => {
  const result = executeOneOffToolCall(
    buildOneOffToolCall({
      toolName: "session.spawn_world_map",
      payload: {},
      sessionId: "oneoff-1",
    }),
  );

  assert.equal(result.status, "rejected");
  assert.match(result.outcomeSummary, /unsupported/i);
});

test("executeOneOffToolCall handles player input tool", () => {
  const result = executeOneOffToolCall(
    buildOneOffToolCall({
      toolName: "session.append_player_input",
      payload: {
        playerText: "I talk to the captain.",
        title: "Bridge Fight",
        stylePreset: "heroic",
        difficulty: "balanced",
      },
      sessionId: "oneoff-2",
    }),
  );

  assert.equal(result.status, "applied");
  assert.match(result.outcomeSummary, /I talk to the captain/);
  assert.equal(result.structuredResult?.kind, "player_input_ack");
});

test("executeOneOffToolCall exposes structured kinds for outcome hooks", () => {
  const loot = executeOneOffToolCall(
    buildOneOffToolCall({
      toolName: "outcome.loot_hook",
      payload: {},
      sessionId: "oneoff-3",
    }),
  );
  const end = executeOneOffToolCall(
    buildOneOffToolCall({
      toolName: "session.end_encounter",
      payload: {},
      sessionId: "oneoff-4",
    }),
  );

  assert.equal(loot.structuredResult?.kind, "loot_hook_preview");
  assert.equal(end.structuredResult?.kind, "encounter_closed");
});
