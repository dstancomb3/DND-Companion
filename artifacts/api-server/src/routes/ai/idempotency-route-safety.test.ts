import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgres://local:local@localhost:5432/local";

const aiModule = await import("./index");

const { beginRouteIdempotency, completeRouteIdempotency } = aiModule;

test("AI idempotency route behavior: replay returns stored response", async () => {
  const result = await beginRouteIdempotency({
    headerValue: "idem-1",
    endpoint: "parse-update",
    requestHash: "hash-a",
    startFn: async () => ({ kind: "replay", statusCode: 201, responseBody: { ok: true } }),
  });

  assert.equal(result.kind, "respond");
  if (result.kind === "respond") {
    assert.equal(result.statusCode, 201);
    assert.equal(result.replayHeader, true);
    assert.deepEqual(result.body, { ok: true });
  }
});

test("AI idempotency route behavior: payload mismatch rejects", async () => {
  const result = await beginRouteIdempotency({
    headerValue: "idem-2",
    endpoint: "parse-update",
    requestHash: "hash-a",
    startFn: async () => ({ kind: "payload_conflict" }),
  });

  assert.equal(result.kind, "respond");
  if (result.kind === "respond") {
    assert.equal(result.statusCode, 409);
    assert.deepEqual(result.body, {
      error: "Idempotency key was already used with a different request payload.",
      code: "idempotency_payload_mismatch",
    });
  }
});

test("AI idempotency route behavior: in-progress rejects", async () => {
  const result = await beginRouteIdempotency({
    headerValue: "idem-3",
    endpoint: "parse-update",
    requestHash: "hash-a",
    startFn: async () => ({ kind: "in_progress" }),
  });

  assert.equal(result.kind, "respond");
  if (result.kind === "respond") {
    assert.equal(result.statusCode, 409);
    assert.deepEqual(result.body, {
      error: "A request with this idempotency key is still in progress.",
      code: "idempotency_in_progress",
    });
  }
});

test("AI idempotency route behavior: persistence failure degrades safely", async () => {
  const beginResult = await beginRouteIdempotency({
    headerValue: "idem-4",
    endpoint: "parse-update",
    requestHash: "hash-a",
    startFn: async () => {
      throw new Error("db unavailable");
    },
  });

  assert.equal(beginResult.kind, "continue");
  if (beginResult.kind === "continue") {
    assert.equal(beginResult.canPersist, false);
  }

  await assert.doesNotReject(async () => {
    await completeRouteIdempotency({
      key: "idem-4",
      canPersist: true,
      endpoint: "parse-update",
      requestHash: "hash-a",
      statusCode: 200,
      responseBody: { summary: "ok" },
      completeFn: async () => {
        throw new Error("write failed");
      },
    });
  });
});
