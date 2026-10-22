-- Add before deploying the matching API and client. Existing parties stay unclaimed.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.party_sessions ADD COLUMN IF NOT EXISTS host_token_hash text;
COMMIT;
