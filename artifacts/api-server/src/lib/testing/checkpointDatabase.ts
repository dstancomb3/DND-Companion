import type { TestContext } from "node:test";
import { db } from "@workspace/db";
import { aiIdempotencyRecords, campaignContinuationSnapshots } from "@workspace/db/schema";

/** Single-key transactional test double. Not a PostgreSQL integration fixture. */
export function mockCheckpointDatabase(t: TestContext) {
  type Row = Record<string, unknown>;
  let state: { receipt: Row | null; snapshot: Row | null } = { receipt: null, snapshot: null };
  const controls = { failSnapshot: false, failCompletion: false, failCommit: false, missingReceipts: false, loseCommitAcknowledgment: false, missingCompletionTable: false };
  const query = (current: typeof state) => ({
    select: () => ({ from: (table: unknown) => ({ where: () => ({ limit: async () => {
      if (table === aiIdempotencyRecords && controls.missingReceipts) throw Object.assign(new Error("missing table"), { code: "42P01" });
      const row = table === aiIdempotencyRecords ? current.receipt : current.snapshot;
      return row ? [row] : [];
    } }) }) }),
    delete: () => ({ where: async () => {} }), // No expired rows in these fixtures.
    insert: (table: unknown) => ({ values: (row: Row) => ({
      onConflictDoNothing: () => ({ returning: async () => {
        if (current.receipt) return [];
        current.receipt = row;
        return [{ key: row.key }];
      } }),
      onConflictDoUpdate: async () => {
        if (table !== campaignContinuationSnapshots || controls.failSnapshot) throw new Error("snapshot write failed");
        current.snapshot = row;
      },
    }) }),
    update: () => ({ set: (row: Row) => ({ where: async () => {
      if (controls.missingCompletionTable) throw Object.assign(new Error("missing receipt table"), { code: "42P01" });
      if (controls.failCompletion) throw new Error("receipt completion failed");
      current.receipt = { ...current.receipt, ...row };
    } }) }),
  });
  t.mock.method(db, "transaction", (async (callback: (tx: unknown) => Promise<unknown>) => {
    const staged = structuredClone(state);
    const result = await callback(query(staged));
    if (controls.failCommit) throw new Error("transaction commit failed");
    state = staged;
    if (controls.loseCommitAcknowledgment) throw new Error("connection lost after commit");
    return result;
  }) as never);
  t.mock.method(db, "select", (() => query(state).select()) as never);
  return { controls, read: () => structuredClone(state) };
}
