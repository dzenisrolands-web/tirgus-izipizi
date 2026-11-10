-- Fresh disposable PG17 only; requires stock fixture/migration 0044.
-- psql -v ON_ERROR_STOP=1 -v FINANCE_STOCK_ISOLATED_TEST=1 -f finance_stock_cancellation.sql
\if :{?FINANCE_STOCK_ISOLATED_TEST}
\else
  \quit 1
\endif
\ir atomic_stock_reservations.sql
CREATE TABLE public.invoices (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), operator_version text, operator_snapshot jsonb);
CREATE TABLE public.invoice_lines (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id uuid, order_id uuid);
\ir ../migrations/0045_finance_operations.sql
GRANT SELECT, UPDATE ON public.orders TO service_role;
GRANT SELECT ON public.listings TO service_role;
-- Inject a late audit failure to prove cancellation, queue and stock rollback.
CREATE FUNCTION public.fixture_reject_cancel_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.reason = 'admin_cancel:forced audit failure' THEN RAISE EXCEPTION 'Fixture audit failure'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER fixture_reject_cancel_audit BEFORE INSERT ON public.finance_review_events
FOR EACH ROW EXECUTE FUNCTION public.fixture_reject_cancel_audit();
SET ROLE service_role;
DO $$
DECLARE oid uuid; original_paid_at timestamptz; n integer; qty integer;
BEGIN
  oid := (public.create_reserved_marketplace_order(public.stock_test_order('finance-admin-cancel'))->>'order_id')::uuid;
  PERFORM public.settle_reserved_marketplace_order('finance-admin-cancel',500);
  SELECT paid_at INTO original_paid_at FROM public.orders WHERE id=oid;
  IF NOT public.cancel_order_with_review(oid,'admin_cancel:documented buyer request','90000000-0000-0000-0000-000000000001') THEN
    RAISE EXCEPTION 'Admin cancellation failed';
  END IF;
  IF (SELECT payment_status FROM public.orders WHERE id=oid) <> 'paid'
    OR (SELECT paid_at FROM public.orders WHERE id=oid) IS DISTINCT FROM original_paid_at
    OR (SELECT amount_cents FROM public.finance_refund_queue WHERE order_id=oid) IS DISTINCT FROM 500
    OR NOT EXISTS (SELECT 1 FROM public.finance_review_events WHERE entity_id=oid AND action='order_cancelled'
      AND actor_id='90000000-0000-0000-0000-000000000001' AND reason='admin_cancel:documented buyer request')
    OR (SELECT state FROM public.marketplace_stock_reservations WHERE order_id=oid) <> 'consumed' THEN
    RAISE EXCEPTION 'Admin cancellation lost audit/payment or restocked consumed stock';
  END IF;
  SELECT count(*) INTO n FROM public.finance_review_events;
  IF public.cancel_order_with_review(oid,'admin_cancel:documented buyer request','90000000-0000-0000-0000-000000000001')
    OR (SELECT count(*) FROM public.finance_review_events) <> n THEN
    RAISE EXCEPTION 'Repeated cancellation duplicated event';
  END IF;
  PERFORM public.complete_manual_refund(oid,'90000000-0000-0000-0000-000000000001',500,
    'FIXTURE-EXTERNAL-500',true,'2026-01-01','Verified provider fixture statement','Buyer refund completed externally');
  IF (SELECT paid_at FROM public.orders WHERE id=oid) IS DISTINCT FROM original_paid_at
    OR (SELECT payment_status FROM public.orders WHERE id=oid) <> 'refunded' THEN
    RAISE EXCEPTION 'Combined cancellation/refund destroyed payment facts';
  END IF;

  oid := (public.create_reserved_marketplace_order(public.stock_test_order('finance-cron-cancel'))->>'order_id')::uuid;
  PERFORM public.settle_reserved_marketplace_order('finance-cron-cancel',500);
  UPDATE public.orders SET paid_at=now()-interval '73 hours' WHERE id=oid;
  IF NOT public.cancel_order_with_review(oid,'auto_cancel_unconfirmed_72h',NULL) THEN RAISE EXCEPTION 'Cron cancellation failed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.finance_review_events WHERE entity_id=oid AND action='system_cancelled' AND actor_id IS NULL) THEN
    RAISE EXCEPTION 'Cron actor fabricated or system audit missing';
  END IF;

  oid := (public.create_reserved_marketplace_order(public.stock_test_order('finance-rollback'))->>'order_id')::uuid;
  SELECT quantity INTO qty FROM public.listings WHERE id='20000000-0000-0000-0000-000000000001';
  SELECT count(*) INTO n FROM public.finance_review_events;
  BEGIN
    PERFORM public.cancel_order_with_review(oid,'admin_cancel:forced audit failure','90000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'Late audit failure accepted' USING ERRCODE='check_violation';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Fixture audit failure' THEN RAISE; END IF;
  END;
  IF (SELECT status FROM public.orders WHERE id=oid) <> 'pending'
    OR (SELECT state FROM public.marketplace_stock_reservations WHERE order_id=oid) <> 'held'
    OR (SELECT quantity FROM public.listings WHERE id='20000000-0000-0000-0000-000000000001') <> qty
    OR EXISTS (SELECT 1 FROM public.finance_refund_queue WHERE order_id=oid)
    OR (SELECT count(*) FROM public.finance_review_events) <> n THEN
    RAISE EXCEPTION 'Late audit failure left partial stock, queue or order writes';
  END IF;
  IF NOT public.cancel_order_with_review(oid,'admin_cancel:release unpaid reservation','90000000-0000-0000-0000-000000000001') THEN
    RAISE EXCEPTION 'Unpaid cancellation failed';
  END IF;
  IF (SELECT state FROM public.marketplace_stock_reservations WHERE order_id=oid) <> 'released'
    OR (SELECT quantity FROM public.listings WHERE id='20000000-0000-0000-0000-000000000001') <> qty+1 THEN
    RAISE EXCEPTION 'Unpaid held inventory not released';
  END IF;
  oid := (public.create_reserved_marketplace_order(public.stock_test_order('finance-late'))->>'order_id')::uuid;
  UPDATE public.orders SET reservation_expires_at=now()-interval '1 second' WHERE id=oid;
  PERFORM public.expire_marketplace_reservations();
  PERFORM public.settle_reserved_marketplace_order('finance-late',500);
  IF (SELECT amount_cents FROM public.finance_refund_queue WHERE order_id=oid) IS DISTINCT FROM 500
    OR (SELECT state FROM public.marketplace_stock_reservations WHERE order_id=oid) <> 'released'
    OR (SELECT status FROM public.orders WHERE id=oid) <> 'cancelled' THEN
    RAISE EXCEPTION 'Late payment after expiry lost refund queue or consumed released stock';
  END IF;
  oid := (public.create_reserved_marketplace_order(public.stock_test_order('finance-wrong-amount'))->>'order_id')::uuid;
  PERFORM public.settle_reserved_marketplace_order('finance-wrong-amount',1);
  IF (SELECT amount_cents FROM public.finance_refund_queue WHERE order_id=oid) IS DISTINCT FROM 1
    OR (SELECT total_cents FROM public.orders WHERE id=oid) <> 500
    OR (SELECT payment_status FROM public.orders WHERE id=oid) <> 'paid' THEN
    RAISE EXCEPTION 'Wrong amount review queued expected rather than received money';
  END IF;
  IF has_function_privilege('authenticated','public.cancel_order_with_review(uuid,text,uuid)','EXECUTE')
    OR has_function_privilege('anon','public.cancel_order_with_review(uuid,text,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Cancellation audit RPC grants unsafe';
  END IF;
END $$;
RESET ROLE;
