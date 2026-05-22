import express from "express";
import { AUTH_COOKIE, hashPassword, sessionCookieOptions, signSession, verifyPassword } from "../auth/security.js";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../db/prisma.js";

const router = express.Router();

router.post("/register", async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const name = String(req.body?.name || "").trim() || null;

    if (!email) return res.status(400).json({ ok: false, message: "Email obrigatorio." });
    if (password.length < 8) return res.status(400).json({ ok: false, message: "Use uma senha com pelo menos 8 caracteres." });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ ok: false, message: "Esse email ja esta cadastrado." });

    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: await hashPassword(password),
        settings: { create: {} },
      },
      select: { id: true, email: true, name: true },
    });

    res.cookie(AUTH_COOKIE, signSession(user.id), sessionCookieOptions());
    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    if (!email || !password) return res.status(400).json({ ok: false, message: "Email e senha obrigatorios." });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ ok: false, message: "Email ou senha invalidos." });
    }

    res.cookie(AUTH_COOKIE, signSession(user.id), sessionCookieOptions());
    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE, { ...sessionCookieOptions(), maxAge: 0 });
  res.status(204).end();
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

function normalizeEmail(value = "") {
  const email = String(value).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name };
}

export default router;
