import assert from "node:assert/strict";
import test from "node:test";
import { securityHeaders } from "../src/middleware/security.js";

function makeResponse() {
  return {
    headers: new Map(),
    setHeader(name, value) { this.headers.set(String(name).toLowerCase(), String(value)); },
  };
}

function makeRequest({ path = "/", secure = false, forwardedProto = "" } = {}) {
  return {
    path,
    secure,
    get(name) {
      if (String(name).toLowerCase() === "x-forwarded-proto") return forwardedProto;
      return undefined;
    },
  };
}

test("API responses are no-store and HTTPS responses receive HSTS", () => {
  const req = makeRequest({ path: "/api/videos", forwardedProto: "https" });
  const res = makeResponse();
  let nextCalls = 0;

  securityHeaders(req, res, () => { nextCalls += 1; });

  assert.equal(nextCalls, 1);
  assert.equal(res.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(res.headers.get("pragma"), "no-cache");
  assert.equal(res.headers.get("strict-transport-security"), "max-age=15552000");
  assert.match(res.headers.get("content-security-policy"), /default-src 'self'/);
});

test("ordinary HTTP assets are not forced into API no-store policy", () => {
  const req = makeRequest({ path: "/icons/guardei-icon.png", secure: false });
  const res = makeResponse();

  securityHeaders(req, res, () => {});

  assert.equal(res.headers.has("cache-control"), false);
  assert.equal(res.headers.has("strict-transport-security"), false);
});
