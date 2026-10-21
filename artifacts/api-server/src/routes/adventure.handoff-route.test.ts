import assert from "node:assert/strict";
import { AddressInfo } from "node:net";
import test from "node:test";
import express from "express";

process.env.DATABASE_URL ??= "postgres://local:local@localhost:5432/local";

const adventureModule = await import("./adventure");

const {
  parseOneOffHandoffIngestRequest,
  parseCampaignScaffoldIngestRequest,
  parseCampaignContinuationIngestRequest,
  buildOneOffHandoffIngestResponse,
  buildCampaignScaffoldIngestResponse,
  buildCampaignContinuationIngestResponse,
  beginOneOffHandoffRouteIdempotency,
  buildInvalidHandoffPayloadResponse,
  buildStableEncounterIntentKey,
  normalizeCampaignRuntimeEncounterIntent,
  parseCanonicalEncounterActorsFromRecentEntries,
  alignEncounterIntentWithCanonicalActors,
  setOneOffHandoffRouteIdempotencyStartOverrideForTests,
  setCampaignScaffoldRouteIdempotencyStartOverrideForTests,
  setCampaignContinuationRouteIdempotencyStartOverrideForTests,
} = adventureModule;

function buildValidRequestBody() {
  return {
    handoff: {
      schemaVersion: "oneoff-handoff.v1",
      sessionId: "oneoff-http",
      title: "Bridge Fight",
      mode: "one_off",
      difficulty: "balanced",
      stylePreset: "heroic",
      guidanceSource: "user",
      startInCombat: true,
      finalOutcomeStatus: "encounter_closed",
      hasLootPreview: true,
      entryCount: 9,
      closedAt: 1700,
    },
    recapLines: ["line1", "line2"],
    clientSavedAt: 1701,
  };
}

function buildValidCampaignRequestBody() {
  return {
    scaffold: {
      schemaVersion: "campaign-scaffold.v1",
      sessionId: "campaign-http",
      campaignId: "campaign-shattered-crown",
      campaignLabel: "Shattered Crown",
      chapterLabel: "Chapter 1: Ashfall Road",
      mode: "campaign_scaffold",
      difficulty: "balanced",
      stylePreset: "heroic",
      guidanceSource: "user",
      entryCount: 7,
      scaffoldStatus: "active",
    },
    recapLines: ["line1", "line2"],
    clientSavedAt: 1901,
  };
}

function buildValidCampaignContinuationRequestBody() {
  return {
    continuation: {
      schemaVersion: "campaign-continuation.v1",
      sessionId: "campaign-http",
      campaignId: "campaign-shattered-crown",
      campaignLabel: "Shattered Crown",
      chapterLabel: "Chapter 1: Ashfall Road",
      mode: "campaign_continuation",
      difficulty: "balanced",
      stylePreset: "heroic",
      guidanceSource: "user",
      entryCount: 12,
      checkpointIndex: 2,
      continuityStatus: "checkpoint",
      progressSummary: "Recovered the obsidian map shard and escaped Blackridge Keep.",
    },
    recapLines: ["line1", "line2"],
    clientSavedAt: 2101,
  };
}

async function postOneOffHandoff(input: { body: unknown; idempotencyKey?: string }): Promise<Response> {
  const app = express();
  app.use(express.json());
  app.use("/api", adventureModule.default);

  const server = await new Promise<import("node:http").Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  try {
    const address = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${address.port}/api/adventure/oneoff-handoffs`;
    return await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}),
      },
      body: JSON.stringify(input.body),
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

async function postCampaignScaffold(input: { body: unknown; idempotencyKey?: string }): Promise<Response> {
  const app = express();
  app.use(express.json());
  app.use("/api", adventureModule.default);

  const server = await new Promise<import("node:http").Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  try {
    const address = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${address.port}/api/adventure/campaign-scaffolds`;
    return await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}),
      },
      body: JSON.stringify(input.body),
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

async function postCampaignContinuation(input: { body: unknown; idempotencyKey?: string }): Promise<Response> {
  const app = express();
  app.use(express.json());
  app.use("/api", adventureModule.default);

  const server = await new Promise<import("node:http").Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  try {
    const address = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${address.port}/api/adventure/campaign-continuations`;
    return await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}),
      },
      body: JSON.stringify(input.body),
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

async function getCampaignContinuationSnapshot(input: { sessionId: string }): Promise<Response> {
  const app = express();
  app.use(express.json());
  app.use("/api", adventureModule.default);

  const server = await new Promise<import("node:http").Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  try {
    const address = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${address.port}/api/adventure/campaign-continuations/${encodeURIComponent(input.sessionId)}`;
    return await fetch(url, { method: "GET" });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

async function postCampaignRuntimeTurn(input: { body: unknown }): Promise<Response> {
  const app = express();
  app.use(express.json());
  app.use("/api", adventureModule.default);

  const server = await new Promise<import("node:http").Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  try {
    const address = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${address.port}/api/adventure/campaign-runtime/turn`;
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input.body),
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

test("parseOneOffHandoffIngestRequest accepts valid oneoff-handoff.v1 payload", () => {
  const parsed = parseOneOffHandoffIngestRequest({
    handoff: {
      schemaVersion: "oneoff-handoff.v1",
      sessionId: "oneoff-abc",
      title: "Bridge Fight",
      mode: "one_off",
      difficulty: "balanced",
      stylePreset: "heroic",
      guidanceSource: "user",
      startInCombat: true,
      finalOutcomeStatus: "encounter_closed",
      hasLootPreview: true,
      entryCount: 9,
      closedAt: 1700,
    },
    recapLines: ["line1", "line2"],
    clientSavedAt: 1701,
  });

  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    const response = buildOneOffHandoffIngestResponse(parsed.value);
    assert.equal(response.ok, true);
    assert.equal(response.handoff.schemaVersion, "oneoff-handoff.v1");
    assert.equal(response.handoff.sessionId, "oneoff-abc");
    assert.equal(typeof response.ingestTraceId, "string");
    assert.ok(response.ingestTraceId.startsWith("ingest_"));
  }
});

test("parseOneOffHandoffIngestRequest rejects missing recap lines", () => {
  const parsed = parseOneOffHandoffIngestRequest({
    handoff: {
      schemaVersion: "oneoff-handoff.v1",
      sessionId: "oneoff-abc",
      title: "Bridge Fight",
      mode: "one_off",
      difficulty: "balanced",
      stylePreset: "heroic",
      guidanceSource: "user",
      startInCombat: true,
      finalOutcomeStatus: "encounter_closed",
      hasLootPreview: true,
      entryCount: 9,
    },
    clientSavedAt: 1701,
  });

  assert.equal(parsed.ok, false);
});

test("parseCampaignScaffoldIngestRequest accepts valid campaign-scaffold.v1 payload", () => {
  const parsed = parseCampaignScaffoldIngestRequest(buildValidCampaignRequestBody());
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    const response = buildCampaignScaffoldIngestResponse(parsed.value);
    assert.equal(response.ok, true);
    assert.equal(response.scaffold.schemaVersion, "campaign-scaffold.v1");
    assert.equal(response.scaffold.mode, "campaign_scaffold");
    assert.equal(typeof response.ingestTraceId, "string");
  }
});

test("parseCampaignContinuationIngestRequest accepts valid campaign-continuation.v1 payload", () => {
  const parsed = parseCampaignContinuationIngestRequest(buildValidCampaignContinuationRequestBody());
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    const response = buildCampaignContinuationIngestResponse(parsed.value);
    assert.equal(response.ok, true);
    assert.equal(response.continuation.schemaVersion, "campaign-continuation.v1");
    assert.equal(response.continuation.mode, "campaign_continuation");
    assert.equal(typeof response.ingestTraceId, "string");
  }
});

test("oneoff handoff idempotency: replay returns stored response", async () => {
  const result = await beginOneOffHandoffRouteIdempotency({
    headerValue: "handoff-idem-1",
    requestHash: "hash-a",
    startFn: async () => ({ kind: "replay", statusCode: 201, responseBody: { ok: true, replay: true } }),
  });

  assert.equal(result.kind, "respond");
  if (result.kind === "respond") {
    assert.equal(result.statusCode, 201);
    assert.equal(result.replayHeader, true);
    assert.deepEqual(result.body, { ok: true, replay: true });
  }
});

test("oneoff handoff idempotency: in-progress rejects", async () => {
  const result = await beginOneOffHandoffRouteIdempotency({
    headerValue: "handoff-idem-2",
    requestHash: "hash-a",
    startFn: async () => ({ kind: "in_progress" }),
  });

  assert.equal(result.kind, "respond");
  if (result.kind === "respond") {
    assert.equal(result.statusCode, 409);
    assert.equal(result.replayHeader, false);
    assert.deepEqual(result.body, {
      error: "A request with this idempotency key is still in progress.",
      code: "idempotency_in_progress",
    });
  }
});

test("oneoff handoff idempotency: payload mismatch rejects", async () => {
  const result = await beginOneOffHandoffRouteIdempotency({
    headerValue: "handoff-idem-3",
    requestHash: "hash-a",
    startFn: async () => ({ kind: "payload_conflict" }),
  });

  assert.equal(result.kind, "respond");
  if (result.kind === "respond") {
    assert.equal(result.statusCode, 409);
    assert.equal(result.replayHeader, false);
    assert.deepEqual(result.body, {
      error: "Idempotency key was already used with a different request payload.",
      code: "idempotency_payload_mismatch",
    });
  }
});

test("oneoff handoff invalid payload response contract is fail-closed", () => {
  const invalid = parseOneOffHandoffIngestRequest({ handoff: {}, recapLines: [], clientSavedAt: 0 });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) {
    const response = buildInvalidHandoffPayloadResponse(invalid.error);
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.code, "invalid_handoff_payload");
    assert.equal(typeof response.body.error, "string");
    assert.ok(response.body.error.length > 0);
  }
});

test("endpoint oneoff handoff replay returns stored response and replay header", async () => {
  setOneOffHandoffRouteIdempotencyStartOverrideForTests(async () => ({
    kind: "replay",
    statusCode: 202,
    responseBody: { ok: true, ingested: true, replayedFixture: true },
  }));
  try {
    const res = await postOneOffHandoff({
      body: buildValidRequestBody(),
      idempotencyKey: "oneoff-http-replay",
    });

    assert.equal(res.status, 202);
    assert.equal(res.headers.get("x-idempotent-replay"), "true");
    const data = await res.json();
    assert.deepEqual(data, { ok: true, ingested: true, replayedFixture: true });
  } finally {
    setOneOffHandoffRouteIdempotencyStartOverrideForTests(null);
  }
});

test("endpoint oneoff handoff payload mismatch returns 409 mismatch contract", async () => {
  setOneOffHandoffRouteIdempotencyStartOverrideForTests(async () => ({ kind: "payload_conflict" }));
  try {
    const res = await postOneOffHandoff({
      body: buildValidRequestBody(),
      idempotencyKey: "oneoff-http-mismatch",
    });

    assert.equal(res.status, 409);
    const data = await res.json();
    assert.deepEqual(data, {
      error: "Idempotency key was already used with a different request payload.",
      code: "idempotency_payload_mismatch",
    });
  } finally {
    setOneOffHandoffRouteIdempotencyStartOverrideForTests(null);
  }
});

test("endpoint oneoff handoff in-progress returns 409 in-progress contract", async () => {
  setOneOffHandoffRouteIdempotencyStartOverrideForTests(async () => ({ kind: "in_progress" }));
  try {
    const res = await postOneOffHandoff({
      body: buildValidRequestBody(),
      idempotencyKey: "oneoff-http-in-progress",
    });

    assert.equal(res.status, 409);
    const data = await res.json();
    assert.deepEqual(data, {
      error: "A request with this idempotency key is still in progress.",
      code: "idempotency_in_progress",
    });
  } finally {
    setOneOffHandoffRouteIdempotencyStartOverrideForTests(null);
  }
});

test("endpoint oneoff handoff success includes ingest trace id", async () => {
  const res = await postOneOffHandoff({
    body: buildValidRequestBody(),
  });

  assert.equal(res.status, 200);
  const data = await res.json() as {
    ok: boolean;
    ingested: boolean;
    ingestTraceId?: unknown;
    submissionId?: unknown;
  };
  assert.equal(data.ok, true);
  assert.equal(data.ingested, true);
  assert.equal(typeof data.submissionId, "string");
  assert.equal(typeof data.ingestTraceId, "string");
  assert.ok((data.ingestTraceId as string).startsWith("ingest_"));
});

test("endpoint campaign scaffold replay returns stored response and replay header", async () => {
  setCampaignScaffoldRouteIdempotencyStartOverrideForTests(async () => ({
    kind: "replay",
    statusCode: 202,
    responseBody: { ok: true, ingested: true, replayedCampaignFixture: true },
  }));
  try {
    const res = await postCampaignScaffold({
      body: buildValidCampaignRequestBody(),
      idempotencyKey: "campaign-http-replay",
    });

    assert.equal(res.status, 202);
    assert.equal(res.headers.get("x-idempotent-replay"), "true");
    const data = await res.json();
    assert.deepEqual(data, { ok: true, ingested: true, replayedCampaignFixture: true });
  } finally {
    setCampaignScaffoldRouteIdempotencyStartOverrideForTests(null);
  }
});

test("endpoint campaign scaffold success includes ingest trace id", async () => {
  const res = await postCampaignScaffold({
    body: buildValidCampaignRequestBody(),
  });

  assert.equal(res.status, 200);
  const data = await res.json() as {
    ok: boolean;
    ingested: boolean;
    ingestTraceId?: unknown;
    submissionId?: unknown;
    scaffold?: { mode?: unknown; schemaVersion?: unknown };
  };
  assert.equal(data.ok, true);
  assert.equal(data.ingested, true);
  assert.equal(typeof data.submissionId, "string");
  assert.equal(typeof data.ingestTraceId, "string");
  assert.equal(data.scaffold?.mode, "campaign_scaffold");
  assert.equal(data.scaffold?.schemaVersion, "campaign-scaffold.v1");
});

test("endpoint campaign continuation replay returns stored response and replay header", async () => {
  setCampaignContinuationRouteIdempotencyStartOverrideForTests(async () => ({
    kind: "replay",
    statusCode: 202,
    responseBody: { ok: true, ingested: true, replayedContinuationFixture: true },
  }));
  try {
    const res = await postCampaignContinuation({
      body: buildValidCampaignContinuationRequestBody(),
      idempotencyKey: "campaign-continuation-http-replay",
    });

    assert.equal(res.status, 202);
    assert.equal(res.headers.get("x-idempotent-replay"), "true");
    const data = await res.json();
    assert.deepEqual(data, { ok: true, ingested: true, replayedContinuationFixture: true });
  } finally {
    setCampaignContinuationRouteIdempotencyStartOverrideForTests(null);
  }
});

test("endpoint campaign continuation success includes ingest trace id", async () => {
  const res = await postCampaignContinuation({
    body: buildValidCampaignContinuationRequestBody(),
  });

  assert.equal(res.status, 200);
  const data = await res.json() as {
    ok: boolean;
    ingested: boolean;
    ingestTraceId?: unknown;
    submissionId?: unknown;
    continuation?: {
      mode?: unknown;
      schemaVersion?: unknown;
      checkpointIndex?: unknown;
      continuityStatus?: unknown;
    };
  };
  assert.equal(data.ok, true);
  assert.equal(data.ingested, true);
  assert.equal(typeof data.submissionId, "string");
  assert.equal(typeof data.ingestTraceId, "string");
  assert.equal(data.continuation?.mode, "campaign_continuation");
  assert.equal(data.continuation?.schemaVersion, "campaign-continuation.v1");
  assert.equal(typeof data.continuation?.checkpointIndex, "number");
  assert.equal(typeof data.continuation?.continuityStatus, "string");
});

test("endpoint campaign continuation snapshot read returns not_found for unknown session", async () => {
  const res = await getCampaignContinuationSnapshot({
    sessionId: "campaign-session-does-not-exist",
  });

  assert.equal(res.status, 404);
  const data = await res.json() as {
    code?: unknown;
    sessionId?: unknown;
  };
  assert.equal(data.code, "campaign_continuation_not_found");
  assert.equal(data.sessionId, "campaign-session-does-not-exist");
});

test("endpoint campaign continuation snapshot read returns latest submitted continuation", async () => {
  const payload = buildValidCampaignContinuationRequestBody();
  payload.continuation.sessionId = "campaign-http-readback";
  payload.continuation.checkpointIndex = 3;
  payload.continuation.continuityStatus = "checkpoint";
  payload.continuation.progressSummary = "Recovered the key and secured a safe camp.";
  payload.clientSavedAt = 2201;

  const postRes = await postCampaignContinuation({ body: payload });
  assert.equal(postRes.status, 200);

  const readRes = await getCampaignContinuationSnapshot({
    sessionId: payload.continuation.sessionId,
  });
  assert.equal(readRes.status, 200);

  const data = await readRes.json() as {
    ok?: unknown;
    found?: unknown;
    sessionId?: unknown;
    snapshot?: {
      schemaVersion?: unknown;
      mode?: unknown;
      checkpointIndex?: unknown;
      continuityStatus?: unknown;
      progressSummary?: unknown;
      recapLines?: unknown;
      clientSavedAt?: unknown;
      ingestTraceId?: unknown;
      submissionId?: unknown;
    };
  };
  assert.equal(data.ok, true);
  assert.equal(data.found, true);
  assert.equal(data.sessionId, payload.continuation.sessionId);
  assert.equal(data.snapshot?.schemaVersion, "campaign-continuation.v1");
  assert.equal(data.snapshot?.mode, "campaign_continuation");
  assert.equal(data.snapshot?.checkpointIndex, 3);
  assert.equal(data.snapshot?.continuityStatus, "checkpoint");
  assert.equal(data.snapshot?.progressSummary, "Recovered the key and secured a safe camp.");
  assert.ok(Array.isArray(data.snapshot?.recapLines));
  assert.equal(data.snapshot?.clientSavedAt, 2201);
  assert.equal(typeof data.snapshot?.ingestTraceId, "string");
  assert.equal(typeof data.snapshot?.submissionId, "string");
});

test("endpoint campaign runtime turn fails closed on invalid payload", async () => {
  const res = await postCampaignRuntimeTurn({ body: { sessionId: "", playerInput: "" } });
  assert.equal(res.status, 400);
  const data = await res.json() as { code?: unknown };
  assert.equal(data.code, "invalid_campaign_runtime_turn_payload");
});

test("endpoint campaign runtime turn returns ai_not_configured when AI env is missing", async () => {
  const originalKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
  const originalBaseUrl = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];

  delete process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
  delete process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  try {
    const res = await postCampaignRuntimeTurn({
      body: {
        sessionId: "campaign-live-1",
        campaignId: "campaign-live-1",
        campaignLabel: "Live Campaign",
        chapterLabel: "Chapter 1",
        difficulty: "balanced",
        stylePreset: "heroic",
        guidance: "Stay concise.",
        playerInput: "I scout the ruined gate for tracks.",
        recentEntries: [
          { role: "system", text: "Session started." },
        ],
      },
    });

    assert.equal(res.status, 503);
    const data = await res.json() as { code?: unknown };
    assert.equal(data.code, "ai_not_configured");
  } finally {
    if (typeof originalKey === "string") {
      process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] = originalKey;
    } else {
      delete process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
    }

    if (typeof originalBaseUrl === "string") {
      process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"] = originalBaseUrl;
    } else {
      delete process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
    }
  }
});

test("buildStableEncounterIntentKey is deterministic for same turn context", () => {
  const a = buildStableEncounterIntentKey({
    sessionId: "session-1",
    playerInput: "I raise my shield.",
    hostileCreatureName: "Goblin Raider",
    promptRolls: [
      { statKey: "initiative", label: "Roll initiative" },
      { statKey: "perception", label: "Spot movement" },
    ],
  });
  const b = buildStableEncounterIntentKey({
    sessionId: "session-1",
    playerInput: "I raise my shield.",
    hostileCreatureName: "Goblin Raider",
    promptRolls: [
      { statKey: "initiative", label: "Roll initiative" },
      { statKey: "perception", label: "Spot movement" },
    ],
  });

  assert.equal(a, b);
  assert.match(a, /^enc-/);
});

test("normalizeCampaignRuntimeEncounterIntent clamps and filters malformed prompt rolls", () => {
  const normalized = normalizeCampaignRuntimeEncounterIntent({
    rawEncounterIntent: {
      requiresEncounterStart: true,
      hostileCreatureName: "",
      promptRolls: [
        { statKey: "initiative", label: "" },
        { statKey: "invalid_stat", label: "Ignore me" },
        { statKey: "dexterity_save", label: "Leap clear" },
      ],
    },
    sessionId: "session-2",
    playerInput: "I run for cover.",
  });

  assert.ok(normalized);
  assert.equal(normalized?.hostileCreatureName, "Hostile Creature");
  assert.deepEqual(normalized?.promptRolls.map((p) => p.statKey), ["initiative", "dexterity_save"]);
  assert.equal(normalized?.promptRolls[0]?.label, "Check");
  assert.equal(typeof normalized?.intentKey, "string");
});

test("normalizeCampaignRuntimeEncounterIntent suppresses generic-hostile encounter intent for exploratory player input", () => {
  const normalized = normalizeCampaignRuntimeEncounterIntent({
    rawEncounterIntent: {
      requiresEncounterStart: true,
      hostileCreatureName: "Unknown Beast",
      promptRolls: [{ statKey: "initiative", label: "Roll initiative" }],
    },
    sessionId: "session-3",
    playerInput: "Inspect the beast carefully before acting.",
  });

  assert.equal(normalized, null);
});

test("parseCanonicalEncounterActorsFromRecentEntries parses hostile actor continuity entries", () => {
  const actors = parseCanonicalEncounterActorsFromRecentEntries([
    {
      role: "system",
      text: "CURRENT HOSTILE ACTORS: npc_1=Goblin Raider [monster:goblin-raider] @battle-1 | npc_2=Bandit Captain [manual] @battle-1. Reuse these identities.",
    },
    {
      role: "player",
      text: "I raise my shield.",
    },
  ]);

  assert.equal(actors.length, 2);
  assert.deepEqual(actors[0], {
    npcId: "npc_1",
    name: "Goblin Raider",
    sourceType: "monster",
    sourceId: "goblin-raider",
  });
  assert.deepEqual(actors[1], {
    npcId: "npc_2",
    name: "Bandit Captain",
    sourceType: "manual",
    sourceId: undefined,
  });
});

test("alignEncounterIntentWithCanonicalActors backfills monster source metadata by canonical name match", () => {
  const aligned = alignEncounterIntentWithCanonicalActors({
    encounterIntent: {
      requiresEncounterStart: true,
      hostileCreatureName: "goblin raider",
      promptRolls: [{ statKey: "initiative", label: "Roll initiative" }],
      narrationBlockedUntilResolved: true,
      intentKey: "enc-1",
    },
    canonicalActors: [
      {
        npcId: "npc_1",
        name: "Goblin Raider",
        sourceType: "monster",
        sourceId: "goblin-raider",
      },
    ],
  });

  assert.ok(aligned);
  assert.equal(aligned?.hostileCreatureName, "Goblin Raider");
  assert.equal(aligned?.hostileCreatureSourceType, "monster");
  assert.equal(aligned?.hostileCreatureSourceId, "goblin-raider");
});
