-- Migration 0007: Sellers — courier pickup address
-- Date: 2026-05-01
-- Idempotent — safe to re-run.
-- home_locker_ids was already added in earlier setup; this only adds courier_pickup_address.

ALTER TABLE sellers
  ADD COLUMN IF NOT EXISTS home_locker_ids        text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS courier_pickup_address text;

NOTIFY pgrst, 'reload schema';
