-- Reconcile schema drift left by the pre-migration/db-push transition.
-- This keeps the current Prisma schema as the source of truth and makes a
-- full migration replay produce the same structure as a legacy db-push DB.

DROP INDEX IF EXISTS "Video_userId_consumedAt_idx";
DROP INDEX IF EXISTS "Video_userId_applicationStatus_idx";

ALTER TABLE "Video"
  ALTER COLUMN "schemaVersion" SET DEFAULT 4;

CREATE INDEX IF NOT EXISTS "Video_savedFor_idx" ON "Video"("savedFor");
