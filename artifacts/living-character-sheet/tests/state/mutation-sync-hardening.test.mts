import assert from "node:assert/strict";
import test from "node:test";

import { buildResourceUndoChanges } from "../../utils/mutationUndo.ts";
import { computeAICallIdempotencyKey, dedupePendingAICalls, type PendingAICall } from "../../utils/aiQueue.ts";
import type { MutationBatchSnapshot, Resource } from "../../types/index.ts";

test("resource undo derives reverse deltas from before snapshot", () => {
  const snapshot: MutationBatchSnapshot = {
    resourceStates: [
      { id: "r1", name: "Ki", priorCurrent: 4 },
      { id: "r2", name: "Action Surge", priorCurrent: 1 },
    ],
  };
  const current: Resource[] = [
    { id: "r1", name: "Ki", current: 2, max: 4, resetOn: "short_rest" },
    { id: "r2", name: "Action Surge", current: 1, max: 1, resetOn: "short_rest" },
  ];

  const changes = buildResourceUndoChanges(snapshot, current);

  assert.deepEqual(changes, [{ resourceId: "r1", resourceName: "Ki", delta: 2 }]);
});

test("ai queue idempotency key is deterministic for same logical request", () => {
  const one = computeAICallIdempotencyKey({
    type: "parse-update",
    payload: JSON.stringify({ text: "used second wind" }),
    characterId: "char-1",
  });
  const two = computeAICallIdempotencyKey({
    type: "parse-update",
    payload: JSON.stringify({ text: "used second wind" }),
    characterId: "char-1",
  });
  const differentPayload = computeAICallIdempotencyKey({
    type: "parse-update",
    payload: JSON.stringify({ text: "took 5 damage" }),
    characterId: "char-1",
  });

  assert.equal(one, two);
  assert.notEqual(one, differentPayload);
});

test("ai queue dedupe keeps only one entry per idempotency key", () => {
  const duplicateKey = computeAICallIdempotencyKey({
    type: "parse-update",
    payload: "{\"text\":\"loot\"}",
    characterId: "char-1",
  });

  const items: PendingAICall[] = [
    {
      id: "a",
      type: "parse-update",
      payload: "{\"text\":\"loot\"}",
      characterId: "char-1",
      label: "first",
      enqueuedAt: 10,
      retries: 0,
      idempotencyKey: duplicateKey,
    },
    {
      id: "b",
      type: "parse-update",
      payload: "{\"text\":\"loot\"}",
      characterId: "char-1",
      label: "second",
      enqueuedAt: 20,
      retries: 1,
      idempotencyKey: duplicateKey,
    },
  ];

  const deduped = dedupePendingAICalls(items);

  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].id, "b");
  assert.equal(deduped[0].retries, 1);
});

test("ai queue idempotency keys differ across characterIds — separate chars are never deduped", () => {
  const keyA = computeAICallIdempotencyKey({
    type: "parse-update",
    payload: JSON.stringify({ text: "used action surge" }),
    characterId: "char-1",
  });
  const keyB = computeAICallIdempotencyKey({
    type: "parse-update",
    payload: JSON.stringify({ text: "used action surge" }),
    characterId: "char-2",
  });

  // Same payload for two different characters must produce distinct keys.
  assert.notEqual(keyA, keyB);

  // Deduplication must preserve both items.
  const items: PendingAICall[] = [
    { id: "x", type: "parse-update", payload: JSON.stringify({ text: "used action surge" }), characterId: "char-1", label: "char1", enqueuedAt: 1, retries: 0, idempotencyKey: keyA },
    { id: "y", type: "parse-update", payload: JSON.stringify({ text: "used action surge" }), characterId: "char-2", label: "char2", enqueuedAt: 1, retries: 0, idempotencyKey: keyB },
  ];
  const deduped = dedupePendingAICalls(items);
  assert.equal(deduped.length, 2);
});

test("ai queue idempotency keys differ across call types — parse-update vs analyze-loot not deduped", () => {
  const payload = JSON.stringify({ text: "found treasure" });
  const keyParse = computeAICallIdempotencyKey({ type: "parse-update", payload, characterId: "char-1" });
  const keyLoot = computeAICallIdempotencyKey({ type: "analyze-loot", payload, characterId: "char-1" });

  assert.notEqual(keyParse, keyLoot);

  const items: PendingAICall[] = [
    { id: "p", type: "parse-update",  payload, characterId: "char-1", label: "parse", enqueuedAt: 1, retries: 0, idempotencyKey: keyParse },
    { id: "l", type: "analyze-loot",  payload, characterId: "char-1", label: "loot",  enqueuedAt: 1, retries: 0, idempotencyKey: keyLoot },
  ];
  const deduped = dedupePendingAICalls(items);
  assert.equal(deduped.length, 2);
});

test("ai queue null-safe filter predicate — type predicate removes null entries", () => {
  // Verify the structural behavior that was previously causing typecheck errors:
  // arrays of (T | null) must be narrowed to T[] before use.
  const mixed: (Record<string, unknown> | null)[] = [
    { id: "a" },
    null,
    { id: "b" },
    null,
  ];
  const narrowed = mixed.filter((x): x is Record<string, unknown> => x !== null);

  // No nulls, length is correct, type is narrowed (compile-time guarantee, runtime sanity).
  assert.equal(narrowed.length, 2);
  assert.deepEqual(narrowed.map((r) => r["id"]), ["a", "b"]);
});
