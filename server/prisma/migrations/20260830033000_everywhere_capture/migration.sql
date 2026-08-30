-- Reconciliation + Everywhere capture layer. Additive and safe to run after the knowledge-cycle migrations.

ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "savedFor" TEXT;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "smartNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "clipboardSuggestionsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "guardinhoActionsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "recommendationMode" TEXT NOT NULL DEFAULT 'smart';
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "notificationFrequency" TEXT NOT NULL DEFAULT 'balanced';
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "lastSmartPushAt" TIMESTAMP(3);
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "weeklyDigestEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "autoSnapshotEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "contextAssistEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "screenshotOcrEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "extensionCaptureEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo';
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "lastWeeklyDigestAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "PushSubscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "userAgent" TEXT,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId");
CREATE INDEX IF NOT EXISTS "PushSubscription_lastSeenAt_idx" ON "PushSubscription"("lastSeenAt");

CREATE TABLE IF NOT EXISTS "CaptureToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'Extensao',
  "tokenHash" TEXT NOT NULL,
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CaptureToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CaptureToken_tokenHash_key" ON "CaptureToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "CaptureToken_userId_idx" ON "CaptureToken"("userId");
CREATE INDEX IF NOT EXISTS "CaptureToken_userId_revokedAt_idx" ON "CaptureToken"("userId", "revokedAt");

CREATE TABLE IF NOT EXISTS "ContentSnapshot" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "videoId" TEXT NOT NULL,
  "sourceStatus" TEXT NOT NULL DEFAULT 'metadata_only',
  "contentType" TEXT,
  "finalUrl" TEXT,
  "textContent" TEXT,
  "excerpt" TEXT,
  "contentHash" TEXT,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContentSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ContentSnapshot_videoId_key" ON "ContentSnapshot"("videoId");
CREATE INDEX IF NOT EXISTS "ContentSnapshot_userId_idx" ON "ContentSnapshot"("userId");
CREATE INDEX IF NOT EXISTS "ContentSnapshot_capturedAt_idx" ON "ContentSnapshot"("capturedAt");

CREATE TABLE IF NOT EXISTS "SavedAsset" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "videoId" TEXT,
  "kind" TEXT NOT NULL,
  "mimeType" TEXT,
  "data" TEXT,
  "ocrText" TEXT,
  "width" INTEGER,
  "height" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedAsset_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SavedAsset_userId_idx" ON "SavedAsset"("userId");
CREATE INDEX IF NOT EXISTS "SavedAsset_videoId_idx" ON "SavedAsset"("videoId");
CREATE INDEX IF NOT EXISTS "SavedAsset_kind_idx" ON "SavedAsset"("kind");

CREATE TABLE IF NOT EXISTS "SharedCollection" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "isPublic" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SharedCollection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SharedCollection_slug_key" ON "SharedCollection"("slug");
CREATE INDEX IF NOT EXISTS "SharedCollection_userId_idx" ON "SharedCollection"("userId");
CREATE INDEX IF NOT EXISTS "SharedCollection_userId_updatedAt_idx" ON "SharedCollection"("userId", "updatedAt");

CREATE TABLE IF NOT EXISTS "SharedCollectionItem" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "videoId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SharedCollectionItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SharedCollectionItem_collectionId_videoId_key" ON "SharedCollectionItem"("collectionId", "videoId");
CREATE INDEX IF NOT EXISTS "SharedCollectionItem_collectionId_position_idx" ON "SharedCollectionItem"("collectionId", "position");
CREATE INDEX IF NOT EXISTS "SharedCollectionItem_videoId_idx" ON "SharedCollectionItem"("videoId");

CREATE TABLE IF NOT EXISTS "QuickThought" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "contextUrl" TEXT,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuickThought_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "QuickThought_userId_createdAt_idx" ON "QuickThought"("userId", "createdAt");

CREATE TABLE IF NOT EXISTS "WeeklyDigest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "weekKey" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "highlights" JSONB NOT NULL DEFAULT '[]',
  "cleanup" JSONB NOT NULL DEFAULT '[]',
  "resurfaced" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WeeklyDigest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyDigest_userId_weekKey_key" ON "WeeklyDigest"("userId", "weekKey");
CREATE INDEX IF NOT EXISTS "WeeklyDigest_userId_createdAt_idx" ON "WeeklyDigest"("userId", "createdAt");

CREATE TABLE IF NOT EXISTS "IntegrationAccount" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "externalUserId" TEXT NOT NULL,
  "displayName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IntegrationAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationAccount_provider_externalUserId_key" ON "IntegrationAccount"("provider", "externalUserId");
CREATE INDEX IF NOT EXISTS "IntegrationAccount_userId_provider_idx" ON "IntegrationAccount"("userId", "provider");

CREATE TABLE IF NOT EXISTS "IntegrationLink" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegrationLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationLink_code_key" ON "IntegrationLink"("code");
CREATE INDEX IF NOT EXISTS "IntegrationLink_userId_provider_idx" ON "IntegrationLink"("userId", "provider");
CREATE INDEX IF NOT EXISTS "IntegrationLink_expiresAt_idx" ON "IntegrationLink"("expiresAt");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PushSubscription_userId_fkey') THEN
    ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CaptureToken_userId_fkey') THEN
    ALTER TABLE "CaptureToken" ADD CONSTRAINT "CaptureToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ContentSnapshot_userId_fkey') THEN
    ALTER TABLE "ContentSnapshot" ADD CONSTRAINT "ContentSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ContentSnapshot_videoId_fkey') THEN
    ALTER TABLE "ContentSnapshot" ADD CONSTRAINT "ContentSnapshot_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SavedAsset_userId_fkey') THEN
    ALTER TABLE "SavedAsset" ADD CONSTRAINT "SavedAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SavedAsset_videoId_fkey') THEN
    ALTER TABLE "SavedAsset" ADD CONSTRAINT "SavedAsset_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SharedCollection_userId_fkey') THEN
    ALTER TABLE "SharedCollection" ADD CONSTRAINT "SharedCollection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SharedCollectionItem_collectionId_fkey') THEN
    ALTER TABLE "SharedCollectionItem" ADD CONSTRAINT "SharedCollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "SharedCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SharedCollectionItem_videoId_fkey') THEN
    ALTER TABLE "SharedCollectionItem" ADD CONSTRAINT "SharedCollectionItem_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QuickThought_userId_fkey') THEN
    ALTER TABLE "QuickThought" ADD CONSTRAINT "QuickThought_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WeeklyDigest_userId_fkey') THEN
    ALTER TABLE "WeeklyDigest" ADD CONSTRAINT "WeeklyDigest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'IntegrationAccount_userId_fkey') THEN
    ALTER TABLE "IntegrationAccount" ADD CONSTRAINT "IntegrationAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'IntegrationLink_userId_fkey') THEN
    ALTER TABLE "IntegrationLink" ADD CONSTRAINT "IntegrationLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
