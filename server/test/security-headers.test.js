import assert from "node:assert/strict";
import test from "node:test";
import { getRequestOrigin, securityHeaders, verifyRequestOrigin } from "../src/middleware/security.js";

function makeResponse() {
  return {
    headers: new Map(),
    statusCode: 200,
    body: null,
    setHeader(name, value) { this.headers.set(String(name).toLowerCase(), String(value)); },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

function makeRequest({
  path = "/",
  method = "GET",
  secure = false,
  protocol = "http",
  forwardedProto = "",
  forwardedHost = "",
  host = "localhost:3333",
  origin = "",
} = {}) {
  const headers = {
    "x-forwarded-proto": forwardedProto,
    "x-forwarded-host": forwardedHost,
    host,
    origin,
  };
  return {
    path,
    method,
    secure,
    protocol,
    get(name) { return headers[String(name).toLowerCase()] || undefined; },
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

test("request origin uses proxy protocol but never trusts forwarded host", () => {
  const req = makeRequest({
    secure: false,
    forwardedProto: "https, http",
    forwardedHost: "attacker.example, internal-proxy:3333",
    host: "guardei.example.com",
  });

  assert.equal(getRequestOrigin(req), "https://guardei.example.com");
});

test("origin verification accepts same origin with a proxy protocol chain", () => {
  const req = makeRequest({
    path: "/api/videos/123",
    method: "PATCH",
    forwardedProto: "https, http",
    forwardedHost: "attacker.example",
    host: "guardei.example.com",
    origin: "https://guardei.example.com",
  });
  const res = makeResponse();
  let nextCalls = 0;

  verifyRequestOrigin(req, res, () => { nextCalls += 1; });

  assert.equal(nextCalls, 1);
  assert.equal(res.statusCode, 200);
});

test("origin verification rejects an unrelated origin even with matching forwarded host", () => {
  const req = makeRequest({
    path: "/api/videos/123",
    method: "PATCH",
    forwardedProto: "https, http",
    forwardedHost: "attacker.example",
    host: "guardei.example.com",
    origin: "https://attacker.example",
  });
  const res = makeResponse();
  let nextCalls = 0;

  verifyRequestOrigin(req, res, () => { nextCalls += 1; });

  assert.equal(nextCalls, 0);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body?.code, "INVALID_ORIGIN");
});

test("malformed Host values cannot become a trusted request origin", () => {
  const req = makeRequest({ forwardedProto: "https", host: "guardei.example.com/path" });
  assert.equal(getRequestOrigin(req), "");
});
