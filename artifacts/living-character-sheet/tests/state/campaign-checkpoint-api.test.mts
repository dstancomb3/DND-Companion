import assert from "node:assert/strict";
import test from "node:test";
import api from "../../utils/adventure/aiDmCampaignContinuationApi.ts";

const { submitCampaignContinuationDetailed, SubmitCampaignContinuationError } = api;
const continuation = {
  schemaVersion: "campaign-continuation.v1" as const, sessionId: "client-test", campaignId: "campaign",
  campaignLabel: "Campaign", chapterLabel: "Chapter", mode: "campaign_continuation" as const,
  difficulty: "balanced", stylePreset: "heroic", guidanceSource: "user" as const,
  entryCount: 1, checkpointIndex: 1, continuityStatus: "checkpoint" as const, progressSummary: "Progress",
};

test("checkpoint client sends the exact base token and exposes the new server token", async (t) => {
  let sent: Record<string, unknown> = {};
  t.mock.method(globalThis, "fetch", async (_url: unknown, options: RequestInit) => {
    sent = JSON.parse(String(options.body));
    return new Response(JSON.stringify({
      ok: true, ingested: true, submissionId: "new-server-token", receivedAt: new Date().toISOString(), continuation,
    }), { status: 200 });
  });
  const result = await submitCampaignContinuationDetailed({
    continuation, recapLines: ["Progress"], clientSavedAt: 1234, expectedSubmissionId: "base-token",
  });
  assert.equal(sent.expectedSubmissionId, "base-token");
  assert.equal(result.response.submissionId, "new-server-token");
});

test("first checkpoint explicitly sends a null base", async (t) => {
  let base: unknown = "unset";
  t.mock.method(globalThis, "fetch", async (_url: unknown, options: RequestInit) => {
    base = JSON.parse(String(options.body)).expectedSubmissionId;
    return new Response(JSON.stringify({ ok: true, ingested: true, submissionId: "first", receivedAt: "now", continuation }), { status: 200 });
  });
  await submitCampaignContinuationDetailed({ continuation, recapLines: ["Progress"], clientSavedAt: 1234, expectedSubmissionId: null });
  assert.equal(base, null);
});

test("conflicts are exposed to the player without automatic retries or payload changes", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return new Response(JSON.stringify({ code: "campaign_checkpoint_conflict", error: "Review the latest checkpoint." }), { status: 409 });
  });
  await assert.rejects(submitCampaignContinuationDetailed({
    continuation, recapLines: ["Local work"], clientSavedAt: 1234, expectedSubmissionId: "old-token",
  }), (error: unknown) => {
    assert.ok(error instanceof SubmitCampaignContinuationError);
    assert.equal(error.code, "campaign_checkpoint_conflict");
    assert.equal(error.statusCode, 409);
    assert.equal(error.message, "Review the latest checkpoint.");
    return true;
  });
  assert.equal(calls, 1);
});
