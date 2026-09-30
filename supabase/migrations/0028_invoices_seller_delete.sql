-- Migration 0028: Allow deleting a seller that already has invoices
--
-- Problem: invoices.seller_id was defined as
--   uuid NOT NULL REFERENCES sellers(id) ON DELETE RESTRICT
-- which blocks admin "Dzēst ražotāju" whenever the seller has any invoice
-- (error: "update or delete on table sellers violates foreign key
-- constraint invoices_seller_id_fkey").
--
-- Fix: invoices already snapshot all legally-required seller details at
-- generation time (seller_legal_name, seller_reg_number, seller_vat_number,
-- seller_legal_address, seller_bank_name, seller_bank_iban — see migration
-- 0001). The invoice record does NOT depend on the live `sellers` row for
-- its legal/accounting accuracy, so it's safe to let seller_id go NULL when
-- the seller is deleted — the invoice itself is preserved unchanged.
--
-- Idempotent — safe to re-run.

ALTER TABLE invoices ALTER COLUMN seller_id DROP NOT NULL;

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_seller_id_fkey;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_seller_id_fkey
  FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
