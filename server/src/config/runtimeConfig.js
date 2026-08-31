import { getAuthSecret } from "../auth/security.js";

export function validateRuntimeConfig(env = process.env) {
  if (env.NODE_ENV !== "production") return { ok: true, production: false };

  const databaseUrl = String(env.DATABASE_URL || "").trim();
  if (!databaseUrl) throw configError("DATABASE_URL obrigatoria em producao.", "CONFIG_DATABASE_URL_MISSING");

  getAuthSecret(env);

  return { ok: true, production: true };
}

function configError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}
