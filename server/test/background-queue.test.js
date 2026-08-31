import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCoalescingTaskQueue } from "../src/background/coalescingTaskQueue.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function tick() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test("background queue never exceeds configured concurrency", async () => {
  const queue = createCoalescingTaskQueue({ concurrency: 2, maxPending: 20 });
  let active = 0;
  let maxActive = 0;

  for (let index = 0; index < 8; index += 1) {
    queue.enqueue(`task-${index}`, async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 8));
      active -= 1;
    });
  }

  await queue.waitForIdle();
  assert.equal(maxActive, 2);
  assert.equal(queue.getStats().active, 0);
  assert.equal(queue.getStats().pending, 0);
});

test("queued duplicate is replaced by the latest task", async () => {
  const queue = createCoalescingTaskQueue({ concurrency: 1, maxPending: 10 });
  const blocker = deferred();
  const calls = [];

  queue.enqueue("blocker", async () => blocker.promise);
  await tick();

  queue.enqueue("same", async () => calls.push("old"));
  const result = queue.enqueue("same", async () => calls.push("latest"));
  assert.equal(result.coalesced, true);
  assert.equal(result.rerun, false);

  blocker.resolve();
  await queue.waitForIdle();
  assert.deepEqual(calls, ["latest"]);
});

test("duplicate received while active reruns exactly once with latest work", async () => {
  const queue = createCoalescingTaskQueue({ concurrency: 1, maxPending: 10 });
  const firstGate = deferred();
  const calls = [];

  queue.enqueue("video-1", async () => {
    calls.push("first");
    await firstGate.promise;
  });
  await tick();

  const second = queue.enqueue("video-1", async () => calls.push("second"));
  const latest = queue.enqueue("video-1", async () => calls.push("latest"));
  assert.equal(second.rerun, true);
  assert.equal(latest.rerun, true);

  firstGate.resolve();
  await queue.waitForIdle();
  assert.deepEqual(calls, ["first", "latest"]);
});

test("queue rejects new unique work after pending capacity is reached", async () => {
  const queue = createCoalescingTaskQueue({ concurrency: 1, maxPending: 1 });
  const blocker = deferred();

  queue.enqueue("active", async () => blocker.promise);
  await tick();
  assert.equal(queue.enqueue("pending", async () => {}).accepted, true);
  const rejected = queue.enqueue("overflow", async () => {});
  assert.deepEqual(rejected, { accepted: false, coalesced: false, rerun: false, reason: "queue-full" });

  blocker.resolve();
  await queue.waitForIdle();
});

test("task failure is reported and does not stall following work", async () => {
  const errors = [];
  const calls = [];
  const queue = createCoalescingTaskQueue({ concurrency: 1, onTaskError: (error, key) => errors.push([key, error.message]) });

  queue.enqueue("bad", async () => { throw new Error("boom"); });
  queue.enqueue("good", async () => calls.push("good"));
  await queue.waitForIdle();

  assert.deepEqual(errors, [["bad", "boom"]]);
  assert.deepEqual(calls, ["good"]);
});

test("embedding, snapshot and import routes are wired to bounded background work", async () => {
  const [embeddingSource, snapshotSource, importSource] = await Promise.all([
    readFile(new URL("../src/embeddings/embeddingService.js", import.meta.url), "utf8"),
    readFile(new URL("../src/everywhere/snapshotService.js", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/importRoutes.js", import.meta.url), "utf8"),
  ]);

  assert.match(embeddingSource, /createCoalescingTaskQueue/);
  assert.match(embeddingSource, /embeddingRefreshQueue\.enqueue/);
  assert.doesNotMatch(embeddingSource, /queueMicrotask\(\(\) => \{\s*ensureVideoEmbedding/);

  assert.match(snapshotSource, /createCoalescingTaskQueue/);
  assert.match(snapshotSource, /snapshotQueue\.enqueue/);
  assert.doesNotMatch(snapshotSource, /setTimeout\(\(\) => captureContentSnapshot/);

  assert.match(importSource, /createRateLimiter/);
  assert.match(importSource, /keyPrefix:\s*"bookmark-import"/);
  assert.match(importSource, /limit:\s*6/);
  assert.match(importSource, /router\.post\("\/bookmarks", bookmarkImportRateLimit/);
});
