-- Migration 0005: Orders table — add missing columns for cart/checkout/Paysera flow
-- Date: 2026-04-29
-- Idempotent — safe to re-run.
--
-- Code references columns that didn't exist on the original orders table.
-- This migration brings the schema in line with what the app inserts and reads.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS buyer_name      text,
  ADD COLUMN IF NOT EXISTS buyer_email     text,
  ADD COLUMN IF NOT EXISTS buyer_phone     text,
  ADD COLUMN IF NOT EXISTS delivery_type   text,
  ADD COLUMN IF NOT EXISTS delivery_info   jsonb,
  ADD COLUMN IF NOT EXISTS items           jsonb,
  ADD COLUMN IF NOT EXISTS seller_ids      uuid[],
  ADD COLUMN IF NOT EXISTS total_cents     integer,
  ADD COLUMN IF NOT EXISTS paid_at         timestamptz;

-- delivery_type guard
ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_delivery_type_valid;
ALTER TABLE orders
  ADD CONSTRAINT orders_delivery_type_valid
  CHECK (delivery_type IS NULL OR delivery_type IN ('locker', 'courier', 'express'));

-- Make legacy total_amount nullable so inserts don't fail when only total_cents
-- is provided. Keep the column so existing reports don't break.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'total_amount'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE orders ALTER COLUMN total_amount DROP NOT NULL;
  END IF;
END $$;

-- Helpful indexes for dashboards
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);
CREATE INDEX IF NOT EXISTS orders_payment_status_idx ON orders (payment_status);
CREATE INDEX IF NOT EXISTS orders_seller_ids_gin ON orders USING GIN (seller_ids);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at DESC);

-- Force PostgREST to reload the schema cache so the new columns are visible
-- via the Supabase REST API immediately (otherwise: "Could not find column...").
NOTIFY pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────────
-- DONE.
-- ─────────────────────────────────────────────────────────────────────────────
