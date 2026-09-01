-- Migration 0023: Operator entity migration — SIA "Svaigi" → SIA "IziPizi"
-- Run this in Supabase SQL Editor. Idempotent — safe to re-run.
--
-- Scope:
--   1. Invoice numbering switches from the `SV-` prefix to `TIR-`, with an
--      independent per-prefix sequence so the new operator starts at 0001.
--   2. Invoices already issued under the previous operator are NOT touched.
--      They remain valid accounting documents of SIA "Svaigi" and must keep
--      their original numbers.
--   3. Existing self-billing consents stay in the table but become stale: the
--      application treats any `self_billing_agreement_version` other than the
--      current one as "needs re-consent" (see lib/legal/self-billing.ts), and
--      invoice generation skips those sellers until they accept version 2.0.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. INVOICE SEQUENCE — make the counter per (prefix, year)
-- ─────────────────────────────────────────────────────────────────────────────

-- Existing rows were all issued under the SV- prefix.
ALTER TABLE invoice_sequence
  ADD COLUMN IF NOT EXISTS prefix text NOT NULL DEFAULT 'SV-';

ALTER TABLE invoice_sequence DROP CONSTRAINT IF EXISTS invoice_sequence_pkey;
ALTER TABLE invoice_sequence ADD PRIMARY KEY (prefix, year);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. NUMBERING FUNCTION — new operator prefix
-- ─────────────────────────────────────────────────────────────────────────────
-- Keep the zero-argument signature so the existing `supabase.rpc(...)` call in
-- lib/invoice/generate.ts keeps working without an ambiguous overload.
-- The prefix here MUST match operatorInfo.invoice.numberPrefix.

CREATE OR REPLACE FUNCTION next_invoice_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  px        text := 'TIR-';
  cy        integer := EXTRACT(YEAR FROM now())::integer;
  next_num  integer;
BEGIN
  INSERT INTO invoice_sequence (prefix, year, last_number)
  VALUES (px, cy, 1)
  ON CONFLICT (prefix, year) DO UPDATE
    SET last_number = invoice_sequence.last_number + 1
  RETURNING last_number INTO next_num;
  RETURN px || cy || '-' || LPAD(next_num::text, 4, '0');
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. SANITY CHECK (read-only)
-- ─────────────────────────────────────────────────────────────────────────────
-- Sellers that must re-accept the self-billing agreement before their next
-- invoice can be generated:
--
--   SELECT id, legal_name, self_billing_agreement_version
--   FROM sellers
--   WHERE self_billing_agreed = true
--     AND coalesce(self_billing_agreement_version, '') <> '2.0';
