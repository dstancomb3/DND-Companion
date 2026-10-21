import assert from "node:assert/strict";
import test from "node:test";

import { createAiDmCampaignSessionBootstrap } from "../../utils/adventure/aiDmCampaignSessionBootstrap.ts";

test("createAiDmCampaignSessionBootstrap builds stable campaign scaffold shape", () => {
  const now = 1731000000000;
  const result = createAiDmCampaignSessionBootstrap(
    {
      campaignName: "Shattered Crown",
      chapterTitle: "Chapter 1: Ashfall Road",
      guidanceText: "Preserve continuity",
      difficultyProfile: "balanced",
      stylePreset: "heroic",
    },
    now,
  );

  assert.equal(result.createdAt, now);
  assert.match(result.sessionId, /^campaign-shattered-crown-/);
  assert.equal(result.setup.campaignName, "Shattered Crown");
  assert.equal(result.setup.chapterTitle, "Chapter 1: Ashfall Road");
  assert.equal(result.setup.guidanceText, "Preserve continuity");
  assert.equal(result.sessionLabel, "Shattered Crown - Chapter 1: Ashfall Road");
});

test("createAiDmCampaignSessionBootstrap falls back to default campaign fields", () => {
  const result = createAiDmCampaignSessionBootstrap(
    {
      campaignName: "   ",
      chapterTitle: "   ",
      difficultyProfile: "story",
      stylePreset: "cinematic",
    },
    1000,
  );

  assert.equal(result.setup.campaignName, "Campaign Scaffold");
  assert.equal(result.setup.chapterTitle, "Chapter 1");
  assert.match(result.sessionId, /^campaign-campaign-scaffold-/);
});