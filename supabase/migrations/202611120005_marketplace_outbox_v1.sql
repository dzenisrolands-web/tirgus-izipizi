BEGIN;
CREATE TABLE public.marketplace_outbox_v1 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.marketplace_events_v1(id),
  order_id uuid NOT NULL REFERENCES public.orders(id),
  audience text NOT NULL CHECK(audience IN ('buyer','seller')),
  seller_id uuid,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','in_flight','accepted','review')),
  attempts integer NOT NULL DEFAULT 0,
  claim_token uuid,
  lease_until timestamptz,
  provider_reference text,
  outcome_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT(event_id,audience,seller_id)
);
ALTER TABLE public.marketplace_outbox_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_outbox_v1 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.marketplace_outbox_v1 TO service_role;
CREATE FUNCTION public.marketplace_enqueue_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE producer uuid;
BEGIN
  IF NEW.event_type IN ('payment_confirmed','order_status_changed','order_cancelled') THEN
    INSERT INTO public.marketplace_outbox_v1(event_id,order_id,audience) VALUES(NEW.id,NEW.order_id,'buyer');
  END IF;
  IF NEW.event_type='payment_confirmed' THEN
    FOR producer IN SELECT unnest(seller_ids) FROM public.orders WHERE id=NEW.order_id LOOP
      INSERT INTO public.marketplace_outbox_v1(event_id,order_id,audience,seller_id) VALUES(NEW.id,NEW.order_id,'seller',producer);
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER marketplace_enqueue_v1 AFTER INSERT ON public.marketplace_events_v1
FOR EACH ROW EXECUTE FUNCTION public.marketplace_enqueue_v1();

CREATE FUNCTION public.marketplace_claim_email_v1()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE job public.marketplace_outbox_v1%ROWTYPE;
BEGIN
  -- An expired worker may have sent successfully before losing its DB reply.
  -- Never blindly resend even after Resend's 24h idempotency window has elapsed.
  UPDATE public.marketplace_outbox_v1 SET state='review',outcome_code='lease_expired_outcome_unknown'
    WHERE state='in_flight' AND lease_until<=clock_timestamp();
  SELECT * INTO job FROM public.marketplace_outbox_v1 WHERE state='pending' AND attempts<3
    ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE public.marketplace_outbox_v1 SET state='in_flight',claim_token=gen_random_uuid(),
    lease_until=clock_timestamp()+interval '2 minutes',attempts=attempts+1
    WHERE id=job.id RETURNING * INTO job;
  RETURN to_jsonb(job);
END $$;
CREATE FUNCTION public.marketplace_finish_email_v1(p_id uuid,p_token uuid,p_outcome text,p_reference text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE job public.marketplace_outbox_v1%ROWTYPE;
BEGIN
  SELECT * INTO job FROM public.marketplace_outbox_v1 WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR job.state<>'in_flight' OR job.claim_token IS DISTINCT FROM p_token
     OR job.lease_until<=clock_timestamp() THEN RETURN false; END IF;
  IF p_outcome NOT IN ('accepted','not_sent','uncertain') OR p_outcome IS NULL
     OR (p_outcome='accepted' AND coalesce(length(btrim(p_reference)),0)<3) THEN
    RAISE EXCEPTION 'Explicit provider outcome required';
  END IF;
  UPDATE public.marketplace_outbox_v1 SET state=CASE
    WHEN p_outcome='accepted' THEN 'accepted'
    WHEN p_outcome='not_sent' AND attempts<3 THEN 'pending' ELSE 'review' END,
    provider_reference=CASE WHEN p_outcome='accepted' THEN left(p_reference,200) ELSE NULL END,
    outcome_code=p_outcome,claim_token=NULL,lease_until=NULL WHERE id=job.id;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.marketplace_enqueue_v1() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.marketplace_claim_email_v1(),
  public.marketplace_finish_email_v1(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_claim_email_v1(),
  public.marketplace_finish_email_v1(uuid,uuid,text,text) TO service_role;
COMMIT;
