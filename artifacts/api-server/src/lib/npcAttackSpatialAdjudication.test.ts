import assert from "node:assert/strict";
import test from "node:test";
import { validateNpcAttackSpatialAdjudication as check } from "./npcAttackSpatialAdjudication";

const dm = (distanceFeet: number) => ({ source: "host_dm", distanceFeet, clearLineOfSight: true });
test("require host DM confirmation before weapon hits", () => {
  assert.deepEqual(check("80/320 ft", undefined), { ok: false, reason: "spatial_adjudication_required" });
  assert.deepEqual(check("80/320 ft", { ...dm(30), clearLineOfSight: false }), { ok: false, reason: "invalid_spatial_adjudication" });
  assert.deepEqual(check("80/320 ft", { ...dm(30), source: "ai_dm" }), { ok: false, reason: "invalid_spatial_adjudication" });
});
test("enforce weapon maximum range and fail closed on unknown notation", () => {
  assert.deepEqual(check("80/320 ft", dm(321)), { ok: false, reason: "target_out_of_range_or_requires_disadvantage" });
  assert.deepEqual(check("80/320 ft", dm(80)), { ok: true, distanceFeet: 80 });
  assert.deepEqual(check("80/320 ft", dm(81)), { ok: false, reason: "target_out_of_range_or_requires_disadvantage" });
  assert.deepEqual(check("melee", dm(10)), { ok: false, reason: "target_out_of_range_or_requires_disadvantage" });
  assert.deepEqual(check("melee", dm(5)), { ok: true, distanceFeet: 5 });
  assert.deepEqual(check("unknown", dm(1)), { ok: false, reason: "unsupported_range_notation" });
  assert.deepEqual(check("80/320 ft", dm(-10)), { ok: false, reason: "invalid_spatial_adjudication" });
});
