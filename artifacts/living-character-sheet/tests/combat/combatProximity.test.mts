import assert from "node:assert/strict";
import test from "node:test";
import { buildCombatProximityRows } from "../../utils/combat/combatProximity.ts";
const targets = [
  { id: "self", name: "Hero", type: "member" as const },
  { id: "far", name: "Archer", type: "npc" as const },
  { id: "near", name: "Wolf", type: "npc" as const },
  { id: "hidden", name: "Unknown", type: "npc" as const },
];
test("sorts confirmed distances and keeps unknown distance explicit", () => {
  const result = buildCombatProximityRows({
    viewerId: "self", battleId: "one", targets,
    observations: [
      { viewerId: "self", battleId: "one", targetId: "far", distanceFeet: 60, source: "dm_confirmed" },
      { viewerId: "self", battleId: "one", targetId: "near", distanceFeet: 5, source: "grid_authority" },
    ],
  });
  assert.deepEqual(result.map(r => r.id), ["near", "far", "hidden"]);
  assert.deepEqual(result.map(r => r.distanceLabel), ["5 ft", "60 ft", "Distance unknown"]);
});
test("ignores cross-battle, other-viewer and untrusted distances", () => {
  const result = buildCombatProximityRows({
    viewerId: "self", battleId: "one", targets,
    observations: [
      { viewerId: "other", battleId: "one", targetId: "near", distanceFeet: 0, source: "dm_confirmed" },
      { viewerId: "self", battleId: "another", targetId: "far", distanceFeet: 1, source: "dm_confirmed" },
      { viewerId: "self", battleId: "one", targetId: "hidden", distanceFeet: -1, source: "dm_confirmed" },
    ],
  });
  assert.ok(result.every(r => !r.distanceKnown));
  assert.ok(result.every(r => r.distanceLabel === "Distance unknown"));
});
