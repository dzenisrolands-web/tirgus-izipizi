-- Apply after 0042/0043; deploy before the checkout/webhook application changes.
BEGIN;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS reservation_expires_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_review_reason text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_received_cents integer;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancellation_reason text;

CREATE TABLE public.marketplace_stock_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE RESTRICT,
  variant_id text,
  quantity integer NOT NULL CHECK (quantity > 0),
  state text NOT NULL DEFAULT 'held' CHECK (state IN ('held', 'consumed', 'released')),
  release_reason text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX marketplace_reservations_order ON public.marketplace_stock_reservations(order_id);
CREATE INDEX marketplace_reservations_expiry ON public.marketplace_stock_reservations(expires_at) WHERE state = 'held';
ALTER TABLE public.marketplace_stock_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_stock_reservations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.marketplace_stock_reservations TO service_role;

-- A held variant must remain addressable until settlement/release. Sellers may
-- change prices or replenish stock, but may not remove/re-key a reserved SKU.
CREATE OR REPLACE FUNCTION public.guard_reserved_listing_variants()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.marketplace_stock_reservations r WHERE r.listing_id = OLD.id AND r.state = 'held'
    AND ((r.variant_id IS NULL AND jsonb_array_length(coalesce(NEW.variants, '[]'::jsonb)) > 0)
      OR (r.variant_id IS NOT NULL AND
        (SELECT count(*) FROM jsonb_array_elements(coalesce(NEW.variants, '[]'::jsonb)) v
         WHERE v->>'id' = r.variant_id AND (v->>'quantity')::integer >= 0) <> 1))
  ) THEN RAISE EXCEPTION 'Cannot remove reserved SKU' USING ERRCODE = '22023'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_reserved_listing_variants BEFORE UPDATE OF variants ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.guard_reserved_listing_variants();

CREATE OR REPLACE FUNCTION public.guard_reserved_order_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('paid','processing','shipped','delivered')
    AND NOT EXISTS (
      SELECT 1 FROM public.marketplace_stock_reservations WHERE order_id = OLD.id AND state = 'consumed'
    ) THEN
    RAISE EXCEPTION 'Consumed reservation evidence required for fulfillment' USING ERRCODE = '22023';
  END IF;
  IF NEW.payment_review_reason IS NOT NULL AND NEW.status IS DISTINCT FROM OLD.status
      AND NEW.status IN ('paid','processing','shipped','delivered') THEN
    RAISE EXCEPTION 'Payment review blocks fulfillment' USING ERRCODE = '22023';
  END IF;
  IF OLD.reservation_expires_at IS NOT NULL THEN
    IF NEW.status = 'cancelled' AND EXISTS (
      SELECT 1 FROM public.marketplace_stock_reservations WHERE order_id = OLD.id AND state = 'held'
    ) THEN RAISE EXCEPTION 'Release reservation through cancellation RPC first' USING ERRCODE = '22023'; END IF;
    IF NEW.payment_status = 'paid' AND OLD.payment_status IS DISTINCT FROM 'paid' AND (
      EXISTS (SELECT 1 FROM public.marketplace_stock_reservations WHERE order_id = OLD.id AND state = 'held')
      OR (NEW.payment_review_reason IS NULL AND NOT EXISTS (
        SELECT 1 FROM public.marketplace_stock_reservations WHERE order_id = OLD.id AND state = 'consumed'
      ))
    ) THEN RAISE EXCEPTION 'Settle payment through reservation RPC first' USING ERRCODE = '22023'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_reserved_order_state BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_reserved_order_state();

CREATE OR REPLACE FUNCTION public.create_reserved_marketplace_order(p_order jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  item jsonb; listing public.listings%ROWTYPE; seller public.sellers%ROWTYPE;
  variant jsonb; variant_index integer; variant_id text; qty integer; price_cents integer;
  subtotal bigint := 0; fee integer; discount integer; seller_ids uuid[];
  new_order public.orders%ROWTYPE; expires timestamptz := clock_timestamp() + interval '30 minutes';
BEGIN
  IF jsonb_typeof(p_order->'items') IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_order->'items') NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Invalid cart' USING ERRCODE = '22023';
  END IF;
  SELECT array_agg(DISTINCT (value->>'seller_id')::uuid ORDER BY (value->>'seller_id')::uuid)
    INTO seller_ids FROM jsonb_array_elements(p_order->'items');
  IF seller_ids IS NULL OR array_position(seller_ids, NULL) IS NOT NULL OR
     seller_ids IS DISTINCT FROM ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(p_order->'seller_ids') ORDER BY value::uuid) THEN
    RAISE EXCEPTION 'Seller changed' USING ERRCODE = '22023';
  END IF;
  -- All operations take order locks first (when present), then listing locks in UUID order.
  -- Sellers are locked before listings at creation to freeze approval and fulfillment mode.
  PERFORM 1 FROM public.sellers WHERE id = ANY(seller_ids) ORDER BY id FOR SHARE;
  IF (SELECT count(*) FROM public.sellers WHERE id = ANY(seller_ids)
      AND status = 'approved' AND delivery_mode IN ('locker','courier')) <> cardinality(seller_ids) THEN
    RAISE EXCEPTION 'Seller unavailable' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.listings WHERE id IN (
    SELECT (value->>'listing_id')::uuid FROM jsonb_array_elements(p_order->'items')
  ) ORDER BY id FOR UPDATE;
  FOR item IN SELECT value FROM jsonb_array_elements(p_order->'items')
              ORDER BY value->>'listing_id', value->>'id' LOOP
    SELECT * INTO listing FROM public.listings WHERE id = (item->>'listing_id')::uuid;
    IF NOT FOUND OR listing.status <> 'active' OR listing.seller_id IS DISTINCT FROM (item->>'seller_id')::uuid THEN
      RAISE EXCEPTION 'Listing unavailable or seller changed' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO STRICT seller FROM public.sellers WHERE id = listing.seller_id;
    IF (item ? 'category' AND coalesce(item->>'category','') IS DISTINCT FROM coalesce(listing.category::text,''))
      OR (item ? 'storage_type' AND coalesce(item->>'storage_type','') IS DISTINCT FROM coalesce(listing.storage_type::text,''))
      OR (item ? 'seller_home_locker_ids' AND item->'seller_home_locker_ids' IS DISTINCT FROM
          to_jsonb(coalesce(seller.home_locker_ids,'{}'::text[]))) THEN
      RAISE EXCEPTION 'Delivery quote metadata changed' USING ERRCODE = '22023';
    END IF;
    IF (item->>'commission_rate')::numeric IS DISTINCT FROM 15::numeric OR
      (item->>'seller_courier_fee_cents')::integer IS DISTINCT FROM
        (CASE WHEN seller.delivery_mode = 'courier' THEN 350 ELSE 0 END) THEN
      RAISE EXCEPTION 'Invalid financial snapshot' USING ERRCODE = '22023';
    END IF;
    IF item->>'seller_delivery_mode' IS DISTINCT FROM seller.delivery_mode OR
       (item->>'vat_rate')::numeric IS DISTINCT FROM
         (CASE WHEN seller.is_vat_registered = false THEN 0 ELSE listing.vat_rate END) THEN
      RAISE EXCEPTION 'Seller or VAT changed' USING ERRCODE = '22023';
    END IF;
    IF p_order->>'delivery_type' NOT IN ('locker','courier','express') OR
       (p_order->>'delivery_type' = 'courier' AND listing.courier_delivery = false) OR
       (p_order->>'delivery_type' = 'express' AND listing.express_delivery IS DISTINCT FROM true) THEN
      RAISE EXCEPTION 'Delivery unavailable' USING ERRCODE = '22023';
    END IF;
    qty := (item->>'quantity')::integer;
    IF qty IS NULL OR qty NOT BETWEEN 1 AND 999 OR (item->>'quantity')::numeric <> qty THEN
      RAISE EXCEPTION 'Invalid quantity' USING ERRCODE = '22023';
    END IF;
    variant := NULL; variant_id := NULL; variant_index := NULL;
    IF jsonb_typeof(listing.variants) = 'array' AND jsonb_array_length(listing.variants) > 0 THEN
      IF item->>'id' = listing.id::text THEN
        variant := listing.variants->0; variant_index := 0;
      ELSE
        SELECT v.value, (v.ordinality - 1)::integer INTO variant, variant_index
        FROM jsonb_array_elements(listing.variants) WITH ORDINALITY AS v(value, ordinality)
        WHERE listing.id::text || '-' || (v.value->>'id') = item->>'id';
      END IF;
      variant_id := variant->>'id';
      IF variant_id IS NULL THEN RAISE EXCEPTION 'Unknown variant' USING ERRCODE = '22023'; END IF;
      price_cents := round((variant->>'price')::numeric * 100);
      IF (variant->>'quantity')::integer IS NULL OR (variant->>'quantity')::integer < qty THEN
        RAISE EXCEPTION 'Insufficient variant stock' USING ERRCODE = '22023';
      END IF;
    ELSE
      IF item->>'id' IS DISTINCT FROM listing.id::text THEN
        RAISE EXCEPTION 'Unknown item' USING ERRCODE = '22023';
      END IF;
      price_cents := round(listing.price::numeric * 100);
      IF listing.quantity IS NULL OR listing.quantity < qty THEN RAISE EXCEPTION 'Insufficient stock' USING ERRCODE = '22023'; END IF;
    END IF;
    IF price_cents IS NULL OR price_cents <= 0 OR
       (item->>'price')::numeric * 100 IS DISTINCT FROM price_cents::numeric THEN
      RAISE EXCEPTION 'Price changed' USING ERRCODE = '22023';
    END IF;
    subtotal := subtotal + price_cents::bigint * qty;
    -- Decrement now; a failure anywhere (including order insert) rolls back every SKU.
    IF variant_id IS NULL THEN
      UPDATE public.listings SET quantity = quantity - qty WHERE id = listing.id;
    ELSE
      UPDATE public.listings SET variants = jsonb_set(variants,
        ARRAY[variant_index::text, 'quantity'], to_jsonb((variant->>'quantity')::integer - qty))
        WHERE id = listing.id;
    END IF;
  END LOOP;
  fee := (p_order->'delivery_info'->>'delivery_fee_cents')::integer;
  discount := coalesce((p_order->>'promo_discount_cents')::integer, 0);
  IF fee IS NULL OR fee < 0 OR discount < 0 OR discount > fee OR
     subtotal + fee - discount IS DISTINCT FROM (p_order->>'total_cents')::bigint THEN
    RAISE EXCEPTION 'Invalid total' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.orders (
    order_number, status, payment_status, payment_provider, payment_session_id,
    buyer_id, buyer_name, buyer_email, buyer_phone, delivery_type, delivery_info,
    items, total_cents, total_amount, seller_ids, promo_code, promo_discount_cents, reservation_expires_at
  ) VALUES (
    p_order->>'order_number', 'pending', 'awaiting', 'paysera', p_order->>'order_number',
    (p_order->>'buyer_id')::uuid, p_order->>'buyer_name', p_order->>'buyer_email', p_order->>'buyer_phone',
    p_order->>'delivery_type', p_order->'delivery_info', p_order->'items',
    (p_order->>'total_cents')::integer, (p_order->>'total_cents')::numeric / 100,
    seller_ids, p_order->>'promo_code', discount, expires
  ) RETURNING * INTO new_order;
  FOR item IN SELECT value FROM jsonb_array_elements(p_order->'items') LOOP
    SELECT * INTO STRICT listing FROM public.listings WHERE id = (item->>'listing_id')::uuid;
    variant_id := NULL;
    IF jsonb_typeof(listing.variants) = 'array' AND jsonb_array_length(listing.variants) > 0 THEN
      IF item->>'id' = listing.id::text THEN variant_id := listing.variants->0->>'id';
      ELSE
        SELECT value->>'id' INTO STRICT variant_id FROM jsonb_array_elements(listing.variants)
        WHERE listing.id::text || '-' || (value->>'id') = item->>'id';
      END IF;
    END IF;
    INSERT INTO public.marketplace_stock_reservations(order_id,listing_id,variant_id,quantity,expires_at)
      VALUES(new_order.id,listing.id,variant_id,(item->>'quantity')::integer,expires);
  END LOOP;
  RETURN jsonb_build_object('order_id',new_order.id,'order_number',new_order.order_number,'reserved_until',expires);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_reserved_order(p_order_id uuid, p_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  ord public.orders%ROWTYPE; hold public.marketplace_stock_reservations%ROWTYPE;
  listing public.listings%ROWTYPE; idx integer; stock integer;
BEGIN
  SELECT * INTO ord FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  -- Consumed inventory stays consumed pending a manual return/restock decision.
  -- The service-only caller must authenticate an administrator for admin_cancel:.
  IF ord.payment_status = 'paid' THEN
    IF (p_reason = 'auto_cancel_unconfirmed_72h' AND ord.status = 'paid'
          AND ord.paid_at IS NOT NULL AND ord.paid_at <= clock_timestamp() - interval '72 hours')
       OR (p_reason LIKE 'admin_cancel:%' AND length(trim(substr(p_reason,14))) > 0
          AND ord.status IN ('paid','processing')) THEN
      UPDATE public.orders SET status = 'cancelled',
        payment_review_reason = coalesce(payment_review_reason,'refund_required'),
        cancellation_reason = left(p_reason,2000) WHERE id = p_order_id;
      RETURN true;
    END IF;
    RETURN false;
  END IF;
  PERFORM 1 FROM public.listings WHERE id IN (
    SELECT listing_id FROM public.marketplace_stock_reservations WHERE order_id = p_order_id AND state = 'held'
  ) ORDER BY id FOR UPDATE;
  FOR hold IN SELECT * FROM public.marketplace_stock_reservations
      WHERE order_id = p_order_id AND state = 'held' ORDER BY listing_id, id FOR UPDATE LOOP
    IF hold.variant_id IS NULL THEN
      UPDATE public.listings SET quantity = quantity + hold.quantity WHERE id = hold.listing_id;
    ELSE
      SELECT * INTO STRICT listing FROM public.listings WHERE id = hold.listing_id;
      SELECT (ordinality-1)::integer, (value->>'quantity')::integer INTO STRICT idx, stock
        FROM jsonb_array_elements(listing.variants) WITH ORDINALITY
        WHERE value->>'id' = hold.variant_id;
      UPDATE public.listings SET variants = jsonb_set(variants,ARRAY[idx::text,'quantity'],to_jsonb(stock + hold.quantity))
        WHERE id = hold.listing_id;
    END IF;
    UPDATE public.marketplace_stock_reservations SET state = 'released', release_reason = left(p_reason, 200) WHERE id = hold.id;
  END LOOP;
  UPDATE public.orders SET status = 'cancelled',
    cancellation_reason = coalesce(cancellation_reason,left(p_reason,2000)) WHERE id = p_order_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.settle_reserved_marketplace_order(p_order_number text, p_amount_cents integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE ord public.orders%ROWTYPE; reason text; held integer;
BEGIN
  SELECT * INTO ord FROM public.orders WHERE order_number = p_order_number FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found' USING ERRCODE = '22023'; END IF;
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Invalid received amount' USING ERRCODE = '22023';
  END IF;
  IF ord.payment_status = 'refunded' THEN
    RETURN jsonb_build_object('outcome','already_paid','order_id',ord.id,'review_reason',ord.payment_review_reason);
  END IF;
  IF ord.payment_status = 'paid' THEN
    -- Preserve previous receipt evidence on duplicate callbacks. Conflicting
    -- verified evidence and legacy unreserved paid orders need human review.
    IF p_amount_cents IS DISTINCT FROM coalesce(ord.payment_received_cents,ord.total_cents) THEN
      UPDATE public.orders SET payment_review_reason = 'conflicting_payment_amount',
        payment_received_cents = coalesce(payment_received_cents,p_amount_cents)
        WHERE id = ord.id;
    ELSIF ord.reservation_expires_at IS NULL AND ord.payment_review_reason IS NULL THEN
      UPDATE public.orders SET payment_review_reason = 'legacy_paid_requires_review',
        payment_received_cents = coalesce(payment_received_cents,p_amount_cents) WHERE id = ord.id;
    END IF;
    SELECT payment_review_reason INTO reason FROM public.orders WHERE id = ord.id;
    RETURN jsonb_build_object('outcome','already_paid','order_id',ord.id,'review_reason',reason);
  END IF;
  SELECT count(*) INTO held FROM public.marketplace_stock_reservations WHERE order_id = ord.id AND state = 'held';
  IF p_amount_cents IS DISTINCT FROM ord.total_cents THEN
    reason := 'amount_mismatch';
  ELSIF EXISTS (SELECT 1 FROM jsonb_array_elements(ord.items) i WHERE i ? 'drop_id') THEN
    reason := 'hot_drop_requires_review';
  ELSIF ord.reservation_expires_at IS NULL OR held = 0 THEN
    reason := 'legacy_or_released_reservation';
  ELSIF ord.status <> 'pending' OR ord.payment_status <> 'awaiting' THEN
    reason := 'cancelled_order_paid';
  ELSIF ord.reservation_expires_at <= clock_timestamp() THEN
    reason := 'expired_reservation_paid';
  END IF;
  IF reason IS NOT NULL THEN
    PERFORM public.cancel_reserved_order(ord.id, reason);
    UPDATE public.orders SET payment_status = 'paid', paid_at = clock_timestamp(),
      status = 'cancelled', payment_review_reason = reason, payment_received_cents = p_amount_cents WHERE id = ord.id;
    RETURN jsonb_build_object('outcome','review','order_id',ord.id,'review_reason',reason);
  END IF;
  UPDATE public.marketplace_stock_reservations SET state = 'consumed' WHERE order_id = ord.id AND state = 'held';
  UPDATE public.orders SET payment_status = 'paid', status = 'paid', paid_at = clock_timestamp(),
    payment_received_cents = p_amount_cents WHERE id = ord.id;
  RETURN jsonb_build_object('outcome','paid','order_id',ord.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_marketplace_reservations()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE order_ids uuid[]; candidate_order_id uuid; expired integer := 0;
BEGIN
  SELECT array_agg(candidate.id ORDER BY candidate.id) INTO order_ids FROM (
    SELECT o.id FROM public.orders o WHERE o.payment_status <> 'paid'
    AND o.reservation_expires_at <= clock_timestamp()
    AND EXISTS (SELECT 1 FROM public.marketplace_stock_reservations r WHERE r.order_id = o.id AND r.state = 'held')
    ORDER BY o.id LIMIT 500 FOR UPDATE OF o SKIP LOCKED
  ) candidate;
  IF order_ids IS NULL THEN RETURN 0; END IF;
  -- Lock the entire batch's inventory in a single global order, not per order.
  PERFORM 1 FROM public.listings WHERE id IN (
    SELECT listing_id FROM public.marketplace_stock_reservations WHERE order_id = ANY(order_ids) AND state = 'held'
  ) ORDER BY id FOR UPDATE;
  FOREACH candidate_order_id IN ARRAY order_ids LOOP
    IF public.cancel_reserved_order(candidate_order_id, 'expired') THEN expired := expired + 1; END IF;
  END LOOP;
  RETURN expired;
END;
$$;

REVOKE ALL ON FUNCTION public.create_reserved_marketplace_order(jsonb),
  public.settle_reserved_marketplace_order(text,integer), public.cancel_reserved_order(uuid,text),
  public.expire_marketplace_reservations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_reserved_marketplace_order(jsonb),
  public.settle_reserved_marketplace_order(text,integer), public.cancel_reserved_order(uuid,text),
  public.expire_marketplace_reservations() TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
