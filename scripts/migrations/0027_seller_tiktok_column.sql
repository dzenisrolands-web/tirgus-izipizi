-- Migration 0027: Ensure sellers.tiktok column exists
--
-- The seller dashboard editor (components/dashboard-profile-editor.tsx) and
-- onboarding form have collected a "tiktok" field for a while, saved
-- defensively (only included in the payload when non-empty) because it was
-- never confirmed whether this column had been created in the database.
-- The public seller page never displayed it because of this same gap.
--
-- This migration is idempotent — safe to run even if the column already
-- exists.

ALTER TABLE sellers ADD COLUMN IF NOT EXISTS tiktok text;
