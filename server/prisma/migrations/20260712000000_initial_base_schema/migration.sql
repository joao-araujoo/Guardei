-- Baseline for the schema that existed before Prisma migrations were introduced.
--
-- Historical Guardei environments created these tables with `prisma db push`.
-- This migration is intentionally idempotent so that:
-- 1. a brand-new database can replay the full migration history; and
-- 2. an existing database can record this baseline without recreating data.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VideoStatus') THEN
    CREATE TYPE "VideoStatus" AS ENUM ('inbox', 'novo', 'rever', 'importante', 'aplicado', 'arquivado');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VideoPriority') THEN
    CREATE TYPE "VideoPriority" AS ENUM ('baixa', 'media', 'alta');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL,
  "name" TEXT,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Video" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "url" TEXT NOT NULL,
  "canonicalUrl" TEXT,
  "platform" TEXT NOT NULL DEFAULT 'web',
  "platformLabel" TEXT,
  "videoId" TEXT,
  "tiktokId" TEXT,
  "titleOriginal" TEXT,
  "titleAi" TEXT NOT NULL,
  "titleCustom" TEXT,
  "authorName" TEXT,
  "authorUrl" TEXT,
  "thumbnailUrl" TEXT,
  "thumbnailFallback" TEXT,
  "providerName" TEXT,
  "description" TEXT,
  "category" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "tags" TEXT[] NOT NULL,
  "priority" "VideoPriority" NOT NULL DEFAULT 'baixa',
  "status" "VideoStatus" NOT NULL DEFAULT 'novo',
  "note" TEXT,
  "summary" TEXT,
  "mood" TEXT,
  "effort" TEXT,
  "durationBucket" TEXT,
  "bestFor" TEXT,
  "watchWhen" TEXT,
  "sourceName" TEXT,
  "watchedAt" TIMESTAMP(3),
  "watchedSeconds" INTEGER NOT NULL DEFAULT 0,
  "watchCount" INTEGER NOT NULL DEFAULT 0,
  "sourceText" TEXT,
  "origin" TEXT NOT NULL DEFAULT 'manual',
  "reviewCount" INTEGER NOT NULL DEFAULT 0,
  "schemaVersion" INTEGER NOT NULL DEFAULT 3,
  "aiEngine" TEXT,
  "aiConfidence" DOUBLE PRECISION,
  "aiRationale" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UserSettings" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "dailyReviewTarget" INTEGER NOT NULL DEFAULT 3,
  "autoOpenReviewAfterShare" BOOLEAN NOT NULL DEFAULT false,
  "storageMode" TEXT NOT NULL DEFAULT 'api',
  "backendReady" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "VideoRevision" (
  "id" TEXT NOT NULL,
  "videoId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "note" TEXT,
  "action" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VideoRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UserAchievement" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "achievementId" TEXT NOT NULL,
  "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "Video_userId_url_key" ON "Video"("userId", "url");
CREATE INDEX IF NOT EXISTS "Video_userId_idx" ON "Video"("userId");
CREATE INDEX IF NOT EXISTS "Video_category_idx" ON "Video"("category");
CREATE INDEX IF NOT EXISTS "Video_platform_idx" ON "Video"("platform");
CREATE INDEX IF NOT EXISTS "Video_status_idx" ON "Video"("status");
CREATE INDEX IF NOT EXISTS "Video_priority_idx" ON "Video"("priority");
CREATE INDEX IF NOT EXISTS "Video_createdAt_idx" ON "Video"("createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "UserSettings_userId_key" ON "UserSettings"("userId");
CREATE INDEX IF NOT EXISTS "VideoRevision_videoId_idx" ON "VideoRevision"("videoId");
CREATE INDEX IF NOT EXISTS "VideoRevision_createdAt_idx" ON "VideoRevision"("createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "UserAchievement_userId_achievementId_key" ON "UserAchievement"("userId", "achievementId");
CREATE INDEX IF NOT EXISTS "UserAchievement_userId_idx" ON "UserAchievement"("userId");
CREATE INDEX IF NOT EXISTS "UserAchievement_achievementId_idx" ON "UserAchievement"("achievementId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Video_userId_fkey') THEN
    ALTER TABLE "Video" ADD CONSTRAINT "Video_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserSettings_userId_fkey') THEN
    ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VideoRevision_videoId_fkey') THEN
    ALTER TABLE "VideoRevision" ADD CONSTRAINT "VideoRevision_videoId_fkey"
      FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserAchievement_userId_fkey') THEN
    ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
