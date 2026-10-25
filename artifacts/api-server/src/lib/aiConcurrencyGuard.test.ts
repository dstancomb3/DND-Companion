import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { createAiConcurrencyGuard } from "./aiConcurrencyGuard";

function response() {
  const res = new EventEmitter() as EventEmitter & {
    statusCode: number; body?: unknown; headers: Record<string, string>;
    setHeader(name: string, value: string): void;
    status(n: number): typeof res;
    json(value: unknown): typeof res;
  };
  res.statusCode = 200;
  res.headers = {};
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = n => { res.statusCode = n; return res; };
  res.json = value => { res.body = value; return res; };
  return res;
}

test("admission rejects concurrent excess and releases after finish", () => {
  const guard = createAiConcurrencyGuard(1);
  const first = response(), denied = response(), after = response();
  let calls = 0;
  guard({} as never, first as never, () => { calls++; });
  guard({} as never, denied as never, () => { calls++; });
  assert.equal(calls, 1);
  assert.equal(denied.statusCode, 429);
  assert.deepEqual(denied.body, { code: "ai_capacity_exceeded", error: "AI requests are busy. Try again shortly." });
  assert.equal(denied.headers["Retry-After"], "2");
  first.emit("finish");
  guard({} as never, after as never, () => { calls++; });
  assert.equal(calls, 2);
  after.emit("close");
});

test("close and finish release only once", () => {
  const guard = createAiConcurrencyGuard(1);
  const first = response(), second = response(), third = response();
  guard({} as never, first as never, () => {});
  first.emit("close");
  first.emit("finish");
  guard({} as never, second as never, () => {});
  guard({} as never, third as never, () => {});
  assert.equal(third.statusCode, 429);
  second.emit("finish");
});

test("invalid capacities fail closed", () => {
  for (const cap of [0, -1, 0.5, 33, NaN]) {
    assert.throws(() => createAiConcurrencyGuard(cap));
  }
});
