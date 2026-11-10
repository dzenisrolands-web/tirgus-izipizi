-- Run only against a disposable fixture database with 0041 installed.
-- The fixture intentionally includes historical selections of the closed locker.
BEGIN;
DO $$
BEGIN
  UPDATE public.orders SET status = 'processing' WHERE id = 'historic-order';
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = 'historic-order' AND delivery_info->>'locker_id' = 'tukums') THEN
    RAISE EXCEPTION 'Historical order changed';
  END IF;

  BEGIN
    INSERT INTO public.orders (id, delivery_info) VALUES ('new-closed', '{"locker_id":"tukums"}');
    RAISE EXCEPTION 'Expected closed destination rejection';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.sellers (id, home_locker_ids) VALUES ('new-closed', ARRAY['tukums']);
    RAISE EXCEPTION 'Expected closed dropoff rejection';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.listings (id, locker_id) VALUES ('new-closed', 'tukums');
    RAISE EXCEPTION 'Expected closed listing location rejection';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.hot_drops (id, pickup_locker_id) VALUES ('new-closed', 'tukums');
    RAISE EXCEPTION 'Expected closed hot-drop location rejection';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.hot_drop_reservations (id, delivery_locker_id) VALUES ('new-closed', 'tukums');
    RAISE EXCEPTION 'Expected closed reservation destination rejection';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.locker_subscriptions (id, locker_id) VALUES ('new-closed', 'tukums');
    RAISE EXCEPTION 'Expected closed subscription rejection';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  UPDATE public.sellers SET name = 'Unrelated edit' WHERE id = 'historic-seller';
  INSERT INTO public.orders (id, delivery_info) VALUES ('new-open', '{"locker_id":"brivibas"}');
  UPDATE public.orders SET delivery_info = '{"locker_id":"brivibas"}' WHERE id = 'historic-order';
END;
$$;
ROLLBACK;
