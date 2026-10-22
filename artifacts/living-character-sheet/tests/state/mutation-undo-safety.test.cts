import assert from "node:assert/strict";
import test from "node:test";
import { getLocalUndoAvailability } from "../../utils/mutationUndoSafety";
import type { MutationBatch } from "../../types";

const batch: MutationBatch = { id: "batch", timestamp: 1, source: "ai", description: "HP update",
  deltas: [{ id: "hp", label: "HP", before: "10", after: "8", approved: true }],
  beforeSnapshot: { currentHp: 10, tempHp: 7, conditionsBefore: [{ id: "old", name: "Prone" }], currency: { cp: 0, sp: 0, ep: 0, gp: 10, pp: 0 }, resourceStates: [{ id: "r", name: "R", priorCurrent: 5 }] },
  applied: true, undone: false };
for (const [label, candidate] of [
  ["legacy partial snapshots", batch],
  ["missing snapshot data", { ...batch, beforeSnapshot: undefined }],
  ["item-review updates", { ...batch, recordingStage: "awaiting_item_review" }],
  ["a caller-provided undoable flag", { ...batch, undoable: true, verified: true }],
] as const) test(`rejects ${label} without changing history`, () => {
  const before = JSON.stringify(candidate);
  assert.equal(getLocalUndoAvailability(candidate as MutationBatch).status, "unavailable");
  assert.match(getLocalUndoAvailability(candidate as MutationBatch).reason, /cannot safely reverse/);
  assert.equal(JSON.stringify(candidate), before);
});
test("missing and inactive entries return a readable refusal", () => {
  assert.match(getLocalUndoAvailability().reason, /No recorded/);
  assert.match(getLocalUndoAvailability({ ...batch, applied: false }).reason, /not applied/);
  assert.match(getLocalUndoAvailability({ ...batch, undone: true }).reason, /already marked/);
});
