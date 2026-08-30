import { createHash } from "node:crypto";
import { requireAuth } from "./auth.js";
import { prisma } from "../db/prisma.js";

export async function requireCaptureOrAuth(req, res, next) {
  const header = String(req.get("authorization") || "");
  const raw = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!raw.startsWith("gcp_")) return requireAuth(req, res, next);

  try {
    const tokenHash = createHash("sha256").update(raw).digest("hex");
    const token = await prisma.captureToken.findFirst({
      where: { tokenHash, revokedAt: null },
      select: { id: true, userId: true, user: { select: { id: true, email: true, name: true } } },
    });
    if (!token?.user) return res.status(401).json({ ok: false, message: "Token de captura invalido." });
    req.user = token.user;
    req.captureTokenId = token.id;
    prisma.captureToken.update({ where: { id: token.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
    return next();
  } catch (error) {
    return next(error);
  }
}
