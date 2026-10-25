import assert from "node:assert/strict";
import test from "node:test";
import { claimRollContinuation, rollContinuationReceiptKey } from "./aiDmRollContinuationReceipt";

test("continuation uses a stable scoped receipt key", () => {
  assert.equal(rollContinuationReceiptKey("one:off", "member", "roll/1"),
    rollContinuationReceiptKey("one:off", "member", "roll/1"));
  assert.notEqual(rollContinuationReceiptKey("one:off", "member", "roll/1"),
    rollContinuationReceiptKey("one:off", "other", "roll/1"));
});

test("uncertain and completed dispatches are never automatically reclaimed", async () => {
  const values = new Map<string, string>();
  const store = { getItem: async (k: string) => values.get(k) ?? null, setItem: async (k: string, v: string) => { values.set(k, v); } };
  assert.equal(await claimRollContinuation("receipt", store), true);
  assert.equal(values.get("receipt"), "dispatching");
  assert.equal(await claimRollContinuation("receipt", store), false);
  await store.setItem("receipt", "completed");
  assert.equal(await claimRollContinuation("receipt", store), false);
});

test("storage write failure prevents dispatch", async () => {
  await assert.rejects(claimRollContinuation("x", {
    getItem: async () => null,
    setItem: async () => { throw Error("storage unavailable"); },
  }));
});
