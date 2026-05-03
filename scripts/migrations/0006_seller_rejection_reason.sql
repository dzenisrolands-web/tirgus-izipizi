-- Migration 0006: Sellers — rejection reason + audit fields
-- Date: 2026-05-01
-- Idempotent — safe to re-run.

ALTER TABLE sellers
  ADD COLUMN IF NOT EXISTS rejected_reason text,
  ADD COLUMN IF NOT EXISTS rejected_at     timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by     uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at     timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by     uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS internal_notes  text;

NOTIFY pgrst, 'reload schema';
