import assert from "node:assert/strict";
import test from "node:test";

import { buildDeclaredReaction } from "../../utils/combat/buildDeclaredReaction.ts";

test("builds bounded shield reaction declaration", () => {
  const result = buildDeclaredReaction({
    triggerType: "shield",
    sourceType: "prepared_spell",
    sourceName: "Shield",
    spellLevel: 1,
  });

  assert.equal(result.declared?.reactionKind, "shield");
  assert.equal(result.declared?.reactionName, "Shield");
  assert.equal(result.declared?.triggerKind, "shield");
  assert.equal(result.declared?.sourceHint, "spell");
  assert.equal(result.declared?.targetHint, "self");
  assert.equal(result.declared?.effectHints?.[0]?.effectType, "ac_bonus");
});

test("builds bounded counterspell declaration with level hint", () => {
  const result = buildDeclaredReaction({
    triggerType: "counterspell",
    sourceType: "prepared_spell",
    sourceName: "Counterspell",
    spellLevel: 3,
  });

  assert.equal(result.declared?.reactionKind, "counterspell");
  assert.equal(result.declared?.effectHints?.[0]?.effectType, "counterspell_attempt");
  assert.equal((result.declared?.effectHints?.[0] as { counterLevel?: number } | undefined)?.counterLevel, 3);
});

test("reports explicit limitation for unsupported trigger declarations", () => {
  const result = buildDeclaredReaction({
    triggerType: "custom_parry",
    sourceType: "class_feature",
    sourceName: "Parry",
  });

  assert.equal(result.declared, undefined);
  assert.match(result.limitation ?? "", /not in the bounded C4 supported declaration set/i);
});
