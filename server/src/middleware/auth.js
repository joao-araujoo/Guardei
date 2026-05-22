import { AUTH_COOKIE, verifySession } from "../auth/security.js";
import { prisma } from "../db/prisma.js";

export async function requireAuth(req, res, next) {
  try {
    const token = readCookie(req.headers.cookie || "", AUTH_COOKIE);
    const session = verifySession(token);
    if (!session?.userId) {
      return res.status(401).json({ ok: false, message: "Login obrigatorio." });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, name: true },
    });
    if (!user) return res.status(401).json({ ok: false, message: "Sessao invalida." });

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

function readCookie(cookieHeader, name) {
  return cookieHeader
    .split(";")
    .map(part => part.trim())
    .find(part => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}
