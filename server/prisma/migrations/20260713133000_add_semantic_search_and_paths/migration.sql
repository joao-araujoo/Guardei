CREATE TYPE "EmbeddingStatus" AS ENUM ('pending', 'indexed', 'outdated', 'failed');
CREATE TYPE "LearningPathStatus" AS ENUM ('active', 'completed', 'archived');
CREATE TYPE "LearningPathItemStatus" AS ENUM ('pending', 'in_progress', 'completed', 'skipped');
CREATE TYPE "LearningPathGapStatus" AS ENUM ('open', 'resolved', 'dismissed');
CREATE TYPE "LearningPathGapImportance" AS ENUM ('low', 'medium', 'high');

CREATE TABLE "VideoEmbedding" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "videoId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'local',
  "model" TEXT NOT NULL DEFAULT 'semantic-hash-v1',
  "dimensions" INTEGER NOT NULL DEFAULT 192,
  "vector" JSONB NOT NULL,
  "contentHash" TEXT NOT NULL,
  "status" "EmbeddingStatus" NOT NULL DEFAULT 'pending',
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "indexedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VideoEmbedding_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VideoEmbedding_videoId_key" ON "VideoEmbedding"("videoId");
CREATE INDEX "VideoEmbedding_userId_idx" ON "VideoEmbedding"("userId");
CREATE INDEX "VideoEmbedding_userId_status_idx" ON "VideoEmbedding"("userId", "status");
CREATE INDEX "VideoEmbedding_contentHash_idx" ON "VideoEmbedding"("contentHash");
ALTER TABLE "VideoEmbedding" ADD CONSTRAINT "VideoEmbedding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VideoEmbedding" ADD CONSTRAINT "VideoEmbedding_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LearningPath" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "objective" TEXT NOT NULL,
  "description" TEXT,
  "currentLevel" TEXT NOT NULL DEFAULT 'iniciante',
  "weeklyMinutes" INTEGER NOT NULL DEFAULT 60,
  "deadline" TIMESTAMP(3),
  "status" "LearningPathStatus" NOT NULL DEFAULT 'active',
  "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
  "autoOrganize" BOOLEAN NOT NULL DEFAULT true,
  "categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "resultType" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LearningPath_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LearningPath_userId_idx" ON "LearningPath"("userId");
CREATE INDEX "LearningPath_userId_status_idx" ON "LearningPath"("userId", "status");
CREATE INDEX "LearningPath_deadline_idx" ON "LearningPath"("deadline");
ALTER TABLE "LearningPath" ADD CONSTRAINT "LearningPath_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LearningPathItem" (
  "id" TEXT NOT NULL,
  "learningPathId" TEXT NOT NULL,
  "videoId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "section" TEXT NOT NULL DEFAULT 'Etapa 1',
  "reason" TEXT,
  "estimatedMinutes" INTEGER NOT NULL DEFAULT 10,
  "status" "LearningPathItemStatus" NOT NULL DEFAULT 'pending',
  "note" TEXT,
  "manualAdded" BOOLEAN NOT NULL DEFAULT false,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LearningPathItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LearningPathItem_learningPathId_videoId_key" ON "LearningPathItem"("learningPathId", "videoId");
CREATE INDEX "LearningPathItem_learningPathId_position_idx" ON "LearningPathItem"("learningPathId", "position");
CREATE INDEX "LearningPathItem_videoId_idx" ON "LearningPathItem"("videoId");
ALTER TABLE "LearningPathItem" ADD CONSTRAINT "LearningPathItem_learningPathId_fkey" FOREIGN KEY ("learningPathId") REFERENCES "LearningPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningPathItem" ADD CONSTRAINT "LearningPathItem_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LearningPathGap" (
  "id" TEXT NOT NULL,
  "learningPathId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "importance" "LearningPathGapImportance" NOT NULL DEFAULT 'medium',
  "status" "LearningPathGapStatus" NOT NULL DEFAULT 'open',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LearningPathGap_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LearningPathGap_learningPathId_idx" ON "LearningPathGap"("learningPathId");
CREATE INDEX "LearningPathGap_learningPathId_status_idx" ON "LearningPathGap"("learningPathId", "status");
ALTER TABLE "LearningPathGap" ADD CONSTRAINT "LearningPathGap_learningPathId_fkey" FOREIGN KEY ("learningPathId") REFERENCES "LearningPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;
