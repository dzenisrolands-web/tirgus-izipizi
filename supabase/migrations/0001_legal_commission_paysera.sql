-- Migration 0001: Legal entity fields, per-product commission, Paysera, invoicing
-- Run this in Supabase SQL Editor. Idempotent — safe to re-run.
-- Date: 2026-04-29

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SELLERS — legal entity + bank + self-billing agreement
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE sellers
  ADD COLUMN IF NOT EXISTS legal_name              text,
  ADD COLUMN IF NOT EXISTS registration_number     text,
  ADD COLUMN IF NOT EXISTS is_vat_registered       boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS vat_number              text,
  ADD COLUMN IF NOT EXISTS legal_address           text,
  ADD COLUMN IF NOT EXISTS bank_name               text,
  ADD COLUMN IF NOT EXISTS bank_iban               text,
  ADD COLUMN IF NOT EXISTS bank_swift              text,
  ADD COLUMN IF NOT EXISTS self_billing_agreed     boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS self_billing_agreed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS self_billing_agreement_version text,
  ADD COLUMN IF NOT EXISTS self_billing_agreed_ip  text;

-- vat_number must be set if is_vat_registered = true
ALTER TABLE sellers
  DROP CONSTRAINT IF EXISTS sellers_vat_number_required;
ALTER TABLE sellers
  ADD CONSTRAINT sellers_vat_number_required
  CHECK (
    is_vat_registered = false
    OR (vat_number IS NOT NULL AND length(vat_number) >= 4)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. LISTINGS — per-product commission with admin approval
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS commission_rate         numeric(5,2),
  ADD COLUMN IF NOT EXISTS commission_status       text DEFAULT 'proposed',
  ADD COLUMN IF NOT EXISTS commission_proposed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS commission_approved_at  timestamptz,
  ADD COLUMN IF NOT EXISTS commission_approved_by  uuid REFERENCES auth.users(id);

ALTER TABLE listings
  DROP CONSTRAINT IF EXISTS listings_commission_rate_range;
ALTER TABLE listings
  ADD CONSTRAINT listings_commission_rate_range
  CHECK (commission_rate IS NULL OR (commission_rate >= 5 AND commission_rate <= 20));

ALTER TABLE listings
  DROP CONSTRAINT IF EXISTS listings_commission_status_valid;
ALTER TABLE listings
  ADD CONSTRAINT listings_commission_status_valid
  CHECK (commission_status IN ('proposed', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS listings_commission_status_idx
  ON listings (commission_status)
  WHERE commission_status = 'proposed';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ORDERS — Paysera + buyer link + locker code
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS buyer_id           uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS payment_status     text DEFAULT 'awaiting',
  ADD COLUMN IF NOT EXISTS payment_provider   text,
  ADD COLUMN IF NOT EXISTS payment_session_id text,
  ADD COLUMN IF NOT EXISTS locker_code        text;

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_payment_status_valid;
ALTER TABLE orders
  ADD CONSTRAINT orders_payment_status_valid
  CHECK (payment_status IN ('awaiting', 'paid', 'failed', 'refunded', 'cancelled'));

CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_session_id_uniq
  ON orders (payment_session_id)
  WHERE payment_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS orders_buyer_id_idx ON orders (buyer_id);

-- Note: orders.items is JSONB. When inserting, each item should now include
--   { commission_rate: number, seller_id: uuid }
-- This snapshot keeps invoices accurate even if listings.commission_rate changes later.

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. CATEGORY COMMISSION BENCHMARKS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS category_commission_benchmarks (
  category       text PRIMARY KEY,
  suggested_min  numeric(5,2) NOT NULL,
  suggested_avg  numeric(5,2) NOT NULL,
  suggested_max  numeric(5,2) NOT NULL,
  reasoning      text,
  updated_at     timestamptz DEFAULT now() NOT NULL,
  CHECK (suggested_min >= 5 AND suggested_max <= 20),
  CHECK (suggested_min <= suggested_avg AND suggested_avg <= suggested_max)
);

INSERT INTO category_commission_benchmarks (category, suggested_min, suggested_avg, suggested_max, reasoning) VALUES
  ('Dārzeņi',             7,  8,    10, 'Svaigā produkcija ar mazām margām zemniekam'),
  ('Olas',                7,  8,    10, 'Pamata produkts, ikdienas, jutīgs uz cenu'),
  ('Eļļas',              10, 12,    14, 'Niša, glabājas, vidēja marža'),
  ('Gaļa',               10, 12,    14, 'Aukstumķēde, vidēja marža'),
  ('Dzērieni',           10, 12,    15, 'Plašs cenu diapazons no ūdens līdz amatnieku alus'),
  ('Saldēta pārtika',    10, 12.5,  15, 'Pievienotā vērtība — pelmeņi, gatavi ēdieni'),
  ('Konservi',           10, 12.5,  15, 'Pievienotā vērtība, ilgs derīgums'),
  ('Jūras veltes',       12, 14,    16, 'Premium, ātri bojājas, aukstumķēde'),
  ('Konditorija',        12, 14.5,  17, 'Pievienotā vērtība, augstāka marža'),
  ('Uztura bagātinātāji',14, 17,    20, 'Premium ar augstāko maržu')
ON CONFLICT (category) DO UPDATE SET
  suggested_min = EXCLUDED.suggested_min,
  suggested_avg = EXCLUDED.suggested_avg,
  suggested_max = EXCLUDED.suggested_max,
  reasoning     = EXCLUDED.reasoning,
  updated_at    = now();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. INVOICES — self-billing invoice header + numbering
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invoice_sequence (
  year         integer PRIMARY KEY,
  last_number  integer NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION next_invoice_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  cy        integer := EXTRACT(YEAR FROM now())::integer;
  next_num  integer;
BEGIN
  INSERT INTO invoice_sequence (year, last_number)
  VALUES (cy, 1)
  ON CONFLICT (year) DO UPDATE
    SET last_number = invoice_sequence.last_number + 1
  RETURNING last_number INTO next_num;
  RETURN 'SV-' || cy || '-' || LPAD(next_num::text, 4, '0');
END;
$$;

CREATE TABLE IF NOT EXISTS invoices (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number         text UNIQUE NOT NULL,
  seller_id              uuid NOT NULL REFERENCES sellers(id) ON DELETE RESTRICT,
  period_start           date NOT NULL,
  period_end             date NOT NULL,
  total_gross_cents      integer NOT NULL,
  total_commission_cents integer NOT NULL,
  total_net_cents        integer NOT NULL,
  vat_rate               numeric(5,2),
  vat_amount_cents       integer,
  status                 text DEFAULT 'draft' NOT NULL,
  pdf_url                text,
  -- Snapshot of seller info at time of generation (so invoices stay accurate even if seller edits)
  seller_legal_name      text,
  seller_reg_number      text,
  seller_vat_number      text,
  seller_legal_address   text,
  seller_bank_name       text,
  seller_bank_iban       text,
  generated_at           timestamptz DEFAULT now() NOT NULL,
  sent_at                timestamptz,
  paid_at                timestamptz,
  created_at             timestamptz DEFAULT now() NOT NULL,
  updated_at             timestamptz DEFAULT now() NOT NULL,
  CHECK (status IN ('draft', 'sent', 'paid', 'disputed', 'cancelled')),
  CHECK (period_start <= period_end),
  UNIQUE (seller_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS invoices_seller_period_idx
  ON invoices (seller_id, period_start DESC);

CREATE INDEX IF NOT EXISTS invoices_status_idx
  ON invoices (status);

-- Per-line-item detail for the PDF rendering
CREATE TABLE IF NOT EXISTS invoice_lines (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id        uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  order_id          uuid REFERENCES orders(id),
  order_number      text,
  order_date        date NOT NULL,
  product_title     text NOT NULL,
  quantity          numeric(10,3) NOT NULL,
  unit              text,
  unit_price_cents  integer NOT NULL,
  line_gross_cents  integer NOT NULL,
  commission_rate   numeric(5,2) NOT NULL,
  commission_cents  integer NOT NULL,
  net_cents         integer NOT NULL,
  line_order        integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS invoice_lines_invoice_idx
  ON invoice_lines (invoice_id, line_order);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RLS — keep it simple for now; tighten before launch
-- ─────────────────────────────────────────────────────────────────────────────
-- Sellers can read their own invoices; admins can read all. Service role bypasses RLS.

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_commission_benchmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoices_select_own ON invoices;
CREATE POLICY invoices_select_own ON invoices FOR SELECT
  USING (seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS invoice_lines_select_own ON invoice_lines;
CREATE POLICY invoice_lines_select_own ON invoice_lines FOR SELECT
  USING (invoice_id IN (
    SELECT id FROM invoices
    WHERE seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid())
  ));

DROP POLICY IF EXISTS bench_select_all ON category_commission_benchmarks;
CREATE POLICY bench_select_all ON category_commission_benchmarks FOR SELECT
  USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- DONE.  Migrate existing 6 sellers manually OR ask them to fill juridical
-- info on first login. Listings created before this migration will have
-- commission_rate = NULL and must be edited+re-approved before going live.
-- ─────────────────────────────────────────────────────────────────────────────
