import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "..");
const migrationsDir = path.join(serverRoot, "prisma", "migrations");
const prismaCli = path.join(serverRoot, "node_modules", "prisma", "build", "index.js");
const MAX_DRIFT_OUTPUT = 12_000;

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL nao configurada para migrations.");

  const prisma = new PrismaClient();
  let state;
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT
        to_regclass('public._prisma_migrations')::text AS "migrationTable",
        to_regclass('public."User"')::text AS "userTable",
        to_regclass('public."Video"')::text AS "videoTable"
    `);
    state = rows?.[0] || {};
  } finally {
    await prisma.$disconnect();
  }

  const hasLegacySchema = Boolean(state.userTable || state.videoTable);
  const hasMigrationHistory = Boolean(state.migrationTable);

  if (hasLegacySchema && !hasMigrationHistory) {
    console.log("Schema legado sem historico Prisma detectado; validando compatibilidade antes da adocao...");
    const diff = runPrisma([
      "migrate",
      "diff",
      "--from-schema-datasource",
      "prisma/schema.prisma",
      "--to-schema-datamodel",
      "prisma/schema.prisma",
      "--exit-code",
    ], { quiet: true, allowDiffExit: true });

    if (diff.status === 2) {
      const schemaOnlyDiff = String(diff.stdout || "").trim().slice(0, MAX_DRIFT_OUTPUT);
      if (schemaOnlyDiff) console.error(`[migrate-production] Drift estrutural detectado:\n${schemaOnlyDiff}`);
      throw new Error("O banco legado possui drift em relacao ao schema atual. A adocao automatica foi interrompida para proteger os dados.");
    }
    if (diff.status !== 0) {
      throw new Error("Nao foi possivel validar o schema legado antes da adocao das migrations.");
    }

    const migrationNames = (await readdir(migrationsDir, { withFileTypes: true }))
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort();

    for (const migrationName of migrationNames) {
      runPrisma(["migrate", "resolve", "--applied", migrationName]);
    }
    console.log(`Historico Prisma adotado com seguranca (${migrationNames.length} migrations registradas).`);
  }

  runPrisma(["migrate", "deploy"]);
}

function runPrisma(args, { quiet = false, allowDiffExit = false } = {}) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: serverRoot,
    env: process.env,
    encoding: "utf8",
    stdio: quiet ? "pipe" : "inherit",
  });

  if (result.error) throw result.error;
  if (!allowDiffExit && result.status !== 0) {
    throw new Error(`Prisma terminou com codigo ${result.status ?? "desconhecido"}.`);
  }
  return result;
}

main().catch(error => {
  console.error(`[migrate-production] ${error.message}`);
  process.exitCode = 1;
});
