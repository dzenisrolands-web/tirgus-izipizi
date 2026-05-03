-- Migration 0008: Weekly featured slots
-- Date: 2026-05-01
-- Idempotent — safe to re-run.
--
-- Sellers can apply for weekly featured slots; admin approves.
-- Homepage shows top N (positions 1-7) for current week.

CREATE TABLE IF NOT EXISTS weekly_featured (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  seller_id   uuid REFERENCES sellers(id) ON DELETE CASCADE,
  position    integer NOT NULL CHECK (position BETWEEN 1 AND 7),
  starts_at   date NOT NULL,
  ends_at     date NOT NULL,
  status      text NOT NULL DEFAULT 'pending',
  applied_at  timestamptz DEFAULT now() NOT NULL,
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id),
  notes       text,
  CHECK (status IN ('pending', 'active', 'rejected', 'expired')),
  CHECK (starts_at <= ends_at),
  CHECK (ends_at - starts_at <= 13)  -- max 2 weeks
);

CREATE INDEX IF NOT EXISTS weekly_featured_active_period_idx
  ON weekly_featured (starts_at, ends_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS weekly_featured_listing_idx
  ON weekly_featured (listing_id);

CREATE INDEX IF NOT EXISTS weekly_featured_seller_idx
  ON weekly_featured (seller_id);

-- Avoid duplicate applications for same listing in same period
CREATE UNIQUE INDEX IF NOT EXISTS weekly_featured_listing_period_uniq
  ON weekly_featured (listing_id, starts_at);

-- RLS
ALTER TABLE weekly_featured ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS weekly_featured_select_all ON weekly_featured;
CREATE POLICY weekly_featured_select_all ON weekly_featured FOR SELECT USING (true);

DROP POLICY IF EXISTS weekly_featured_insert_own ON weekly_featured;
CREATE POLICY weekly_featured_insert_own ON weekly_featured FOR INSERT WITH CHECK (
  seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS weekly_featured_update_own ON weekly_featured;
CREATE POLICY weekly_featured_update_own ON weekly_featured FOR UPDATE USING (
  seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid())
) WITH CHECK (
  seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid())
);

NOTIFY pgrst, 'reload schema';
