import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAiDmCampaignFeedSeed,
  buildAiDmOneOffFeedSeed,
  buildAiDmPlayerInputReplyStub,
  buildAiDmQuickActionOutcome,
} from "../../utils/adventure/aiDmSessionFeedScaffold.ts";

test("buildAiDmOneOffFeedSeed uses user guidance when provided", () => {
  const result = buildAiDmOneOffFeedSeed({
    sessionId: "oneoff-abc",
    title: "Bridge Fight",
    difficulty: "balanced",
    stylePreset: "heroic",
    guidanceText: "Character context (do not quote verbatim): Test Hero. Session intent: A quiet walk through the woods with a new friend.",
    startInCombat: false,
  });

  assert.equal(result.guidanceSource, "user");
  assert.equal(result.entries.length, 3);
  const dmEntry = result.entries[1]?.text ?? "";
  // Must be rich prose — not leaking template scaffolding
  assert.doesNotMatch(dmEntry, /scene opens/i);
  assert.doesNotMatch(dmEntry, /choose your approach/i);
  assert.doesNotMatch(dmEntry, /character context/i);
  assert.doesNotMatch(dmEntry, /session intent/i);
  // Should be a substantive opening paragraph, not a one-liner
  assert.ok(dmEntry.length > 80, `expected rich opening prose, got: "${dmEntry}"`);
});

test("buildAiDmPlayerInputReplyStub returns deterministic summary", () => {
  const text = buildAiDmPlayerInputReplyStub({
    playerText: "I talk to the captain.",
    title: "Bridge Fight",
    stylePreset: "grim",
    difficulty: "deadly",
  });

  assert.match(text, /I talk to the captain/);
  assert.match(text, /Bridge Fight/);
  assert.match(text, /grim/);
  assert.match(text, /deadly/);
});

test("buildAiDmQuickActionOutcome maps known action", () => {
  const out = buildAiDmQuickActionOutcome("start_combat");
  assert.equal(out.role, "tool");
  assert.match(out.text, /combat/i);
});

test("buildAiDmCampaignFeedSeed starts with empty feed", () => {
  const result = buildAiDmCampaignFeedSeed({
    sessionId: "campaign-shattered-crown-abc",
    campaignName: "Shattered Crown",
    chapterTitle: "Ashfall Road",
    difficulty: "balanced",
    stylePreset: "heroic",
    guidanceText: "Keep continuity visible.",
  });

  assert.equal(result.guidanceSource, "user");
  assert.equal(result.entries.length, 0);
});
