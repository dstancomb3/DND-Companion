import assert from "node:assert/strict";
import test from "node:test";
import { normalizeEncounterDistances } from "./encounterDistances";
test("normalizes only confirmed finite relative distances", () => {
  assert.deepEqual(normalizeEncounterDistances([
    { battleId: "battle", viewerId: "hero", targetId: "wolf", distanceFeet: 15, source: "dm_confirmed" },
    { battleId: "battle", viewerId: "hero", targetId: "hero", distanceFeet: 0, source: "dm_confirmed" },
    { battleId: "battle", viewerId: "hero", targetId: "archer", distanceFeet: -5, source: "dm_confirmed" },
    { battleId: "battle", viewerId: "hero", targetId: "unknown", distanceFeet: 5, source: "ai_guessed" },
  ]), [{ battleId: "battle", viewerId: "hero", targetId: "wolf", distanceFeet: 15, source: "dm_confirmed" }]);
});
test("drops duplicate and malformed observations", () => {
  assert.equal(normalizeEncounterDistances([
    { battleId: "b", viewerId: "a", targetId: "z", distanceFeet: 10, source: "dm_confirmed" },
    { battleId: "b", viewerId: "a", targetId: "z", distanceFeet: 90, source: "dm_confirmed" },
  ]).length, 1);
  assert.deepEqual(normalizeEncounterDistances(null), []);
});
