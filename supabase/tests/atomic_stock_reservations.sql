-- Disposable PG17 fixture only. Never run against a marketplace database.
\set ON_ERROR_STOP on
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
END $$;
CREATE TABLE public.sellers (
  id uuid PRIMARY KEY, status text, delivery_mode text, is_vat_registered boolean,
  home_locker_ids text[] DEFAULT '{}'
);
CREATE TABLE public.listings (
  id uuid PRIMARY KEY, seller_id uuid REFERENCES sellers(id), status text,
  price numeric, quantity integer, variants jsonb DEFAULT '[]',
  vat_rate numeric, courier_delivery boolean DEFAULT true, express_delivery boolean DEFAULT true,
  category text DEFAULT 'dairy', storage_type text DEFAULT 'chilled'
);
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_number text UNIQUE NOT NULL,
  status text, payment_status text, payment_provider text, payment_session_id text,
  buyer_id uuid, buyer_name text, buyer_email text, buyer_phone text,
  delivery_type text, delivery_info jsonb, items jsonb, total_cents integer,
  total_amount numeric, seller_ids uuid[], promo_code text, promo_discount_cents integer, paid_at timestamptz
);
INSERT INTO public.sellers(id,status,delivery_mode,is_vat_registered)
  VALUES ('10000000-0000-0000-0000-000000000001','approved','locker',true);
INSERT INTO public.listings(id,seller_id,status,price,quantity,vat_rate) VALUES
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','active',2,50,21),
  ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','active',2,1,21),
  ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','active',2,20,21);
UPDATE listings SET variants = '[{"id":"small","title":"Small","price":2,"quantity":2},{"id":"large","title":"Large","price":3,"quantity":1}]'
  WHERE id = '20000000-0000-0000-0000-000000000003';

CREATE FUNCTION public.stock_test_order(n text, lid uuid DEFAULT '20000000-0000-0000-0000-000000000001',
  cart_key text DEFAULT NULL, qty integer DEFAULT 1, price numeric DEFAULT 2)
RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_object(
  'order_number',n,'buyer_name','Fixture','buyer_email','fixture@example.invalid',
  'delivery_type','locker','delivery_info',jsonb_build_object('delivery_fee_cents',300),
  'seller_ids',jsonb_build_array('10000000-0000-0000-0000-000000000001'),
  'total_cents',price*100*qty+300,'items',jsonb_build_array(jsonb_build_object(
    'id',coalesce(cart_key,lid::text),'listing_id',lid,'seller_id','10000000-0000-0000-0000-000000000001',
    'seller_delivery_mode','locker','vat_rate',21,'price',price,'quantity',qty,
    'commission_rate',15,'seller_courier_fee_cents',0)))
$$;
\ir ../migrations/0044_atomic_stock_reservations.sql

DO $$
DECLARE result jsonb; oid uuid; payload jsonb; field text;
BEGIN
  IF has_function_privilege('anon','public.create_reserved_marketplace_order(jsonb)','EXECUTE')
    OR has_function_privilege('authenticated','public.settle_reserved_marketplace_order(text,integer)','EXECUTE')
    OR has_table_privilege('authenticated','public.marketplace_stock_reservations','SELECT')
    OR NOT has_function_privilege('service_role','public.cancel_reserved_order(uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'RPC/table grants are unsafe';
  END IF;
  result := create_reserved_marketplace_order(stock_test_order('happy'));
  oid := (result->>'order_id')::uuid;
  IF (SELECT quantity FROM listings WHERE id='20000000-0000-0000-0000-000000000001') <> 49
    OR (result->>'reserved_until')::timestamptz NOT BETWEEN now()+interval '29 minutes' AND now()+interval '31 minutes' THEN
    RAISE EXCEPTION 'Hold did not decrement inventory / reserve 30 minutes';
  END IF;
  BEGIN
    UPDATE orders SET payment_status='paid',status='paid' WHERE id=oid;
    RAISE EXCEPTION 'Direct payment bypass accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    UPDATE orders SET status='cancelled' WHERE id=oid;
    RAISE EXCEPTION 'Direct cancellation leaked hold';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  IF settle_reserved_marketplace_order('happy',500)->>'outcome' <> 'paid'
    OR settle_reserved_marketplace_order('happy',500)->>'outcome' <> 'already_paid'
    OR cancel_reserved_order(oid,'not allowed') THEN RAISE EXCEPTION 'Settlement idempotency failed'; END IF;
  IF (SELECT state FROM marketplace_stock_reservations WHERE order_id=oid) <> 'consumed'
    OR (SELECT quantity FROM listings WHERE id='20000000-0000-0000-0000-000000000001') <> 49 THEN
    RAISE EXCEPTION 'Settlement double-decremented stock';
  END IF;
  BEGIN
    PERFORM create_reserved_marketplace_order(stock_test_order('happy'));
    RAISE EXCEPTION 'Duplicate order inserted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  IF (SELECT quantity FROM listings WHERE id='20000000-0000-0000-0000-000000000001') <> 49 THEN
    RAISE EXCEPTION 'Order insert failure leaked stock';
  END IF;
  payload := stock_test_order('mixed');
  payload := jsonb_set(payload,'{items}',(payload->'items') ||
    (stock_test_order('ignored','20000000-0000-0000-0000-000000000003',
      '20000000-0000-0000-0000-000000000003-large',1,3)->'items'));
  payload := jsonb_set(payload,'{total_cents}','800');
  result := create_reserved_marketplace_order(payload);
  oid := (result->>'order_id')::uuid;
  IF (SELECT count(*) FROM marketplace_stock_reservations WHERE order_id=oid AND state='held') <> 2
    OR (SELECT quantity FROM listings WHERE id='20000000-0000-0000-0000-000000000001') <> 48
    OR (SELECT variants->1->>'quantity' FROM listings WHERE id='20000000-0000-0000-0000-000000000003') <> '0' THEN
    RAISE EXCEPTION 'Mixed base + variant hold incomplete';
  END IF;
  PERFORM cancel_reserved_order(oid,'buyer_cancelled');

  -- Second SKU failure rolls back the first SKU decrement and all inserts.
  payload := stock_test_order('partial');
  payload := jsonb_set(payload,'{items}',(payload->'items') ||
    jsonb_build_array((stock_test_order('ignored','20000000-0000-0000-0000-000000000002',NULL,2)->'items')->0));
  BEGIN
    PERFORM create_reserved_marketplace_order(payload);
    RAISE EXCEPTION 'Oversold second SKU';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  IF EXISTS (SELECT 1 FROM orders WHERE order_number='partial')
    OR (SELECT quantity FROM listings WHERE id='20000000-0000-0000-0000-000000000001') <> 49 THEN
    RAISE EXCEPTION 'Partial stock/order writes';
  END IF;
  BEGIN
    PERFORM create_reserved_marketplace_order(stock_test_order('price',price=>1));
    RAISE EXCEPTION 'Stale price accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    PERFORM create_reserved_marketplace_order(jsonb_set(stock_test_order('seller'),'{items,0,seller_id}',
      '"10000000-0000-0000-0000-000000000099"'));
    RAISE EXCEPTION 'Stale seller accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    PERFORM create_reserved_marketplace_order(jsonb_set(stock_test_order('total'),'{total_cents}','1'));
    RAISE EXCEPTION 'Invalid total accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  FOREACH field IN ARRAY ARRAY['category','storage_type','seller_home_locker_ids','commission_rate','seller_courier_fee_cents'] LOOP
    payload := jsonb_set(stock_test_order('metadata-' || field),ARRAY['items','0',field],
      CASE WHEN field='seller_home_locker_ids' THEN '["changed-locker"]'::jsonb
           WHEN field='commission_rate' THEN '0'::jsonb
           WHEN field='seller_courier_fee_cents' THEN '350'::jsonb
           ELSE '"changed"'::jsonb END);
    BEGIN
      PERFORM create_reserved_marketplace_order(payload);
      RAISE EXCEPTION 'Changed quote/financial metadata accepted: %',field;
    EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  END LOOP;
  IF EXISTS (SELECT 1 FROM orders WHERE order_number LIKE 'metadata-%')
    OR (SELECT quantity FROM listings WHERE id='20000000-0000-0000-0000-000000000001') <> 49 THEN
    RAISE EXCEPTION 'Rejected metadata leaked stock/order writes';
  END IF;

  -- Plain listing and composite first-variant aliases address the SAME inventory.
  payload := stock_test_order('aliases','20000000-0000-0000-0000-000000000003');
  payload := jsonb_set(payload,'{items}',(payload->'items') ||
    (stock_test_order('ignored','20000000-0000-0000-0000-000000000003',
      '20000000-0000-0000-0000-000000000003-small',2)->'items'));
  BEGIN
    PERFORM create_reserved_marketplace_order(payload);
    RAISE EXCEPTION 'Variant aliases oversold';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  result := create_reserved_marketplace_order(stock_test_order('variant','20000000-0000-0000-0000-000000000003'));
  oid := (result->>'order_id')::uuid;
  BEGIN
    UPDATE listings SET variants='[]' WHERE id='20000000-0000-0000-0000-000000000003';
    RAISE EXCEPTION 'Held variant removed';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  PERFORM cancel_reserved_order(oid,'buyer_cancelled');
  PERFORM cancel_reserved_order(oid,'duplicate');
  IF (SELECT cancellation_reason FROM orders WHERE id=oid) <> 'buyer_cancelled' THEN
    RAISE EXCEPTION 'Cancellation reason missing or overwritten by repeat';
  END IF;
  IF (SELECT (variants->0->>'quantity')::integer FROM listings WHERE id='20000000-0000-0000-0000-000000000003') <> 2 THEN
    RAISE EXCEPTION 'Variant release was not exactly once';
  END IF;
  result := settle_reserved_marketplace_order('variant',500);
  IF result->>'outcome' <> 'review'
    OR (SELECT payment_status FROM orders WHERE id=oid) <> 'paid'
    OR (SELECT status FROM orders WHERE id=oid) <> 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled payment lost money facts or fulfilled';
  END IF;

  result := create_reserved_marketplace_order(stock_test_order('expired'));
  oid := (result->>'order_id')::uuid;
  UPDATE orders SET reservation_expires_at=now()-interval '1 second' WHERE id=oid;
  PERFORM expire_marketplace_reservations();
  PERFORM expire_marketplace_reservations();
  result := settle_reserved_marketplace_order('expired',500);
  IF result->>'outcome' <> 'review'
    OR (SELECT quantity FROM listings WHERE id='20000000-0000-0000-0000-000000000001') <> 49 THEN
    RAISE EXCEPTION 'Expired paid order consumed released inventory';
  END IF;
  result := create_reserved_marketplace_order(stock_test_order('late'));
  oid := (result->>'order_id')::uuid;
  UPDATE orders SET reservation_expires_at=now()-interval '1 second' WHERE id=oid;
  IF settle_reserved_marketplace_order('late',500)->>'review_reason' <> 'expired_reservation_paid' THEN
    RAISE EXCEPTION 'Late callback before cron did not review/release';
  END IF;

  INSERT INTO orders(order_number,status,payment_status,total_cents,items)
    VALUES ('legacy','pending','awaiting',500,'[]'),
           ('drop','pending','awaiting',500,'[{"drop_id":"legacy"}]');
  IF settle_reserved_marketplace_order('legacy',500)->>'outcome' <> 'review'
    OR settle_reserved_marketplace_order('drop',500)->>'review_reason' <> 'hot_drop_requires_review' THEN
    RAISE EXCEPTION 'Legacy/drop silently fulfilled';
  END IF;
  result := create_reserved_marketplace_order(stock_test_order('wrong-amount'));
  oid := (result->>'order_id')::uuid;
  result := settle_reserved_marketplace_order('wrong-amount',1);
  IF result->>'review_reason' <> 'amount_mismatch'
    OR (SELECT payment_status FROM orders WHERE id=oid) <> 'paid'
    OR (SELECT payment_received_cents FROM orders WHERE id=oid) <> 1
    OR (SELECT status FROM orders WHERE id=oid) <> 'cancelled'
    OR (SELECT quantity FROM listings WHERE id='20000000-0000-0000-0000-000000000001') <> 49 THEN
    RAISE EXCEPTION 'Wrong amount lost received evidence or inventory';
  END IF;
  BEGIN
    UPDATE orders SET status='processing' WHERE id=oid;
    RAISE EXCEPTION 'Reviewed order advanced fulfillment';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  INSERT INTO orders(order_number,status,payment_status,total_cents,items,paid_at)
    VALUES ('legacy-shipped','shipped','paid',500,'[]',now()-interval '5 days');
  result := settle_reserved_marketplace_order('legacy-shipped',500);
  IF result->>'review_reason' <> 'legacy_paid_requires_review'
      OR (SELECT status FROM orders WHERE order_number='legacy-shipped') <> 'shipped' THEN
    RAISE EXCEPTION 'Legacy fulfilled callback failed or rewrote fulfillment';
  END IF;
  INSERT INTO orders(order_number,status,payment_status,total_cents,items)
    VALUES ('legacy-paid-unverified','paid','paid',500,'[]');
  BEGIN
    UPDATE orders SET status='processing' WHERE order_number='legacy-paid-unverified';
    RAISE EXCEPTION 'Legacy paid order advanced without consumed evidence';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  result := create_reserved_marketplace_order(stock_test_order('admin-cancel'));
  oid := (result->>'order_id')::uuid;
  PERFORM settle_reserved_marketplace_order('admin-cancel',500);
  IF cancel_reserved_order(oid,'auto_cancel_unconfirmed_72h') OR cancel_reserved_order(oid,'admin_cancel:') THEN
    RAISE EXCEPTION 'Young paid order cron-cancelled / empty admin reason';
  END IF;
  IF NOT cancel_reserved_order(oid,'admin_cancel: customer request') OR cancel_reserved_order(oid,'admin_cancel: duplicate') THEN
    RAISE EXCEPTION 'Admin paid cancellation not exactly once';
  END IF;
  IF (SELECT payment_status FROM orders WHERE id=oid) <> 'paid'
      OR (SELECT paid_at FROM orders WHERE id=oid) IS NULL
      OR (SELECT payment_review_reason FROM orders WHERE id=oid) <> 'refund_required'
      OR (SELECT cancellation_reason FROM orders WHERE id=oid) <> 'admin_cancel: customer request'
      OR (SELECT state FROM marketplace_stock_reservations WHERE order_id=oid) <> 'consumed' THEN
    RAISE EXCEPTION 'Admin cancellation erased facts or restocked consumed stock';
  END IF;
  UPDATE orders SET payment_status='refunded' WHERE id=oid;
  result := settle_reserved_marketplace_order('admin-cancel',500);
  IF result->>'outcome' <> 'already_paid' OR (SELECT payment_status FROM orders WHERE id=oid) <> 'refunded' THEN
    RAISE EXCEPTION 'Duplicate callback reversed a refund';
  END IF;
  result := create_reserved_marketplace_order(stock_test_order('cron-cancel'));
  oid := (result->>'order_id')::uuid;
  PERFORM settle_reserved_marketplace_order('cron-cancel',500);
  UPDATE orders SET paid_at=now()-interval '73 hours' WHERE id=oid;
  IF NOT cancel_reserved_order(oid,'auto_cancel_unconfirmed_72h') THEN
    RAISE EXCEPTION 'Old unconfirmed paid order not cancelled';
  END IF;
  result := create_reserved_marketplace_order(stock_test_order('shipped-cancel'));
  oid := (result->>'order_id')::uuid;
  PERFORM settle_reserved_marketplace_order('shipped-cancel',500);
  UPDATE orders SET status='shipped',paid_at=now()-interval '73 hours' WHERE id=oid;
  IF cancel_reserved_order(oid,'auto_cancel_unconfirmed_72h') OR cancel_reserved_order(oid,'admin_cancel: prohibited') THEN
    RAISE EXCEPTION 'Shipped paid order cancelled';
  END IF;
  RAISE NOTICE 'PASS: stock transactions, aliases, lifecycle, reviews and grants';
END;
$$;
