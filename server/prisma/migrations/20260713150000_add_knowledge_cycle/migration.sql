CREATE TYPE "VideoApplicationStatus" AS ENUM ('none', 'planned', 'in_progress', 'completed', 'legacy_applied');
CREATE TYPE "KnowledgeCardType" AS ENUM ('question_answer', 'concept_explanation', 'situation_application', 'explain_own_words', 'decision', 'application');
CREATE TYPE "KnowledgeCardSource" AS ENUM ('manual', 'capsule', 'reflection', 'ai');
CREATE TYPE "KnowledgeCardStatus" AS ENUM ('active', 'suspended');
CREATE TYPE "ReviewRating" AS ENUM ('again', 'hard', 'good', 'easy');
CREATE TYPE "ApplicationCommitmentStatus" AS ENUM ('planned', 'in_progress', 'completed', 'dismissed');

ALTER TABLE "Video"
  ADD COLUMN "consumedAt" TIMESTAMP(3),
  ADD COLUMN "appliedAt" TIMESTAMP(3),
  ADD COLUMN "applicationStatus" "VideoApplicationStatus" NOT NULL DEFAULT 'none',
  ADD COLUMN "applicationNote" TEXT,
  ADD COLUMN "applicationEvidenceUrl" TEXT;

-- Preserve the historic meaning without claiming that old `aplicado` rows contain proof of application.
UPDATE "Video"
SET "consumedAt" = "watchedAt"
WHERE "watchedAt" IS NOT NULL AND "consumedAt" IS NULL;

UPDATE "Video"
SET "applicationStatus" = 'legacy_applied'
WHERE "status" = 'aplicado';

CREATE TABLE "ContentReflection" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "videoId" TEXT NOT NULL,
  "mainLearning" TEXT,
  "rememberLater" TEXT,
  "applicationIdea" TEXT,
  "confidence" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContentReflection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeCard" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "videoId" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "hint" TEXT,
  "cardType" "KnowledgeCardType" NOT NULL DEFAULT 'question_answer',
  "sourceType" "KnowledgeCardSource" NOT NULL DEFAULT 'manual',
  "status" "KnowledgeCardStatus" NOT NULL DEFAULT 'active',
  "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
  "intervalDays" INTEGER NOT NULL DEFAULT 0,
  "repetitions" INTEGER NOT NULL DEFAULT 0,
  "nextReviewAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastReviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KnowledgeCard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReviewAttempt" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "knowledgeCardId" TEXT NOT NULL,
  "answerText" TEXT,
  "rating" "ReviewRating" NOT NULL,
  "previousInterval" INTEGER NOT NULL,
  "nextInterval" INTEGER NOT NULL,
  "easeFactorAfter" DOUBLE PRECISION NOT NULL,
  "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApplicationCommitment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "videoId" TEXT NOT NULL,
  "learningPathId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "dueAt" TIMESTAMP(3),
  "status" "ApplicationCommitmentStatus" NOT NULL DEFAULT 'planned',
  "evidenceUrl" TEXT,
  "evidenceText" TEXT,
  "reflection" TEXT,
  "reviewAgain" BOOLEAN NOT NULL DEFAULT false,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApplicationCommitment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContentReflection_videoId_key" ON "ContentReflection"("videoId");
CREATE INDEX "ContentReflection_userId_idx" ON "ContentReflection"("userId");
CREATE INDEX "ContentReflection_userId_updatedAt_idx" ON "ContentReflection"("userId", "updatedAt");
CREATE INDEX "ContentReflection_videoId_idx" ON "ContentReflection"("videoId");
CREATE INDEX "KnowledgeCard_userId_idx" ON "KnowledgeCard"("userId");
CREATE INDEX "KnowledgeCard_userId_status_nextReviewAt_idx" ON "KnowledgeCard"("userId", "status", "nextReviewAt");
CREATE INDEX "KnowledgeCard_videoId_idx" ON "KnowledgeCard"("videoId");
CREATE INDEX "KnowledgeCard_nextReviewAt_idx" ON "KnowledgeCard"("nextReviewAt");
CREATE INDEX "ReviewAttempt_userId_idx" ON "ReviewAttempt"("userId");
CREATE INDEX "ReviewAttempt_userId_reviewedAt_idx" ON "ReviewAttempt"("userId", "reviewedAt");
CREATE INDEX "ReviewAttempt_knowledgeCardId_idx" ON "ReviewAttempt"("knowledgeCardId");
CREATE INDEX "ReviewAttempt_rating_idx" ON "ReviewAttempt"("rating");
CREATE INDEX "ApplicationCommitment_userId_idx" ON "ApplicationCommitment"("userId");
CREATE INDEX "ApplicationCommitment_userId_status_idx" ON "ApplicationCommitment"("userId", "status");
CREATE INDEX "ApplicationCommitment_videoId_idx" ON "ApplicationCommitment"("videoId");
CREATE INDEX "ApplicationCommitment_learningPathId_idx" ON "ApplicationCommitment"("learningPathId");
CREATE INDEX "ApplicationCommitment_dueAt_idx" ON "ApplicationCommitment"("dueAt");
CREATE INDEX "ApplicationCommitment_userId_dueAt_idx" ON "ApplicationCommitment"("userId", "dueAt");
CREATE INDEX "Video_userId_consumedAt_idx" ON "Video"("userId", "consumedAt");
CREATE INDEX "Video_userId_applicationStatus_idx" ON "Video"("userId", "applicationStatus");

ALTER TABLE "ContentReflection" ADD CONSTRAINT "ContentReflection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentReflection" ADD CONSTRAINT "ContentReflection_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeCard" ADD CONSTRAINT "KnowledgeCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeCard" ADD CONSTRAINT "KnowledgeCard_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewAttempt" ADD CONSTRAINT "ReviewAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewAttempt" ADD CONSTRAINT "ReviewAttempt_knowledgeCardId_fkey" FOREIGN KEY ("knowledgeCardId") REFERENCES "KnowledgeCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationCommitment" ADD CONSTRAINT "ApplicationCommitment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationCommitment" ADD CONSTRAINT "ApplicationCommitment_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationCommitment" ADD CONSTRAINT "ApplicationCommitment_learningPathId_fkey" FOREIGN KEY ("learningPathId") REFERENCES "LearningPath"("id") ON DELETE SET NULL ON UPDATE CASCADE;
