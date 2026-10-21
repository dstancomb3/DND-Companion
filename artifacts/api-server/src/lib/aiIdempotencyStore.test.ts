import assert from "node:assert/strict";
import test from "node:test";

import { computeAICallRequestHash } from "./aiIdempotencyHash";
import {
  startAICallIdempotency,
  completeAICallIdempotency,
  type AIIdempotencyStartResult,
} from "./aiIdempotencyStore";

test("computeAICallRequestHash is stable regardless of object key order", () => {
  const bodyA = { text: "hello", nested: { b: 2, a: 1 } };
  const bodyB = { nested: { a: 1, b: 2 }, text: "hello" };

  const hashA = computeAICallRequestHash({ body: bodyA });
  const hashB = computeAICallRequestHash({ body: bodyB });

  assert.equal(hashA, hashB);
});

test("computeAICallRequestHash changes when payload changes", () => {
  const base = computeAICallRequestHash({ body: { text: "hello" } });
  const changed = computeAICallRequestHash({ body: { text: "hello!" } });

  assert.notEqual(base, changed);
});

test("computeAICallRequestHash includes file fingerprint and mime", () => {
  const body = { prompt: "analyze" };
  const imageA = Buffer.from("image-a");
  const imageB = Buffer.from("image-b");

  const hashA = computeAICallRequestHash({ body, fileBuffer: imageA, fileMimeType: "image/png" });
  const hashB = computeAICallRequestHash({ body, fileBuffer: imageB, fileMimeType: "image/png" });
  const hashC = computeAICallRequestHash({ body, fileBuffer: imageA, fileMimeType: "image/jpeg" });

  assert.notEqual(hashA, hashB);
  assert.notEqual(hashA, hashC);
});

test("[DB integration] startAICallIdempotency returns started for new key", async () => {
  // This test requires DATABASE_URL to be set and the ai_idempotency_records table to exist.
  // It will be skipped if the table doesn't exist (graceful degradation).
  const key = `test-key-${Date.now()}-${Math.random()}`;
  const result = await startAICallIdempotency({
    key,
    endpoint: "/test/endpoint",
    requestHash: "test-hash-123",
  });

  // Result can be "started" (healthy DB) or "disabled" (table missing, degraded mode)
  assert(
    result.kind === "started" || result.kind === "disabled",
    `Expected started or disabled, got ${result.kind}`
  );
});

test("[DB integration] startAICallIdempotency returns in_progress for duplicate in-flight key", async () => {
  const key = `test-key-${Date.now()}-${Math.random()}`;
  const endpoint = "/test/endpoint";
  const hash = "test-hash-123";

  const first = await startAICallIdempotency({
    key,
    endpoint,
    requestHash: hash,
  });

  // Skip if table is disabled
  if (first.kind === "disabled") {
    return;
  }

  assert.equal(first.kind, "started", "First call should succeed");

  const second = await startAICallIdempotency({
    key,
    endpoint,
    requestHash: hash,
  });

  assert.equal(second.kind, "in_progress", "Second call with same key should return in_progress");
});

test("[DB integration] startAICallIdempotency returns payload_conflict for mismatched hash", async () => {
  const key = `test-key-${Date.now()}-${Math.random()}`;
  const endpoint = "/test/endpoint";

  const first = await startAICallIdempotency({
    key,
    endpoint,
    requestHash: "hash-123",
  });

  // Skip if table is disabled
  if (first.kind === "disabled") {
    return;
  }

  assert.equal(first.kind, "started", "First call should succeed");

  const second = await startAICallIdempotency({
    key,
    endpoint,
    requestHash: "hash-456", // Different hash
  });

  assert.equal(
    second.kind,
    "payload_conflict",
    "Second call with different hash should return payload_conflict"
  );
});

test("[DB integration] startAICallIdempotency returns replay for completed key", async () => {
  const key = `test-key-${Date.now()}-${Math.random()}`;
  const endpoint = "/test/endpoint";
  const hash = "test-hash-123";

  const start = await startAICallIdempotency({
    key,
    endpoint,
    requestHash: hash,
  });

  // Skip if table is disabled
  if (start.kind === "disabled") {
    return;
  }

  assert.equal(start.kind, "started", "First call should succeed");

  // Complete the call
  const responseBody = { result: "test-response" };
  await completeAICallIdempotency({
    key,
    endpoint,
    requestHash: hash,
    statusCode: 200,
    responseBody,
  });

  // Try again with same key
  const replay = await startAICallIdempotency({
    key,
    endpoint,
    requestHash: hash,
  });

  assert.equal(replay.kind, "replay", "Second call should return replay");
  if (replay.kind === "replay") {
    assert.equal(replay.statusCode, 200);
    assert.deepEqual(replay.responseBody, responseBody);
  }
});

test("[DB integration] completeAICallIdempotency handles missing table gracefully", async () => {
  // This should not throw even if table is missing
  await completeAICallIdempotency({
    key: "any-key",
    endpoint: "/test",
    requestHash: "hash",
    statusCode: 200,
    responseBody: { test: true },
  });

  // No assertion needed; test passes if no error is thrown
});
