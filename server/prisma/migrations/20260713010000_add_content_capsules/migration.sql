-- Non-destructive migration: existing videos and users are preserved.
CREATE TYPE "CapsuleStatus" AS ENUM ('idle', 'extracting', 'generating', 'completed', 'limited', 'failed');
CREATE TYPE "CapsuleCoverage" AS ENUM ('full_content', 'user_content', 'metadata_only', 'partial_content');

CREATE TABLE "ContentCapsule" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "videoId" TEXT NOT NULL,
  "status" "CapsuleStatus" NOT NULL DEFAULT 'idle',
  "coverage" "CapsuleCoverage" NOT NULL DEFAULT 'metadata_only',
  "language" TEXT NOT NULL DEFAULT 'pt-BR',
  "summary" TEXT,
  "keyPoints" JSONB NOT NULL DEFAULT '[]',
  "concepts" JSONB NOT NULL DEFAULT '[]',
  "practicalApplications" JSONB NOT NULL DEFAULT '[]',
  "actionItems" JSONB NOT NULL DEFAULT '[]',
  "reflectionQuestions" JSONB NOT NULL DEFAULT '[]',
  "evidenceSnippets" JSONB NOT NULL DEFAULT '[]',
  "sourceText" TEXT,
  "sourceTextHash" TEXT,
  "aiModel" TEXT,
  "aiConfidence" DOUBLE PRECISION,
  "aiRationale" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "generatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContentCapsule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContentCapsule_videoId_key" ON "ContentCapsule"("videoId");
CREATE INDEX "ContentCapsule_userId_idx" ON "ContentCapsule"("userId");
CREATE INDEX "ContentCapsule_userId_status_idx" ON "ContentCapsule"("userId", "status");
CREATE INDEX "ContentCapsule_userId_coverage_idx" ON "ContentCapsule"("userId", "coverage");
CREATE INDEX "ContentCapsule_generatedAt_idx" ON "ContentCapsule"("generatedAt");
CREATE INDEX "ContentCapsule_userId_generatedAt_idx" ON "ContentCapsule"("userId", "generatedAt");

ALTER TABLE "ContentCapsule" ADD CONSTRAINT "ContentCapsule_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentCapsule" ADD CONSTRAINT "ContentCapsule_videoId_fkey"
  FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
