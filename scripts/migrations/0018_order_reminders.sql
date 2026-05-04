-- Order reminder bookkeeping for the seller-noticing-the-order pipeline.
-- The cron job at /api/cron/order-reminders bumps `seller_reminded_count`
-- each time it sends an escalation push so we don't spam the seller more
-- than once per slot (30 min, 2 h, 6 h) and we cap at 3 reminders before
-- auto-cancel kicks in at the 24 h mark.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS seller_reminded_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seller_reminded_at    timestamptz,
  ADD COLUMN IF NOT EXISTS auto_cancelled_at     timestamptz;

-- Quick lookup for the cron — orders sitting in `paid` waiting for the
-- seller to flip them to `processing`.
CREATE INDEX IF NOT EXISTS idx_orders_status_paid_at
  ON orders (status, paid_at)
  WHERE status = 'paid';
