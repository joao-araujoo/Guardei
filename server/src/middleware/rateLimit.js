const stores = new Set();
const DEFAULT_MAX_BUCKETS = 10_000;
const SWEEP_INTERVAL = 128;

export function createRateLimiter({
  windowMs,
  limit,
  keyPrefix = "global",
  message = "Muitas requisicoes. Tente novamente em instantes.",
  maxBuckets = DEFAULT_MAX_BUCKETS,
}) {
  const buckets = new Map();
  const bucketLimit = normalizeBucketLimit(maxBuckets);
  let operations = 0;
  stores.add(buckets);

  return function rateLimit(req, res, next) {
    const now = Date.now();
    operations += 1;
    if (operations % SWEEP_INTERVAL === 0) pruneExpired(buckets, now);

    const identity = req.user?.id || "anonymous";
    const ip = normalizeIp(req.ip || req.socket?.remoteAddress || "unknown");
    const key = `${keyPrefix}:${identity}:${ip}`;
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      if (current) buckets.delete(key);
      ensureCapacity(buckets, bucketLimit, now);
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      setHeaders(res, limit, limit - 1, now + windowMs);
      return next();
    }

    if (current.count >= limit) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      setHeaders(res, limit, 0, current.resetAt);
      return res.status(429).json({ ok: false, code: "RATE_LIMITED", message });
    }

    current.count += 1;
    setHeaders(res, limit, Math.max(0, limit - current.count), current.resetAt);
    return next();
  };
}

export function clearRateLimitStores() {
  for (const store of stores) store.clear();
}

export function getRateLimitStoreSizes() {
  return [...stores].map((store) => store.size);
}

function ensureCapacity(buckets, maxBuckets, now) {
  if (buckets.size < maxBuckets) return;
  pruneExpired(buckets, now);
  while (buckets.size >= maxBuckets) {
    const oldestKey = buckets.keys().next().value;
    if (oldestKey === undefined) break;
    buckets.delete(oldestKey);
  }
}

function pruneExpired(buckets, now) {
  for (const [key, value] of buckets) {
    if (value.resetAt <= now) buckets.delete(key);
  }
}

function normalizeBucketLimit(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_MAX_BUCKETS;
  return Math.min(parsed, 100_000);
}

function normalizeIp(value) {
  return String(value || "unknown").replace(/^::ffff:/, "");
}

function setHeaders(res, limit, remaining, resetAt) {
  res.setHeader("RateLimit-Limit", String(limit));
  res.setHeader("RateLimit-Remaining", String(remaining));
  res.setHeader("RateLimit-Reset", String(Math.ceil(resetAt / 1000)));
}
