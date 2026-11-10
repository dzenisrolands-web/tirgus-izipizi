-- LOCAL DISPOSABLE DATABASE ONLY. Refuses databases with an existing invoice table.
-- psql -v ON_ERROR_STOP=1 -v INVOICE_SNAPSHOT_ISOLATED_TEST=1 -f <this file>
\if :{?INVOICE_SNAPSHOT_ISOLATED_TEST}
\else
  \quit 1
\endif

DO $$
BEGIN
  IF to_regclass('public.invoices') IS NOT NULL
     OR to_regclass('public.invoice_lines') IS NOT NULL THEN
    RAISE EXCEPTION 'Use a fresh isolated database, not an application database';
  END IF;
END $$;

CREATE TABLE public.invoices (invoice_number text PRIMARY KEY, status text);
CREATE TABLE public.invoice_lines (id integer PRIMARY KEY);
INSERT INTO public.invoices VALUES ('SV-2026-0001', 'draft');
\ir ../migrations/0038_invoice_operator_snapshots.sql
-- Idempotent migration must preserve both legacy rows and new guards.
\ir ../migrations/0038_invoice_operator_snapshots.sql

DO $$
DECLARE
  snapshot jsonb := jsonb_build_object(
    'name', 'Test operator', 'regNr', 'TEST', 'vatNr', 'TEST-VAT',
    'address', 'Test address', 'phone', 'TEST-PHONE', 'email', 'test@example.invalid',
    'bankName', 'Test bank', 'iban', 'DUMMY', 'bic', 'DUMMY',
    'complaintsEmail', 'test@example.invalid'
  );
BEGIN
  IF (SELECT operator_snapshot FROM public.invoices WHERE invoice_number = 'SV-2026-0001') IS NOT NULL THEN
    RAISE EXCEPTION 'Legacy row was backfilled';
  END IF;
  UPDATE public.invoices SET status = 'sent' WHERE invoice_number = 'SV-2026-0001';

  BEGIN
    INSERT INTO public.invoices VALUES ('NO-SNAPSHOT', 'draft');
    RAISE EXCEPTION 'Missing snapshot accepted' USING ERRCODE = 'check_violation';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Invoice requires an operator version and snapshot' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.invoices (invoice_number, operator_version, operator_snapshot)
      VALUES ('BAD-SNAPSHOT', 'test', snapshot - 'iban');
    RAISE EXCEPTION 'Partial snapshot accepted' USING ERRCODE = 'check_violation';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Invoice operator snapshot missing field iban' THEN RAISE; END IF;
  END;

  INSERT INTO public.invoices (invoice_number, status, operator_version, operator_snapshot)
    VALUES ('TIR-2026-9999', 'draft', 'test', snapshot);
  UPDATE public.invoices SET status = 'paid' WHERE invoice_number = 'TIR-2026-9999';
  BEGIN
    UPDATE public.invoices SET operator_snapshot = snapshot || '{"iban":"REPLACED"}'
      WHERE invoice_number = 'TIR-2026-9999';
    RAISE EXCEPTION 'Immutable snapshot changed' USING ERRCODE = 'check_violation';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Invoice operator snapshot is immutable' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.invoices SET operator_version = NULL, operator_snapshot = NULL
      WHERE invoice_number = 'TIR-2026-9999';
    RAISE EXCEPTION 'Immutable snapshot erased' USING ERRCODE = 'check_violation';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Invoice operator snapshot is immutable' THEN RAISE; END IF;
  END;
  -- An accountant-reviewed legacy snapshot can be attached once, not rewritten.
  UPDATE public.invoices SET operator_version = 'reviewed-v1', operator_snapshot = snapshot
    WHERE invoice_number = 'SV-2026-0001';
END $$;
