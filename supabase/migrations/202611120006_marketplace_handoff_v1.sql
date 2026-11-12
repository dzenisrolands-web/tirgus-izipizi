BEGIN;
CREATE TABLE public.marketplace_handoffs_v1 (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id),
  source_key text NOT NULL UNIQUE,
  envelope jsonb NOT NULL,
  state text NOT NULL DEFAULT 'prepared' CHECK(state IN ('prepared','in_flight','recorded','review')),
  prepared_by uuid NOT NULL,
  claim_token uuid,
  lease_until timestamptz,
  receiver_id uuid,
  outcome_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.marketplace_handoffs_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_handoffs_v1 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.marketplace_handoffs_v1 TO service_role;
CREATE FUNCTION public.marketplace_prepare_handoff_v1(p_order_id uuid,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE ord public.orders%ROWTYPE; result public.marketplace_handoffs_v1%ROWTYPE;
BEGIN
  SELECT * INTO ord FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR p_actor_id IS NULL OR ord.lifecycle_version IS DISTINCT FROM 'marketplace-v1'
     OR ord.status<>'processing' OR ord.payment_status IS DISTINCT FROM 'paid' OR ord.paid_at IS NULL
     OR ord.payment_review_reason IS NOT NULL OR (SELECT count(*) FROM public.marketplace_reservations_v1
       WHERE order_id=ord.id AND state='consumed')<>jsonb_array_length(ord.items) THEN
    RAISE EXCEPTION 'Verified processing order required for handoff';
  END IF;
  INSERT INTO public.marketplace_handoffs_v1(order_id,source_key,prepared_by,envelope)
    VALUES(ord.id,'marketplace/persisted_id/'||ord.id::text,p_actor_id,
      jsonb_build_object('schema','marketplace-order-v1','sellerSnapshots','[]'::jsonb,
        'record',jsonb_build_object('id',ord.id,'order_number',ord.order_number,'status',ord.status,
          'created_at',ord.created_at,'payment_status',ord.payment_status,'payment_provider',ord.payment_provider,
          'buyer_id',ord.buyer_id,'buyer_name',ord.buyer_name,'buyer_email',ord.buyer_email,'buyer_phone',ord.buyer_phone,
          'seller_ids',ord.seller_ids,'items',ord.items,'delivery_type',ord.delivery_type,'delivery_info',ord.delivery_info,
          'total_cents',ord.total_cents,'total_amount',ord.total_amount,'promo_discount_cents',ord.promo_discount_cents)))
    ON CONFLICT(order_id) DO NOTHING;
  SELECT * INTO result FROM public.marketplace_handoffs_v1 WHERE order_id=ord.id;
  RETURN jsonb_build_object('source_key',result.source_key,'state',result.state,'dispatch_authorized',false,'billing_authorized',false);
END $$;
CREATE FUNCTION public.marketplace_claim_handoff_v1(p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE job public.marketplace_handoffs_v1%ROWTYPE; ord public.orders%ROWTYPE;
BEGIN
  SELECT * INTO ord FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR ord.status<>'processing' OR ord.payment_status IS DISTINCT FROM 'paid'
     OR ord.payment_review_reason IS NOT NULL THEN RAISE EXCEPTION 'Order is no longer eligible'; END IF;
  SELECT * INTO job FROM public.marketplace_handoffs_v1 WHERE order_id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF job.state='in_flight' AND job.lease_until<=clock_timestamp() THEN
    UPDATE public.marketplace_handoffs_v1 SET state='review',outcome_code='receiver_outcome_unknown' WHERE order_id=p_order_id;
    RETURN NULL;
  END IF;
  IF job.state<>'prepared' THEN RETURN NULL; END IF;
  UPDATE public.marketplace_handoffs_v1 SET state='in_flight',claim_token=gen_random_uuid(),
    lease_until=clock_timestamp()+interval '2 minutes' WHERE order_id=p_order_id RETURNING * INTO job;
  RETURN to_jsonb(job);
END $$;
CREATE FUNCTION public.marketplace_finish_handoff_v1(p_order_id uuid,p_token uuid,p_receiver_id uuid,p_accepted boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE ord public.orders%ROWTYPE; committed text;
BEGIN
  SELECT * INTO ord FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE public.marketplace_handoffs_v1 SET state=CASE WHEN p_accepted IS TRUE AND p_receiver_id IS NOT NULL
    AND ord.status='processing' AND ord.payment_status='paid' AND ord.payment_review_reason IS NULL
    THEN 'recorded' ELSE 'review' END,
    receiver_id=CASE WHEN p_accepted IS TRUE THEN p_receiver_id ELSE NULL END,
    outcome_code=CASE WHEN p_accepted IS TRUE THEN 'receiver_acknowledged' ELSE 'receiver_outcome_unknown' END,
    claim_token=NULL,lease_until=NULL
    WHERE order_id=p_order_id AND state='in_flight' AND claim_token=p_token AND lease_until>clock_timestamp()
    RETURNING state INTO committed;
  RETURN CASE WHEN FOUND THEN jsonb_build_object('state',committed) ELSE NULL END;
END $$;
REVOKE ALL ON FUNCTION public.marketplace_prepare_handoff_v1(uuid,uuid),public.marketplace_claim_handoff_v1(uuid),
  public.marketplace_finish_handoff_v1(uuid,uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_prepare_handoff_v1(uuid,uuid),public.marketplace_claim_handoff_v1(uuid),
  public.marketplace_finish_handoff_v1(uuid,uuid,uuid,boolean) TO service_role;
COMMIT;
