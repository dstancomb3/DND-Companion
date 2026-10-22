import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

process.env.DATABASE_URL ??= "postgres://local:local@localhost:5432/local";
const { db } = await import("@workspace/db");
const { saveCampaignContinuationSnapshot: save, loadCampaignContinuationSnapshot: load } = await import("./campaignContinuationStore");
import type { CampaignContinuationSnapshotRecord } from "./campaignContinuationStore";
import { campaignContinuationSnapshots } from "../../../../lib/db/src/schema/adventure";

function snapshot(sessionId: string, clientSavedAt: number): CampaignContinuationSnapshotRecord {
  return {
    continuation: {
      schemaVersion: "campaign-continuation.v1", sessionId, campaignId: "campaign",
      campaignLabel: "Campaign", chapterLabel: "Chapter", mode: "campaign_continuation",
      difficulty: "balanced", stylePreset: "heroic", guidanceSource: "user", entryCount: 1,
      checkpointIndex: 0, continuityStatus: "active", progressSummary: `Progress ${clientSavedAt}`,
    },
    recapLines: [`Recap ${clientSavedAt}`], clientSavedAt,
    receivedAt: new Date().toISOString(), ingestTraceId: "trace", submissionId: `submission-${clientSavedAt}`,
  };
}

function mockDatabase(t: TestContext, read: () => Promise<unknown[]>, write: () => Promise<void>) {
  t.mock.method(db, "select", (() => ({ from: () => ({ where: () => ({ limit: read }) }) })) as never);
  t.mock.method(db, "insert", (() => ({ values: () => ({ onConflictDoUpdate: write }) })) as never);
  t.mock.method(console, "warn", () => {});
}

test("database recovery cannot replace a newer fallback after a failed save", async (t) => {
  const older = snapshot("recovery", 100);
  const newer = snapshot("recovery", 200);
  mockDatabase(t, async () => [{ snapshot: older }], async () => { throw new Error("offline"); });
  await save(newer);
  assert.deepEqual(await load("recovery"), newer);
});

test("an older save attempt cannot replace a newer cached snapshot", async (t) => {
  const newer = snapshot("out-of-order", 200);
  mockDatabase(t, async () => { throw new Error("offline"); }, async () => { throw new Error("offline"); });
  await save(newer);
  await save(snapshot("out-of-order", 100));
  assert.deepEqual(await load("out-of-order"), newer);
});

test("a newer database snapshot wins over cached fallback", async (t) => {
  const newer = snapshot("durable-newer", 300);
  mockDatabase(t, async () => [{ snapshot: newer }], async () => { throw new Error("offline"); });
  await save(snapshot("durable-newer", 200));
  assert.deepEqual(await load("durable-newer"), newer);
});

test("cache comparison happens after the database read completes", async (t) => {
  let finishRead!: (rows: unknown[]) => void;
  mockDatabase(t, () => new Promise((resolve) => { finishRead = resolve; }), async () => {});
  const pending = load("in-flight-read");
  const newer = snapshot("in-flight-read", 200);
  await save(newer);
  finishRead([{ snapshot: snapshot("in-flight-read", 100) }]);
  assert.deepEqual(await pending, newer);
});

test("fallback results are cloned and unknown sessions return null", async (t) => {
  mockDatabase(t, async () => [], async () => { throw new Error("offline"); });
  const expected = snapshot("cloned", 200);
  await save(expected);
  expected.recapLines.push("caller mutation");
  const loaded = (await load("cloned"))!;
  loaded.continuation.progressSummary = "mutated";
  loaded.recapLines.push("read mutation");
  const again = (await load("cloned"))!;
  assert.equal(again.recapLines.length, 1);
  assert.equal(again.continuation.progressSummary, "Progress 200");
  assert.equal(await load("unknown"), null);
});

test("campaign timestamp column supports epoch milliseconds without changing JSON number contracts", () => {
  const column = campaignContinuationSnapshots.clientSavedAt;
  assert.equal(column.getSQLType(), "bigint");
  assert.equal(column.mapFromDriverValue("1792627200000"), 1792627200000);
});
