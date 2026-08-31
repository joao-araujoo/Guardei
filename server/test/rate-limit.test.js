import assert from "node:assert/strict";
import test from "node:test";
import { clearRateLimitStores, createRateLimiter, getRateLimitStoreSizes } from "../src/middleware/rateLimit.js";

function responseRecorder() {
  return {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

test("rate limiter blocks requests above the configured limit", () => {
  clearRateLimitStores();
  const limiter = createRateLimiter({ windowMs: 60_000, limit: 2, keyPrefix: "auth-test" });
  const request = { ip: "127.0.0.1", socket: {} };

  let nextCalls = 0;
  const next = () => { nextCalls += 1; };

  const first = responseRecorder();
  limiter(request, first, next);
  const second = responseRecorder();
  limiter(request, second, next);
  const third = responseRecorder();
  limiter(request, third, next);

  assert.equal(nextCalls, 2);
  assert.equal(third.statusCode, 429);
  assert.equal(third.body?.code, "RATE_LIMITED");
  assert.equal(third.headers["RateLimit-Remaining"], "0");
  assert.ok(Number(third.headers["Retry-After"]) >= 1);
  clearRateLimitStores();
});

test("rate limiter keeps unique-IP bucket memory bounded", () => {
  clearRateLimitStores();
  const limiter = createRateLimiter({ windowMs: 60_000, limit: 5, keyPrefix: "bounded-test", maxBuckets: 3 });
  let nextCalls = 0;

  for (let index = 0; index < 20; index += 1) {
    limiter({ ip: `192.0.2.${index}`, socket: {} }, responseRecorder(), () => { nextCalls += 1; });
  }

  assert.equal(nextCalls, 20);
  const sizes = getRateLimitStoreSizes();
  assert.ok(sizes.every((size) => size <= 3), `expected all rate limiter stores to stay bounded, got ${sizes.join(",")}`);
  clearRateLimitStores();
});

test("expired rate limiter buckets are reclaimed before eviction", () => {
  clearRateLimitStores();
  const originalNow = Date.now;
  let now = 1_000;
  Date.now = () => now;

  try {
    const limiter = createRateLimiter({ windowMs: 50, limit: 1, keyPrefix: "expiry-test", maxBuckets: 2 });
    limiter({ ip: "192.0.2.1", socket: {} }, responseRecorder(), () => {});
    limiter({ ip: "192.0.2.2", socket: {} }, responseRecorder(), () => {});
    now = 2_000;
    limiter({ ip: "192.0.2.3", socket: {} }, responseRecorder(), () => {});

    const sizes = getRateLimitStoreSizes();
    assert.ok(sizes.every((size) => size <= 2));
  } finally {
    Date.now = originalNow;
    clearRateLimitStores();
  }
});
