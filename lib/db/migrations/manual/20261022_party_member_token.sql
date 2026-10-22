-- Add before deploying the matching API and client. Legacy members stay unclaimed.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.party_members ADD COLUMN IF NOT EXISTS member_token_hash text;
COMMIT;
