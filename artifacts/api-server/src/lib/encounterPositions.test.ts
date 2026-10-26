import assert from "node:assert/strict";
import test from "node:test";
import { normalizeEncounterPositions, distanceBetweenPositions } from "./encounterPositions";
test("shared coordinates change distances to every other combatant", () => {
  const positions = normalizeEncounterPositions([
    { battleId: "a", combatantId: "hero", xFeet: 0, yFeet: 0, source: "dm_confirmed" },
    { battleId: "a", combatantId: "goblin1", xFeet: 20, yFeet: 0, source: "dm_confirmed" },
    { battleId: "a", combatantId: "goblin2", xFeet: 25, yFeet: 0, source: "dm_confirmed" },
  ]);
  assert.equal(distanceBetweenPositions(positions[0], positions[1]), 20);
  assert.equal(distanceBetweenPositions(positions[0], positions[2]), 25);
  const moved = { ...positions[0], xFeet: 20 };
  assert.equal(distanceBetweenPositions(moved, positions[1]), 0);
  assert.equal(distanceBetweenPositions(moved, positions[2]), 5);
});
test("ignores nonfinite coordinates and cross-battle distances", () => {
  assert.deepEqual(normalizeEncounterPositions([{ battleId: "a", combatantId: "hero", xFeet: Infinity, yFeet: 1, source: "dm_confirmed" }]), []);
  const [a,b] = normalizeEncounterPositions([
    { battleId: "a", combatantId: "hero", xFeet: 0, yFeet: 0, source: "dm_confirmed" },
    { battleId: "b", combatantId: "goblin", xFeet: 3, yFeet: 4, source: "dm_confirmed" },
  ]);
  assert.equal(distanceBetweenPositions(a,b), null);
});
