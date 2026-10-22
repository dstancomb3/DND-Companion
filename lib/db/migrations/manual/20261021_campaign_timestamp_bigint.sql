-- Explicit, operator-run migration for existing databases. Fresh databases use
-- the Drizzle schema. Run against the intended database after taking a backup.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE campaign_continuation_snapshots
  ALTER COLUMN client_saved_at TYPE bigint USING client_saved_at::bigint;
COMMIT;
