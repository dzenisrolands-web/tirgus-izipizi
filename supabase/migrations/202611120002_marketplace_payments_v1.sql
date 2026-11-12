BEGIN;
CREATE TABLE public.marketplace_events_v1 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  order_id uuid NOT NULL REFERENCES public.orders(id),
  event_type text NOT NULL CHECK(event_type IN ('payment_confirmed','payment_review','order_cancelled','order_status_changed')),
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.marketplace_events_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_events_v1 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.marketplace_events_v1 TO service_role;

CREATE FUNCTION public.marketplace_guard_order_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF OLD.lifecycle_version IS DISTINCT FROM NEW.lifecycle_version THEN RAISE EXCEPTION 'Lifecycle identity is immutable'; END IF;
  IF OLD.lifecycle_version IS DISTINCT FROM 'marketplace-v1' THEN RETURN NEW; END IF;
  IF current_setting('role',true) IN ('anon','authenticated') THEN RAISE EXCEPTION 'Authorized server transition required'; END IF;
  IF NEW.lifecycle_version IS DISTINCT FROM OLD.lifecycle_version
     OR NEW.items IS DISTINCT FROM OLD.items OR NEW.total_cents IS DISTINCT FROM OLD.total_cents
     OR NEW.seller_ids IS DISTINCT FROM OLD.seller_ids OR NEW.delivery_info IS DISTINCT FROM OLD.delivery_info
     OR NEW.promo_discount_cents IS DISTINCT FROM OLD.promo_discount_cents
     OR NEW.order_number IS DISTINCT FROM OLD.order_number THEN
    RAISE EXCEPTION 'Reserved financial and fulfillment facts are immutable';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('paid','processing','shipped','delivered') THEN
    IF NEW.payment_status IS DISTINCT FROM 'paid' OR NEW.paid_at IS NULL OR NEW.payment_review_reason IS NOT NULL
       OR (SELECT count(*) FROM public.marketplace_reservations_v1 WHERE order_id=OLD.id AND state='consumed')
          <> jsonb_array_length(OLD.items)
       OR NOT ((OLD.status='pending' AND NEW.status='paid')
          OR (OLD.status='paid' AND NEW.status='processing')
          OR (OLD.status='processing' AND NEW.status='shipped')
          OR (OLD.status='shipped' AND NEW.status='delivered')) THEN
      RAISE EXCEPTION 'Payment/reservation evidence and sequential transition required';
    END IF;
  END IF;
  IF NEW.status='cancelled' AND EXISTS
     (SELECT 1 FROM public.marketplace_reservations_v1 WHERE order_id=OLD.id AND state='held') THEN
    RAISE EXCEPTION 'Release held inventory through reservation RPC first';
  END IF;
  IF NEW.payment_status='paid' AND OLD.payment_status IS DISTINCT FROM 'paid'
     AND NOT (NEW.status='paid' AND NEW.paid_at IS NOT NULL AND NEW.payment_received_cents=OLD.total_cents
       AND (SELECT count(*) FROM public.marketplace_reservations_v1 WHERE order_id=OLD.id AND state='consumed')=jsonb_array_length(OLD.items))
     AND NOT (NEW.status='cancelled' AND NEW.payment_review_reason IS NOT NULL AND NEW.payment_received_cents>0) THEN
    RAISE EXCEPTION 'Atomic payment settlement required';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER marketplace_guard_order_v1 BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.marketplace_guard_order_v1();

-- Only a verified server-side Paysera callback may call this service-only RPC.
CREATE FUNCTION public.marketplace_settle_v1(p_order_number text,p_amount_cents integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE ord public.orders%ROWTYPE; reason text; holds integer;
BEGIN
  SELECT * INTO ord FROM public.orders WHERE order_number=p_order_number FOR UPDATE;
  IF NOT FOUND OR ord.lifecycle_version IS DISTINCT FROM 'marketplace-v1'
     OR p_amount_cents IS NULL OR p_amount_cents<=0 THEN RAISE EXCEPTION 'Invalid settlement target'; END IF;
  IF ord.payment_status IN ('paid','refunded') THEN
    IF p_amount_cents IS DISTINCT FROM ord.payment_received_cents THEN
      UPDATE public.orders SET payment_review_reason='conflicting_payment_receipt' WHERE id=ord.id;
      INSERT INTO public.marketplace_events_v1(event_key,order_id,event_type,payload)
        VALUES(ord.id||':receipt-conflict',ord.id,'payment_review','{"reason":"conflicting_payment_receipt"}')
        ON CONFLICT(event_key) DO NOTHING;
      RETURN jsonb_build_object('order_id',ord.id,'outcome','review');
    END IF;
    RETURN jsonb_build_object('order_id',ord.id,'outcome',
      CASE WHEN ord.payment_review_reason IS NULL AND ord.payment_status='paid' THEN 'already_paid' ELSE 'review' END);
  END IF;
  SELECT count(*) INTO holds FROM public.marketplace_reservations_v1 WHERE order_id=ord.id AND state='held';
  IF p_amount_cents<>ord.total_cents THEN reason:='amount_mismatch';
  ELSIF ord.status<>'pending' OR ord.payment_status NOT IN ('awaiting','failed') THEN reason:='order_not_payable';
  ELSIF ord.reservation_expires_at<=clock_timestamp() THEN reason:='expired_reservation_paid';
  ELSIF holds<>jsonb_array_length(ord.items) OR holds=0 THEN reason:='reservation_requires_review';
  END IF;
  IF reason IS NOT NULL THEN
    PERFORM public.marketplace_release_v1(ord.id,reason);
    UPDATE public.orders SET status='cancelled',payment_status='paid',paid_at=clock_timestamp(),
      payment_received_cents=p_amount_cents,payment_review_reason=reason WHERE id=ord.id;
    INSERT INTO public.marketplace_events_v1(event_key,order_id,event_type,payload)
      VALUES(ord.id||':payment-review',ord.id,'payment_review',jsonb_build_object('reason',reason))
      ON CONFLICT(event_key) DO NOTHING;
    RETURN jsonb_build_object('order_id',ord.id,'outcome','review');
  END IF;
  UPDATE public.marketplace_reservations_v1 SET state='consumed' WHERE order_id=ord.id AND state='held';
  UPDATE public.orders SET status='paid',payment_status='paid',paid_at=clock_timestamp(),
    payment_received_cents=p_amount_cents WHERE id=ord.id;
  INSERT INTO public.marketplace_events_v1(event_key,order_id,event_type)
    VALUES(ord.id||':paid',ord.id,'payment_confirmed');
  RETURN jsonb_build_object('order_id',ord.id,'outcome','paid');
END $$;
REVOKE ALL ON FUNCTION public.marketplace_guard_order_v1() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.marketplace_settle_v1(text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_settle_v1(text,integer) TO service_role;
COMMIT;
