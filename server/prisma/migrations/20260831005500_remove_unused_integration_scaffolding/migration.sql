-- Remove generic integration scaffolding that has no runtime consumer.
-- Kept as a forward migration so environments that already applied Everywhere stay consistent.

DROP TABLE IF EXISTS "IntegrationLink";
DROP TABLE IF EXISTS "IntegrationAccount";
