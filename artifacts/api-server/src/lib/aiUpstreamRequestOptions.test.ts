import assert from "node:assert/strict";
import test from "node:test";
import { AI_UPSTREAM_REQUEST_OPTIONS } from "./aiUpstreamRequestOptions";

test("model provider timeout and retries are explicitly bounded", () => {
  assert.equal(AI_UPSTREAM_REQUEST_OPTIONS.timeout, 120_000);
  assert.equal(AI_UPSTREAM_REQUEST_OPTIONS.maxRetries, 0);
  assert.ok(Object.isFrozen(AI_UPSTREAM_REQUEST_OPTIONS));
});
