import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgres://local:local@localhost:5432/local";
const { mockCheckpointDatabase } = await import("./testing/checkpointDatabase");
const { commitCampaignCheckpoint } = await import("./commitCampaignCheckpoint");
const { default: router } = await import("../routes/adventure");

function input() {
  return {
    snapshot: {
      continuation: {
        schemaVersion: "campaign-continuation.v1" as const, sessionId: "durable-test", campaignId: "campaign",
        campaignLabel: "Campaign", chapterLabel: "Chapter", mode: "campaign_continuation" as const,
        difficulty: "balanced", stylePreset: "heroic", guidanceSource: "user" as const,
        entryCount: 1, checkpointIndex: 1, continuityStatus: "checkpoint" as const, progressSummary: "Saved progress",
      },
      recapLines: ["Progress"], clientSavedAt: 1792627200000,
      receivedAt: new Date().toISOString(), ingestTraceId: "trace", submissionId: "submission",
    },
    responseBody: { ok: true, ingested: true, submissionId: "submission" },
    idempotencyKey: "checkpoint-key", endpoint: "adventure.campaign-continuation-ingest", requestHash: "hash",
  };
}

test("checkpoint and replay receipt commit together; duplicate returns prior response", async (t) => {
  const database = mockCheckpointDatabase(t);
  const request = input();
  assert.equal((await commitCampaignCheckpoint(request)).statusCode, 200);
  assert.equal(database.read().receipt?.status, "completed");
  assert.equal(database.read().snapshot?.clientSavedAt, request.snapshot.clientSavedAt);
  const prior = database.read();
  const replay = await commitCampaignCheckpoint({ ...request, responseBody: { ignored: true } });
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.body, request.responseBody);
  assert.deepEqual(database.read(), prior);
  const conflict = await commitCampaignCheckpoint({ ...request, requestHash: "changed" });
  assert.equal(conflict.statusCode, 409);
  assert.deepEqual(database.read(), prior);
});

for (const failure of ["failSnapshot", "failCompletion", "failCommit", "missingCompletionTable"] as const) {
  test(`${failure}: rollback preserves same-key retry and never acknowledges success`, async (t) => {
    const database = mockCheckpointDatabase(t);
    database.controls[failure] = true;
    await assert.rejects(commitCampaignCheckpoint(input()));
    assert.deepEqual(database.read(), { receipt: null, snapshot: null });
    database.controls[failure] = false;
    assert.equal((await commitCampaignCheckpoint(input())).statusCode, 200);
    assert.equal(database.read().receipt?.status, "completed");
  });
}

test("missing idempotency table fails closed instead of accepting an unprotected checkpoint", async (t) => {
  const database = mockCheckpointDatabase(t);
  database.controls.missingReceipts = true;
  await assert.rejects(commitCampaignCheckpoint(input()));
  assert.deepEqual(database.read(), { receipt: null, snapshot: null });
});

test("requests without a key still require a successful durable snapshot commit", async (t) => {
  const database = mockCheckpointDatabase(t);
  const request = { ...input(), idempotencyKey: null };
  database.controls.failSnapshot = true;
  await assert.rejects(commitCampaignCheckpoint(request));
  database.controls.failSnapshot = false;
  assert.equal((await commitCampaignCheckpoint(request)).statusCode, 200);
  assert.equal(database.read().receipt, null);
  assert.ok(database.read().snapshot);
});

test("route returns retryable 503 on failed commit, then 200 and replay on same-key retry", async (t) => {
  const database = mockCheckpointDatabase(t);
  const route = (router as unknown as {
    stack: Array<{ route?: { path: string; stack: Array<{ handle: (req: unknown, res: unknown) => Promise<void> }> } }>;
  }).stack.find((layer) => layer.route?.path === "/adventure/campaign-continuations")!.route!;
  const request = input();
  const call = async () => {
    let status = 200;
    let body: unknown;
    const headers: Record<string, string> = {};
    const response = {
      status(value: number) { status = value; return this; },
      json(value: unknown) { body = value; return this; },
      setHeader(key: string, value: string) { headers[key] = value; },
    };
    await route.stack[0].handle({
      body: { continuation: request.snapshot.continuation, recapLines: request.snapshot.recapLines, clientSavedAt: request.snapshot.clientSavedAt },
      get: () => request.idempotencyKey,
    }, response);
    return { status, body, headers };
  };
  database.controls.failCommit = true;
  const failed = await call();
  assert.equal(failed.status, 503);
  assert.equal((failed.body as { code: string }).code, "campaign_checkpoint_unavailable");
  assert.equal(failed.headers["Retry-After"], "3");
  assert.deepEqual(database.read(), { receipt: null, snapshot: null });
  database.controls.failCommit = false;
  const accepted = await call();
  assert.equal(accepted.status, 200);
  const replay = await call();
  assert.equal(replay.headers["X-Idempotent-Replay"], "true");
  assert.deepEqual(replay.body, accepted.body);
});


test("lost commit acknowledgment replays the committed receipt without a second write", async (t) => {
  const database = mockCheckpointDatabase(t);
  database.controls.loseCommitAcknowledgment = true;
  await assert.rejects(commitCampaignCheckpoint(input()));
  const committed = database.read();
  assert.equal(committed.receipt?.status, "completed");
  database.controls.loseCommitAcknowledgment = false;
  const replay = await commitCampaignCheckpoint(input());
  assert.equal(replay.replayed, true);
  assert.deepEqual(database.read(), committed);
});
