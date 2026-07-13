const stores = new Set();

export function createRateLimiter({ windowMs, limit, keyPrefix = "global", message = "Muitas requisicoes. Tente novamente em instantes." }) {
  const buckets = new Map();
  stores.add(buckets);

  return function rateLimit(req, res, next) {
    const now = Date.now();
    const identity = req.user?.id || "anonymous";
    const ip = normalizeIp(req.ip || req.socket?.remoteAddress || "unknown");
    const key = `${keyPrefix}:${identity}:${ip}`;
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
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

function normalizeIp(value) {
  return String(value || "unknown").replace(/^::ffff:/, "");
}

function setHeaders(res, limit, remaining, resetAt) {
  res.setHeader("RateLimit-Limit", String(limit));
  res.setHeader("RateLimit-Remaining", String(remaining));
  res.setHeader("RateLimit-Reset", String(Math.ceil(resetAt / 1000)));
}
