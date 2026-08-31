import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateRuntimeConfig } from "../src/config/runtimeConfig.js";

test("non-production runtime keeps local fallback behavior", () => {
  assert.deepEqual(validateRuntimeConfig({ NODE_ENV: "development" }), { ok: true, production: false });
  assert.deepEqual(validateRuntimeConfig({ NODE_ENV: "test" }), { ok: true, production: false });
});

test("production refuses to start without DATABASE_URL", () => {
  assert.throws(
    () => validateRuntimeConfig({ NODE_ENV: "production", AUTH_SECRET: "x".repeat(32) }),
    error => error?.code === "CONFIG_DATABASE_URL_MISSING" && /DATABASE_URL/i.test(error.message),
  );
});

test("production refuses weak or missing auth secrets", () => {
  const base = { NODE_ENV: "production", DATABASE_URL: "postgresql://user:password@localhost:5432/guardei" };
  assert.throws(() => validateRuntimeConfig(base), /AUTH_SECRET.*32/i);
  assert.throws(() => validateRuntimeConfig({ ...base, AUTH_SECRET: "too-short" }), /AUTH_SECRET.*32/i);
  assert.deepEqual(validateRuntimeConfig({ ...base, AUTH_SECRET: "a".repeat(32) }), { ok: true, production: true });
  assert.deepEqual(validateRuntimeConfig({ ...base, JWT_SECRET: "b".repeat(32) }), { ok: true, production: true });
});

test("server startup validates after dotenv and before app creation", async () => {
  const indexSource = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  const dotenvAt = indexSource.indexOf("dotenv.config()");
  const validateAt = indexSource.indexOf("validateRuntimeConfig()");
  const createAt = indexSource.indexOf("const app = createApp()");
  assert.ok(dotenvAt >= 0 && validateAt > dotenvAt && createAt > validateAt);
});

test("real production process exits before listening when auth config is invalid", () => {
  const serverRoot = new URL("../", import.meta.url);
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", "import('./src/index.js')"], {
    cwd: serverRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:password@localhost:5432/guardei",
      DATABASE_DIRECT_URL: "postgresql://user:password@localhost:5432/guardei",
      AUTH_SECRET: "",
      JWT_SECRET: "",
      PORT: "0",
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(`${result.stderr}\n${result.stdout}`, /AUTH_SECRET.*32/i);
  assert.doesNotMatch(result.stdout, /Guardei API rodando/);
});
