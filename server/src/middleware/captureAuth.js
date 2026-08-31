import { createHash } from "node:crypto";
import { requireAuth } from "./auth.js";
import { prisma } from "../db/prisma.js";
import { isExtensionOrigin } from "./security.js";

export async function requireCaptureOrAuth(req, res, next) {
  const header = String(req.get("authorization") || "");
  const raw = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const extensionOrigin = isExtensionOrigin(req.get("origin"));

  if (!raw.startsWith("gcp_")) {
    if (extensionOrigin) return res.status(401).json({ ok: false, message: "A extensao precisa de um token de captura do Guardei." });
    return requireAuth(req, res, next);
  }

  try {
    const tokenHash = createHash("sha256").update(raw).digest("hex");
    const token = await prisma.captureToken.findFirst({
      where: { tokenHash, revokedAt: null },
      select: {
        id: true,
        userId: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            settings: { select: { extensionCaptureEnabled: true } },
          },
        },
      },
    });
    if (!token?.user) return res.status(401).json({ ok: false, message: "Token de captura invalido." });
    if (token.user.settings?.extensionCaptureEnabled === false) {
      return res.status(403).json({ ok: false, message: "Captura pela extensao esta pausada nas configuracoes." });
    }
    req.user = { id: token.user.id, email: token.user.email, name: token.user.name };
    req.captureTokenId = token.id;
    prisma.captureToken.update({ where: { id: token.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
    return next();
  } catch (error) {
    return next(error);
  }
}
