import type { TestContext } from "node:test";
import { db } from "@workspace/db";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { aiIdempotencyRecords, campaignContinuationSnapshots } from "@workspace/db/schema";

/** Transactional test double. Does not prove PostgreSQL locking behavior. */
export function mockCheckpointDatabase(t: TestContext) {
  type Row = Record<string, unknown>;
  let state: { receipts: Map<string, Row>; snapshot: Row | null } = { receipts: new Map(), snapshot: null };
  const params = (condition: SQL) => new PgDialect().sqlToQuery(condition).params;
  const controls = { failSnapshot: false, failCompletion: false, failCommit: false, missingReceipts: false, loseCommitAcknowledgment: false, missingCompletionTable: false, failRead: false };
  const query = (current: typeof state) => ({
    select: () => ({ from: (table: unknown) => ({ where: (condition: SQL) => ({ limit: async () => {
      if (table === aiIdempotencyRecords && controls.missingReceipts) throw Object.assign(new Error("missing table"), { code: "42P01" });
      if (controls.failRead) throw new Error("read unavailable");
      const key = params(condition)[0];
      const row = table === aiIdempotencyRecords ? current.receipts.get(String(key)) : current.snapshot;
      return row && (table === aiIdempotencyRecords || row.sessionId === key) ? [row] : [];
    } }) }) }),
    delete: () => ({ where: async () => {} }), // No expired rows in these fixtures.
    insert: (table: unknown) => ({ values: (row: Row) => ({
      onConflictDoNothing: () => ({ returning: async () => {
        if (table === campaignContinuationSnapshots) {
          if (controls.failSnapshot) throw new Error("snapshot write failed");
          if (current.snapshot) return [];
          current.snapshot = row;
          return [{ sessionId: row.sessionId }];
        }
        const key = String(row.key);
        if (current.receipts.has(key)) return [];
        current.receipts.set(key, row);
        return [{ key }];
      } }),
      onConflictDoUpdate: async () => {
        if (table !== campaignContinuationSnapshots || controls.failSnapshot) throw new Error("snapshot write failed");
        current.snapshot = row;
      },
    }) }),
    update: (table: unknown) => ({ set: (row: Row) => ({ where: (condition: SQL) => {
      const values = params(condition);
      if (table === campaignContinuationSnapshots) {
        if (controls.failSnapshot) throw new Error("snapshot write failed");
        const matches = current.snapshot?.sessionId === values[0] && current.snapshot?.submissionId === values[1];
        if (matches) current.snapshot = { ...current.snapshot, ...row };
        return Object.assign(Promise.resolve(), { returning: async () => matches ? [{ sessionId: row.sessionId }] : [] });
      }
      if (controls.missingCompletionTable) throw Object.assign(new Error("missing receipt table"), { code: "42P01" });
      if (controls.failCompletion) throw new Error("receipt completion failed");
      const receipt = current.receipts.get(String(values[0]));
      if (receipt?.endpoint === values[1] && receipt?.requestHash === values[2]) current.receipts.set(String(values[0]), { ...receipt, ...row });
      return Promise.resolve();
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
  return {
    controls,
    read: () => structuredClone({ receipt: [...state.receipts.values()].at(-1) ?? null, snapshot: state.snapshot }),
    removeSnapshot: () => { state.snapshot = null; },
  };
}
