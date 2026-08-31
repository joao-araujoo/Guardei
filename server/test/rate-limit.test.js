import assert from "node:assert/strict";
import test from "node:test";
import { clearRateLimitStores, createRateLimiter } from "../src/middleware/rateLimit.js";

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
