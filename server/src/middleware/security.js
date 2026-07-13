const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function securityHeaders(req, res, next) {
  const allowedConnect = parseOrigins(process.env.CORS_ORIGIN).join(" ");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "script-src 'self' https://code.iconify.design",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      `connect-src 'self' ${allowedConnect}`.trim(),
      "form-action 'self'",
    ].join("; "),
  );
  next();
}

export function verifyRequestOrigin(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.get("origin");
  if (!origin) return next();

  const allowed = new Set(parseOrigins(process.env.CORS_ORIGIN));
  const protocol = req.secure || req.get("x-forwarded-proto") === "https" ? "https" : "http";
  const host = req.get("host");
  if (host) allowed.add(`${protocol}://${host}`);

  if (!allowed.has(origin)) {
    return res.status(403).json({ ok: false, code: "INVALID_ORIGIN", message: "Origem da requisicao nao permitida." });
  }
  return next();
}

export function parseOrigins(value = "http://localhost:5173") {
  return String(value || "")
    .split(",")
    .map((item) => item.trim().replace(/\/$/, ""))
    .filter(Boolean);
}
