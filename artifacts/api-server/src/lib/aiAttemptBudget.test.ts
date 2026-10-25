import assert from "node:assert/strict";
import test from "node:test";
import { createAiAttemptBudget } from "./aiAttemptBudget";

function response() {
  return {
    statusCode: 200, headers: {} as Record<string, string>, body: null as unknown,
    setHeader(name: string, value: string) { this.headers[name] = value; },
    status(n: number) { this.statusCode = n; return this; },
    json(value: unknown) { this.body = value; return this; },
  };
}

test("budget admits first requests then denies without invoking downstream", () => {
  let time = 1_000, admitted = 0;
  const guard = createAiAttemptBudget(2, 5_000, () => time);
  for (let i = 0; i < 3; i++) {
    const res = response();
    guard({} as never, res as never, () => { admitted++; });
    assert.equal(res.statusCode, i === 2 ? 429 : 200);
    if (i === 2) {
      assert.deepEqual(res.body, { code: "ai_attempt_budget_exceeded", error: "Too many AI requests. Try again shortly." });
      assert.equal(res.headers["Retry-After"], "5");
    }
  }
  assert.equal(admitted, 2);
  time = 6_000;
  guard({} as never, response() as never, () => { admitted++; });
  assert.equal(admitted, 3);
});

test("clock rollback resets fixed window without indefinite lockout", () => {
  let time = 10_000, admitted = 0;
  const guard = createAiAttemptBudget(1, 1_000, () => time);
  guard({} as never, response() as never, () => { admitted++; });
  time = 9_000;
  guard({} as never, response() as never, () => { admitted++; });
  assert.equal(admitted, 2);
});

test("invalid limits rejected at construction", () => {
  for (const cap of [0, -1, NaN, 10_001, 1.5]) assert.throws(() => createAiAttemptBudget(cap));
  for (const duration of [0, 999, 3_600_001, NaN]) assert.throws(() => createAiAttemptBudget(1, duration));
});
