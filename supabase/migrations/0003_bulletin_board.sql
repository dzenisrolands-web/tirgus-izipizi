-- Migration 0003: Sludinājumu dēlis (bulletin board)
-- Date: 2026-04-29
-- Adds locker subscriptions + extends hot_drops with audio/location for live announcements.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. LOCKER SUBSCRIPTIONS — users subscribe to specific lockers
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS locker_subscriptions (
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  locker_id     text NOT NULL,
  push_enabled  boolean DEFAULT true NOT NULL,
  sms_enabled   boolean DEFAULT false NOT NULL,
  phone         text,
  created_at    timestamptz DEFAULT now() NOT NULL,
  updated_at    timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (user_id, locker_id)
);

CREATE INDEX IF NOT EXISTS locker_subscriptions_locker_idx
  ON locker_subscriptions (locker_id);

ALTER TABLE locker_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS locker_subs_select_own ON locker_subscriptions;
CREATE POLICY locker_subs_select_own ON locker_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS locker_subs_insert_own ON locker_subscriptions;
CREATE POLICY locker_subs_insert_own ON locker_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS locker_subs_update_own ON locker_subscriptions;
CREATE POLICY locker_subs_update_own ON locker_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS locker_subs_delete_own ON locker_subscriptions;
CREATE POLICY locker_subs_delete_own ON locker_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. HOT DROPS EXTENSION — audio recording, location text, posted timestamp
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE hot_drops
  ADD COLUMN IF NOT EXISTS audio_url      text,
  ADD COLUMN IF NOT EXISTS location_text  text,
  ADD COLUMN IF NOT EXISTS posted_at      timestamptz DEFAULT now();

-- Backfill posted_at from created_at for existing rows
UPDATE hot_drops SET posted_at = created_at WHERE posted_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. STORAGE BUCKET (manual step in Supabase Dashboard)
-- ─────────────────────────────────────────────────────────────────────────────
-- Storage → New bucket → name: 'bulletin-media'
-- Public access: YES (read), users can upload only their own files
-- Allowed MIME types: image/*, audio/*
--
-- Policy for upload:
--   ((storage.foldername(name))[1] = auth.uid()::text)
-- (so that user can only upload to /{their_uid}/* prefix)

-- ─────────────────────────────────────────────────────────────────────────────
-- DONE.
-- ─────────────────────────────────────────────────────────────────────────────
