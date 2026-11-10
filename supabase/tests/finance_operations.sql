-- LOCAL FRESH DISPOSABLE DATABASE ONLY. Never point this at an application DB.
-- psql -v ON_ERROR_STOP=1 -v FINANCE_ISOLATED_TEST=1 -f finance_operations.sql
\if :{?FINANCE_ISOLATED_TEST}
\else
  \quit 1
\endif
\set INVOICE_ATOMIC_ISOLATED_TEST 1
\ir atomic_invoice_generation.sql
ALTER ROLE service_role BYPASSRLS;
ALTER TABLE public.orders
  ADD COLUMN status text DEFAULT 'paid',
  ADD COLUMN payment_status text DEFAULT 'paid',
  ADD COLUMN paid_at timestamptz DEFAULT '2026-11-01T12:00:00Z',
  ADD COLUMN total_cents integer DEFAULT 1210,
  ADD COLUMN items jsonb,
  ADD COLUMN seller_ids uuid[],
  ADD COLUMN payment_received_cents integer,
  ADD COLUMN reservation_expires_at timestamptz,
  ADD COLUMN payment_review_reason text;
CREATE TABLE public.marketplace_stock_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid REFERENCES public.orders(id), state text NOT NULL
);
UPDATE public.orders SET items = '[{"seller_id":"00000000-0000-0000-0000-000000000002","price":12.1,"quantity":1,"vat_rate":21,"commission_rate":15,"seller_delivery_mode":"locker","seller_courier_fee_cents":0}]',
  seller_ids = ARRAY['00000000-0000-0000-0000-000000000002']::uuid[];
-- Legacy cancellation and operator ambiguity predate finance migration.
INSERT INTO public.orders(id, status, items, seller_ids)
SELECT '00000000-0000-0000-0000-000000000010', 'cancelled', items, seller_ids FROM public.orders LIMIT 1;
INSERT INTO public.invoices(invoice_number,seller_id,period_start,period_end,
  total_gross_cents,total_commission_cents,total_net_cents,status,operator_version,operator_snapshot)
SELECT 'LEGACY',seller_id,'2026-10-01','2026-10-15',0,0,0,'sent',operator_version,operator_snapshot FROM public.invoices LIMIT 1;
-- Simulate a pre-0038 issued invoice without inventing its operator.
ALTER TABLE public.invoices DISABLE TRIGGER invoice_operator_snapshot_guard;
UPDATE public.invoices SET operator_version = NULL, operator_snapshot = NULL WHERE invoice_number = 'LEGACY';
ALTER TABLE public.invoices ENABLE TRIGGER invoice_operator_snapshot_guard;
\ir ../migrations/0045_finance_operations.sql
\ir ../migrations/0045_finance_operations.sql

SET ROLE service_role;
DO $$
DECLARE n integer; original_paid_at timestamptz; r jsonb;
BEGIN
  IF (SELECT count(*) FROM public.finance_refund_queue) <> 0 THEN RAISE EXCEPTION 'Migration backfilled history'; END IF;
  IF NOT EXISTS (SELECT FROM public.finance_issues() WHERE entity_id = '00000000-0000-0000-0000-000000000010' AND issue = 'refund_review_required')
     OR NOT EXISTS (SELECT FROM public.finance_issues() WHERE issue = 'ambiguous_invoice_operator') THEN
    RAISE EXCEPTION 'Historical findings not surfaced';
  END IF;
  PERFORM public.enqueue_manual_refund('00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000090','Verified old cancellation','Original statement /local/test','OLD-REF');
  IF (SELECT count(*) FROM public.finance_refund_queue) <> 1 THEN RAISE EXCEPTION 'Explicit enrollment failed'; END IF;
  -- Cancelling an invoiced paid order queues atomically, without changing payment.
  SELECT paid_at INTO original_paid_at FROM public.orders WHERE id = '00000000-0000-0000-0000-000000000001';
  UPDATE public.orders SET status = 'cancelled' WHERE id = '00000000-0000-0000-0000-000000000001';
  UPDATE public.orders SET status = 'cancelled' WHERE id = '00000000-0000-0000-0000-000000000001';
  IF (SELECT count(*) FROM public.finance_refund_queue WHERE order_id = '00000000-0000-0000-0000-000000000001') <> 1
    OR (SELECT payment_status FROM public.orders WHERE id = '00000000-0000-0000-0000-000000000001') <> 'paid' THEN
    RAISE EXCEPTION 'Queue capture/idempotence destroyed payment';
  END IF;
  IF NOT EXISTS (SELECT FROM public.finance_issues() WHERE issue = 'credit_or_manual_adjustment_required') THEN
    RAISE EXCEPTION 'Existing issued invoice adjustment not flagged';
  END IF;
  -- Bad evidence, amount and unverified refund all roll back, including audit.
  SELECT count(*) INTO n FROM public.finance_review_events;
  BEGIN
    PERFORM public.complete_manual_refund('00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000090',1209,'PAYSERA-TEST-001',true,'2026-11-02','External statement fixture','Cancellation test reason');
    RAISE EXCEPTION 'Wrong amount accepted' USING ERRCODE = 'check_violation';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Exact amount and verified external refund evidence required' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.complete_manual_refund('00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000090',1210,'PAYSERA-TEST-001',false,'2026-11-02','External statement fixture','Cancellation test reason');
    RAISE EXCEPTION 'Unverified refund accepted' USING ERRCODE = 'check_violation';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Exact amount and verified external refund evidence required' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.complete_manual_refund('00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000090',1210,'PAYSERA-TEST-001',true,'2026-11-02','','Cancellation test reason');
    RAISE EXCEPTION 'Missing evidence accepted' USING ERRCODE = 'check_violation';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Exact amount and verified external refund evidence required' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM public.finance_review_events) <> n THEN RAISE EXCEPTION 'Failed completion left audit'; END IF;
  r := public.complete_manual_refund('00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000090',1210,'PAYSERA-TEST-001',true,'2026-11-02','External statement fixture','Cancellation test reason');
  IF r->>'idempotent' <> 'false' THEN RAISE EXCEPTION 'First completion not recorded'; END IF;
  r := public.complete_manual_refund('00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000090',1210,'PAYSERA-TEST-001',true,'2026-11-02','External statement fixture','Cancellation test reason');
  IF r->>'idempotent' <> 'true' OR (SELECT count(*) FROM public.finance_review_events) <> n + 1
    OR (SELECT payment_status FROM public.orders WHERE id = '00000000-0000-0000-0000-000000000001') <> 'refunded'
    OR (SELECT paid_at FROM public.orders WHERE id = '00000000-0000-0000-0000-000000000001') IS DISTINCT FROM original_paid_at THEN
    RAISE EXCEPTION 'Completion not atomic/idempotent or payment history erased';
  END IF;
  BEGIN
    PERFORM public.complete_manual_refund('00000000-0000-0000-0000-000000000010',
      '00000000-0000-0000-0000-000000000090',1210,'PAYSERA-TEST-001',true,'2026-11-02','External statement fixture','Cancellation test reason');
    RAISE EXCEPTION 'Duplicate external reference accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.complete_manual_refund('00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000090',1210,'DIFFERENT-REF',true,'2026-11-02','External statement fixture','Cancellation test reason');
    RAISE EXCEPTION 'Different duplicate accepted' USING ERRCODE = 'check_violation';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Refund already completed with different evidence' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.finance_review_events SET reason = 'Overwrite audit';
    RAISE EXCEPTION 'Audit mutation accepted' USING ERRCODE = 'check_violation';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

-- Paid review after expired reservation must not be lost even while awaiting.
INSERT INTO public.orders(id, status, payment_status, paid_at, total_cents, items, payment_review_reason)
VALUES ('00000000-0000-0000-0000-000000000020','cancelled','awaiting',NULL,1210,'[]','late_payment_expired'),
       ('00000000-0000-0000-0000-000000000021','cancelled','paid','2026-11-01',NULL,'{}',NULL),
       ('00000000-0000-0000-0000-000000000022','paid','paid','2026-11-01',1210,'[{"vat_rate":"21"}]',NULL);
INSERT INTO public.orders(id, status, payment_status, paid_at, total_cents, payment_received_cents, items, payment_review_reason)
VALUES ('00000000-0000-0000-0000-000000000023','cancelled','paid','2026-11-01',1210,1200,'[]','amount_mismatch');
SET ROLE service_role;
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM public.finance_refund_queue WHERE order_id = '00000000-0000-0000-0000-000000000020') THEN
    RAISE EXCEPTION 'Late paid expired review was lost';
  END IF;
  IF (SELECT amount_cents FROM public.finance_refund_queue WHERE order_id = '00000000-0000-0000-0000-000000000020') IS NOT NULL
    OR (SELECT amount_cents FROM public.finance_refund_queue WHERE order_id = '00000000-0000-0000-0000-000000000023') <> 1200 THEN
    RAISE EXCEPTION 'Review amount guessed instead of using observed payment';
  END IF;
  IF (SELECT count(*) FROM public.finance_issues() WHERE issue = 'unknown_financial_snapshots') <> 3 THEN
    RAISE EXCEPTION 'Unknown snapshots scan failed';
  END IF;
  BEGIN
    PERFORM public.complete_manual_refund('00000000-0000-0000-0000-000000000021',
      '00000000-0000-0000-0000-000000000090',1210,'PAYSERA-UNKNOWN',true,'2026-11-02','External statement fixture','Cancellation test reason');
    RAISE EXCEPTION 'Unknown amount guessed' USING ERRCODE = 'check_violation';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Exact amount and verified external refund evidence required' THEN RAISE; END IF;
  END;
  -- Reusing valid old invoice line attempts a real INSERT (not mocked text).
  BEGIN
    INSERT INTO public.invoice_lines(invoice_id,order_id,order_number,order_date,product_title,
      quantity,unit_price_cents,line_gross_cents,commission_rate,commission_cents,net_cents,line_order)
    SELECT invoice_id,order_id,order_number,order_date,product_title,
      quantity,unit_price_cents,line_gross_cents,commission_rate,commission_cents,net_cents,line_order+1
    FROM public.invoice_lines LIMIT 1;
    RAISE EXCEPTION 'Refunded/cancelled order invoiced' USING ERRCODE = 'check_violation';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Order is ineligible for invoicing; manual financial review required' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;
INSERT INTO public.orders(id,items,seller_ids)
SELECT '00000000-0000-0000-0000-000000000030',items,seller_ids FROM public.orders
WHERE id = '00000000-0000-0000-0000-000000000001';
SET ROLE service_role;
DO $$
DECLARE h jsonb; l jsonb; n integer; seq integer; r jsonb;
BEGIN
  SELECT to_jsonb(i) || '{"seller_id":"00000000-0000-0000-0000-000000000031"}'
    INTO h FROM public.invoices i WHERE invoice_number = 'TIR-2026-0001';
  SELECT to_jsonb(il) - 'id' - 'invoice_id' INTO l FROM public.invoice_lines il LIMIT 1;
  SELECT count(*) INTO n FROM public.invoices;
  SELECT s.n INTO seq FROM public.invoice_sequence s;
  BEGIN
    PERFORM public.create_invoice_with_lines(h, jsonb_build_array(l));
    RAISE EXCEPTION 'Cancelled order created an invoice' USING ERRCODE = 'check_violation';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Order is ineligible for invoicing; manual financial review required' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM public.invoices) <> n OR (SELECT s.n FROM public.invoice_sequence s) <> seq THEN
    RAISE EXCEPTION 'Ineligible source left an invoice header or number update';
  END IF;
  r := public.create_invoice_with_lines(h, jsonb_build_array(l || '{"order_id":"00000000-0000-0000-0000-000000000030"}'));
  IF r->>'id' IS NULL OR (SELECT count(*) FROM public.invoices) <> n + 1 THEN
    RAISE EXCEPTION 'Eligible order failed happy-path invoice creation';
  END IF;
  BEGIN
    UPDATE public.orders SET status = 'processing' WHERE id = '00000000-0000-0000-0000-000000000030';
    RAISE EXCEPTION 'Legacy fulfillment bypassed stock reservation' USING ERRCODE = 'check_violation';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Fulfillment requires verified payment and consumed reservation evidence; manual reconciliation required' THEN RAISE; END IF;
  END;
  UPDATE public.orders SET payment_review_reason = 'manual_payment_review' WHERE id = '00000000-0000-0000-0000-000000000030';
  BEGIN
    PERFORM public.complete_manual_refund('00000000-0000-0000-0000-000000000030',
      '00000000-0000-0000-0000-000000000090',1210,'PAYSERA-ACTIVE',true,'2026-11-02','External statement fixture','Cancellation test reason');
    RAISE EXCEPTION 'Active reservation refund completed' USING ERRCODE = 'check_violation';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Cancel the order through reservation reconciliation before completing its refund' THEN RAISE; END IF;
  END;
  PERFORM public.record_finance_review('order','00000000-0000-0000-0000-000000000030',
    '00000000-0000-0000-0000-000000000090','Accountant review recorded','Original provider statement','CASE-REVIEW-30');
  IF NOT EXISTS (SELECT FROM public.finance_issues() WHERE entity_id = (r->>'id')::uuid AND issue = 'credit_or_manual_adjustment_required')
    OR (SELECT payment_review_reason FROM public.orders WHERE id = '00000000-0000-0000-0000-000000000030') <> 'manual_payment_review' THEN
    RAISE EXCEPTION 'Review silently repaired evidence or hid issued invoice adjustment';
  END IF;
END $$;
RESET ROLE;
INSERT INTO public.orders(id,items,seller_ids,reservation_expires_at)
SELECT '00000000-0000-0000-0000-000000000040',items,seller_ids,now() FROM public.orders
WHERE id = '00000000-0000-0000-0000-000000000001';
INSERT INTO public.marketplace_stock_reservations(order_id,state) VALUES('00000000-0000-0000-0000-000000000040','consumed');
SET ROLE service_role;
UPDATE public.orders SET status = 'processing' WHERE id = '00000000-0000-0000-0000-000000000040';
UPDATE public.orders SET status = 'shipped' WHERE id = '00000000-0000-0000-0000-000000000040';
UPDATE public.orders SET status = 'delivered' WHERE id = '00000000-0000-0000-0000-000000000040';
RESET ROLE;
SET ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM public.finance_issues();
    RAISE EXCEPTION 'Ordinary user financial scan accepted' USING ERRCODE = 'check_violation';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.complete_manual_refund('00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000090',1210,'PAYSERA-TEST-001',true,'2026-11-02','External statement fixture','Cancellation test reason');
    RAISE EXCEPTION 'Ordinary user completion accepted' USING ERRCODE = 'check_violation';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
SET ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM count(*) FROM public.finance_refund_queue;
    RAISE EXCEPTION 'Anonymous financial read accepted' USING ERRCODE = 'check_violation';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
