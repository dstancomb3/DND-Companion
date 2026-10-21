import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAiDmCampaignGuidanceSeed,
  buildAiDmOneOffGuidanceSeed,
} from "../../utils/adventure/aiDmOneOffSessionGuidance.ts";

test("guidance seed uses user guidance when provided", () => {
  const result = buildAiDmOneOffGuidanceSeed({
    title: "Bridge Fight",
    difficulty: "balanced",
    stylePreset: "heroic",
    guidanceText: "Keep this fast and cinematic.",
  });

  assert.equal(result.source, "user");
  assert.equal(result.guidance, "Keep this fast and cinematic.");
});

test("guidance seed falls back to title/style/difficulty", () => {
  const result = buildAiDmOneOffGuidanceSeed({
    title: "Bridge Fight",
    difficulty: "deadly",
    stylePreset: "grim",
    guidanceText: "   ",
  });

  assert.equal(result.source, "fallback");
  assert.match(result.guidance, /Bridge Fight/);
  assert.match(result.guidance, /grim/i);
  assert.match(result.guidance, /deadly/i);
});

test("campaign guidance seed uses user guidance when provided", () => {
  const result = buildAiDmCampaignGuidanceSeed({
    campaignName: "Shattered Crown",
    chapterTitle: "Ashfall Road",
    difficulty: "balanced",
    stylePreset: "heroic",
    guidanceText: "Preserve continuity beats.",
  });

  assert.equal(result.source, "user");
  assert.equal(result.guidance, "Preserve continuity beats.");
});

test("campaign guidance seed falls back to campaign metadata", () => {
  const result = buildAiDmCampaignGuidanceSeed({
    campaignName: "Shattered Crown",
    chapterTitle: "Ashfall Road",
    difficulty: "deadly",
    stylePreset: "grim",
    guidanceText: "   ",
  });

  assert.equal(result.source, "fallback");
  assert.match(result.guidance, /Shattered Crown/);
  assert.match(result.guidance, /Ashfall Road/);
  assert.match(result.guidance, /deadly/i);
  assert.match(result.guidance, /grim/i);
});
