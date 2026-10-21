import assert from "node:assert/strict";
import test from "node:test";

import { buildAiDmSessionPath, buildAiDmSessionRouteParams } from "../../utils/aiDmRouteDefs.ts";

test("buildAiDmSessionPath produces canonical adventure session path", () => {
  assert.equal(buildAiDmSessionPath("oneoff-abc"), "/adventure/session/oneoff-abc");
});

test("buildAiDmSessionRouteParams includes additive campaign fields when provided", () => {
  const params = buildAiDmSessionRouteParams({
    source: "phase11-campaign-scaffold",
    mode: "campaign_scaffold",
    title: "Shattered Crown - Chapter 1",
    difficulty: "balanced",
    stylePreset: "heroic",
    startInCombat: false,
    guidanceText: "Keep continuity.",
    campaignId: "campaign-shattered-crown-abc",
    campaignLabel: "Shattered Crown",
    chapterLabel: "Chapter 1",
  });

  assert.equal(params.mode, "campaign_scaffold");
  assert.equal(params.campaignId, "campaign-shattered-crown-abc");
  assert.equal(params.campaignLabel, "Shattered Crown");
  assert.equal(params.chapterLabel, "Chapter 1");
});