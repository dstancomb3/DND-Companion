import assert from "node:assert/strict";
import test from "node:test";

import { createAiDmOneOffSessionBootstrap } from "../../utils/adventure/aiDmOneOffSessionBootstrap.ts";

test("createAiDmOneOffSessionBootstrap builds stable one-off shape", () => {
  const now = 1731000000000;
  const result = createAiDmOneOffSessionBootstrap(
    {
      title: "Bandit Ambush at Dusk",
      difficultyProfile: "balanced",
      stylePreset: "cinematic",
      startInCombat: true,
    },
    now,
  );

  assert.equal(result.sessionLabel, "Bandit Ambush at Dusk");
  assert.equal(result.createdAt, now);
  assert.equal(result.setup.difficultyProfile, "balanced");
  assert.equal(result.setup.stylePreset, "cinematic");
  assert.equal(result.setup.startInCombat, true);
  assert.match(result.sessionId, /^oneoff-bandit-ambush-at-dusk-/);
});

test("createAiDmOneOffSessionBootstrap falls back to default title", () => {
  const result = createAiDmOneOffSessionBootstrap(
    {
      title: "   ",
      difficultyProfile: "story",
      stylePreset: "grounded",
      startInCombat: false,
    },
    1000,
  );

  assert.equal(result.sessionLabel, "One-Off Encounter");
  assert.equal(result.setup.title, "One-Off Encounter");
  assert.match(result.sessionId, /^oneoff-one-off-encounter-/);
});
