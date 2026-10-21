import assert from "node:assert/strict";
import test from "node:test";

import { decideMemberSync } from "./partySyncGuard";

test("accepts first member sync when no prior clock exists", () => {
  const decision = decideMemberSync(undefined, 100, "hash-a");
  assert.deepEqual(decision, { status: "accept" });
});

test("accepts newer snapshot timestamps", () => {
  const decision = decideMemberSync({ snapshotUpdatedAt: 100, payloadHash: "hash-a" }, 101, "hash-b");
  assert.deepEqual(decision, { status: "accept" });
});

test("marks same snapshot+payload as idempotent replay", () => {
  const decision = decideMemberSync({ snapshotUpdatedAt: 100, payloadHash: "hash-a" }, 100, "hash-a");
  assert.deepEqual(decision, { status: "idempotent_replay" });
});

test("rejects older snapshot timestamps as stale", () => {
  const decision = decideMemberSync({ snapshotUpdatedAt: 100, payloadHash: "hash-a" }, 99, "hash-z");
  assert.deepEqual(decision, {
    status: "reject_stale",
    latestSnapshotUpdatedAt: 100,
    reason: "older_snapshot",
  });
});

test("rejects same timestamp with different payload hash", () => {
  const decision = decideMemberSync({ snapshotUpdatedAt: 100, payloadHash: "hash-a" }, 100, "hash-b");
  assert.deepEqual(decision, {
    status: "reject_stale",
    latestSnapshotUpdatedAt: 100,
    reason: "timestamp_collision",
  });
});
