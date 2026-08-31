import assert from "node:assert/strict";
import test from "node:test";
import { isBlockedIp, parseAndValidateUrl, resolvePublicAddress } from "../src/security/urlSafety.js";

test("blocks canonical IPv4-mapped IPv6 loopback variants", () => {
  assert.equal(isBlockedIp("::ffff:7f00:1"), true);
  assert.throws(
    () => parseAndValidateUrl("http://[::ffff:127.0.0.1]/admin"),
    (error) => error?.code === "PRIVATE_IP_BLOCKED",
  );
});

test("blocks IPv4-compatible, translation and tunnel IPv6 literals", () => {
  for (const address of [
    "::7f00:1",
    "64:ff9b::7f00:1",
    "64:ff9b:1::7f00:1",
    "100::1",
    "2001::1",
    "2002:7f00:1::",
    "3fff::1",
    "fc00::1",
    "fe80::1",
    "fec0::1",
    "ff02::1",
  ]) {
    assert.equal(isBlockedIp(address), true, `${address} must be blocked`);
  }
});

test("keeps ordinary public IPv4 and global IPv6 reachable", () => {
  assert.equal(isBlockedIp("8.8.8.8"), false);
  assert.equal(isBlockedIp("1.1.1.1"), false);
  assert.equal(isBlockedIp("2606:4700:4700::1111"), false);
  assert.equal(isBlockedIp("2001:4860:4860::8888"), false);
});

test("rejects a hostname when DNS returns a mapped private IPv6 address", async () => {
  await assert.rejects(
    resolvePublicAddress("example.com", async () => [
      { address: "::ffff:7f00:1", family: 6 },
    ]),
    (error) => error?.code === "PRIVATE_IP_BLOCKED",
  );
});

test("rejects mixed DNS answers if any resolved destination is private or special", async () => {
  await assert.rejects(
    resolvePublicAddress("example.com", async () => [
      { address: "2606:4700:4700::1111", family: 6 },
      { address: "::ffff:7f00:1", family: 6 },
    ]),
    (error) => error?.code === "PRIVATE_IP_BLOCKED",
  );
});
