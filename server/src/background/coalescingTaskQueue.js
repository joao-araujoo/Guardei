export function createCoalescingTaskQueue({
  name = "background",
  concurrency = 2,
  maxPending = 5_000,
  onTaskError = () => {},
} = {}) {
  const queueName = String(name || "background").slice(0, 80);
  const workerLimit = normalizeInteger(concurrency, 2, 1, 32);
  const pendingLimit = normalizeInteger(maxPending, 5_000, 1, 20_000);
  const pending = new Map();
  const order = [];
  const active = new Set();
  const rerun = new Map();
  const idleWaiters = new Set();
  let drainScheduled = false;

  function enqueue(key, task) {
    const normalizedKey = String(key || "").trim();
    if (!normalizedKey) throw new TypeError(`${queueName}: task key is required`);
    if (typeof task !== "function") throw new TypeError(`${queueName}: task must be a function`);

    if (active.has(normalizedKey)) {
      rerun.set(normalizedKey, task);
      return { accepted: true, coalesced: true, rerun: true };
    }

    if (pending.has(normalizedKey)) {
      pending.set(normalizedKey, task);
      return { accepted: true, coalesced: true, rerun: false };
    }

    if (pending.size >= pendingLimit) {
      return { accepted: false, coalesced: false, rerun: false, reason: "queue-full" };
    }

    pending.set(normalizedKey, task);
    order.push(normalizedKey);
    scheduleDrain();
    return { accepted: true, coalesced: false, rerun: false };
  }

  function getStats() {
    return {
      name: queueName,
      concurrency: workerLimit,
      maxPending: pendingLimit,
      pending: pending.size,
      active: active.size,
      rerun: rerun.size,
    };
  }

  function waitForIdle() {
    if (isIdle()) return Promise.resolve();
    return new Promise((resolve) => idleWaiters.add(resolve));
  }

  function scheduleDrain() {
    if (drainScheduled) return;
    drainScheduled = true;
    queueMicrotask(() => {
      drainScheduled = false;
      drain();
    });
  }

  function drain() {
    while (active.size < workerLimit && order.length) {
      const key = order.shift();
      const task = pending.get(key);
      pending.delete(key);
      if (!task || active.has(key)) continue;

      active.add(key);
      Promise.resolve()
        .then(task)
        .catch((error) => {
          try {
            onTaskError(error, key);
          } catch {
            // Background error reporting must never stop the queue.
          }
        })
        .finally(() => {
          active.delete(key);
          const latestTask = rerun.get(key);
          if (latestTask) {
            rerun.delete(key);
            if (pending.size < pendingLimit) {
              pending.set(key, latestTask);
              order.push(key);
            } else {
              try {
                onTaskError(queueFullError(queueName), key);
              } catch {
                // Ignore logging failures.
              }
            }
          }
          scheduleDrain();
          resolveIdleIfNeeded();
        });
    }
    resolveIdleIfNeeded();
  }

  function resolveIdleIfNeeded() {
    if (!isIdle()) return;
    for (const resolve of idleWaiters) resolve();
    idleWaiters.clear();
  }

  function isIdle() {
    return pending.size === 0 && active.size === 0 && rerun.size === 0 && order.length === 0;
  }

  return { enqueue, getStats, waitForIdle };
}

function normalizeInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function queueFullError(name) {
  const error = new Error(`${name}: background queue is full`);
  error.code = "BACKGROUND_QUEUE_FULL";
  return error;
}
