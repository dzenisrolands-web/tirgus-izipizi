BEGIN;
CREATE FUNCTION public.marketplace_readiness_v1()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT jsonb_build_object(
    'contract','marketplace-v1',
    'production_ready',false,
    'held_reservations',(SELECT count(*) FROM public.marketplace_reservations_v1 WHERE state='held'),
    'payment_reviews',(SELECT count(*) FROM public.orders WHERE lifecycle_version='marketplace-v1'
      AND payment_review_reason IS NOT NULL AND payment_status IS DISTINCT FROM 'refunded'),
    'unknown_financial_snapshots',(SELECT count(*) FROM public.orders WHERE lifecycle_version='marketplace-v1'
      AND payment_status='paid' AND financial_snapshot->>'requires_review' IS DISTINCT FROM 'false'),
    'legacy_paid_orders',(SELECT count(*) FROM public.orders WHERE lifecycle_version IS NULL AND payment_status='paid'
      AND status IN ('paid','processing','shipped')),
    'credit_review_invoices',(SELECT count(DISTINCT l.invoice_id) FROM public.invoice_lines l
      JOIN public.orders o ON o.id=l.order_id WHERE o.status='cancelled' OR o.payment_status='refunded' OR o.payment_review_reason IS NOT NULL),
    'outbox_reviews',(SELECT count(*) FROM public.marketplace_outbox_v1 WHERE state='review'),
    'handoff_reviews',(SELECT count(*) FROM public.marketplace_handoffs_v1 WHERE state='review'),
    'external_verification_required',jsonb_build_array(
      'actual_schema_and_RLS','multi_session_inventory_races','provider_test_payment_and_receipt',
      'historical_finance_reconciliation','logistics_receiver_endpoint','cron_schedule_and_monitoring',
      'promo_atomic_redemption_policy','operator_approved_pilot_and_rollback')
  );
$$;
REVOKE ALL ON FUNCTION public.marketplace_readiness_v1() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_readiness_v1() TO service_role;
COMMIT;
