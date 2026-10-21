import assert from "node:assert/strict";
import test from "node:test";

import { buildCampaignChoiceOptions } from "../../utils/adventure/aiDmCampaignChoicePresentation.ts";

test("buildCampaignChoiceOptions strips numeric/alpha prefixes", () => {
  const options = buildCampaignChoiceOptions([
    "1) Scout ahead",
    "B] Talk to the guard",
    "- Set camp",
  ]);

  assert.equal(options.length, 3);
  assert.equal(options[0]?.label, "Scout ahead");
  assert.equal(options[1]?.label, "Talk to the guard");
  assert.equal(options[2]?.label, "Set camp");
});

test("buildCampaignChoiceOptions splits label/detail on delimiter", () => {
  const options = buildCampaignChoiceOptions([
    "Investigate the altar - risky but may reveal lore",
    "Take the side tunnel: avoids patrols",
  ]);

  assert.equal(options.length, 2);
  assert.equal(options[0]?.label, "Investigate the altar");
  assert.equal(options[0]?.detail, "risky but may reveal lore");
  assert.equal(options[1]?.label, "Take the side tunnel");
  assert.equal(options[1]?.detail, "avoids patrols");
});

test("buildCampaignChoiceOptions preserves original raw choice for submission", () => {
  const source = "2) Negotiate with the bandit captain";
  const options = buildCampaignChoiceOptions([source]);

  assert.equal(options.length, 1);
  assert.equal(options[0]?.rawChoice, source);
  assert.equal(options[0]?.label, "Negotiate with the bandit captain");
});
