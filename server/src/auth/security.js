import crypto from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(crypto.scrypt);
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

export const AUTH_COOKIE = "guardei_session";

export function getAuthSecret() {
  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET precisa ter pelo menos 32 caracteres em producao.");
  }
  return "dev-only-change-this-auth-secret-32chars";
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt:${salt}:${Buffer.from(hash).toString("hex")}`;
}

export async function verifyPassword(password, storedHash = "") {
  const [algorithm, salt, hashHex] = storedHash.split(":");
  if (algorithm !== "scrypt" || !salt || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scryptAsync(password, salt, expected.length);
  return crypto.timingSafeEqual(expected, Buffer.from(actual));
}

export function signSession(userId) {
  const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = toBase64Url(JSON.stringify({
    sub: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  }));
  const signature = sign(`${header}.${payload}`);
  return `${header}.${payload}.${signature}`;
}

export function verifySession(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = sign(`${header}.${payload}`);
  if (!safeEqual(signature, expected)) return null;

  try {
    const data = JSON.parse(fromBase64Url(payload));
    if (!data.sub || Number(data.exp || 0) < Math.floor(Date.now() / 1000)) return null;
    return { userId: data.sub };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TOKEN_TTL_SECONDS * 1000,
  };
}

function sign(value) {
  return crypto.createHmac("sha256", getAuthSecret()).update(value).digest("base64url");
}

function toBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function safeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
