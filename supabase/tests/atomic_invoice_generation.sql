-- LOCAL DISPOSABLE DATABASE ONLY.
-- psql -v ON_ERROR_STOP=1 -v INVOICE_ATOMIC_ISOLATED_TEST=1 -f <this file>
\if :{?INVOICE_ATOMIC_ISOLATED_TEST}
\else
  \quit 1
\endif
DO $$
BEGIN
  IF to_regclass('public.invoices') IS NOT NULL THEN
    RAISE EXCEPTION 'Use a fresh isolated database, not an application database';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
END $$;

CREATE TABLE public.orders (id uuid PRIMARY KEY);
INSERT INTO public.orders VALUES ('00000000-0000-0000-0000-000000000001');
CREATE TABLE public.invoice_sequence (n integer NOT NULL);
INSERT INTO public.invoice_sequence VALUES (0);
CREATE FUNCTION public.next_invoice_number() RETURNS text LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  UPDATE public.invoice_sequence s SET n = s.n + 1 RETURNING s.n INTO n;
  RETURN 'TIR-2026-' || lpad(n::text, 4, '0');
END $$;
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_number text UNIQUE NOT NULL,
  seller_id uuid NOT NULL, period_start date NOT NULL, period_end date NOT NULL,
  total_gross_cents integer NOT NULL, total_commission_cents integer NOT NULL,
  total_net_cents integer NOT NULL, status text NOT NULL,
  seller_legal_name text, seller_reg_number text, seller_vat_number text,
  seller_legal_address text, seller_bank_name text, seller_bank_iban text,
  UNIQUE (seller_id, period_start, period_end)
);
CREATE TABLE public.invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id),
  order_id uuid NOT NULL REFERENCES public.orders(id), order_number text,
  order_date date NOT NULL, product_title text NOT NULL CHECK (product_title <> 'FAIL-AFTER-HEADER'),
  quantity numeric(10,3) NOT NULL, unit text, unit_price_cents integer NOT NULL,
  line_gross_cents integer NOT NULL, commission_rate numeric(5,2) NOT NULL,
  commission_cents integer NOT NULL, net_cents integer NOT NULL, line_order integer NOT NULL
);
\ir ../migrations/0038_invoice_operator_snapshots.sql
\ir ../migrations/0039_atomic_invoice_generation.sql
\ir ../migrations/0039_atomic_invoice_generation.sql
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO service_role;

SET ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM public.create_invoice_with_lines('{}', '[]');
    RAISE EXCEPTION 'Anonymous RPC access allowed' USING ERRCODE = 'check_violation';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
SET ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM public.invoice_generation_ready();
    RAISE EXCEPTION 'Authenticated preflight access allowed' USING ERRCODE = 'check_violation';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.create_invoice_with_lines('{}', '[]');
    RAISE EXCEPTION 'Authenticated RPC access allowed' USING ERRCODE = 'check_violation';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
SET ROLE service_role;
DO $$
DECLARE
  header jsonb := '{
    "seller_id":"00000000-0000-0000-0000-000000000002",
    "period_start":"2026-11-01","period_end":"2026-11-15",
    "total_gross_cents":1210,"total_ex_vat_cents":1000,"total_product_vat_cents":210,
    "total_commission_cents":150,"commission_vat_rate":21,"commission_vat_cents":32,
    "courier_fee_cents":0,"courier_order_count":0,"total_net_cents":1028,
    "seller_legal_name":"Test seller","seller_bank_iban":"DUMMY","status":"draft",
    "operator_version":"test","operator_snapshot":{
      "name":"Test","regNr":"TEST","vatNr":"TEST","address":"Test","phone":"Test",
      "email":"test@example.invalid","bankName":"Test","iban":"DUMMY","bic":"DUMMY",
      "complaintsEmail":"test@example.invalid"
    }
  }';
  line jsonb := '{
    "order_id":"00000000-0000-0000-0000-000000000001","order_number":"TEST",
    "order_date":"2026-11-01","product_title":"Test","quantity":1,
    "unit_price_cents":1210,"line_gross_cents":1210,"vat_rate":21,
    "vat_amount_cents":210,"ex_vat_cents":1000,"commission_rate":15,
    "commission_cents":182,"net_cents":1028,"line_order":0
  }';
  result jsonb;
  second_header jsonb;
BEGIN
  IF public.invoice_generation_ready() <> 1 THEN RAISE EXCEPTION 'Preflight failed'; END IF;
  result := public.create_invoice_with_lines(header, jsonb_build_array(line));
  IF result->>'invoice_number' <> 'TIR-2026-0001'
     OR (SELECT count(*) FROM public.invoices) <> 1
     OR (SELECT count(*) FROM public.invoice_lines) <> 1 THEN
    RAISE EXCEPTION 'Atomic success failed';
  END IF;
  second_header := header || '{"seller_id":"00000000-0000-0000-0000-000000000003"}';
  BEGIN
    PERFORM public.create_invoice_with_lines(second_header,
      jsonb_build_array(line || '{"product_title":"FAIL-AFTER-HEADER"}'));
    RAISE EXCEPTION 'Late line failure accepted' USING ERRCODE = 'raise_exception';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.create_invoice_with_lines(second_header,
      jsonb_build_array(line || '{"order_id":"00000000-0000-0000-0000-000000000099"}'));
    RAISE EXCEPTION 'Missing order FK accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.create_invoice_with_lines(header, jsonb_build_array(line));
    RAISE EXCEPTION 'Duplicate period accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.create_invoice_with_lines(second_header || '{"total_net_cents":1000}', jsonb_build_array(line));
    RAISE EXCEPTION 'Mismatched totals accepted' USING ERRCODE = 'check_violation';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Invoice totals do not match lines' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.create_invoice_with_lines(second_header || '{"operator_snapshot":{}}', jsonb_build_array(line));
    RAISE EXCEPTION 'Missing snapshot accepted' USING ERRCODE = 'check_violation';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Invoice operator snapshot missing field %' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.create_invoice_with_lines(second_header, jsonb_build_array(line || '{"commission_rate":10}'));
    RAISE EXCEPTION 'Historical unsupported rate accepted' USING ERRCODE = 'check_violation';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Invalid invoice lines; manual reconciliation required' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM public.invoices) <> 1
     OR (SELECT count(*) FROM public.invoice_lines) <> 1
     OR (SELECT n FROM public.invoice_sequence) <> 1 THEN
    RAISE EXCEPTION 'Failed operation left a header, lines or numbering update';
  END IF;
END $$;
RESET ROLE;
