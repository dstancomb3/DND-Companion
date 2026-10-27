import assert from "node:assert/strict";
import test from "node:test";

const Module = require("node:module");
const originalLoad = Module._load;
let buildAiDmOneOffFeedSeed: any;
try {
  Module._load = function(name: string, ...args: unknown[]) {
    if (name === "@/utils/adventure/aiDmOneOffSessionGuidance") {
      return {
        buildAiDmOneOffGuidanceSeed: (input: any) => ({ source: "user", guidance: input.guidanceText ?? "" }),
        buildAiDmCampaignGuidanceSeed: (input: any) => ({ source: "user", guidance: input.guidanceText ?? "" }),
      };
    }
    return originalLoad.call(this, name, ...args);
  };
  buildAiDmOneOffFeedSeed = require("../../utils/adventure/aiDmSessionFeedScaffold").buildAiDmOneOffFeedSeed;
} finally {
  Module._load = originalLoad;
}
const { ONE_OFF_SEEDS, resolveOneOffSeeds, buildSeedGuidance } = require("../../utils/adventure/oneOffAdventureSeeds");

test("100 curated combinations exist for each one-off seed category", () => {
  for (const kind of ["scenario", "location", "flavor"]) {
    assert.equal(ONE_OFF_SEEDS[kind].length, 100);
    assert.equal(new Set(ONE_OFF_SEEDS[kind]).size, 100);
  }
});
test("blank choices produce concrete, repeatable choices with injectable randomness", () => {
  const picked = resolveOneOffSeeds({}, () => 0);
  assert.equal(picked.scenario, ONE_OFF_SEEDS.scenario[0]);
  assert.equal(picked.location, ONE_OFF_SEEDS.location[0]);
  assert.equal(picked.flavor, ONE_OFF_SEEDS.flavor[0]);
  const guidanceText = `Session intent: ${buildSeedGuidance(picked)}`;
  const seed = buildAiDmOneOffFeedSeed({
    sessionId: "fresh-seed-test", title: "One-Off Encounter", difficulty: "balanced",
    stylePreset: "cinematic", guidanceText, startInCombat: false,
  });
  const opening = seed.entries.find((entry: any) => entry.role === "dm")?.text ?? "";
  assert.match(opening, /mist-covered mountain village/i);
  assert.match(opening, /missing caravan/i);
  assert.doesNotMatch(opening, /kind of moment that doesn't announce itself/i);
});
test("explicit selections are preserved while blanks are randomized", () => {
  const chosen = ONE_OFF_SEEDS.scenario[13];
  const selected = resolveOneOffSeeds({ scenario: chosen }, () => 0.5);
  assert.equal(selected.scenario, chosen);
  assert.equal(selected.location, ONE_OFF_SEEDS.location[50]);
});
