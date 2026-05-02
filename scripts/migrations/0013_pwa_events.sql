-- Migration 0013: PWA install + standalone-visit telemetry
-- Date: 2026-05-03
-- Idempotent — safe to re-run.
--
-- Captures the lifecycle of "Add to Home Screen" so the admin can answer:
--   • how many users were *offered* the install prompt (B1)
--   • how many *accepted* (B2)
--   • how many recurring sessions arrive in standalone mode (B3 proxy)
--
-- One row per event. No PII — only a coarse user-agent fingerprint and
-- the ISO timestamp. Filtering/aggregation lives in the admin dashboard.

CREATE TABLE IF NOT EXISTS pwa_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  text        NOT NULL CHECK (event_type IN
                ('prompt_shown', 'prompt_accepted', 'prompt_dismissed', 'standalone_visit')),
  ua_summary  text,        -- short label like "Chrome/Android" or "Safari/iOS"
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pwa_events_type_date
  ON pwa_events (event_type, created_at DESC);

ALTER TABLE pwa_events ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous) can write events — required because the
-- prompt fires for non-logged-in visitors. Reads are admin-only via the
-- service-role key from server-side queries.
DROP POLICY IF EXISTS pwa_events_insert_public ON pwa_events;
CREATE POLICY pwa_events_insert_public ON pwa_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);
