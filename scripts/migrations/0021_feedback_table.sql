-- Feedback / bug reports submitted via the floating widget
CREATE TABLE IF NOT EXISTS feedback (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message     text NOT NULL,
  email       text,
  page_url    text,
  user_agent  text,
  status      text NOT NULL DEFAULT 'new',  -- new | seen | done
  notes       text,                          -- admin notes
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Allow anonymous inserts (public can submit)
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can insert feedback"
  ON feedback FOR INSERT
  TO public
  WITH CHECK (true);

-- Only service role / admin can read
CREATE POLICY "service role reads feedback"
  ON feedback FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "service role updates feedback"
  ON feedback FOR UPDATE
  TO service_role
  USING (true);

-- Index for admin view
CREATE INDEX IF NOT EXISTS feedback_status_created ON feedback (status, created_at DESC);
