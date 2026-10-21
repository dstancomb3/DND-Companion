import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchCampaignContinuationHydrateSeed,
  resolveCampaignHydrationSource,
} from "../../utils/adventure/aiDmCampaignSessionSync.ts";

test("resolveCampaignHydrationSource prefers local archive when entries exist", () => {
  const source = resolveCampaignHydrationSource({
    archived: {
      sessionId: "campaign-123",
      savedAt: Date.now(),
      session: {
        mode: "campaign_scaffold",
        title: "Shattered Crown",
        difficulty: "balanced",
        stylePreset: "heroic",
        startInCombat: false,
        guidance: "Keep continuity",
        campaignId: "campaign-123",
        campaignLabel: "Shattered Crown",
        chapterLabel: "Chapter 1",
      },
      entries: [{ id: "entry-1", role: "dm", text: "You arrive at the citadel gates." }],
      pendingChoices: [],
      prologueDone: true,
    },
  });

  assert.equal(source, "local_archive");
});

test("resolveCampaignHydrationSource falls back to server when local archive is empty or missing", () => {
  assert.equal(resolveCampaignHydrationSource({ archived: null }), "server_snapshot_fallback");

  const emptySource = resolveCampaignHydrationSource({
    archived: {
      sessionId: "campaign-empty",
      savedAt: Date.now(),
      session: {
        mode: "campaign_scaffold",
        title: "Shattered Crown",
        difficulty: "balanced",
        stylePreset: "heroic",
        startInCombat: false,
        guidance: "",
        campaignId: "campaign-empty",
        campaignLabel: "Shattered Crown",
        chapterLabel: "Chapter 1",
      },
      entries: [],
      pendingChoices: [],
      prologueDone: false,
    },
  });

  assert.equal(emptySource, "server_snapshot_fallback");
});

test("fetchCampaignContinuationHydrateSeed normalizes a server snapshot into feed seed entries", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          ok: true,
          found: true,
          sessionId: "campaign-123",
          snapshot: {
            schemaVersion: "campaign-continuation.v1",
            sessionId: "campaign-123",
            campaignId: "campaign-123",
            campaignLabel: "Shattered Crown",
            chapterLabel: "Chapter 2",
            mode: "campaign_continuation",
            difficulty: "balanced",
            stylePreset: "heroic",
            guidanceSource: "user",
            entryCount: 20,
            checkpointIndex: 5,
            continuityStatus: "checkpoint",
            progressSummary: "The party recovered the relic and reached the Iron Keep.",
            recapLines: [
              "You crossed the Ashfall Road.",
              "The watch captain offered passage.",
            ],
            clientSavedAt: Date.now(),
            receivedAt: new Date().toISOString(),
            ingestTraceId: "trace-123",
            submissionId: "submission-123",
          },
        }),
    } as any;
  }) as any;

  try {
    const result = await fetchCampaignContinuationHydrateSeed({ sessionId: "campaign-123" });
    assert.equal(result.found, true);
    if (!result.found) return;

    assert.equal(result.seed.checkpointIndex, 5);
    assert.equal(result.seed.continuityStatus, "checkpoint");
    assert.match(result.seed.statusMessage, /checkpoint 5 \(checkpoint\)/);
    assert.equal(result.seed.entries.length, 3);
    assert.equal(result.seed.entries[0]?.role, "system");
    assert.match(result.seed.entries[0]?.text ?? "", /Server resume checkpoint 5/);
    assert.equal(result.seed.entries[1]?.role, "dm");
    assert.equal(result.seed.entries[2]?.role, "dm");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchCampaignContinuationHydrateSeed returns not found when server has no snapshot", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    return {
      ok: false,
      status: 404,
      text: async () =>
        JSON.stringify({
          code: "campaign_continuation_not_found",
          error: "No campaign continuation snapshot found for this session.",
        }),
    } as any;
  }) as any;

  try {
    const result = await fetchCampaignContinuationHydrateSeed({ sessionId: "campaign-missing" });
    assert.deepEqual(result, { found: false });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
