const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "password",
  "passwordhash",
  "token",
  "secret",
  "apikey",
  "api_key",
  "gemini_api_key",
  "sourcetext",
]);

export function safeLog(level, message, details = {}) {
  const logger = console[level] || console.error;
  logger(`[Guardei] ${message}`, sanitize(details));
}

function sanitize(value, depth = 0) {
  if (depth > 4) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 10).map((item) => sanitize(item, depth + 1));
  if (!value || typeof value !== "object") {
    if (typeof value === "string" && value.length > 500) return `${value.slice(0, 497)}...`;
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_KEYS.has(key.toLowerCase()) ? "[redacted]" : sanitize(item, depth + 1),
    ]),
  );
}
