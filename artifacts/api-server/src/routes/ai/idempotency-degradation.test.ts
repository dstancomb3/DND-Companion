import assert from "node:assert/strict";
import test from "node:test";
import {
  beginRouteIdempotency,
  type BeginRouteIdempotencyResult,
} from "./index";

// Mock startAICallIdempotency to simulate disabled table
async function mockStartDisabled(): Promise<{ kind: "disabled" }> {
  return { kind: "disabled" };
}

test("[Graceful Degradation] beginRouteIdempotency continues safely when idempotency disabled", async () => {
  const result = await beginRouteIdempotency({
    headerValue: "test-idempotency-key",
    endpoint: "/api/test",
    requestHash: "test-hash",
    startFn: mockStartDisabled as any,
  });

  assert.equal(
    result.kind,
    "continue",
    "Should continue processing when table is disabled"
  );
  assert.equal(
    (result as any).canPersist,
    false,
    "Should mark as non-persistent"
  );
});

test("[Graceful Degradation] AI routes do not require idempotency to succeed", async () => {
  // When the table is missing, start() returns "disabled".
  // The route should treat this as "continue with canPersist=false",
  // NOT as an error or 500.

  const result = await beginRouteIdempotency({
    headerValue: "any-key",
    endpoint: "/api/ai/analyze-loot",
    requestHash: "hash",
    startFn: mockStartDisabled as any,
  });

  // Route should continue processing
  assert(result.kind === "continue", "Route must continue when idempotency is disabled");

  // And the response should NOT be cached
  assert.equal((result as any).canPersist, false, "Should not persist in degraded mode");
});

test("[Graceful Degradation] Missing idempotency header does not require table", async () => {
  // Even without the header, route should work
  const result = await beginRouteIdempotency({
    headerValue: null, // No idempotency header
    endpoint: "/api/test",
    requestHash: "hash",
    startFn: mockStartDisabled as any,
  });

  assert.equal(result.kind, "continue", "Should continue without idempotency header");
  assert.equal((result as any).key, null, "Key should be null");
});
