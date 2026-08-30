import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/authRoutes.js";
import achievementRoutes from "./routes/achievementRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import capsuleRoutes from "./routes/capsuleRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import pathRoutes from "./routes/pathRoutes.js";
import connectionRoutes from "./routes/connectionRoutes.js";
import reflectionRoutes from "./routes/reflectionRoutes.js";
import cardRoutes from "./routes/cardRoutes.js";
import applicationRoutes from "./routes/applicationRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import knowledgeRoutes from "./routes/knowledgeRoutes.js";
import pushRoutes from "./routes/pushRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import videoRoutes from "./routes/videoRoutes.js";
import { parseOrigins, securityHeaders, verifyRequestOrigin } from "./middleware/security.js";
import { safeLog } from "./security/safeLog.js";
import { getPushConfig, startPushScheduler } from "./push/webPush.js";

dotenv.config();

export function createApp() {
  const app = express();
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const clientDistPath = path.resolve(__dirname, "../../dist");
  const corsOrigins = parseOrigins(process.env.CORS_ORIGIN);

  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(securityHeaders);
  app.use(cors((req, callback) => {
    const origin = req.get("origin")?.replace(/\/$/, "");
    const forwardedProtocol = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const protocol = forwardedProtocol || (req.secure ? "https" : "http");
    const host = req.get("x-forwarded-host")?.split(",")[0]?.trim() || req.get("host");
    const requestOrigin = host ? `${protocol}://${host}`.replace(/\/$/, "") : "";
    const originAllowed = !origin || origin === requestOrigin || corsOrigins.includes(origin);

    if (!originAllowed) return callback(new Error("CORS_ORIGIN_BLOCKED"));
    return callback(null, {
      origin: true,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Push-Cron-Secret"],
    });
  }));
  app.use(express.json({ limit: "2mb", strict: true }));
  app.use(verifyRequestOrigin);

  app.get("/api", (_req, res) => {
    res.json({
      ok: true,
      name: "Guardei API",
      ai_provider: process.env.AI_PROVIDER || "local",
      web_push: getPushConfig().enabled,
    });
  });

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      status: "online",
      ai_provider: process.env.GEMINI_API_KEY ? "gemini" : "local-fallback",
      web_push: getPushConfig().enabled ? "configured" : "not-configured",
    });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/achievements", achievementRoutes);
  app.use("/api/ai", aiRoutes);
  app.use("/api/push", pushRoutes);
  app.use("/api/settings", settingsRoutes);
  app.use("/api/videos", capsuleRoutes);
  app.use("/api/videos", reflectionRoutes);
  app.use("/api/videos", videoRoutes);
  app.use("/api/search", searchRoutes);
  app.use("/api/paths", pathRoutes);
  app.use("/api", connectionRoutes);
  app.use("/api", cardRoutes);
  app.use("/api", applicationRoutes);
  app.use("/api/reviews", reviewRoutes);
  app.use("/api/knowledge", knowledgeRoutes);

  app.use(express.static(clientDistPath));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
    return res.sendFile(path.join(clientDistPath, "index.html"));
  });

  app.use((req, res) => {
    if (req.path.startsWith("/api/")) return res.status(404).json({ ok: false, message: "Rota nao encontrada." });
    return res.status(404).end();
  });

  app.use((error, _req, res, _next) => {
    const isPayloadError = error?.type === "entity.too.large" || error instanceof SyntaxError;
    const isCorsError = error?.message === "CORS_ORIGIN_BLOCKED";
    safeLog("error", "Erro de requisicao", { name: error?.name, code: error?.code, message: error?.message });
    if (isPayloadError) return res.status(400).json({ ok: false, code: "INVALID_PAYLOAD", message: "Payload invalido ou muito grande." });
    if (isCorsError) return res.status(403).json({ ok: false, code: "CORS_BLOCKED", message: "Origem nao permitida." });
    const status = Number(error?.status) || 500;
    if (status >= 400 && status < 500) {
      return res.status(status).json({
        ok: false,
        code: /^[A-Z0-9_]{3,64}$/.test(String(error?.code || "")) ? error.code : "INVALID_REQUEST",
        message: String(error?.message || "Requisicao invalida.").slice(0, 300),
      });
    }
    return res.status(500).json({ ok: false, code: "INTERNAL_ERROR", message: "Nao foi possivel concluir a solicitacao." });
  });

  return app;
}

const app = createApp();
if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT || 3333);
  app.listen(port, () => {
    console.log(`Guardei API rodando em http://localhost:${port}`);
    console.log(`Web Push: ${getPushConfig().enabled ? "configurado" : "aguardando VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT"}`);
    startPushScheduler();
  });
}

export default app;
