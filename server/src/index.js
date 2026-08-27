import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/authRoutes.js";
import achievementRoutes from "./routes/achievementRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import pushRoutes from "./routes/pushRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import videoRoutes from "./routes/videoRoutes.js";
import { getPushConfig, startPushScheduler } from "./push/webPush.js";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, "../../dist");

const PORT = Number(process.env.PORT || 3333);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Push-Cron-Secret"],
  })
);

app.use(express.json({ limit: "2mb" }));

app.get("/api", (req, res) => {
  res.json({
    ok: true,
    name: "Guardei API",
    ai_provider: process.env.AI_PROVIDER || "local",
    web_push: getPushConfig().enabled,
  });
});

app.get("/api/health", (req, res) => {
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
app.use("/api/videos", videoRoutes);

app.use(express.static(clientDistPath));

app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(clientDistPath, "index.html"));
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ ok: false, message: "Erro interno." });
});

app.listen(PORT, () => {
  console.log(`Guardei API rodando em http://localhost:${PORT}`);
  console.log(`Web Push: ${getPushConfig().enabled ? "configurado" : "aguardando VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT"}`);
  startPushScheduler();
});
