BEGIN;
CREATE FUNCTION public.marketplace_capture_finance_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE entry jsonb; p public.listings%ROWTYPE; s public.sellers%ROWTYPE;
  lines jsonb:='[]'; rate numeric; needs_review boolean:=false; op jsonb;
BEGIN
  IF NEW.lifecycle_version IS DISTINCT FROM 'marketplace-v1' THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' THEN
    IF NEW.financial_snapshot IS DISTINCT FROM OLD.financial_snapshot THEN RAISE EXCEPTION 'Financial snapshot is immutable'; END IF;
    RETURN NEW;
  END IF;
  op:=NEW.financial_snapshot->'operator';
  IF jsonb_typeof(op) IS DISTINCT FROM 'object' OR EXISTS (
    SELECT 1 FROM unnest(ARRAY['name','regNr','vatNr','address','phone','email','bankName','iban','bic','complaintsEmail']) k
      WHERE jsonb_typeof(op->k) IS DISTINCT FROM 'string' OR coalesce(btrim(op->>k),'')=''
  ) THEN needs_review:=true; END IF;
  FOR entry IN SELECT value FROM jsonb_array_elements(NEW.items) LOOP
    SELECT * INTO STRICT p FROM public.listings WHERE id=(entry->>'listing_id')::uuid;
    SELECT * INTO STRICT s FROM public.sellers WHERE id=p.seller_id;
    rate:=CASE WHEN s.is_vat_registered=false THEN 0
      WHEN s.is_vat_registered=true AND p.vat_rate IN (0,5,12,21) THEN p.vat_rate ELSE NULL END;
    IF rate IS NULL OR s.delivery_mode IS NULL OR s.delivery_mode NOT IN ('locker','courier') THEN needs_review:=true; END IF;
    lines:=lines||jsonb_build_array(entry||jsonb_build_object(
      'vat_rate',rate,'commission_rate',15,'seller_delivery_mode',s.delivery_mode,
      'seller_courier_fee_cents',CASE s.delivery_mode WHEN 'courier' THEN 350 WHEN 'locker' THEN 0 ELSE NULL END));
  END LOOP;
  NEW.items:=lines;
  NEW.financial_snapshot:=jsonb_build_object('version','marketplace-finance-v1','operator_version','izipizi-2026-09-01',
    'operator',op,'requires_review',needs_review,'pickup_fee_scope','once_per_seller_order_destination');
  RETURN NEW;
END $$;
CREATE TRIGGER marketplace_capture_finance_v1 BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.marketplace_capture_finance_v1();
REVOKE ALL ON FUNCTION public.marketplace_capture_finance_v1() FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE public.marketplace_refund_reviews_v1 (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id),
  actor_id uuid NOT NULL,
  amount_cents integer NOT NULL CHECK(amount_cents>0),
  provider_reference text NOT NULL UNIQUE CHECK(length(btrim(provider_reference))>=3),
  evidence text NOT NULL CHECK(length(btrim(evidence))>=10),
  externally_refunded_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.marketplace_refund_reviews_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_refund_reviews_v1 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.marketplace_refund_reviews_v1 TO service_role;

-- Records an already executed external refund. Never makes a bank/provider request.
CREATE FUNCTION public.marketplace_record_refund_v1(
  p_order_id uuid,p_actor_id uuid,p_amount_cents integer,p_reference text,p_evidence text,p_refunded_at timestamptz
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE ord public.orders%ROWTYPE; previous public.marketplace_refund_reviews_v1%ROWTYPE;
BEGIN
  SELECT * INTO ord FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR ord.lifecycle_version IS DISTINCT FROM 'marketplace-v1' OR ord.status<>'cancelled'
     OR ord.payment_status NOT IN ('paid','refunded') OR ord.payment_review_reason='conflicting_payment_receipt'
     OR p_actor_id IS NULL OR p_amount_cents IS NULL OR p_amount_cents IS DISTINCT FROM ord.payment_received_cents
     OR p_refunded_at IS NULL OR p_refunded_at>clock_timestamp()
     OR coalesce(length(btrim(p_reference)),0)<3 OR coalesce(length(btrim(p_evidence)),0)<10 THEN
    RAISE EXCEPTION 'Verified exact external refund evidence required';
  END IF;
  SELECT * INTO previous FROM public.marketplace_refund_reviews_v1 WHERE order_id=ord.id;
  IF FOUND THEN
    IF previous.amount_cents<>p_amount_cents OR previous.provider_reference<>btrim(p_reference)
       OR previous.evidence<>btrim(p_evidence) OR previous.externally_refunded_at<>p_refunded_at THEN
      RAISE EXCEPTION 'Conflicting refund evidence';
    END IF;
    RETURN false;
  END IF;
  IF ord.payment_status='refunded' THEN RAISE EXCEPTION 'Unverified previous refund requires reconciliation'; END IF;
  INSERT INTO public.marketplace_refund_reviews_v1(order_id,actor_id,amount_cents,provider_reference,evidence,externally_refunded_at)
    VALUES(ord.id,p_actor_id,p_amount_cents,btrim(p_reference),btrim(p_evidence),p_refunded_at);
  UPDATE public.orders SET payment_status='refunded' WHERE id=ord.id;
  INSERT INTO public.marketplace_events_v1(event_key,order_id,event_type,payload)
    VALUES(ord.id||':refund-recorded',ord.id,'payment_review','{"reason":"external_refund_recorded"}');
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.marketplace_record_refund_v1(uuid,uuid,integer,text,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_record_refund_v1(uuid,uuid,integer,text,text,timestamptz) TO service_role;
COMMIT;
