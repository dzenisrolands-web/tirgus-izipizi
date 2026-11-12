BEGIN;
CREATE TABLE public.marketplace_transition_evidence_v1 (
  order_id uuid NOT NULL REFERENCES public.orders(id),
  target_status text NOT NULL CHECK(target_status IN ('processing','shipped','delivered','cancelled')),
  actor_id uuid,
  reference text NOT NULL CHECK(length(btrim(reference))>=10),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(order_id,target_status),
  CHECK(actor_id IS NOT NULL OR target_status='cancelled')
);
ALTER TABLE public.marketplace_transition_evidence_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_transition_evidence_v1 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.marketplace_transition_evidence_v1 TO service_role;
CREATE FUNCTION public.marketplace_guard_fulfillment_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF OLD.lifecycle_version='marketplace-v1' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('shipped','delivered') AND NOT EXISTS (
      SELECT 1 FROM public.marketplace_transition_evidence_v1 WHERE order_id=OLD.id AND target_status=NEW.status
    ) THEN RAISE EXCEPTION 'Explicit operator fulfillment evidence required'; END IF;
    IF NEW.status='cancelled' AND OLD.payment_status='paid' AND NEW.payment_review_reason IS NULL THEN
      RAISE EXCEPTION 'Paid cancellation requires refund review, not payment erasure';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER marketplace_guard_fulfillment_v1 BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.marketplace_guard_fulfillment_v1();
CREATE FUNCTION public.marketplace_transition_v1(
  p_order_id uuid,p_expected text,p_status text,p_actor_id uuid,p_reference text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE ord public.orders%ROWTYPE;
BEGIN
  SELECT * INTO ord FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR ord.lifecycle_version IS DISTINCT FROM 'marketplace-v1' OR ord.status IS DISTINCT FROM p_expected
     OR p_status IS NULL OR p_status NOT IN ('processing','shipped','delivered','cancelled')
     OR coalesce(length(btrim(p_reference)),0) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION 'Valid expected state and documented transition required';
  END IF;
  IF p_actor_id IS NULL AND NOT (p_status='cancelled' AND p_reference='auto_cancel_unconfirmed_72h'
    AND ord.status='paid' AND ord.paid_at IS NOT NULL AND ord.paid_at<=clock_timestamp()-interval '72 hours') THEN
    RAISE EXCEPTION 'An authenticated operator is required';
  END IF;
  IF p_status='cancelled' THEN
    IF ord.status NOT IN ('pending','paid','processing') THEN RAISE EXCEPTION 'Return/reconciliation workflow required'; END IF;
    IF ord.payment_status='paid' THEN
      UPDATE public.orders SET payment_review_reason=coalesce(payment_review_reason,'refund_required'),status='cancelled' WHERE id=ord.id;
    ELSE
      PERFORM public.marketplace_release_v1(ord.id,'operator_cancelled');
    END IF;
  ELSE
    IF ord.payment_status IS DISTINCT FROM 'paid' OR ord.payment_review_reason IS NOT NULL THEN RAISE EXCEPTION 'Payment review blocks fulfillment'; END IF;
    IF p_status IN ('shipped','delivered') AND NOT EXISTS
      (SELECT 1 FROM public.marketplace_handoffs_v1 WHERE order_id=ord.id AND state='recorded') THEN
      RAISE EXCEPTION 'Receiver handoff acknowledgement required';
    END IF;
  END IF;
  INSERT INTO public.marketplace_transition_evidence_v1(order_id,target_status,actor_id,reference)
    VALUES(ord.id,p_status,p_actor_id,btrim(p_reference));
  IF p_status<>'cancelled' THEN UPDATE public.orders SET status=p_status WHERE id=ord.id; END IF;
  INSERT INTO public.marketplace_events_v1(event_key,order_id,event_type,payload)
    VALUES(ord.id||':status:'||p_status,ord.id,CASE WHEN p_status='cancelled' THEN 'order_cancelled' ELSE 'order_status_changed' END,
      jsonb_build_object('status',p_status)) ON CONFLICT(event_key) DO NOTHING;
  RETURN (SELECT jsonb_build_object('status',status,'payment_status',payment_status,'paid_at',paid_at) FROM public.orders WHERE id=ord.id);
END $$;
-- Seller confirmations can transition through the existing authenticated server
-- endpoint; capture their committed processing transition without best-effort I/O.
CREATE FUNCTION public.marketplace_capture_processing_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.lifecycle_version='marketplace-v1' AND NEW.status='processing' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.marketplace_events_v1(event_key,order_id,event_type,payload)
      VALUES(NEW.id||':status:processing',NEW.id,'order_status_changed','{"status":"processing"}')
      ON CONFLICT(event_key) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER marketplace_capture_processing_v1 AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.marketplace_capture_processing_v1();
REVOKE ALL ON FUNCTION public.marketplace_guard_fulfillment_v1(),public.marketplace_capture_processing_v1() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.marketplace_transition_v1(uuid,text,text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_transition_v1(uuid,text,text,uuid,text) TO service_role;
COMMIT;
