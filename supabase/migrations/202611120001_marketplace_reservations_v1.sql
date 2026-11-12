-- Source preparation only. Rehearse against the actual schema before deployment.
-- No historical UPDATE/backfill, provider calls, or automatic feature activation.
BEGIN;
ALTER TABLE public.orders ADD COLUMN lifecycle_version text;
ALTER TABLE public.orders ADD COLUMN reservation_expires_at timestamptz;
ALTER TABLE public.orders ADD COLUMN payment_review_reason text;
ALTER TABLE public.orders ADD COLUMN payment_received_cents integer;
ALTER TABLE public.orders ADD COLUMN financial_snapshot jsonb;

CREATE TABLE public.marketplace_reservations_v1 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE RESTRICT,
  variant_id text,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 999),
  state text NOT NULL DEFAULT 'held' CHECK (state IN ('held','consumed','released')),
  expires_at timestamptz NOT NULL,
  release_reason text,
  UNIQUE NULLS NOT DISTINCT (order_id, listing_id, variant_id)
);
CREATE INDEX marketplace_reservations_v1_expiry
  ON public.marketplace_reservations_v1(expires_at) WHERE state = 'held';
ALTER TABLE public.marketplace_reservations_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_reservations_v1 FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.marketplace_reservations_v1 TO service_role;

CREATE FUNCTION public.marketplace_guard_skus_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.marketplace_reservations_v1 r WHERE r.listing_id=OLD.id AND r.state='held' AND
    ((r.variant_id IS NULL AND coalesce(NEW.variants,'[]'::jsonb)<>'[]'::jsonb)
     OR (r.variant_id IS NOT NULL AND (SELECT count(*) FROM jsonb_array_elements(coalesce(NEW.variants,'[]'::jsonb)) v
       WHERE v->>'id'=r.variant_id AND jsonb_typeof(v->'quantity')='number'
       AND (v->>'quantity')::numeric>=0 AND (v->>'quantity')::numeric=trunc((v->>'quantity')::numeric))<>1))) THEN
    RAISE EXCEPTION 'Cannot remove or corrupt held SKU' USING ERRCODE='22023';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER marketplace_guard_skus_v1 BEFORE UPDATE OF variants ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.marketplace_guard_skus_v1();
REVOKE ALL ON FUNCTION public.marketplace_guard_skus_v1() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.marketplace_reserve_v1(p_order jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  item jsonb; product public.listings%ROWTYPE; producer public.sellers%ROWTYPE;
  chosen jsonb; idx integer; sku text; qty integer; unit_cents numeric;
  subtotal bigint := 0; fee bigint; discount bigint; seller_keys uuid[];
  created public.orders%ROWTYPE; deadline timestamptz := clock_timestamp() + interval '30 minutes';
BEGIN
  IF jsonb_typeof(p_order->'items') IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_order->'items') NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Invalid reservation cart' USING ERRCODE='22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_order->'items') i WHERE i ? 'drop_id') THEN
    RAISE EXCEPTION 'Hot drops require a separate lifecycle' USING ERRCODE='22023';
  END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(p_order->'items')) <>
     (SELECT count(DISTINCT jsonb_build_array(i->>'listing_id', i->>'variant_id'))
        FROM jsonb_array_elements(p_order->'items') i) THEN
    RAISE EXCEPTION 'Duplicate SKU' USING ERRCODE='22023';
  END IF;
  SELECT array_agg(DISTINCT (i->>'seller_id')::uuid ORDER BY (i->>'seller_id')::uuid)
    INTO seller_keys FROM jsonb_array_elements(p_order->'items') i;
  IF seller_keys IS NULL OR array_position(seller_keys,NULL) IS NOT NULL
     OR jsonb_typeof(p_order->'seller_ids') IS DISTINCT FROM 'array'
     OR seller_keys IS DISTINCT FROM ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(p_order->'seller_ids') ORDER BY value::uuid) THEN
    RAISE EXCEPTION 'Invalid seller audience' USING ERRCODE='22023';
  END IF;
  PERFORM 1 FROM public.sellers WHERE id = ANY(seller_keys) ORDER BY id FOR SHARE;
  IF (SELECT count(*) FROM public.sellers WHERE id = ANY(seller_keys) AND status = 'approved') <> cardinality(seller_keys) THEN
    RAISE EXCEPTION 'Seller unavailable' USING ERRCODE='22023';
  END IF;
  -- All reservation operations acquire order locks first (if present), then
  -- inventory locks in UUID order, irrespective of the submitted cart order.
  PERFORM 1 FROM public.listings WHERE id IN
    (SELECT (i->>'listing_id')::uuid FROM jsonb_array_elements(p_order->'items') i)
    ORDER BY id FOR UPDATE;
  FOR item IN SELECT value FROM jsonb_array_elements(p_order->'items')
              ORDER BY value->>'listing_id', value->>'variant_id' LOOP
    SELECT * INTO product FROM public.listings WHERE id=(item->>'listing_id')::uuid;
    IF NOT FOUND OR product.status IS DISTINCT FROM 'active'
       OR product.seller_id IS DISTINCT FROM (item->>'seller_id')::uuid
       OR item->>'id' IS DISTINCT FROM product.id::text
       OR NOT (item ? 'variant_id') THEN
      RAISE EXCEPTION 'Listing identity changed' USING ERRCODE='22023';
    END IF;
    SELECT * INTO STRICT producer FROM public.sellers WHERE id=product.seller_id;
    IF p_order->>'delivery_type' IS NULL OR p_order->>'delivery_type' NOT IN ('locker','courier','express')
       OR (p_order->>'delivery_type'='courier' AND product.courier_delivery IS DISTINCT FROM true)
       OR (p_order->>'delivery_type'='express' AND product.express_delivery IS DISTINCT FROM true)
       OR item->>'category' IS DISTINCT FROM coalesce(product.category::text,'')
       OR item->>'storage_type' IS DISTINCT FROM product.storage_type::text THEN
      RAISE EXCEPTION 'Delivery facts changed' USING ERRCODE='22023';
    END IF;
    IF jsonb_typeof(item->'quantity') IS DISTINCT FROM 'number'
       OR (item->>'quantity')::numeric <> trunc((item->>'quantity')::numeric)
       OR (item->>'quantity')::numeric NOT BETWEEN 1 AND 999 THEN
      RAISE EXCEPTION 'Invalid quantity' USING ERRCODE='22023';
    END IF;
    qty := (item->>'quantity')::integer;
    sku := item->>'variant_id'; idx := NULL; chosen := NULL;
    IF jsonb_typeof(product.variants)='array' AND jsonb_array_length(product.variants)>0 THEN
      IF sku IS NULL OR (SELECT count(*) FROM jsonb_array_elements(product.variants) v WHERE v->>'id'=sku) <> 1 THEN
        RAISE EXCEPTION 'Explicit unique variant required' USING ERRCODE='22023';
      END IF;
      SELECT value,(ordinality-1)::integer INTO chosen,idx
        FROM jsonb_array_elements(product.variants) WITH ORDINALITY WHERE value->>'id'=sku;
      IF jsonb_typeof(chosen->'quantity') IS DISTINCT FROM 'number'
         OR (chosen->>'quantity')::numeric <> trunc((chosen->>'quantity')::numeric)
         OR (chosen->>'quantity')::numeric < qty THEN
        RAISE EXCEPTION 'Insufficient variant stock' USING ERRCODE='22023';
      END IF;
      unit_cents := (chosen->>'price')::numeric * 100;
    ELSE
      IF sku IS NOT NULL OR product.variants IS NOT NULL AND
         (jsonb_typeof(product.variants) IS DISTINCT FROM 'array' OR jsonb_array_length(product.variants)>0)
         OR product.quantity IS NULL OR product.quantity < qty THEN
        RAISE EXCEPTION 'Insufficient stock or invalid variant' USING ERRCODE='22023';
      END IF;
      unit_cents := product.price::numeric * 100;
    END IF;
    IF unit_cents IS NULL OR unit_cents<=0 OR unit_cents<>trunc(unit_cents)
       OR jsonb_typeof(item->'price') IS DISTINCT FROM 'number'
       OR (item->>'price')::numeric*100 IS DISTINCT FROM unit_cents THEN
      RAISE EXCEPTION 'Price changed' USING ERRCODE='22023';
    END IF;
    subtotal := subtotal + unit_cents::bigint*qty;
    IF sku IS NULL THEN
      UPDATE public.listings SET quantity=quantity-qty WHERE id=product.id;
    ELSE
      UPDATE public.listings SET variants=jsonb_set(variants,ARRAY[idx::text,'quantity'],
        to_jsonb((chosen->>'quantity')::integer-qty)) WHERE id=product.id;
    END IF;
  END LOOP;
  fee := (p_order->'delivery_info'->>'delivery_fee_cents')::bigint;
  discount := (p_order->>'promo_discount_cents')::bigint;
  IF fee IS NULL OR fee<0 OR discount IS NULL OR discount<0 OR discount>subtotal+fee
     OR subtotal+fee-discount<=0 OR subtotal+fee-discount>2147483647
     OR subtotal+fee-discount IS DISTINCT FROM (p_order->>'total_cents')::bigint THEN
    RAISE EXCEPTION 'Invalid order total' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.orders (
    order_number,status,payment_status,payment_provider,payment_session_id,
    buyer_id,buyer_name,buyer_email,buyer_phone,delivery_type,delivery_info,
    items,total_cents,total_amount,seller_ids,promo_code,promo_discount_cents,
    lifecycle_version,reservation_expires_at,financial_snapshot
  ) VALUES (
    p_order->>'order_number','pending','awaiting','paysera',p_order->>'order_number',
    (p_order->>'buyer_id')::uuid,p_order->>'buyer_name',p_order->>'buyer_email',p_order->>'buyer_phone',
    p_order->>'delivery_type',p_order->'delivery_info',p_order->'items',
    (p_order->>'total_cents')::integer,(p_order->>'total_cents')::numeric/100,seller_keys,
    p_order->>'promo_code',discount,'marketplace-v1',deadline,p_order->'financial_snapshot'
  ) RETURNING * INTO created;
  FOR item IN SELECT value FROM jsonb_array_elements(p_order->'items') LOOP
    INSERT INTO public.marketplace_reservations_v1(order_id,listing_id,variant_id,quantity,expires_at)
      VALUES(created.id,(item->>'listing_id')::uuid,item->>'variant_id',(item->>'quantity')::integer,deadline);
  END LOOP;
  RETURN jsonb_build_object('order_id',created.id,'order_number',created.order_number,'reserved_until',deadline);
END $$;

CREATE FUNCTION public.marketplace_release_v1(p_order_id uuid,p_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE ord public.orders%ROWTYPE; hold public.marketplace_reservations_v1%ROWTYPE;
  stock jsonb; pos integer;
BEGIN
  SELECT * INTO ord FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR ord.lifecycle_version IS DISTINCT FROM 'marketplace-v1'
     OR ord.payment_status IN ('paid','refunded') OR ord.status NOT IN ('pending','cancelled') THEN RETURN false; END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 3 AND 200 THEN
    RAISE EXCEPTION 'Cancellation reason required' USING ERRCODE='22023';
  END IF;
  PERFORM 1 FROM public.listings WHERE id IN
    (SELECT listing_id FROM public.marketplace_reservations_v1 WHERE order_id=ord.id AND state='held')
    ORDER BY id FOR UPDATE;
  FOR hold IN SELECT * FROM public.marketplace_reservations_v1
              WHERE order_id=ord.id AND state='held' ORDER BY listing_id,id FOR UPDATE LOOP
    IF hold.variant_id IS NULL THEN
      UPDATE public.listings SET quantity=quantity+hold.quantity WHERE id=hold.listing_id;
    ELSE
      SELECT variants INTO stock FROM public.listings WHERE id=hold.listing_id;
      IF (SELECT count(*) FROM jsonb_array_elements(stock) v WHERE v->>'id'=hold.variant_id)<>1 THEN
        RAISE EXCEPTION 'Reserved variant removed; operator reconciliation required';
      END IF;
      SELECT (ordinality-1)::integer INTO pos FROM jsonb_array_elements(stock) WITH ORDINALITY WHERE value->>'id'=hold.variant_id;
      UPDATE public.listings SET variants=jsonb_set(variants,ARRAY[pos::text,'quantity'],
        to_jsonb((stock->pos->>'quantity')::integer+hold.quantity)) WHERE id=hold.listing_id;
    END IF;
    UPDATE public.marketplace_reservations_v1 SET state='released',release_reason=p_reason WHERE id=hold.id;
  END LOOP;
  UPDATE public.orders SET status='cancelled' WHERE id=ord.id;
  RETURN true;
END $$;

CREATE FUNCTION public.marketplace_expire_v1()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE candidate record; processed integer:=0;
BEGIN
  -- One order per call bounds lock scope and avoids cross-batch lock inversion.
  FOR candidate IN SELECT id FROM public.orders WHERE lifecycle_version='marketplace-v1'
    AND status='pending' AND payment_status IN ('awaiting','failed')
    AND reservation_expires_at<=clock_timestamp() ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED LOOP
    IF public.marketplace_release_v1(candidate.id,'reservation_expired') THEN processed:=processed+1; END IF;
  END LOOP;
  RETURN processed;
END $$;

REVOKE ALL ON FUNCTION public.marketplace_reserve_v1(jsonb),public.marketplace_release_v1(uuid,text),
  public.marketplace_expire_v1() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_reserve_v1(jsonb),public.marketplace_release_v1(uuid,text),
  public.marketplace_expire_v1() TO service_role;
COMMIT;
