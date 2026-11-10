-- Apply before deploying snapshot-aware invoice generation.
-- No historical rows, numbers, amounts or operator identities are backfilled.
-- Legacy ambiguous rows require an accountant-verified snapshot + version.
BEGIN;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS operator_version text,
  ADD COLUMN IF NOT EXISTS operator_snapshot jsonb;

-- Reconcile columns already written by the generator but absent from tracked
-- migrations. Nullable deliberately: do not invent amounts for issued invoices.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS total_ex_vat_cents integer,
  ADD COLUMN IF NOT EXISTS total_product_vat_cents integer,
  ADD COLUMN IF NOT EXISTS commission_vat_rate numeric(5,2),
  ADD COLUMN IF NOT EXISTS commission_vat_cents integer,
  ADD COLUMN IF NOT EXISTS courier_fee_cents integer,
  ADD COLUMN IF NOT EXISTS courier_order_count integer;
ALTER TABLE public.invoice_lines
  ADD COLUMN IF NOT EXISTS vat_rate numeric(5,2),
  ADD COLUMN IF NOT EXISTS vat_amount_cents integer,
  ADD COLUMN IF NOT EXISTS ex_vat_cents integer;

CREATE OR REPLACE FUNCTION public.guard_invoice_operator_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  field text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.operator_snapshot IS NOT NULL OR OLD.operator_version IS NOT NULL THEN
      IF NEW.operator_snapshot IS DISTINCT FROM OLD.operator_snapshot
         OR NEW.operator_version IS DISTINCT FROM OLD.operator_version THEN
        RAISE EXCEPTION 'Invoice operator snapshot is immutable';
      END IF;
      RETURN NEW;
    END IF;
    IF NEW.operator_snapshot IS NULL AND NEW.operator_version IS NULL THEN
      RETURN NEW; -- ordinary status update of a legacy invoice
    END IF;
  END IF;

  IF NEW.operator_version IS NULL OR btrim(NEW.operator_version) = ''
     OR NEW.operator_snapshot IS NULL
     OR jsonb_typeof(NEW.operator_snapshot) <> 'object' THEN
    RAISE EXCEPTION 'Invoice requires an operator version and snapshot';
  END IF;
  FOREACH field IN ARRAY ARRAY[
    'name', 'regNr', 'vatNr', 'address', 'phone', 'email',
    'bankName', 'iban', 'bic', 'complaintsEmail'
  ] LOOP
    IF jsonb_typeof(NEW.operator_snapshot -> field) IS DISTINCT FROM 'string'
       OR btrim(NEW.operator_snapshot ->> field) = '' THEN
      RAISE EXCEPTION 'Invoice operator snapshot missing field %', field;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoice_operator_snapshot_guard ON public.invoices;
CREATE TRIGGER invoice_operator_snapshot_guard
BEFORE INSERT OR UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.guard_invoice_operator_snapshot();

COMMIT;
